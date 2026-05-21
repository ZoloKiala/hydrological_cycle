import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- SCENE SETUP ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 180);

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 500
);
const DEFAULT_CAM = new THREE.Vector3(38, 28, 42);
camera.position.copy(DEFAULT_CAM);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
function getPixelRatioCap() {
  return window.innerWidth <= 760 || window.innerHeight <= 500 ? 1.5 : 2;
}
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, getPixelRatioCap()));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 18;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(0, 4, 0);
controls.autoRotateSpeed = 0.35;  // very gentle when idle

// Idle auto-rotate: kicks in 15 s after the last user interaction (and only
// when no tour or camera-reset is running). Resumes on any interaction.
let lastInteract = performance.now();
const IDLE_MS = 15000;
['start'].forEach(ev =>
  controls.addEventListener(ev, () => { lastInteract = performance.now(); })
);
['mousedown', 'touchstart', 'keydown', 'wheel'].forEach(ev =>
  window.addEventListener(ev, () => { lastInteract = performance.now(); }, { passive: true })
);

// ---------- LIGHTING ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xb3e5fc, 0x4caf50, 0.4);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.4);
sunLight.position.set(-30, 35, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40;
sunLight.shadow.camera.bottom = -40;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 100;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// ---------- TERRAIN ----------
// Base ground plate (rectangular world slice)
const GROUND_W = 60;
const GROUND_D = 40;

// Shared texture loader — pulling CC0 PBR maps from Poly Haven's CDN.
// (Direct hotlink is allowed; textures are CC0 / public domain.)
const texLoader = new THREE.TextureLoader();
function loadTiledTex(url, repeatX, repeatY) {
  const tex = texLoader.load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
const POLY = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k';
const grassTex = loadTiledTex(`${POLY}/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg`, 10, 8);
const rockTex  = loadTiledTex(`${POLY}/rock_face/rock_face_diff_1k.jpg`, 6, 5);
const sandTex  = loadTiledTex(`${POLY}/aerial_beach_03/aerial_beach_03_diff_1k.jpg`, 4, 4);

// Subsurface stratigraphy thicknesses (top of ground at y=0)
const SOIL_THICK = 1.4;
const GW_THICK = 1.6;
const ROCK_THICK = 2.5;
const SUB_DEPTH = SOIL_THICK + GW_THICK + ROCK_THICK; // 5.5

function buildGround() {
  // Three stratified subsurface layers replacing the old brown box.
  // Groundwater isn't a clear blue river — it's water saturating the
  // earth matrix, so we render it as wet/dark subsoil and add embedded
  // droplet specks below to suggest saturation.
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 });
  const gwMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723, roughness: 0.85, metalness: 0.05,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    map: rockTex,
    color: 0x78909c,
    roughness: 1,
  });

  const soil = new THREE.Mesh(new THREE.BoxGeometry(GROUND_W, SOIL_THICK, GROUND_D), soilMat);
  soil.position.y = -SOIL_THICK / 2;
  soil.receiveShadow = true;
  scene.add(soil);

  const gw = new THREE.Mesh(new THREE.BoxGeometry(GROUND_W, GW_THICK, GROUND_D), gwMat);
  gw.position.y = -SOIL_THICK - GW_THICK / 2;
  gw.receiveShadow = true;
  scene.add(gw);

  const rock = new THREE.Mesh(new THREE.BoxGeometry(GROUND_W, ROCK_THICK, GROUND_D), rockMat);
  rock.position.y = -SOIL_THICK - GW_THICK - ROCK_THICK / 2;
  rock.receiveShadow = true;
  scene.add(rock);

  // Speckles on the front cutaway face:
  //   - dark pebble specks on soil & rock
  //   - blue droplet specks inside the groundwater band (saturation)
  const dotsGeo = new THREE.BufferGeometry();
  const dotsCount = 600;
  const dotPos = new Float32Array(dotsCount * 3);
  const dotColors = new Float32Array(dotsCount * 3);
  const dotSizes = new Float32Array(dotsCount);
  const cSoilDot = new THREE.Color(0x3e2723);
  const cRockDot = new THREE.Color(0x1c272c);
  const cWaterDot = new THREE.Color(0x4fc3f7);
  for (let i = 0; i < dotsCount; i++) {
    const x = (Math.random() - 0.5) * GROUND_W;
    const yWithinSub = -Math.random() * SUB_DEPTH;
    dotPos[i * 3] = x;
    dotPos[i * 3 + 1] = yWithinSub;
    dotPos[i * 3 + 2] = GROUND_D / 2 + 0.02;
    let c;
    if (yWithinSub > -SOIL_THICK) {
      c = cSoilDot; dotSizes[i] = 0.16;
    } else if (yWithinSub > -SOIL_THICK - GW_THICK) {
      c = cWaterDot; dotSizes[i] = 0.28; // bigger droplets in groundwater
    } else {
      c = cRockDot; dotSizes[i] = 0.18;
    }
    dotColors[i * 3] = c.r; dotColors[i * 3 + 1] = c.g; dotColors[i * 3 + 2] = c.b;
  }
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  dotsGeo.setAttribute('color', new THREE.BufferAttribute(dotColors, 3));
  const dotsMat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, sizeAttenuation: true });
  scene.add(new THREE.Points(dotsGeo, dotsMat));

  // Text labels (SOIL / GROUNDWATER / ROCK) painted onto small planes on the cutaway face
  function textPlane(text, color, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 110px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    return plane;
  }

  const faceZ = GROUND_D / 2 + 0.05;
  const soilLabel = textPlane('SOIL', '#ffffff', 5, 1.25);
  soilLabel.position.set(10, -SOIL_THICK / 2, faceZ);
  scene.add(soilLabel);

  const gwLabel = textPlane('GROUNDWATER', '#ffffff', 8, 1.5);
  gwLabel.position.set(10, -SOIL_THICK - GW_THICK / 2, faceZ);
  scene.add(gwLabel);

  const rockLabel = textPlane('ROCK', '#ffffff', 5, 1.25);
  rockLabel.position.set(10, -SOIL_THICK - GW_THICK - ROCK_THICK / 2, faceZ);
  scene.add(rockLabel);

  // grass top layer with vertex displacement
  const topGeo = new THREE.PlaneGeometry(GROUND_W, GROUND_D, 80, 60);
  topGeo.rotateX(-Math.PI / 2);
  const pos = topGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // gentle rolling hills, flatten near rivers/ocean
    const distToOcean = Math.max(0, x + 18); // ocean on left side
    let h = 0;
    h += Math.sin(x * 0.18) * Math.cos(z * 0.22) * 0.6;
    h += Math.sin(x * 0.4 + z * 0.3) * 0.25;
    // big mountain on the right back
    const mx = x - 18, mz = z + 6;
    const md = Math.sqrt(mx * mx + mz * mz);
    h += Math.max(0, 9 - md) * 0.95;
    // ocean dip on the far left
    if (x < -18) h = -1.6;
    // Clamp non-ocean terrain so it sits above ocean's max wave height
    // (~0.22) — keeps the blue plane hidden under grass everywhere on land.
    if (x >= -18 && h < 0.25) h = 0.25;
    pos.setY(i, h);
  }
  topGeo.computeVertexNormals();

  // Base grass texture (with rock detail) provides micro-variation;
  // vertex colors retint it for sand, dark grass, rock and snow zones.
  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    color: 0xffffff,
    roughness: 0.95,
    vertexColors: true,
  });
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x9ccc65);  // brighter so texture detail shows
  const cDark = new THREE.Color(0x689f38);
  const cRock = new THREE.Color(0x9e9e9e);
  const cSnow = new THREE.Color(0xfafafa);
  const cSand = new THREE.Color(0xf4e4b8);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    let c = cGrass.clone();
    if (y > 5) c.copy(cSnow);
    else if (y > 3) c.lerpColors(cRock, cSnow, (y - 3) / 2);
    else if (y > 1.2) c.lerpColors(cDark, cRock, (y - 1.2) / 1.8);
    else if (y > 0.2) c.lerpColors(cGrass, cDark, (y - 0.2) / 1);
    if (x < -16 && y < 0) c.copy(cSand);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  topGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const topMesh = new THREE.Mesh(topGeo, grassMat);
  topMesh.position.y = 0.02;
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  scene.add(topMesh);

  return topMesh;
}
const terrain = buildGround();

