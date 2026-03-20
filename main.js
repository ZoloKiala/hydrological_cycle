import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --------------------------------------------------
// Config
// --------------------------------------------------
const WEATHER_MODEL_PATH = "/models/weather_animated_fixed.glb";
const TREE_MODEL_PATH = "/models/trees.glb";
const FIELD_MODEL_PATH = "/models/field_garden.glb";
const COW_MODEL_PATH = "/models/cow_small/scene.gltf";
const INDUSTRY_MODEL_PATH = "/models/industry/scene.gltf";
const BUILDING_MODEL_PATH = "/models/morning_town/scene.gltf";

const WEATHER_MODEL_SCALE = 1.8;

// Sketchfab assets often have very different native scales.
const COW_BASE_SCALE = 0.005;
const INDUSTRY_BASE_SCALE = 0.004;
const BUILDING_BASE_SCALE = 0.01;

// --------------------------------------------------
// Scene
// --------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ecef);

// --------------------------------------------------
// Camera
// --------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(6, 5, 8);

// --------------------------------------------------
// Renderer
// --------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(renderer.domElement);

// --------------------------------------------------
// Controls
// --------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;

controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;

controls.minDistance = 0.8;
controls.maxDistance = 60;
controls.minPolarAngle = 0.0;
controls.maxPolarAngle = Math.PI / 2;

controls.zoomSpeed = 1.8;
controls.autoRotate = false;
controls.autoRotateSpeed = 2.0;
controls.zoomToCursor = true;
controls.listenToKeyEvents(window);

