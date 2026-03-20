import * as THREE from "three";

// --------------------------------------------------
// Utilities
// --------------------------------------------------
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// --------------------------------------------------
// Height function
// --------------------------------------------------
// World coordinates after PlaneGeometry is rotated flat:
// x = left/right
// z = front/back
//
// Mountain is placed toward the back-left corner:
// negative x, negative z
export function getTerrainHeight(x, z) {
  // Main steep mountain near top/back-left corner
  const mountain =
    7.5 * Math.exp(-((x + 8.5) ** 2) / 16 - ((z + 6.8) ** 2) / 12);

  // Shoulder spreading from mountain
  const shoulder =
    3.0 * Math.exp(-((x + 5.0) ** 2) / 28 - ((z + 4.0) ** 2) / 20);

  // Mid hill to soften transition
  const midHill =
    1.5 * Math.exp(-((x + 1.5) ** 2) / 40 - ((z + 1.0) ** 2) / 30);

  // Gentle overall slope down toward front-right
  const slope = -0.08 * x - 0.07 * z;

  // Shallow river corridor for future river placement
  const valley =
    -1.2 * Math.exp(-((x + 1.5) ** 2) / 24 - ((z - 1.8) ** 2) / 8);

  // Small undulations for a more natural surface
  const ripple = 0.15 * Math.sin(x * 0.55) * Math.cos(z * 0.45);

  return mountain + shoulder + midHill + slope + valley + ripple;
}

// --------------------------------------------------
// Vertex color function
// --------------------------------------------------
function getTerrainColor(y, minY, maxY) {
  const t = clamp((y - minY) / (maxY - minY || 1), 0, 1);

  const low = new THREE.Color(0xdbe88f);
  const mid = new THREE.Color(0xbfd86d);
  const high = new THREE.Color(0x8eb34a);

  const color = new THREE.Color();

  if (t < 0.55) {
    color.copy(low).lerp(mid, t / 0.55);
  } else {
    color.copy(mid).lerp(high, (t - 0.55) / 0.45);
  }

  return color;
}

// --------------------------------------------------
// Terrain factory
// --------------------------------------------------
export function createTerrain({
  width = 24,
  depth = 18,
  segmentsX = 180,
  segmentsZ = 140,
  groundSize = 120,
} = {}) {
  const group = new THREE.Group();

  // --------------------------
  // Terrain mesh
  // --------------------------
  const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  const colors = [];

  let minY = Infinity;
  let maxY = -Infinity;

  // Apply heights
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);

    pos.setY(i, y);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Apply vertex colors
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const c = getTerrainColor(y, minY, maxY);
    colors.push(c.r, c.g, c.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });

  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  group.add(terrain);

  // --------------------------
  // Flat base ground
  // --------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({
      color: 0xe2e7dc,
      roughness: 1,
      metalness: 0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  group.add(ground);

  // --------------------------
  // Soft shadow under terrain
  // --------------------------
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 42),
    new THREE.ShadowMaterial({ opacity: 0.12 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.58;
  shadowPlane.receiveShadow = true;
  group.add(shadowPlane);

  return {
    group,
    terrain,
    width,
    depth,
    minY,
    maxY,
    getHeightAt: getTerrainHeight,
  };
}