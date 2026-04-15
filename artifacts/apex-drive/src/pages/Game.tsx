import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";

// ─── TRACK DEFINITION ────────────────────────────────────────────────────────
const TRACK_WIDTH = 16;
const ROAD_Y = 0.05;

const RAW_POINTS: [number, number][] = [
  [0, 0], [40, 0], [80, 10], [110, 35], [115, 70],
  [100, 100], [75, 115], [40, 120], [0, 120],
  [-35, 115], [-60, 105], [-80, 80], [-75, 50],
  [-55, 30], [-30, 15], [0, 0],
];

const GEAR_RATIOS = [0, 3.8, 2.6, 1.9, 1.4, 1.1, 0.9];
const GEAR_THRESHOLDS = [0, 20, 45, 75, 110, 145, 185];
const MAX_GEAR = 6;
const FIXED_STEP = 1 / 60;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toFixed(3).padStart(6, "0");
  return `${m}:${ss}`;
}

// ─── MOBILE BUTTON ────────────────────────────────────────────────────────────
interface MobBtnProps {
  label: string;
  onPress: () => void;
  onRelease: () => void;
  style?: React.CSSProperties;
  color?: string;
}

function MobBtn({ label, onPress, onRelease, style, color = "#ffe033" }: MobBtnProps) {
  const [pressed, setPressed] = useState(false);
  const handleDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setPressed(true);
    onPress();
  }, [onPress]);
  const handleUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setPressed(false);
    onRelease();
  }, [onRelease]);
  return (
    <div
      onMouseDown={handleDown} onMouseUp={handleUp} onMouseLeave={handleUp}
      onTouchStart={handleDown} onTouchEnd={handleUp} onTouchCancel={handleUp}
      style={{
        width: 72, height: 72, borderRadius: "50%",
        border: `2px solid ${color}88`,
        background: pressed ? `${color}44` : "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, color, userSelect: "none", cursor: "pointer",
        backdropFilter: "blur(6px)", transition: "background 0.08s",
        boxShadow: pressed ? `0 0 20px ${color}66` : "none",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

// ─── MAIN GAME COMPONENT ─────────────────────────────────────────────────────
type Phase = "start" | "countdown" | "racing";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("start");
  const [phase, setPhase] = useState<Phase>("start");
  const [countdownNum, setCountdownNum] = useState<string>("");
  const [speed, setSpeed] = useState(0);
  const [gear, setGear] = useState<string>("N");
  const [throttlePct, setThrottlePct] = useState(0);
  const [brakePct, setBrakePct] = useState(0);
  const [lapTime, setLapTime] = useState("0:00.000");
  const [bestLap, setBestLap] = useState("--:--.---");
  const [lapCount, setLapCount] = useState(1);
  const [newBest, setNewBest] = useState(false);

  // Input state — mutated directly to avoid React re-render overhead in the loop
  const input = useRef({ w: false, s: false, a: false, d: false, space: false });

  const startCountdown = useCallback(async () => {
    setPhase("countdown");
    phaseRef.current = "countdown";
    for (const n of [3, 2, 1]) {
      setCountdownNum(String(n));
      await new Promise((r) => setTimeout(r, 850));
      setCountdownNum("");
      await new Promise((r) => setTimeout(r, 150));
    }
    setCountdownNum("GO!");
    await new Promise((r) => setTimeout(r, 700));
    setCountdownNum("");
    setPhase("racing");
    phaseRef.current = "racing";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── RENDERER ────────────────────────────────────────────────────────────
    // Test WebGL availability before initializing
    const testCtx = (() => { try { const c = document.createElement("canvas"); return c.getContext("webgl2") || c.getContext("webgl"); } catch { return null; } })();
    if (!testCtx) return; // No WebGL — silently bail, overlay stays visible

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // ─── SCENE ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5ba3dc);
    scene.fog = new THREE.Fog(0x87ceeb, 80, 350);

    // ─── CAMERA ──────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 800);

    const onResize = () => {
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ─── SKY GRADIENT (gradient sky dome) ────────────────────────────────────
    (() => {
      const skyGeo = new THREE.SphereGeometry(500, 16, 8);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vPos;
          void main(){
            float t=clamp((vPos.y+100.0)/250.0,0.0,1.0);
            vec3 top=vec3(0.25,0.55,0.90);
            vec3 bot=vec3(0.65,0.82,0.96);
            gl_FragColor=vec4(mix(bot,top,t),1.0);
          }`,
      });
      scene.add(new THREE.Mesh(skyGeo, skyMat));
    })();

    // ─── CLOUDS ──────────────────────────────────────────────────────────────
    (() => {
      const cloudPositions: [number, number, number, number][] = [
        [80, 60, -120, 1.4], [-110, 70, -80, 1.0], [150, 65, 30, 1.2],
        [-60, 55, 160, 0.9], [30, 75, -180, 1.1], [-180, 60, -30, 1.3],
      ];
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.88 });
      for (const [x, y, z, s] of cloudPositions) {
        const g = new THREE.Group();
        const puffs: [number, number, number, number][] = [[0, 0, 0, 8], [-10, -2, 0, 6], [10, -2, 0, 6], [-5, -5, 0, 5], [5, -5, 0, 5]];
        for (const [px, py, pz, r] of puffs) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), cloudMat);
          m.position.set(px, py, pz);
          g.add(m);
        }
        g.position.set(x, y, z);
        g.scale.setScalar(s);
        scene.add(g);
      }
    })();

    // ─── LIGHTING ────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xcce0ff, 1.0));

    const sun = new THREE.DirectionalLight(0xfff5e0, 3.2);
    sun.position.set(60, 130, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -220;
    sun.shadow.camera.right = sun.shadow.camera.top = 220;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88b8ff, 0.6);
    fill.position.set(-80, 40, -60);
    scene.add(fill);

    // ─── PHYSICS ─────────────────────────────────────────────────────────────
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = false;
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.05;

    const groundMat = new CANNON.Material("ground");
    const wheelMat = new CANNON.Material("wheel");
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, wheelMat, {
      friction: 1.8, restitution: 0.01,
    }));

    // Ground plane physics
    const groundBody = new CANNON.Body({ mass: 0, material: groundMat });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // ─── TRACK ───────────────────────────────────────────────────────────────
    const trackSpline = new THREE.CatmullRomCurve3(
      RAW_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "catmullrom", 0.5
    );
    const DIVS = 240;
    const splinePts = trackSpline.getPoints(DIVS);

    // Compute tangents and normals
    const tangents: THREE.Vector3[] = splinePts.map((_, i) => {
      const next = splinePts[(i + 1) % splinePts.length];
      const prev = splinePts[(i - 1 + splinePts.length) % splinePts.length];
      return new THREE.Vector3().subVectors(next, prev).normalize();
    });
    const normals: THREE.Vector3[] = tangents.map((t) => new THREE.Vector3(-t.z, 0, t.x));

    // Build left/right edges
    const leftEdge = splinePts.map((p, i) => new THREE.Vector2(p.x - normals[i].x * TRACK_WIDTH / 2, p.z - normals[i].z * TRACK_WIDTH / 2));
    const rightEdge = splinePts.map((p, i) => new THREE.Vector2(p.x + normals[i].x * TRACK_WIDTH / 2, p.z + normals[i].z * TRACK_WIDTH / 2));

    // Road mesh
    (() => {
      const total = splinePts.length;
      const verts: number[] = [], uvs: number[] = [], indices: number[] = [];
      for (let i = 0; i < total; i++) {
        const l = leftEdge[i], r = rightEdge[i];
        verts.push(l.x, ROAD_Y, l.y, r.x, ROAD_Y, r.y);
        uvs.push(i / total * 10, 0, i / total * 10, 1);
      }
      for (let i = 0; i < total - 1; i++) {
        const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const a = (total - 1) * 2;
      indices.push(a, a + 1, 0, a + 1, 1, 0);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x1a1a1e, roughness: 0.9, metalness: 0.02,
      }));
      mesh.receiveShadow = true;
      scene.add(mesh);
    })();

    // Center line dashes
    (() => {
      const total = splinePts.length;
      const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
      const W = 0.2;
      for (let i = 0; i < total; i++) {
        const p = splinePts[i], n = normals[i];
        verts.push(p.x - n.x * W, ROAD_Y + 0.01, p.z - n.z * W, p.x + n.x * W, ROAD_Y + 0.01, p.z + n.z * W);
        uvs.push(i / total * 40, 0, i / total * 40, 1);
      }
      for (let i = 0; i < total - 1; i++) {
        const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })));
    })();

    // Grass base
    (() => {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x4a8c2a, roughness: 1 }));
      grass.rotation.x = -Math.PI / 2;
      grass.position.y = -0.01;
      grass.receiveShadow = true;
      scene.add(grass);
    })();

    // Curbs (alternating red/white strips at track edges)
    (() => {
      const total = splinePts.length;
      const BH = 0.08, BW = 0.8;
      for (let i = 0; i < total - 1; i++) {
        const t = tangents[i], n = normals[i];
        const p = splinePts[i], next = splinePts[(i + 1) % total];
        const segLen = p.distanceTo(next);
        if (segLen < 0.1) continue;
        const mat = new THREE.MeshStandardMaterial({ color: Math.floor(i / 3) % 2 === 0 ? 0xff2222 : 0xffffff, roughness: 0.7 });
        const angle = Math.atan2(t.x, t.z);
        for (const side of [-1, 1]) {
          const bx = p.x + n.x * (TRACK_WIDTH / 2 + BW / 2) * side;
          const bz = p.z + n.z * (TRACK_WIDTH / 2 + BW / 2) * side;
          const m = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.05, BH, BW), mat);
          m.position.set(bx, BH / 2, bz);
          m.rotation.y = angle;
          m.receiveShadow = true;
          scene.add(m);
        }
      }
    })();

    // Barriers
    const barriers: { pos: [number, number, number]; size: [number, number, number]; rot: number }[] = [];
    (() => {
      const total = splinePts.length;
      const BH = 0.9, BW = 0.45;
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
      for (let i = 0; i < total - 1; i++) {
        const t = tangents[i], n = normals[i];
        const p = splinePts[i], next = splinePts[(i + 1) % total];
        const segLen = p.distanceTo(next);
        if (segLen < 0.1) continue;
        const mat = Math.floor(i / 5) % 2 === 0 ? whiteMat : redMat;
        const angle = Math.atan2(t.x, t.z);
        for (const side of [-1, 1]) {
          const bx = p.x + n.x * (TRACK_WIDTH / 2 + BW * 1.5) * side;
          const bz = p.z + n.z * (TRACK_WIDTH / 2 + BW * 1.5) * side;
          const m = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.1, BH, BW), mat);
          m.position.set(bx, BH / 2, bz);
          m.rotation.y = angle;
          m.castShadow = m.receiveShadow = true;
          scene.add(m);
          barriers.push({ pos: [bx, BH / 2, bz], size: [segLen + 0.1, BH, BW], rot: angle });
        }
      }
    })();

    // Trees
    (() => {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 1 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1 });
      const treePos: [number, number][] = [
        [140, 60], [140, 80], [-100, 70], [-100, 40], [60, 145], [30, 145],
        [-40, 140], [120, 10], [120, -10], [-85, 20], [-85, 100],
        [0, -20], [50, -20], [-20, -20], [70, -25],
      ];
      for (const [x, z] of treePos) {
        const h = 4 + Math.random() * 3;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, h, 7), trunkMat);
        trunk.position.set(x, h / 2, z);
        trunk.castShadow = true;
        scene.add(trunk);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random(), 7, 5), leafMat);
        crown.position.set(x, h + 1.2, z);
        crown.castShadow = true;
        scene.add(crown);
      }
    })();

    // Grandstand on main straight
    (() => {
      const standMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.8 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.7 });
      for (let row = 0; row < 4; row++) {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 4), standMat);
        stand.position.set(20, 0.25 + row * 1.2, -26 - row * 3.5);
        stand.castShadow = stand.receiveShadow = true;
        scene.add(stand);
        for (let s = -9; s <= 9; s++) {
          const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), seatMat);
          seat.position.set(20 + s * 2, 0.75 + row * 1.2, -24.5 - row * 3.5);
          scene.add(seat);
        }
      }
      // Roof supports
      for (const x of [-20, 60]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 8), standMat);
        col.position.set(x, 4, -38);
        col.castShadow = true;
        scene.add(col);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(82, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.7 }));
      roof.position.set(20, 8.2, -34);
      roof.castShadow = true;
      scene.add(roof);
    })();

    // Start/Finish gantry
    (() => {
      const startPt = trackSpline.getPoint(0);
      const startTan = trackSpline.getTangent(0);
      const angle = Math.atan2(startTan.x, startTan.z);
      const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
      const wMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 8), mat);
        col.position.set(startPt.x + normals[0].x * 10 * side, 3.5, startPt.z + normals[0].z * 10 * side);
        col.rotation.y = angle;
        col.castShadow = true;
        scene.add(col);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(21, 0.5, 0.5), wMat);
      beam.position.set(startPt.x, 7, startPt.z);
      beam.rotation.y = angle;
      scene.add(beam);

      // Checkered start/finish line
      for (let c = 0; c < 8; c++) {
        const sq = new THREE.Mesh(new THREE.BoxGeometry(2, 0.01, 1.5), new THREE.MeshStandardMaterial({ color: c % 2 === 0 ? 0x000000 : 0xffffff }));
        sq.position.set(startPt.x + normals[0].x * (c * 2 - 7), ROAD_Y + 0.02, startPt.z + normals[0].z * (c * 2 - 7));
        sq.rotation.y = angle;
        scene.add(sq);
      }
    })();

    // Barrier physics
    for (const b of barriers) {
      const body = new CANNON.Body({ mass: 0, material: groundMat });
      body.addShape(new CANNON.Box(new CANNON.Vec3(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2)));
      body.position.set(...b.pos);
      body.quaternion.setFromEuler(0, b.rot, 0);
      world.addBody(body);
    }

    // ─── CAR MESH ────────────────────────────────────────────────────────────
    const carGroup = new THREE.Group();
    (() => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.52, 4.2), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.25, metalness: 0.7 }));
      body.position.y = 0.26; body.castShadow = true; carGroup.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.48, 2.0), new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75 }));
      cabin.position.set(0, 0.76, 0.3); cabin.castShadow = true; carGroup.add(cabin);

      const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
      splitter.position.set(0, 0.06, 2.1); carGroup.add(splitter);

      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.07, 0.55), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      wing.position.set(0, 0.88, -1.85); carGroup.add(wing);

      for (const x of [-0.8, 0.8]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        s.position.set(x, 0.72, -1.85); carGroup.add(s);
      }

      // Headlights
      const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 2 });
      for (const x of [-0.65, 0.65]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.05), hlMat);
        hl.position.set(x, 0.32, 2.13); carGroup.add(hl);
      }

      // Taillights
      const tlMat = new THREE.MeshStandardMaterial({ color: 0xff1100, emissive: 0xff0000, emissiveIntensity: 1.5 });
      for (const x of [-0.65, 0.65]) {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.05), tlMat);
        tl.position.set(x, 0.32, -2.13); carGroup.add(tl);
      }

      // Sidepods
      for (const x of [-1.05, 1.05]) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 2.5), new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.3, metalness: 0.5 }));
        sp.position.set(x, 0.18, 0.2); carGroup.add(sp);
      }
    })();
    scene.add(carGroup);

    // Wheel meshes
    const wheelMeshes = [0, 1, 2, 3].map(() => {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }));
      tire.rotation.z = Math.PI / 2; g.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.28, 16), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.95 }));
      rim.rotation.z = Math.PI / 2; g.add(rim);
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9 }));
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (s / 5) * Math.PI * 2;
        spoke.position.y = Math.sin((s / 5) * Math.PI * 2) * 0.16;
        spoke.position.z = Math.cos((s / 5) * Math.PI * 2) * 0.16;
        g.add(spoke);
      }
      scene.add(g); return g;
    });

    // ─── CAR PHYSICS ─────────────────────────────────────────────────────────
    const chassis = new CANNON.Body({ mass: 1200 });
    chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.95, 0.32, 2.05)));
    chassis.angularDamping = 0.35;
    chassis.linearDamping = 0.12;
    world.addBody(chassis);

    const vehicle = new CANNON.RaycastVehicle({ chassisBody: chassis, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2 });

    const baseOpts = {
      radius: 0.42,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 40,
      suspensionRestLength: 0.44,
      frictionSlip: 2.4,
      dampingRelaxation: 2.5,
      dampingCompression: 4.0,
      maxSuspensionForce: 120000,
      rollInfluence: 0.02,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const WX = 1.0, WZF = 1.5, WZR = -1.5, WY = -0.22;
    const wheelPositions: [number, number, number][] = [[WX, WY, WZF], [-WX, WY, WZF], [WX, WY, WZR], [-WX, WY, WZR]];
    for (let i = 0; i < 4; i++) {
      const opts = { ...baseOpts, chassisConnectionPointLocal: new CANNON.Vec3(...wheelPositions[i]) };
      if (i >= 2) opts.frictionSlip = 2.6;
      vehicle.addWheel(opts);
    }
    vehicle.addToWorld(world);

    const wheelBodies = vehicle.wheelInfos.map((wi) => {
      const b = new CANNON.Body({ mass: 0, material: wheelMat });
      const cyl = new CANNON.Cylinder(wi.radius, wi.radius, wi.radius * 0.45, 16);
      b.addShape(cyl, new CANNON.Vec3(), new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2));
      b.type = CANNON.Body.KINEMATIC;
      b.collisionFilterMask = 0;
      world.addBody(b);
      return b;
    });

    // ─── CHECKPOINTS ─────────────────────────────────────────────────────────
    const NUM_CP = 10;
    const checkpoints = Array.from({ length: NUM_CP }, (_, i) => {
      const t = i / NUM_CP;
      const pt = trackSpline.getPoint(t);
      const tan = trackSpline.getTangent(t);
      return {
        pos: new THREE.Vector3(pt.x, 0, pt.z),
        normal: new THREE.Vector3(-tan.z, 0, tan.x).normalize(),
        width: TRACK_WIDTH * 0.85,
        passed: false,
      };
    });

    // ─── MINI MAP ─────────────────────────────────────────────────────────────
    const mmCanvas = document.createElement("canvas");
    mmCanvas.width = mmCanvas.height = 130;
    let mmMinX = Infinity, mmMinZ = Infinity, mmMaxX = -Infinity, mmMaxZ = -Infinity;
    splinePts.forEach(p => { mmMinX = Math.min(mmMinX, p.x); mmMaxX = Math.max(mmMaxX, p.x); mmMinZ = Math.min(mmMinZ, p.z); mmMaxZ = Math.max(mmMaxZ, p.z); });
    const mmScale = 106 / Math.max(mmMaxX - mmMinX, mmMaxZ - mmMinZ);

    function toMM(x: number, z: number): [number, number] {
      return [(x - mmMinX) * mmScale + 12, (z - mmMinZ) * mmScale + 12];
    }

    const mmEl = document.getElementById("apex-minimap") as HTMLCanvasElement | null;
    if (mmEl) { mmEl.width = 130; mmEl.height = 130; }

    function drawMinimap(carX: number, carZ: number) {
      const ctx = (mmEl ?? mmCanvas).getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 130, 130);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, 130, 130);
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      splinePts.forEach((p, i) => {
        const [mx, mz] = toMM(p.x, p.z);
        i === 0 ? ctx.moveTo(mx, mz) : ctx.lineTo(mx, mz);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 5;
      ctx.stroke();
      // Road center lighter
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.beginPath();
      splinePts.forEach((p, i) => {
        const [mx, mz] = toMM(p.x, p.z);
        i === 0 ? ctx.moveTo(mx, mz) : ctx.lineTo(mx, mz);
      });
      ctx.closePath();
      ctx.stroke();
      // Car
      const [cx, cz] = toMM(carX, carZ);
      ctx.fillStyle = "#ffe033";
      ctx.shadowColor = "#ffe033"; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(cx, cz, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ─── GAME STATE ───────────────────────────────────────────────────────────
    let lapStart = 0, lapCount = 0, bestLapVal = Infinity, lapRunning = false, cpIndex = 0;
    let currentGear = 1, steering = 0, accumulator = 0;

    // Audio
    let audioCtx: AudioContext | null = null;
    let engineOsc: OscillatorNode | null = null;
    let engineGain: GainNode | null = null;

    function initAudio() {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        engineOsc = audioCtx.createOscillator();
        engineOsc.type = "sawtooth";
        engineOsc.frequency.value = 60;
        const dist = audioCtx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = (i * 2 / 255) - 1; curve[i] = (Math.PI + 300) * x / (Math.PI + 300 * Math.abs(x)); }
        dist.curve = curve; dist.oversample = "4x";
        engineGain = audioCtx.createGain();
        engineGain.gain.value = 0;
        const filt = audioCtx.createBiquadFilter();
        filt.type = "lowpass"; filt.frequency.value = 900;
        engineOsc.connect(dist); dist.connect(filt); filt.connect(engineGain); engineGain.connect(audioCtx.destination);
        engineOsc.start();
      } catch { /* no audio */ }
    }

    function resetCar() {
      const pt = trackSpline.getPoint(0);
      const tan = trackSpline.getTangent(0);
      chassis.position.set(pt.x, 1.5, pt.z);
      chassis.velocity.set(0, 0, 0);
      chassis.angularVelocity.set(0, 0, 0);
      chassis.quaternion.setFromEuler(0, Math.atan2(tan.x, tan.z), 0);
      chassis.wakeUp();
      currentGear = 1; steering = 0;
    }

    resetCar();

    // ─── CAMERA SETUP ────────────────────────────────────────────────────────
    const CAM_OFFSET = new THREE.Vector3(0, 3.8, -9.5);
    const CAM_LOOK = new THREE.Vector3(0, 0.8, 4);
    let camPos = new THREE.Vector3(0, 8, -14);
    let camFOV = 62;

    // ─── KEY CONTROLS ────────────────────────────────────────────────────────
    const inp = input.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") { inp.w = true; e.preventDefault(); }
      if (e.code === "KeyS" || e.code === "ArrowDown") { inp.s = true; e.preventDefault(); }
      if (e.code === "KeyA" || e.code === "ArrowLeft") { inp.a = true; e.preventDefault(); }
      if (e.code === "KeyD" || e.code === "ArrowRight") { inp.d = true; e.preventDefault(); }
      if (e.code === "Space") { inp.space = true; e.preventDefault(); }
      if (e.code === "KeyR") { resetCar(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") inp.w = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") inp.s = false;
      if (e.code === "KeyA" || e.code === "ArrowLeft") inp.a = false;
      if (e.code === "KeyD" || e.code === "ArrowRight") inp.d = false;
      if (e.code === "Space") inp.space = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ─── GAME LOOP ───────────────────────────────────────────────────────────
    let animId = 0, lastTS = performance.now();
    let lastSpeedUpdate = 0;

    function loop(ts: number) {
      animId = requestAnimationFrame(loop);
      const dt = Math.min((ts - lastTS) / 1000, 0.05);
      lastTS = ts;

      const isRacing = phaseRef.current === "racing";

      // Physics step
      accumulator += dt;
      while (accumulator >= FIXED_STEP) {
        world.step(FIXED_STEP, FIXED_STEP, 3);
        accumulator -= FIXED_STEP;
      }

      // Vehicle update
      const vel = chassis.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      const speedKMH = speed * 3.6;

      if (isRacing) {
        const throttle = inp.w;
        const braking = inp.s;
        const steerL = inp.a;
        const steerR = inp.d;
        const handbrake = inp.space;

        // Gear logic
        if (speedKMH > GEAR_THRESHOLDS[Math.min(currentGear, MAX_GEAR)] && currentGear < MAX_GEAR) currentGear++;
        if (speedKMH < GEAR_THRESHOLDS[Math.max(currentGear - 1, 1)] * 0.8 && currentGear > 1) currentGear--;

        const rpm = Math.min(800 + (speedKMH / 3) * GEAR_RATIOS[currentGear] * 100, 8500);
        const gearEff = (1.0 / GEAR_RATIOS[currentGear]) * 1.55;
        const engineForce = throttle ? 2600 * gearEff : 0;
        const brakeF = braking ? 95 : 0;

        vehicle.applyEngineForce(throttle ? -engineForce : 0, 2);
        vehicle.applyEngineForce(throttle ? -engineForce : 0, 3);
        vehicle.applyEngineForce(0, 0);
        vehicle.applyEngineForce(0, 1);
        vehicle.setBrake(brakeF, 0);
        vehicle.setBrake(brakeF, 1);
        vehicle.setBrake(handbrake ? 200 : brakeF, 2);
        vehicle.setBrake(handbrake ? 200 : brakeF, 3);

        const steerFactor = Math.max(0.18, 1 - speedKMH / 180);
        const targetSteer = (steerL ? 1 : 0) - (steerR ? 1 : 0);
        steering += (targetSteer * 0.52 * steerFactor - steering) * 10 * dt;
        vehicle.setSteeringValue(steering, 0);
        vehicle.setSteeringValue(steering, 1);

        // Aero
        const drag = 0.0007;
        chassis.applyForce(new CANNON.Vec3(-vel.x * speed * drag, 0, -vel.z * speed * drag), chassis.position);
        chassis.applyForce(new CANNON.Vec3(0, -speed * speed * 0.35, 0), chassis.position);

        // Audio
        if (audioCtx && engineOsc && engineGain) {
          const freq = 50 + rpm / 75;
          engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.04);
          engineGain.gain.setTargetAtTime(throttle ? 0.055 : 0.022, audioCtx.currentTime, 0.08);
        }

        // Checkpoint detection
        const cp = checkpoints[cpIndex];
        const dx = chassis.position.x - cp.pos.x;
        const dz = chassis.position.z - cp.pos.z;
        const dot = dx * cp.normal.x + dz * cp.normal.z;
        const perp = Math.abs(-dx * cp.normal.z + dz * cp.normal.x);
        if (Math.abs(dot) < 3.5 && perp < cp.width / 2) {
          if (cpIndex === 0 && lapRunning) {
            const t = (performance.now() - lapStart) / 1000;
            lapCount++;
            if (t < bestLapVal) {
              bestLapVal = t;
              setNewBest(true);
              setTimeout(() => setNewBest(false), 2200);
            }
            lapStart = performance.now();
            checkpoints.forEach(c => { c.passed = false; });
            cpIndex = 0;
          } else if (cpIndex === 0 && !lapRunning) {
            lapRunning = true; lapStart = performance.now();
            checkpoints.forEach(c => { c.passed = false; });
            cpIndex = 0;
          } else {
            checkpoints[cpIndex].passed = true;
            cpIndex = (cpIndex + 1) % NUM_CP;
          }
        }

        // Update HUD (throttled to ~20fps to avoid React overhead)
        if (ts - lastSpeedUpdate > 50) {
          lastSpeedUpdate = ts;
          setSpeed(Math.round(speedKMH));
          setGear(throttle ? String(currentGear) : speedKMH < 2 ? "N" : String(currentGear));
          setThrottlePct(throttle ? Math.min(100, (engineForce / (2600 * 2)) * 100) : 0);
          setBrakePct(braking ? 100 : 0);
          if (lapRunning) setLapTime(fmtTime((performance.now() - lapStart) / 1000));
          if (bestLapVal < Infinity) setBestLap(fmtTime(bestLapVal));
          setLapCount(lapCount + 1);
        }
      }

      // Sync wheel meshes
      for (let i = 0; i < 4; i++) {
        vehicle.updateWheelTransform(i);
        const wt = vehicle.wheelInfos[i].worldTransform;
        wheelMeshes[i].position.copy(wt.position as unknown as THREE.Vector3);
        wheelMeshes[i].quaternion.copy(wt.quaternion as unknown as THREE.Quaternion);
        wheelBodies[i].position.copy(wt.position);
        wheelBodies[i].quaternion.copy(wt.quaternion);
      }

      // Sync car mesh
      carGroup.position.copy(chassis.position as unknown as THREE.Vector3);
      carGroup.quaternion.copy(chassis.quaternion as unknown as THREE.Quaternion);
      carGroup.position.y -= 0.2;

      // Camera follow
      const carPos = carGroup.position.clone();
      const carQuat = carGroup.quaternion.clone();
      const offset = CAM_OFFSET.clone().applyQuaternion(carQuat);
      const targetCamPos = carPos.clone().add(offset);
      const lerpSpeed = isRacing ? Math.min(4.5 * dt, 0.12) : 0.04;
      camPos.lerp(targetCamPos, lerpSpeed);

      // Speed-based shake
      if (isRacing && speedKMH > 60) {
        const shake = ((speedKMH - 60) / 140) * 0.018;
        camPos.x += (Math.random() - 0.5) * shake;
        camPos.y += (Math.random() - 0.5) * shake * 0.5;
      }
      camera.position.copy(camPos);

      const lookAt = carPos.clone().add(CAM_LOOK.clone().applyQuaternion(carQuat));
      camera.lookAt(lookAt);

      // Dynamic FOV
      const targetFOV = isRacing ? 60 + speedKMH * 0.07 : 62;
      camFOV += (targetFOV - camFOV) * 2.5 * dt;
      camera.fov = camFOV;
      camera.updateProjectionMatrix();

      // Sun follows slowly
      sun.position.x = camera.position.x + 60;
      sun.position.z = camera.position.z + 40;

      drawMinimap(chassis.position.x, chassis.position.z);
      renderer.render(scene, camera);
    }

    animId = requestAnimationFrame(loop);

    // Expose start function for the button click
    (window as any).__apexStartGame = () => {
      initAudio();
      resetCar();
    };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      try { renderer.dispose(); } catch { /* ignore */ }
      delete (window as any).__apexStartGame;
    };
  }, []);

  const handleStart = useCallback(async () => {
    (window as any).__apexStartGame?.();
    await startCountdown();
  }, [startCountdown]);

  const inp = input.current;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", fontFamily: "'Courier New', monospace", touchAction: "none" }}>

      {/* 3D Canvas */}
      <canvas ref={canvasRef} style={{ display: "block", width: "100vw", height: "100vh" }} />

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      {phase === "racing" && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column" }}>
          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", alignItems: "flex-start" }}>
            {/* Speed */}
            <div style={hudPanelStyle}>
              <div style={hudLabelStyle}>Speed</div>
              <div style={{ fontSize: 44, lineHeight: 1, color: "#ffe033", fontWeight: "bold" }}>{speed}</div>
              <div style={{ fontSize: 10, color: "rgba(255,200,0,0.5)", letterSpacing: "0.12em" }}>KM/H</div>
            </div>
            {/* Gear */}
            <div style={{ ...hudPanelStyle, textAlign: "center", minWidth: 64 }}>
              <div style={hudLabelStyle}>Gear</div>
              <div style={{ fontSize: 40, color: "#ff4040", fontWeight: "bold" }}>{gear}</div>
            </div>
            {/* Lap info */}
            <div style={{ ...hudPanelStyle, textAlign: "right" }}>
              <div style={hudLabelStyle}>Lap Time</div>
              <div style={{ fontSize: 22, color: "#ffe033", fontWeight: "bold" }}>{lapTime}</div>
              <div style={{ ...hudLabelStyle, marginTop: 6 }}>Best Lap</div>
              <div style={{ fontSize: 14, color: "#fff" }}>{bestLap}</div>
              <div style={{ ...hudLabelStyle, marginTop: 6 }}>Lap</div>
              <div style={{ fontSize: 14, color: "#fff" }}>{lapCount} / ∞</div>
            </div>
          </div>

          {/* Bottom bars */}
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "center", paddingBottom: 100 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              {[{ pct: throttlePct, label: "THR", color: "#ffe033" }, { pct: brakePct, label: "BRK", color: "#ff4040" }].map(({ pct, label, color }) => (
                <div key={label}>
                  <div style={{ width: 8, height: 64, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
                    <div style={{ width: "100%", height: `${pct}%`, background: color, transition: "height 0.05s", borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NEW BEST FLASH ───────────────────────────────────────────────── */}
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#00ff88", fontSize: 18, letterSpacing: "0.15em", textShadow: "0 0 24px #00ff88", opacity: newBest ? 1 : 0, transition: "opacity 0.3s", pointerEvents: "none", whiteSpace: "nowrap" }}>
        ✦ NEW BEST LAP ✦
      </div>

      {/* ── COUNTDOWN ───────────────────────────────────────────────────── */}
      {phase === "countdown" && countdownNum && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontSize: "clamp(90px,22vw,200px)", color: countdownNum === "GO!" ? "#00ff88" : "#ffe033", fontWeight: "bold", letterSpacing: "0.04em", textShadow: `0 0 80px ${countdownNum === "GO!" ? "#00ff88" : "#ffe033"}`, animation: "countPop 0.2s ease-out" }}>
          {countdownNum}
        </div>
      )}

      {/* ── START OVERLAY ────────────────────────────────────────────────── */}
      {phase === "start" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}>
          <div style={{ fontSize: "clamp(32px,7vw,72px)", color: "#ffe033", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: "bold", textShadow: "0 0 40px rgba(255,200,0,0.6), 0 0 80px rgba(255,200,0,0.2)", marginBottom: 6 }}>
            Apex Drive
          </div>
          <div style={{ color: "rgba(255,200,0,0.45)", fontSize: 11, letterSpacing: "0.35em", marginBottom: 28 }}>REAL CIRCUIT</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 28 }}>
            Semi-realistic circuit racing · Browser physics
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "5px 24px", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 36 }}>
            {[["W / ↑", "Throttle"], ["S / ↓", "Brake"], ["A / D", "Steer"], ["Space", "Handbrake"], ["R", "Reset car"]].map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: "#ffe033" }}>{k}</span>
                <span>{v}</span>
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={handleStart}
            style={{ padding: "16px 56px", background: "transparent", border: "2px solid #ffe033", color: "#ffe033", fontSize: 14, fontFamily: "inherit", letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.18s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#ffe033"; (e.currentTarget as HTMLButtonElement).style.color = "#000"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#ffe033"; }}
          >
            START ENGINE
          </button>
        </div>
      )}

      {/* ── MINIMAP ─────────────────────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 16, right: 16, width: 130, height: 130, borderRadius: 6, border: "1px solid rgba(255,200,0,0.3)", overflow: "hidden", background: "rgba(0,0,0,0.6)" }}>
        <canvas id="apex-minimap" width={130} height={130} style={{ width: 130, height: 130 }} />
      </div>

      {/* ── MOBILE CONTROLS ──────────────────────────────────────────────── */}
      {phase === "racing" && (
        <div style={{ position: "fixed", bottom: 20, left: 0, width: "100%", display: "flex", justifyContent: "space-between", padding: "0 20px", pointerEvents: "none", zIndex: 50, boxSizing: "border-box" }}>
          {/* Steering */}
          <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
            <MobBtn label="◀" onPress={() => { inp.a = true; }} onRelease={() => { inp.a = false; }} />
            <MobBtn label="▶" onPress={() => { inp.d = true; }} onRelease={() => { inp.d = false; }} />
          </div>
          {/* Throttle / Brake */}
          <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
            <MobBtn label="■" onPress={() => { inp.s = true; }} onRelease={() => { inp.s = false; }} color="#ff4040"
              style={{ border: "2px solid rgba(255,60,60,0.5)", background: "rgba(120,0,0,0.3)" }} />
            <MobBtn label="▲" onPress={() => { inp.w = true; }} onRelease={() => { inp.w = false; }} color="#00e676"
              style={{ border: "2px solid rgba(0,230,118,0.5)", background: "rgba(0,100,40,0.3)" }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes countPop {
          from { transform: scale(1.3); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const hudPanelStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,200,0,0.28)",
  backdropFilter: "blur(8px)",
  padding: "10px 16px",
  borderRadius: 5,
  letterSpacing: "0.06em",
};

const hudLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "rgba(255,200,0,0.55)",
  textTransform: "uppercase",
  marginBottom: 3,
  letterSpacing: "0.1em",
};