// ---------- OCEAN ----------
function buildOcean() {
  const geo = new THREE.PlaneGeometry(28, GROUND_D + 2, 40, 40);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1e88e5,
    roughness: 0.3,
    metalness: 0.0,
    emissive: 0x2196f3,
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Sit well above the soil-layer top (y=0) so wave troughs can't dip
  // below the brown soil. Combined with the grass-clamp bump to >=0.15,
  // ocean remains hidden under grass on land and visible only in the
  // basin where grass displacement is forced to -1.6.
  mesh.position.set(-22, 0.18, 0);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
const ocean = buildOcean();

// ---------- RIVER NETWORK ----------
// Flat ribbon rivers that conform to terrain height + dirt banks beneath.
// A main river leaves the mountain and two tributaries merge into it.
function buildRiverNetwork() {
  // Procedural flowing water texture (scrolled in the animate loop)
  const cvs = document.createElement('canvas');
  cvs.width = 256; cvs.height = 64;
  const ctx = cvs.getContext('2d');
  // Base water color — flatter so streaks read better
  ctx.fillStyle = '#2196f3';
  ctx.fillRect(0, 0, 256, 64);

  // VERTICAL streaks (canvas y direction = river-length / flow direction)
  // Each streak runs top-to-bottom and starts/ends at the same x so the
  // texture tiles seamlessly along V.
  ctx.lineCap = 'round';
  for (let i = 0; i < 32; i++) {
    const x = Math.random() * 256;
    const alpha = 0.25 + Math.random() * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 18, 22,
      x + (Math.random() - 0.5) * 18, 42,
      x, 64
    );
    ctx.stroke();
  }

  // Foam-dot trails (small clusters of bright dots along vertical lines)
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 256;
    const dotCount = 4 + Math.floor(Math.random() * 5);
    for (let j = 0; j < dotCount; j++) {
      const y = (j / dotCount) * 64 + Math.random() * 8;
      ctx.fillStyle = `rgba(255,255,255,${0.6 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x + (Math.random() - 0.5) * 3, y % 64, 0.6 + Math.random() * 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const waterTex = new THREE.CanvasTexture(cvs);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(1, 6); // tile more along flow direction for finer streaks

  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    color: 0x4fc3f7,
    roughness: 0.4,
    metalness: 0.0,
    transparent: true,
    opacity: 0.95,
    emissive: 0x0277bd,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const bankMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    color: 0x8d6e63,
    roughness: 1.0,
    side: THREE.DoubleSide,
  });

  // Control points: [x, z, widthFactor].
  // Pronounced meanders — z amplitude ±3, wavelength ~3 x-units, six bends.
  // Centripetal CatmullRom keeps the curve smooth through the sharp swings.
  // Width grows gradually from a narrow headwater (~0.25) at the spring
  // source to a wide delta (~2.75) at the river mouth — matches how
  // first-order streams progressively gather discharge downstream.
  const mainRiver = [
    [9.5, -1.5, 0.25],    // SOURCE — moved further north so the river starts higher up the slope
    [9.0,  1.2, 0.34],    // transition bend down toward old BEND 1
    [8.5,  3.0, 0.40],    // BEND 1 — north, still small
    [7.0,  1.5, 0.55],
    [5.5, -2.0, 0.72],    // BEND 2 — south, growing
    [4.0,  0.5, 0.90],
    [2.5,  3.0, 1.05],    // BEND 3 — north
    [1.0,  0.5, 1.20],
    [-0.5,-2.0, 1.32],    // BEND 4 — south
    [-2.0, 0.5, 1.42],
    [-3.5, 2.8, 1.52],    // BEND 5 — north
    [-5.0, 0.5, 1.62],
    [-6.5,-2.0, 1.72],    // BEND 6 — south
    [-8.0, 0.0, 1.82],
    [-10.0, 1.2, 1.90],
    [-12.5,-0.4, 2.00],
    [-15.0,-1.0, 2.20],
    [-17.5,-1.0, 2.45],
    // Delta extending across the cliff edge into the basin
    [-19.0,-1.0, 2.60], [-21.0,-1.0, 2.75],
  ];
  // East tributary joins main river at the (7, 1.5) crossing (after BEND 1).
  const tributaryEast = [
    [22, 3, 0.32], [19, 2.5, 0.42], [16, 2.0, 0.52],
    [13, 1.8, 0.62], [10, 1.6, 0.72], [8.5, 1.5, 0.80], [7, 1.5, 0.82],
  ];
  // South tributary now routes THROUGH the rice paddy area at (-2, -10)
  // and joins the main river at the southernmost bend (-6.5, -2.0).
  const tributarySouth = [
    [10, -15, 0.30],  [7, -13, 0.38],   [4, -12, 0.46],
    [1, -11, 0.55],   [-2, -10, 0.65],   // passes through paddy center
    [-5, -8, 0.78],   [-6, -5, 0.90],   [-6.5, -2.0, 1.0],
  ];

  function buildRibbon(controlPoints, baseWidth) {
    const v3pts = controlPoints.map(p => new THREE.Vector3(p[0], 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(v3pts, false, 'centripetal');
    const samples = 100;
    const wPos = [], wUv = [];
    const bPos = [], bUv = [];
    let prevL = null, prevR = null, prevBL = null, prevBR = null;
    let runningV = 0;
    const wf = controlPoints.map(p => p[2]);

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t); tan.y = 0; tan.normalize();
      const n = new THREE.Vector3(-tan.z, 0, tan.x);
      const seg = t * (wf.length - 1);
      const lo = Math.floor(seg), hi = Math.min(lo + 1, wf.length - 1);
      const frac = seg - lo;
      const w = (wf[lo] * (1 - frac) + wf[hi] * frac) * baseWidth;
      // Narrow sandy bank — the wide bank was creating a brown strip
      // between rivers and adjacent ponds.
      const bw = w + 0.15;

      // Sample terrain at each edge so the ribbon tilts to follow slopes
      // instead of sticking out flat from the curve center.
      const Lx = p.x + n.x * w,  Lz = p.z + n.z * w;
      const Rx = p.x - n.x * w,  Rz = p.z - n.z * w;
      const BLx = p.x + n.x * bw, BLz = p.z + n.z * bw;
      const BRx = p.x - n.x * bw, BRz = p.z - n.z * bw;
      const L = new THREE.Vector3(Lx, sampleTerrainY(Lx, Lz) + 0.10, Lz);
      const R = new THREE.Vector3(Rx, sampleTerrainY(Rx, Rz) + 0.10, Rz);
      const BL = new THREE.Vector3(BLx, sampleTerrainY(BLx, BLz) + 0.06, BLz);
      const BR = new THREE.Vector3(BRx, sampleTerrainY(BRx, BRz) + 0.06, BRz);

      if (i > 0) {
        const vPrev = runningV;
        const vNow = runningV + 1 / samples;
        wPos.push(
          prevL.x, prevL.y, prevL.z,  prevR.x, prevR.y, prevR.z,  R.x, R.y, R.z,
          prevL.x, prevL.y, prevL.z,  R.x, R.y, R.z,              L.x, L.y, L.z,
        );
        wUv.push(0, vPrev, 1, vPrev, 1, vNow,  0, vPrev, 1, vNow, 0, vNow);
        bPos.push(
          prevBL.x, prevBL.y, prevBL.z, prevBR.x, prevBR.y, prevBR.z, BR.x, BR.y, BR.z,
          prevBL.x, prevBL.y, prevBL.z, BR.x, BR.y, BR.z,             BL.x, BL.y, BL.z,
        );
        bUv.push(0, vPrev, 1, vPrev, 1, vNow,  0, vPrev, 1, vNow, 0, vNow);
        runningV = vNow;
      }
      prevL = L; prevR = R; prevBL = BL; prevBR = BR;
    }

    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
    wg.computeVertexNormals();
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
    bg.computeVertexNormals();

    const bank = new THREE.Mesh(bg, bankMat);
    bank.receiveShadow = true;
    bank.renderOrder = 1;
    scene.add(bank);
    const water = new THREE.Mesh(wg, waterMat);
    water.receiveShadow = true;
    water.renderOrder = 2;
    scene.add(water);
    return water;
  }

  buildRibbon(mainRiver, 0.95);
  buildRibbon(tributaryEast, 0.65);
  buildRibbon(tributarySouth, 0.6);

  return { waterTex };
}
const riverNet = buildRiverNetwork();

// ---------- WATERSHED BOUNDARY ----------
// A visible divide around the upper catchment so "watershed" is not just a label.
function buildWatershedBoundary() {
  const outline = [
    [8.5, -15.5],
    [13.5, -20.5],
    [23.5, -19.0],
    [29.0, -10.5],
    [27.0, -1.0],
    [20.0, 5.5],
    [11.5, 2.8],
    [8.0, -6.0],
  ];
  const points = outline.map(([x, z]) => new THREE.Vector3(x, sampleTerrainY(x, z) + 0.35, z));
  points.push(points[0].clone());
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 120, 0.08, 8, false),
    new THREE.MeshStandardMaterial({
      color: 0xfff176,
      emissive: 0xfbc02d,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    })
  );
  tube.castShadow = false;
  scene.add(tube);

  const markerMat = new THREE.MeshStandardMaterial({
    color: 0x0d47a1,
    emissive: 0x1565c0,
    emissiveIntensity: 0.25,
    roughness: 0.55,
  });
  outline.forEach(([x, z]) => {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.65, 10), markerMat);
    marker.position.set(x, sampleTerrainY(x, z) + 0.34, z);
    marker.castShadow = true;
    scene.add(marker);
  });
}
// buildWatershedBoundary(); // disabled — user requested removal of the yellow ring around the mountain

// ---------- TREES ----------
function makeTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
  );
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  group.add(trunk);

  const leavesMat = new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.9,
  });
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.8 - i * 0.15, 1.0, 8),
      leavesMat
    );
    cone.position.y = 1.2 + i * 0.55;
    cone.castShadow = true;
    group.add(cone);
  }
  group.position.set(x, sampleTerrainY(x, z), z);
  group.scale.setScalar(scale);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  return group;
}

// Bushy, round-canopy tree — distinct from the conical firs (makeTree).
// Each tree gets its own material with a random green tint and irregular
// foliage placement so a row of them doesn't read as a single blob.
const _decGreens = [0x4caf50, 0x66bb6a, 0x81c784, 0x388e3c, 0x558b2f, 0x7cb342];
function makeDeciduousTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.2, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 })
  );
  trunk.position.y = 0.5;
  trunk.castShadow = true;
  group.add(trunk);

  // Pick a random green for this individual tree
  const baseColor = _decGreens[Math.floor(Math.random() * _decGreens.length)];
  const leavesMat = new THREE.MeshStandardMaterial({
    color: baseColor, roughness: 0.85, flatShading: true,
  });

  // 7 irregular foliage puffs at random offsets — gives an organic crown
  // shape instead of the symmetric 5-sphere mound the previous version had.
  const puffCount = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffCount; i++) {
    const r = 0.32 + Math.random() * 0.28;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leavesMat);
    puff.position.set(
      (Math.random() - 0.5) * 0.9,
      1.0 + Math.random() * 0.9,
      (Math.random() - 0.5) * 0.9
    );
    puff.scale.set(
      0.85 + Math.random() * 0.3,
      0.8 + Math.random() * 0.4,
      0.85 + Math.random() * 0.3
    );
    puff.castShadow = true;
    group.add(puff);
  }
  group.position.set(x, sampleTerrainY(x, z), z);
  group.scale.setScalar(scale);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  return group;
}

function makePalmTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 })
  );
  trunk.position.y = 1.2;
  trunk.rotation.z = (Math.random() - 0.5) * 0.18;
  trunk.castShadow = true;
  group.add(trunk);

  // Central leaf cluster — fronds modeled as flattened scaled spheres
  // pointing outward and slightly down, which read better than thin planes.
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4caf50, roughness: 0.85,
  });
  const frondCount = 8;
  for (let i = 0; i < frondCount; i++) {
    const frond = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), leafMat);
    const ang = (i / frondCount) * Math.PI * 2;
    const tiltOut = 0.45;
    frond.position.set(Math.cos(ang) * tiltOut, 2.45, Math.sin(ang) * tiltOut);
    frond.scale.set(1.4, 0.28, 0.55);
    frond.rotation.y = -ang;
    frond.rotation.z = -0.35; // droop
    frond.castShadow = true;
    group.add(frond);
  }
  // small darker cap covering frond bases
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 })
  );
  cap.position.y = 2.4;
  cap.castShadow = true;
  group.add(cap);

  group.position.set(x, sampleTerrainY(x, z), z);
  group.scale.setScalar(scale);
  scene.add(group);
  return group;
}

function sampleTerrainY(x, z) {
  // mirror displacement formula above
  let h = 0;
  h += Math.sin(x * 0.18) * Math.cos(z * 0.22) * 0.6;
  h += Math.sin(x * 0.4 + z * 0.3) * 0.25;
  const mx = x - 18, mz = z + 6;
  const md = Math.sqrt(mx * mx + mz * mz);
  h += Math.max(0, 9 - md) * 0.95;
  if (x < -18) h = -1.6;
  else if (h < 0.25) h = 0.25;
  return h;
}

// Tree clusters instead of scattered singletons. Each cluster scatters its
// trees within a disk around a center point, with a min-distance reject so
// trunks don't overlap.
function makeTreeCluster(cx, cz, count, radius, scaleMin = 0.75, scaleMax = 1.35) {
  const placed = [];
  let attempts = 0;
  while (placed.length < count && attempts < count * 8) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius; // uniform disk distribution
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    // Reject trees that would sit off the terrain edge.
    const margin = 0.7;
    if (Math.abs(x) > GROUND_W / 2 - margin) continue;
    if (Math.abs(z) > GROUND_D / 2 - margin) continue;
    const y = sampleTerrainY(x, z);
    if (y < 0.1 || y > 5) continue;                           // skip ocean & high mountain
    if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 1.1)) continue; // spacing
    makeTree(x, z, scaleMin + Math.random() * (scaleMax - scaleMin));
    placed.push({ x, z });
  }
}

// Tree clusters across the open plains. Denser counts and a few extra
// clusters to fill the landscape.
// Removed (-7, 2) riverside grove — trees were on the river near the
// water-supply/stormwater pipes.
makeTreeCluster(18, -14, 9, 2.4);  // east plain, pulled east + smaller to clear the gully
makeTreeCluster(0, -14,  8, 2.8);  // far south plain
makeTreeCluster(-3, 16,  7, 2.6);  // north plain near town
// Removed the (10, -2) mid-east cluster — it overlapped the relocated erosion-control patch.
makeTreeCluster(8, -17,  6, 2.4);  // far south-east plain
makeTreeCluster(-12, 4,  6, 2.2);  // west coast strip

// Background forest tucked behind the mountain so the catchment feels alive
// without blocking the rain, river source, or mountain label.
function makeMountainBackForest() {
  const centers = [
    { x: 22, z: -13, count: 22, radius: 3.6 },
    { x: 25, z: -8,  count: 20, radius: 3.3 },
    { x: 20, z: -17, count: 16, radius: 3.0 },
    { x: 28, z: -12, count: 16, radius: 2.8 },
    { x: 17, z: -18, count: 12, radius: 2.6 },
  ];
  centers.forEach(cluster => {
    const placed = [];
    let attempts = 0;
    while (placed.length < cluster.count && attempts < cluster.count * 10) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * cluster.radius;
      const x = cluster.x + Math.cos(angle) * r;
      const z = cluster.z + Math.sin(angle) * r;
      // Stay safely inside the terrain bounds — otherwise the tree
      // canopy hangs off the edge of the ground into open sky.
      const margin = 0.6;
      if (Math.abs(x) > GROUND_W / 2 - margin) continue;
      if (Math.abs(z) > GROUND_D / 2 - margin) continue;
      const y = sampleTerrainY(x, z);
      if (y < 0.2 || y > 7.2) continue;
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 0.85)) continue;
      const scale = 0.45 + Math.random() * 0.45;
      if (Math.random() < 0.7) makeTree(x, z, scale);
      else makeDeciduousTree(x, z, scale * 0.9);
      placed.push({ x, z });
    }
  });
}
makeMountainBackForest();

function makeMountainSlopeTrees() {
  // Four removed: (13.0,-5.5), (14.2,-8.2), (15.6,-2.2), (16.8,-10.8) — all
  // sat too close to the erosion-gully (12,-8) or erosion-control patch (12,-3),
  // which together read as cleared/degraded ground.
  const slopeSpots = [
    { x: 18.8, z: -12.2, scale: 0.42 },
    { x: 20.5, z: -10.0, scale: 0.46 },
    { x: 22.0, z: -6.5, scale: 0.52 },
    { x: 20.8, z: -2.6, scale: 0.45 },
    { x: 17.6, z: 0.2, scale: 0.50 },
    { x: 23.4, z: -3.0, scale: 0.44 },
  ];
  slopeSpots.forEach(({ x, z, scale }) => {
    const y = sampleTerrainY(x, z);
    if (y > 0.3 && y < 7.4) makeTree(x, z, scale);
  });
}
makeMountainSlopeTrees();
// ---------- DEFORESTATION PATCH ----------
function buildDeforestation(cx, cz, width = 8, depth = 6,
                            addSurvivingTrees = true,
                            addStumpsAndLogs = true,
                            carveGullies = false,
                            skipEastEdge = false) {
  const yT = sampleTerrainY(cx, cz);
  // Scale all sub-counts down for smaller patches
  const scale = (width * depth) / 48;  // 1.0 for the default 8×6

  // Bare exposed soil — uses a PlaneGeometry with displaced vertices so we
  // can CARVE actual gully depressions into the surface (a box can't be
  // hollowed without CSG). Each "gully" is a strip of vertices pushed
  // down by `gully.depth`, with a falloff toward the edges.
  const segX = Math.max(40, Math.floor(width * 8));
  const segZ = Math.max(20, Math.floor(depth * 8));
  const dirtGeo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  dirtGeo.rotateX(-Math.PI / 2);

  // Define gully cross-sections only when carving — pure deforestation
  // patches stay flat (no erosion gullies; those belong to the erosion demo).
  const gullies = [];
  if (carveGullies) {
    gullies.push(
      { x: 0, z: 0, len: depth * 0.85, w: 0.55, depth: 0.32 } // big central
    );
    const sideCount = Math.max(2, Math.floor(width / 1.2));
    for (let i = 0; i < sideCount; i++) {
      const gx = -width / 2 + 0.5 + i * ((width - 1) / Math.max(1, sideCount - 1));
      if (Math.abs(gx) < 0.7) continue;
      gullies.push({
        x: gx,
        z: (Math.random() - 0.5) * 0.4,
        len: depth * (0.55 + Math.random() * 0.25),
        w: 0.18 + Math.random() * 0.08,
        depth: 0.13 + Math.random() * 0.05,
      });
    }
  }

  const pos = dirtGeo.attributes.position;
  const dirtColors = new Float32Array(pos.count * 3);
  const baseR = 0.55, baseG = 0.31, baseB = 0.20;
  const darkR = 0.05, darkG = 0.04, darkB = 0.025;
  let maxDip = 0;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vz = pos.getZ(i);
    let dip = 0;
    for (const g of gullies) {
      const dx = Math.abs(vx - g.x);
      const dz = Math.abs(vz - g.z);
      const halfW = g.w / 2, halfL = g.len / 2;
      if (dx < halfW && dz < halfL) {
        const fx = 1 - (dx / halfW);
        const fz = Math.min(1, (1 - dz / halfL) * 2);
        // Smooth bell-curve falloff
        const factor = Math.pow(fx * fx * fz, 1.2);
        dip = Math.min(dip, -g.depth * factor);
      }
    }
    pos.setY(i, dip);
    if (dip < maxDip) maxDip = dip;
    // Darker color the deeper the depression goes
    const t = Math.min(1, -dip / 0.35);
    dirtColors[i * 3]     = baseR * (1 - t) + darkR * t;
    dirtColors[i * 3 + 1] = baseG * (1 - t) + darkG * t;
    dirtColors[i * 3 + 2] = baseB * (1 - t) + darkB * t;
  }
  dirtGeo.setAttribute('color', new THREE.BufferAttribute(dirtColors, 3));
  dirtGeo.computeVertexNormals();
  const dirt = new THREE.Mesh(dirtGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.98, flatShading: false,
  }));
  dirt.position.set(cx, yT + 0.10, cz);
  dirt.receiveShadow = true;
  dirt.castShadow = true;
  scene.add(dirt);
  // Thin brown side walls so the strip still looks like raised soil from the side
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  [
    [width, 0.10, 0.04,  0, yT + 0.05,  depth / 2],
    [width, 0.10, 0.04,  0, yT + 0.05, -depth / 2],
    [0.04, 0.10, depth,  width / 2, yT + 0.05,  0],
    [0.04, 0.10, depth, -width / 2, yT + 0.05,  0],
  ].forEach(([w, h, d, x, y, z]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sideMat);
    wall.position.set(cx + x, y, cz + z);
    scene.add(wall);
  });
  // Darker scattered patches
  const patchCount = Math.max(10, Math.floor(30 * scale));
  for (let i = 0; i < patchCount; i++) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.25 + Math.random() * 0.55, 10),
      new THREE.MeshStandardMaterial({
        color: Math.random() < 0.65 ? 0x3e2723 : 0x8d5a35,
        roughness: 1,
        transparent: true,
        opacity: 0.9,
      })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = Math.random() * Math.PI;
    patch.scale.set(1.2 + Math.random() * 1.2, 0.65 + Math.random() * 0.6, 1);
    patch.position.set(
      cx + (Math.random() - 0.5) * (width - 1),
      yT + 0.105,
      cz + (Math.random() - 0.5) * (depth - 1)
    );
    scene.add(patch);
  }
  if (addStumpsAndLogs) {
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x2b1b12,
      transparent: true,
      opacity: 0.62,
      roughness: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    [-0.45, 0.45].forEach(offset => {
      const track = new THREE.Mesh(new THREE.PlaneGeometry(0.28, depth * 0.95), trackMat);
      track.rotation.x = -Math.PI / 2;
      track.rotation.z = -0.18;
      track.position.set(cx - width * 0.18 + offset, yT + 0.115, cz);
      scene.add(track);
    });
  }
  // Stumps + fallen logs are the visual markers of DEFORESTATION (cleared
  // trees). Skipped when addStumpsAndLogs=false so a pure erosion strip
  // stays free of cut-tree debris.
  if (addStumpsAndLogs) {
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
    const cutMat = new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.85 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 });
    const stumpCount = Math.max(10, Math.floor(24 * scale));
    for (let i = 0; i < stumpCount; i++) {
      const sx = cx + (Math.random() - 0.5) * (width - 1);
      const sz = cz + (Math.random() - 0.5) * (depth - 1);
      const r = 0.18 + Math.random() * 0.10;
      const h = 0.4 + Math.random() * 0.20;
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.85, r, h, 10), stumpMat
      );
      stump.position.set(sx, yT + h / 2 + 0.04, sz);
      stump.castShadow = true;
      scene.add(stump);
      const cut = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.04, 10), cutMat
      );
      cut.position.set(sx, yT + h + 0.04, sz);
      scene.add(cut);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.42, 0.012, 5, 16),
        ringMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(sx, yT + h + 0.075, sz);
      scene.add(ring);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 });
    const logCount = Math.max(5, Math.floor(10 * scale));
    for (let i = 0; i < logCount; i++) {
      const logLen = Math.min(width * 0.35, 1.8 + Math.random() * 0.8);
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, logLen, 10), logMat
      );
      log.position.set(
        cx + (Math.random() - 0.5) * (width - 1.5),
        yT + 0.28,
        cz + (Math.random() - 0.5) * (depth - 1.5)
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = Math.random() * Math.PI;
      log.castShadow = true;
      scene.add(log);
    }
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 });
    for (let i = 0; i < Math.max(18, Math.floor(34 * scale)); i++) {
      const len = 0.55 + Math.random() * 1.05;
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.045, len, 5),
        branchMat
      );
      const bx = cx + (Math.random() - 0.5) * (width - 0.8);
      const bz = cz + (Math.random() - 0.5) * (depth - 0.8);
      branch.position.set(bx, yT + 0.16 + Math.random() * 0.08, bz);
      branch.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.45;
      branch.rotation.y = Math.random() * Math.PI;
      branch.castShadow = true;
      scene.add(branch);
    }
    const slashPileMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });
    for (let p = 0; p < 4; p++) {
      const px = cx + (Math.random() - 0.5) * (width - 1.2);
      const pz = cz + (Math.random() - 0.5) * (depth - 1.2);
      for (let i = 0; i < 5; i++) {
        const stick = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.05, 0.8 + Math.random() * 0.55, 5),
          slashPileMat
        );
        stick.position.set(
          px + (Math.random() - 0.5) * 0.65,
          yT + 0.18 + i * 0.035,
          pz + (Math.random() - 0.5) * 0.65
        );
        stick.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        stick.rotation.y = Math.random() * Math.PI;
        stick.castShadow = true;
        scene.add(stick);
      }
    }
    // (Stacked log pile / cut-timber pyramid removed per user request —
    //  the pile was visually "spilling" out of the mountain slope.)
    // ---- SAWDUST piles around the larger stumps ----
    const sawdustMat = new THREE.MeshStandardMaterial({ color: 0xe6d49a, roughness: 1 });
    for (let i = 0; i < Math.max(8, Math.floor(14 * scale)); i++) {
      const sd = new THREE.Mesh(
        new THREE.CircleGeometry(0.22 + Math.random() * 0.18, 12),
        sawdustMat
      );
      sd.rotation.x = -Math.PI / 2;
      sd.position.set(
        cx + (Math.random() - 0.5) * (width - 0.8),
        yT + 0.13,
        cz + (Math.random() - 0.5) * (depth - 0.8)
      );
      scene.add(sd);
    }
    // ---- PARTIALLY FELLED TREE — tilted at the edge of the patch ----
    const fallenTreeGroup = new THREE.Group();
    const fellTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 2.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
    );
    fellTrunk.position.y = 1.4;
    fellTrunk.castShadow = true;
    fallenTreeGroup.add(fellTrunk);
    // Sparse remaining foliage on the falling tree
    const fellFoliageMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.9 });
    [[0, 2.4, 0, 0.8], [0.3, 2.7, 0.15, 0.6], [-0.25, 2.6, -0.2, 0.65]].forEach(p => {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(p[3], 10, 8), fellFoliageMat);
      blob.position.set(p[0], p[1], p[2]);
      blob.castShadow = true;
      fallenTreeGroup.add(blob);
    });
    // Tilt the whole tree (mid-fall pose)
    fallenTreeGroup.position.set(cx + width * 0.32, yT + 0.04, cz + depth * 0.32);
    fallenTreeGroup.rotation.z = -0.85;  // tilted ~50° off vertical
    fallenTreeGroup.rotation.y = (Math.random() - 0.5) * 0.5;
    scene.add(fallenTreeGroup);
    // Visible saw cut at the base (light wedge missing)
    const cutWedge = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.85 })
    );
    cutWedge.position.set(cx + width * 0.32 + 0.15, yT + 0.18, cz + depth * 0.32);
    scene.add(cutWedge);
  }
  // Surviving live trees ringing the edges — skipped when addSurvivingTrees=false
  // (e.g. for the eroded strip beside the NBS terrace, which should be fully bare)
  if (addSurvivingTrees) {
    const hw = width / 2 - 0.4, hd = depth / 2 - 0.4;
    const edgeOffsets = scale >= 0.6 ? [
      [-hw, -hd * 0.7], [-hw, 0], [-hw, hd * 0.7],
      [ hw, -hd * 0.7], [ hw, 0], [ hw, hd * 0.7],
      [-hw * 0.55, -hd], [ hw * 0.55, -hd],
      [-hw * 0.55,  hd], [ hw * 0.55,  hd],
    ] : [
      [-hw, 0], [hw, 0], [0, -hd], [0, hd],
    ];
    const survivingEdges = skipEastEdge
      ? edgeOffsets.filter(o => o[0] < hw - 0.01)
      : edgeOffsets;
    survivingEdges.forEach(o => {
      makeTree(cx + o[0] + (Math.random() - 0.5) * 0.4,
               cz + o[1] + (Math.random() - 0.5) * 0.4,
               0.65 + Math.random() * 0.3);
    });
    const brokenMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 });
    const brokenOffsetsAll = [[-hw * 0.9, -hd], [hw * 0.88, hd * 0.8], [0, hd], [hw, -hd * 0.45]];
    const brokenOffsets = skipEastEdge
      ? brokenOffsetsAll.filter(o => o[0] < hw - 0.01)
      : brokenOffsetsAll;
    brokenOffsets.forEach(o => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.18, 1.2, 7),
        brokenMat
      );
      const x = cx + o[0] + (Math.random() - 0.5) * 0.35;
      const z = cz + o[1] + (Math.random() - 0.5) * 0.35;
      trunk.position.set(x, sampleTerrainY(x, z) + 0.55, z);
      trunk.rotation.z = (Math.random() - 0.5) * 0.25;
      trunk.castShadow = true;
      scene.add(trunk);
    });
  }
}
// Pure deforestation: stumps + logs + edge trees, FLAT bare ground (no gullies).
// skipEastEdge=true keeps the east side clear so the adjacent erosion gully and
// erosion-control patch read as bare degraded land, not "edge of a forest".
buildDeforestation(8, -8, 9, 7, true, true, false, true);
// (Soil-erosion strip removed per user request.)

// ---------- AFFORESTATION ----------
// Newly-planted forest patch right next to the deforestation site, so the
// recovery counterpoint reads visually. Rows of saplings in protective
// tubes, with a few older trees mixed in showing progressive growth.
function buildAfforestation(cx, cz, width = 5, depth = 4) {
  const yT = sampleTerrainY(cx, cz);
  // Tilled / prepared soil base (lighter than deforestation soil, indicating
  // it's been cultivated for planting)
  const prepMat = new THREE.MeshStandardMaterial({
    color: 0x8d6e63, roughness: 1,
  });
  const prep = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.06, depth), prepMat
  );
  prep.position.set(cx, yT + 0.04, cz);
  prep.receiveShadow = true;
  scene.add(prep);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.95 });
  [
    [width + 0.35, 0.05, 0.16, 0, depth / 2 + 0.12],
    [width + 0.35, 0.05, 0.16, 0, -depth / 2 - 0.12],
    [0.16, 0.05, depth + 0.35, width / 2 + 0.12, 0],
    [0.16, 0.05, depth + 0.35, -width / 2 - 0.12, 0],
  ].forEach(([w, h, d, ox, oz]) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
    edge.position.set(cx + ox, yT + 0.075, cz + oz);
    edge.receiveShadow = true;
    scene.add(edge);
  });
  // Furrow lines (parallel darker grooves showing tilled rows)
  const furrowMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });
  const furrowRows = Math.max(3, Math.floor(depth));
  for (let r = 0; r < furrowRows; r++) {
    const fz = cz - depth / 2 + 0.3 + r * ((depth - 0.6) / Math.max(1, furrowRows - 1));
    const furrow = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.4, 0.02, 0.06), furrowMat
    );
    furrow.position.set(cx, yT + 0.08, fz);
    scene.add(furrow);
  }
  // Rows of saplings — small thin trunks with tiny canopies
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xc8e6c9, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 });
  const mulchMat = new THREE.MeshStandardMaterial({
    color: 0x795548,
    transparent: true,
    opacity: 0.88,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const dripMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  const greens = [0x66bb6a, 0x81c784, 0x4caf50, 0x8bc34a];
  const rows = furrowRows;
  const cols = Math.max(6, Math.floor(width * 1.15));
  for (let r = 0; r < rows; r++) {
    const sz = cz - depth / 2 + 0.5 + r * ((depth - 1) / Math.max(1, rows - 1));
    const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, width - 0.8, 6), dripMat);
    drip.position.set(cx, yT + 0.125, sz + 0.1);
    drip.rotation.z = Math.PI / 2;
    scene.add(drip);
    for (let c = 0; c < cols; c++) {
      const sx = cx - width / 2 + 0.5 + c * ((width - 1) / Math.max(1, cols - 1))
                 + (Math.random() - 0.5) * 0.12;
      // Skip a few — not every spot has a sapling
      if (Math.random() < 0.1) continue;
      const mulch = new THREE.Mesh(new THREE.CircleGeometry(0.18, 14), mulchMat);
      mulch.rotation.x = -Math.PI / 2;
      mulch.position.set(sx, yT + 0.12, sz);
      scene.add(mulch);
      // Small trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 0.4 + Math.random() * 0.15, 5),
        trunkMat
      );
      trunk.position.set(sx, yT + 0.24, sz);
      scene.add(trunk);
      // Tiny canopy (varied size for age variation)
      const canopySize = 0.10 + Math.random() * 0.07;
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(canopySize, 8, 6),
        new THREE.MeshStandardMaterial({
          color: greens[Math.floor(Math.random() * greens.length)],
          roughness: 0.85, flatShading: true,
        })
      );
      canopy.position.set(sx, yT + 0.5 + Math.random() * 0.08, sz);
      canopy.castShadow = true;
      scene.add(canopy);
      // Protective tube around ~50% of saplings (real reforestation practice)
      if (Math.random() < 0.55) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 0.38, 10, 1, true),
          tubeMat
        );
        tube.position.set(sx, yT + 0.22, sz);
        scene.add(tube);
      }
      // Wooden support stake leaning slightly
      const stake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.55, 4),
        stakeMat
      );
      stake.position.set(sx + 0.09, yT + 0.32, sz);
      stake.rotation.z = -0.08;
      scene.add(stake);
    }
  }
  // A few older saplings showing they have been growing — taller trees
  for (let i = 0; i < 7; i++) {
    const ox = cx + (Math.random() - 0.5) * (width - 0.8);
    const oz = cz + (Math.random() - 0.5) * (depth - 0.8);
    if (Math.random() < 0.55) makeTree(ox, oz, 0.38 + Math.random() * 0.24);
    else makeDeciduousTree(ox, oz, 0.34 + Math.random() * 0.2);
  }
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  const fenceSpots = [
    [-width / 2 - 0.25, -depth / 2 - 0.25], [0, -depth / 2 - 0.25], [width / 2 + 0.25, -depth / 2 - 0.25],
    [-width / 2 - 0.25, depth / 2 + 0.25], [0, depth / 2 + 0.25], [width / 2 + 0.25, depth / 2 + 0.25],
    [-width / 2 - 0.25, 0], [width / 2 + 0.25, 0],
  ];
  fenceSpots.forEach(([ox, oz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.6, 5), fenceMat);
    post.position.set(cx + ox, yT + 0.32, cz + oz);
    post.castShadow = true;
    scene.add(post);
  });
  [
    [0, -depth / 2 - 0.25, width + 0.5, 0],
    [0, depth / 2 + 0.25, width + 0.5, 0],
    [-width / 2 - 0.25, 0, depth + 0.5, Math.PI / 2],
    [width / 2 + 0.25, 0, depth + 0.5, Math.PI / 2],
  ].forEach(([ox, oz, len, rot]) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 5), fenceMat);
    rail.position.set(cx + ox, yT + 0.43, cz + oz);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = rot;
    scene.add(rail);
  });
  const nursery = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.08, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 })
  );
  nursery.position.set(cx + width * 0.32, yT + 0.12, cz + depth * 0.36);
  nursery.receiveShadow = true;
  scene.add(nursery);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      const seed = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.22, 5),
        new THREE.MeshStandardMaterial({ color: greens[(r + c) % greens.length], roughness: 0.9 })
      );
      seed.position.set(
        cx + width * 0.32 - 0.42 + c * 0.21,
        yT + 0.25,
        cz + depth * 0.36 - 0.18 + r * 0.28
      );
      scene.add(seed);
    }
  }
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.55, 16),
    new THREE.MeshStandardMaterial({
      color: 0x90caf9,
      emissive: 0x1565c0,
      emissiveIntensity: 0.15,
      roughness: 0.35,
    })
  );
  tank.position.set(cx - width * 0.42, yT + 0.34, cz + depth * 0.35);
  tank.castShadow = true;
  scene.add(tank);
  const tankHose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.15, 6), dripMat);
  tankHose.position.set(cx - width * 0.28, yT + 0.14, cz + depth * 0.25);
  tankHose.rotation.z = Math.PI / 2;
  tankHose.rotation.y = -0.35;
  scene.add(tankHose);
  // Wheelbarrow / shovel hint at one corner (small dark cylinder)
  const tool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.75, 5),
    stakeMat
  );
  tool.position.set(cx - width * 0.42, yT + 0.4, cz + depth * 0.42);
  tool.rotation.z = 0.6;
  scene.add(tool);
  // A small "newly planted" sign
  const signPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4), stakeMat
  );
  signPost.position.set(cx - width * 0.42, yT + 0.27, cz - depth * 0.42);
  scene.add(signPost);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x4caf50, emissive: 0x2e7d32, emissiveIntensity: 0.4,
    })
  );
  signBoard.position.set(cx - width * 0.42, yT + 0.5, cz - depth * 0.42);
  scene.add(signBoard);
}
// Right beside the deforestation patch — recovery counterpoint
buildAfforestation(8, -15.5, 6.2, 5.4);

// ---------- SOIL EROSION DEMO ----------
// Without vegetation, bare slopes are scoured by runoff into gullies, and
// the loosened soil washes into nearby water as a sediment plume. Compare
// this against the Tied Ridges / agroforestry terrace and the ponds — the
// nature-based solutions that keep water in place and prevent erosion.
function buildErosionDemo(stripCx, stripCz, stripWidth = 5) {
  // Erosion gullies — thin elongated dark trenches running downslope (south)
  const gullyMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723, roughness: 1,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x261812, roughness: 1,
  });
  const yT = sampleTerrainY(stripCx, stripCz);
  const gullyCount = Math.max(4, Math.floor(stripWidth));
  const gullySpacing = (stripWidth - 0.6) / Math.max(1, gullyCount - 1);
  // Build a single gully with raised banks on either side framing a dark
  // recess — that read clearly as a HOLE cut into the bare soil.
  const lightBankMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 1 });
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 1 });
  const muddyWaterMat = new THREE.MeshStandardMaterial({
    color: 0x5d4037, emissive: 0x3e2723, emissiveIntensity: 0.3, roughness: 0.5,
  });

  // Gully depressions are now carved INTO the dirt PlaneGeometry inside
  // buildDeforestation(...) — see vertex displacement there. We just add
  // a thin pool of muddy water at the bottom of the big central gully
  // so the deepest point reads as having collected runoff.
  const yDirt = yT + 0.10;
  const muddyWater = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.02, stripWidth * 0.55), muddyWaterMat
  );
  muddyWater.position.set(stripCx, yDirt - 0.15, stripCz);
  muddyWater.rotation.y = Math.PI / 2; // align with z-axis
  scene.add(muddyWater);
  // Branching rills feeding the main gullies, like small erosion scars.
  for (let i = 0; i < 12; i++) {
    const gx = stripCx - 5.2 + Math.random() * 10.4;
    const gz = stripCz - 0.9 + Math.random() * 1.5;
    const branch = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.045, 1.15 + Math.random() * 0.8),
      innerMat
    );
    branch.position.set(gx, sampleTerrainY(gx, gz) + 0.19, gz);
    branch.rotation.y = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.35);
    scene.add(branch);
  }
  // Thin muddy runoff streaks flowing out of the eroded bare-soil strip.
  const runoffMat = new THREE.MeshStandardMaterial({
    color: 0xa66a3f,
    emissive: 0x6d4c41,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.82,
    roughness: 0.7,
  });
  for (let i = 0; i < 7; i++) {
    const sx = stripCx - 4.5 + i * 1.5;
    const stream = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 3.2), runoffMat);
    stream.position.set(sx, sampleTerrainY(sx, stripCz + 1.8) + 0.13, stripCz + 1.8);
    stream.rotation.y = (Math.random() - 0.5) * 0.25;
    scene.add(stream);
  }
  // Sediment fan — a darker brown wedge spreading southward from the strip
  const fanMat = new THREE.MeshStandardMaterial({
    color: 0x6d4c41, transparent: true, opacity: 0.75, roughness: 1,
  });
  for (let i = 0; i < 5; i++) {
    const fanX = stripCx - 4 + i * 2;
    const fan = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 4.5), fanMat
    );
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(fanX, sampleTerrainY(fanX, stripCz + 3) + 0.04, stripCz + 3);
    scene.add(fan);
  }
  // Small "splash" of muddy water where the sediment fan meets the river
  const muddySplash = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8d6e63, transparent: true, opacity: 0.85,
      emissive: 0x6d4c41, emissiveIntensity: 0.2, roughness: 0.5,
    })
  );
  muddySplash.rotation.x = -Math.PI / 2;
  muddySplash.position.set(stripCx, 0.20, stripCz + 5.2);
  scene.add(muddySplash);
  const plume = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0xb9834f,
      emissive: 0x8d6e63,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.55,
      roughness: 0.6,
      side: THREE.DoubleSide,
    })
  );
  plume.rotation.x = -Math.PI / 2;
  plume.rotation.z = 0.2;
  plume.position.set(stripCx + 1.6, 0.24, stripCz + 5.9);
  scene.add(plume);
}
// (Erosion demo function kept for reference but not called.)

// ---------- EROSION vs EROSION-CONTROL DEMO ----------
// A side-by-side comparison patch placed between the school riparian
// zone and the tied-ridges terrace, so visitors can read "what happens
// without NBS" right next to "what NBS does about it".
function buildEvsECDemo(cx, cz) {
  const yT = sampleTerrainY(cx, cz);
  // ---- LEFT (west): EROSION — gully as a real HOLE in the ground ----
  // We use THREE.Shape with a hole path so the soil pad has an actual
  // rectangular CUTOUT. A dark plane sits recessed below that cutout, so
  // looking down through the hole you see darkness — a real hole effect.
  const ePadX = cx - 1.2;
  const erodedSoilMat = new THREE.MeshStandardMaterial({
    color: 0x6d4c41, roughness: 1, side: THREE.DoubleSide,
  });
  const darkSoilMat   = new THREE.MeshStandardMaterial({ color: 0x1b1410, roughness: 1 });
  const innerWallMat  = new THREE.MeshStandardMaterial({
    color: 0x3e2723, roughness: 1, side: THREE.DoubleSide,
  });

  // Build the pad as a circle with a rectangular hole cut through it
  const padR = 1.10;
  const holeHalfW = 0.20;   // gully half-width (x)
  const holeHalfL = 0.85;   // gully half-length (z)
  const padShape = new THREE.Shape();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = Math.cos(a) * padR;
    const z = Math.sin(a) * padR;
    if (i === 0) padShape.moveTo(x, z); else padShape.lineTo(x, z);
  }
  const holePath = new THREE.Path();
  holePath.moveTo(-holeHalfW, -holeHalfL);
  holePath.lineTo( holeHalfW, -holeHalfL);
  holePath.lineTo( holeHalfW,  holeHalfL);
  holePath.lineTo(-holeHalfW,  holeHalfL);
  holePath.lineTo(-holeHalfW, -holeHalfL);
  padShape.holes.push(holePath);
  const padGeo = new THREE.ShapeGeometry(padShape);
  const erosionPad = new THREE.Mesh(padGeo, erodedSoilMat);
  erosionPad.rotation.x = -Math.PI / 2;
  erosionPad.position.set(ePadX, yT + 0.06, cz);
  erosionPad.receiveShadow = true;
  scene.add(erosionPad);

  // Inner walls of the hole — 4 vertical planes lining the cutout, going
  // DOWN from the pad surface. Visible through the hole as the gully sides.
  const wallDepth = 0.45;
  const wallYCenter = yT + 0.06 - wallDepth / 2;
  // North + South end walls (along x-axis)
  [-holeHalfL, holeHalfL].forEach(dz => {
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(holeHalfW * 2, wallDepth),
      innerWallMat
    );
    w.position.set(ePadX, wallYCenter, cz + dz);
    if (dz > 0) w.rotation.y = Math.PI;
    scene.add(w);
  });
  // East + West side walls (along z-axis)
  [-holeHalfW, holeHalfW].forEach(dx => {
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(holeHalfL * 2, wallDepth),
      innerWallMat
    );
    w.rotation.y = Math.PI / 2;
    w.position.set(ePadX + dx, wallYCenter, cz);
    if (dx > 0) w.rotation.y = -Math.PI / 2;
    scene.add(w);
  });
  // Dark bottom of the hole — visibly recessed
  const holeBottom = new THREE.Mesh(
    new THREE.PlaneGeometry(holeHalfW * 2 - 0.01, holeHalfL * 2 - 0.01),
    darkSoilMat
  );
  holeBottom.rotation.x = -Math.PI / 2;
  holeBottom.position.set(ePadX, yT + 0.06 - wallDepth + 0.005, cz);
  scene.add(holeBottom);

  // Small crumbled-soil debris pile spilling out at the downstream end
  for (let i = 0; i < 3; i++) {
    const debris = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + Math.random() * 0.05, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
    );
    debris.position.set(ePadX - 0.15 + i * 0.15, yT + 0.10, cz + 0.95);
    scene.add(debris);
  }
  // Muddy puddle just south of the hole's outlet
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshStandardMaterial({
      color: 0x8d6e63, emissive: 0x5d4037, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.88, roughness: 0.5,
    })
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(ePadX, yT + 0.075, cz + 1.25);
  scene.add(puddle);

  // ---- RIGHT (east): EROSION CONTROL — contour bunds + grass strips ----
  const cPadX = cx + 1.2;
  const healthyMat = new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 0.85 });
  const bundMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 1 });
  const mulchMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 1 });
  // Healthy green ground pad
  const controlPad = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 24),
    healthyMat
  );
  controlPad.rotation.x = -Math.PI / 2;
  controlPad.position.set(cPadX, yT + 0.06, cz);
  controlPad.receiveShadow = true;
  scene.add(controlPad);
  // Three contour bunds (small earthen ridges across the slope, perpendicular
  // to runoff direction) — these trap water so it infiltrates instead of running off
  for (let i = 0; i < 3; i++) {
    const bundZ = cz - 0.7 + i * 0.7;
    const bund = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.18, 0.18),
      bundMat
    );
    bund.position.set(cPadX, yT + 0.16, bundZ);
    bund.castShadow = true;
    scene.add(bund);
    // Mulch strip just upstream of each bund
    const mulch = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.03, 0.18),
      mulchMat
    );
    mulch.position.set(cPadX, yT + 0.09, bundZ - 0.20);
    scene.add(mulch);
  }
  // Grass tufts scattered between the bunds
  for (let i = 0; i < 14; i++) {
    const gx = cPadX - 0.9 + Math.random() * 1.8;
    const gz = cz - 0.95 + Math.random() * 1.9;
    _tallGrassMaker(gx, gz);
  }
  // Two small saplings on the controlled side
  makeTree(cPadX - 0.75, cz - 0.95, 0.45);
  makeTree(cPadX + 0.85, cz + 0.85, 0.45);
}
// Tucked just west of the agroforestry terrace, between the tied-ridges
// middle tier (z≈7) and the forage-grass bottom tier (z≈9.4) — so the
// "without NBS / with NBS" comparison sits right beside its solutions.
function buildVisibleErosionGullyHole(cx, cz) {
  const yT = sampleTerrainY(cx, cz);
  const exposedSoilMat = new THREE.MeshStandardMaterial({
    color: 0xa86535,
    emissive: 0x1d0c03,
    emissiveIntensity: 0.08,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const bottomMat = new THREE.MeshStandardMaterial({
    color: 0x2b1309,
    emissive: 0x080201,
    emissiveIntensity: 0.12,
    roughness: 1,
  });
  const deepMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 1,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x6b351b,
    transparent: true,
    opacity: 0.92,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const deepWallMat = new THREE.MeshStandardMaterial({
    color: 0x210d06,
    roughness: 1,
    side: THREE.DoubleSide,
  });

  const dx = 0.65;
  const dz = 0.65;
  const tangentX = new THREE.Vector3(dx * 2, sampleTerrainY(cx + dx, cz) - sampleTerrainY(cx - dx, cz), 0);
  const tangentZ = new THREE.Vector3(0, sampleTerrainY(cx, cz + dz) - sampleTerrainY(cx, cz - dz), dz * 2);
  const terrainNormal = new THREE.Vector3().crossVectors(tangentZ, tangentX).normalize();
  if (terrainNormal.y < 0) terrainNormal.negate();
  const slopeQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), terrainNormal);

  const makeSlopeCircle = (radius, material, yOffset, scaleX, scaleZ) => {
    const geometry = new THREE.CircleGeometry(radius, 64);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cx, yT + yOffset, cz);
    mesh.quaternion.copy(slopeQuat);
    mesh.scale.set(scaleX, 1, scaleZ);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const depth = 1.05;
  const pitWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 0.42, depth, 64, 1, true),
    deepWallMat
  );
  pitWall.quaternion.copy(slopeQuat);
  pitWall.scale.set(1.25, 1, 1.55);
  pitWall.position.set(cx, yT + 0.11 - terrainNormal.y * depth * 0.5, cz);
  pitWall.castShadow = true;
  pitWall.receiveShadow = true;
  scene.add(pitWall);

  makeSlopeCircle(1.26, exposedSoilMat, 0.088, 1.32, 1.62);
  makeSlopeCircle(1.04, wallMat, 0.102, 1.2, 1.48);
  makeSlopeCircle(0.76, bottomMat, 0.122, 1.08, 1.36);
  makeSlopeCircle(0.38, deepMat, 0.15, 0.9, 1.16);
}
function buildVisibleErosionControlPatch(cx, cz) {
  const yT = sampleTerrainY(cx, cz);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.85 });
  const darkGrassMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.9 });
  const bundMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 1 });
  const mulchMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 1 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    emissive: 0x0277bd,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.82,
    roughness: 0.35,
  });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 2.8), grassMat);
  pad.position.set(cx, yT + 0.055, cz);
  pad.receiveShadow = true;
  scene.add(pad);

  for (let i = 0; i < 4; i++) {
    const z = cz - 1.05 + i * 0.68;
    const bund = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.15, 0.18), bundMat);
    bund.position.set(cx, yT + 0.18, z);
    bund.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.04;
    bund.castShadow = true;
    scene.add(bund);
    const mulch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.14), mulchMat);
    mulch.position.set(cx, yT + 0.115, z - 0.17);
    scene.add(mulch);

    const swale = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.03, 0.1), waterMat);
    swale.position.set(cx, yT + 0.13, z + 0.15);
    scene.add(swale);
  }

  for (let i = 0; i < 24; i++) {
    const gx = cx - 1.15 + Math.random() * 2.3;
    const gz = cz - 1.25 + Math.random() * 2.5;
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.07 + Math.random() * 0.035, 0.42 + Math.random() * 0.28, 5),
      Math.random() < 0.45 ? darkGrassMat : grassMat
    );
    tuft.position.set(gx, sampleTerrainY(gx, gz) + 0.28, gz);
    scene.add(tuft);
  }

  for (let row = 0; row < 2; row++) {
    const z = cz + 0.85 + row * 0.32;
    for (let i = 0; i < 5; i++) {
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.045, 8, 6), stoneMat);
      stone.position.set(cx - 0.9 + i * 0.45, yT + 0.15, z + (Math.random() - 0.5) * 0.06);
      stone.scale.set(1.25, 0.55, 1);
      stone.castShadow = true;
      scene.add(stone);
    }
  }

  makeTree(cx - 0.95, cz - 1.05, 0.35);
}
// Both sit on the deforested mountain slope: gully shows the damage, control
// patch (contour bunds + mulch + grass tufts) sits just downslope to show
// what the same rainfall does when the land is protected.
buildVisibleErosionGullyHole(12, -8);
buildVisibleErosionControlPatch(12, -4.2);

// ---------- INUNDATION / FLOODING ZONE ----------
// Shows where river water has overflowed its banks onto the surrounding
// land, with floating debris and partially submerged vegetation.
function buildFlooding(cx, cz, width = 5, depth = 3) {
  const yT = sampleTerrainY(cx, cz);
  // Radial alpha-gradient texture so the flood water fades into the grass
  // at the edges instead of showing a hard rectangular boundary.
  const alphaCv = document.createElement('canvas');
  alphaCv.width = 128; alphaCv.height = 128;
  const actx = alphaCv.getContext('2d');
  const aGrad = actx.createRadialGradient(64, 64, 20, 64, 64, 62);
  aGrad.addColorStop(0,    '#ffffff');
  aGrad.addColorStop(0.55, '#dddddd');
  aGrad.addColorStop(0.85, '#555555');
  aGrad.addColorStop(1,    '#000000');
  actx.fillStyle = aGrad;
  actx.fillRect(0, 0, 128, 128);
  // Slight noise distortion of the edge so it doesn't read as a circle either
  actx.globalCompositeOperation = 'destination-in';
  actx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const r = 60 + Math.sin(a * 3) * 6 + Math.cos(a * 5) * 5;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    if (a === 0) actx.moveTo(x, y); else actx.lineTo(x, y);
  }
  actx.closePath();
  actx.fillStyle = '#ffffff';
  actx.fill();
  actx.globalCompositeOperation = 'source-over';
  const floodAlpha = new THREE.CanvasTexture(alphaCv);

  // Flood-water surface — slightly turbid, semi-transparent
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth, 24, 14),
    new THREE.MeshStandardMaterial({
      color: 0x4a7c98,
      emissive: 0x29638a,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.05,
      transparent: true,
      alphaMap: floodAlpha,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, yT + 0.20, cz);
  water.receiveShadow = true;
  scene.add(water);
  // Floating debris (small flat planks)
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 });
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 + Math.random() * 0.25, 0.04, 0.08),
      debrisMat
    );
    d.position.set(
      cx + (Math.random() - 0.5) * width * 0.85,
      yT + 0.235,
      cz + (Math.random() - 0.5) * depth * 0.85
    );
    d.rotation.y = Math.random() * Math.PI * 2;
    d.castShadow = true;
    scene.add(d);
  }
  // Partially submerged grass tufts (tips poke above water)
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.35, 5),
      tuftMat
    );
    tuft.position.set(
      cx + (Math.random() - 0.5) * width * 0.8,
      yT + 0.32,
      cz + (Math.random() - 0.5) * depth * 0.8
    );
    scene.add(tuft);
  }
  // A couple of half-sunken reeds
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5),
      reedMat
    );
    reed.position.set(
      cx + (Math.random() - 0.5) * width * 0.75,
      yT + 0.45,
      cz + (Math.random() - 0.5) * depth * 0.75
    );
    reed.rotation.z = (Math.random() - 0.5) * 0.4;
    scene.add(reed);
  }
}
// Flooded zone south of the river meander, where water would naturally back up
buildFlooding(-1, -3.5, 5.5, 3);

function buildErosionHole(x, z, radius = 0.9) {
  const y = sampleTerrainY(x, z);
  const pit = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.55, 0.45, 28),
    new THREE.MeshStandardMaterial({ color: 0x1b100b, roughness: 1 })
  );
  pit.position.set(x, y + 0.08, z);
  pit.scale.y = 0.35;
  pit.receiveShadow = true;
  scene.add(pit);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, 0.12, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xb36b35, roughness: 1 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, y + 0.27, z);
  scene.add(rim);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.62, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, y + 0.29, z);
  scene.add(shadow);
}

function buildLargeGully(x, z, length = 4.4) {
  const y = sampleTerrainY(x, z);
  const group = new THREE.Group();
  const cutMat = new THREE.MeshStandardMaterial({ color: 0x140b07, roughness: 1 });
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xb36b35, roughness: 1 });
  const dampMat = new THREE.MeshStandardMaterial({
    color: 0x6d4c41,
    emissive: 0x3e2723,
    emissiveIntensity: 0.18,
    roughness: 0.85,
  });

  const cut = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, length), cutMat);
  cut.position.y = 0.04;
  group.add(cut);

  [-1, 1].forEach(side => {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, length * 0.95), bankMat);
    bank.position.set(side * 0.53, 0.14, 0);
    bank.rotation.z = side * 0.28;
    bank.castShadow = true;
    group.add(bank);
  });

  const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.05, 18), cutMat);
  mouth.position.set(0, 0.05, length * 0.48);
  mouth.rotation.x = Math.PI / 2;
  mouth.scale.set(1.3, 0.7, 1);
  group.add(mouth);

  const wetLine = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, length * 0.82), dampMat);
  wetLine.position.y = 0.18;
  group.add(wetLine);

  group.position.set(x, y + 0.24, z);
  group.rotation.y = -0.08;
  scene.add(group);
}

// Riverbank tree clusters — placed FAR from the river path (3+ units
// perpendicular offset) so trees don't sit on the water.
makeTreeCluster(8.5,  6.0,  4, 1.0, 0.45, 0.75);  // north of bend 1
makeTreeCluster(5.5, -5.5,  4, 1.0, 0.45, 0.75);  // south of bend 2
makeTreeCluster(2.5,  6.0,  4, 1.0, 0.45, 0.75);  // north of bend 3
makeTreeCluster(-0.5,-5.5,  4, 1.0, 0.45, 0.75);  // south of bend 4
makeTreeCluster(-3.5, 5.8,  4, 1.0, 0.45, 0.75);  // north of bend 5
makeTreeCluster(-9.0, 3.0,  4, 1.0, 0.45, 0.75);  // between bend 6 and mouth

// ---------- RIPARIAN UNDERSTORY ----------
// Layered riverside vegetation: tall reeds at the inner edge (closer to
// the water), low shrubs / sedge clumps around them, scattered wildflowers,
// and the occasional fallen log to evoke root systems holding the bank.
function buildRiparianClump(cx, cz, radius = 1.4) {
  const reedColors = [0x7cb342, 0x8bc34a, 0x9ccc65];
  for (let i = 0; i < 9; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.55;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.55 + Math.random() * 0.3, 4),
      new THREE.MeshStandardMaterial({
        color: reedColors[Math.floor(Math.random() * reedColors.length)],
        roughness: 0.85,
      })
    );
    reed.position.set(x, sampleTerrainY(x, z) + 0.32, z);
    reed.rotation.z = (Math.random() - 0.5) * 0.18;
    reed.castShadow = true;
    scene.add(reed);
  }
  const shrubColors = [0x388e3c, 0x2e7d32, 0x558b2f, 0x4caf50];
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * radius;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const shrub = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + Math.random() * 0.14, 10, 7),
      new THREE.MeshStandardMaterial({
        color: shrubColors[Math.floor(Math.random() * shrubColors.length)],
        roughness: 0.9, flatShading: true,
      })
    );
    shrub.position.set(x, sampleTerrainY(x, z) + 0.16, z);
    shrub.scale.set(1, 0.65, 1);
    shrub.castShadow = true;
    scene.add(shrub);
  }
  const flowerColors = [0xfff176, 0xef5350, 0xab47bc, 0xffffff, 0xff7043, 0xffeb3b];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 1.3;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const c = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 5),
      new THREE.MeshStandardMaterial({
        color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.5,
      })
    );
    flower.position.set(x, sampleTerrainY(x, z) + 0.1, z);
    scene.add(flower);
  }
  // A couple of exposed roots / fallen sticks for bank-stability narrative
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * radius * 0.7;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const root = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.7 + Math.random() * 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
    );
    root.position.set(x, sampleTerrainY(x, z) + 0.08, z);
    root.rotation.z = Math.PI / 2;
    root.rotation.y = Math.random() * Math.PI;
    root.castShadow = true;
    scene.add(root);
  }
}
[
  [8.5,  5.5], [5.5, -4.5], [2.5,  5.5],
  [-0.5, -4.5], [-3.5, 5.0], [-9.0, 2.5],
  // Extra clumps right at the water's edge for density
  [7.0,  4.2], [4.0, -3.8], [-2.0, 4.4], [-5.0, -3.5], [-7.5, 1.7],
].forEach(p => buildRiparianClump(p[0], p[1], 1.3));

// ---------- RIPARIAN STRIP — continuous, follows the river curve ----------
function _cattailMaker(x, z) {
  const yT = sampleTerrainY(x, z);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x689f38, roughness: 0.85 })
  );
  stem.position.set(x, yT + 0.45, z);
  stem.castShadow = true;
  scene.add(stem);
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.18, 7),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
  );
  head.position.set(x, yT + 0.78, z);
  scene.add(head);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.02, 0.08, 4),
    new THREE.MeshStandardMaterial({ color: 0x9ccc65 })
  );
  tip.position.set(x, yT + 0.92, z);
  scene.add(tip);
}
function _tallGrassMaker(x, z) {
  const yT = sampleTerrainY(x, z);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: Math.random() < 0.5 ? 0x9ccc65 : 0xaed581,
    side: THREE.DoubleSide, roughness: 0.85,
  });
  const cnt = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < cnt; i++) {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.42 + Math.random() * 0.15), bladeMat
    );
    blade.position.set(
      x + (Math.random() - 0.5) * 0.12,
      yT + 0.21 + (Math.random() - 0.5) * 0.05,
      z + (Math.random() - 0.5) * 0.12
    );
    blade.rotation.y = Math.random() * Math.PI;
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    scene.add(blade);
  }
}
function _flowerClusterMaker(x, z) {
  const yT = sampleTerrainY(x, z);
  const palettes = [
    [0xfff176, 0xfbc02d],
    [0xef5350, 0xc62828],
    [0xab47bc, 0x7b1fa2],
    [0xffffff, 0xeeeeee],
    [0xff7043, 0xe64a19],
  ];
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  for (let i = 0; i < 4; i++) {
    const off = { x: (Math.random() - 0.5) * 0.18, z: (Math.random() - 0.5) * 0.18 };
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4),
      new THREE.MeshStandardMaterial({ color: 0x558b2f })
    );
    stem.position.set(x + off.x, yT + 0.18, z + off.z);
    scene.add(stem);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 5),
      new THREE.MeshStandardMaterial({
        color: palette[0], emissive: palette[1], emissiveIntensity: 0.5,
        roughness: 0.55,
      })
    );
    head.position.set(x + off.x, yT + 0.28, z + off.z);
    head.scale.set(1, 0.35, 1);
    scene.add(head);
  }
}
function _mossPatchMaker(x, z) {
  const yT = sampleTerrainY(x, z);
  const moss = new THREE.Mesh(
    new THREE.CircleGeometry(0.35 + Math.random() * 0.2, 12),
    new THREE.MeshStandardMaterial({
      color: 0x33691e, roughness: 1, side: THREE.DoubleSide,
    })
  );
  moss.rotation.x = -Math.PI / 2;
  moss.position.set(x, yT + 0.05, z);
  scene.add(moss);
}

function buildRiparianStrip(controlPoints, side, baseOffset = 1.5, density = 32) {
  const v3pts = controlPoints.map(p => new THREE.Vector3(p[0], 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(v3pts, false, 'centripetal');
  for (let i = 0; i <= density; i++) {
    const t = i / density;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t); tan.y = 0; tan.normalize();
    const normal = new THREE.Vector3(-tan.z, 0, tan.x);
    for (let k = 0; k < 2; k++) {
      const off = baseOffset + Math.random() * 1.0;
      const px = p.x + normal.x * side * off + (Math.random() - 0.5) * 0.3;
      const pz = p.z + normal.z * side * off + (Math.random() - 0.5) * 0.3;
      const y = sampleTerrainY(px, pz);
      if (y < 0.1 || y > 3) continue;
      const r = Math.random();
      if      (r < 0.30) _cattailMaker(px, pz);
      else if (r < 0.62) _tallGrassMaker(px, pz);
      else if (r < 0.82) _flowerClusterMaker(px, pz);
      else               _mossPatchMaker(px, pz);
    }
  }
}
const _ripPath = [
  [9.5, -1.5], [9.0,  1.2], [8.5,  3.0], [7.0,  1.5], [5.5, -2.0], [4.0,  0.5],
  [2.5,  3.0], [1.0,  0.5], [-0.5,-2.0], [-2.0, 0.5], [-3.5, 2.8],
  [-5.0, 0.5], [-6.5,-2.0], [-8.0, 0.0], [-10.0, 1.2], [-12.5,-0.4],
  [-15.0,-1.0],
];
buildRiparianStrip(_ripPath,  1, 1.4, 36);   // north bank
buildRiparianStrip(_ripPath, -1, 1.4, 36);   // south bank

// ---------- HEADWATER SPRINGS ----------
// Real streams begin where groundwater discharges at the surface (a "spring"),
// or where snowmelt / saturated wetlands seep out. Each river origin gets a
// small stone-rimmed pool, mossy boulders, and a few cattails — hydrologically
// the correct "first-order stream" headwater look.
function buildSpring(cx, cz, opts = {}) {
  const yT = sampleTerrainY(cx, cz);
  const poolRadius = opts.radius || 0.85;
  // Pool of water emerging at the surface
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(poolRadius, 22),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.5,
      roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(cx, yT + 0.18, cz);
  pool.receiveShadow = true;
  scene.add(pool);
  // Bright ripple ring suggesting water bubbling up from the spring
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(poolRadius * 0.35, poolRadius * 0.5, 18),
    new THREE.MeshStandardMaterial({
      color: 0xb3e5fc, emissive: 0x4fc3f7, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    })
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(cx, yT + 0.19, cz);
  scene.add(ripple);
  // Boulder ring framing the pool
  const stoneColors = [0x607d8b, 0x546e7a, 0x78909c, 0x455a64];
  const boulderCount = 7;
  for (let i = 0; i < boulderCount; i++) {
    const ang = (i / boulderCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const r = poolRadius + 0.1 + Math.random() * 0.15;
    const size = 0.16 + Math.random() * 0.14;
    const stone = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 6),
      new THREE.MeshStandardMaterial({
        color: stoneColors[Math.floor(Math.random() * stoneColors.length)],
        roughness: 1, flatShading: true,
      })
    );
    stone.position.set(
      cx + Math.cos(ang) * r,
      yT + 0.18 + size * 0.5,
      cz + Math.sin(ang) * r
    );
    stone.scale.set(1.1, 0.7 + Math.random() * 0.2, 1.0);
    stone.rotation.y = Math.random() * Math.PI;
    stone.castShadow = true;
    scene.add(stone);
  }
  // Mossy caps on some stones
  for (let i = 0; i < 4; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = poolRadius + 0.1;
    const moss = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x33691e, roughness: 1 })
    );
    moss.position.set(
      cx + Math.cos(ang) * r,
      yT + 0.30,
      cz + Math.sin(ang) * r
    );
    moss.scale.set(1, 0.4, 1);
    scene.add(moss);
  }
  // 3 cattails at the pool edge — iconic wetland marker
  for (let i = 0; i < 3; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = poolRadius * 0.7 + Math.random() * 0.2;
    _cattailMaker(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r);
  }
  // Wildflowers for color
  for (let i = 0; i < 2; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = poolRadius + 0.3 + Math.random() * 0.3;
    _flowerClusterMaker(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r);
  }
}

// Main river — spring at the foot of the big mountain, just upstream of
// the main river's first control point (9.5, 0.8).
buildSpring(10.0, -1.2, { radius: 0.95 });
// East tributary spring (under the FROM STREAMS arrow at (22, 3))
// East tributary head spring — co-located with the round pool source at (22, 3)
// so the boulders/cattails frame the round source instead of sitting beside it.
buildSpring(22.0, 3.0, { radius: 0.75 });
// South tributary — saturated wetland seep at its origin
buildSpring(10.5, -15.0, { radius: 0.85 });

function buildRiparianBuffer() {
  const mainRiver = [
    [9.5, -1.5], [9.0, 1.2], [8.5,  3.0], [7.0,  1.5], [5.5, -2.0],
    [4.0,  0.5], [2.5,  3.0], [1.0,  0.5], [-0.5, -2.0],
    [-2.0, 0.5], [-3.5, 2.8], [-5.0, 0.5], [-6.5, -2.0],
    [-8.0, 0.0], [-10.0, 1.2], [-12.5, -0.4], [-15.0, -1.0],
  ];
  const eastTributary = [
    [22, 3], [19, 2.5], [16, 2.0], [13, 1.8], [10, 1.6], [8.5, 1.5], [7, 1.5],
  ];
  const southTributary = [
    [10, -15], [7, -13], [4, -12], [1, -11], [-2, -10], [-5, -8], [-6, -5], [-6.5, -2.0],
  ];

  const bufferMat = new THREE.MeshStandardMaterial({
    color: 0x66bb6a,
    emissive: 0x2e7d32,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.72,
    roughness: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sedgeMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.9 });
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9, flatShading: true });
  const wetSoilMat = new THREE.MeshStandardMaterial({
    color: 0x5d4037,
    transparent: true,
    opacity: 0.62,
    roughness: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 });
  const flowerColors = [0xffeb3b, 0xffffff, 0xff7043, 0xab47bc];

  function plantAt(x, z, side, normal, bankDistance, scale = 1) {
    const bx = x + normal.x * side * bankDistance;
    const bz = z + normal.z * side * bankDistance;
    const y = sampleTerrainY(bx, bz);

    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.12 * scale, 0.55 * scale, 6),
      sedgeMat
    );
    tuft.position.set(bx, y + 0.28 * scale, bz);
    tuft.rotation.z = (Math.random() - 0.5) * 0.25;
    tuft.castShadow = true;
    scene.add(tuft);

    if (Math.random() < 0.7) {
      const sx = bx + normal.x * side * (0.45 + Math.random() * 0.35);
      const sz = bz + normal.z * side * (0.45 + Math.random() * 0.35);
      const shrub = new THREE.Mesh(
        new THREE.SphereGeometry(0.17 + Math.random() * 0.10, 9, 7),
        shrubMat
      );
      shrub.position.set(sx, sampleTerrainY(sx, sz) + 0.14, sz);
      shrub.scale.set(1.15, 0.55, 0.9);
      shrub.castShadow = true;
      scene.add(shrub);
    }

    if (Math.random() < 0.35) {
      const c = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      const fx = bx + (Math.random() - 0.5) * 0.7;
      const fz = bz + (Math.random() - 0.5) * 0.7;
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 5),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.5 })
      );
      flower.position.set(fx, sampleTerrainY(fx, fz) + 0.12, fz);
      scene.add(flower);
    }
  }

  function buildBufferForPath(points, waterHalfWidth, bufferWidth, plantStep = 0.08) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'centripetal'
    );
    const steps = 90;
    const positions = [];
    const uvs = [];
    let prev = null;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t); tan.y = 0; tan.normalize();
      const normal = new THREE.Vector3(-tan.z, 0, tan.x);
      const sidePts = [];
      [-1, 1].forEach(side => {
        const inner = waterHalfWidth + 0.25;
        const outer = waterHalfWidth + bufferWidth;
        const ix = p.x + normal.x * side * inner;
        const iz = p.z + normal.z * side * inner;
        const ox = p.x + normal.x * side * outer;
        const oz = p.z + normal.z * side * outer;
        sidePts.push({
          inner: new THREE.Vector3(ix, sampleTerrainY(ix, iz) + 0.075, iz),
          outer: new THREE.Vector3(ox, sampleTerrainY(ox, oz) + 0.08, oz),
        });
      });

      if (prev) {
        for (let s = 0; s < 2; s++) {
          const a = prev[s].inner, b = prev[s].outer, c = sidePts[s].outer, d = sidePts[s].inner;
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
          uvs.push(0, t - 1 / steps, 1, t - 1 / steps, 1, t, 0, t - 1 / steps, 1, t, 0, t);
        }
      }
      prev = sidePts;

      if (i % Math.max(4, Math.floor(plantStep * steps)) === 0) {
        [-1, 1].forEach(side => {
          plantAt(p.x, p.z, side, normal, waterHalfWidth + 0.52 + Math.random() * 0.45, 0.8 + Math.random() * 0.45);
        });
      }

      if (i % 18 === 8) {
        [-1, 1].forEach(side => {
          const wx = p.x + normal.x * side * (waterHalfWidth + 0.16);
          const wz = p.z + normal.z * side * (waterHalfWidth + 0.16);
          const wet = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), wetSoilMat);
          wet.rotation.x = -Math.PI / 2;
          wet.scale.set(1.5, 0.65, 1);
          wet.rotation.z = Math.random() * Math.PI;
          wet.position.set(wx, sampleTerrainY(wx, wz) + 0.085, wz);
          scene.add(wet);
        });
      }

      if (i % 26 === 12) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const rx = p.x + normal.x * side * (waterHalfWidth + 0.65);
        const rz = p.z + normal.z * side * (waterHalfWidth + 0.65);
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 6), rootMat);
        root.position.set(rx, sampleTerrainY(rx, rz) + 0.11, rz);
        root.rotation.z = Math.PI / 2;
        root.rotation.y = Math.atan2(tan.x, tan.z) + (Math.random() - 0.5) * 0.7;
        root.castShadow = true;
        scene.add(root);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const buffer = new THREE.Mesh(geo, bufferMat);
    buffer.receiveShadow = true;
    buffer.renderOrder = 1.5;
    scene.add(buffer);
  }

  buildBufferForPath(mainRiver, 0.95, 1.35, 0.07);
  buildBufferForPath(eastTributary, 0.55, 1.0, 0.09);
  buildBufferForPath(southTributary, 0.55, 1.0, 0.09);
}
buildRiparianBuffer();

// Trees around the pond/channel network
// (Tree clusters next to the industrial area / dump removed per user request.)
// makeTreeCluster(15, 20, 5, 1.5, 0.5, 0.85);   // was north of industrial
// makeTreeCluster(19, 14, 4, 1.3, 0.5, 0.85);   // was south of industrial
// makeTreeCluster(26, 18, 4, 1.4, 0.5, 0.85);   // was east of industrial dump
makeTreeCluster(26, 13, 4, 1.3, 0.5, 0.85);   // south of FROM LAKES (kept — well clear of industrial)

// ---------- TREES + GRASSES AROUND THE PONDS ----------
// Small clusters framing POND1, POND2 and the LAKE source so the
// nature-based water-storage area reads as a vegetated catchment.
// Each anchor adds a tight tree cluster plus several grass tufts and a
// wildflower clump for a mixed riparian look — not a clean tree-only fringe.
const _pondGreenAnchors = [
  [13.8, 6.5],   // west of POND1
  [16.5, 9.6],   // north of POND1
  [20.4, 9.5],   // north of POND2
  [23.9, 8.8],   // east of POND2
  [26.5, 2.0],   // east of LAKE
  [25.5, -1.4],  // north of LAKE
];
_pondGreenAnchors.forEach(([cx, cz]) => {
  makeTreeCluster(cx, cz, 3, 0.9, 0.45, 0.75);
  // 6 tall-grass tufts jittered around the cluster
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
    const r = 0.6 + Math.random() * 1.1;
    _tallGrassMaker(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r);
  }
  // 1–2 wildflower clusters for splashes of colour
  const flowerCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < flowerCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 0.9;
    _flowerClusterMaker(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r);
  }
});

// Palm cluster along the beach (one row, narrow band along the coastline)
for (let i = 0; i < 6; i++) {
  const x = -14.5 + Math.random() * 2;
  const z = -10 + i * 4 + (Math.random() - 0.5) * 1.5;
  makePalmTree(x, z, 0.95 + Math.random() * 0.35);
}

// ---------- GLTF ASSETS ----------
// Animated cow (CC-BY by Josué Boisvert) + field_garden patch from
// ZoloKiala/hydrological_cycle. Sketchfab gltf exports often use Z-up
// (Blender convention) so we rotate the model child to Y-up, scale it
// to a target height, then offset so its bottom sits at y=0 within the
// wrapper. The wrapper is what we place + spin in world space.
const gltfLoader = new GLTFLoader();

function placeModel(gltf, { worldX, worldZ, targetH, targetSize, yaw = 0, zUp = true }) {
  const wrapper = new THREE.Group();
  const inner = gltf.scene;
  wrapper.add(inner);

  if (zUp) inner.rotation.x = -Math.PI / 2;

  // Scale either by target height or by largest dimension
  let box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  let s;
  if (targetSize) {
    s = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  } else {
    s = targetH / Math.max(size.y, 0.001);
  }
  inner.scale.setScalar(s);

  // Recompute after scaling, then anchor bottom to y=0 inside the wrapper
  box = new THREE.Box3().setFromObject(inner);
  inner.position.y -= box.min.y;

  inner.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  wrapper.position.set(worldX, sampleTerrainY(worldX, worldZ), worldZ);
  wrapper.rotation.y = yaw;
  scene.add(wrapper);
  return wrapper;
}

// Field garden — already Y-up (binary .glb usually is); scale by footprint.
// Loaded twice (rather than cloned) so each instance gets a clean parse —
// Object3D.clone() drops some nested skinned/material refs in this model.
// (field_garden.glb removed — replaced by procedural rice paddies below)


// Procedural village — replaces the Morning Town glTF
function buildHouse(x, z, roofColor, scale = 1, yaw = 0) {
  const g = new THREE.Group();
  // Walls
  const wallColors = [0xfff8e1, 0xefebe9, 0xfafafa, 0xfff3e0];
  const wallColor = wallColors[Math.floor(Math.random() * wallColors.length)];
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.3, 1.4),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95 })
  );
  walls.position.y = 0.65;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);
  // Pyramid roof (4-sided cone)
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.35, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 })
  );
  roof.position.y = 1.75;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x4e342e })
  );
  door.position.set(0, 0.3, 0.72);
  g.add(door);
  // Windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7, emissive: 0x0277bd, emissiveIntensity: 0.3,
    metalness: 0.4, roughness: 0.2,
  });
  [[-0.55, 0.7, 0.72], [0.55, 0.7, 0.72]].forEach(p => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.04), winMat);
    win.position.set(p[0], p[1], p[2]);
    g.add(win);
  });
  // Chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.5, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.95 })
  );
  chimney.position.set(0.5, 1.85, 0.2);
  chimney.castShadow = true;
  g.add(chimney);
  g.position.set(x, sampleTerrainY(x, z), z);
  g.scale.setScalar(scale);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

function buildWaterTower(x, z) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x546e7a, roughness: 0.6, metalness: 0.5,
  });
  // 4 legs splayed slightly outward
  [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]].forEach(p => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), legMat);
    leg.position.set(p[0], 1.0, p[1]);
    // Tilt slightly inward toward top
    const angle = Math.atan2(p[0], p[1]);
    leg.rotation.z = Math.sin(angle) * 0.08;
    leg.rotation.x = Math.cos(angle) * 0.08;
    leg.castShadow = true;
    g.add(leg);
  });
  // Tank
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16),
    new THREE.MeshStandardMaterial({
      color: 0xeceff1, roughness: 0.5, metalness: 0.4,
    })
  );
  tank.position.y = 2.4;
  tank.castShadow = true;
  g.add(tank);
  // Dome cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 })
  );
  cap.position.y = 2.85;
  cap.castShadow = true;
  g.add(cap);
  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  return g;
}

// Village centered around (-7, 12) — replaces the morning_town glTF
const _townCx = -7, _townCz = 12;
const _houses = [
  { dx: -2.2, dz: -1.5, color: 0xc62828, scale: 1.1, yaw:  0.2 },
  { dx:  1.0, dz:  0.0, color: 0x1976d2, scale: 1.2, yaw: -0.3 },
  { dx: -1.0, dz:  2.0, color: 0xf57c00, scale: 1.0, yaw:  0.5 },
  { dx:  2.5, dz:  1.8, color: 0x388e3c, scale: 1.1, yaw:  0.1 },
  { dx: -3.0, dz:  1.2, color: 0x7b1fa2, scale: 1.0, yaw: -0.1 },
  { dx:  0.3, dz:  3.0, color: 0xff5722, scale: 1.1, yaw:  0.4 },
];
_houses.forEach(h => buildHouse(_townCx + h.dx, _townCz + h.dz, h.color, h.scale, h.yaw));
buildWaterTower(_townCx + 3.5, _townCz + 3.5);

// ---------- INDUSTRIAL AREA ----------
function buildFactory(x, z, yaw = 0) {
  const g = new THREE.Group();
  // Main factory building
  const main = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.0, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.85 })
  );
  main.position.y = 1.0; main.castShadow = true; main.receiveShadow = true;
  g.add(main);
  // Sawtooth roof - 3 small peaks
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const peak = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 2.6), roofMat);
    peak.position.set(-1.2 + i * 1.2, 2.2, 0);
    peak.rotation.z = (i % 2 === 0) ? 0.2 : -0.2;
    peak.castShadow = true;
    g.add(peak);
  }
  // Two smokestacks
  const stackMat = new THREE.MeshStandardMaterial({ color: 0x424242, roughness: 0.7 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc62828 });
  [-0.6, 0.6].forEach(dx => {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.8, 12), stackMat);
    stack.position.set(dx, 3.0, 0.7); stack.castShadow = true;
    g.add(stack);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.16, 12), stripeMat);
    stripe.position.set(dx, 3.7, 0.7); g.add(stripe);
  });
  // Window strip on the long wall (front)
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfff59d, emissive: 0xfff176, emissiveIntensity: 0.4,
  });
  for (let i = 0; i < 5; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.05), winMat);
    win.position.set(-1.4 + i * 0.7, 1.3, 1.32);
    g.add(win);
  }
  g.position.set(x, sampleTerrainY(x, z), z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

function buildStorageTank(x, z, color = 0xcfd8dc) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 1.6, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.45 })
  );
  body.position.y = 0.8; body.castShadow = true; g.add(body);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.7 })
  );
  cap.position.y = 1.6; cap.castShadow = true; g.add(cap);
  // A band stripe near base
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.77, 0.77, 0.12, 18),
    new THREE.MeshStandardMaterial({ color: 0xc62828 })
  );
  band.position.y = 0.25; g.add(band);
  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  return g;
}

function buildWarehouse(x, z, yaw = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.4, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.9 })
  );
  body.position.y = 0.7; body.castShadow = true; g.add(body);
  // Curved metal roof (half-cylinder)
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 2.85, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.5, metalness: 0.4 })
  );
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 1.4;
  roof.scale.set(1, 1, 0.95);
  roof.castShadow = true;
  g.add(roof);
  // Big garage-style door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.0, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 })
  );
  door.position.set(0, 0.5, 0.92); g.add(door);
  g.position.set(x, sampleTerrainY(x, z), z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

// Road builder: dark asphalt strip + yellow dashed center line.
function buildRoad(fromX, fromZ, toX, toZ, width = 1.6) {
  const dx = toX - fromX, dz = toZ - fromZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (fromX + toX) / 2, midZ = (fromZ + toZ) / 2;
  const yMid = sampleTerrainY(midX, midZ);

  // Tarmac (very dark, low roughness for slight sheen)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1c1c1c, roughness: 0.75, metalness: 0.05,
  });
  const road = new THREE.Mesh(new THREE.BoxGeometry(length, 0.07, width), roadMat);
  road.position.set(midX, yMid + 0.09, midZ);
  road.rotation.y = -angle;
  road.receiveShadow = true;
  scene.add(road);

  // White solid edge lines on both sides — classic painted lane edges
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xeceff1, emissiveIntensity: 0.15, roughness: 0.6,
  });
  [-1, 1].forEach(side => {
    const off = (width / 2 - 0.08) * side;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.08), edgeMat);
    edge.position.set(
      midX - Math.sin(angle) * off,
      yMid + 0.13,
      midZ + Math.cos(angle) * off
    );
    edge.rotation.y = -angle;
    scene.add(edge);
  });

  // Yellow dashed center line
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xfdd835, emissive: 0xfbc02d, emissiveIntensity: 0.35,
  });
  const dashes = Math.max(3, Math.floor(length / 1.5));
  for (let i = 0; i < dashes; i++) {
    const t = (i + 0.3) / dashes;
    const x = fromX + dx * t, z = fromZ + dz * t;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.13), dashMat);
    dash.position.set(x, sampleTerrainY(x, z) + 0.14, z);
    dash.rotation.y = -angle;
    scene.add(dash);
  }

  // Beige gravel shoulders just outside the white edge lines
  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 1.0 });
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.05, 0.28), shoulderMat
    );
    const off = (width / 2 + 0.16) * side;
    shoulder.position.set(
      midX - Math.sin(angle) * off,
      yMid + 0.07,
      midZ + Math.cos(angle) * off
    );
    shoulder.rotation.y = -angle;
    shoulder.receiveShadow = true;
    scene.add(shoulder);
  });
}

// Main road: village east edge → spur point, then north to NEW industrial at (15, 17)
buildRoad(-4, 13.5, 11, 13.5);          // east-west main road, clear of forage grasses
buildRoad(11, 13.9, 11, 15.5, 1.2);     // short spur connecting to industrial
// Roads around the coastal city cluster (towers at x≈-12, z≈11-15)
buildRoad(-14.5, 10, -14.5, 16, 1.3);   // west avenue (between palms and city)
buildRoad(-9.5,  10, -9.5,  16, 1.3);   // east avenue (between city and village)
buildRoad(-14.5, 16, -9.5,  16);        // north cross-street capping the loop
buildRoad(-9.5, 10, -4, 13.5, 1.35);    // connector from coastal city to main road
buildRoad(11, 15.5, 15, 15.5, 1.25);     // short industrial entrance from main spur
buildRoad(-10.8, -9.4, -9.5, 10, 1.25); // coastal city street link to city road
buildRoad(-7.4, 10.6, -7.2, 7.4, 0.9);  // school access road

// ---------- CARS ----------
function makeCar(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.4, metalness: 0.3,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.5), bodyMat);
  body.position.y = 0.26;
  body.castShadow = true;
  g.add(body);
  // Cabin / roof
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.46), bodyMat);
  cabin.position.set(-0.08, 0.55, 0);
  cabin.castShadow = true;
  g.add(cabin);
  // Window strip (dark glass)
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x263238, metalness: 0.7, roughness: 0.15,
    emissive: 0x1a237e, emissiveIntensity: 0.2,
  });
  const windows = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.48), winMat);
  windows.position.set(-0.08, 0.56, 0);
  g.add(windows);
  // Headlights (front, small white emissive dots)
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff59d, emissive: 0xfff59d, emissiveIntensity: 0.9,
  });
  [[-0.18, 0.27, 0.48], [0.18, 0.27, 0.48]].forEach(() => {});
  [[0.47, 0.28, 0.18], [0.47, 0.28, -0.18]].forEach(p => {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), lightMat);
    hl.position.set(p[0], p[1], p[2]);
    g.add(hl);
  });
  // Tail lights (red)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xe53935, emissive: 0xc62828, emissiveIntensity: 0.7,
  });
  [[-0.47, 0.28, 0.18], [-0.47, 0.28, -0.18]].forEach(p => {
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), tailMat);
    tl.position.set(p[0], p[1], p[2]);
    g.add(tl);
  });
  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
  [[-0.3, 0.13, 0.27], [-0.3, 0.13, -0.27], [0.3, 0.13, 0.27], [0.3, 0.13, -0.27]]
    .forEach(p => {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.09, 12), wheelMat
      );
      w.position.set(p[0], p[1], p[2]);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    });
  return g;
}

// Moving cars — each follows a closed waypoint loop around the city
const movingCars = [];
function spawnCar(color, path, speed = 1.6, offset = 0) {
  const g = makeCar(color);
  g.userData = { path, speed, progress: offset };
  scene.add(g);
  movingCars.push(g);
}

// City loop path (rectangle around the towers, traversed clockwise)
const cityLoop = [
  { x: -9.5, z: 16 },
  { x: -14.5, z: 16 },
  { x: -14.5, z: 10 },
  { x: -9.5, z: 10 },
];
spawnCar(0xd32f2f, cityLoop, 1.7, 0.2);
spawnCar(0x1e88e5, cityLoop, 1.5, 1.6);
spawnCar(0xfdd835, cityLoop, 1.9, 3.0);
// One car on the village-to-industrial east-west road (oscillates back and forth)
const eastWestPath = [
  { x: -4, z: 13.5 },
  { x: 12, z: 13.5 },
];
spawnCar(0x43a047, eastWestPath, 2.2, 0);

// Parked cars along the road shoulders
function parkCar(x, z, yaw, color) {
  const g = makeCar(color);
  g.position.set(x, sampleTerrainY(x, z) + 0.08, z);
  g.rotation.y = yaw;
  scene.add(g);
}
parkCar(-11.0, 9.6, Math.PI / 2, 0x7b1fa2);
parkCar(-13.2, 16.4, 0, 0x00897b);
parkCar(0, 14.1, 0, 0xef6c00);
// Short connector: industrial → dam on river
// Was (15, 8.5)→(10, 1.5); the old endpoint crossed the east tributary at
// (Old dam-connector road removed: industrial moved to z=17 and the original
//  (15, 8.5)→(12.5, 4) endpoints no longer make sense.)

// ---------- BOATS (float in the ocean, gentle bob + drift) ----------
const boatMeshes = [];
function buildSailboat(x, z) {
  const g = new THREE.Group();
  // Hull (trapezoid-ish — wider top, narrower bottom)
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 });
  const hullTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.7), hullMat);
  hullTop.position.y = 0.45;
  hullTop.castShadow = true;
  g.add(hullTop);
  const hullBot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.5), hullMat);
  hullBot.position.y = 0.2;
  hullBot.castShadow = true;
  g.add(hullBot);
  // Cabin / deck plate
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.25, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xefebe9 })
  );
  deck.position.set(-0.2, 0.7, 0);
  g.add(deck);
  // Mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x5d4037 })
  );
  mast.position.set(0.1, 1.6, 0);
  g.add(mast);
  // Main sail (triangular plane)
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide,
  });
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0.1, 0.6, 0,    0.1, 2.6, 0,    1.2, 0.6, 0,
  ], 3));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.castShadow = true;
  g.add(sail);
  // Jib (smaller front sail)
  const jibGeo = new THREE.BufferGeometry();
  jibGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0.1, 0.6, 0,    0.1, 2.0, 0,    -0.9, 0.6, 0,
  ], 3));
  jibGeo.computeVertexNormals();
  const jib = new THREE.Mesh(jibGeo, sailMat);
  g.add(jib);
  g.position.set(x, 0.22, z);
  g.userData = {
    baseX: x, baseZ: z,
    bobPhase: Math.random() * Math.PI * 2,
    yawPhase: Math.random() * Math.PI * 2,
  };
  scene.add(g);
  boatMeshes.push(g);
  return g;
}

function buildMotorboat(x, z) {
  const g = new THREE.Group();
  // Hull (red & white)
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.7), hullMat);
  hull.position.y = 0.35;
  hull.castShadow = true;
  g.add(hull);
  // White trim strip
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.08, 0.72),
    new THREE.MeshStandardMaterial({ color: 0xfafafa })
  );
  trim.position.y = 0.52;
  g.add(trim);
  // Windshield / cockpit
  const cockpit = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.25, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7, metalness: 0.5, roughness: 0.2,
      emissive: 0x0277bd, emissiveIntensity: 0.2,
    })
  );
  cockpit.position.set(0.1, 0.72, 0);
  g.add(cockpit);
  // Small outboard motor at back
  const motor = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.4, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x37474f })
  );
  motor.position.set(-0.95, 0.55, 0);
  g.add(motor);
  g.position.set(x, 0.22, z);
  g.userData = {
    baseX: x, baseZ: z,
    bobPhase: Math.random() * Math.PI * 2,
    yawPhase: Math.random() * Math.PI * 2,
  };
  scene.add(g);
  boatMeshes.push(g);
  return g;
}

buildSailboat(-25, 5);    // sailboat in the bay
buildMotorboat(-26, -5);  // motor boat further out

// ---------- LIGHTHOUSE (coastal landmark on the western shore) ----------
function buildLighthouse(x, z) {
  const g = new THREE.Group();
  // Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.9 })
  );
  base.position.y = 0.3; base.castShadow = true; g.add(base);
  // Tower in red/white stripes (4 alternating cylinders)
  const stripeColors = [0xfafafa, 0xc62828];
  for (let i = 0; i < 4; i++) {
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16),
      new THREE.MeshStandardMaterial({
        color: stripeColors[i % 2], roughness: 0.7,
      })
    );
    stripe.position.y = 0.6 + 0.9 + i * 0.9 - 0.45;
    stripe.castShadow = true;
    g.add(stripe);
  }
  // Top cap (lantern room)
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.45, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffeb3b, emissive: 0xfff176, emissiveIntensity: 0.9,
    })
  );
  lantern.position.y = 4.5;
  g.add(lantern);
  // Roof cone
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.8 })
  );
  roof.position.y = 5.0;
  roof.castShadow = true;
  g.add(roof);
  // Strong point light to simulate the beacon
  const beacon = new THREE.PointLight(0xfff59d, 1.2, 18);
  beacon.position.y = 4.5;
  g.add(beacon);
  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  return g;
}
buildLighthouse(-9, 18);  // on the western coast strip near terrain north corner

// ---------- COASTAL FEATURES (beach, shells, seaweed, birds) ----------
// Sandy beach strip along the coastline — sits at the cliff edge where
// land meets ocean basin (x ≈ -17) so it reads as a real shoreline.
const BEACH_CX = -16.8;
function buildBeach() {
  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.05, 38),
    new THREE.MeshStandardMaterial({ color: 0xf4e4b8, roughness: 1 })
  );
  sand.position.set(BEACH_CX, 0.30, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const foam = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.035, 37),
    new THREE.MeshStandardMaterial({
      color: 0xe3f2fd,
      emissive: 0xbbdefb,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    })
  );
  foam.position.set(-18.05, 0.34, 0);
  scene.add(foam);

  // Darker damp-sand patches scattered across the beach
  for (let i = 0; i < 28; i++) {
    const p = new THREE.Mesh(
      new THREE.CircleGeometry(0.22 + Math.random() * 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0xddc188, roughness: 1 })
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(BEACH_CX + (Math.random() - 0.5) * 2.1, 0.33, -18 + Math.random() * 36);
    scene.add(p);
  }
}
buildBeach();

// Seashells scattered on the sand
function buildShells() {
  const shellColors = [0xffffff, 0xffe0b2, 0xf8bbd0, 0xfff3e0, 0xffccbc];
  for (let i = 0; i < 32; i++) {
    const color = shellColors[Math.floor(Math.random() * shellColors.length)];
    const shell = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.12, 7),
      new THREE.MeshStandardMaterial({
        color, roughness: 0.45, metalness: 0.15,
      })
    );
    shell.position.set(
      BEACH_CX + (Math.random() - 0.5) * 2.1,
      0.36,
      -18 + Math.random() * 36
    );
    shell.rotation.x = Math.PI;
    shell.rotation.y = Math.random() * Math.PI * 2;
    shell.scale.set(0.9 + Math.random() * 0.3, 0.5 + Math.random() * 0.4, 0.9 + Math.random() * 0.3);
    shell.castShadow = true;
    scene.add(shell);
  }
}
buildShells();

// Small starfish on the upper beach for extra coastal life.
function buildStarfish() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff7043,
    roughness: 0.8,
    emissive: 0xbf360c,
    emissiveIntensity: 0.15,
  });
  for (let i = 0; i < 8; i++) {
    const star = new THREE.Group();
    for (let arm = 0; arm < 5; arm++) {
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 6), mat);
      ray.position.y = 0.02;
      ray.rotation.z = Math.PI / 2;
      ray.rotation.y = (arm / 5) * Math.PI * 2;
      ray.position.x = Math.cos(ray.rotation.y) * 0.13;
      ray.position.z = Math.sin(ray.rotation.y) * 0.13;
      star.add(ray);
    }
    star.position.set(
      BEACH_CX + (Math.random() - 0.5) * 1.6,
      0.38,
      -16 + Math.random() * 32
    );
    star.rotation.y = Math.random() * Math.PI * 2;
    scene.add(star);
  }
}
buildStarfish();

// Small beach visitors for scale and liveliness.
function buildBeachPerson(x, z, shirtColor = 0xff7043) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.58, 10), shirtMat);
  body.position.y = 0.68;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMat);
  head.position.y = 1.08;
  head.castShadow = true;
  g.add(head);

  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.22), shortsMat);
  shorts.position.y = 0.34;
  g.add(shorts);

  [-0.09, 0.09].forEach(dx => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 8), skinMat);
    leg.position.set(dx, 0.12, 0);
    leg.castShadow = true;
    g.add(leg);
  });

  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.42, 8), skinMat);
    arm.position.set(side * 0.22, 0.68, 0);
    arm.rotation.z = side * 0.35;
    arm.castShadow = true;
    g.add(arm);
  });

  g.position.set(x, 0.33, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return g;
}

function buildBeachPeople() {
  const people = [
    { x: -16.2, z: -13.5, color: 0xff7043 },
    { x: -16.1, z: -8.2,  color: 0x66bb6a },
    { x: -17.2, z: -3.2,  color: 0xffca28 },
    { x: -16.3, z: 7.6,   color: 0xab47bc },
    { x: -17.1, z: 13.4,  color: 0x29b6f6 },
  ];
  people.forEach(p => buildBeachPerson(p.x, p.z, p.color));
}
buildBeachPeople();

function buildBeachUmbrella(x, z, color = 0xef5350) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.05, 10),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 })
  );
  pole.position.y = 0.58;
  pole.castShadow = true;
  g.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.82, 0.42, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      side: THREE.DoubleSide,
    })
  );
  canopy.position.y = 1.18;
  canopy.rotation.y = Math.PI / 18;
  canopy.castShadow = true;
  g.add(canopy);

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 1.35), stripeMat);
    stripe.position.y = 1.04;
    stripe.rotation.y = (i / 3) * Math.PI;
    stripe.castShadow = true;
    g.add(stripe);
  }

  g.position.set(x, 0.32, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return g;
}

function buildBeachUmbrellas() {
  buildBeachUmbrella(-16.15, -11.2, 0xef5350);
  buildBeachUmbrella(-17.15, 2.5, 0x29b6f6);
  buildBeachUmbrella(-16.25, 11.2, 0xffca28);
}
buildBeachUmbrellas();

// Seaweed clusters in shallow water just offshore
const seaweedClusters = [];
function buildSeaweed() {
  const greens = [0x2e7d32, 0x388e3c, 0x4caf50];
  for (let i = 0; i < 12; i++) {
    const cluster = new THREE.Group();
    const colorIdx = Math.floor(Math.random() * greens.length);
    const mat = new THREE.MeshStandardMaterial({
      color: greens[colorIdx], roughness: 0.9, side: THREE.DoubleSide,
    });
    const fronds = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < fronds; j++) {
      const frond = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.55 + Math.random() * 0.25), mat
      );
      frond.position.set(
        (Math.random() - 0.5) * 0.5,
        0.28 + Math.random() * 0.05,
        (Math.random() - 0.5) * 0.5
      );
      frond.rotation.y = Math.random() * Math.PI;
      frond.userData.basePhase = Math.random() * Math.PI * 2;
      cluster.add(frond);
    }
    // Seaweed now lives in the ocean basin (x < -18) west of the beach,
    // so the fronds sit in real water rather than on grass.
    cluster.position.set(
      -22 + Math.random() * 3,
      -1.4,                       // basin floor depth
      -17 + Math.random() * 34
    );
    scene.add(cluster);
    seaweedClusters.push(cluster);
  }
}
buildSeaweed();

// Seagulls flying in circles above the ocean
const birdMeshes = [];
function makeBird(centerX, centerZ, height, radius, speed, wingColor = 0xffffff, bodyColor = 0xeceff1) {
  const g = new THREE.Group();
  const wingMat = new THREE.MeshStandardMaterial({
    color: wingColor, roughness: 0.8, side: THREE.DoubleSide,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor, roughness: 0.7,
  });
  // Two flat triangular wings rooted at the body
  function makeWing(side) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,  side * 0.55, 0.05, 0.18,  side * 0.55, 0.05, -0.18,
    ], 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, wingMat);
  }
  const leftWing = makeWing(-1);
  const rightWing = makeWing(1);
  g.add(leftWing);
  g.add(rightWing);
  // Tiny body sphere
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
  g.add(body);
  g.userData = {
    cx: centerX, cz: centerZ, y: height,
    radius, speed,
    phase: Math.random() * Math.PI * 2,
    leftWing, rightWing,
  };
  scene.add(g);
  birdMeshes.push(g);
  return g;
}
makeBird(-22, 0,   12, 8.0, 0.45);
makeBird(-26, 6,   10, 6.0, 0.55);
makeBird(-24, -7,  14, 7.0, 0.40);
makeBird(-19, 11,  11, 5.0, 0.50);
makeBird(-28, 3,   13, 4.5, 0.60);
makeBird(22, -12,  15, 4.0, 0.42, 0x6d4c41, 0x8d6e63);
makeBird(25, -8,   13, 3.5, 0.48, 0x5d4037, 0x795548);
// Birds over the central landscape (river, ponds, fields, terraces)
makeBird( 0,  0,    9, 6.0, 0.42, 0xffffff, 0xeceff1);  // over main river
makeBird(-3,  5,   10, 4.5, 0.55, 0xeceff1, 0xb0bec5);  // over riparian zone
makeBird( 5, -10,  11, 5.5, 0.38, 0xffffff, 0xcfd8dc);  // over rice paddies
makeBird(18,  7,    8, 3.5, 0.50, 0xffffff, 0xeceff1);  // over ponds
makeBird(22,  2,   10, 4.0, 0.45, 0x6d4c41, 0x8d6e63);  // over stream head
makeBird( 4,  9,    9, 3.0, 0.55, 0xffffff, 0xeceff1);  // over agroforestry terrace
makeBird(-8, -3,   11, 5.5, 0.40, 0xeceff1, 0xb0bec5);  // over main river bend
makeBird(15, 14,   12, 4.5, 0.48, 0xffffff, 0xcfd8dc);  // over industrial / windmill area
makeBird(-12, 10,  10, 4.0, 0.52, 0xffffff, 0xeceff1);  // over city outskirts

// ---------- GROUND BIRDS ----------
// Small standing birds for the open grass patch between the school
// riparian zone and the Soil Evaporation area.
const groundBirds = [];
function makeGroundBird(x, z, yaw = 0, bodyColor = 0xeceff1, headColor = 0x9e9e9e) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.7 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.5 });
  const legMat  = new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bodyMat);
  body.scale.set(1, 0.85, 1.4);
  body.position.y = 0.16;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), headMat);
  head.position.set(0, 0.27, 0.13);
  head.castShadow = true;
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.27, 0.22);
  g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.10, 6), bodyMat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.18, -0.18);
  g.add(tail);
  [-0.04, 0.04].forEach(dx => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5), legMat
    );
    leg.position.set(dx, 0.06, 0);
    g.add(leg);
  });
  g.position.set(x, sampleTerrainY(x, z), z);
  g.rotation.y = yaw;
  scene.add(g);
  g.userData.basePhase = Math.random() * Math.PI * 2;
  groundBirds.push(g);
  return g;
}
// Small flock between the school and Soil Evaporation
makeGroundBird(-3.5, 11.0,  0.40, 0xeceff1, 0x9e9e9e);
makeGroundBird(-2.6, 12.4, -0.85, 0xfafafa, 0x757575);
makeGroundBird(-4.2, 13.5,  1.20, 0xffe0b2, 0xa1887f);
makeGroundBird(-1.8, 14.1, -1.80, 0xeceff1, 0x6d4c41);
makeGroundBird(-3.2, 15.3,  0.20, 0xfff3e0, 0x8d6e63);
makeGroundBird(-5.0, 12.0,  2.30, 0xeceff1, 0x9e9e9e);

// ---------- SKYSCRAPER CLUSTER ----------
// Coastal city skyline tucked between the beach and the village.
function buildSkyscraper(x, z, width, depth, height, baseColor, accentColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: baseColor, roughness: 0.45, metalness: 0.25,
    })
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    emissive: 0x01579b,
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.15,
  });
  const floors = Math.max(4, Math.floor(height / 0.55));
  for (let f = 1; f < floors; f++) {
    if (f % 2 === 0) continue;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.02, 0.18, depth + 0.02),
      winMat
    );
    strip.position.y = f * (height / floors);
    g.add(strip);
  }
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.85, 0.2, depth * 0.85),
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 })
  );
  cap.position.y = height + 0.1;
  g.add(cap);
  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  return g;
}

function buildAntenna(x, z, baseHeight) {
  const a = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6),
    new THREE.MeshStandardMaterial({
      color: 0x37474f, emissive: 0xff5722, emissiveIntensity: 0.3,
    })
  );
  a.position.set(x, sampleTerrainY(x, z) + baseHeight + 0.9, z);
  scene.add(a);
}

// Cluster of 5 towers between palms (x≈-14) and village (x>-10)
buildSkyscraper(-12.5, 11.0, 1.6, 1.6, 5.5, 0xeceff1, 0x546e7a);
buildSkyscraper(-13.0, 13.0, 1.4, 1.4, 7.5, 0xb0bec5, 0x37474f);
buildSkyscraper(-11.5, 12.0, 1.3, 1.3, 4.8, 0xcfd8dc, 0x607d8b);
buildSkyscraper(-12.0, 14.5, 1.5, 1.5, 6.2, 0xeceff1, 0x455a64);
buildSkyscraper(-11.0, 13.8, 1.2, 1.2, 4.2, 0xb0bec5, 0x546e7a);
buildAntenna(-13.0, 13.0, 7.5);

// Simple wildlife near the mountain forest.
function buildDeer(x, z, scale = 1) {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
  const antlerMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), furMat);
  body.scale.set(1.55, 0.72, 0.78);
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.55, 8), furMat);
  neck.position.set(0.55, 1.0, 0);
  neck.rotation.z = -0.55;
  neck.castShadow = true;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), furMat);
  head.scale.set(1.15, 0.8, 0.75);
  head.position.set(0.88, 1.2, 0);
  head.castShadow = true;
  g.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), darkMat);
  nose.position.set(1.08, 1.18, 0);
  g.add(nose);

  [-0.42, -0.12, 0.32, 0.62].forEach(dx => {
    [-0.2, 0.2].forEach(dz => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), darkMat);
      leg.position.set(dx, 0.32, dz);
      leg.castShadow = true;
      g.add(leg);
    });
  });

  [-1, 1].forEach(side => {
    const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 6), antlerMat);
    antler.position.set(0.88, 1.48, side * 0.08);
    antler.rotation.z = side * 0.35;
    antler.castShadow = true;
    g.add(antler);
  });

  g.position.set(x, sampleTerrainY(x, z), z);
  g.scale.setScalar(scale);
  g.rotation.y = -0.8 + Math.random() * 0.5;
  scene.add(g);
  return g;
}

function buildRabbit(x, z, scale = 1) {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.9 });
  const earMat = new THREE.MeshStandardMaterial({ color: 0xf8bbd0, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), furMat);
  body.scale.set(1.35, 0.8, 0.9);
  body.position.y = 0.22;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), furMat);
  head.position.set(0.22, 0.34, 0);
  head.castShadow = true;
  g.add(head);

  [-0.06, 0.06].forEach(dz => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.34, 8), earMat);
    ear.position.set(0.24, 0.6, dz);
    ear.rotation.z = -0.18;
    ear.castShadow = true;
    g.add(ear);
  });

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), furMat);
  tail.position.set(-0.28, 0.28, 0);
  g.add(tail);

  g.position.set(x, sampleTerrainY(x, z), z);
  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return g;
}

function buildBoar(x, z, scale = 1) {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 });
  const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), furMat);
  body.scale.set(1.65, 0.82, 0.85);
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), furMat);
  head.scale.set(1.15, 0.85, 0.8);
  head.position.set(0.55, 0.55, 0);
  head.castShadow = true;
  g.add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8), darkMat);
  snout.position.set(0.78, 0.53, 0);
  snout.rotation.z = Math.PI / 2;
  g.add(snout);

  [-0.36, -0.08, 0.28, 0.52].forEach(dx => {
    [-0.16, 0.16].forEach(dz => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.38, 8), darkMat);
      leg.position.set(dx, 0.16, dz);
      leg.castShadow = true;
      g.add(leg);
    });
  });

  [-1, 1].forEach(side => {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.22, 8), tuskMat);
    tusk.position.set(0.75, 0.46, side * 0.09);
    tusk.rotation.z = -Math.PI / 2;
    g.add(tusk);
  });

  g.position.set(x, sampleTerrainY(x, z), z);
  g.scale.setScalar(scale);
  g.rotation.y = -0.9 + Math.random() * 0.5;
  scene.add(g);
  return g;
}

function buildForestBirdPerch(x, z, scale = 1) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.75 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bodyMat);
  body.scale.set(1.15, 0.8, 0.8);
  body.position.y = 1.0;
  g.add(body);

  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), wingMat);
    wing.scale.set(0.6, 0.25, 1.2);
    wing.position.set(0, 1.0, side * 0.12);
    g.add(wing);
  });

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.8 })
  );
  beak.position.set(0.14, 1.0, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);

  g.position.set(x, sampleTerrainY(x, z), z);
  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return g;
}

buildDeer(22.5, -14.2, 0.9);
buildDeer(24.5, -10.5, 0.75);
buildDeer(27.2, -12.8, 0.7);
buildDeer(18.6, -16.5, 0.65);
buildRabbit(20.5, -13.3, 0.9);
buildRabbit(23.8, -16.0, 0.8);
buildRabbit(26.2, -8.8, 0.75);
buildRabbit(28.0, -10.2, 0.7);
buildRabbit(19.0, -19.0, 0.7);
buildBoar(25.8, -15.2, 0.8);
buildBoar(21.4, -18.2, 0.7);
buildForestBirdPerch(23.0, -12.0, 0.9);
buildForestBirdPerch(26.5, -9.8, 0.8);
buildForestBirdPerch(19.5, -16.8, 0.75);

// ---------- HARBOUR ----------
function buildHarbour(landX, waterX, z) {
  const g = new THREE.Group();
  const pierLength = Math.abs(waterX - landX);
  const centerX = (landX + waterX) / 2;
  // Deck (wide thin slab)
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(pierLength, 0.12, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.9 })
  );
  deck.position.set(centerX, 0.36, z);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  // Plank groove lines on top of deck
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
  for (let i = 0; i < 9; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(pierLength, 0.13, 0.04), plankMat);
    plank.position.set(centerX, 0.37, z - 0.8 + i * 0.2);
    g.add(plank);
  }
  // Pilings (pairs along the length, extending into the water)
  const pilingMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 });
  const supportCount = Math.ceil(pierLength / 1.6);
  for (let i = 0; i <= supportCount; i++) {
    const t = i / supportCount;
    const x = landX + (waterX - landX) * t;
    [z - 0.75, z + 0.75].forEach(zPos => {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 2.0, 8), pilingMat
      );
      p.position.set(x, -0.65, zPos);
      p.castShadow = true;
      g.add(p);
    });
  }
  // Side railing posts + top rails
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
  for (let i = 0; i <= supportCount; i++) {
    const t = i / supportCount;
    const x = landX + (waterX - landX) * t;
    [z - 0.95, z + 0.95].forEach(zPos => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6), railMat
      );
      post.position.set(x, 0.65, zPos);
      g.add(post);
    });
  }
  [z - 0.95, z + 0.95].forEach(zPos => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(pierLength, 0.07, 0.07), railMat);
    rail.position.set(centerX, 0.88, zPos);
    g.add(rail);
  });
  // Cleats at the water end (where boats tie up)
  const cleatMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.4, metalness: 0.6 });
  [z - 0.6, z + 0.6].forEach(zPos => {
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.4), cleatMat);
    cleat.position.set(waterX, 0.5, zPos);
    g.add(cleat);
  });
  scene.add(g);
  return g;
}

function buildHarbourHut(x, z) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.3, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.9 })
  );
  walls.position.y = 0.65; walls.castShadow = true; g.add(walls);
  // Red pyramid roof
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 0.75, 4),
    new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.8 })
  );
  roof.position.y = 1.7; roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  // Door + windows
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.65, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x4e342e })
  );
  door.position.set(0, 0.33, 0.82); g.add(door);
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffd54f, emissive: 0xfff176, emissiveIntensity: 0.5,
  });
  [[-0.6, 0.85, 0.82], [0.6, 0.85, 0.82]].forEach(p => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.04), winMat);
    w.position.set(p[0], p[1], p[2]); g.add(w);
  });
  // Small life preserver hanging on the wall (decoration)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.05, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xff5722 })
  );
  ring.position.set(-0.95, 0.7, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  return g;
}

// Harbour on the west coast. The terrain drops into the ocean basin near
// x=-18, so the pier starts at the shoreline and extends into deeper water.
buildHarbour(-17.5, -25, 0);
buildHarbourHut(-15.8, 0);
// Docked motorboat at the pier's water end
buildMotorboat(-24, 1.2);

// ---------- AQUACULTURE (fish-farm pens floating in the bay) ----------
function buildFishFarm(cx, cz, yaw = 0, surfaceY = 0.18) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x546e7a, roughness: 0.55, metalness: 0.45,
  });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0x90a4ae, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const buoyMat = new THREE.MeshStandardMaterial({
    color: 0xff5722, roughness: 0.6,
  });
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0x8d6e63, roughness: 0.9,
  });
  // 3 pens in a row
  for (let i = 0; i < 3; i++) {
    const px = (i - 1) * 1.7;
    // Square frame at water surface (top edges only)
    const fW = 1.4;
    [[fW, 0.08, 0.12], [fW, 0.08, 0.12]].forEach((s, j) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(s[0], s[1], s[2]),
        frameMat
      );
      frame.position.set(px, 0.05, (j === 0 ? -1 : 1) * fW / 2);
      g.add(frame);
    });
    [[0.12, 0.08, fW], [0.12, 0.08, fW]].forEach((s, j) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(s[0], s[1], s[2]),
        frameMat
      );
      frame.position.set(px + (j === 0 ? -1 : 1) * fW / 2, 0.05, 0);
      g.add(frame);
    });
    // Net visible just below the surface
    const net = new THREE.Mesh(
      new THREE.BoxGeometry(fW - 0.1, 0.55, fW - 0.1), netMat
    );
    net.position.set(px, -0.25, 0);
    g.add(net);
    // 4 orange buoys at the corners
    [[-fW/2, -fW/2], [fW/2, -fW/2], [-fW/2, fW/2], [fW/2, fW/2]].forEach(c => {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), buoyMat);
      buoy.position.set(px + c[0], 0.12, c[1]);
      buoy.castShadow = true;
      g.add(buoy);
    });
  }
  // Wooden walkway connecting the pens
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.06, 0.45), walkwayMat
  );
  walk.position.set(0, 0.13, 0);
  g.add(walk);
  g.position.set(cx, surfaceY, cz);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}
// Aquaculture pond along the riverbank — freshwater fish farming.
// Sits south of the river bend at (5.5, -2) on the south plain.
const _aquaCx = 3, _aquaCz = -5;
const _aquaY = sampleTerrainY(_aquaCx, _aquaCz);
const _aquaPondMat = new THREE.MeshStandardMaterial({
  color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.4,
  roughness: 0.25, metalness: 0.05,
});
// Rectangular pond holding the pens (a bit larger than the farm footprint)
const _aquaPond = new THREE.Mesh(
  new THREE.BoxGeometry(6.5, 0.08, 3.2), _aquaPondMat
);
_aquaPond.position.set(_aquaCx, _aquaY + 0.18, _aquaCz);
_aquaPond.receiveShadow = true;
scene.add(_aquaPond);
// Sandy bank around the pond
const _aquaBank = new THREE.Mesh(
  new THREE.BoxGeometry(7.3, 0.06, 4.0),
  new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
);
_aquaBank.position.set(_aquaCx, _aquaY + 0.14, _aquaCz);
scene.add(_aquaBank);
// Short channel connecting the pond to the main river (just to the north)
const _aquaChannel = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.07, 2.5), _aquaPondMat
);
_aquaChannel.position.set(_aquaCx + 1.5, _aquaY + 0.18, _aquaCz + 2.5);
scene.add(_aquaChannel);
buildFishFarm(_aquaCx, _aquaCz, 0, _aquaY + 0.20);

// ---------- FISHERMEN ----------
function makeFisherman(shirtColor = 0x1976d2, hatColor = 0xfdd835) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccbc, roughness: 0.9 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.95 });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
  // Pants
  const pants = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.12, 0.35, 8), pantsMat
  );
  pants.position.y = 0.18;
  pants.castShadow = true;
  g.add(pants);
  // Shirt / body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.14, 0.45, 8), shirtMat
  );
  body.position.y = 0.58;
  body.castShadow = true;
  g.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), skinMat);
  head.position.y = 0.92;
  head.castShadow = true;
  g.add(head);
  // Cone hat
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.2, 10),
    new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.8 })
  );
  hat.position.y = 1.07;
  hat.castShadow = true;
  g.add(hat);
  // Fishing rod (angled forward and up)
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 1.6, 5), rodMat
  );
  rod.position.set(0.55, 0.95, 0);
  rod.rotation.z = -0.7;
  g.add(rod);
  // Line dangling from rod tip
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.9, 4), lineMat
  );
  line.position.set(1.18, 0.5, 0);
  g.add(line);
  return g;
}
function placeFisherman(x, y, z, yaw = 0, shirtColor, hatColor) {
  const f = makeFisherman(shirtColor, hatColor);
  f.position.set(x, y, z);
  f.rotation.y = yaw;
  scene.add(f);
  return f;
}
// Two fishermen on the pier, facing the water
placeFisherman(-20, 0.43, -0.7,  Math.PI, 0x1976d2, 0xfdd835);
placeFisherman(-17, 0.43,  0.7,  Math.PI, 0xc62828, 0x6d4c41);
// One on the beach
placeFisherman(-16.5, 0.36, -8, -Math.PI / 2, 0x388e3c, 0xfdd835);

// ---------- COASTAL CITY ----------
// A compact settlement just inland from the beach, like the reference image:
// visible buildings behind the palms without covering the sand/ocean edge.
function buildCityBlock(x, z, w, d, h, color, roofColor = 0x455a64) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.05, 0.12, d * 1.05),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.75 })
  );
  roof.position.y = h + 0.08;
  roof.castShadow = true;
  g.add(roof);

  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfff59d,
    emissive: 0xffca28,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });
  const cols = Math.max(2, Math.floor(w / 0.45));
  const rows = Math.max(2, Math.floor(h / 0.45));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.035), winMat);
      win.position.set(
        -w * 0.38 + col * (w * 0.76 / Math.max(1, cols - 1)),
        0.35 + row * (h * 0.65 / Math.max(1, rows - 1)),
        d / 2 + 0.02
      );
      g.add(win);
    }
  }

  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  return g;
}

function buildCoastalCity() {
  const city = [
    { x: -13.0, z: -13.4, w: 1.6, d: 1.4, h: 2.4, c: 0xb0bec5 },
    { x: -11.0, z: -12.8, w: 1.8, d: 1.5, h: 3.0, c: 0x90a4ae },
    { x: -9.2,  z: -13.6, w: 1.4, d: 1.3, h: 2.2, c: 0xd7ccc8 },
    { x: -12.2, z: -10.8, w: 1.5, d: 1.2, h: 1.8, c: 0xffecb3, roof: 0xc62828 },
    { x: -10.2, z: -10.6, w: 1.6, d: 1.3, h: 2.6, c: 0xcfd8dc },
    { x: -8.7,  z: -11.3, w: 1.2, d: 1.1, h: 1.7, c: 0xefebe9, roof: 0x1976d2 },
  ];
  city.forEach(b => buildCityBlock(b.x, b.z, b.w, b.d, b.h, b.c, b.roof));

  // Small promenade/road between city and beach.
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.05, 7.5),
    new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.9 })
  );
  road.position.set(-14.25, sampleTerrainY(-14.25, -12) + 0.08, -12);
  road.receiveShadow = true;
  scene.add(road);
}
buildCoastalCity();

function buildCoastalRoad(x, z, length, width, yaw = 0) {
  const y = sampleTerrainY(x, z);
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.055, width),
    new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.92 })
  );
  road.position.set(x, y + 0.09, z);
  road.rotation.y = yaw;
  road.receiveShadow = true;
  scene.add(road);

  const line = new THREE.Mesh(
    new THREE.BoxGeometry(length * 0.82, 0.025, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xfff176, emissive: 0xfdd835, emissiveIntensity: 0.2 })
  );
  line.position.set(x, y + 0.13, z);
  line.rotation.y = yaw;
  scene.add(line);
}

function buildCoastalCar(x, z, color = 0xef5350, yaw = 0) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x81d4fa,
    roughness: 0.25,
    metalness: 0.3,
    emissive: 0x0277bd,
    emissiveIntensity: 0.12,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.48), bodyMat);
  body.position.y = 0.32;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.25, 0.42), glassMat);
  cabin.position.set(-0.04, 0.55, 0);
  cabin.castShadow = true;
  g.add(cabin);

  [[-0.28, 0.2], [0.28, 0.2], [-0.28, -0.2], [0.28, -0.2]].forEach(([dx, dz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), darkMat);
    wheel.position.set(dx, 0.16, dz);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    g.add(wheel);
  });

  g.position.set(x, sampleTerrainY(x, z) + 0.08, z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

function buildCoastalPedestrian(x, z, shirtColor = 0x42a5f5) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb87545, roughness: 0.75 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.42, 8), shirtMat);
  body.position.y = 0.52;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skinMat);
  head.position.y = 0.82;
  head.castShadow = true;
  g.add(head);

  [-0.04, 0.04].forEach(dx => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.32, 8), pantsMat);
    leg.position.set(dx, 0.18, 0);
    leg.castShadow = true;
    g.add(leg);
  });

  g.position.set(x, sampleTerrainY(x, z) + 0.08, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return g;
}

function buildCoastalCityLife() {
  buildCoastalRoad(-11.0, -9.4, 6.4, 0.72, 0);
  buildCoastalRoad(-11.0, -14.9, 6.2, 0.72, 0);
  buildCoastalRoad(-8.0, -12.1, 5.9, 0.72, Math.PI / 2);
  buildCoastalRoad(-13.9, -12.1, 5.7, 0.72, Math.PI / 2);

  buildCoastalCar(-12.8, -9.4, 0xef5350, 0.02);
  buildCoastalCar(-9.4, -9.4, 0x29b6f6, Math.PI);
  buildCoastalCar(-8.0, -12.7, 0xffca28, Math.PI / 2);
  buildCoastalCar(-12.0, -14.9, 0x66bb6a, 0);
  buildCoastalCar(-13.9, -11.1, 0xab47bc, Math.PI / 2);

  [
    [-13.3, -11.4, 0xff7043],
    [-12.4, -10.0, 0x29b6f6],
    [-10.6, -11.8, 0xffca28],
    [-9.3,  -13.9, 0x66bb6a],
    [-14.7, -12.5, 0xab47bc],
    [-8.6,  -10.2, 0xef5350],
    [-11.5, -15.6, 0x26a69a],
  ].forEach(([x, z, color]) => buildCoastalPedestrian(x, z, color));
}
buildCoastalCityLife();

// ---------- COASTAL MALL ----------
function buildMallTree(x, z, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
  );
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.32 - i * 0.03, 10, 8), leafMat);
    puff.position.set((Math.random() - 0.5) * 0.25, 0.95 + i * 0.18, (Math.random() - 0.5) * 0.25);
    puff.castShadow = true;
    g.add(puff);
  }
  g.position.set(x, sampleTerrainY(x, z) + 0.04, z);
  g.scale.setScalar(scale);
  scene.add(g);
  return g;
}

function buildMall(cx, cz) {
  const y = sampleTerrainY(cx, cz);
  const mallMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.78 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.65 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x81d4fa,
    roughness: 0.18,
    metalness: 0.45,
    emissive: 0x0277bd,
    emissiveIntensity: 0.14,
  });

  const main = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.5, 2.4), mallMat);
  main.position.set(cx, y + 0.75, cz);
  main.castShadow = true;
  main.receiveShadow = true;
  scene.add(main);

  const entry = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.2), glassMat);
  entry.position.set(cx, y + 0.65, cz - 1.23);
  scene.add(entry);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.08), accentMat);
  sign.position.set(cx, y + 1.65, cz - 1.28);
  scene.add(sign);

  const parking = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.04, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x424242, roughness: 0.95 })
  );
  parking.position.set(cx, y + 0.06, cz - 3.2);
  parking.receiveShadow = true;
  scene.add(parking);

  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 1.0), stripeMat);
    stripe.position.set(cx - 2.2 + i * 0.9, y + 0.09, cz - 3.2);
    scene.add(stripe);
  }

  [
    [cx - 2.0, cz - 3.4, 0xef5350],
    [cx - 0.8, cz - 2.9, 0x29b6f6],
    [cx + 0.5, cz - 3.5, 0xffca28],
    [cx + 1.8, cz - 2.8, 0x66bb6a],
  ].forEach(([x, z, color]) => buildCoastalCar(x, z, color, Math.PI / 2));

  [
    [cx - 2.8, cz - 1.4], [cx + 2.8, cz - 1.4],
    [cx - 2.8, cz + 1.3], [cx + 2.8, cz + 1.3],
    [cx - 3.0, cz - 3.8], [cx + 3.0, cz - 3.8],
  ].forEach(([x, z]) => buildMallTree(x, z, 0.75));

  [
    [cx - 0.9, cz - 1.9, 0xff7043],
    [cx + 0.9, cz - 1.8, 0xab47bc],
    [cx - 1.8, cz - 3.0, 0x26a69a],
    [cx + 1.5, cz - 3.4, 0xffca28],
    [cx + 2.2, cz - 0.9, 0x29b6f6],
  ].forEach(([x, z, color]) => buildCoastalPedestrian(x, z, color));
}
buildMall(-8.4, -13.8);

// ---------- SCHOOL ----------
function buildSchool(cx, cz) {
  const y = sampleTerrainY(cx, cz);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.86 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.75 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x90caf9,
    roughness: 0.25,
    metalness: 0.25,
    emissive: 0x1976d2,
    emissiveIntensity: 0.12,
  });

  const building = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.25, 1.7), wallMat);
  building.position.set(cx, y + 0.62, cz);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.18, 1.95), roofMat);
  roof.position.set(cx, y + 1.34, cz);
  roof.castShadow = true;
  scene.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.68, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 })
  );
  door.position.set(cx, y + 0.35, cz - 0.88);
  scene.add(door);

  [-1.05, -0.35, 0.35, 1.05].forEach(dx => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.05), glassMat);
    win.position.set(cx + dx, y + 0.82, cz - 0.88);
    scene.add(win);
  });

  const yard = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.04, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.95 })
  );
  yard.position.set(cx, y + 0.04, cz - 2.25);
  yard.receiveShadow = true;
  scene.add(yard);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.6, metalness: 0.4 })
  );
  flagPole.position.set(cx - 1.85, y + 0.74, cz - 2.25);
  scene.add(flagPole);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.7, side: THREE.DoubleSide })
  );
  flag.position.set(cx - 1.58, y + 1.18, cz - 2.25);
  flag.rotation.y = Math.PI / 2;
  scene.add(flag);

  [
    [cx - 1.2, cz - 2.4, 0x29b6f6],
    [cx - 0.3, cz - 2.9, 0xffca28],
    [cx + 0.7, cz - 2.35, 0x66bb6a],
    [cx + 1.4, cz - 2.85, 0xef5350],
  ].forEach(([x, z, color]) => buildCoastalPedestrian(x, z, color));

  buildMallTree(cx - 2.3, cz - 1.3, 0.7);
  buildMallTree(cx + 2.3, cz - 1.3, 0.7);
}
buildSchool(-7.2, 7.4);

function buildPupil(x, z, shirtColor = 0x1976d2) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb87545, roughness: 0.78 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const backpackMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.8 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.34, 8), shirtMat);
  body.position.y = 0.42;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMat);
  head.position.y = 0.68;
  head.castShadow = true;
  g.add(head);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.05), backpackMat);
  backpack.position.set(-0.08, 0.43, 0);
  g.add(backpack);

  [-0.035, 0.035].forEach(dx => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.25, 8), shortsMat);
    leg.position.set(dx, 0.14, 0);
    leg.castShadow = true;
    g.add(leg);
  });

  g.position.set(x, sampleTerrainY(x, z) + 0.08, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return g;
}

function buildSchoolPupils() {
  [
    [-8.2, 4.8, 0x1976d2],
    [-7.7, 4.4, 0x1976d2],
    [-7.1, 4.6, 0xffca28],
    [-6.5, 4.2, 0x1976d2],
    [-6.1, 4.9, 0x66bb6a],
    [-8.0, 5.5, 0xef5350],
    [-7.2, 5.3, 0x29b6f6],
    [-6.4, 5.6, 0xab47bc],
  ].forEach(([x, z, color]) => buildPupil(x, z, color));
}
buildSchoolPupils();

// Industrial complex on the open north plain, between terrace, ponds, and windmill
const _indCx = 15, _indCz = 17;  // moved north — was z=10, now where POND1 used to be
buildFactory(_indCx, _indCz, 0.3);
buildStorageTank(_indCx + 3.0, _indCz - 0.5, 0xeceff1);
buildStorageTank(_indCx + 3.0, _indCz + 1.2, 0xb0bec5);
buildWarehouse(_indCx - 3.0, _indCz + 0.5, -0.2);

// Perimeter fence around the industrial cluster
function buildFence(x1, z1, x2, z2, postHeight = 1.4) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x607d8b, roughness: 0.6, metalness: 0.5,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x37474f, roughness: 0.7,
  });
  const meshMat = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    metalness: 0.6,
    roughness: 0.4,
    depthWrite: false,
  });
  const sides = [
    { from: [x1, z1], to: [x2, z1] },
    { from: [x2, z1], to: [x2, z2] },
    { from: [x2, z2], to: [x1, z2] },
    { from: [x1, z2], to: [x1, z1] },
  ];
  sides.forEach(side => {
    const dx = side.to[0] - side.from[0];
    const dz = side.to[1] - side.from[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);
    const midX = (side.from[0] + side.to[0]) / 2;
    const midZ = (side.from[1] + side.to[1]) / 2;
    const yMid = sampleTerrainY(midX, midZ);
    // Posts every ~1.5 units (including both ends)
    const numPosts = Math.max(2, Math.ceil(len / 1.5) + 1);
    for (let i = 0; i < numPosts; i++) {
      const t = i / (numPosts - 1);
      const x = side.from[0] + t * dx;
      const z = side.from[1] + t * dz;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, postHeight, 8), postMat
      );
      post.position.set(x, sampleTerrainY(x, z) + postHeight / 2, z);
      post.castShadow = true;
      g.add(post);
    }
    // Top rail
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.06, 0.06), railMat
    );
    topRail.position.set(midX, yMid + postHeight - 0.05, midZ);
    topRail.rotation.y = -angle;
    g.add(topRail);
    // Bottom rail
    const botRail = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.06, 0.06), railMat
    );
    botRail.position.set(midX, yMid + 0.1, midZ);
    botRail.rotation.y = -angle;
    g.add(botRail);
    // Mesh / chain-link panel (semi-transparent vertical plane between rails)
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(len, postHeight - 0.15), meshMat
    );
    panel.position.set(midX, yMid + (postHeight - 0.15) / 2 + 0.1, midZ);
    panel.rotation.y = -angle;
    g.add(panel);
  });
  scene.add(g);
  return g;
}
// Wraps the factory, both tanks, and the warehouse
buildFence(10.0, 15.4, 19.2, 19.2);  // follows industrial complex to z=17 area

// ---------- INDUSTRIAL SMOKE ----------
// Gray puff particles rising from the two factory smokestacks.
const smokeCanvas = document.createElement('canvas');
smokeCanvas.width = smokeCanvas.height = 64;
{
  const sctx = smokeCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0,   'rgba(70, 70, 70, 0.9)');
  grad.addColorStop(0.4, 'rgba(120, 120, 120, 0.6)');
  grad.addColorStop(0.8, 'rgba(180, 180, 180, 0.2)');
  grad.addColorStop(1,   'rgba(200, 200, 200, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
}
const smokeTex = new THREE.CanvasTexture(smokeCanvas);

// Approximate world-space positions of the two stack tops (after the factory's
// 0.3-rad yaw rotation around the (15, 10) center).
function rotatedStack(dx, dz) {
  const c = Math.cos(0.3), s = Math.sin(0.3);
  return { x: _indCx + dx * c - dz * s, z: _indCz + dx * s + dz * c };
}
const stack1 = rotatedStack(-0.6, 0.7);
const stack2 = rotatedStack( 0.6, 0.7);
const smokeEmitters = [
  { x: stack1.x, y: sampleTerrainY(stack1.x, stack1.z) + 3.95, z: stack1.z },
  { x: stack2.x, y: sampleTerrainY(stack2.x, stack2.z) + 3.95, z: stack2.z },
];

const SMOKE_COUNT = 140;
const SMOKE_LIFE = 3.6;
const smokeGeo = new THREE.BufferGeometry();
const smokePos = new Float32Array(SMOKE_COUNT * 3);
const smokeAges = new Float32Array(SMOKE_COUNT);
const smokeDrift = new Float32Array(SMOKE_COUNT * 2); // x, z drift speeds
function seedSmoke(i, reset = false) {
  const e = smokeEmitters[i % smokeEmitters.length];
  smokePos[i * 3]     = e.x + (Math.random() - 0.5) * 0.18;
  smokePos[i * 3 + 1] = e.y + (Math.random() - 0.5) * 0.1;
  smokePos[i * 3 + 2] = e.z + (Math.random() - 0.5) * 0.18;
  smokeAges[i] = reset ? 0 : Math.random() * SMOKE_LIFE;
  smokeDrift[i * 2]     = (Math.random() - 0.5) * 0.18;
  smokeDrift[i * 2 + 1] = (Math.random() - 0.5) * 0.18 - 0.05; // slight prevailing wind
}
for (let i = 0; i < SMOKE_COUNT; i++) seedSmoke(i);
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
const smokeMat = new THREE.PointsMaterial({
  map: smokeTex,
  size: 1.4,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  sizeAttenuation: true,
});
const smoke = new THREE.Points(smokeGeo, smokeMat);
scene.add(smoke);

// ---------- INDUSTRIAL DUMP / POLLUTION ----------
function buildIndustrialDump(cx, cz) {
  const y = sampleTerrainY(cx, cz);
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });
  const trashMats = [
    new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.85, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0x424242, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 }),
  ];

  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), dirtMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(cx, y + 0.07, cz);
  pad.receiveShadow = true;
  scene.add(pad);

  for (let i = 0; i < 24; i++) {
    const mat = trashMats[Math.floor(Math.random() * trashMats.length)];
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 + Math.random() * 0.35, 0.18 + Math.random() * 0.35, 0.25 + Math.random() * 0.35),
      mat
    );
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 2.0;
    box.position.set(cx + Math.cos(angle) * r, y + 0.18 + Math.random() * 0.25, cz + Math.sin(angle) * r);
    box.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
    box.castShadow = true;
    scene.add(box);
  }

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.65, metalness: 0.35 });
  for (let i = 0; i < 6; i++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.46, 12), barrelMat);
    barrel.position.set(cx - 1.3 + i * 0.48, y + 0.28, cz + 1.55 + (i % 2) * 0.22);
    barrel.rotation.z = i % 2 ? 0.2 : -0.15;
    barrel.castShadow = true;
    scene.add(barrel);
  }

  // (Polluted-runoff green strip removed per user request.)

  const warning = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.55, 3),
    new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.65 })
  );
  warning.position.set(cx - 2.2, y + 0.35, cz - 1.7);
  warning.rotation.y = Math.PI / 6;
  scene.add(warning);
}
buildIndustrialDump(20.5, 17.5);

function placeCowAsset(source, { worldX, worldZ, targetH = 1.25, yaw = 0 }) {
  const wrapper = new THREE.Group();
  const inner = source.clone(true);
  wrapper.add(inner);

  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetH / Math.max(size.y, 0.001);
  inner.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(inner);
  inner.position.y -= scaledBox.min.y;
  inner.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  wrapper.position.set(worldX, sampleTerrainY(worldX, worldZ), worldZ);
  wrapper.rotation.y = yaw;
  scene.add(wrapper);
  return wrapper;
}

// Cow asset helper kept available, but no cows are currently placed in scene.

// ---------- SUN ----------
const sunGroup = new THREE.Group();
const sunCore = new THREE.Mesh(
  new THREE.SphereGeometry(2, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffeb3b })
);
sunGroup.add(sunCore);
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(2.8, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffd54f,
    transparent: true,
    opacity: 0.3,
  })
);
sunGroup.add(sunGlow);
sunGroup.position.set(-28, 22, 12);
scene.add(sunGroup);

// ---------- CLOUDS ----------
const clouds = [];
function makeCloud(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    emissive: 0x90a4ae,
    emissiveIntensity: 0.05,
  });
  const puffCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < puffCount; i++) {
    const s = 1 + Math.random() * 1.2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 12), mat);
    puff.position.set(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 2.5
    );
    puff.castShadow = true;
    group.add(puff);
  }
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  group.userData.driftSpeed = 0.5 + Math.random() * 0.4;
  group.userData.baseX = x;
  scene.add(group);
  clouds.push(group);
  return group;
}

makeCloud(8, 16, -2, 1.2);
makeCloud(15, 18, 6, 1.0);
makeCloud(-2, 17, 8, 1.1);
makeCloud(-12, 18, -5, 0.9);
const rainCloud = makeCloud(14, 16, 4, 1.3); // primary rain cloud over mountain

// ---------- RAIN (cartoon teardrop sprites) ----------
// Each drop is a single point rendered with a teardrop canvas texture.
const dropCanvas = document.createElement('canvas');
dropCanvas.width = 64; dropCanvas.height = 96;
{
  const c = dropCanvas.getContext('2d');
  c.clearRect(0, 0, 64, 96);
  // Filled teardrop body
  c.fillStyle = '#29b6f6';
  c.beginPath();
  c.moveTo(32, 6);
  c.bezierCurveTo(60, 50, 52, 88, 32, 88);
  c.bezierCurveTo(12, 88, 4, 50, 32, 6);
  c.fill();
  // Darker outline
  c.strokeStyle = '#0277bd';
  c.lineWidth = 3;
  c.stroke();
  // White highlight inside
  c.fillStyle = 'rgba(255, 255, 255, 0.55)';
  c.beginPath();
  c.ellipse(24, 52, 4, 11, -0.2, 0, Math.PI * 2);
  c.fill();
}
const dropTex = new THREE.CanvasTexture(dropCanvas);

// TEARDROP SPRITE droplets — each rain drop is a single point rendered with
// the cyan teardrop canvas texture. Slow fall so motion is clearly visible.
const RAIN_COUNT = 140;
const rainGeo = new THREE.BufferGeometry();
const rainPositions = new Float32Array(RAIN_COUNT * 3);
const rainVelocities = new Float32Array(RAIN_COUNT);
const rainSpawn = { x0: 8, dx: 28, z0: 2, dz: 26 };
function seedRainDrop(i, full = true) {
  rainPositions[i * 3]     = rainSpawn.x0 + (Math.random() - 0.5) * rainSpawn.dx;
  rainPositions[i * 3 + 1] = full ? Math.random() * 14 + 5 : 16 + Math.random() * 3;
  rainPositions[i * 3 + 2] = rainSpawn.z0 + (Math.random() - 0.5) * rainSpawn.dz;
  // Faster fall so motion is clearly visible
  rainVelocities[i] = 0.10 + Math.random() * 0.08;
}
for (let i = 0; i < RAIN_COUNT; i++) seedRainDrop(i, true);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.PointsMaterial({
  map: dropTex,
  size: 1.4,
  transparent: true,
  alphaTest: 0.05,
  depthWrite: false,
  sizeAttenuation: true,
});
const rain = new THREE.Points(rainGeo, rainMat);
scene.add(rain);

// Splash markers — small expanding rings on the ground when drops land
const SPLASH_COUNT = 40;
const splashPool = [];
const splashGeo = new THREE.RingGeometry(0.05, 0.18, 12);
splashGeo.rotateX(-Math.PI / 2);
for (let i = 0; i < SPLASH_COUNT; i++) {
  const m = new THREE.Mesh(
    splashGeo,
    new THREE.MeshBasicMaterial({
      color: 0xbbdefb, transparent: true, opacity: 0, depthWrite: false,
    })
  );
  m.visible = false;
  m.userData = { age: 0, life: 0 };
  scene.add(m);
  splashPool.push(m);
}
function spawnSplash(x, y, z) {
  const s = splashPool.find(p => !p.visible);
  if (!s) return;
  s.position.set(x, y + 0.02, z);
  s.scale.setScalar(1);
  s.material.opacity = 0.9;
  s.userData.age = 0;
  s.userData.life = 0.35 + Math.random() * 0.15;
  s.visible = true;
}

// ---------- EVAPORATION PARTICLES (over ocean rising up) ----------
const EVAP_COUNT = 250;
const evapGeo = new THREE.BufferGeometry();
const evapPositions = new Float32Array(EVAP_COUNT * 3);
const evapVel = new Float32Array(EVAP_COUNT);
const evapLife = new Float32Array(EVAP_COUNT);
for (let i = 0; i < EVAP_COUNT; i++) {
  evapPositions[i * 3] = -22 + (Math.random() - 0.5) * 18;
  evapPositions[i * 3 + 1] = 0 + Math.random() * 18;
  evapPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  evapVel[i] = 0.03 + Math.random() * 0.05;
  evapLife[i] = Math.random();
}
evapGeo.setAttribute('position', new THREE.BufferAttribute(evapPositions, 3));
const evapMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.45,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
const evap = new THREE.Points(evapGeo, evapMat);
scene.add(evap);

// ---------- TRANSPIRATION (vapor rising from tree clusters) ----------
// Natural-cycle piece that was missing — plants release water vapor to the
// atmosphere, complementing ocean evaporation.
const TREE_VAPOR_SOURCES = [
  { x: -7, z: 2 },   // riverside grove
  { x: 5, z: 11 },   // small-mountain side
  { x: 16, z: -13 }, // east plain
  { x: 0, z: -14 },  // far south plain
];
const TRANS_COUNT = 200;
const transGeo = new THREE.BufferGeometry();
const transPositions = new Float32Array(TRANS_COUNT * 3);
const transVel = new Float32Array(TRANS_COUNT);
function seedTransParticle(i, reset = false) {
  const src = TREE_VAPOR_SOURCES[i % TREE_VAPOR_SOURCES.length];
  transPositions[i * 3]     = src.x + (Math.random() - 0.5) * 4;
  transPositions[i * 3 + 1] = reset ? 3 + Math.random() * 0.5 : 3 + Math.random() * 6;
  transPositions[i * 3 + 2] = src.z + (Math.random() - 0.5) * 4;
  transVel[i] = 0.02 + Math.random() * 0.025;
}
for (let i = 0; i < TRANS_COUNT; i++) seedTransParticle(i);
transGeo.setAttribute('position', new THREE.BufferAttribute(transPositions, 3));
const transMat = new THREE.PointsMaterial({
  color: 0xc8e6c9,
  size: 0.35,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
const transpiration = new THREE.Points(transGeo, transMat);
scene.add(transpiration);

// ---------- URBAN WATER LINKS ----------
// Drinking-water supply pipe (river -> town) and stormwater drain (town -> river).
function buildPipe(from, to, color, radius = 0.18) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, length, 10);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.55,
    emissive: color, emissiveIntensity: 0.15,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  // Default cylinder is Y-aligned; rotate to align with `dir`.
  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3().crossVectors(up, dir.clone().normalize());
  const angle = Math.acos(up.dot(dir.clone().normalize()));
  if (axis.lengthSq() > 1e-6) mesh.setRotationFromAxisAngle(axis.normalize(), angle);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
// Water supply: from main river (z≈0.5 at x=-5.5) up to village south edge.
// Village houses span roughly z=10.5 to 15.5, so end the pipe at z=10.5.
buildPipe(
  new THREE.Vector3(-5.5, -0.55, 21.2),
  new THREE.Vector3(-6.5, -0.50, 12.0),
  0x4fc3f7, 0.26
);
// Stormwater drain: village south-east corner → river bend.
// Moved EAST of the east-avenue road (x=-9.5) so the pipe doesn't lay over
// or cross any of the new paved roads around the city.
buildPipe(
  new THREE.Vector3(-8.3, -0.50, 12.0),
  new THREE.Vector3(-10.5, -0.55, 21.2),
  0x546e7a, 0.30
);

// ---------- SUN RAYS (down arrows over ocean) ----------
function buildSunRays() {
  const group = new THREE.Group();
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xffb74d,
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < 6; i++) {
    const ray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.15, 3, 6),
      rayMat
    );
    const angle = (i / 6) * Math.PI * 2;
    ray.position.set(-22 + Math.cos(angle) * 4, 10, Math.sin(angle) * 4);
    ray.rotation.x = Math.PI;
    group.add(ray);
    // arrowhead
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.6, 6),
      rayMat
    );
    head.position.copy(ray.position);
    head.position.y -= 1.8;
    head.rotation.x = Math.PI;
    group.add(head);
  }
  group.userData.basePositions = group.children.map(c => c.position.y);
  scene.add(group);
  return group;
}
const sunRays = buildSunRays();

// ---------- LAND-SOURCE EVAPORATION ARROWS ----------
// Per the AEE/Murray-Darling reference: evaporation isn't only from the ocean.
// Big orange upward arrows mark vapor rising from vegetation, streams, fields,
// and soil — each animated to pulse so they read as rising vapor, not static.
const evapArrows = [];
function makeArrowLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeText(text, 160, 40);
  ctx.fillStyle = '#e65100';
  ctx.fillText(text, 160, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.6, 1); // smaller so neighbors don't overlap
  sprite.renderOrder = 999;
  return sprite;
}
function buildEvapArrow(wx, wz, height = 4) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff9800,
    emissive: 0xff6f00,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.85,
    roughness: 0.5,
  });
  // Slightly wavy shaft so each arrow reads as a rising plume of vapor
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,    0,            0),
    new THREE.Vector3(0.25, height * 0.3, 0),
    new THREE.Vector3(-0.2, height * 0.6, 0),
    new THREE.Vector3(0.15, height,       0),
  ]);
  const shaftGeo = new THREE.TubeGeometry(curve, 24, 0.22, 10, false);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.castShadow = false;
  group.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.95, 14), mat);
  head.position.set(0.15, height + 0.45, 0);
  group.add(head);
  group.position.set(wx, sampleTerrainY(wx, wz) + 0.05, wz);
  group.userData.basePhase = Math.random() * Math.PI * 2;
  group.userData.baseScaleY = 1;
  scene.add(group);
  evapArrows.push(group);
  return group;
}
// Clustered in the FRONT-EAST corner. 4-unit z-spacing + alternating shaft
// height so the labels don't pile on top of each other when projected.
buildEvapArrow(0.5, 17.0, 4.8); // FROM SOIL — moved to former A/B/C gully area
buildEvapArrow(22, 3,   6.0);  // FROM STREAMS — taller shaft so label sits higher
buildEvapArrow(24.5, 0.8, 3.2);  // FROM LAKES — moved north so the lake sits behind the stream head
buildEvapArrow(0, -10,  3.8);  // FROM FIELDS — over the field_garden model
buildEvapArrow(22, -13, 5.0); // FROM VEGETATION — over the mountain-back forest cluster

// Source patches beneath each evap arrow — each arrow visually originates
// from a small representation of the thing it's evaporating from.
function buildArrowSource(x, z, kind) {
  const yT = sampleTerrainY(x, z);
  if (kind === 'soil') {
    const isFrontSoil = Math.abs(x - 0.5) < 0.01 && Math.abs(z - 17.0) < 0.01;
    const m = new THREE.Mesh(
      isFrontSoil
        ? new THREE.BoxGeometry(4.6, 0.12, 4.6)
        : new THREE.CylinderGeometry(1.5, 1.5, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
    );
    m.position.set(x, yT + 0.04, z); m.receiveShadow = true; scene.add(m);
  } else if (kind === 'stream') {
    // Round source pool so the river's headwater reads as a circular
    // spring/pond rather than a rectangular patch.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 36),
      new THREE.MeshStandardMaterial({
        color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.4, roughness: 0.3,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, yT + 0.07, z);
    scene.add(pool);
    // Lighter ripple ring inside the pool for visual "bubbling up" effect
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.78, 24),
      new THREE.MeshStandardMaterial({
        color: 0xb3e5fc, emissive: 0x4fc3f7, emissiveIntensity: 0.7,
        transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      })
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(x, yT + 0.08, z);
    scene.add(ripple);
    // Sandy/pebbly rim so the pool looks like a contained source
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.62, 36),
      new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, yT + 0.065, z);
    scene.add(rim);
  } else if (kind === 'field') {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.08, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
    );
    base.position.set(x, yT + 0.05, z); base.receiveShadow = true; scene.add(base);
    // Crop rows
    for (let i = 0; i < 5; i++) {
      const row = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x6d4c41 })
      );
      row.position.set(x, yT + 0.13, z - 0.8 + i * 0.4); scene.add(row);
    }
  } else if (kind === 'lake') {
    const isEvapLake = Math.abs(x - 24.5) < 0.01 && Math.abs(z - 2.8) < 0.01;
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(isEvapLake ? 1.25 : 1.3, 36),
      new THREE.MeshStandardMaterial({
        color: 0x1e88e5, emissive: 0x1976d2, emissiveIntensity: 0.4,
        roughness: 0.25, metalness: 0,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, yT + 0.07, z); scene.add(m);
    // Small "shore" ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(isEvapLake ? 1.25 : 1.3, isEvapLake ? 1.45 : 1.55, 36),
      new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, yT + 0.06, z); scene.add(ring);
  }
}
buildArrowSource(0.5, 17.0, 'soil');
// Grass band running from the FROM SOIL arrow east toward the industrial
// fence (~x=11), so the moist ground reads as a continuous strip rather
// than a small spot. Random jitter keeps it natural-looking.
for (let gx = -2.2; gx <= 10.6; gx += 0.55) {
  for (let lane = 0; lane < 4; lane++) {
    const gz = 15.4 + lane * 0.95 + (Math.random() - 0.5) * 0.35;
    const jx = gx + (Math.random() - 0.5) * 0.4;
    if (jx > 10.6) continue; // don't overlap the industrial fence
    _tallGrassMaker(jx, gz);
  }
}
// FROM STREAMS source is now the head of the east tributary (see river network)
buildArrowSource(22, 3,   'stream');
// Lake moved with the NBS cluster — close to school
buildArrowSource(24.5, 0.8, 'lake');

// ---------- RICE PADDIES (replaces the field_garden GLTF) ----------
// Grid of shallow-flooded plots with rice plants, raised earth dikes
// between them. Sits where the FROM FIELDS arrow points.
function buildRicePaddies(cx, cz, width = 12, depth = 9, cols = 3, rows = 2) {
  const g = new THREE.Group();
  const yT = sampleTerrainY(cx, cz);
  const dikeMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4dd0e1, emissive: 0x00838f, emissiveIntensity: 0.35,
    roughness: 0.25, metalness: 0.1,
  });
  const riceMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.85 });
  const tallRiceMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.85 });
  const dikeW = 0.4;
  const plotW = (width - dikeW * (cols + 1)) / cols;
  const plotD = (depth - dikeW * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = -width / 2 + dikeW + c * (plotW + dikeW) + plotW / 2;
      const pz = -depth / 2 + dikeW + r * (plotD + dikeW) + plotD / 2;
      // Shallow water surface
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(plotW, 0.1, plotD), waterMat
      );
      water.position.set(px, 0.18, pz);
      water.receiveShadow = true;
      g.add(water);
      // Rice plants — small green cones in a roughly regular grid
      const riceCols = 8, riceRows = 5;
      for (let i = 0; i < riceCols; i++) {
        for (let j = 0; j < riceRows; j++) {
          if (Math.random() < 0.18) continue;
          const rx = px - plotW / 2 + (i + 0.5) * (plotW / riceCols) + (Math.random() - 0.5) * 0.08;
          const rz = pz - plotD / 2 + (j + 0.5) * (plotD / riceRows) + (Math.random() - 0.5) * 0.08;
          const useTall = Math.random() < 0.4;
          const rice = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.32 + Math.random() * 0.1, 5),
            useTall ? tallRiceMat : riceMat
          );
          rice.position.set(rx, 0.35, rz);
          g.add(rice);
        }
      }
    }
  }
  // Earth dikes (raised borders) — vertical and horizontal
  for (let c = 0; c <= cols; c++) {
    const dx = -width / 2 + c * (plotW + dikeW) + dikeW / 2;
    const dike = new THREE.Mesh(
      new THREE.BoxGeometry(dikeW, 0.28, depth), dikeMat
    );
    dike.position.set(dx, 0.18, 0);
    dike.castShadow = true;
    dike.receiveShadow = true;
    g.add(dike);
  }
  for (let r = 0; r <= rows; r++) {
    const dz = -depth / 2 + r * (plotD + dikeW) + dikeW / 2;
    const dike = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.28, dikeW), dikeMat
    );
    dike.position.set(0, 0.18, dz);
    dike.castShadow = true;
    dike.receiveShadow = true;
    g.add(dike);
  }
  g.position.set(cx, yT, cz);
  scene.add(g);
  return g;
}
buildRicePaddies(-2, -10, 12, 9);

// ---------- PONDS (nature-based water-storage features) ----------
// Modeled on the AEE "Ponds: Nature-based Solutions" reference: two ponds
// with sandy shores placed next to the FROM LAKES source.
function buildPond(x, z, radius = 2.0) {
  const yT = sampleTerrainY(x, z);
  // Water surface
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 36),
    new THREE.MeshStandardMaterial({
      color: 0x1e88e5,
      emissive: 0x1976d2,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, yT + 0.08, z);
  water.receiveShadow = true;
  scene.add(water);
  // Sandy shore ring
  const shore = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.45, 36),
    new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(x, yT + 0.07, z);
  scene.add(shore);

  const reedMat = new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.85 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.25;
    const r = radius + 0.25 + Math.random() * 0.25;
    const rx = x + Math.cos(a) * r;
    const rz = z + Math.sin(a) * r;
    if (i % 3 === 0) {
      const rock = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.07, 8, 6), rockMat);
      rock.position.set(rx, sampleTerrainY(rx, rz) + 0.13, rz);
      rock.scale.set(1.4, 0.45, 1.0);
      rock.castShadow = true;
      scene.add(rock);
    } else {
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.45 + Math.random() * 0.25, 5), reedMat);
      reed.position.set(rx, sampleTerrainY(rx, rz) + 0.25, rz);
      reed.rotation.z = (Math.random() - 0.5) * 0.25;
      scene.add(reed);
    }
  }
}
buildPond(17, 6.5, 1.45); // POND1 — close to stream evaporation
buildPond(22, 7.5, 0.95); // POND2 — beside stream evaporation, away from dump

// (Recreational area, benches, and picnic tables removed entirely — the
//  buildBench / buildPicnicTable / buildRecreationalArea function
//  definitions were deleted so nothing wooden can render near the C arrow.)

// Water channels connecting POND1 ↔ POND2 ↔ FROM LAKES source.
function buildChannel(fromX, fromZ, toX, toZ, width = 0.32) {
  const dx = toX - fromX, dz = toZ - fromZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (fromX + toX) / 2, midZ = (fromZ + toZ) / 2;
  // Sandy bank under the channel
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.035, width + 0.18),
    new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
  );
  bank.position.set(midX, sampleTerrainY(midX, midZ) + 0.06, midZ);
  bank.rotation.y = -angle;
  bank.receiveShadow = true;
  scene.add(bank);
  // Water on top
  const channel = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.04, width),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.4,
      roughness: 0.25, metalness: 0,
    })
  );
  channel.position.set(midX, sampleTerrainY(midX, midZ) + 0.09, midZ);
  channel.rotation.y = -angle;
  scene.add(channel);
}

// ---------- POND ↔ RIVER / LAKE CONNECTIONS ----------
// Clean blue water ribbons that read as continuous flow between the
// east tributary, both ponds, and the lake source. No sandy bank — the
// ribbon sits slightly above terrain so it visually masks any gap.
function buildPlainWaterLink(fromX, fromZ, toX, toZ, width = 0.6) {
  const dx = toX - fromX, dz = toZ - fromZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (fromX + toX) / 2, midZ = (fromZ + toZ) / 2;
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.05, width),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.45,
      roughness: 0.25, metalness: 0,
    })
  );
  water.position.set(midX, sampleTerrainY(midX, midZ) + 0.13, midZ);
  water.rotation.y = -angle;
  scene.add(water);
  // A small light-blue inlet ring at each end so the connection visibly
  // "merges" with the pond/river instead of just butting into a shore.
  [[fromX, fromZ], [toX, toZ]].forEach(([px, pz]) => {
    const inlet = new THREE.Mesh(
      new THREE.CircleGeometry(width * 0.75, 18),
      new THREE.MeshStandardMaterial({
        color: 0x4fc3f7, emissive: 0x0288d1, emissiveIntensity: 0.4,
        roughness: 0.25,
      })
    );
    inlet.rotation.x = -Math.PI / 2;
    inlet.position.set(px, sampleTerrainY(px, pz) + 0.135, pz);
    scene.add(inlet);
  });
}
// 1) East tributary → POND1 (north inlet, overshoots both ends to merge)
buildPlainWaterLink(17.0, 1.6, 17.0, 4.6, 0.95);
// 2) POND1 ↔ POND2 (wide flowing connector between the two ponds)
buildPlainWaterLink(19.0, 7.0, 20.7, 7.5, 1.10);
// 3) POND2 → LAKE source (south-east outflow toward the lake)
buildPlainWaterLink(22.7, 6.5, 24.3, 1.3, 0.85);
// 4) LAKE source → east tributary head (so the loop closes back to the river)
buildPlainWaterLink(24.0, 1.2, 22.5, 2.8, 0.75);
// 5) POND1 west outlet → middle-tier of the TIED RIDGES (agroforestry terrace).
//    Two segments so the channel meets the terrace edge head-on (x≈8.5)
//    instead of stopping short in open ground.
buildPlainWaterLink(14.6, 7.0, 11.5, 7.0, 0.85);  // POND1 → mid plain
buildPlainWaterLink(11.5, 7.0,  8.5, 7.0, 0.75);  // mid plain → terrace east edge
// Grass tufts lining both banks of the POND1 ↔ TIED RIDGES channel.
for (let gx = 8.6; gx <= 14.4; gx += 0.55) {
  // North bank (above the channel, z < 7)
  _tallGrassMaker(gx + (Math.random() - 0.5) * 0.2, 6.30 + (Math.random() - 0.5) * 0.2);
  _tallGrassMaker(gx + (Math.random() - 0.5) * 0.2, 6.55 + (Math.random() - 0.5) * 0.15);
  // South bank (below the channel, z > 7)
  _tallGrassMaker(gx + (Math.random() - 0.5) * 0.2, 7.45 + (Math.random() - 0.5) * 0.15);
  _tallGrassMaker(gx + (Math.random() - 0.5) * 0.2, 7.70 + (Math.random() - 0.5) * 0.2);
}
// A few wildflower clumps for colour along the banks
[[10.0, 6.25], [12.5, 7.75], [13.7, 6.30], [9.5, 7.78]].forEach(([fx, fz]) =>
  _flowerClusterMaker(fx, fz)
);

function buildPondRecreationStrip() {
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xd7b46a, roughness: 0.95 });
  [
    { x: 18.8, z: 9.6, w: 5.7, d: 0.24, yaw: 0.08 },
    { x: 20.6, z: 5.0, w: 4.2, d: 0.22, yaw: -0.12 },
  ].forEach(p => {
    const path = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.03, p.d), pathMat);
    path.position.set(p.x, sampleTerrainY(p.x, p.z) + 0.11, p.z);
    path.rotation.y = p.yaw;
    path.receiveShadow = true;
    scene.add(path);
  });
}
buildPondRecreationStrip();

// ---------- FISH (animated, swim in circles within water bodies) ----------
const fishMeshes = [];
function makeFish(centerX, centerZ, waterY, radius = 1.0, color = 0xff7043, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.2,
    emissive: color, emissiveIntensity: 0.5,
  });
  // Body: stretched ellipsoid (sphere scaled)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat);
  body.scale.set(2.0, 1.0, 0.7);
  g.add(body);
  // Tail fin (triangular)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 4), mat);
  tail.position.x = -0.55;
  tail.rotation.z = Math.PI / 2;
  tail.scale.set(1, 1, 0.35);
  g.add(tail);
  // Top dorsal fin
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 3), mat);
  fin.position.set(-0.05, 0.22, 0);
  fin.scale.set(1.6, 1, 0.35);
  g.add(fin);
  // Eye dot for character
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x000000 })
  );
  eye.position.set(0.32, 0.05, 0.16);
  g.add(eye);
  g.scale.setScalar(scale);
  g.userData = {
    cx: centerX, cz: centerZ, y: waterY, radius,
    radiusX: radius,
    radiusZ: radius * (0.62 + Math.random() * 0.22),
    speed: 0.18 + Math.random() * 0.22,
    phase: Math.random() * Math.PI * 2,
    tail,
  };
  scene.add(g);
  fishMeshes.push(g);
  return g;
}

// POND1 — fish scale 1.5 so they're clearly visible from default cam
const _pondY1 = sampleTerrainY(17, 6.5) + 0.16;
const _pondY2 = sampleTerrainY(22, 7.5) + 0.16;
// Pond fish scaled down — at 1.x they looked oversized for the small ponds.
makeFish(17, 6.5, _pondY1, 0.68, 0xff5722, 0.55);
makeFish(17, 6.5, _pondY1, 0.44, 0xff9800, 0.45);
makeFish(17, 6.5, _pondY1, 0.56, 0xffb74d, 0.50);
// POND2 — 2 fish (also scaled down)
makeFish(22, 7.5, _pondY2, 0.30, 0xef5350, 0.45);
makeFish(22, 7.5, _pondY2, 0.22, 0xff7043, 0.40);
// Ocean fish — bigger, brighter for visibility
makeFish(-22, 0,  0.20, 4.0, 0xffeb3b, 2.0);  // yellow
makeFish(-25, 8,  0.20, 3.0, 0xff5722, 1.8);  // bright orange
makeFish(-28, -8, 0.20, 4.5, 0xe91e63, 2.0);  // pink
makeFish(-20, 12, 0.20, 2.5, 0xfdd835, 1.6);  // yellow-gold
makeFish(-19, -9, 0.22, 1.8, 0x00e5ff, 1.3);  // shallow-water fish near beach
makeFish(-19, 7,  0.22, 1.6, 0x76ff03, 1.2);  // shallow-water fish near beach

// ---------- AGROFORESTRY TERRACE ----------
// Soil-conservation feature from the reference: stepped soil tiers with
// trees + crops on top, tied ridges holding rainwater in the middle, and
// forage crops along the bottom. Captures runoff & promotes infiltration.
function buildAgroforestryTerrace(cx, cz) {
  const yT = sampleTerrainY(cx, cz);
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 });
  const cropMat = new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.9 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.85 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.45, roughness: 0.25,
  });

  // Three stepped tiers along z, ~1.7x bigger than before
  const w = 9.0, h = 0.45, d = 2.4, gap = 2.4;
  const tiers = [
    { z: cz - gap, y: yT + h * 1.5 },
    { z: cz,       y: yT + h * 1.0 },
    { z: cz + gap, y: yT + h * 0.5 },
  ];
  tiers.forEach(t => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), soilMat);
    block.position.set(cx, t.y, t.z);
    block.receiveShadow = true;
    scene.add(block);
  });

  // Top tier: bushy DECIDUOUS trees at the back + TWO golden wheat rows in front
  // Wider spacing + larger z-jitter so trees don't merge into one continuous canopy.
  for (let i = 0; i < 6; i++) {
    makeDeciduousTree(
      cx - 3.75 + i * 1.5 + (Math.random() - 0.5) * 0.4,
      tiers[0].z - 0.65 + (Math.random() - 0.5) * 0.5,
      0.55 + Math.random() * 0.35
    );
  }
  // Wheat row 1 (front of trees, taller)
  for (let i = 0; i < 22; i++) {
    const crop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 5), cropMat);
    crop.position.set(cx - 4.2 + i * 0.4, tiers[0].y + 0.36, tiers[0].z + 0.9);
    crop.castShadow = true;
    scene.add(crop);
  }
  // Wheat row 2 (slightly behind row 1, alternating offset)
  for (let i = 0; i < 22; i++) {
    const crop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 5), cropMat);
    crop.position.set(cx - 4.0 + i * 0.4, tiers[0].y + 0.34, tiers[0].z + 0.5);
    crop.castShadow = true;
    scene.add(crop);
  }

  // Middle tier: TIED RIDGES — 8 berms + 7 water strips between them
  for (let i = 0; i < 8; i++) {
    const ridgeX = cx - 3.5 + i * 1.0;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.26, 2.0), soilMat);
    ridge.position.set(ridgeX, tiers[1].y + 0.35, tiers[1].z);
    ridge.castShadow = true;
    scene.add(ridge);
  }
  for (let i = 0; i < 7; i++) {
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.7), waterMat);
    water.position.set(cx - 3.0 + i * 1.0, tiers[1].y + 0.27, tiers[1].z);
    scene.add(water);
  }

  // Bottom tier: dense forage grass + scattered maize-like tall plants
  for (let i = 0; i < 40; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.65, 5), greenMat);
    blade.position.set(
      cx - 4.2 + i * 0.22 + (Math.random() - 0.5) * 0.2,
      tiers[2].y + 0.4,
      tiers[2].z + (Math.random() - 0.5) * 1.6
    );
    scene.add(blade);
  }
  // A back-row of taller maize-like plants
  for (let i = 0; i < 16; i++) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.85, 5),
      new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 0.85 })
    );
    stalk.position.set(cx - 4.2 + i * 0.55, tiers[2].y + 0.5, tiers[2].z - 0.6);
    stalk.castShadow = true;
    scene.add(stalk);
  }
}
buildAgroforestryTerrace(4, 7);  // close to school, but not crowding it

function buildFieldWorker(x, y, z, yaw = 0, shirtColor = 0x1976d2, tool = 'hoe') {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb87545, roughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.9 });
  const toolMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.55, metalness: 0.25 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.46, 8), shirtMat);
  body.position.y = 0.55;
  body.rotation.z = tool === 'hoe' ? -0.12 : 0;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skinMat);
  head.position.y = 0.9;
  head.castShadow = true;
  g.add(head);

  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0xfdd835, roughness: 0.85 })
  );
  hat.position.y = 1.03;
  hat.castShadow = true;
  g.add(hat);

  [-1, 1].forEach(side => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 7), pantsMat);
    leg.position.set(side * 0.045, 0.18, 0);
    leg.rotation.z = side * 0.08;
    leg.castShadow = true;
    g.add(leg);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.36, 6), skinMat);
    arm.position.set(side * 0.15, 0.58, 0);
    arm.rotation.z = side * (tool === 'hoe' ? 0.75 : 0.35);
    arm.castShadow = true;
    g.add(arm);
  });

  if (tool === 'basket') {
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.13, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 })
    );
    basket.position.set(0.26, 0.45, 0);
    basket.rotation.z = Math.PI / 2;
    basket.castShadow = true;
    g.add(basket);
  } else if (tool === 'sack') {
    const sack = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc49a5a, roughness: 1 })
    );
    sack.scale.set(0.9, 1.25, 0.72);
    sack.position.set(0.26, 0.42, 0);
    sack.castShadow = true;
    g.add(sack);
  } else {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.0, 5), toolMat);
    handle.position.set(0.28, 0.48, 0);
    handle.rotation.z = -0.72;
    handle.castShadow = true;
    g.add(handle);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.12), metalMat);
    blade.position.set(0.62, 0.08, 0);
    blade.rotation.z = -0.35;
    blade.castShadow = true;
    g.add(blade);
  }

  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.scale.setScalar(0.82);
  scene.add(g);
  return g;
}

const _terraceBaseY = sampleTerrainY(4, 7);
const _terraceTierH = 0.45;
const _tiedRidgeWorkerY = _terraceBaseY + _terraceTierH * 1.5;
const _forageWorkerY = _terraceBaseY + _terraceTierH * 1.05;
[
  { x: 1.2, z: 6.35, y: _tiedRidgeWorkerY, yaw: -0.35, color: 0x8d6e63, tool: 'hoe' },
  { x: 4.9, z: 7.65, y: _tiedRidgeWorkerY, yaw: 2.65, color: 0x6d4c41, tool: 'hoe' },
  { x: 2.6, z: 9.25, y: _forageWorkerY, yaw: 0.65, color: 0x78909c, tool: 'basket' },
  { x: 6.25, z: 9.75, y: _forageWorkerY, yaw: -1.45, color: 0x795548, tool: 'sack' },
  { x: 3.7, z: 8.95, y: _forageWorkerY, yaw: 1.9, color: 0xa1887f, tool: 'hoe' },
].forEach(w => buildFieldWorker(w.x, w.y, w.z, w.yaw, w.color, w.tool));

const _ricePaddyWorkerY = sampleTerrainY(-2, -10) + 0.22;
[
  { x: -6.9, z: -10.45, yaw: 0.35, color: 0x8d6e63, tool: 'hoe' },
  { x: -3.9, z: -13.7, yaw: 2.2, color: 0xa1887f, tool: 'basket' },
  { x: -0.1, z: -10.35, yaw: -0.75, color: 0x6d4c41, tool: 'hoe' },
  { x: 2.7, z: -6.65, yaw: 1.6, color: 0x78909c, tool: 'sack' },
  { x: -5.4, z: -6.8, yaw: -2.4, color: 0x795548, tool: 'hoe' },
].forEach(w => buildFieldWorker(w.x, _ricePaddyWorkerY, w.z, w.yaw, w.color, w.tool));

function buildSmallFieldBird(x, z, scale = 1, yaw = 0, bodyColor = 0x455a64, wingColor = 0x795548) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85 });
  const wingMat = new THREE.MeshStandardMaterial({ color: wingColor, roughness: 0.85 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 7), bodyMat);
  body.scale.set(1.3, 0.72, 0.86);
  body.position.y = 0.25;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bodyMat);
  head.position.set(0.14, 0.31, 0);
  head.castShadow = true;
  g.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 8), beakMat);
  beak.position.set(0.22, 0.31, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);

  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 5), wingMat);
    wing.scale.set(0.35, 0.18, 1.05);
    wing.position.set(-0.01, 0.24, side * 0.085);
    wing.castShadow = true;
    g.add(wing);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 5), legMat);
    leg.position.set(0.02, 0.08, side * 0.035);
    g.add(leg);
  });

  g.position.set(x, sampleTerrainY(x, z) + 0.02, z);
  g.scale.setScalar(scale);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

// Small birds on the grass beside the road shoulder.
[
  { x: 0.7, z: 12.35, s: 0.75, yaw: 0.2, body: 0x263238, wing: 0x8d6e63 },
  { x: 2.4, z: 12.18, s: 0.68, yaw: 1.1, body: 0x5d4037, wing: 0xa1887f },
  { x: 4.0, z: 12.42, s: 0.72, yaw: -0.5, body: 0x37474f, wing: 0x795548 },
  { x: 5.8, z: 12.22, s: 0.64, yaw: 2.4, body: 0x6d4c41, wing: 0x3e2723 },
  { x: 7.4, z: 12.38, s: 0.7, yaw: -1.6, body: 0x455a64, wing: 0x8d6e63 },
].forEach(b => buildSmallFieldBird(b.x, b.z, b.s, b.yaw, b.body, b.wing));

// More ground birds scattered on open grass near roads and pond paths.
[
  { x: -2.2, z: 14.85, s: 0.66, yaw: 0.7, body: 0x4e342e, wing: 0x9e9d24 },
  { x: -0.6, z: 15.05, s: 0.62, yaw: -1.0, body: 0x37474f, wing: 0x8d6e63 },
  { x: 1.4, z: 14.82, s: 0.7, yaw: 2.7, body: 0x6d4c41, wing: 0x3e2723 },
  { x: 3.7, z: 15.08, s: 0.64, yaw: -2.2, body: 0x263238, wing: 0x795548 },
  { x: 6.4, z: 14.9, s: 0.68, yaw: 1.8, body: 0x455a64, wing: 0xa1887f },
  { x: 18.4, z: 9.85, s: 0.6, yaw: 0.45, body: 0x5d4037, wing: 0x8d6e63 },
  { x: 20.0, z: 9.45, s: 0.58, yaw: -0.75, body: 0x37474f, wing: 0x795548 },
].forEach(b => buildSmallFieldBird(b.x, b.z, b.s, b.yaw, b.body, b.wing));

// ---------- IRRIGATION CHANNELS ----------
// Small yellow/orange surface stripes near the field garden, like the
// reference's irrigation-channel lines crossing the ground.
function buildIrrigationChannels() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffb74d,
    emissive: 0xff9800,
    emissiveIntensity: 0.35,
    roughness: 0.6,
  });
  const channels = [
    { x: 2, z: -10, len: 7, rot: 0 },
    { x: 2, z: -8.5, len: 7, rot: 0 },
    { x: 2, z: -11.5, len: 7, rot: 0 },
    { x: 4.5, z: -10, len: 4, rot: Math.PI / 2 },
    { x: -0.5, z: -10, len: 4, rot: Math.PI / 2 },
  ];
  channels.forEach(c => {
    const geo = new THREE.BoxGeometry(c.len, 0.05, 0.25);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(c.x, sampleTerrainY(c.x, c.z) + 0.08, c.z);
    mesh.rotation.y = c.rot;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}
buildIrrigationChannels();

// ---------- FARM PROPS (procedural) ----------
// Stylised tractor, dam/weir, and windmill — matches the reference's
// "human activity in the landscape" without needing Sketchfab downloads.

function buildTractor(x, z, yaw = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.6, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 })
  );
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.6 })
  );
  cab.position.set(-0.25, 1.0, 0); cab.castShadow = true; g.add(cab);
  // Window strip
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.25, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.2, metalness: 0.5 })
  );
  win.position.set(-0.25, 1.05, 0); g.add(win);
  // Wheels
  const wmat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.95 });
  [[-0.45, 0.27, 0.45], [-0.45, 0.27, -0.45],
   [0.5, 0.4, 0.5], [0.5, 0.4, -0.5]].forEach((p, i) => {
    const r = i < 2 ? 0.27 : 0.4;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 14), wmat);
    w.position.set(p[0], p[1], p[2]); w.rotation.x = Math.PI / 2;
    w.castShadow = true; g.add(w);
  });
  // Exhaust stack
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.65, 8),
    new THREE.MeshStandardMaterial({ color: 0x424242 })
  );
  stack.position.set(0.3, 1.1, 0); g.add(stack);
  g.position.set(x, sampleTerrainY(x, z) + 0.04, z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

function buildDam(x, z, yaw = 0) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.95 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.85 });
  // Main wall across the river
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 0.7), wallMat);
  wall.position.y = 1.1; wall.castShadow = true; g.add(wall);
  // Spillway gate in center (darker)
  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.8), accentMat);
  gate.position.y = 0.95; g.add(gate);
  // Spillway opening hint
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x1e88e5, emissive: 0x0d47a1, emissiveIntensity: 0.3 })
  );
  opening.position.y = 0.5; g.add(opening);
  // Walkway across the top
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(5.3, 0.18, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.8 })
  );
  walk.position.y = 2.25; g.add(walk);
  // Side towers
  [-2.2, 2.2].forEach(dx => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.7, 0.75), wallMat);
    tower.position.set(dx, 1.35, 0); tower.castShadow = true; g.add(tower);
  });
  g.position.set(x, sampleTerrainY(x, z), z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

const windmillBlades = [];
function buildWindmill(x, z) {
  const g = new THREE.Group();
  // Tower
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 4.5, 12),
    new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.5 })
  );
  tower.position.y = 2.25; tower.castShadow = true; g.add(tower);
  // Nacelle (hub housing)
  const nacelle = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xcfd8dc })
  );
  nacelle.position.set(0, 4.5, 0); g.add(nacelle);
  // Blade hub assembly — rotated each frame around z axis
  const hub = new THREE.Group();
  hub.position.set(0, 4.5, 0.25);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.04), bladeMat);
    blade.position.y = 0.9;
    blade.castShadow = true;
    const bladeGroup = new THREE.Group();
    bladeGroup.add(blade);
    bladeGroup.rotation.z = (i / 3) * Math.PI * 2;
    hub.add(bladeGroup);
  }
  g.add(hub);
  g.position.set(x, sampleTerrainY(x, z), z);
  scene.add(g);
  windmillBlades.push(hub);
  return g;
}

// Placements
buildTractor(7.2, 11.05, -0.18); // beside the planted terrace, just above the road
buildTractor(8, -13, 2.1);    // second tractor on south plain, facing west
// Dam: yaw 1.27 rad rotates the 5-wide wall so it spans ACROSS the river
// (river tangent here is roughly (-0.95, 0, 0.30), so perpendicular yaw ≈ 1.27).
buildDam(9.2, 0.5, 1.30);    // on the main river upstream (moved with new source)
buildWindmill(14, 14, 0);    // open grass north of industrial, clear of roads, between POND1 and terrace

// ---------- FLOW ARROWS (Surface runoff direction) ----------
function makeArrow(from, to, color = 0x26a69a) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const arrow = new THREE.ArrowHelper(
    dir.normalize(),
    from,
    length,
    color,
    1.0,
    0.6
  );
  scene.add(arrow);
  return arrow;
}
// Condensation flow arrow (ocean -> cloud)
makeArrow(new THREE.Vector3(-16, 14, 4), new THREE.Vector3(8, 16, 0), 0xb0bec5);

// ---------- INFILTRATION / PERCOLATION ARROWS (A, B, C) ----------
// Mirrors the cutaway diagram: three labelled arrows piercing down
// through SOIL -> GROUNDWATER -> ROCK on the front cutaway face.
const percolationArrows = [];
function buildPercolationArrows() {
  const labels = ['A', 'B', 'C'];
  const baseX = -5;
  const spacing = 2.4;
  const faceZ = GROUND_D / 2 + 0.15;
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0xeceff1, roughness: 0.4, emissive: 0x90a4ae, emissiveIntensity: 0.25,
  });

  for (let i = 0; i < 3; i++) {
    const x = baseX + i * spacing;
    const group = new THREE.Group();

    // Shaft - spans from just above ground down through all 3 strata
    const shaftHeight = SUB_DEPTH + 1.2;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, shaftHeight, 12),
      arrowMat
    );
    shaft.position.y = 0.6 - shaftHeight / 2;
    group.add(shaft);

    // Arrowhead at bottom (pointing down)
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.9, 14),
      arrowMat
    );
    head.position.y = -SUB_DEPTH - 0.1;
    head.rotation.x = Math.PI;
    group.add(head);

    // Letter label (A/B/C) above ground
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 96px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(labels[i], 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labels[i], 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(labelMat);
    sprite.position.set(0, 1.6, 0);
    sprite.scale.set(1.4, 1.4, 1);
    group.add(sprite);

    group.position.set(x, 0, faceZ);
    group.userData.basePulse = i * 0.5;
    scene.add(group);
    percolationArrows.push(group);
  }
}
buildPercolationArrows();

// ---------- LABELS (DOM overlay) ----------
const labelDefs = [
  { id: 'precip', text: 'Precipitation', pos: new THREE.Vector3(14, 12, 4) },
  { id: 'evap', text: 'Ocean Evaporation', pos: new THREE.Vector3(-22, 12, 0) },
  { id: 'cond', text: 'Condensation', pos: new THREE.Vector3(0, 19, 4) },
  { id: 'runoff', text: 'Surface Runoff', pos: new THREE.Vector3(4, 3.5, 2.5) },
  { id: 'infil', text: 'Infiltration / Percolation', pos: new THREE.Vector3(-7.5, 4.5, 21) },
  { id: 'ocean', text: 'Ocean', pos: new THREE.Vector3(-22, 1, -10) },
  { id: 'mountain', text: 'Mountain', pos: new THREE.Vector3(18, 8, 6) },
  { id: 'transp', text: 'Transpiration', pos: new THREE.Vector3(5, 9, 11) },
  { id: 'supply', text: 'Water Supply', pos: new THREE.Vector3(-5.4, 1.35, 13.4) },
  { id: 'storm',  text: 'Stormwater',  pos: new THREE.Vector3(-9.2, 1.35, 13.4) },
  { id: 'flood',  text: 'Flooding',    pos: new THREE.Vector3(-1, 2.5, -3.5) },
  { id: 'cloudForm', text: 'Cloud Formation', pos: new THREE.Vector3(0, 22, 4) },
  { id: 'fromSoil',  text: 'Soil Evaporation',       pos: new THREE.Vector3(0.5, 5.8, 17.0) },
  { id: 'fromStream',text: 'Stream Evaporation',     pos: new THREE.Vector3(22, 8.8,  3) },
  { id: 'fromVeg',   text: 'Vegetation Evaporation', pos: new THREE.Vector3(22, 6.0, -13) },
  { id: 'fromLake',  text: 'Lake Evaporation',       pos: new THREE.Vector3(24.5, 4.2, 0.8) },
  { id: 'fromField', text: 'Field Evaporation',      pos: new THREE.Vector3(0,  4.8, -10) },
  { id: 'beach',     text: 'Beach',           pos: new THREE.Vector3(-16.8, 1.3, -12) },
  { id: 'coastalCity', text: 'Coastal City',   pos: new THREE.Vector3(-11, 3.4, -12.4) },
  { id: 'mall',      text: 'Mall',            pos: new THREE.Vector3(-8.4, 2.9, -13.8) },
  { id: 'school',    text: 'School',          pos: new THREE.Vector3(-7.2, 2.4, 7.4) },
  { id: 'pond1',     text: 'Pond 1',          pos: new THREE.Vector3(15.4, 2.0, 5.1) },
  { id: 'pond2',     text: 'Pond 2',          pos: new THREE.Vector3(21.2, 2.0, 10.2) },
  { id: 'cropForest',text: 'Crop & Forestry', pos: new THREE.Vector3(4, 3.2, 4.6) },
  { id: 'tiedRidges',text: 'Tied Ridges',     pos: new THREE.Vector3(4, 2.5, 7) },
  { id: 'erosion',   text: 'Erosion Gully',   pos: new THREE.Vector3(12, 4.5, -8) },
  { id: 'erosionControl', text: 'Erosion Control', pos: new THREE.Vector3(12, 3.7, -4.2) },
  { id: 'industrial',text: 'Industrial Area', pos: new THREE.Vector3(15, 4.5, 17) },
  { id: 'dump',      text: 'Industrial Dump', pos: new THREE.Vector3(20.5, 2.6, 17.5) },
  { id: 'harbour',   text: 'Harbour',         pos: new THREE.Vector3(-18.5, 2.5, 0) },
  { id: 'cityscape', text: 'City',            pos: new THREE.Vector3(-12, 9, 13) },
  { id: 'deforest',  text: 'Deforestation',   pos: new THREE.Vector3(8, 3.0, -8) },
  { id: 'afforest',  text: 'Afforestation',   pos: new THREE.Vector3(8, 2.0, -15.5) },
  { id: 'forage',    text: 'Forage Grasses',  pos: new THREE.Vector3(4, 2.0, 9.4) },
  { id: 'evapHeader',text: 'Evaporation',     pos: new THREE.Vector3(8, 10, -3) },
  // Additional water-cycle labels
  { id: 'snowCap',   text: 'Snow Cap',        pos: new THREE.Vector3(18, 11, -6) },
  { id: 'estuary',   text: 'Estuary',         pos: new THREE.Vector3(-15, 2.5, -1) },
  { id: 'reservoir', text: 'Reservoir / Dam', pos: new THREE.Vector3(9.2, 3.5, 0.5) },
  { id: 'aquaculture', text: 'Aquaculture',   pos: new THREE.Vector3(3, 2.5, -5) },
  { id: 'riparian',  text: 'Riparian Zone',   pos: new THREE.Vector3(-3.5, 2.0, 5.8) },
];
const labelsContainer = document.getElementById('labels');
labelDefs.forEach(def => {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = def.text;
  labelsContainer.appendChild(el);
  def.el = el;
});

function updateLabels() {
  labelDefs.forEach(def => {
    const v = def.pos.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const inFront = v.z < 1;
    def.el.style.left = x + 'px';
    def.el.style.top = y + 'px';
    def.el.style.display = inFront ? 'block' : 'none';
  });
}

// ---------- UI CONTROLS ----------
let labelsVisible = true;
let rainOn = true;
const labelsButton = document.getElementById('toggleLabels');
const rainButton = document.getElementById('toggleRain');
function setToggleButton(button, isOn, label) {
  button.textContent = `${label} ${isOn ? 'On' : 'Off'}`;
  button.setAttribute('aria-pressed', String(isOn));
}
labelsButton.addEventListener('click', () => {
  labelsVisible = !labelsVisible;
  labelsContainer.style.display = labelsVisible ? 'block' : 'none';
  setToggleButton(labelsButton, labelsVisible, 'Labels');
});
rainButton.addEventListener('click', () => {
  rainOn = !rainOn;
  rain.visible = rainOn;
  setToggleButton(rainButton, rainOn, 'Rain');
});
// Smooth camera reset — short lerp instead of an instant snap
let resetting = false;
let resetTime = 0;
const RESET_DURATION = 1.0;
const resetFromCam = new THREE.Vector3();
const resetFromTarget = new THREE.Vector3();
const RESET_TARGET = new THREE.Vector3(0, 4, 0);
document.getElementById('resetCam').addEventListener('click', () => {
  resetFromCam.copy(camera.position);
  resetFromTarget.copy(controls.target);
  resetTime = 0;
  resetting = true;
});
function updateCameraReset(dt) {
  if (!resetting) return;
  resetTime = Math.min(RESET_DURATION, resetTime + dt);
  const k = resetTime / RESET_DURATION;
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  camera.position.lerpVectors(resetFromCam, DEFAULT_CAM, e);
  controls.target.lerpVectors(resetFromTarget, RESET_TARGET, e);
  if (resetTime >= RESET_DURATION) resetting = false;
}

// ---------- TOUR ----------
// Narrated camera tour through the water cycle.
const tourStops = [
  {
    title: 'The Water Cycle',
    text: 'Welcome. Earth has a fixed amount of water — but it constantly moves between ocean, atmosphere, land, rivers, soil, groundwater, ecosystems, farms, and cities. This tour follows that journey, and shows how landscapes shape it.',
    cam: new THREE.Vector3(38, 28, 42),
    target: new THREE.Vector3(0, 4, 0),
    labels: [],
  },
  {
    title: '1. Ocean & Evaporation',
    text: 'Oceans hold about 97% of Earth\'s water. Solar energy warms the surface and water molecules escape as invisible vapor — about 86% of all evaporation comes from the sea. This is the largest engine of the entire water cycle.',
    cam: new THREE.Vector3(-5, 18, 25),
    target: new THREE.Vector3(-22, 8, 0),
    labels: ['ocean', 'evap', 'evapHeader'],
  },
  {
    title: '2. Land Evaporation',
    text: 'Land also evaporates water — from wet soil, streams, lakes, ponds, and flooded fields like rice paddies. Each orange arrow rises from a real source: a circular spring pool at the stream head, the lake behind it, soil patches, and the rice paddies. Together these "blue water" fluxes feed atmospheric moisture between rains.',
    cam: new THREE.Vector3(35, 18, 18),
    target: new THREE.Vector3(15, 4, 4),
    labels: ['evapHeader', 'fromSoil', 'fromStream', 'fromLake', 'fromField'],
  },
  {
    title: '3. Transpiration',
    text: 'Plants pull water up through their roots and release it from tiny leaf pores called stomata. Evaporation + transpiration = "evapotranspiration", and forests can return more moisture to the air than the ocean of equal area. The Vegetation Evaporation arrow rises from the mountain-back forest.',
    cam: new THREE.Vector3(30, 14, -2),
    target: new THREE.Vector3(22, 4, -13),
    labels: ['transp', 'fromVeg'],
  },
  {
    title: '4. Condensation & Cloud Formation',
    text: 'Warm, moist air rises, expands, and cools. When it reaches the dew point, vapor condenses onto microscopic dust or salt particles ("condensation nuclei"), forming tiny cloud droplets or ice crystals — the cloud is born.',
    cam: new THREE.Vector3(15, 24, 30),
    target: new THREE.Vector3(8, 18, 0),
    labels: ['cloudForm', 'cond'],
  },
  {
    title: '5. Precipitation & Snow Caps',
    text: 'When droplets grow heavy enough, gravity wins and they fall as rain, snow, or hail. Mountains force air upward (orographic lift), squeezing out extra precipitation. High peaks store water as snow and ice that slowly melts.',
    cam: new THREE.Vector3(28, 18, 30),
    target: new THREE.Vector3(15, 6, 4),
    labels: ['precip', 'mountain', 'snowCap'],
  },
  {
    title: '6. Surface Runoff & River Network',
    text: 'Water that doesn\'t soak in becomes runoff. Gravity gathers it into rills, streams, and rivers — a "watershed" is the entire area that drains to one outlet. The main river emerges from a spring high on the mountain slope, joins the east tributary (which starts at its own round source pool), then meanders west to the sea.',
    cam: new THREE.Vector3(22, 14, 22),
    target: new THREE.Vector3(5, 1, 0),
    labels: ['runoff', 'riparian', 'reservoir'],
  },
  {
    title: '7. Infiltration, Percolation & Groundwater',
    text: 'Surface water seeps into soil (infiltration), then moves downward through pores (percolation). Below the water table, it becomes groundwater that flows slowly through saturated rock. This hidden reservoir feeds springs, wells, and rivers between rains.',
    cam: new THREE.Vector3(15, 10, 38),
    target: new THREE.Vector3(0, -2, 18),
    labels: ['infil'],
  },
  {
    title: '8. Floodplains',
    text: 'When rivers receive more water than their channel can carry, they spill over the banks onto the floodplain. Healthy floodplains are not a disaster — they spread the flood out, recharge groundwater, and renew soil with fresh sediment.',
    cam: new THREE.Vector3(15, 12, 30),
    target: new THREE.Vector3(-1, 1, -3),
    labels: ['flood', 'runoff'],
  },
  {
    title: '9. Deforestation & Erosion',
    text: 'Vegetation slows runoff, holds soil with roots, and recycles water through transpiration. When the mountain slope is cleared, raindrops detach the topsoil, gullies cut into the bare ground, and sediment-laden runoff reaches rivers faster — worsening floods downstream.',
    cam: new THREE.Vector3(22, 13, 10),
    target: new THREE.Vector3(10, 3, -8),
    labels: ['deforest', 'erosion', 'afforest'],
  },
  {
    title: '10. Nature-Based Solutions',
    text: 'Ponds, tied ridges, agroforestry, and forage cover hold rainfall on the land instead of letting it run off. NBS slow runoff, recharge groundwater, and protect topsoil — turning the same rainfall into a benefit instead of damage.',
    cam: new THREE.Vector3(20, 12, 24),
    target: new THREE.Vector3(8, 2, 7),
    labels: ['pond1', 'pond2', 'tiedRidges', 'cropForest', 'forage'],
  },
  {
    title: '11. Reservoir & Water Supply',
    text: 'A dam captures river water in a reservoir, storing it for cities, irrigation, and energy. Water supply pipes deliver it to homes; storm drains return surplus runoff. Paved streets and roofs reduce infiltration, so cities behave like fast watersheds.',
    cam: new THREE.Vector3(-10, 16, 30),
    target: new THREE.Vector3(-3, 4, 8),
    labels: ['reservoir', 'supply', 'storm', 'cityscape', 'industrial'],
  },
  {
    title: '12. Estuary & Aquaculture',
    text: 'Where the river meets the sea is the estuary — brackish, nutrient-rich, and biologically the most productive habitat on Earth. People use coastal waters for fisheries and aquaculture (fish farming), which depend on clean upstream water.',
    cam: new THREE.Vector3(-25, 12, 25),
    target: new THREE.Vector3(-22, 1, -2),
    labels: ['estuary', 'aquaculture', 'harbour', 'beach'],
  },
  {
    title: '13. Return to the Ocean',
    text: 'The river finally empties into the sea, completing the loop. Solar energy is already pulling new vapor back into the air, and the cycle starts over. The water you drank today has been doing this for billions of years.',
    cam: new THREE.Vector3(-30, 14, 25),
    target: new THREE.Vector3(-22, 2, 0),
    labels: ['ocean', 'evap', 'estuary'],
  },
];

let tourIndex = 0;
let tourPlaying = false;
let tourTransition = 0;            // seconds into the current move
const TOUR_MOVE_DURATION = 2.5;
const TOUR_DWELL = 6.0;
let tourDwell = 0;
const tourFromCam = new THREE.Vector3();
const tourFromTarget = new THREE.Vector3();

const tourPanel = document.getElementById('tour-panel');
const tourStartBtn = document.getElementById('tour-start');
const tourCloseBtn = document.getElementById('tour-close');
const tourPrevBtn = document.getElementById('tour-prev');
const tourPlayBtn = document.getElementById('tour-play');
const tourNextBtn = document.getElementById('tour-next');
const tourVoiceBtn = document.getElementById('tour-voice');
const tourTitle = document.getElementById('tour-title');
const tourText = document.getElementById('tour-text');
const tourStep = document.getElementById('tour-step');

// Voice narration via the Web Speech API
const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voiceEnabled = speechAvailable;
let preferredVoice = null;
if (speechAvailable) {
  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    preferredVoice =
      voices.find(v => v.lang.startsWith('en') && /female|samantha|google us/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en-US')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];
  };
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}
function speakStop() {
  if (!voiceEnabled || !speechAvailable) return;
  window.speechSynthesis.cancel();
  const s = tourStops[tourIndex];
  const utter = new SpeechSynthesisUtterance(`${s.title}. ${s.text}`);
  utter.rate = 0.95;
  utter.pitch = 1.0;
  utter.volume = 0.95;
  if (preferredVoice) utter.voice = preferredVoice;
  speechFinished = false;
  utter.onend = () => { speechFinished = true; };
  utter.onerror = () => { speechFinished = true; };
  window.speechSynthesis.speak(utter);
}
// Tracks whether the current stop's narration has finished, so auto-advance
// can wait for the voice to read through long stops instead of cutting it off.
let speechFinished = true;
function stopSpeech() {
  if (speechAvailable) window.speechSynthesis.cancel();
}

function setTourStop(i, animate = true) {
  tourIndex = Math.max(0, Math.min(tourStops.length - 1, i));
  const s = tourStops[tourIndex];
  tourTitle.textContent = s.title;
  tourText.textContent = s.text;
  tourStep.textContent = `${tourIndex + 1} / ${tourStops.length}`;
  tourPrevBtn.disabled = tourIndex === 0;
  // On the final stop, repurpose Next as a "Replay" button instead of disabling it.
  if (tourIndex === tourStops.length - 1) {
    tourNextBtn.disabled = false;
    tourNextBtn.textContent = 'Replay ↺';
  } else {
    tourNextBtn.disabled = false;
    tourNextBtn.textContent = 'Next';
  }
  // Highlight relevant labels, dim everything else (skip when labels array is empty)
  const highlight = new Set(s.labels || []);
  labelDefs.forEach(def => {
    if (highlight.size === 0) {
      def.el.classList.remove('tour-dimmed', 'tour-highlighted');
    } else if (highlight.has(def.id)) {
      def.el.classList.add('tour-highlighted');
      def.el.classList.remove('tour-dimmed');
    } else {
      def.el.classList.add('tour-dimmed');
      def.el.classList.remove('tour-highlighted');
    }
  });
  if (animate) {
    tourFromCam.copy(camera.position);
    tourFromTarget.copy(controls.target);
    tourTransition = 0;
    tourDwell = 0;
  } else {
    camera.position.copy(s.cam);
    controls.target.copy(s.target);
    tourTransition = TOUR_MOVE_DURATION;
  }
  speakStop();
}

function openTour() {
  tourPanel.classList.remove('tour-hidden');
  tourStartBtn.classList.add('tour-hidden');
  setTourStop(0, true);
  syncUiMode();
}

function closeTour() {
  tourPanel.classList.add('tour-hidden');
  tourStartBtn.classList.remove('tour-hidden');
  tourPlaying = false;
  tourPlayBtn.textContent = 'Play';
  tourPlayBtn.setAttribute('aria-pressed', 'false');
  // Clear any tour highlighting
  labelDefs.forEach(def => def.el.classList.remove('tour-dimmed', 'tour-highlighted'));
  stopSpeech();
  syncUiMode();
}

function nextStop() {
  if (tourIndex < tourStops.length - 1) {
    setTourStop(tourIndex + 1, true);
  } else {
    // On the last stop, Next acts as Replay — loop back to the overview
    setTourStop(0, true);
  }
}
function prevStop() {
  if (tourIndex > 0) setTourStop(tourIndex - 1, true);
}

tourStartBtn.addEventListener('click', openTour);
tourCloseBtn.addEventListener('click', closeTour);
tourPrevBtn.addEventListener('click', prevStop);
tourNextBtn.addEventListener('click', nextStop);
function togglePlayPause() {
  tourPlaying = !tourPlaying;
  tourPlayBtn.textContent = tourPlaying ? 'Pause' : 'Play';
  tourPlayBtn.setAttribute('aria-pressed', String(tourPlaying));
  if (tourPlaying) {
    // Always start fresh: reset the dwell timer so the user gets the full
    // 6-second read on the current stop before auto-advancing.
    tourDwell = 0;
    // If we're already on the last stop, restart from the beginning.
    if (tourIndex >= tourStops.length - 1) {
      setTourStop(0, true);
    } else {
      // Re-narrate the current stop on Resume so speech and visuals stay in sync.
      speakStop();
    }
  } else {
    // Pause should silence the narrator immediately.
    stopSpeech();
  }
}
tourPlayBtn.addEventListener('click', togglePlayPause);
if (!speechAvailable) {
  tourVoiceBtn.style.display = 'none';
} else {
  tourVoiceBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    tourVoiceBtn.textContent = voiceEnabled ? 'Voice On' : 'Voice Off';
    tourVoiceBtn.setAttribute('aria-pressed', String(voiceEnabled));
    tourVoiceBtn.classList.toggle('voice-off', !voiceEnabled);
    if (!voiceEnabled) stopSpeech();
    else speakStop();
  });
}

// ---------- KEYBOARD SHORTCUTS ----------
window.addEventListener('keydown', (e) => {
  const tourOpen = !tourPanel.classList.contains('tour-hidden');
  if (e.key === 'Escape') {
    if (tourOpen) { closeTour(); e.preventDefault(); }
    return;
  }
  if (!tourOpen) {
    if (e.key === 't' || e.key === 'T') { openTour(); e.preventDefault(); }
    return;
  }
  if (e.key === 'ArrowRight') { nextStop(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { prevStop(); e.preventDefault(); }
  else if (e.key === ' ') {
    togglePlayPause();
    e.preventDefault();
  }
});

// ---------- WASA INTERVENTIONS PANEL ----------
// A focused overlay that explains how each Water and Soil Accelerator
// solution improves a specific stage of the water cycle. Cards fly the
// camera to the relevant scene element and highlight its label, reusing
// the same easing as the guided tour.
const wasaInterventions = [
  {
    icon: 'A',
    title: 'Afforestation & Agroforestry',
    text: 'When forest is cleared the rainfall cycle collapses — see the stumps and felled trees. Afforestation replants tree cover (saplings in tubes), pumping moisture back into the atmosphere through transpiration and anchoring topsoil. Agroforestry mixes trees with crops on the same plot for the same benefits.',
    impact: 'Recovers transpiration, recharges groundwater, anchors soil',
    // Low south-facing view of the flatter recovery patch; keeps the
    // afforestation saplings in front with deforestation behind them.
    cam: new THREE.Vector3(16, 6.5, -24),
    target: new THREE.Vector3(8, 1.2, -14),
    labels: ['afforest', 'deforest', 'cropForest', 'transp'],
  },
  {
    icon: 'B',
    title: 'Conservation Agriculture',
    text: 'Minimum tillage, mulching and cover crops keep soils porous and shaded. Rainfall infiltrates instead of running off, and organic matter triples the soil\'s water-holding capacity.',
    impact: 'Higher infiltration, lower evaporation loss',
    cam: new THREE.Vector3(14, 8, 18),
    target: new THREE.Vector3(4, 2, 7),
    labels: ['cropForest', 'tiedRidges', 'infil'],
  },
  {
    icon: 'C',
    title: 'Tied Ridges & Soil Ripping',
    text: 'Small earthen cross-ridges trap rainfall where it falls; soil rippers break compacted layers so water moves into the root zone. Yields stay up even in erratic-rainfall seasons. Water from Pond 1 flows along a channel into the ridge strips.',
    impact: 'In-situ rainwater capture, deeper percolation',
    cam: new THREE.Vector3(12, 7, 16),
    target: new THREE.Vector3(4, 2, 7),
    labels: ['tiedRidges', 'pond1', 'infil'],
  },
  {
    icon: 'D',
    title: 'Erosion Control & Riparian Buffers',
    text: 'On the deforested mountain slope, bare ground is scoured into a gully by raindrops and runoff. Just downslope, contour bunds, mulch strips and grass tufts hold the same rainfall in place — the side-by-side contrast WASA scales across watersheds. Riparian zones along the river do the same job at the basin outlet.',
    impact: 'Protected topsoil, reduced sediment in rivers',
    cam: new THREE.Vector3(22, 10, 8),
    target: new THREE.Vector3(11, 2, -5.5),
    labels: ['erosion', 'erosionControl', 'riparian'],
  },
  {
    icon: 'E',
    title: 'Rainwater Harvesting & Farm Ponds',
    text: 'Pond 1 and Pond 2 store wet-season runoff: stream water flows in at the north inlet, the two ponds are linked, an outlet drains east to the lake, and another sends water west to the agroforestry terrace. The system recharges shallow groundwater and creates habitat year-round.',
    impact: 'Year-round water access, groundwater recharge',
    cam: new THREE.Vector3(28, 10, 16),
    target: new THREE.Vector3(20, 2, 7),
    labels: ['pond1', 'pond2', 'fromStream', 'fromLake'],
  },
  {
    icon: 'F',
    title: 'Green Infrastructure',
    text: 'Restored wetlands, vegetative buffers and small check dams flatten flood peaks (see the inundation backwater south of the river) and extend dry-season base flow. The watershed becomes a sponge instead of a fast pipe to the sea.',
    impact: 'Lower flood peaks, longer base flow',
    cam: new THREE.Vector3(8, 14, 28),
    target: new THREE.Vector3(-2, 2, -3),
    labels: ['flood', 'riparian', 'estuary', 'pond1', 'pond2'],
  },
  {
    icon: 'G',
    title: 'Community Watershed Governance',
    text: 'A watershed is the whole catchment that drains to one outlet — from mountain ridge to riverbank to the sea. Local committees decide where ponds and forest patches go, enforce grazing rules, and keep the landscape interventions alive between seasons.',
    impact: 'Durable, locally-owned landscape stewardship',
    cam: new THREE.Vector3(38, 30, 32),
    target: new THREE.Vector3(0, 3, 0),
    labels: ['mountain', 'riparian', 'runoff', 'ocean', 'school'],
  },
  {
    icon: 'H',
    title: 'Climate Information Services',
    text: 'Seasonal forecasts and on-time advisories help farmers plant, irrigate and harvest at the right moment, so more crop is produced per millimetre of rain that falls.',
    impact: 'More crop per drop, fewer failed seasons',
    cam: new THREE.Vector3(15, 24, 30),
    target: new THREE.Vector3(8, 18, 0),
    labels: ['cloudForm', 'precip', 'cond'],
  },
];

// Independent camera flight, used by the WASA panel. Runs only when the
// guided tour is closed so the two systems never fight over the camera.
const WASA_MOVE_DURATION = 2.2;
const wasaFromCam = new THREE.Vector3();
const wasaToCam = new THREE.Vector3();
const wasaFromTarget = new THREE.Vector3();
const wasaToTarget = new THREE.Vector3();
let wasaFlightT = WASA_MOVE_DURATION + 1; // start "finished"

function wasaFlyTo(stop) {
  wasaFromCam.copy(camera.position);
  wasaFromTarget.copy(controls.target);
  wasaToCam.copy(stop.cam);
  wasaToTarget.copy(stop.target);
  wasaFlightT = 0;
  const highlight = new Set(stop.labels || []);
  labelDefs.forEach(def => {
    if (highlight.size === 0) {
      def.el.classList.remove('tour-dimmed', 'tour-highlighted');
    } else if (highlight.has(def.id)) {
      def.el.classList.add('tour-highlighted');
      def.el.classList.remove('tour-dimmed');
    } else {
      def.el.classList.add('tour-dimmed');
      def.el.classList.remove('tour-highlighted');
    }
  });
}

function updateWasaFlight(dt) {
  // The tour owns the camera while its panel is open.
  if (!tourPanel.classList.contains('tour-hidden')) return;
  if (wasaFlightT >= WASA_MOVE_DURATION) return;
  wasaFlightT = Math.min(WASA_MOVE_DURATION, wasaFlightT + dt);
  const k = wasaFlightT / WASA_MOVE_DURATION;
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  camera.position.lerpVectors(wasaFromCam, wasaToCam, e);
  controls.target.lerpVectors(wasaFromTarget, wasaToTarget, e);
  controls.enabled = wasaFlightT >= WASA_MOVE_DURATION;
}

const wasaPanel = document.getElementById('wasa-panel');
const wasaOpenBtn = document.getElementById('openWasa');
const wasaCloseBtn = document.getElementById('wasa-close');
const wasaCardsContainer = document.getElementById('wasa-cards');

function clearWasaHighlights() {
  labelDefs.forEach(def => def.el.classList.remove('tour-dimmed', 'tour-highlighted'));
}

function buildWasaCards() {
  const frag = document.createDocumentFragment();
  wasaInterventions.forEach((iv) => {
    const card = document.createElement('div');
    card.className = 'wasa-card';

    const head = document.createElement('div');
    head.className = 'wasa-card-head';
    const ic = document.createElement('span');
    ic.className = 'wasa-icon';
    ic.textContent = iv.icon;
    const h = document.createElement('h3');
    h.textContent = iv.title;
    head.append(ic, h);

    const desc = document.createElement('p');
    desc.textContent = iv.text;

    const impact = document.createElement('div');
    impact.className = 'wasa-impact';
    impact.textContent = iv.impact;

    const btn = document.createElement('button');
    btn.className = 'wasa-focus-btn';
    btn.type = 'button';
    btn.textContent = 'Show in scene';
    btn.addEventListener('click', () => {
      // If the guided tour is open, close it so the camera is ours.
      if (!tourPanel.classList.contains('tour-hidden')) closeTour();
      wasaFlyTo(iv);
    });

    card.append(head, desc, impact, btn);
    frag.appendChild(card);
  });
  wasaCardsContainer.replaceChildren(frag);
}
buildWasaCards();

function openWasaPanel() {
  // Close the tour so the two panels don't both grab the camera.
  if (!tourPanel.classList.contains('tour-hidden')) closeTour();
  wasaPanel.classList.remove('wasa-hidden');
  wasaPanel.setAttribute('aria-hidden', 'false');
  syncUiMode();
}
function closeWasaPanel() {
  wasaPanel.classList.add('wasa-hidden');
  wasaPanel.setAttribute('aria-hidden', 'true');
  clearWasaHighlights();
  syncUiMode();
}

wasaOpenBtn.addEventListener('click', () => {
  if (wasaPanel.classList.contains('wasa-hidden')) openWasaPanel();
  else closeWasaPanel();
});
wasaCloseBtn.addEventListener('click', closeWasaPanel);

// ---------- WELCOME OVERLAY ----------
const welcome = document.getElementById('welcome');
const welcomeClose = document.getElementById('welcome-close');
const welcomeTour = document.getElementById('welcome-tour');
function syncUiMode() {
  document.body.classList.toggle('tour-active', !tourPanel.classList.contains('tour-hidden'));
  document.body.classList.toggle('wasa-active', !wasaPanel.classList.contains('wasa-hidden'));
  document.body.classList.toggle('welcome-active', !welcome.classList.contains('welcome-hidden'));
}
function dismissWelcome() {
  welcome.classList.add('welcome-hidden');
  welcome.setAttribute('aria-hidden', 'true');
  syncUiMode();
}
// Only show on first visit this session
if (sessionStorage.getItem('seenWelcome')) {
  welcome.classList.add('welcome-hidden');
} else {
  sessionStorage.setItem('seenWelcome', '1');
}
welcome.setAttribute('aria-hidden', welcome.classList.contains('welcome-hidden') ? 'true' : 'false');
syncUiMode();
welcomeClose.addEventListener('click', dismissWelcome);
welcomeTour.addEventListener('click', () => {
  dismissWelcome();
  openTour();
});
welcome.addEventListener('click', (e) => {
  if (e.target === welcome) dismissWelcome();
});

// ---------- TAB-VISIBILITY HANDLING ----------
// Pause narration when the user switches away (and resume on Return).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopSpeech();
  } else if (voiceEnabled && !tourPanel.classList.contains('tour-hidden')) {
    speakStop();
  }
});

// ---------- LOADING INDICATOR ----------
const loader = document.getElementById('loader');
window.addEventListener('load', () => {
  setTimeout(() => loader.classList.add('loader-hidden'), 250);
});
setTimeout(() => loader.classList.add('loader-hidden'), 6000);

// ---------- COLLAPSIBLE SIDE PANEL ----------
const uiPanel = document.getElementById('ui');
const uiCollapseBtn = document.getElementById('ui-collapse');
function setUiCollapsed(collapsed) {
  uiPanel.classList.toggle('ui-collapsed', collapsed);
  uiCollapseBtn.textContent = collapsed ? '+' : '-';
  uiCollapseBtn.title = collapsed ? 'Expand panel' : 'Collapse panel';
  uiCollapseBtn.setAttribute('aria-label', collapsed ? 'Expand legend panel' : 'Collapse legend panel');
  uiCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
}
const storedLegendState = sessionStorage.getItem('legendCollapsed');
const compactViewport = window.matchMedia('(max-width: 760px)').matches;
setUiCollapsed(storedLegendState ? storedLegendState === '1' : compactViewport);
uiCollapseBtn.addEventListener('click', () => {
  const collapsed = !uiPanel.classList.contains('ui-collapsed');
  setUiCollapsed(collapsed);
  sessionStorage.setItem('legendCollapsed', collapsed ? '1' : '0');
});

function updateTour(dt) {
  if (tourPanel.classList.contains('tour-hidden')) {
    controls.enabled = !resetting;
    return;
  }
  // Lock orbit controls during the camera flight so a stray drag can't
  // hijack the transition; re-enable once we're at the destination.
  controls.enabled = tourTransition >= TOUR_MOVE_DURATION;
  // Easing during the move
  if (tourTransition < TOUR_MOVE_DURATION) {
    tourTransition = Math.min(TOUR_MOVE_DURATION, tourTransition + dt);
    const k = tourTransition / TOUR_MOVE_DURATION;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
    const s = tourStops[tourIndex];
    camera.position.lerpVectors(tourFromCam, s.cam, e);
    controls.target.lerpVectors(tourFromTarget, s.target, e);
  } else if (tourPlaying) {
    tourDwell += dt;
    // Hold this stop until BOTH the minimum dwell has passed AND the
    // voice (if enabled) has finished reading. This stops the tour from
    // cutting off long narration like "Nature-Based Solutions".
    const minDwellMet = tourDwell >= TOUR_DWELL;
    const speechDone = !voiceEnabled || !speechAvailable || speechFinished;
    if (minDwellMet && speechDone) {
      if (tourIndex < tourStops.length - 1) {
        setTourStop(tourIndex + 1, true);
      } else {
        tourPlaying = false;
        tourPlayBtn.textContent = 'Play';
        tourPlayBtn.setAttribute('aria-pressed', 'false');
      }
    }
  }
}

// ---------- ON-SCREEN CAMERA CONTROLS ----------
// Click-and-hold buttons that pan/rotate/zoom the camera. Useful on
// touch devices and trackpads where scroll-to-zoom or right-click-pan
// aren't ergonomic. We move both `camera.position` and `controls.target`
// directly, then call controls.update() so OrbitControls stays in sync.
const PAN_STEP = 0.55;          // world units per tick
const ZOOM_STEP = 0.93;         // multiplier per tick (< 1 = zoom in)
const ROT_STEP = 0.045;         // radians per tick (horizontal orbit)
const TILT_STEP = 0.03;         // radians per tick (vertical tilt)
const TICK_INTERVAL = 30;       // ms between ticks while button is held

const _camTmpRight = new THREE.Vector3();
const _camTmpUp    = new THREE.Vector3();
const _camTmpDir   = new THREE.Vector3();
const _camOffset   = new THREE.Vector3();
const _camSpherical = new THREE.Spherical();

function camPan(dxScreen, dyScreen) {
  // Build a screen-aligned basis from the camera, ignoring its pitch so
  // panning stays parallel to the ground (the typical user expectation).
  camera.getWorldDirection(_camTmpDir);
  _camTmpDir.y = 0; _camTmpDir.normalize();
  _camTmpRight.set(_camTmpDir.z, 0, -_camTmpDir.x); // right = forward × up
  _camTmpUp.set(0, 1, 0);
  const move = new THREE.Vector3()
    .addScaledVector(_camTmpRight, dxScreen)
    .addScaledVector(_camTmpUp, dyScreen);
  camera.position.add(move);
  controls.target.add(move);
  controls.update();
}

function camZoom(factor) {
  // Move the camera along the camera→target axis. Respect OrbitControls'
  // min/max distance so we don't clip through the ground.
  _camOffset.subVectors(camera.position, controls.target);
  const dist = _camOffset.length();
  const newDist = Math.max(controls.minDistance,
                  Math.min(controls.maxDistance, dist * factor));
  _camOffset.setLength(newDist);
  camera.position.copy(controls.target).add(_camOffset);
  controls.update();
}

function camOrbit(dTheta, dPhi) {
  // Spherical coords around the orbit target.
  _camOffset.subVectors(camera.position, controls.target);
  _camSpherical.setFromVector3(_camOffset);
  _camSpherical.theta -= dTheta;
  _camSpherical.phi   -= dPhi;
  // Clamp phi the same way OrbitControls does (avoid going past poles).
  const minPhi = 0.001;
  const maxPhi = controls.maxPolarAngle || Math.PI / 2.05;
  _camSpherical.phi = Math.max(minPhi, Math.min(maxPhi, _camSpherical.phi));
  _camOffset.setFromSpherical(_camSpherical);
  camera.position.copy(controls.target).add(_camOffset);
  controls.update();
}

const CAM_ACTIONS = {
  'pan-left':   () => camPan(-PAN_STEP, 0),
  'pan-right':  () => camPan( PAN_STEP, 0),
  'pan-up':     () => camPan(0,  PAN_STEP),  // moves view "up" (camera+target rise)
  'pan-down':   () => camPan(0, -PAN_STEP),
  'zoom-in':    () => camZoom(ZOOM_STEP),
  'zoom-out':   () => camZoom(1 / ZOOM_STEP),
  'rot-left':   () => camOrbit(-ROT_STEP, 0),
  'rot-right':  () => camOrbit( ROT_STEP, 0),
  'tilt-up':    () => camOrbit(0,  TILT_STEP),
  'tilt-down':  () => camOrbit(0, -TILT_STEP),
};

document.querySelectorAll('#cam-controls .cam-btn').forEach(btn => {
  const action = btn.dataset.action;
  const fn = CAM_ACTIONS[action];
  if (!fn) return;
  let timer = null;
  const start = (e) => {
    e.preventDefault();
    lastInteract = performance.now();   // wake from idle auto-rotate
    fn();
    timer = setInterval(fn, TICK_INTERVAL);
  };
  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };
  btn.addEventListener('pointerdown',  start);
  btn.addEventListener('pointerup',    stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
  // Fallback for browsers without Pointer Events
  btn.addEventListener('touchend',     stop);
  btn.addEventListener('mouseleave',   stop);
});

// ---------- RESIZE ----------
// Debounced resize handler so orientation changes / window drags don't
// thrash the renderer. Also re-applies pixel ratio in case the user dragged
// the window between a retina and a standard display.
let _resizeTimer = null;
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getPixelRatioCap()));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(handleResize, 80);
});
window.addEventListener('orientationchange', handleResize);

// ---------- ANIMATION LOOP ----------
const clock = new THREE.Clock();

function animate() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // Drift clouds
  clouds.forEach(c => {
    c.position.x = c.userData.baseX + Math.sin(t * 0.15 * c.userData.driftSpeed) * 2;
    if (c.position.x > 30) c.position.x = -30;
  });

  // Rain falling — Points (1 vertex per teardrop)
  if (rainOn) {
    const rp = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      rp[i * 3 + 1] -= rainVelocities[i] * 60 * dt;
      const groundY = sampleTerrainY(rp[i * 3], rp[i * 3 + 2]) + 0.2;
      if (rp[i * 3 + 1] < groundY) {
        if (Math.random() < 0.3) spawnSplash(rp[i * 3], groundY, rp[i * 3 + 2]);
        seedRainDrop(i, false);
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // Update splash rings — grow + fade
  for (let i = 0; i < splashPool.length; i++) {
    const s = splashPool[i];
    if (!s.visible) continue;
    s.userData.age += dt;
    const k = s.userData.age / s.userData.life;
    if (k >= 1) { s.visible = false; continue; }
    s.scale.setScalar(1 + k * 4);
    s.material.opacity = 0.9 * (1 - k);
  }

  // Evaporation rising and swirling toward cloud
  const ep = evapGeo.attributes.position.array;
  for (let i = 0; i < EVAP_COUNT; i++) {
    ep[i * 3 + 1] += evapVel[i] * 60 * dt;
    // gentle drift toward main cloud area as it rises
    const heightFrac = Math.min(1, ep[i * 3 + 1] / 18);
    ep[i * 3] += (8 - ep[i * 3]) * 0.002 * heightFrac;
    ep[i * 3 + 2] += Math.sin(t + i) * 0.01;
    if (ep[i * 3 + 1] > 17) {
      ep[i * 3] = -22 + (Math.random() - 0.5) * 18;
      ep[i * 3 + 1] = 0;
      ep[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
  }
  evapGeo.attributes.position.needsUpdate = true;

  // Transpiration: vapor rising from tree clusters, recycle when high
  const tp = transGeo.attributes.position.array;
  for (let i = 0; i < TRANS_COUNT; i++) {
    tp[i * 3 + 1] += transVel[i] * 60 * dt;
    tp[i * 3]     += Math.sin(t * 0.7 + i) * 0.005;
    tp[i * 3 + 2] += Math.cos(t * 0.5 + i) * 0.005;
    if (tp[i * 3 + 1] > 13) seedTransParticle(i, true);
  }
  transGeo.attributes.position.needsUpdate = true;

  // Industrial smoke — rise + drift + recycle on age
  const sp = smokeGeo.attributes.position.array;
  for (let i = 0; i < SMOKE_COUNT; i++) {
    smokeAges[i] += dt;
    if (smokeAges[i] > SMOKE_LIFE) {
      seedSmoke(i, true);
    } else {
      sp[i * 3]     += smokeDrift[i * 2]     * dt;
      sp[i * 3 + 1] += 0.95 * dt;          // upward rise
      sp[i * 3 + 2] += smokeDrift[i * 2 + 1] * dt;
    }
  }
  smokeGeo.attributes.position.needsUpdate = true;

  // Pulse land-evaporation arrows so they read as rising vapor plumes
  evapArrows.forEach((a, i) => {
    const phase = a.userData.basePhase;
    a.scale.y = 1 + Math.sin(t * 1.6 + phase) * 0.08;
    a.rotation.y = Math.sin(t * 0.3 + i) * 0.12;
  });

  // Drive cars along their paths (closed loops or back-and-forth segments)
  movingCars.forEach(c => {
    const ud = c.userData;
    // Compute total cumulative length of the path (close it if 4+ points)
    if (!ud.cumLen) {
      ud.cumLen = [0];
      const closed = ud.path.length > 2;
      const n = ud.path.length;
      for (let i = 1; i < n + (closed ? 1 : 0); i++) {
        const a = ud.path[(i - 1) % n];
        const b = ud.path[i % n];
        const seg = Math.hypot(b.x - a.x, b.z - a.z);
        ud.cumLen.push(ud.cumLen[ud.cumLen.length - 1] + seg);
      }
      ud.totalLen = ud.cumLen[ud.cumLen.length - 1];
      ud.closed = closed;
    }
    ud.progress += ud.speed * dt;
    let pos;
    if (ud.closed) {
      pos = ud.progress % ud.totalLen;
    } else {
      // Ping-pong: bounce back and forth on open segment
      const cycle = ud.progress % (ud.totalLen * 2);
      pos = cycle < ud.totalLen ? cycle : ud.totalLen * 2 - cycle;
    }
    // Find segment
    let i = 0;
    while (i < ud.cumLen.length - 1 && ud.cumLen[i + 1] < pos) i++;
    const a = ud.path[i % ud.path.length];
    const b = ud.path[(i + 1) % ud.path.length];
    const segLen = ud.cumLen[i + 1] - ud.cumLen[i];
    const f = segLen > 0 ? (pos - ud.cumLen[i]) / segLen : 0;
    const x = a.x + (b.x - a.x) * f;
    const z = a.z + (b.z - a.z) * f;
    c.position.set(x, sampleTerrainY(x, z) + 0.08, z);
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    c.rotation.y = -angle;
  });

  // Spin windmill blades
  windmillBlades.forEach(h => { h.rotation.z = t * 1.2; });

  // Ground birds: subtle pecking bob — most of the time they stand still,
  // then dip the head briefly so they read as alive without being noisy.
  groundBirds.forEach(b => {
    const phase = (t * 0.9 + b.userData.basePhase) % (Math.PI * 2);
    const peck = phase < 0.6 ? Math.sin(phase / 0.6 * Math.PI) * 0.18 : 0;
    b.rotation.x = peck;
    // Occasional small turn so they don't all face the same way forever
    b.rotation.y = b.userData.baseYaw === undefined
      ? (b.userData.baseYaw = b.rotation.y)
      : b.userData.baseYaw + Math.sin(t * 0.3 + b.userData.basePhase) * 0.25;
  });

  // Gentle bob + yaw sway for boats
  boatMeshes.forEach(b => {
    const ud = b.userData;
    b.position.y = 0.22 + Math.sin(t * 1.2 + ud.bobPhase) * 0.06;
    b.rotation.z = Math.sin(t * 1.0 + ud.bobPhase) * 0.05;
    b.rotation.y = Math.sin(t * 0.4 + ud.yawPhase) * 0.08;
    // Slow drift in a small circle
    b.position.x = ud.baseX + Math.cos(t * 0.15 + ud.yawPhase) * 0.5;
    b.position.z = ud.baseZ + Math.sin(t * 0.15 + ud.yawPhase) * 0.5;
  });

  // Seagulls circling above the ocean — flap wings, bob gently
  birdMeshes.forEach(b => {
    const ud = b.userData;
    const angle = t * ud.speed + ud.phase;
    b.position.x = ud.cx + Math.cos(angle) * ud.radius;
    b.position.z = ud.cz + Math.sin(angle) * ud.radius;
    b.position.y = ud.y + Math.sin(t * 1.8 + ud.phase) * 0.3;
    b.rotation.y = -angle - Math.PI / 2;
    const flap = Math.sin(t * 9 + ud.phase) * 0.45;
    ud.leftWing.rotation.z = flap;
    ud.rightWing.rotation.z = -flap;
  });

  // Seaweed sway — each frond rocks slightly with the current
  seaweedClusters.forEach((c, ci) => {
    c.children.forEach((frond, fi) => {
      frond.rotation.z = Math.sin(t * 1.6 + ci + fi * 0.7) * 0.15;
    });
  });

  // Swim fish in circles within their water bodies
  fishMeshes.forEach(f => {
    const ud = f.userData;
    const angle = t * ud.speed + ud.phase;
    const rx = ud.radiusX || ud.radius;
    const rz = ud.radiusZ || ud.radius;
    f.position.x = ud.cx + Math.cos(angle) * rx;
    f.position.z = ud.cz + Math.sin(angle) * rz;
    f.position.y = ud.y + Math.sin(t * 1.6 + ud.phase) * 0.025;
    const dx = -Math.sin(angle) * rx;
    const dz = Math.cos(angle) * rz;
    f.rotation.y = -Math.atan2(dz, dx);
    if (ud.tail) ud.tail.rotation.z = Math.PI / 2 + Math.sin(t * 6 + ud.phase) * 0.25;
  });

  // Scroll river water texture (downstream flow) — fast enough to read
  // as moving water, not so fast it looks like a screensaver.
  riverNet.waterTex.offset.y -= dt * 0.9;

  // Pulse percolation arrows downward
  percolationArrows.forEach(a => {
    a.position.y = Math.sin(t * 1.5 + a.userData.basePulse) * 0.3;
  });

  // Pulse sun
  sunGlow.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
  sunGroup.rotation.y = t * 0.05;

  // Animate sun rays pulse
  sunRays.children.forEach((ray, i) => {
    const base = sunRays.userData.basePositions[i];
    ray.position.y = base + Math.sin(t * 2 + i) * 0.4;
  });

  // Ocean ripple
  const oceanGeo = ocean.geometry;
  const op = oceanGeo.attributes.position;
  for (let i = 0; i < op.count; i++) {
    const x = op.getX(i);
    const z = op.getZ(i);
    op.setY(i, Math.sin(x * 0.3 + t * 1.5) * 0.025 + Math.cos(z * 0.25 + t) * 0.015);
  }
  op.needsUpdate = true;
  oceanGeo.computeVertexNormals();

  updateTour(dt);
  updateWasaFlight(dt);
  updateCameraReset(dt);
  // Auto-rotate when nothing's happening and the user has been idle
  const tourOpen = !tourPanel.classList.contains('tour-hidden');
  const idle = performance.now() - lastInteract > IDLE_MS;
  controls.autoRotate = idle && !tourOpen && !resetting && controls.enabled;
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
