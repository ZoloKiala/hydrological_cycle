// WASA on a real landscape — CesiumJS 3D globe.
//
// Replaces the earlier Google Maps version. Same eight WASA interventions and
// the same fictional Mwankhokwe pilot watershed in southern Malawi, rendered
// on a true 3D globe so terrain elevation, tilt, and rotation are real.
//
// Token: a Cesium Ion access token unlocks Cesium World Terrain (real hills)
// and Bing Aerial imagery. Without it the scene still works — we fall back to
// Esri World Imagery on a flat ellipsoid. Pass it via the URL:
//   wasa-map.html?token=eyJhbGciOi...

// ---------- DUMMY LOCATION ----------
const CENTRE = { lat: -15.7000, lng: 35.0050 };

const WATERSHED = [
  [-15.6885, 34.9920],
  [-15.6900, 35.0210],
  [-15.7080, 35.0280],
  [-15.7180, 35.0100],
  [-15.7060, 34.9900],
];

const RIVER = [
  [-15.6920, 35.0000],
  [-15.6970, 35.0060],
  [-15.7010, 35.0095],
  [-15.7050, 35.0120],
  [-15.7110, 35.0140],
  [-15.7170, 35.0125],
];

// ---------- WASA INTERVENTIONS ----------
// `range` (metres above ground) and `pitch` (degrees, negative = look down)
// are tuned for Cesium's flyToBoundingSphere / lookAt style flight.
const interventions = [
  {
    icon: 'A',
    title: 'Afforestation & Agroforestry',
    text:
      'Replants tree cover on cleared mountain slopes, pumping moisture back into the atmosphere ' +
      'through transpiration and anchoring topsoil. Agroforestry rows mix trees with food crops.',
    impact: 'Recovers transpiration, recharges groundwater, anchors soil',
    pos: [-15.6945, 34.9970],
    range: 600, heading: 60, pitch: -35,
  },
  {
    icon: 'B',
    title: 'Conservation Agriculture',
    text:
      'Minimum tillage, mulching, and cover crops keep soils porous and shaded. Rainfall infiltrates ' +
      'instead of running off; organic matter triples soil water-holding capacity.',
    impact: 'Higher infiltration, lower evaporation loss',
    pos: [-15.6995, 35.0035],
    range: 400, heading: 20, pitch: -40,
  },
  {
    icon: 'C',
    title: 'Tied Ridges & Soil Ripping',
    text:
      'Small earthen cross-ridges trap rainfall where it falls; soil rippers break compacted layers ' +
      'so water moves into the root zone. Crops survive erratic-rainfall seasons.',
    impact: 'In-situ rainwater capture, deeper percolation',
    pos: [-15.7012, 35.0080],
    range: 400, heading: 340, pitch: -40,
  },
  {
    icon: 'D',
    title: 'Erosion Control & Riparian Buffers',
    text:
      'Contour bunds, mulch strips, and grass tufts hold rainfall on the slope above the gully. ' +
      'Riparian buffers along the river trap sediment before it reaches downstream water bodies.',
    impact: 'Protected topsoil, reduced sediment in rivers',
    pos: [-15.7060, 35.0110],
    range: 500, heading: 110, pitch: -35,
  },
  {
    icon: 'E',
    title: 'Rainwater Harvesting & Farm Ponds',
    text:
      'Two linked farm ponds store wet-season runoff for dry-season use. Inflow from the stream, ' +
      'outflow tied to terraced fields. The system recharges shallow groundwater and supports life year-round.',
    impact: 'Year-round water access, groundwater recharge',
    pos: [-15.7035, 35.0150],
    range: 400, heading: 0, pitch: -45,
  },
  {
    icon: 'F',
    title: 'Green Infrastructure',
    text:
      'Restored wetlands and small check dams flatten flood peaks and extend dry-season base flow. ' +
      'The watershed acts like a sponge instead of a fast pipe to the river.',
    impact: 'Lower flood peaks, longer base flow',
    pos: [-15.7130, 35.0145],
    range: 500, heading: 70, pitch: -35,
  },
  {
    icon: 'G',
    title: 'Community Watershed Governance',
    text:
      'A local watershed committee — convened in the village near the outlet — decides where ponds and ' +
      'forest patches go, enforces grazing rules, and maintains the interventions between seasons.',
    impact: 'Durable, locally-owned landscape stewardship',
    pos: [-15.7000, 35.0050],
    range: 1800, heading: 0, pitch: -55,
  },
  {
    icon: 'H',
    title: 'Climate Information Services',
    text:
      'Seasonal forecasts and on-time advisories are broadcast from the school on the ridge. ' +
      'Farmers plant, irrigate, and harvest at the right moment — more crop per millimetre of rain.',
    impact: 'More crop per drop, fewer failed seasons',
    pos: [-15.6920, 35.0190],
    range: 600, heading: 200, pitch: -35,
  },
];

