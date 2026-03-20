import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

// --------------------------------------------------
// Text sprite with multiline support
// --------------------------------------------------
function createTextSprite(
  text,
  {
    fontSize = 72,
    fontFamily = "Arial",
    fontWeight = "700",
    color = "#f57c00",
    paddingX = 24,
    paddingY = 18,
    lineGap = 0.18,
    opacity = 1,
    scaleX = 1.2,
    scaleY = 0.28,
  } = {}
) {
  const lines = String(text).split("\n");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }

  const lineHeight = Math.ceil(fontSize * (1 + lineGap));
  const width = Math.ceil(maxWidth + paddingX * 2);
  const height = Math.ceil(lineHeight * lines.length + paddingY * 2);

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;

  const totalTextHeight = lineHeight * lines.length;
  const startY = height / 2 - totalTextHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 20;

  return sprite;
}

// --------------------------------------------------
// Curved evaporation arrow
// --------------------------------------------------
function createEvapArrow({
  height = 0.9,
  radius = 0.026,
  color = 0xf0ab2a,
  opacity = 0.78,
  swayX = 0.12,
  swayZ = 0.04,
} = {}) {
  const group = new THREE.Group();

  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(swayX * 0.15, height * 0.22, swayZ * 0.10),
    new THREE.Vector3(-swayX * 0.06, height * 0.48, swayZ * 0.22),
    new THREE.Vector3(swayX * 0.20, height * 0.74, -swayZ * 0.04),
    new THREE.Vector3(swayX, height, 0),
  ];

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeometry = new THREE.TubeGeometry(curve, 44, radius, 12, false);

  const tubeMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });

  const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
  group.add(tube);

  const headHeight = Math.max(height * 0.14, radius * 6.2);
  const headRadius = radius * 3.3;

  const headGeometry = new THREE.ConeGeometry(headRadius, headHeight, 16);
  const headMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(opacity + 0.05, 1),
    depthWrite: false,
  });

  const head = new THREE.Mesh(headGeometry, headMaterial);

  const tangent = curve.getTangent(0.999).normalize();
  const tip = curve.getPoint(1);

  head.position.copy(tip.clone().add(tangent.clone().multiplyScalar(headHeight * 0.35)));
  head.quaternion.setFromUnitVectors(UP, tangent);

  group.add(head);

  group.userData = {
    tubeMaterial,
    headMaterial,
    baseX: 0,
    baseY: 0,
    baseZ: 0,
    phase: Math.random() * Math.PI * 2,
  };

  return group;
}

