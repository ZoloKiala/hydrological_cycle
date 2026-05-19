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
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  const mainRiver = [
    [9.5,  0.8, 0.92],
    [8.5,  3.0, 0.95],    // BEND 1 — north
    [7.0,  1.5, 0.99],
    [5.5, -2.0, 1.04],    // BEND 2 — south
    [4.0,  0.5, 1.10],
    [2.5,  3.0, 1.16],    // BEND 3 — north
    [1.0,  0.5, 1.22],
    [-0.5,-2.0, 1.30],    // BEND 4 — south
    [-2.0, 0.5, 1.38],
    [-3.5, 2.8, 1.46],    // BEND 5 — north
    [-5.0, 0.5, 1.55],
    [-6.5,-2.0, 1.65],    // BEND 6 — south
    [-8.0, 0.0, 1.75],
    [-10.0, 1.2, 1.85],   // gentle dampening
    [-12.5,-0.4, 2.00],
    [-15.0,-1.0, 2.20],
    [-17.5,-1.0, 2.45],
    // Delta extending across the cliff edge into the basin
    [-19.0,-1.0, 2.60], [-21.0,-1.0, 2.75],
  ];
  // East tributary joins main river at the (7, 1.5) crossing (after BEND 1)
  const tributaryEast = [
    [22, 3, 0.32], [19, 2.5, 0.42], [16, 2.0, 0.52],
    [13, 1.8, 0.62], [10, 1.6, 0.72], [8.5, 1.5, 0.80], [7, 1.5, 0.82],
  ];
  // South tributary drains the south plain and joins main at the
  // southernmost bend (-6.5, -2.0)
  const tributarySouth = [
    [10, -15, 0.30], [8, -12, 0.38], [5, -9, 0.46],
    [2, -6, 0.55],   [-1, -4.0, 0.70], [-4, -2.8, 0.85], [-6.5, -2.0, 1.0],
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
      const bw = w + 0.45;

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
    const y = sampleTerrainY(x, z);
    if (y < 0.1 || y > 5) continue;                           // skip ocean & high mountain
    if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 1.1)) continue; // spacing
    makeTree(x, z, scaleMin + Math.random() * (scaleMax - scaleMin));
    placed.push({ x, z });
  }
}

// Tree clusters across the open plains. Denser counts and a few extra
// clusters to fill the landscape.
makeTreeCluster(-7, 2,   8, 2.4);  // riverside grove
makeTreeCluster(16, -13, 9, 2.8);  // east plain, south of mountain foot
makeTreeCluster(0, -14,  8, 2.8);  // far south plain
makeTreeCluster(-3, 16,  7, 2.6);  // north plain near town
makeTreeCluster(10, -2,  8, 2.6);  // mid-east plain
makeTreeCluster(8, -17,  6, 2.4);  // far south-east plain
makeTreeCluster(-12, 4,  6, 2.2);  // west coast strip
// ---------- DEFORESTATION PATCH ----------
function buildDeforestation(cx, cz, width = 8, depth = 6) {
  const yT = sampleTerrainY(cx, cz);
  // Scale all sub-counts down for smaller patches
  const scale = (width * depth) / 48;  // 1.0 for the default 8×6
  // Bare exposed soil
  const dirt = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.10, depth),
    new THREE.MeshStandardMaterial({ color: 0x8d4f33, roughness: 0.98 })
  );
  dirt.position.set(cx, yT + 0.05, cz);
  dirt.receiveShadow = true;
  scene.add(dirt);
  // Darker scattered patches
  const patchCount = Math.max(8, Math.floor(22 * scale));
  for (let i = 0; i < patchCount; i++) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.3 + Math.random() * 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      cx + (Math.random() - 0.5) * (width - 1),
      yT + 0.105,
      cz + (Math.random() - 0.5) * (depth - 1)
    );
    scene.add(patch);
  }
  // Tree STUMPS
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const cutMat = new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.85 });
  const stumpCount = Math.max(5, Math.floor(14 * scale));
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
  }
  // FALLEN LOGS
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 });
  const logCount = Math.max(2, Math.floor(5 * scale));
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
  // Surviving live trees ringing the edges (scaled to patch size)
  const hw = width / 2 - 0.4, hd = depth / 2 - 0.4;
  const edgeOffsets = scale >= 0.6 ? [
    [-hw, -hd * 0.7], [-hw, 0], [-hw, hd * 0.7],
    [ hw, -hd * 0.7], [ hw, 0], [ hw, hd * 0.7],
    [-hw * 0.55, -hd], [ hw * 0.55, -hd],
    [-hw * 0.55,  hd], [ hw * 0.55,  hd],
  ] : [
    [-hw, 0], [hw, 0], [0, -hd], [0, hd],
  ];
  edgeOffsets.forEach(o => {
    makeTree(cx + o[0] + (Math.random() - 0.5) * 0.4,
             cz + o[1] + (Math.random() - 0.5) * 0.4,
             0.65 + Math.random() * 0.3);
  });
}
buildDeforestation(8, -8, 8, 6);     // big patch on the central south plain
buildDeforestation(3, 9.5, 12, 2.5); // long strip running along the south side of the road

