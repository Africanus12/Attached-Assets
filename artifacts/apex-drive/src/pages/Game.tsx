import { useEffect, useRef } from "react";

export default function Game() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const existingScript = document.getElementById("apex-drive-script");
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = "apex-drive-script";
    script.type = "module";
    script.textContent = getGameScript();
    document.body.appendChild(script);

    return () => {
      // cleanup handled by page reload / navigation
    };
  }, []);

  return (
    <>
      <canvas id="c" style={{ display: "block", width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }} />

      <div id="hud" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", display: "flex", flexDirection: "column", fontFamily: "'Courier New', monospace" }}>
        <div id="top-hud" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 24px" }}>
          <div className="hud-panel" id="speedometer" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,200,0,0.3)", backdropFilter: "blur(6px)", padding: "10px 16px", borderRadius: "4px", letterSpacing: "0.08em", minWidth: "90px" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,200,0,0.6)", textTransform: "uppercase", marginBottom: "3px" }}>Speed</div>
            <div id="speed-num" style={{ fontSize: "42px", lineHeight: "1", color: "#ffe033" }}>0</div>
            <div style={{ fontSize: "11px", color: "rgba(255,200,0,0.5)", letterSpacing: "0.15em" }}>KM/H</div>
          </div>
          <div className="hud-panel" id="gear-panel" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,200,0,0.3)", backdropFilter: "blur(6px)", padding: "10px 16px", borderRadius: "4px", letterSpacing: "0.08em", textAlign: "center", minWidth: "60px" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,200,0,0.6)", textTransform: "uppercase", marginBottom: "3px" }}>Gear</div>
            <div id="gear-val" style={{ fontSize: "38px", color: "#ff4444" }}>N</div>
          </div>
          <div className="hud-panel" id="lap-panel" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,200,0,0.3)", backdropFilter: "blur(6px)", padding: "10px 16px", borderRadius: "4px", letterSpacing: "0.08em", textAlign: "right" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,200,0,0.6)", textTransform: "uppercase", marginBottom: "3px" }}>Lap Time</div>
            <div style={{ fontSize: "22px", color: "#ffe033", fontWeight: "bold" }} id="lap-time">0:00.000</div>
            <div style={{ fontSize: "9px", color: "rgba(255,200,0,0.6)", textTransform: "uppercase", marginTop: "8px", marginBottom: "3px" }}>Best Lap</div>
            <div style={{ fontSize: "14px", color: "#fff" }} id="best-lap">--:--.---</div>
            <div style={{ fontSize: "9px", color: "rgba(255,200,0,0.6)", textTransform: "uppercase", marginTop: "8px", marginBottom: "3px" }}>Lap</div>
            <div style={{ fontSize: "14px", color: "#fff" }} id="lap-count">1 / ∞</div>
          </div>
        </div>
        <div id="bottom-hud" style={{ marginTop: "auto", display: "flex", justifyContent: "center", paddingBottom: "12px" }}>
          <div id="throttle-bar-wrap" style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div>
              <div style={{ width: "8px", height: "60px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
                <div id="throttle-fill" style={{ width: "100%", background: "#ffe033", borderRadius: "4px", height: "0%", transition: "height 0.05s" }}></div>
              </div>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: "3px" }}>THR</div>
            </div>
            <div>
              <div style={{ width: "8px", height: "60px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
                <div id="brake-fill" style={{ width: "100%", background: "#ff4444", borderRadius: "4px", height: "0%", transition: "height 0.05s" }}></div>
              </div>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: "3px" }}>BRK</div>
            </div>
          </div>
        </div>
      </div>

      <div id="best-flash" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#00ff88", fontSize: "18px", letterSpacing: "0.15em", textShadow: "0 0 20px #00ff88", opacity: "0", transition: "opacity 0.3s", pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "'Courier New', monospace" }}>
        ✦ NEW BEST LAP ✦
      </div>

      <div id="countdown" style={{ position: "fixed", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99, pointerEvents: "none", fontSize: "clamp(80px,20vw,180px)", color: "#ffe033", fontWeight: "bold", letterSpacing: "0.05em", textShadow: "0 0 60px rgba(255,200,0,0.6)", opacity: "0", transition: "opacity 0.2s", fontFamily: "'Courier New', monospace" }} />

      <div id="overlay" style={{ position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, transition: "opacity 0.6s", fontFamily: "'Courier New', monospace" }}>
        <h1 style={{ fontSize: "clamp(28px,6vw,64px)", color: "#ffe033", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "8px", textShadow: "0 0 30px rgba(255,200,0,0.5)" }}>Apex Drive</h1>
        <p style={{ color: "rgba(255,200,0,0.4)", fontSize: "11px", letterSpacing: "0.3em" }}>REAL CIRCUIT</p>
        <p style={{ marginTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>Semi-realistic circuit racing · Browser physics</p>
        <div style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "auto auto", gap: "6px 20px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
          <span style={{ color: "#ffe033" }}>W / ↑</span><span>Throttle</span>
          <span style={{ color: "#ffe033" }}>S / ↓</span><span>Brake</span>
          <span style={{ color: "#ffe033" }}>A / D</span><span>Steer</span>
          <span style={{ color: "#ffe033" }}>Space</span><span>Handbrake</span>
          <span style={{ color: "#ffe033" }}>R</span><span>Reset car</span>
        </div>
        <button
          id="start-btn"
          style={{ marginTop: "32px", padding: "14px 48px", background: "transparent", border: "2px solid #ffe033", color: "#ffe033", fontSize: "14px", fontFamily: "inherit", letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#ffe033"; (e.target as HTMLButtonElement).style.color = "#000"; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "#ffe033"; }}
        >
          START ENGINE
        </button>
      </div>

      <div id="mini-map" style={{ position: "fixed", bottom: "16px", right: "16px", width: "120px", height: "120px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,200,0,0.25)", borderRadius: "4px", overflow: "hidden" }}>
        <canvas id="mm-canvas" width="120" height="120" style={{ width: "120px", height: "120px" }} />
      </div>

      <div id="mobile-controls" style={{ position: "fixed", bottom: "0", left: "0", width: "100%", height: "160px", display: "none", pointerEvents: "all", padding: "12px", boxSizing: "border-box" }}>
        <div id="mob-left" style={{ position: "absolute", width: "70px", height: "70px", borderRadius: "50%", border: "2px solid rgba(255,200,0,0.5)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: "rgba(255,200,0,0.8)", userSelect: "none", backdropFilter: "blur(4px)", bottom: "50px", left: "20px" }}>◀</div>
        <div id="mob-right" style={{ position: "absolute", width: "70px", height: "70px", borderRadius: "50%", border: "2px solid rgba(255,200,0,0.5)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: "rgba(255,200,0,0.8)", userSelect: "none", backdropFilter: "blur(4px)", bottom: "50px", left: "110px" }}>▶</div>
        <div id="mob-accel" style={{ position: "absolute", width: "70px", height: "70px", borderRadius: "50%", border: "2px solid rgba(0,255,100,0.5)", background: "rgba(0,180,80,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: "rgba(0,255,100,0.9)", userSelect: "none", backdropFilter: "blur(4px)", bottom: "50px", right: "20px" }}>▲</div>
        <div id="mob-brake" style={{ position: "absolute", width: "70px", height: "70px", borderRadius: "50%", border: "2px solid rgba(255,60,60,0.5)", background: "rgba(180,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: "rgba(255,100,100,0.9)", userSelect: "none", backdropFilter: "blur(4px)", bottom: "50px", right: "110px" }}>■</div>
      </div>
    </>
  );
}

function getGameScript(): string {
  return `
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// Check WebGL support before initializing
function checkWebGL() {
  try {
    const testCanvas = document.createElement('canvas');
    const ctx = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!ctx) return false;
    return true;
  } catch(e) { return false; }
}

if (!checkWebGL()) {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.innerHTML = '<h1 style="color:#ffe033;font-size:clamp(24px,5vw,48px);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px">Apex Drive</h1><p style="color:rgba(255,255,255,0.6);font-size:14px;text-align:center;max-width:400px;line-height:1.6">WebGL is not available in this environment.<br/><br/>Open the app in a full browser window to play the game.<br/>Click the <strong style="color:#ffe033">Open in new tab</strong> button above.</p>';
  }
  throw new Error('WebGL not available');
}


const FIXED_STEP = 1/60;
const MAX_SUB    = 3;

const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1f2e);
scene.fog = new THREE.FogExp2(0x1a1f2e, 0.008);

const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 1200);
camera.position.set(0, 8, -16);

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

const ambient = new THREE.AmbientLight(0x334466, 1.2);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
sun.position.set(80, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near  = 1;
sun.shadow.camera.far   = 400;
sun.shadow.camera.left  = -200;
sun.shadow.camera.right =  200;
sun.shadow.camera.top   =  200;
sun.shadow.camera.bottom= -200;
sun.shadow.bias = -0.001;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x2244aa, 0.5);
fillLight.position.set(-40, 20, -80);
scene.add(fillLight);

(()=>{
  const geo = new THREE.BufferGeometry();
  const N = 1500;
  const pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r = 500+Math.random()*200;
    const t = Math.random()*Math.PI*2;
    const p = Math.random()*Math.PI;
    pos[i*3]   = r*Math.sin(p)*Math.cos(t);
    pos[i*3+1] = r*Math.cos(p)*0.4+50;
    pos[i*3+2] = r*Math.sin(p)*Math.sin(t);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({color:0xffffff,size:0.8,sizeAttenuation:true})));
})();

const world = new CANNON.World({gravity: new CANNON.Vec3(0,-20,0)});
world.broadphase     = new CANNON.SAPBroadphase(world);
world.allowSleep     = true;
world.defaultContactMaterial.friction    = 0.3;
world.defaultContactMaterial.restitution = 0.1;

const groundMaterial = new CANNON.Material('ground');
const wheelMaterial  = new CANNON.Material('wheel');
const contact = new CANNON.ContactMaterial(groundMaterial, wheelMaterial, {
  friction:    1.6,
  restitution: 0.01,
});
world.addContactMaterial(contact);

const TRACK_WIDTH = 16;
const ROAD_Y      = 0.05;

const rawPoints = [
  [  0,   0],
  [ 40,   0],
  [ 80,  10],
  [110,  35],
  [115,  70],
  [100, 100],
  [ 75, 115],
  [ 40, 120],
  [  0, 120],
  [-35, 115],
  [-60, 105],
  [-80,  80],
  [-75,  50],
  [-55,  30],
  [-30,  15],
  [  0,   0],
];

function buildSpline(pts) {
  const v3s = pts.map(p => new THREE.Vector3(p[0], 0, p[1]));
  return new THREE.CatmullRomCurve3(v3s, true, 'catmullrom', 0.5);
}
const trackSpline = buildSpline(rawPoints);
const SPLINE_DIVS = 200;
const splinePoints = trackSpline.getPoints(SPLINE_DIVS);

function buildTrack() {
  const group = new THREE.Group();
  const points2D = trackSpline.getPoints(SPLINE_DIVS);
  const tangents  = [];
  for(let i=0;i<points2D.length;i++){
    const next = points2D[(i+1)%points2D.length];
    const prev = points2D[(i-1+points2D.length)%points2D.length];
    const dir = new THREE.Vector3().subVectors(next, prev).normalize();
    tangents.push(dir);
  }
  const leftEdge  = [];
  const rightEdge = [];
  for(let i=0;i<points2D.length;i++){
    const t = tangents[i];
    const n = new THREE.Vector3(-t.z, 0, t.x);
    leftEdge.push( new THREE.Vector2(points2D[i].x - n.x*TRACK_WIDTH/2, points2D[i].z - n.z*TRACK_WIDTH/2));
    rightEdge.push(new THREE.Vector2(points2D[i].x + n.x*TRACK_WIDTH/2, points2D[i].z + n.z*TRACK_WIDTH/2));
  }

  const roadGeo = new THREE.BufferGeometry();
  const verts   = [];
  const uvs     = [];
  const indices = [];
  const total = points2D.length;
  for(let i=0;i<total;i++){
    const li = leftEdge[i];
    const ri = rightEdge[i];
    verts.push(li.x, ROAD_Y, li.y);
    verts.push(ri.x, ROAD_Y, ri.y);
    uvs.push(i/total*8, 0);
    uvs.push(i/total*8, 1);
  }
  for(let i=0;i<total-1;i++){
    const a=i*2, b=i*2+1, c=i*2+2, d=i*2+3;
    indices.push(a,b,c, b,d,c);
  }
  const a=(total-1)*2, b=a+1;
  indices.push(a,b,0, b,1,0);

  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roadGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,   2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    color:     0x1c1c1e,
    roughness: 0.92,
    metalness: 0.02,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const markGeo = new THREE.BufferGeometry();
  const markVerts = [];
  const markUVs   = [];
  const markIdx   = [];
  const MW = 0.25;
  for(let i=0;i<total;i++){
    const t = tangents[i];
    const n = new THREE.Vector3(-t.z, 0, t.x);
    const cx = points2D[i].x, cz = points2D[i].z;
    markVerts.push(cx - n.x*MW, ROAD_Y+0.005, cz - n.z*MW);
    markVerts.push(cx + n.x*MW, ROAD_Y+0.005, cz + n.z*MW);
    markUVs.push(i/total*30, 0, i/total*30, 1);
  }
  for(let i=0;i<total-1;i++){
    const a=i*2,b=a+1,c=a+2,d=a+3;
    markIdx.push(a,b,c,b,d,c);
  }
  markGeo.setAttribute('position', new THREE.Float32BufferAttribute(markVerts,3));
  markGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(markUVs,  2));
  markGeo.setIndex(markIdx);
  markGeo.computeVertexNormals();
  const markMat = new THREE.MeshStandardMaterial({color:0xffd700,roughness:0.7,metalness:0});
  const markMesh = new THREE.Mesh(markGeo, markMat);
  group.add(markMesh);

  const grassGeo = new THREE.PlaneGeometry(400, 400);
  const grassMat = new THREE.MeshStandardMaterial({color:0x2d5a1b, roughness:1, metalness:0});
  const grass    = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI/2;
  grass.receiveShadow = true;
  group.add(grass);

  const barMat = new THREE.MeshStandardMaterial({color:0xcccccc, roughness:0.7, metalness:0.1});
  const redMat = new THREE.MeshStandardMaterial({color:0xcc2222, roughness:0.7, metalness:0.1});
  const BH = 0.8, BW = 0.4;
  const barriers = [];
  for(let i=0;i<total-1;i++){
    const t = tangents[i];
    const n = new THREE.Vector3(-t.z, 0, t.x);
    const cx = points2D[i].x, cz = points2D[i].z;
    const next = points2D[(i+1)%total];
    const segLen = Math.sqrt((next.x-points2D[i].x)**2+(next.z-points2D[i].z)**2);
    if(segLen < 0.1) continue;
    const mat = (Math.floor(i/4)%2===0) ? barMat : redMat;
    [-1,1].forEach(side => {
      const bx = cx + n.x*(TRACK_WIDTH/2+BW/2)*side;
      const bz = cz + n.z*(TRACK_WIDTH/2+BW/2)*side;
      const bGeo = new THREE.BoxGeometry(segLen+0.1, BH, BW);
      const bMesh = new THREE.Mesh(bGeo, mat);
      bMesh.position.set(bx, BH/2, bz);
      bMesh.rotation.y = Math.atan2(t.x, t.z);
      bMesh.castShadow = bMesh.receiveShadow = true;
      group.add(bMesh);
      barriers.push({pos:[bx,BH/2,bz], size:[segLen+0.1,BH,BW], rot:Math.atan2(t.x,t.z)});
    });
  }

  return {group, leftEdge, rightEdge, tangents, points2D, barriers};
}

const {group: trackGroup, barriers, tangents, points2D} = buildTrack();
scene.add(trackGroup);

const groundBody = new CANNON.Body({mass:0, material:groundMaterial});
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(groundBody);

barriers.forEach(b => {
  const body = new CANNON.Body({mass:0, material:groundMaterial});
  body.addShape(new CANNON.Box(new CANNON.Vec3(b.size[0]/2, b.size[1]/2, b.size[2]/2)));
  body.position.set(b.pos[0], b.pos[1], b.pos[2]);
  body.quaternion.setFromEuler(0, b.rot, 0);
  world.addBody(body);
});

function buildCarMesh() {
  const g = new THREE.Group();
  const bodyGeo  = new THREE.BoxGeometry(2.0, 0.55, 4.2);
  const bodyMat  = new THREE.MeshStandardMaterial({color:0xc0392b, roughness:0.3, metalness:0.6});
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.27;
  bodyMesh.castShadow = true;
  g.add(bodyMesh);
  const cabinGeo  = new THREE.BoxGeometry(1.7, 0.5, 2.0);
  const cabinMat  = new THREE.MeshStandardMaterial({color:0x1a1a2e, roughness:0.1, metalness:0.1, transparent:true, opacity:0.7});
  const cabin     = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.77, 0.3);
  cabin.castShadow = true;
  g.add(cabin);
  const spGeo = new THREE.BoxGeometry(2.1, 0.08, 0.4);
  const spMat = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.8});
  const splitter = new THREE.Mesh(spGeo, spMat);
  splitter.position.set(0, 0.06, 2.1);
  g.add(splitter);
  const wingGeo  = new THREE.BoxGeometry(2.0, 0.07, 0.5);
  const wingMesh = new THREE.Mesh(wingGeo, spMat);
  wingMesh.position.set(0, 0.85, -1.9);
  g.add(wingMesh);
  [-0.85, 0.85].forEach(x => {
    const sg = new THREE.BoxGeometry(0.07, 0.3, 0.07);
    const sm = new THREE.Mesh(sg, spMat);
    sm.position.set(x, 0.7, -1.9);
    g.add(sm);
  });
  const hlMat = new THREE.MeshStandardMaterial({color:0xffffcc, emissive:0xffffaa, emissiveIntensity:1});
  [-0.7, 0.7].forEach(x => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), hlMat);
    hl.position.set(x, 0.32, 2.13);
    g.add(hl);
  });
  const tlMat = new THREE.MeshStandardMaterial({color:0xff2200, emissive:0xff0000, emissiveIntensity:0.8});
  [-0.7, 0.7].forEach(x => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), tlMat);
    tl.position.set(x, 0.32, -2.13);
    g.add(tl);
  });
  const npMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9});
  const np    = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.02), npMat);
  np.position.set(0, 0.28, -2.12);
  g.add(np);
  return g;
}

function buildWheelMesh() {
  const g  = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16),
    new THREE.MeshStandardMaterial({color:0x888888, roughness:0.3, metalness:0.9})
  );
  rim.rotation.z = Math.PI/2;
  g.add(rim);
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16),
    new THREE.MeshStandardMaterial({color:0x111111, roughness:0.95})
  );
  tire.rotation.z = Math.PI/2;
  g.add(tire);
  for(let i=0;i<5;i++){
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.27, 0.06),
      new THREE.MeshStandardMaterial({color:0x555555, metalness:0.8})
    );
    spoke.rotation.z = Math.PI/2;
    spoke.rotation.x = (i/5)*Math.PI*2;
    spoke.position.y = Math.sin((i/5)*Math.PI*2)*0.17;
    spoke.position.z = Math.cos((i/5)*Math.PI*2)*0.17;
    g.add(spoke);
  }
  return g;
}

const carMesh  = buildCarMesh();
const wheelMeshes = [0,1,2,3].map(() => buildWheelMesh());
wheelMeshes.forEach(w => scene.add(w));
scene.add(carMesh);

const chassisBody = new CANNON.Body({mass: 1300});
chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.35, 2.1)));
chassisBody.position.set(5, 2, 5);
chassisBody.angularDamping = 0.4;
chassisBody.linearDamping  = 0.15;
world.addBody(chassisBody);

const vehicle = new CANNON.RaycastVehicle({
  chassisBody,
  indexRightAxis:   0,
  indexUpAxis:      1,
  indexForwardAxis: 2,
});

const wheelOpts = {
  radius:              0.42,
  directionLocal:      new CANNON.Vec3(0,-1,0),
  suspensionStiffness: 38,
  suspensionRestLength:0.45,
  frictionSlip:        2.2,
  dampingRelaxation:   2.6,
  dampingCompression:  4.2,
  maxSuspensionForce:  100000,
  rollInfluence:       0.03,
  axleLocal:           new CANNON.Vec3(1,0,0),
  chassisConnectionPointLocal: new CANNON.Vec3(),
  maxSuspensionTravel: 0.28,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true,
};

const WX = 1.04, WZF = 1.55, WZR = -1.55, WY = -0.25;
[[WX,WY,WZF],[-WX,WY,WZF],[WX,WY,WZR],[-WX,WY,WZR]].forEach((pos,i) => {
  const o = {...wheelOpts};
  o.chassisConnectionPointLocal = new CANNON.Vec3(...pos);
  if(i>=2) o.frictionSlip = 2.4;
  vehicle.addWheel(o);
});
vehicle.addToWorld(world);

const wheelBodies = vehicle.wheelInfos.map(wi => {
  const b = new CANNON.Body({mass:0, material:wheelMaterial});
  b.addShape(new CANNON.Cylinder(wi.radius, wi.radius, wi.radius*0.4, 16),
    new CANNON.Vec3(), new CANNON.Quaternion().setFromEuler(0,0,Math.PI/2));
  b.type = CANNON.Body.KINEMATIC;
  b.collisionFilterMask = 0;
  world.addBody(b);
  return b;
});

const keys = {};
window.addEventListener('keydown', e => { keys[e.code]=true; if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.code]=false; });

const mobState = {left:false,right:false,accel:false,brake:false};
function setupMobBtn(id, prop) {
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart', e=>{e.preventDefault();mobState[prop]=true;el.style.background='rgba(255,200,0,0.25)'},{passive:false});
  el.addEventListener('touchend',   e=>{e.preventDefault();mobState[prop]=false;el.style.background=''},{passive:false});
}
setupMobBtn('mob-left', 'left');
setupMobBtn('mob-right','right');
setupMobBtn('mob-accel','accel');
setupMobBtn('mob-brake','brake');

const CAR = {
  maxForce:    2400,
  maxBrake:    90,
  maxSteer:    0.55,
  engineForce: 0,
  brakeForce:  0,
  steering:    0,
  currentGear: 1,
  rpm:         800,
};

const GEAR_RATIOS = [0, 3.8, 2.6, 1.9, 1.4, 1.1, 0.9];
const MAX_GEAR    = 6;

const NUM_CP = 8;
const checkpoints = [];
for(let i=0;i<NUM_CP;i++){
  const t   = i/NUM_CP;
  const pt  = trackSpline.getPoint(t);
  const tan = trackSpline.getTangent(t);
  checkpoints.push({
    pos:    new THREE.Vector3(pt.x, 0, pt.z),
    normal: new THREE.Vector3(-tan.z, 0, tan.x).normalize(),
    width:  TRACK_WIDTH*0.9,
    passed: false,
  });
}

checkpoints.forEach((cp,i) => {
  const geo = new THREE.BoxGeometry(cp.width, 3, 0.15);
  const mat = new THREE.MeshStandardMaterial({
    color: i===0 ? 0xffcc00 : 0x00aaff,
    transparent:true, opacity:0.18, side:THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(cp.pos);
  mesh.position.y = 1.5;
  mesh.rotation.y = Math.atan2(cp.normal.x, cp.normal.z);
  scene.add(mesh);
});

let lapStart    = 0;
let lapCount    = 0;
let bestLap     = Infinity;
let lapRunning  = false;
let cpIndex     = 0;
let gameStarted = false;

function resetCheckpoints() {
  checkpoints.forEach(c => c.passed=false);
  cpIndex = 0;
}

function checkCpHit(carPos) {
  if(!gameStarted) return;
  const cp  = checkpoints[cpIndex];
  const dx  = carPos.x - cp.pos.x;
  const dz  = carPos.z - cp.pos.z;
  const dot = dx*cp.normal.x + dz*cp.normal.z;
  const perp= Math.abs(-dx*cp.normal.z + dz*cp.normal.x);
  if(Math.abs(dot) < 3.0 && perp < cp.width/2) {
    if(cpIndex===0 && lapRunning){
      const lapTime = (performance.now()-lapStart)/1000;
      lapCount++;
      if(lapTime < bestLap){
        bestLap = lapTime;
        flashBest();
      }
      lapStart = performance.now();
      resetCheckpoints();
    } else if(cpIndex===0 && !lapRunning){
      lapRunning = true;
      lapStart   = performance.now();
      resetCheckpoints();
    } else {
      checkpoints[cpIndex].passed = true;
      cpIndex = (cpIndex+1)%NUM_CP;
    }
  }
}

function flashBest(){
  const el = document.getElementById('best-flash');
  if(!el) return;
  el.style.opacity = '1';
  setTimeout(()=>el.style.opacity='0', 2200);
}

function fmtTime(s){
  const m  = Math.floor(s/60);
  const ss = (s%60).toFixed(3).padStart(6,'0');
  return m+':'+ss;
}

const camOffset     = new THREE.Vector3(0, 4.5, -10);
const camLookOffset = new THREE.Vector3(0, 1.0,  3);
let camPos  = new THREE.Vector3(0, 8, -16);
let camFOV  = 65;
let camShake = 0;

let audioCtx, engineNode, engineGain;
function initAudio(){
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  engineNode= audioCtx.createOscillator();
  engineNode.type = 'sawtooth';
  engineNode.frequency.setValueAtTime(60, audioCtx.currentTime);
  const dist = audioCtx.createWaveShaper();
  const curve = new Float32Array(256);
  for(let i=0;i<256;i++){
    const x = (i*2/255)-1;
    curve[i] = (Math.PI+200)*x/(Math.PI+200*Math.abs(x));
  }
  dist.curve  = curve;
  dist.oversample = '4x';
  engineGain  = audioCtx.createGain();
  engineGain.gain.value = 0.04;
  const filter = audioCtx.createBiquadFilter();
  filter.type  = 'lowpass';
  filter.frequency.value = 800;
  engineNode.connect(dist);
  dist.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(audioCtx.destination);
  engineNode.start();
}

const mmCanvas = document.getElementById('mm-canvas');
const mmCtx    = mmCanvas ? mmCanvas.getContext('2d') : null;
const MM_S = 120;
let mmMinX = Infinity, mmMinZ = Infinity, mmMaxX = -Infinity, mmMaxZ = -Infinity;
splinePoints.forEach(p => {
  mmMinX = Math.min(mmMinX, p.x); mmMaxX = Math.max(mmMaxX, p.x);
  mmMinZ = Math.min(mmMinZ, p.z); mmMaxZ = Math.max(mmMaxZ, p.z);
});
const mmRangeX = mmMaxX-mmMinX, mmRangeZ = mmMaxZ-mmMinZ;
const mmScale  = (MM_S-16)/Math.max(mmRangeX, mmRangeZ);

function toMM(x,z){
  return [
    (x-mmMinX)*mmScale + 8,
    (z-mmMinZ)*mmScale + 8,
  ];
}

function drawMinimap(carX, carZ){
  if(!mmCtx) return;
  mmCtx.clearRect(0,0,MM_S,MM_S);
  mmCtx.fillStyle = 'rgba(0,0,0,0.7)';
  mmCtx.fillRect(0,0,MM_S,MM_S);
  mmCtx.strokeStyle = '#444';
  mmCtx.lineWidth   = 5;
  mmCtx.beginPath();
  splinePoints.forEach((p,i)=>{
    const [mx,mz] = toMM(p.x,p.z);
    i===0 ? mmCtx.moveTo(mx,mz) : mmCtx.lineTo(mx,mz);
  });
  mmCtx.closePath();
  mmCtx.stroke();
  const [cx,cz] = toMM(carX, carZ);
  mmCtx.fillStyle = '#ffe033';
  mmCtx.beginPath();
  mmCtx.arc(cx,cz,3,0,Math.PI*2);
  mmCtx.fill();
}

function resetCar(){
  const pt  = trackSpline.getPoint(0);
  const tan = trackSpline.getTangent(0);
  chassisBody.position.set(pt.x, 1.2, pt.z);
  chassisBody.velocity.set(0,0,0);
  chassisBody.angularVelocity.set(0,0,0);
  const angle = Math.atan2(tan.x, tan.z);
  chassisBody.quaternion.setFromEuler(0, angle, 0);
  chassisBody.wakeUp();
}

let running  = false;
let lastTime = 0;
let accumulator = 0;

const startBtn = document.getElementById('start-btn');
if(startBtn) {
  startBtn.addEventListener('click', async () => {
    const overlay = document.getElementById('overlay');
    if(overlay) { overlay.style.opacity='0'; overlay.style.pointerEvents='none'; }
    try { initAudio(); } catch(e){}
    const cd = document.getElementById('countdown');
    for(let n=3;n>=1;n--){
      if(cd) { cd.textContent = n; cd.style.opacity='1'; }
      await new Promise(r=>setTimeout(r,900));
      if(cd) cd.style.opacity='0';
      await new Promise(r=>setTimeout(r,200));
    }
    if(cd) { cd.textContent='GO!'; cd.style.opacity='1'; }
    await new Promise(r=>setTimeout(r,700));
    if(cd) cd.style.opacity='0';
    resetCar();
    gameStarted = true;
    running     = true;
    lastTime    = performance.now();
    requestAnimationFrame(loop);
  });
}

function updateVehicle(dt){
  const speed    = chassisBody.velocity.length();
  const speedKMH = speed * 3.6;

  const throttle = keys['KeyW']||keys['ArrowUp']||mobState.accel;
  const braking  = keys['KeyS']||keys['ArrowDown']||mobState.brake;
  const steerL   = keys['KeyA']||keys['ArrowLeft']||mobState.left;
  const steerR   = keys['KeyD']||keys['ArrowRight']||mobState.right;
  const handbrake= keys['Space'];

  const gearThresholds = [0,20,45,75,110,145,185];
  if(speedKMH > gearThresholds[Math.min(CAR.currentGear,MAX_GEAR)] && CAR.currentGear < MAX_GEAR)
    CAR.currentGear++;
  if(speedKMH < gearThresholds[Math.max(CAR.currentGear-1,1)]*0.85 && CAR.currentGear > 1)
    CAR.currentGear--;

  CAR.rpm = 800 + (speedKMH/3) * GEAR_RATIOS[CAR.currentGear] * 100;
  CAR.rpm = Math.min(CAR.rpm, 8500);

  const gearEff = 1.0 / GEAR_RATIOS[CAR.currentGear] * 1.5;
  CAR.engineForce = throttle ? CAR.maxForce * gearEff : 0;
  CAR.brakeForce  = braking  ? CAR.maxBrake : 0;

  const hbForce = handbrake ? CAR.maxBrake*2 : 0;

  vehicle.applyEngineForce(throttle ? -CAR.engineForce : 0, 2);
  vehicle.applyEngineForce(throttle ? -CAR.engineForce : 0, 3);
  vehicle.setBrake(braking ? CAR.brakeForce : 0, 0);
  vehicle.setBrake(braking ? CAR.brakeForce : 0, 1);
  vehicle.setBrake(braking ? CAR.brakeForce : 0, 2);
  vehicle.setBrake(braking ? CAR.brakeForce : 0, 3);
  vehicle.setBrake(hbForce, 2);
  vehicle.setBrake(hbForce, 3);

  const steerFactor = Math.max(0.2, 1 - speedKMH/200);
  const targetSteer = (steerL?1:0) - (steerR?1:0);
  CAR.steering += (targetSteer*CAR.maxSteer*steerFactor - CAR.steering) * 8*dt;
  vehicle.setSteeringValue( CAR.steering, 0);
  vehicle.setSteeringValue( CAR.steering, 1);

  const vel = chassisBody.velocity;
  const dragCoef = 0.0008;
  chassisBody.applyForce(
    new CANNON.Vec3(-vel.x*speed*dragCoef, 0, -vel.z*speed*dragCoef),
    chassisBody.position
  );

  const downforce = speed * speed * 0.3;
  chassisBody.applyForce(new CANNON.Vec3(0,-downforce,0), chassisBody.position);

  if(engineNode){
    const targetFreq = 55 + CAR.rpm/80;
    engineNode.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.05);
    const vol = throttle ? 0.05 : 0.025;
    engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
  }

  const sn = document.getElementById('speed-num');
  const gv = document.getElementById('gear-val');
  const tf = document.getElementById('throttle-fill');
  const bf = document.getElementById('brake-fill');
  if(sn) sn.textContent = Math.round(speedKMH);
  if(gv) gv.textContent = throttle ? CAR.currentGear : (speedKMH<2?'N':CAR.currentGear);
  if(tf) tf.style.height = (throttle ? CAR.engineForce/CAR.maxForce*100 : 0)+'%';
  if(bf) bf.style.height = (braking  ? 100 : 0)+'%';

  if(lapRunning){
    const lt = (performance.now()-lapStart)/1000;
    const ltEl = document.getElementById('lap-time');
    if(ltEl) ltEl.textContent = fmtTime(lt);
  }
  if(bestLap < Infinity) {
    const blEl = document.getElementById('best-lap');
    if(blEl) blEl.textContent = fmtTime(bestLap);
  }
  const lcEl = document.getElementById('lap-count');
  if(lcEl) lcEl.textContent = (lapCount+1)+' / ∞';

  camShake = Math.max(0, speedKMH/30 - 1.5);

  const targetFOV = 60 + speedKMH*0.08;
  camFOV += (targetFOV - camFOV) * 2*dt;
  camera.fov = camFOV;
  camera.updateProjectionMatrix();
}

function updateWheelMeshes(){
  for(let i=0;i<4;i++){
    vehicle.updateWheelTransform(i);
    const t = vehicle.wheelInfos[i].worldTransform;
    wheelMeshes[i].position.copy(t.position);
    wheelMeshes[i].quaternion.copy(t.quaternion);
    wheelBodies[i].position.copy(t.position);
    wheelBodies[i].quaternion.copy(t.quaternion);
  }
}

function loop(ts){
  if(!running){ requestAnimationFrame(loop); return; }
  const dt = Math.min((ts-lastTime)/1000, 0.05);
  lastTime = ts;
  accumulator += dt;
  while(accumulator >= FIXED_STEP){
    world.step(FIXED_STEP, FIXED_STEP, MAX_SUB);
    accumulator -= FIXED_STEP;
  }

  carMesh.position.copy(chassisBody.position);
  carMesh.quaternion.copy(chassisBody.quaternion);
  carMesh.position.y -= 0.22;
  updateWheelMeshes();

  const cp = chassisBody.position;
  checkCpHit(new THREE.Vector3(cp.x, cp.y, cp.z));

  updateVehicle(dt);

  if(keys['KeyR']) resetCar();

  const carWorldPos = new THREE.Vector3().copy(carMesh.position);
  const carQuat     = carMesh.quaternion;
  const offset      = camOffset.clone().applyQuaternion(carQuat);
  const targetPos   = carWorldPos.clone().add(offset);
  camPos.lerp(targetPos, 4*dt);
  const shake = camShake * (Math.random()-0.5)*0.025;
  camera.position.copy(camPos).add(new THREE.Vector3(shake,shake*0.5,0));
  const lookAt = carWorldPos.clone().add(camLookOffset.clone().applyQuaternion(carQuat));
  camera.lookAt(lookAt);

  drawMinimap(cp.x, cp.z);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

resetCar();
renderer.render(scene, camera);
`;
}