// --------------------------------------------------
// Evaporation system
// --------------------------------------------------
export function createEvaporationSystem(bounds) {
  const group = new THREE.Group();
  const animatedItems = [];
  const labelItems = [];

  const size = bounds.getSize(new THREE.Vector3());

  // Infer the actual terrain footprint by ignoring the floating weather objects
  // that extend the full bounds.
  const terrain = {
    minX: bounds.min.x + size.x * 0.18,
    maxX: bounds.max.x - size.x * 0.08,
    minZ: bounds.min.z + size.z * 0.16,
    maxZ: bounds.max.z - size.z * 0.08,
    surfaceY: bounds.min.y + size.y * 0.10,
  };

  const footprintX = terrain.maxX - terrain.minX;
  const footprintZ = terrain.maxZ - terrain.minZ;
  const rise = size.y * 0.24;

  const tx = (u) => THREE.MathUtils.lerp(terrain.minX, terrain.maxX, u);
  const tz = (v) => THREE.MathUtils.lerp(terrain.minZ, terrain.maxZ, v);

  const arrowRadius = Math.max(footprintX, footprintZ) * 0.0075;
  const smallLabelScaleX = Math.max(footprintX * 0.16, 0.55);
  const smallLabelScaleY = smallLabelScaleX * 0.22;

  // Better tuned positions: spread mostly over the right/usable half of the terrain
  const defs = [
    {
      label: "FROM VEGETATION",
      u: 0.18,
      v: 0.28,
      h: rise * 1.00,
      swayX: footprintX * 0.05,
      swayZ: footprintZ * 0.010,
      rotY: -0.08,
      labelDx: -footprintX * 0.02,
      labelDy: rise * 0.30,
      labelDz: -footprintZ * 0.02,
      labelScaleX: smallLabelScaleX,
    },
    {
      label: "FROM SOIL",
      u: 0.34,
      v: 0.50,
      h: rise * 0.86,
      swayX: footprintX * 0.05,
      swayZ: footprintZ * 0.010,
      rotY: -0.03,
      labelDx: -footprintX * 0.01,
      labelDy: rise * 0.22,
      labelDz: 0,
      labelScaleX: smallLabelScaleX * 0.92,
    },
    {
      label: "FROM STREAMS",
      u: 0.53,
      v: 0.42,
      h: rise * 1.00,
      swayX: footprintX * 0.055,
      swayZ: footprintZ * 0.012,
      rotY: 0.02,
      labelDx: footprintX * 0.01,
      labelDy: rise * 0.24,
      labelDz: 0,
      labelScaleX: smallLabelScaleX,
    },
    {
      label: "FROM LAKES\nAND\nSTORAGES",
      u: 0.68,
      v: 0.44,
      h: rise * 1.06,
      swayX: footprintX * 0.060,
      swayZ: footprintZ * 0.012,
      rotY: 0.05,
      labelDx: footprintX * 0.02,
      labelDy: rise * 0.19,
      labelDz: 0,
      labelScaleX: smallLabelScaleX * 0.88,
    },
    {
      label: "FROM FIELDS",
      u: 0.90,
      v: 0.70,
      h: rise * 0.94,
      swayX: footprintX * 0.050,
      swayZ: footprintZ * 0.010,
      rotY: 0.10,
      labelDx: footprintX * 0.01,
      labelDy: rise * 0.18,
      labelDz: 0,
      labelScaleX: smallLabelScaleX * 0.96,
    },
  ];

  defs.forEach((def) => {
    const x = tx(def.u);
    const z = tz(def.v);
    const baseY = terrain.surfaceY;

    const arrow = createEvapArrow({
      height: def.h,
      radius: arrowRadius,
      swayX: def.swayX,
      swayZ: def.swayZ,
      color: 0xecab35,
      opacity: 0.78,
    });

    arrow.position.set(x, baseY, z);
    arrow.rotation.y = def.rotY;

    arrow.userData.baseX = x;
    arrow.userData.baseY = baseY;
    arrow.userData.baseZ = z;

    group.add(arrow);
    animatedItems.push(arrow);

    const label = createTextSprite(def.label, {
      fontSize: 52,
      color: "#f26d21",
      scaleX: def.labelScaleX,
      scaleY: smallLabelScaleY,
      opacity: 1,
    });

    label.position.set(
      x + def.labelDx,
      baseY + def.labelDy,
      z + def.labelDz
    );

    label.userData.baseY = label.position.y;
    group.add(label);
    labelItems.push(label);
  });

  const title = createTextSprite("EVAPORATION", {
    fontSize: 82,
    color: "#f26722",
    scaleX: Math.max(footprintX * 0.34, 1.1),
    scaleY: Math.max(footprintX * 0.062, 0.25),
    opacity: 1,
  });

  title.position.set(
    tx(0.63),
    terrain.surfaceY + rise * 1.55,
    tz(0.16)
  );
  title.userData.baseY = title.position.y;
  group.add(title);

  return {
    group,
    update(time) {
      animatedItems.forEach((item, i) => {
        const phase = item.userData.phase + i * 0.35;

        item.position.y = item.userData.baseY + Math.sin(time * 1.45 + phase) * rise * 0.035;
        item.position.x = item.userData.baseX + Math.sin(time * 0.8 + phase) * footprintX * 0.002;
        item.position.z = item.userData.baseZ + Math.cos(time * 0.7 + phase) * footprintZ * 0.0015;

        item.userData.tubeMaterial.opacity = 0.70 + 0.08 * Math.sin(time * 2.0 + phase);
        item.userData.headMaterial.opacity = 0.78 + 0.08 * Math.sin(time * 2.0 + phase + 0.35);
      });

      labelItems.forEach((label, i) => {
        label.position.y = label.userData.baseY + Math.sin(time * 1.15 + i * 0.45) * rise * 0.012;
      });

      title.position.y = title.userData.baseY + Math.sin(time * 1.0) * rise * 0.010;
    },
  };
}