// Riverbank trees — small clusters along the meandering main river bends
makeTreeCluster(8, 4.8, 4, 1.4, 0.45, 0.8);    // north of bend 1
makeTreeCluster(5.5, -3.8, 4, 1.4, 0.45, 0.8); // south of bend 2
makeTreeCluster(2.5, 4.8, 4, 1.4, 0.45, 0.8);  // north of bend 3
makeTreeCluster(-1, -3.8, 4, 1.4, 0.45, 0.8);  // south of bend 4
makeTreeCluster(-3.5, 4.6, 4, 1.4, 0.45, 0.8); // north of bend 5
makeTreeCluster(-6.5, -3.8, 4, 1.4, 0.45, 0.8);// south of bend 6
// Trees around the pond/channel network
makeTreeCluster(15, 20, 5, 1.5, 0.5, 0.85);   // north of POND1
makeTreeCluster(19, 14, 4, 1.3, 0.5, 0.85);   // south between ponds
makeTreeCluster(26, 18, 4, 1.4, 0.5, 0.85);   // east of POND2
makeTreeCluster(26, 13, 4, 1.3, 0.5, 0.85);   // south of FROM LAKES

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
let cowMixer = null;

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
gltfLoader.load('models/field_garden.glb', (gltf) => {
  placeModel(gltf, { worldX: -2, worldZ: -10, targetSize: 14, yaw: 0.3, zUp: false });
}, undefined, (err) => console.warn('field_garden #1 load failed', err));


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
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.9 });
  const road = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, width), roadMat);
  road.position.set(midX, sampleTerrainY(midX, midZ) + 0.08, midZ);
  road.rotation.y = -angle;
  road.receiveShadow = true;
  scene.add(road);
  // Yellow dashed center line
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xfdd835, emissive: 0xfbc02d, emissiveIntensity: 0.3,
  });
  const dashes = Math.max(3, Math.floor(length / 1.5));
  for (let i = 0; i < dashes; i++) {
    const t = (i + 0.3) / dashes;
    const x = fromX + dx * t, z = fromZ + dz * t;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.15), dashMat);
    dash.position.set(x, sampleTerrainY(x, z) + 0.13, z);
    dash.rotation.y = -angle;
    scene.add(dash);
  }
  // Shoulders (lighter strip along edges)
  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 1.0 });
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.05, 0.25), shoulderMat
    );
    const off = (width / 2 + 0.12) * side;
    shoulder.position.set(
      midX - Math.sin(angle) * off,
      sampleTerrainY(midX, midZ) + 0.07,
      midZ + Math.cos(angle) * off
    );
    shoulder.rotation.y = -angle;
    scene.add(shoulder);
  });
}

// Main road: village east edge → industrial complex west edge
buildRoad(-4, 11, 12, 11);
// Short connector: industrial → dam on river
buildRoad(15, 8.5, 10, 1.5, 1.3);

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