// ---------- INIT ----------
// IIFE so we can use await for the async imagery / terrain providers Cesium
// has switched to in recent releases.
(async function init() {
  const qs = new URLSearchParams(location.search);
  const token = qs.get('token') || '';

  if (token) {
    Cesium.Ion.defaultAccessToken = token;
  } else {
    document.getElementById('token-notice').style.display = 'block';
  }

  // --- Imagery: Esri World Imagery is free and needs no token. The URL
  // template uses standard web-mercator XYZ tiling — same scheme as Google
  // and OSM — so Cesium's UrlTemplateImageryProvider drives it directly.
  // Esri World_Imagery has very high-res tiles in urban areas (up to z=23)
  // but rural southern Malawi caps around z=16-17. Going higher returns a
  // beige "Map data not yet available" placeholder. Capping at 17 makes
  // Cesium reuse the best available tile when you zoom closer instead of
  // requesting tiles that don't exist.
  const esriImagery = new Cesium.UrlTemplateImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: new Cesium.Credit('Esri, Maxar, Earthstar Geographics, GIS User Community'),
    maximumLevel: 17,
  });

  // --- Terrain: real elevation if we have a token, otherwise flat ellipsoid.
  let terrainProvider;
  if (token) {
    try {
      terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
    } catch (e) {
      console.warn('[cesium] Failed to load Cesium World Terrain; falling back to ellipsoid', e);
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
  } else {
    terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  // Cesium 1.107+ removed the `imageryProvider` constructor option. We have
  // to build the viewer with imagery DISABLED, then attach the layer after —
  // otherwise Cesium uses its default Ion-backed imagery, which without a
  // token renders a blank blue ellipsoid.
  const viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayer: false,
    terrainProvider,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    infoBox: true,
    selectionIndicator: true,
  });
  viewer.imageryLayers.addImageryProvider(esriImagery);

  // Hide the default Cesium logo (still keep the data attribution in the
  // bottom credit container, which is required by Esri and Cesium's TOS).
  viewer.cesiumWidget.creditContainer.style.display = '';
  // Tone the scene a touch — globe atmosphere lighting on, sun off, fog on.
  viewer.scene.globe.enableLighting = false;
  viewer.scene.fog.enabled = true;
  viewer.scene.skyAtmosphere.show = true;

  // ---------- WATERSHED BOUNDARY ----------
  viewer.entities.add({
    name: 'Mwankhokwe pilot watershed (fictional)',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray(
          // PolygonHierarchy expects [lng, lat, lng, lat, ...]
          WATERSHED.flatMap(([lat, lng]) => [lng, lat])
        )
      ),
      material: Cesium.Color.fromCssColorString('#ffd54f').withAlpha(0.12),
      outline: false,         // outlines on filled polygons render unreliably; use polyline below
      classificationType: Cesium.ClassificationType.TERRAIN,
    },
  });
  // Dashed-yellow outline drawn separately for crispness.
  const ringPositions = WATERSHED.concat([WATERSHED[0]]).flatMap(([lat, lng]) => [lng, lat]);
  viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray(ringPositions),
      width: 2,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#ffd54f'),
        dashLength: 16,
      }),
      clampToGround: true,
    },
  });

  // ---------- RIVER POLYLINE ----------
  viewer.entities.add({
    name: 'Watershed outlet (stream)',
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray(
        RIVER.flatMap(([lat, lng]) => [lng, lat])
      ),
      width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.25,
        color: Cesium.Color.fromCssColorString('#4fc3f7'),
      }),
      clampToGround: true,
    },
  });

  // ---------- INTERVENTION MARKERS ----------
  const entityById = new Map();
  interventions.forEach((iv, idx) => {
    const [lat, lng] = iv.pos;
    const entity = viewer.entities.add({
      id: 'wasa-' + idx,
      name: iv.icon + ' · ' + iv.title,
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      point: {
        pixelSize: 26,
        color: Cesium.Color.fromCssColorString('#ffd54f'),
        outlineColor: Cesium.Color.fromCssColorString('#0a1820'),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: iv.icon,
        font: 'bold 14px "Segoe UI", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#0a1820'),
        style: Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description:
        '<div style="font-family:Segoe UI,sans-serif;font-size:13px;line-height:1.5">' +
          '<p>' + escapeHtml(iv.text) + '</p>' +
          '<p style="color:#ffd54f;font-weight:600">Water cycle: ' + escapeHtml(iv.impact) + '</p>' +
        '</div>',
    });
    entityById.set(idx, entity);
  });

  // ---------- INITIAL CAMERA ----------
  // Wide overview tilted toward the north, looking down at the watershed.
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(CENTRE.lng, CENTRE.lat - 0.015, 4500),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-55),
      roll: 0,
    },
    duration: 0,
  });

  // ---------- FLY-TO BUTTON LOGIC ----------
  function focusIntervention(idx) {
    const iv = interventions[idx];
    const [lat, lng] = iv.pos;
    const target = Cesium.Cartesian3.fromDegrees(lng, lat);

    // Cesium's flyToBoundingSphere gives nice cinematic easing and respects
    // heading/pitch/range. We build a zero-radius sphere at the target so
    // `range` controls the literal stand-off distance.
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, 0), {
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(iv.heading),
        Cesium.Math.toRadians(iv.pitch),
        iv.range
      ),
      duration: 1.6,
      complete: () => {
        viewer.selectedEntity = entityById.get(idx);
      },
    });
  }

  // Expose for the cards builder; also used by the marker click below.
  window.__focusIntervention = focusIntervention;

  // Marker clicks: Cesium's default selection already opens the info box on
  // click, so we just additionally fly the camera in.
  viewer.screenSpaceEventHandler.setInputAction((event) => {
    const picked = viewer.scene.pick(event.position);
    if (Cesium.defined(picked) && picked.id && typeof picked.id.id === 'string'
        && picked.id.id.startsWith('wasa-')) {
      const idx = parseInt(picked.id.id.slice(5), 10);
      if (!isNaN(idx)) focusIntervention(idx);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  buildCards();
})();

// ---------- SIDE PANEL ----------
function buildCards() {
  const container = document.getElementById('map-cards');
  const frag = document.createDocumentFragment();
  interventions.forEach((iv, idx) => {
    const card = document.createElement('div');
    card.className = 'map-card';

    const head = document.createElement('div');
    head.className = 'map-card-head';
    const ic = document.createElement('span');
    ic.className = 'map-icon';
    ic.textContent = iv.icon;
    const h = document.createElement('h3');
    h.textContent = iv.title;
    head.append(ic, h);

    const desc = document.createElement('p');
    desc.textContent = iv.text;

    const impact = document.createElement('div');
    impact.className = 'map-impact';
    impact.textContent = 'Water cycle: ' + iv.impact;

    const btn = document.createElement('button');
    btn.className = 'map-focus-btn';
    btn.type = 'button';
    btn.textContent = 'Fly to site';
    btn.addEventListener('click', () => {
      if (window.__focusIntervention) window.__focusIntervention(idx);
    });

    card.append(head, desc, impact, btn);
    frag.appendChild(card);
  });
  container.replaceChildren(frag);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