// --------------------------------------------------
// Lights
// --------------------------------------------------
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.25);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(8, 12, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 100;
scene.add(dirLight);

// --------------------------------------------------
// Floor shadow
// --------------------------------------------------
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShadowMaterial({ opacity: 0.12 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

// --------------------------------------------------
// State
// --------------------------------------------------
const loader = new GLTFLoader();
const clock = new THREE.Clock();

let mixer = null;
let modelRoot = null;
let cameraTween = null;
const extraMixers = [];

const modelViewState = {
  ready: false,
  center: new THREE.Vector3(),
  radius: 3,
  defaultPosition: new THREE.Vector3(),
  defaultTarget: new THREE.Vector3(),
};

// --------------------------------------------------
// Camera tween
// --------------------------------------------------
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function tweenCameraTo(toPosition, toTarget, duration = 700) {
  cameraTween = {
    start: performance.now(),
    duration,
    fromPosition: camera.position.clone(),
    toPosition: toPosition.clone(),
    fromTarget: controls.target.clone(),
    toTarget: toTarget.clone(),
  };
}

function updateCameraTween(now) {
  if (!cameraTween) return;

  const elapsed = now - cameraTween.start;
  const t = Math.min(elapsed / cameraTween.duration, 1);
  const k = easeInOutCubic(t);

  camera.position.lerpVectors(
    cameraTween.fromPosition,
    cameraTween.toPosition,
    k
  );

  controls.target.lerpVectors(
    cameraTween.fromTarget,
    cameraTween.toTarget,
    k
  );

  if (t >= 1) {
    cameraTween = null;
  }
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function enableShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function containsMesh(object) {
  let found = false;
  object.traverse((child) => {
    if (child.isMesh) found = true;
  });
  return found;
}

function centerObjectOnGround(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);

  object.position.x -= center.x;
  object.position.y -= box.min.y;
  object.position.z -= center.z;

  return new THREE.Box3().setFromObject(object);
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  const sphere = new THREE.Sphere();

  box.getCenter(center);
  box.getSize(size);
  box.getBoundingSphere(sphere);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);

  // Closer default distance so the scene appears bigger on load
  let cameraDist = (maxDim * 0.5) / Math.tan(fov * 0.5);
  cameraDist *= 1.0;

  // Front-left, slightly low hero view similar to your screenshot
  const startPosition = new THREE.Vector3(
    center.x - cameraDist * 0.8,
    center.y + size.y * 0.8,
    center.z + cameraDist * 0.3
  );

  // Aim near the visual middle of the block
  const startTarget = new THREE.Vector3(
    center.x + size.x * 0.02,
    center.y + size.y * 0.08,
    center.z - size.z * 0.02
  );

  camera.position.copy(startPosition);
  controls.target.copy(startTarget);

  controls.minDistance = Math.max(maxDim * 0.22, 1.2);
  controls.maxDistance = maxDim * 4.2;

  controls.update();
  controls.saveState();

  modelViewState.ready = true;
  modelViewState.center.copy(center);
  modelViewState.radius = Math.max(sphere.radius, 1.5);
  modelViewState.defaultPosition.copy(startPosition);
  modelViewState.defaultTarget.copy(startTarget);
}

function buildGroundedClone(source) {
  const wrapper = new THREE.Group();
  const clone = source.clone(true);

  enableShadows(clone);
  wrapper.add(clone);

  const box = new THREE.Box3().setFromObject(clone);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  clone.position.x -= center.x;
  clone.position.y -= box.min.y;
  clone.position.z -= center.z;

  return { wrapper, clone, size };
}

function getTreeSources(treeScene) {
  const directChildren = treeScene.children.filter((child) => containsMesh(child));
  if (directChildren.length > 0) return directChildren;
  return containsMesh(treeScene) ? [treeScene] : [];
}

function createTerrainSampler(bounds) {
  const size = bounds.getSize(new THREE.Vector3());

  const terrainMinX = bounds.min.x + size.x * 0.14;
  const terrainMaxX = bounds.max.x - size.x * 0.10;
  const terrainMinZ = bounds.min.z + size.z * 0.16;
  const terrainMaxZ = bounds.max.z - size.z * 0.08;

  function xFromU(u) {
    return THREE.MathUtils.lerp(terrainMinX, terrainMaxX, u);
  }

  function zFromV(v) {
    return THREE.MathUtils.lerp(terrainMinZ, terrainMaxZ, v);
  }

  function yAt(u, v) {
    const base = bounds.min.y + size.y * 0.18;
    const gentleSlope = size.y * (0.03 * (1 - u) + 0.02 * (1 - v));
    const mountain =
      size.y *
      0.11 *
      Math.exp(
        -((u - 0.20) ** 2) / 0.012 -
        ((v - 0.18) ** 2) / 0.025
      );

    return base + gentleSlope + mountain;
  }

  return { xFromU, zFromV, yAt, size };
}

// --------------------------------------------------
// Models
// --------------------------------------------------
function addIndustryToWeather(parentModel, weatherLocalBounds) {
  loader.load(
    INDUSTRY_MODEL_PATH,
    (gltf) => {
      const industryRoot = gltf.scene;

      if (!containsMesh(industryRoot)) {
        console.warn("Industry model loaded, but no mesh was found.");
      }

      enableShadows(industryRoot);

      const wrapper = new THREE.Group();
      wrapper.add(industryRoot);

      const box = new THREE.Box3().setFromObject(industryRoot);
      const center = new THREE.Vector3();

      box.getCenter(center);

      industryRoot.position.x -= center.x;
      industryRoot.position.y -= box.min.y;
      industryRoot.position.z -= center.z;

      const sampler = createTerrainSampler(weatherLocalBounds);
      const terrainSize = sampler.size;
      const parentScale = parentModel.scale.x || 1;

      const u = 0.62;
      const v = 0.61;

      const finalScale = INDUSTRY_BASE_SCALE / parentScale;
      wrapper.scale.setScalar(finalScale);
      wrapper.rotation.y = -0.5;

      // Lowered so the industry sits better on the terrain
      const lift = terrainSize.y * 0.008;

      wrapper.position.set(
        sampler.xFromU(u),
        sampler.yAt(u, v) + lift,
        sampler.zFromV(v)
      );

      parentModel.add(wrapper);

      if (gltf.animations && gltf.animations.length > 0) {
        const industryMixer = new THREE.AnimationMixer(wrapper);
        gltf.animations.forEach((clip) => {
          industryMixer.clipAction(clip).play();
        });
        extraMixers.push(industryMixer);
      }

      console.log("Industry model loaded successfully.");
    },
    undefined,
    (error) => {
      console.error("Error loading industry model:", error);
    }
  );
}

function addFieldGardenToWeather(parentModel, weatherLocalBounds) {
  loader.load(
    FIELD_MODEL_PATH,
    (gltf) => {
      const fieldRoot = gltf.scene;
      enableShadows(fieldRoot);

      const wrapper = new THREE.Group();
      wrapper.add(fieldRoot);

      const box = new THREE.Box3().setFromObject(fieldRoot);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      box.getCenter(center);
      box.getSize(size);

      fieldRoot.position.x -= center.x;
      fieldRoot.position.y -= box.min.y;
      fieldRoot.position.z -= center.z;

      const sampler = createTerrainSampler(weatherLocalBounds);

      const u = 0.78;
      const v = 0.48;
      const parentScale = parentModel.scale.x || 1;

      const targetHeight = sampler.size.y * 0.10;
      const targetFootprint = Math.min(sampler.size.x, sampler.size.z) * 0.50;

      const scaleByHeight = targetHeight / Math.max(size.y, 0.001);
      const scaleByFootprint =
        targetFootprint / Math.max(size.x, size.z, 0.001);
      const scaleFactor =
        Math.min(scaleByHeight, scaleByFootprint) / parentScale;

      wrapper.scale.setScalar(scaleFactor);
      wrapper.rotation.y = -0.2;

      const lift = sampler.size.y * 0.01;

      wrapper.position.set(
        sampler.xFromU(u),
        sampler.yAt(u, v) + lift,
        sampler.zFromV(v)
      );

      parentModel.add(wrapper);
    },
    undefined,
    (error) => {
      console.error("Error loading field/garden model:", error);
    }
  );
}

function addTreesToWeather(parentModel, weatherLocalBounds) {
  loader.load(
    TREE_MODEL_PATH,
    (gltf) => {
      const treeSources = getTreeSources(gltf.scene);

      if (!treeSources.length) {
        console.warn("No tree meshes found in tree model.");
        return;
      }

      const sampler = createTerrainSampler(weatherLocalBounds);
      const terrainSize = sampler.size;
      const parentScale = parentModel.scale.x || 1;

      const clusters = [
        { u: 0.34, v: 0.26, count: 7, spreadU: 0.045, spreadV: 0.045 },
        { u: 0.40, v: 0.26, count: 8, spreadU: 0.050, spreadV: 0.045 },
        { u: 0.46, v: 0.26, count: 6, spreadU: 0.040, spreadV: 0.040 },
      ];

      let treeIndex = 0;

      clusters.forEach((cluster) => {
        for (let i = 0; i < cluster.count; i++) {
          const source = treeSources[treeIndex % treeSources.length];
          treeIndex += 1;

          const { wrapper, size } = buildGroundedClone(source);

          const u = THREE.MathUtils.clamp(
            cluster.u + (Math.random() - 0.5) * cluster.spreadU,
            0.10,
            0.90
          );

          const v = THREE.MathUtils.clamp(
            cluster.v + (Math.random() - 0.5) * cluster.spreadV,
            0.10,
            0.92
          );

          const targetHeight = THREE.MathUtils.lerp(
            terrainSize.y * 0.09,
            terrainSize.y * 0.16,
            Math.random()
          );

          const scaleFactor =
            (targetHeight / Math.max(size.y, 0.001)) / parentScale;

          wrapper.scale.setScalar(scaleFactor);
          wrapper.rotation.y = Math.random() * Math.PI * 2;

          const lift = terrainSize.y * 0.008;

          wrapper.position.set(
            sampler.xFromU(u),
            sampler.yAt(u, v) + lift,
            sampler.zFromV(v)
          );

          parentModel.add(wrapper);
        }
      });

      console.log("Smaller forest repositioned successfully.");
    },
    undefined,
    (error) => {
      console.error("Error loading trees:", error);
    }
  );
}

function addBuildingSetToWeather(parentModel, weatherLocalBounds) {
  loader.load(
    BUILDING_MODEL_PATH,
    (gltf) => {
      const buildingRoot = gltf.scene;

      if (!containsMesh(buildingRoot)) {
        console.warn("Morning Town model loaded, but no mesh was found.");
      }

      enableShadows(buildingRoot);

      const wrapper = new THREE.Group();
      wrapper.add(buildingRoot);

      const box = new THREE.Box3().setFromObject(buildingRoot);
      const center = new THREE.Vector3();

      box.getCenter(center);

      buildingRoot.position.x -= center.x;
      buildingRoot.position.y -= box.min.y;
      buildingRoot.position.z -= center.z;

      const sampler = createTerrainSampler(weatherLocalBounds);
      const terrainSize = sampler.size;
      const parentScale = parentModel.scale.x || 1;

      const u = 0.07;
      const v = 0.45;

      const finalScale = 0.007 / parentScale;
      wrapper.scale.setScalar(finalScale);

      wrapper.rotation.y = -0.35;

      const lift = -terrainSize.y * 0.004;

      wrapper.position.set(
        sampler.xFromU(u),
        sampler.yAt(u, v) + lift,
        sampler.zFromV(v)
      );

      parentModel.add(wrapper);

      console.log("Morning Town added successfully.", { finalScale, u, v });
    },
    undefined,
    (error) => {
      console.error("Error loading Morning Town model:", error);
    }
  );
}

function addCowsToWeather(parentModel, weatherLocalBounds) {
  loader.load(
    COW_MODEL_PATH,
    (gltf) => {
      const cowSource = gltf.scene;

      if (!containsMesh(cowSource)) {
        console.warn("Cow model loaded, but no mesh was found.");
      }

      enableShadows(cowSource);

      const sampler = createTerrainSampler(weatherLocalBounds);
      const terrainSize = sampler.size;
      const parentScale = parentModel.scale.x || 1;

      const placements = [
        { u: 0.71, v: 0.45, rot: 0.5, localScale: 1.0 },
        { u: 0.76, v: 0.49, rot: 1.8, localScale: 0.95 },
        { u: 0.81, v: 0.46, rot: -0.4, localScale: 0.9 },
      ];

      placements.forEach((placement) => {
        const { wrapper, clone } = buildGroundedClone(cowSource);

        clone.scale.set(1, 1, 1);

        const finalScale =
          (COW_BASE_SCALE * placement.localScale) / parentScale;

        wrapper.scale.setScalar(finalScale);
        wrapper.rotation.y = placement.rot;

        const lift = terrainSize.y * 0.004;

        wrapper.position.set(
          sampler.xFromU(placement.u),
          sampler.yAt(placement.u, placement.v) + lift,
          sampler.zFromV(placement.v)
        );

        parentModel.add(wrapper);

        if (gltf.animations && gltf.animations.length > 0) {
          const cowMixer = new THREE.AnimationMixer(wrapper);
          gltf.animations.forEach((clip) => {
            cowMixer.clipAction(clip).play();
          });
          extraMixers.push(cowMixer);
        }
      });

      console.log("New cow model loaded successfully.");
    },
    undefined,
    (error) => {
      console.error("Error loading cows:", error);
    }
  );
}

// --------------------------------------------------
// View helpers
// --------------------------------------------------
function goToSavedHomeView() {
  if (!modelViewState.ready) return;

  tweenCameraTo(
    modelViewState.defaultPosition,
    modelViewState.defaultTarget,
    700
  );
}

function goToDirectionalView(direction, distanceMultiplier = 3.0) {
  if (!modelViewState.ready) return;

  const dir = direction.clone().normalize();
  const target = modelViewState.center.clone();
  const distance = Math.max(modelViewState.radius * distanceMultiplier, 4);

  const position = target.clone().add(dir.multiplyScalar(distance));
  tweenCameraTo(position, target, 700);
}

function resetView() {
  controls.reset();
  goToSavedHomeView();
}

function zoomByFactor(factor) {
  if (!controls.enableZoom) return;

  const target = controls.target.clone();
  const offset = camera.position.clone().sub(target);
  const currentDistance = offset.length();

  let nextDistance = currentDistance * factor;
  nextDistance = Math.max(controls.minDistance, nextDistance);
  nextDistance = Math.min(controls.maxDistance, nextDistance);

  if (currentDistance <= 0.0001) return;

  const nextPosition = target
    .clone()
    .add(offset.normalize().multiplyScalar(nextDistance));

  tweenCameraTo(nextPosition, target, 220);
}

function zoomIn() {
  zoomByFactor(0.8);
}

function zoomOut() {
  zoomByFactor(1.25);
}

function orbitStep(deltaAzimuth = 0, deltaPolar = 0) {
  const target = controls.target.clone();
  const offset = camera.position.clone().sub(target);

  const spherical = new THREE.Spherical().setFromVector3(offset);

  spherical.theta += deltaAzimuth;
  spherical.phi += deltaPolar;

  const minPhi = 0.12;
  const maxPhi = Math.PI / 2 - 0.05;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, minPhi, maxPhi);

  const nextPosition = new THREE.Vector3()
    .setFromSpherical(spherical)
    .add(target);

  tweenCameraTo(nextPosition, target, 260);
}

function panStep(dx = 0, dz = 0) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(forward, camera.up)
    .normalize();

  const move = new THREE.Vector3()
    .addScaledVector(right, dx)
    .addScaledVector(forward, dz);

  camera.position.add(move);
  controls.target.add(move);
  controls.update();

  modelViewState.defaultPosition.copy(camera.position);
  modelViewState.defaultTarget.copy(controls.target);
}