// Industrial complex on the open north plain, between terrace, ponds, and windmill
const _indCx = 15, _indCz = 10;
buildFactory(_indCx, _indCz, 0.3);
buildStorageTank(_indCx + 3.0, _indCz - 0.5, 0xeceff1);
buildStorageTank(_indCx + 3.0, _indCz + 1.2, 0xb0bec5);
buildWarehouse(_indCx - 3.0, _indCz + 0.5, -0.2);

// Cow — placed on the open plain south of the river
gltfLoader.load('models/cow_small/scene.gltf', (gltf) => {
  console.log('cow loaded, animations:', gltf.animations.length);
  placeModel(gltf, {
    worldX: 3, worldZ: -4, targetH: 1.5, yaw: 0.8, zUp: false,
  });
  // Mixer must target the original gltf.scene root so animation tracks resolve
  if (gltf.animations && gltf.animations.length) {
    cowMixer = new THREE.AnimationMixer(gltf.scene);
    cowMixer.clipAction(gltf.animations[0]).play();
  }
}, undefined, (err) => console.warn('cow load failed', err));

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
  new THREE.Vector3(-5.5, 0.40, 0.5),
  new THREE.Vector3(-6.5, 0.55, 10.5),
  0x4fc3f7, 0.26
);
// Stormwater drain: from village (-9.5, 10.5) back to river at (-10.5, ~0.9).
buildPipe(
  new THREE.Vector3(-9.5,  0.55, 10.5),
  new THREE.Vector3(-10.5, 0.40, 0.9),
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
buildEvapArrow(12, -16, 3.5);  // FROM SOIL — moved to south plain, away from veg
buildEvapArrow(22, 3,   4.2);  // FROM STREAMS — sits over east tributary head
buildEvapArrow(25, 7,   3.2);  // FROM VEGETATION
buildEvapArrow(25, 15,  3.2);  // FROM LAKES
buildEvapArrow(0, -10,  3.8);  // FROM FIELDS — over the field_garden model

// Source patches beneath each evap arrow — each arrow visually originates
// from a small representation of the thing it's evaporating from.
function buildArrowSource(x, z, kind) {
  const yT = sampleTerrainY(x, z);
  if (kind === 'soil') {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })
    );
    m.position.set(x, yT + 0.04, z); m.receiveShadow = true; scene.add(m);
  } else if (kind === 'stream') {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.0),
      new THREE.MeshStandardMaterial({
        color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.35, roughness: 0.3,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, yT + 0.06, z); scene.add(m);
  } else if (kind === 'vegetation') {
    // Two overlapping clusters → much denser grove than a single cluster
    // could fit given the min-distance reject in makeTreeCluster.
    makeTreeCluster(x, z, 18, 3.0, 0.55, 0.95);
    makeTreeCluster(x - 0.8, z + 0.9, 12, 2.0, 0.40, 0.75);
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
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 28),
      new THREE.MeshStandardMaterial({
        color: 0x1e88e5, emissive: 0x1976d2, emissiveIntensity: 0.4,
        roughness: 0.25, metalness: 0,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, yT + 0.07, z); scene.add(m);
    // Small "shore" ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.55, 28),
      new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, yT + 0.06, z); scene.add(ring);
  }
}
buildArrowSource(12, -16, 'soil');
// FROM STREAMS source is now the head of the east tributary (see river network)
buildArrowSource(25, 7,   'vegetation');
// FROM FIELDS source is now the cloned field_garden.glb (see GLTF section)
buildArrowSource(25, 15,  'lake');

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
}
buildPond(17, 17, 2.4);  // POND1 — bigger flood-collection pond
buildPond(22, 19, 1.7);  // POND2 — storage/recharge pond, near FROM LAKES

// Water channels connecting POND1 ↔ POND2 ↔ FROM LAKES source.
function buildChannel(fromX, fromZ, toX, toZ, width = 0.55) {
  const dx = toX - fromX, dz = toZ - fromZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (fromX + toX) / 2, midZ = (fromZ + toZ) / 2;
  // Sandy bank under the channel
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.04, width + 0.35),
    new THREE.MeshStandardMaterial({ color: 0xc9a663, roughness: 0.95 })
  );
  bank.position.set(midX, sampleTerrainY(midX, midZ) + 0.06, midZ);
  bank.rotation.y = -angle;
  bank.receiveShadow = true;
  scene.add(bank);
  // Water on top
  const channel = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.05, width),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.4,
      roughness: 0.25, metalness: 0,
    })
  );
  channel.position.set(midX, sampleTerrainY(midX, midZ) + 0.09, midZ);
  channel.rotation.y = -angle;
  scene.add(channel);
}

