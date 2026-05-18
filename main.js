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
  // Main river starts at the FOOT of the big mountain (no ribbon on the slope)
  // and flows out across the plain to the ocean.
  const mainRiver = [
    [9.5, 0.8, 0.92],   [7.0, 1.6, 1.00],
    [4.0, 2.0, 1.08],   [1.0, 1.8, 1.16],   [-2.0, 1.2, 1.26],
    [-5.0, 0.5, 1.40],  [-8.0, -0.1, 1.60], [-10.5, -0.6, 1.80],
    [-13.0, -0.9, 2.05], [-15.5, -1.0, 2.25], [-17.5, -1.0, 2.45],
    // Delta extending across the cliff edge (x=-18) into the basin so the
    // ribbon visibly meets the ocean surface instead of stopping on land.
    [-19.0, -1.0, 2.60], [-21.0, -1.0, 2.75],
  ];
  // East tributary: now originates UNDER the FROM STREAMS evap arrow
  // at (22, 3), flows southwest, then joins the main river at (8.5, 1.8).
  const tributaryEast = [
    [22, 3, 0.32], [19, 2.4, 0.42], [16, 1.6, 0.52],
    [14.5, 0.9, 0.62], [11.5, 1.4, 0.72], [8.5, 1.8, 0.82],
  ];
  // South tributary: starts from a wet patch on the south plain and
  // flows northwest to join the main river. (Small mountain removed.)
  const tributarySouth = [
    [12, -8, 0.30], [10, -5, 0.40], [7, -2, 0.55],
    [4, 0.5, 0.7],  [1, 1.6, 0.9],  [-2, 2.0, 1.0],
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


// Morning Town — north plain, well clear of the river. Footprint spans
// roughly z=6.5 to 17.5 while the river at this x sits at z~0.3.
gltfLoader.load('models/morning_town/scene.gltf', (gltf) => {
  console.log('town loaded');
  placeModel(gltf, {
    worldX: -7, worldZ: 12, targetSize: 11, yaw: -0.4, zUp: false,
  });
}, undefined, (err) => console.warn('town load failed', err));

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

// ---------- RAIN PARTICLES ----------
const RAIN_COUNT = 600;
const rainGeo = new THREE.BufferGeometry();
const rainPositions = new Float32Array(RAIN_COUNT * 3);
const rainVelocities = new Float32Array(RAIN_COUNT);
for (let i = 0; i < RAIN_COUNT; i++) {
  rainPositions[i * 3] = 14 + (Math.random() - 0.5) * 10;
  rainPositions[i * 3 + 1] = Math.random() * 12 + 4;
  rainPositions[i * 3 + 2] = 4 + (Math.random() - 0.5) * 8;
  rainVelocities[i] = 0.15 + Math.random() * 0.15;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.PointsMaterial({
  color: 0x4fc3f7,
  size: 0.25,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});
const rain = new THREE.Points(rainGeo, rainMat);
scene.add(rain);

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
// Water supply line: river point near (-5, 0.3, 0.5) up to town south edge (-6, 0.5, 7)
buildPipe(
  new THREE.Vector3(-5.5, 0.35, 0.6),
  new THREE.Vector3(-6,   0.55, 7.0),
  0x4fc3f7, 0.18
);
// Stormwater drain: town (-9, 0.5, 7) back to river at (-10, 0.3, -0.5)
buildPipe(
  new THREE.Vector3(-9,   0.55, 7.0),
  new THREE.Vector3(-10,  0.35, -0.5),
  0x546e7a, 0.22
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
buildAgroforestryTerrace(8, 15);  // west of POND1, next to the pond cluster

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
  { id: 'supply', text: 'Water Supply', pos: new THREE.Vector3(-5.5, 2.0, 3.5) },
  { id: 'storm', text: 'Stormwater', pos: new THREE.Vector3(-9.5, 2.0, 3.0) },
  { id: 'cloudForm', text: 'Cloud Formation', pos: new THREE.Vector3(0, 22, 4) },
  { id: 'fromSoil',  text: 'From Soil',       pos: new THREE.Vector3(12, 4.5, -16) },
  { id: 'fromStream',text: 'From Streams',    pos: new THREE.Vector3(22, 5.0,  3) },
  { id: 'fromVeg',   text: 'From Vegetation', pos: new THREE.Vector3(25, 4.0,  7) },
  { id: 'fromLake',  text: 'From Lakes',      pos: new THREE.Vector3(25, 4.0, 15) },
  { id: 'fromField', text: 'From Fields',     pos: new THREE.Vector3(0,  4.8, -10) },
  { id: 'pond1',     text: 'Pond 1',          pos: new THREE.Vector3(17, 1.5, 17) },
  { id: 'pond2',     text: 'Pond 2',          pos: new THREE.Vector3(22, 1.5, 19) },
  { id: 'cropForest',text: 'Crop & Forestry', pos: new THREE.Vector3(8, 3.2, 12.6) },
  { id: 'tiedRidges',text: 'Tied Ridges',     pos: new THREE.Vector3(8, 2.5, 15) },
  { id: 'forage',    text: 'Forage Grasses',  pos: new THREE.Vector3(8, 2.0, 17.4) },
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
document.getElementById('toggleLabels').addEventListener('click', () => {
  labelsVisible = !labelsVisible;
  labelsContainer.style.display = labelsVisible ? 'block' : 'none';
});
document.getElementById('toggleRain').addEventListener('click', () => {
  rainOn = !rainOn;
  rain.visible = rainOn;
});
document.getElementById('resetCam').addEventListener('click', () => {
  camera.position.copy(DEFAULT_CAM);
  controls.target.set(0, 4, 0);
});

// ---------- RESIZE ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- ANIMATION LOOP ----------
const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();

  // Drift clouds
  clouds.forEach(c => {
    c.position.x = c.userData.baseX + Math.sin(t * 0.15 * c.userData.driftSpeed) * 2;
    if (c.position.x > 30) c.position.x = -30;
  });

  // Rain falling
  if (rainOn) {
    const rp = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      rp[i * 3 + 1] -= rainVelocities[i] * 60 * dt;
      if (rp[i * 3 + 1] < sampleTerrainY(rp[i * 3], rp[i * 3 + 2]) + 0.2) {
        rp[i * 3 + 1] = 14 + Math.random() * 4;
        rp[i * 3] = 14 + (Math.random() - 0.5) * 10;
        rp[i * 3 + 2] = 4 + (Math.random() - 0.5) * 8;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
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

  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