// --------------------------------------------------
// UI panel
// --------------------------------------------------
function createControlPanel() {
  const style = document.createElement("style");
  style.textContent = `
    .nav-suite {
      position: fixed;
      top: 18px;
      left: 18px;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      gap: 18px;
      font-family: Arial, sans-serif;
      user-select: none;
    }

    .nav-box {
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(6px);
      box-shadow: 0 8px 18px rgba(0,0,0,0.14);
      border: 1px solid rgba(0,0,0,0.08);
    }

    .nav-bar {
      width: 54px;
      padding: 10px 8px;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .nav-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 10px;
      background: #f3f4f6;
      color: #4b5563;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
    }

    .nav-btn:hover {
      background: #e5e7eb;
    }

    .nav-wheel-wrap {
      position: relative;
      width: 150px;
      height: 150px;
    }

    .nav-wheel {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background:
        radial-gradient(circle at center, #ffffff 0 24px, #e6e8ec 25px 46px, #f8fafc 47px 74px, #d1d5db 75px 76px, #f8fafc 77px 100%);
      box-shadow: 0 8px 18px rgba(0,0,0,0.14);
      border: 1px solid rgba(0,0,0,0.08);
    }

    .wheel-label {
      position: absolute;
      font-size: 11px;
      font-weight: 700;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      pointer-events: none;
    }

    .wheel-label.zoom { top: 12px; left: 50%; transform: translateX(-50%); }
    .wheel-label.orbit { left: 12px; top: 50%; transform: translateY(-50%) rotate(-90deg); transform-origin: center; }
    .wheel-label.pan { bottom: 12px; left: 50%; transform: translateX(-50%); }
    .wheel-label.move { right: 10px; top: 50%; transform: translateY(-50%) rotate(90deg); transform-origin: center; color: #15803d; }

    .wheel-btn {
      position: absolute;
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: #6b7280;
      font-size: 20px;
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .wheel-btn:hover {
      background: rgba(0,0,0,0.05);
    }

    .wheel-btn.top { left: 50%; top: 28px; transform: translateX(-50%); }
    .wheel-btn.bottom { left: 50%; bottom: 28px; transform: translateX(-50%); }
    .wheel-btn.left { left: 28px; top: 50%; transform: translateY(-50%); }
    .wheel-btn.right { right: 28px; top: 50%; transform: translateY(-50%); }

    .wheel-inner-btn {
      position: absolute;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 999px;
      background: #eef2f7;
      color: #6b7280;
      font-size: 16px;
      cursor: pointer;
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
    }

    .wheel-inner-btn:hover {
      background: #e5e7eb;
    }

    .wheel-inner-btn.up { left: 50%; top: 48px; transform: translateX(-50%); }
    .wheel-inner-btn.down { left: 50%; bottom: 48px; transform: translateX(-50%); }
    .wheel-inner-btn.center { left: 50%; top: 50%; transform: translate(-50%, -50%); width: 34px; height: 34px; font-size: 12px; font-weight: 700; }

    .cube-wrap {
      position: relative;
      width: 150px;
      height: 150px;
    }

    .cube-ring {
      position: absolute;
      left: 26px;
      bottom: 20px;
      width: 98px;
      height: 48px;
      border-radius: 999px;
      background: #d7dbe2;
      box-shadow: inset 0 -4px 8px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.10);
    }

    .cube-cardinal {
      position: absolute;
      font-size: 12px;
      font-weight: 700;
      color: #6b7280;
      pointer-events: none;
    }

    .cube-cardinal.n { left: 50%; top: 6px; transform: translateX(-50%); }
    .cube-cardinal.s { left: 50%; bottom: 0; transform: translateX(-50%); }
    .cube-cardinal.w { left: 8px; top: 50%; transform: translateY(-50%); }
    .cube-cardinal.e { right: 8px; top: 50%; transform: translateY(-50%); }

    .cube {
      position: absolute;
      left: 50%;
      top: 54%;
      transform: translate(-50%, -50%) rotateX(12deg) rotateZ(-35deg);
      width: 62px;
      height: 62px;
      transform-style: preserve-3d;
    }

    .cube-face {
      position: absolute;
      width: 46px;
      height: 46px;
      border: 1px solid #8b9098;
      background: linear-gradient(135deg, #f2f4f7, #cad1db);
      display: grid;
      place-items: center;
      font-size: 10px;
      font-weight: 700;
      color: #5b6470;
      cursor: pointer;
    }

    .cube-face.top {
      transform: translateZ(23px);
      left: 8px;
      top: 0;
    }

    .cube-face.front {
      transform: rotateX(-90deg) translateZ(23px);
      left: 8px;
      top: 23px;
      background: linear-gradient(135deg, #dbeafe, #bfdbfe);
      color: #1d4ed8;
    }

    .cube-face.right {
      transform: rotateY(90deg) translateZ(23px);
      left: 31px;
      top: 23px;
    }

    .cube-rot {
      position: absolute;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: #9ca3af;
      font-size: 20px;
      cursor: pointer;
    }

    .cube-rot.left { left: 6px; top: 12px; }
    .cube-rot.right { right: 6px; top: 12px; }

    .cube-rot:hover {
      color: #6b7280;
    }
  `;
  document.head.appendChild(style);

  const suite = document.createElement("div");
  suite.className = "nav-suite";

  const navBar = document.createElement("div");
  navBar.className = "nav-box nav-bar";

  const homeBtn = document.createElement("button");
  homeBtn.className = "nav-btn";
  homeBtn.textContent = "⌂";
  homeBtn.title = "Home view";
  homeBtn.onclick = goToSavedHomeView;

  const zoomInBtn = document.createElement("button");
  zoomInBtn.className = "nav-btn";
  zoomInBtn.textContent = "+";
  zoomInBtn.title = "Zoom in";
  zoomInBtn.onclick = zoomIn;

  const zoomOutBtn = document.createElement("button");
  zoomOutBtn.className = "nav-btn";
  zoomOutBtn.textContent = "−";
  zoomOutBtn.title = "Zoom out";
  zoomOutBtn.onclick = zoomOut;

  const resetBtn = document.createElement("button");
  resetBtn.className = "nav-btn";
  resetBtn.textContent = "↺";
  resetBtn.title = "Reset view";
  resetBtn.onclick = resetView;

  navBar.appendChild(homeBtn);
  navBar.appendChild(zoomInBtn);
  navBar.appendChild(zoomOutBtn);
  navBar.appendChild(resetBtn);

  const wheelWrap = document.createElement("div");
  wheelWrap.className = "nav-wheel-wrap";

  const wheel = document.createElement("div");
  wheel.className = "nav-box nav-wheel";

  const labelZoom = document.createElement("div");
  labelZoom.className = "wheel-label zoom";
  labelZoom.textContent = "Zoom";

  const labelOrbit = document.createElement("div");
  labelOrbit.className = "wheel-label orbit";
  labelOrbit.textContent = "Orbit";

  const labelPan = document.createElement("div");
  labelPan.className = "wheel-label pan";
  labelPan.textContent = "Pan";

  const labelMove = document.createElement("div");
  labelMove.className = "wheel-label move";
  labelMove.textContent = "Move";

  const wheelTop = document.createElement("button");
  wheelTop.className = "wheel-btn top";
  wheelTop.textContent = "＋";
  wheelTop.title = "Zoom in";
  wheelTop.onclick = zoomIn;

  const wheelBottom = document.createElement("button");
  wheelBottom.className = "wheel-btn bottom";
  wheelBottom.textContent = "－";
  wheelBottom.title = "Zoom out";
  wheelBottom.onclick = zoomOut;

  const wheelLeft = document.createElement("button");
  wheelLeft.className = "wheel-btn left";
  wheelLeft.textContent = "◀";
  wheelLeft.title = "Orbit left";
  wheelLeft.onclick = () => orbitStep(-0.24, 0);

  const wheelRight = document.createElement("button");
  wheelRight.className = "wheel-btn right";
  wheelRight.textContent = "▶";
  wheelRight.title = "Orbit right";
  wheelRight.onclick = () => orbitStep(0.24, 0);

  const wheelUp = document.createElement("button");
  wheelUp.className = "wheel-inner-btn up";
  wheelUp.textContent = "▲";
  wheelUp.title = "Tilt up";
  wheelUp.onclick = () => orbitStep(0, -0.18);

  const wheelDown = document.createElement("button");
  wheelDown.className = "wheel-inner-btn down";
  wheelDown.textContent = "▼";
  wheelDown.title = "Tilt down";
  wheelDown.onclick = () => orbitStep(0, 0.18);

  const wheelCenter = document.createElement("button");
  wheelCenter.className = "wheel-inner-btn center";
  wheelCenter.textContent = "⌂";
  wheelCenter.title = "Home";
  wheelCenter.onclick = goToSavedHomeView;

  wheelWrap.appendChild(wheel);
  wheelWrap.appendChild(labelZoom);
  wheelWrap.appendChild(labelOrbit);
  wheelWrap.appendChild(labelPan);
  wheelWrap.appendChild(labelMove);
  wheelWrap.appendChild(wheelTop);
  wheelWrap.appendChild(wheelBottom);
  wheelWrap.appendChild(wheelLeft);
  wheelWrap.appendChild(wheelRight);
  wheelWrap.appendChild(wheelUp);
  wheelWrap.appendChild(wheelDown);
  wheelWrap.appendChild(wheelCenter);

  const cubeWrap = document.createElement("div");
  cubeWrap.className = "cube-wrap";

  const cubeRing = document.createElement("div");
  cubeRing.className = "cube-ring";

  const cN = document.createElement("div");
  cN.className = "cube-cardinal n";
  cN.textContent = "N";

  const cS = document.createElement("div");
  cS.className = "cube-cardinal s";
  cS.textContent = "S";

  const cW = document.createElement("div");
  cW.className = "cube-cardinal w";
  cW.textContent = "W";

  const cE = document.createElement("div");
  cE.className = "cube-cardinal e";
  cE.textContent = "E";

  const cube = document.createElement("div");
  cube.className = "cube";

  const faceTop = document.createElement("div");
  faceTop.className = "cube-face top";
  faceTop.textContent = "TOP";
  faceTop.onclick = () =>
    goToDirectionalView(new THREE.Vector3(0.001, 1, 0.001), 2.6);

  const faceFront = document.createElement("div");
  faceFront.className = "cube-face front";
  faceFront.textContent = "FRONT";
  faceFront.onclick = () =>
    goToDirectionalView(new THREE.Vector3(0.08, 0.18, 1), 3.0);

  const faceRight = document.createElement("div");
  faceRight.className = "cube-face right";
  faceRight.textContent = "RIGHT";
  faceRight.onclick = () =>
    goToDirectionalView(new THREE.Vector3(1, 0.35, 0.2), 3.0);

  cube.appendChild(faceTop);
  cube.appendChild(faceFront);
  cube.appendChild(faceRight);

  const rotLeft = document.createElement("button");
  rotLeft.className = "cube-rot left";
  rotLeft.textContent = "↺";
  rotLeft.title = "Rotate left";
  rotLeft.onclick = () => orbitStep(-0.28, 0);

  const rotRight = document.createElement("button");
  rotRight.className = "cube-rot right";
  rotRight.textContent = "↻";
  rotRight.title = "Rotate right";
  rotRight.onclick = () => orbitStep(0.28, 0);

  cubeWrap.appendChild(cubeRing);
  cubeWrap.appendChild(cN);
  cubeWrap.appendChild(cS);
  cubeWrap.appendChild(cW);
  cubeWrap.appendChild(cE);
  cubeWrap.appendChild(cube);
  cubeWrap.appendChild(rotLeft);
  cubeWrap.appendChild(rotRight);

  suite.appendChild(navBar);
  suite.appendChild(wheelWrap);
  suite.appendChild(cubeWrap);

  document.body.appendChild(suite);
}