// POND1 (17, 17, r=2.4)  →  POND2 (22, 19, r=1.7)
buildChannel(19.0, 17.7, 20.5, 18.4, 0.55);
// POND2 (22, 19, r=1.7) →  FROM LAKES small lake (25, 15, r=1.3)
buildChannel(22.4, 17.5, 23.9, 15.8, 0.5);
// POND1 (17, 17) →  Agroforestry terrace east edge (12.5, 17) — feeds irrigation
buildChannel(14.7, 17.0, 12.7, 17.0, 0.45);

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
    speed: 0.4 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  };
  scene.add(g);
  fishMeshes.push(g);
  return g;
}

// POND1 — fish scale 1.5 so they're clearly visible from default cam
const _pondY = 0.33;
makeFish(17, 17, _pondY, 1.5, 0xff5722, 1.5);
makeFish(17, 17, _pondY, 0.9, 0xff9800, 1.3);
makeFish(17, 17, _pondY, 1.2, 0xffb74d, 1.4);
// POND2 — 2 fish
makeFish(22, 19, _pondY, 0.8, 0xef5350, 1.3);
makeFish(22, 19, _pondY, 0.55, 0xff7043, 1.2);
// Ocean fish — bigger, brighter for visibility
makeFish(-22, 0,  0.20, 4.0, 0xffeb3b, 2.0);  // yellow
makeFish(-25, 8,  0.20, 3.0, 0xff5722, 1.8);  // bright orange
makeFish(-28, -8, 0.20, 4.5, 0xe91e63, 2.0);  // pink
makeFish(-20, 12, 0.20, 2.5, 0xfdd835, 1.6);  // yellow-gold

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
buildAgroforestryTerrace(8, 17);  // shifted south to make room between terrace and industrial

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
buildTractor(2, -7, 0.4);     // edge of field garden
buildTractor(8, -13, 2.1);    // second tractor on south plain, facing west
// Dam: yaw 1.27 rad rotates the 5-wide wall so it spans ACROSS the river
// (river tangent here is roughly (-0.95, 0, 0.30), so perpendicular yaw ≈ 1.27).
buildDam(9.5, 0.8, 1.27);    // on the main river upstream
buildWindmill(13, 5, 0);     // east plain near small mountain

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
  { id: 'evap', text: 'Evaporation', pos: new THREE.Vector3(-22, 12, 0) },
  { id: 'cond', text: 'Condensation', pos: new THREE.Vector3(0, 19, 4) },
  { id: 'runoff', text: 'Surface Runoff', pos: new THREE.Vector3(4, 3.5, 2.5) },
  { id: 'infil', text: 'Infiltration / Percolation', pos: new THREE.Vector3(-7.5, 4.5, 21) },
  { id: 'ocean', text: 'Ocean', pos: new THREE.Vector3(-22, 1, -10) },
  { id: 'mountain', text: 'Mountain', pos: new THREE.Vector3(18, 8, 6) },
  { id: 'transp', text: 'Transpiration', pos: new THREE.Vector3(5, 9, 11) },
  { id: 'supply', text: 'Water Supply', pos: new THREE.Vector3(-6,  2.0, 5.5) },
  { id: 'storm',  text: 'Stormwater',  pos: new THREE.Vector3(-10, 2.0, 5.5) },
  { id: 'cloudForm', text: 'Cloud Formation', pos: new THREE.Vector3(0, 22, 4) },
  { id: 'fromSoil',  text: 'From Soil',       pos: new THREE.Vector3(12, 4.5, -16) },
  { id: 'fromStream',text: 'From Streams',    pos: new THREE.Vector3(22, 5.0,  3) },
  { id: 'fromVeg',   text: 'From Vegetation', pos: new THREE.Vector3(25, 4.0,  7) },
  { id: 'fromLake',  text: 'From Lakes',      pos: new THREE.Vector3(25, 4.0, 15) },
  { id: 'fromField', text: 'From Fields',     pos: new THREE.Vector3(0,  4.8, -10) },
  { id: 'pond1',     text: 'Pond 1',          pos: new THREE.Vector3(17, 1.5, 17) },
  { id: 'pond2',     text: 'Pond 2',          pos: new THREE.Vector3(22, 1.5, 19) },
  { id: 'cropForest',text: 'Crop & Forestry', pos: new THREE.Vector3(8, 3.2, 14.6) },
  { id: 'tiedRidges',text: 'Tied Ridges',     pos: new THREE.Vector3(8, 2.5, 17) },
  { id: 'industrial',text: 'Industrial Area', pos: new THREE.Vector3(15, 4.5, 10) },
  { id: 'harbour',   text: 'Harbour',         pos: new THREE.Vector3(-18.5, 2.5, 0) },
  { id: 'deforest',  text: 'Deforestation',   pos: new THREE.Vector3(3, 2.5, 9.5) },
  { id: 'forage',    text: 'Forage Grasses',  pos: new THREE.Vector3(8, 2.0, 19.4) },
  { id: 'evapHeader',text: 'Evaporation',     pos: new THREE.Vector3(8, 10, -3) },
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
// 8-stop narrated camera tour through the water cycle.
const tourStops = [
  {
    title: 'The Water Cycle',
    text: 'Welcome — this scene shows water moving between ocean, atmosphere and land. We\'ll follow a drop through each stage of the cycle.',
    cam: new THREE.Vector3(38, 28, 42),
    target: new THREE.Vector3(0, 4, 0),
    labels: [], // null = no dimming on overview
  },
  {
    title: '1. Ocean & Evaporation',
    text: 'About 97% of Earth\'s water sits in the oceans. The sun heats the surface, and water rises as invisible vapor — the orange arrows mark evaporation from soil, streams, fields, and the sea.',
    cam: new THREE.Vector3(-5, 18, 25),
    target: new THREE.Vector3(-22, 8, 0),
    labels: ['ocean', 'evap', 'evapHeader', 'fromSoil', 'fromStream', 'fromVeg', 'fromLake', 'fromField'],
  },
  {
    title: '2. Cloud Formation',
    text: 'High in the atmosphere the vapor cools and condenses into tiny water droplets that cluster as clouds — when enough collect, they become heavy enough to fall.',
    cam: new THREE.Vector3(15, 24, 30),
    target: new THREE.Vector3(8, 18, 0),
    labels: ['cloudForm', 'cond'],
  },
  {
    title: '3. Precipitation',
    text: 'Water returns to the surface as rain, snow, or hail. Here the rain falls over the mountain — the highest catchment in the watershed.',
    cam: new THREE.Vector3(28, 18, 30),
    target: new THREE.Vector3(15, 6, 4),
    labels: ['precip', 'mountain'],
  },
  {
    title: '4. Surface Runoff',
    text: 'Water that doesn\'t soak in flows downhill, gathering into streams and rivers. The meandering river carries it across the plain back toward the ocean.',
    cam: new THREE.Vector3(20, 14, 35),
    target: new THREE.Vector3(0, 1, 0),
    labels: ['runoff'],
  },
  {
    title: '5. Infiltration & Percolation',
    text: 'Some water soaks into the ground. (A) Infiltration enters the soil, (B) Percolation moves deeper, (C) Groundwater flows slowly through the saturated rock — feeding springs and wells.',
    cam: new THREE.Vector3(15, 10, 38),
    target: new THREE.Vector3(0, -2, 18),
    labels: ['infil'],
  },
  {
    title: '6. Transpiration & Deforestation',
    text: 'Plants pull water up from their roots and release it as vapor through their leaves. Forests are huge contributors to atmospheric moisture — but deforestation breaks this loop.',
    cam: new THREE.Vector3(30, 14, 25),
    target: new THREE.Vector3(8, 4, -5),
    labels: ['transp', 'deforest'],
  },
  {
    title: '7. Nature-Based Solutions',
    text: 'Ponds capture floodwater, tied-ridges hold rainfall in place, and agroforestry mixes crops with trees — all keep water on the land longer and recharge groundwater.',
    cam: new THREE.Vector3(20, 14, 35),
    target: new THREE.Vector3(13, 2, 16),
    labels: ['pond1', 'pond2', 'tiedRidges', 'cropForest', 'forage'],
  },
  {
    title: '8. Human Use',
    text: 'People intercept the cycle: water supply pipes draw from the river, stormwater drains carry runoff back, the harbour ties commerce to the sea, and industries draw and discharge.',
    cam: new THREE.Vector3(-10, 16, 30),
    target: new THREE.Vector3(-3, 4, 8),
    labels: ['supply', 'storm', 'harbour', 'industrial'],
  },
  {
    title: '9. Back to the Ocean',
    text: 'The river empties into the ocean — fish, boats, the harbour all depend on it. Evaporation begins again, and the cycle continues endlessly.',
    cam: new THREE.Vector3(-30, 14, 25),
    target: new THREE.Vector3(-22, 2, 0),
    labels: ['ocean', 'harbour'],
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
  window.speechSynthesis.speak(utter);
}
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
tourPlayBtn.addEventListener('click', () => {
  tourPlaying = !tourPlaying;
  tourPlayBtn.textContent = tourPlaying ? 'Pause' : 'Play';
  tourPlayBtn.setAttribute('aria-pressed', String(tourPlaying));
});
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
    tourPlaying = !tourPlaying;
    tourPlayBtn.textContent = tourPlaying ? 'Pause' : 'Play';
    tourPlayBtn.setAttribute('aria-pressed', String(tourPlaying));
    e.preventDefault();
  }
});

// ---------- WELCOME OVERLAY ----------
const welcome = document.getElementById('welcome');
const welcomeClose = document.getElementById('welcome-close');
const welcomeTour = document.getElementById('welcome-tour');
// Only show on first visit this session
if (sessionStorage.getItem('seenWelcome')) {
  welcome.classList.add('welcome-hidden');
} else {
  sessionStorage.setItem('seenWelcome', '1');
}
welcomeClose.addEventListener('click', () => welcome.classList.add('welcome-hidden'));
welcomeTour.addEventListener('click', () => {
  welcome.classList.add('welcome-hidden');
  openTour();
});
welcome.addEventListener('click', (e) => {
  if (e.target === welcome) welcome.classList.add('welcome-hidden');
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
uiCollapseBtn.addEventListener('click', () => {
  const collapsed = uiPanel.classList.toggle('ui-collapsed');
  uiCollapseBtn.textContent = collapsed ? '+' : '-';
  uiCollapseBtn.title = collapsed ? 'Expand panel' : 'Collapse panel';
  uiCollapseBtn.setAttribute('aria-label', collapsed ? 'Expand legend panel' : 'Collapse legend panel');
  uiCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
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
    if (tourDwell >= TOUR_DWELL) {
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

// ---------- RESIZE ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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

  // Pulse land-evaporation arrows so they read as rising vapor plumes
  evapArrows.forEach((a, i) => {
    const phase = a.userData.basePhase;
    a.scale.y = 1 + Math.sin(t * 1.6 + phase) * 0.08;
    a.rotation.y = Math.sin(t * 0.3 + i) * 0.12;
  });

  // Spin windmill blades
  windmillBlades.forEach(h => { h.rotation.z = t * 1.2; });

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

  // Swim fish in circles within their water bodies
  fishMeshes.forEach(f => {
    const ud = f.userData;
    const angle = t * ud.speed + ud.phase;
    f.position.x = ud.cx + Math.cos(angle) * ud.radius;
    f.position.z = ud.cz + Math.sin(angle) * ud.radius;
    f.position.y = ud.y;
    // Face direction of travel (tangent to the circle, +X axis of body model)
    f.rotation.y = -angle - Math.PI / 2;
  });

  // Scroll river water texture (downstream flow) — fast enough to read
  // as moving water, not so fast it looks like a screensaver.
  riverNet.waterTex.offset.y -= dt * 0.9;

  // Drive cow animation if loaded
  if (cowMixer) cowMixer.update(dt);

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