function createSceneTitle() {
  const title = document.createElement("div");
  title.textContent = "Hydrological Cycle";

  title.style.position = "fixed";
  title.style.top = "16px";
  title.style.left = "50%";
  title.style.transform = "translateX(-50%)";
  title.style.padding = "10px 18px";
  title.style.background = "rgba(255,255,255,0.92)";
  title.style.backdropFilter = "blur(6px)";
  title.style.border = "1px solid rgba(0,0,0,0.08)";
  title.style.borderRadius = "14px";
  title.style.boxShadow = "0 10px 24px rgba(0,0,0,0.12)";
  title.style.fontFamily = "Arial, sans-serif";
  title.style.fontSize = "22px";
  title.style.fontWeight = "700";
  title.style.color = "#1f2937";
  title.style.letterSpacing = "0.02em";
  title.style.zIndex = "1000";
  title.style.pointerEvents = "none";

  document.body.appendChild(title);
}

createControlPanel();
createSceneTitle();

// --------------------------------------------------
// Weather model
// --------------------------------------------------
loader.load(
  WEATHER_MODEL_PATH,
  (gltf) => {
    modelRoot = gltf.scene;
    enableShadows(modelRoot);

    const weatherLocalBounds = centerObjectOnGround(modelRoot);

    modelRoot.scale.setScalar(WEATHER_MODEL_SCALE);
    scene.add(modelRoot);

    fitCameraToObject(modelRoot);

    addFieldGardenToWeather(modelRoot, weatherLocalBounds);
    addBuildingSetToWeather(modelRoot, weatherLocalBounds);
    addIndustryToWeather(modelRoot, weatherLocalBounds);
    addTreesToWeather(modelRoot, weatherLocalBounds);
    addCowsToWeather(modelRoot, weatherLocalBounds);

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(modelRoot);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
      console.log(`Loaded ${gltf.animations.length} animation(s).`);
    } else {
      console.log("Weather model loaded, but no animations found.");
    }
  },
  undefined,
  (error) => {
    console.error("Error loading weather model:", error);
  }
);

// --------------------------------------------------
// Keyboard shortcuts
// --------------------------------------------------
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "r") resetView();
  if (key === "+" || key === "=") zoomIn();
  if (key === "-" || key === "_") zoomOut();
});

// --------------------------------------------------
// Animate
// --------------------------------------------------
function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);
  extraMixers.forEach((m) => m.update(delta));

  updateCameraTween(now);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// --------------------------------------------------
// Resize
// --------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});