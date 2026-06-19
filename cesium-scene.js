// WASA on a real landscape — CesiumJS 3D globe.
//
// Plots the real WASA Intervention Inventory submissions (KoBoToolbox) on a
// true 3D globe across southern Malawi, so terrain elevation, tilt, and
// rotation are real. Each marker is one field-recorded intervention/activity.
//
// Token: a Cesium Ion access token unlocks Cesium World Terrain (real hills)
// and Bing Aerial imagery. Without it the scene still works — we fall back to
// Esri World Imagery on a flat ellipsoid. Pass it via the URL:
//   wasa-map.html?token=eyJhbGciOi...

// ---------- WASA INTERVENTION INVENTORY (real field data) ----------
// Real submissions from the KoBoToolbox "WASA Intervention Inventory" form
// (export: all versions, en, 2026-06-11). Each record is a WASA intervention
// or activity an enumerator visited across southern Malawi, with a GPS point,
// a field description, and geotagged photos.
//
// The original photos are gated behind KoBo authentication, so they were
// downloaded once, auto-rotated (EXIF), downscaled, and bundled under
// ./photos/ — that way they display in the cards / info-boxes with no login.
// `image` (the card thumbnail) is derived from the first photo just below the
// array. Descriptions and comments are kept VERBATIM as submitted.
//
// Per-record fields:
//   icon       single-letter category badge (A/B/D/F, or O for "Other")
//   category   broad WASA intervention category
//   title      specific activity / sub-category recorded in the field
//   text       enumerator's description (verbatim)
//   enumerator who submitted the record
//   comments   additional comments (may be empty)
//   photos     bundled local photo paths
//   pos        [lat, lng] GPS point captured on site
//   range/heading/pitch  camera framing for the fly-to / walk-mode
const interventions = [
  {
    icon: 'D',
    category: 'Erosion Control & Riparian Buffers',
    title: 'Check dam and vetiver grass planting',
    text:
      `Communities were mobilised to conduct gully reclamation through the construction of check dams and planting vetiver grass. The initiative is aimed at controlling run off water coming down from Chingozi mountain which erodes fertile top soil, causes mudslides, destroys people's houses. Communities surrounding Chingozi have constructed 397 check dams using stones covering up to 11.5 hectares of land. The check dams are constructed in gullies that are in the mountain. There are 20 gullies on which check dams have been constructed with the shortest gully having 7 check dams and the longest has 42 check dams`,
    enumerator: 'Alinafe Mbiri',
    comments: 'Local leaders have continued mobilising the people to continue working and they meet once a week for the work',
    photos: ['photos/site01-1.jpg', 'photos/site01-2.jpg', 'photos/site01-3.jpg'],
    pos: [-16.098779, 35.577965],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'B',
    category: 'Conservation Agriculture',
    title: 'Manure making and application',
    text:
      `Three types of manure promoted in the village. Materials required to make organic manure include ash, maize stoves, virgin soil, watered at intervals amd livestock manure. Targeting to make 2,000 heaps reaching out to 250 households.`,
    enumerator: 'David Munthali',
    comments: 'Farmer 1 is targetting to make 13 heaps and so far made 4 heaps.  Each farmer targets to make between 4 to 20 and the mani challenge is access to livestock manure',
    photos: ['photos/site02-1.jpg', 'photos/site02-2.jpg', 'photos/site02-3.jpg', 'photos/site02-4.jpg'],
    pos: [-16.101347, 35.577653],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'B',
    category: 'Conservation Agriculture',
    title: 'Mulching and intercropping maize and beans',
    text:
      `A demo plot where maize is intercropped with bean and mulched in an irrigation scheme. The has 165 farmers covering 18 hectares. Main crops include maize, tomato, beans and vegetables`,
    enumerator: 'David Munthali',
    comments: 'A total of 165 farmers where 101 are f3male and 10 are youth farmers and 3 PWDs',
    photos: ['photos/site03-1.jpg', 'photos/site03-2.jpg', 'photos/site03-3.jpg', 'photos/site03-4.jpg', 'photos/site03-5.jpg'],
    pos: [-16.049778, 35.779790],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'A',
    category: 'Afforestation & Agroforestry',
    title: 'Soil fertility tree',
    text:
      `A total of 625 trees planted in with each farmer planting 5 trees. with 90% survival. The types of trees include Glycidia, Acadia,`,
    enumerator: 'Elinat Mtupanyama',
    comments: '',
    photos: ['photos/site04-1.jpg', 'photos/site04-2.jpg', 'photos/site04-3.jpg', 'photos/site04-4.jpg'],
    pos: [-16.101005, 35.578165],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'F',
    category: 'Green Infrastructure',
    title: 'tied riggin',
    text:
      `WInter croppibg`,
    enumerator: 'Elinat Mtupanyana',
    comments: '',
    photos: ['photos/site05-1.jpg', 'photos/site05-2.jpg', 'photos/site05-3.jpg'],
    pos: [-16.049048, 35.779828],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'O',
    category: 'Other activity',
    title: 'Technical support visit',
    text:
      `Visiting kambenje honey producer group. The group has 22 members with 10 male and 12 females no youth`,
    enumerator: 'Ekinat Mtuoanyama',
    comments: '',
    photos: ['photos/site06-1.jpg', 'photos/site06-2.jpg', 'photos/site06-3.jpg'],
    pos: [-15.901048, 35.492097],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'B',
    category: 'Conservation Agriculture',
    title: 'Winter season intercopping',
    text:
      `This is a demonstration plot for inter-cropping. Have planted maize and common beans. The beans aim to add nutrients to the soil. The plot is 30 m by 15 m. 300 farmers are learning from this plot.  The maize was planted on 15th May, 2026 and the beans on 29th May, 2026.`,
    enumerator: 'Mwanjiwa Lipenga',
    comments: 'The demonstration plot is benefitting a large number of farmers (300) who have shown interest to implement  in their respective groups',
    photos: ['photos/site07-1.jpg', 'photos/site07-2.jpg', 'photos/site07-3.jpg', 'photos/site07-4.jpg', 'photos/site07-5.jpg'],
    pos: [-15.839959, 34.831323],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'D',
    category: 'Erosion Control & Riparian Buffers',
    title: 'Tree cover replenishment across slope',
    text:
      `Firebreak maintenance, tree planting 904 in total. Tree species include cacia, and mtangatanga`,
    enumerator: 'Baxton Chirombo',
    comments: '',
    photos: ['photos/site08-1.jpg', 'photos/site08-2.jpg', 'photos/site08-3.jpg', 'photos/site08-4.jpg'],
    pos: [-15.836699, 34.820396],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'D',
    category: 'Erosion Control & Riparian Buffers',
    title: 'Check dam and soil ripping',
    text:
      `Banana planting for river bank protection and check dams for land reclamation`,
    enumerator: 'Baxton Chirombo',
    comments: '',
    photos: ['photos/site09-1.jpg', 'photos/site09-2.jpg', 'photos/site09-3.jpg', 'photos/site09-4.jpg', 'photos/site09-5.jpg'],
    pos: [-15.836819, 34.819956],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'B',
    category: 'Conservation Agriculture',
    title: 'Live fencing with green manure',
    text:
      `Live fencing with Gliricidia seedlings on a horticultural field measuring. 1.25 acres Being done under drip irrigation. The gliricidia was planted on 27 th April, 2026. The field is being managed by 16 people (1 male and 15 females). The field is a learning/ demonstration plot where 653 farmers learn from it  Farmers who learn from it has shown interest to plant the gliriciidia in their farms.`,
    enumerator: 'Mwanjiwa Lipenga',
    comments: "This intervention will help add nutrients to the soil according to Mr Malinga the group's farmer support agent (FSA).",
    photos: ['photos/site10-1.jpg', 'photos/site10-2.jpg', 'photos/site10-3.jpg', 'photos/site10-4.jpg', 'photos/site10-5.jpg'],
    pos: [-16.438795, 34.835082],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'O',
    category: 'Other activity',
    title: 'ADC Sensitization Meeting',
    text:
      `Making an awareness of the Water and Soil Accelerator Prooject to local leaders.50 members participated 16 women and 36`,
    enumerator: 'Elinat Mtuoanyama',
    comments: '',
    photos: ['photos/site11-1.jpg', 'photos/site11-2.jpg', 'photos/site11-3.jpg'],
    pos: [-15.886059, 35.482130],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'D',
    category: 'Erosion Control & Riparian Buffers',
    title: 'VDC Meeting (Gvh Nogwe)',
    text:
      `Village sensitization meeting at Gvh Nogwe 1541 attended 1123 females and 418 men`,
    enumerator: 'Elinat Ntuoabyana',
    comments: '',
    photos: ['photos/site12-1.jpg', 'photos/site12-2.jpg', 'photos/site12-3.jpg'],
    pos: [-15.854512, 35.559447],
    range: 500, heading: 0, pitch: -40,
  },
  {
    icon: 'O',
    category: 'Other activity',
    title: 'VDC Meeting (GVH Kambenje)',
    text:
      `Making an awareness on water and soil accelerator project at GVH KAmbenje in TA NKanda`,
    enumerator: 'Elinat Mtupanyama',
    comments: 'Meeting successfully done',
    photos: ['photos/site13-1.jpg', 'photos/site13-2.jpg', 'photos/site13-3.jpg', 'photos/site13-4.jpg', 'photos/site13-5.jpg'],
    pos: [-15.854498, 35.559437],
    range: 500, heading: 0, pitch: -40,
  },
];

// `image` (used by the Street-View static photo fallback) is simply the first
// bundled photo for each record.
interventions.forEach((iv) => { iv.image = iv.photos[0]; });

// ---------- WASA SOLUTIONS (side-panel cards) ----------
// The panel is the WASA "solutions" explainer (as before): one card per
// intervention category, describing what it does and how it improves the water
// cycle. The real field submissions live on the MAP (the markers), not here —
// each solution card's buttons fly/walk/Street-View to the recorded sites of
// that category. Names/order follow the KoBo form's `choices` sheet.
//
// Declared ABOVE the init() IIFE deliberately: with no Cesium ?token, init()
// runs synchronously to its end and calls buildCards() before any const
// declared *after* the IIFE would be initialised — so these must exist first.
const afforestationImage = new URL('./afforestation.jpg', import.meta.url).href;

const SOLUTIONS = [
  {
    letter: 'A', name: 'Afforestation & Agroforestry',
    text: 'Replants tree cover on cleared mountain slopes, pumping moisture back into the atmosphere ' +
      'through transpiration and anchoring topsoil. Agroforestry rows mix trees with food crops.',
    impact: 'Recovers transpiration, recharges groundwater, anchors soil',
    image: afforestationImage,
  },
  {
    letter: 'B', name: 'Conservation Agriculture',
    text: 'Minimum tillage, mulching, and cover crops keep soils porous and shaded. Rainfall infiltrates ' +
      'instead of running off; organic matter triples soil water-holding capacity.',
    impact: 'Higher infiltration, lower evaporation loss',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Agricultural%20activities%20as%20part%20of%20environmental%20conservation%20as%20seen%20in%20Dar%20es%20Salaam%2C%20Tanzania%20IZZD8108.jpg?width=640',
  },
  {
    letter: 'C', name: 'Tied Ridges & Soil Ripping',
    text: 'Small earthen cross-ridges trap rainfall where it falls; soil rippers break compacted layers ' +
      'so water moves into the root zone. Crops survive erratic-rainfall seasons.',
    impact: 'In-situ rainwater capture, deeper percolation',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Contour%20Farming01%20(23972931847).jpg?width=640',
  },
  {
    letter: 'D', name: 'Erosion Control & Riparian Buffers',
    text: 'Contour bunds, mulch strips, and grass tufts hold rainfall on the slope above the gully. ' +
      'Riparian buffers along the river trap sediment before it reaches downstream water bodies.',
    impact: 'Protected topsoil, reduced sediment in rivers',
    image: 'https://loremflickr.com/640/240/erosion,gully,soil/all?lock=4',
  },
  {
    letter: 'E', name: 'Rainwater Harvesting & Farm Ponds',
    text: 'Linked farm ponds store wet-season runoff for dry-season use. Inflow from the stream, ' +
      'outflow tied to terraced fields. The system recharges shallow groundwater and supports life year-round.',
    impact: 'Year-round water access, groundwater recharge',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rainwater%20Harvesting%20and%20Plastic%20Pond%202.JPG?width=640',
  },
  {
    letter: 'F', name: 'Green Infrastructure',
    text: 'Restored wetlands and small check dams flatten flood peaks and extend dry-season base flow. ' +
      'The landscape acts like a sponge instead of a fast pipe to the river.',
    impact: 'Lower flood peaks, longer base flow',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Check%20dam%20in%20May%20Be%27ati.jpg?width=640',
  },
  {
    letter: 'G', name: 'Community Watershed Governance',
    text: 'A local watershed committee decides where ponds and forest patches go, enforces grazing rules, ' +
      'and maintains the interventions between seasons.',
    impact: 'Durable, locally-owned landscape stewardship',
    image: 'https://loremflickr.com/640/240/village,community,africa/all?lock=7',
  },
  {
    letter: 'H', name: 'Climate Information Services',
    text: 'Seasonal forecasts and on-time advisories reach farmers so they plant, irrigate, and harvest at ' +
      'the right moment — more crop per millimetre of rain.',
    impact: 'More crop per drop, fewer failed seasons',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Agrometeorologia%20Epagri%20Ciram.jpg?width=640',
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

  // Esri "World Boundaries and Places" — transparent reference layer with
  // country / admin borders, populated-place labels, and major roads. Stacks
  // on top of the satellite imagery so the user sees place names too.
  const esriLabels = new Cesium.UrlTemplateImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    credit: new Cesium.Credit('Esri labels'),
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
  // Save the labels layer in a closure-accessible var so the toggle button
  // can show/hide it without losing its position in the layer stack.
  const labelsLayer = viewer.imageryLayers.addImageryProvider(esriLabels);
  labelsLayer.alpha = 0.95;

  // Hide the default Cesium logo (still keep the data attribution in the
  // bottom credit container, which is required by Esri and Cesium's TOS).
  viewer.cesiumWidget.creditContainer.style.display = '';
  // Tone the scene a touch — globe atmosphere lighting on, sun off, fog on.
  viewer.scene.globe.enableLighting = false;
  viewer.scene.fog.enabled = true;
  viewer.scene.skyAtmosphere.show = true;

  // The fictional watershed polygon and river polyline were removed: the real
  // inventory points span a large region of southern Malawi, so a single small
  // demo catchment no longer applies.

  // ---------- INTERVENTION MARKERS ----------
  const entityById = new Map();
  interventions.forEach((iv, idx) => {
    const [lat, lng] = iv.pos;
    const entity = viewer.entities.add({
      id: 'wasa-' + idx,
      name: iv.icon + ' · ' + iv.category,
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
        font: 'bold 18px "Segoe UI", Arial, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#0a1820'),
        style: Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description: buildDescription(iv),
    });
    entityById.set(idx, entity);
  });

  // Marker styling for the "selected" state. When a solution category with
  // several recorded sites is focused, every one of its markers is enlarged and
  // ringed in cyan so all the locations stand out at once (Cesium's built-in
  // selection only holds one entity, so we restyle the points ourselves).
  const MARKER_NORMAL = {
    pixelSize: 26,
    outlineColor: Cesium.Color.fromCssColorString('#0a1820'),
    outlineWidth: 2,
  };
  const MARKER_SELECTED = {
    pixelSize: 36,
    outlineColor: Cesium.Color.fromCssColorString('#4fc3f7'),
    outlineWidth: 4,
  };
  function highlightSites(idxSet) {
    entityById.forEach((entity, i) => {
      const s = idxSet && idxSet.has(i) ? MARKER_SELECTED : MARKER_NORMAL;
      entity.point.pixelSize = s.pixelSize;
      entity.point.outlineColor = s.outlineColor;
      entity.point.outlineWidth = s.outlineWidth;
    });
  }

  // ---------- SCALE BAR + NORTH ARROW + SEARCH + COORDS ----------
  // Cam-controls removed (Cesium's native input covers pan/tilt/zoom).
  // The north arrow remains as a lightweight orientation cue.
  setupScaleBar(viewer);
  setupNorthArrow(viewer);
  setupLocationSearch(viewer);
  setupCursorCoordinates(viewer);
  setupPhotoLightbox(viewer);

  // ---------- INITIAL CAMERA ----------
  // Frame ALL intervention sites: compute the bounding sphere of every real
  // GPS point and fly the camera to a standoff that keeps them all in view,
  // tilted ~50° downward for an oblique perspective. Reused on walk-mode exit.
  const sitePositions = interventions.map((iv) =>
    Cesium.Cartesian3.fromDegrees(iv.pos[1], iv.pos[0])
  );
  const sitesSphere = Cesium.BoundingSphere.fromPoints(sitePositions);
  viewer.camera.flyToBoundingSphere(sitesSphere, {
    duration: 0,
    offset: new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(-50),
      sitesSphere.radius * 2.2
    ),
  });

  // ---------- FLY-TO BUTTON LOGIC ----------
  function focusIntervention(idx) {
    const iv = interventions[idx];
    const [lat, lng] = iv.pos;
    const target = Cesium.Cartesian3.fromDegrees(lng, lat);

    // Single site: drop any multi-site group highlight and use Cesium's normal
    // one-entity selection (selection indicator + info box).
    highlightSites(null);

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

  // Focus every recorded site of one WASA solution category (the marker letter).
  // A solution panel card's "Fly to site(s)" button uses this: a single site
  // flies in and is selected like a marker click; when there are several, ALL
  // of that category's markers are highlighted and framed together. No-op if a
  // category has no submissions yet.
  function focusCategory(letter) {
    const idxs = [];
    interventions.forEach((iv, i) => { if (iv.icon === letter) idxs.push(i); });
    if (!idxs.length) return;
    if (idxs.length === 1) { focusIntervention(idxs[0]); return; }

    // Highlight all the category's markers. Clear single-entity selection so it
    // doesn't compete with the group highlight / leave a stale info box open.
    highlightSites(new Set(idxs));
    viewer.selectedEntity = undefined;

    const pts = idxs.map((i) =>
      Cesium.Cartesian3.fromDegrees(interventions[i].pos[1], interventions[i].pos[0])
    );
    const sphere = Cesium.BoundingSphere.fromPoints(pts);
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.6,
      offset: new Cesium.HeadingPitchRange(
        0, Cesium.Math.toRadians(-45), Math.max(sphere.radius * 2.5, 1200)
      ),
    });
  }

  // ---------- WALK MODE (first-person) ----------
  // Drops the camera to ~2 m above ground at an intervention site and
  // switches input to FPS-style: drag-to-look + WASD to walk. No real ground
  // photos — just the satellite tile draped on the terrain — but it gives
  // the user a sense of being inside the watershed. Exits on Esc or the
  // Exit button. Re-attaches Cesium's default mouse interactions on exit.
  let walking = false;
  let walkingFromIdx = null;     // which intervention triggered walk mode
  const keysDown = new Set();
  let walkRaf = 0;
  let savedCamControls = null;

  async function enterWalkMode(idx) {
    const iv = interventions[idx];
    const [lat, lng] = iv.pos;
    // If we have real terrain (Ion), sample the ground height so we stand
    // 2 m above the actual surface. With ellipsoid terrain we just use 2 m
    // above the WGS84 ellipsoid — close enough at z = 0.
    let groundH = 0;
    try {
      const samples = await Cesium.sampleTerrainMostDetailed(
        viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lng, lat)]
      );
      if (samples && samples[0] && Number.isFinite(samples[0].height)) {
        groundH = samples[0].height;
      }
    } catch (e) { /* ellipsoid provider throws; fall back to 0 */ }
    // Eye height tuning: at strict 2 m and zoom-17 imagery the grazing angle
    // stretches one tile across the entire horizon (terrible smear). Bumping
    // to 8 m — about a tall hut roof — keeps the "I'm on the ground" feel
    // while drastically reducing pixel stretch.
    const eyeH = groundH + 8;

    walking = true;
    walkingFromIdx = idx;          // remember the origin for exit fly-back
    document.body.classList.add('walk-mode');
    document.getElementById('walk-title-name').textContent = iv.title;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, eyeH),
      orientation: {
        heading: Cesium.Math.toRadians(iv.heading || 0),
        pitch: Cesium.Math.toRadians(-10),          // slight downward, hides stretched horizon
        roll: 0,
      },
      duration: 1.4,
      complete: () => attachFps(),
    });
  }

  function exitWalkMode() {
    if (!walking) return;
    walking = false;
    document.body.classList.remove('walk-mode');
    detachFps();
    // Fly back to the intervention site we walked at (same framing as the
    // "Fly to site" button). If we somehow lost the index, fall back to the
    // all-sites overview.
    const idx = walkingFromIdx;
    walkingFromIdx = null;
    if (idx !== null && interventions[idx]) {
      focusIntervention(idx);
      return;
    }
    viewer.camera.flyToBoundingSphere(sitesSphere, {
      duration: 1.4,
      offset: new Cesium.HeadingPitchRange(
        0, Cesium.Math.toRadians(-50), sitesSphere.radius * 2.2
      ),
    });
  }

  function attachFps() {
    const ssc = viewer.scene.screenSpaceCameraController;
    const scene = viewer.scene;
    // Save and swap mouse-input bindings: instead of "drag-to-rotate-globe"
    // (target-orbit), use "drag-to-look" (free first-person turn). Also clip
    // the far frustum and bump fog density so the stretched-tile horizon
    // fades into atmospheric haze instead of stretching across the screen.
    savedCamControls = {
      enableRotate: ssc.enableRotate,
      enableTranslate: ssc.enableTranslate,
      enableTilt: ssc.enableTilt,
      lookEventTypes: ssc.lookEventTypes,
      fogDensity: scene.fog.density,
      fogEnabled: scene.fog.enabled,
    };
    ssc.enableRotate = false;
    ssc.enableTranslate = false;
    ssc.enableTilt = false;
    ssc.enableLook = true;
    ssc.lookEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
    ssc.minimumZoomDistance = 0.5;

    // Heavy fog fades the stretched-tile horizon into atmospheric haze. We
    // deliberately do NOT clip the far frustum — Cesium's sky atmosphere is
    // rendered as a sphere far past the surface, so any low far-clip value
    // also clips the sky and leaves the upper half of the screen black.
    scene.fog.enabled = true;
    scene.fog.density = 0.004;

    window.addEventListener('keydown', onWalkKeyDown);
    window.addEventListener('keyup', onWalkKeyUp);
    walkRaf = requestAnimationFrame(walkLoop);
  }

  function detachFps() {
    const ssc = viewer.scene.screenSpaceCameraController;
    const scene = viewer.scene;
    if (savedCamControls) {
      ssc.enableRotate = savedCamControls.enableRotate;
      ssc.enableTranslate = savedCamControls.enableTranslate;
      ssc.enableTilt = savedCamControls.enableTilt;
      ssc.lookEventTypes = savedCamControls.lookEventTypes;
      scene.fog.density = savedCamControls.fogDensity;
      scene.fog.enabled = savedCamControls.fogEnabled;
      savedCamControls = null;
    }
    window.removeEventListener('keydown', onWalkKeyDown);
    window.removeEventListener('keyup', onWalkKeyUp);
    if (walkRaf) cancelAnimationFrame(walkRaf);
    walkRaf = 0;
    keysDown.clear();
  }

  function onWalkKeyDown(e) {
    if (e.key === 'Escape') { exitWalkMode(); e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    const tracked = ['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright','shift'];
    if (tracked.includes(k)) {
      keysDown.add(k);
      e.preventDefault();
    }
  }
  function onWalkKeyUp(e) {
    keysDown.delete(e.key.toLowerCase());
  }

  function walkLoop() {
    if (!walking) return;
    const cam = viewer.camera;
    // Walk speed: ~1.4 m/s ≈ 0.023 m per frame at 60 Hz. Hold shift to run.
    const run = keysDown.has('shift') ? 3.0 : 1.0;
    const step = 0.03 * run;     // metres per frame
    if (keysDown.has('w') || keysDown.has('arrowup'))    cam.moveForward(step);
    if (keysDown.has('s') || keysDown.has('arrowdown'))  cam.moveBackward(step);
    if (keysDown.has('a') || keysDown.has('arrowleft'))  cam.moveLeft(step);
    if (keysDown.has('d') || keysDown.has('arrowright')) cam.moveRight(step);
    if (keysDown.has('q'))                                cam.moveDown(step * 0.5);
    if (keysDown.has('e'))                                cam.moveUp(step * 0.5);
    walkRaf = requestAnimationFrame(walkLoop);
  }

  document.getElementById('walk-exit-btn').addEventListener('click', exitWalkMode);

  // ---------- MAPILLARY STREET VIEW ----------
  // Real, photographic Street View — the open-source equivalent of Google
  // Street View. We query the Mapillary Graph API for the nearest image to
  // a given intervention site, then mount the Mapillary Viewer inside the
  // #mly-overlay modal. Free tokens at mapillary.com/dashboard/developers
  // (no billing).
  //
  // Token resolution priority:
  //  1. URL param ?mapillary_token=MLY|...  → saved to localStorage and
  //     stripped from the address bar so it doesn't end up in shared links.
  //  2. localStorage key `mapillary_token`  → per-user token sticks across visits.
  //  3. __MAPILLARY_TOKEN__                 → site-wide token baked into the
  //     bundle at build time from the GitHub Actions secret VITE_MAPILLARY_TOKEN.
  //     This is PUBLIC (shipped in the JS) — Mapillary referrer restriction
  //     on the token is what makes it safe to leave on a public site.
  //  4. None                                → user can paste their own via
  //     the "Set token" button in the notice.
  const MLY_TOKEN_KEY = 'mapillary_token';
  const BUILD_TIME_TOKEN = typeof __MAPILLARY_TOKEN__ !== 'undefined' ? __MAPILLARY_TOKEN__ : '';
  let mlyToken = '';
  let usingSiteDefault = false;
  (function loadToken() {
    const urlToken = new URLSearchParams(location.search).get('mapillary_token');
    if (urlToken) {
      try { localStorage.setItem(MLY_TOKEN_KEY, urlToken); } catch (e) { /* private mode etc */ }
      mlyToken = urlToken;
      // Strip the token from the URL bar without reloading the page, so the
      // address you see / copy / share never contains the credential.
      const u = new URL(location.href);
      u.searchParams.delete('mapillary_token');
      history.replaceState(null, '', u.toString());
      return;
    }
    let stored = '';
    try { stored = localStorage.getItem(MLY_TOKEN_KEY) || ''; } catch (e) { /* ignore */ }
    if (stored) { mlyToken = stored; return; }
    if (BUILD_TIME_TOKEN) { mlyToken = BUILD_TIME_TOKEN; usingSiteDefault = true; }
  })();

  function saveMapillaryToken(t) {
    const trimmed = (t || '').trim();
    try {
      if (trimmed) localStorage.setItem(MLY_TOKEN_KEY, trimmed);
      else localStorage.removeItem(MLY_TOKEN_KEY);
    } catch (e) { /* private mode etc */ }
    // After save: if user cleared their token but a site default exists,
    // fall back to that rather than going to "not set".
    if (trimmed) {
      mlyToken = trimmed;
      usingSiteDefault = false;
    } else if (BUILD_TIME_TOKEN) {
      mlyToken = BUILD_TIME_TOKEN;
      usingSiteDefault = true;
    } else {
      mlyToken = '';
      usingSiteDefault = false;
    }
    updateTokenStatusUi();
  }

  function updateTokenStatusUi() {
    const stateEl = document.getElementById('mly-token-state');
    const clearEl = document.getElementById('mly-token-clear');
    if (!stateEl) return;
    let userToken = '';
    try { userToken = localStorage.getItem(MLY_TOKEN_KEY) || ''; } catch (e) { /* ignore */ }
    if (userToken) {
      stateEl.textContent = 'saved (your browser)';
      stateEl.style.color = '#81c784';
      clearEl.style.display = '';
    } else if (BUILD_TIME_TOKEN) {
      stateEl.textContent = 'using site default';
      stateEl.style.color = '#cfe4f1';
      clearEl.style.display = 'none';
    } else {
      stateEl.textContent = 'not set';
      stateEl.style.color = '#9bc7e2';
      clearEl.style.display = 'none';
    }
  }

  function promptForToken() {
    const current = mlyToken || '';
    const t = window.prompt(
      'Paste your Mapillary access token (starts with MLY|).\n\n' +
      'Get a free one at mapillary.com/dashboard/developers — no billing.\n' +
      'The token is saved to this browser only, never sent to git or the URL.',
      current
    );
    if (t === null) return;          // user pressed Cancel
    saveMapillaryToken(t);
    if (mlyToken) {
      document.getElementById('mly-token-notice').style.display = 'none';
    }
  }

  document.getElementById('mly-token-set').addEventListener('click', promptForToken);
  document.getElementById('mly-token-dismiss').addEventListener('click', () => {
    document.getElementById('mly-token-notice').style.display = 'none';
  });
  document.getElementById('mly-token-change').addEventListener('click', (e) => {
    e.preventDefault(); promptForToken();
  });
  document.getElementById('mly-token-clear').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Clear the Mapillary token from this browser?')) saveMapillaryToken('');
  });
  updateTokenStatusUi();
  let mlyViewer = null;
  const mlyOverlay = document.getElementById('mly-overlay');
  const mlyTitle = document.getElementById('mly-title');
  const mlyEmpty = document.getElementById('mly-empty');
  const mlyEmptyMsg = document.getElementById('mly-empty-msg');
  const mlyTokenNotice = document.getElementById('mly-token-notice');

  // When Mapillary has no usable imagery near a site, fall back to the
  // card's topical static photo. Centralised here so both the "no data" and
  // "no token" branches use the same UI path.
  const mlyContainer = document.getElementById('mly-container');
  const mlyStatic = document.getElementById('mly-static');
  function showStaticFallback(iv, reason) {
    mlyStatic.src = iv.image;
    mlyStatic.alt = iv.title;
    mlyStatic.hidden = false;
    mlyContainer.style.display = 'none';
    if (reason) {
      mlyEmptyMsg.textContent = reason;
      mlyEmpty.hidden = false;
      // Auto-dismiss the explainer after 5 s so the photo isn't covered for long.
      setTimeout(() => { mlyEmpty.hidden = true; }, 5000);
    }
  }
  function showMapillaryView() {
    mlyStatic.hidden = true;
    mlyStatic.removeAttribute('src');
    mlyContainer.style.display = '';
  }

  async function openStreetView(idx) {
    const iv = interventions[idx];
    const [lat, lng] = iv.pos;

    mlyTitle.textContent = 'Street View — ' + iv.title;
    mlyEmpty.hidden = true;
    mlyOverlay.hidden = false;

    // No token: still useful — show the topical photo and a one-line nudge
    // toward the token setup. Skip the API call entirely.
    if (!mlyToken) {
      showStaticFallback(iv, 'No Mapillary token configured — showing the topical photo for this site instead. Use "Set token" in the cards panel to enable real Street View photos.');
      return;
    }

    // Search a ~250 m square for the nearest image. Mapillary's bbox order
    // is `west,south,east,north` (lng, lat, lng, lat).
    const r = 0.0025;     // ~250 m
    const bbox = [lng - r, lat - r, lng + r, lat + r].join(',');
    const url = 'https://graph.mapillary.com/images'
      + '?access_token=' + encodeURIComponent(mlyToken)
      + '&fields=id,geometry,is_pano'
      + '&bbox=' + bbox
      + '&limit=5';

    let imageId = null;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (!data.data || !data.data.length) {
        showStaticFallback(iv,
          'No Mapillary photos within ~250 m of this site — showing the topical photo instead.');
        return;
      }
      // Prefer 360° panoramas if any exist — they give the true Street View feel.
      const pano = data.data.find(d => d.is_pano);
      imageId = (pano || data.data[0]).id;
    } catch (e) {
      console.error('[mapillary] lookup failed', e);
      showStaticFallback(iv,
        'Mapillary lookup failed (' + e.message + ') — showing the topical photo instead.');
      return;
    }

    // We have a Mapillary image ID — switch back to the live viewer.
    showMapillaryView();

    // Mount the viewer once; subsequent calls just moveTo() the new image
    // so we don't tear down WebGL contexts.
    if (!mlyViewer && window.mapillary && window.mapillary.Viewer) {
      mlyViewer = new mapillary.Viewer({
        accessToken: mlyToken,
        container: 'mly-container',
        imageId,
      });
    } else if (mlyViewer) {
      try { await mlyViewer.moveTo(imageId); }
      catch (e) {
        console.warn('[mapillary] moveTo failed', e);
        showStaticFallback(iv, 'Could not load that Mapillary image — showing the topical photo instead.');
      }
    } else {
      // Library failed to load (network/CDN issue) — graceful fallback.
      showStaticFallback(iv,
        'Mapillary library did not load — showing the topical photo instead.');
    }
  }

  document.getElementById('mly-close').addEventListener('click', () => {
    mlyOverlay.hidden = true;
  });

  // Expose for the cards builder; also used by the marker click below.
  window.__focusIntervention = focusIntervention;
  window.__focusCategory = focusCategory;
  window.__walkAt = enterWalkMode;
  window.__streetView = openStreetView;

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

// ---------- SIDE PANEL: WASA SOLUTIONS ----------
// `SOLUTIONS` and `afforestationImage` are declared above the init() IIFE so
// they are initialised before buildCards() runs — see the note there.
function buildCards() {
  const container = document.getElementById('map-cards');
  const frag = document.createDocumentFragment();

  // Which recorded sites belong to each solution category, and the first one
  // (used as the Walk/Street-View target). Categories with no submissions yet
  // → buttons replaced by a "No sites recorded yet" note.
  const firstIdx = {};
  const count = {};
  interventions.forEach((iv, idx) => {
    if (firstIdx[iv.icon] === undefined) firstIdx[iv.icon] = idx;
    count[iv.icon] = (count[iv.icon] || 0) + 1;
  });

  SOLUTIONS.forEach((sol) => {
    frag.appendChild(buildCard(sol, firstIdx[sol.letter], count[sol.letter] || 0));
  });

  container.replaceChildren(frag);
}

function buildCard(sol, siteIdx, siteCount) {
  const hasSites = siteIdx !== undefined;

  const card = document.createElement('div');
  card.className = 'map-card' + (hasSites ? '' : ' no-sites');

  const thumb = document.createElement('img');
  thumb.className = 'map-card-img';
  thumb.src = sol.image;
  thumb.alt = sol.name;
  thumb.loading = 'lazy';
  thumb.referrerPolicy = 'no-referrer';

  const head = document.createElement('div');
  head.className = 'map-card-head';
  const ic = document.createElement('span');
  ic.className = 'map-icon';
  ic.textContent = sol.letter;
  const h = document.createElement('h3');
  h.textContent = sol.name;
  head.append(ic, h);

  const desc = document.createElement('p');
  desc.textContent = sol.text;

  const impact = document.createElement('div');
  impact.className = 'map-impact';
  impact.textContent = 'Water cycle: ' + sol.impact;

  card.append(thumb, head, desc, impact);

  if (hasSites) {
    const btn = document.createElement('button');
    btn.className = 'map-focus-btn';
    btn.type = 'button';
    btn.textContent = siteCount > 1 ? ('Fly to sites (' + siteCount + ')') : 'Fly to site';
    btn.addEventListener('click', () => {
      if (window.__focusCategory) window.__focusCategory(sol.letter);
    });

    const streetBtn = document.createElement('button');
    streetBtn.className = 'map-street-btn';
    streetBtn.type = 'button';
    streetBtn.textContent = 'Street View';
    streetBtn.title = 'Open Mapillary Street View — real ground-level photos near this site';
    streetBtn.addEventListener('click', () => {
      if (window.__streetView) window.__streetView(siteIdx);
    });

    card.append(btn, streetBtn);
  } else {
    const note = document.createElement('div');
    note.className = 'map-no-sites';
    note.textContent = 'No sites recorded yet';
    card.append(note);
  }

  return card;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Cesium InfoBox HTML for one intervention: category, the field description,
// any extra comments, who recorded it, and a thumbnail strip of every photo.
// Clicking a photo opens the on-page lightbox (setupPhotoLightbox intercepts
// the click); target="_blank" is the fallback if that can't attach.
function buildDescription(iv) {
  const photos = (iv.photos || []).map(src =>
    '<a class="wasa-photo" href="' + src + '" target="_blank" rel="noopener">' +
      '<img src="' + src + '" alt="" loading="lazy" ' +
        'style="width:88px;height:66px;object-fit:cover;border-radius:5px;cursor:zoom-in;' +
        'border:1px solid rgba(255,255,255,0.18)"></a>'
  ).join('');
  return '<div style="font-family:Segoe UI,sans-serif;font-size:13px;line-height:1.5">' +
    '<div style="color:#ffd54f;font-weight:600;font-size:13px;margin-bottom:4px">' +
      escapeHtml(iv.title) + '</div>' +
    '<p>' + escapeHtml(iv.text) + '</p>' +
    (iv.comments
      ? '<p style="color:#cfe4f1"><em>' + escapeHtml(iv.comments) + '</em></p>' : '') +
    '<p style="color:#9bc7e2;font-size:12px">Recorded by ' + escapeHtml(iv.enumerator) + '</p>' +
    (photos
      ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">' + photos + '</div>' : '') +
  '</div>';
}

// ---------- SCALE BAR + NORTH ARROW ----------
// Cesium has no built-in widgets for either. We pick two screen-space points
// 100 px apart at the screen centre, ray-pick them onto the globe, measure
// the ground distance, and scale a "nice" round number to fit. The north
// arrow just reads viewer.camera.heading and rotates accordingly. Both
// update on Cesium's postRender, throttled to ~10 Hz so they don't redraw
// every frame.
function setupScaleBar(viewer) {
  const labelEl = document.getElementById('scale-bar-label');
  const barEl = document.getElementById('scale-bar-bar');
  if (!labelEl || !barEl) return;

  function niceRound(n) {
    if (n <= 0) return 1;
    const exp = Math.floor(Math.log10(n));
    const mag = Math.pow(10, exp);
    const norm = n / mag;
    let nice;
    if (norm < 1.5) nice = 1;
    else if (norm < 3) nice = 2;
    else if (norm < 7) nice = 5;
    else nice = 10;
    return nice * mag;
  }
  function formatDistance(m) {
    if (m >= 1000) return (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km';
    return Math.round(m) + ' m';
  }

  let lastTick = 0;
  function tick() {
    const now = performance.now();
    if (now - lastTick < 100) return;  // throttle to ~10 Hz
    lastTick = now;

    // Measure 100 px-worth of ground distance at the screen centre.
    const canvas = viewer.scene.canvas;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const p1Screen = new Cesium.Cartesian2(cx, cy);
    const p2Screen = new Cesium.Cartesian2(cx + 100, cy);
    const ray1 = viewer.camera.getPickRay(p1Screen);
    const ray2 = viewer.camera.getPickRay(p2Screen);
    if (!ray1 || !ray2) return;
    const w1 = viewer.scene.globe.pick(ray1, viewer.scene);
    const w2 = viewer.scene.globe.pick(ray2, viewer.scene);
    if (!w1 || !w2) return;
    const metresPer100px = Cesium.Cartesian3.distance(w1, w2);
    if (!Number.isFinite(metresPer100px) || metresPer100px <= 0) return;

    // Target bar length ~120 px → pick a nice round metres value that fits.
    const targetPx = 120;
    const targetMetres = metresPer100px * (targetPx / 100);
    const nice = niceRound(targetMetres);
    const niceWidthPx = (nice / metresPer100px) * 100;
    barEl.style.width = niceWidthPx.toFixed(0) + 'px';
    labelEl.textContent = formatDistance(nice);
  }
  viewer.scene.postRender.addEventListener(tick);
  tick();
}

// ---------- LOCATION SEARCH (OpenStreetMap Nominatim) ----------
// Free geocoder, no API key. Rate-limited to 1 req/sec by Nominatim's
// usage policy — we send only on Enter or button click (no live typeahead).
function setupLocationSearch(viewer) {
  const input = document.getElementById('search-input');
  const goBtn = document.getElementById('search-go');
  const list = document.getElementById('search-results');
  if (!input || !goBtn || !list) return;

  // Local search over the WASA solutions and the recorded sites — matched by
  // category name/letter, site activity, or enumerator. Returns clickable
  // actions: fly to a category's sites, or to a single recorded site.
  function localMatches(ql) {
    const byLetter = {};
    interventions.forEach((iv, i) => { (byLetter[iv.icon] = byLetter[iv.icon] || []).push(i); });
    const out = [];
    SOLUTIONS.forEach((sol) => {
      const sites = byLetter[sol.letter] || [];
      if (!sites.length) return;                          // nothing to fly to
      if ((sol.letter + ' ' + sol.name).toLowerCase().includes(ql)) {
        out.push({
          title: sol.letter + ' — ' + sol.name,
          sub: 'WASA solution · ' + sites.length + (sites.length === 1 ? ' site' : ' sites'),
          run: () => { if (window.__focusCategory) window.__focusCategory(sol.letter); },
        });
      }
    });
    interventions.forEach((iv, i) => {
      if ((iv.title + ' ' + iv.category + ' ' + iv.enumerator).toLowerCase().includes(ql)) {
        out.push({
          title: iv.title,
          sub: iv.icon + ' · ' + iv.category + ' · ' + iv.enumerator,
          run: () => { if (window.__focusIntervention) window.__focusIntervention(i); },
        });
      }
    });
    return out;
  }

  function addGroup(text) {
    const li = document.createElement('li');
    li.className = 'search-group';
    li.textContent = text;
    list.appendChild(li);
  }
  function addResult(title, sub, onClick) {
    const li = document.createElement('li');
    li.className = 'search-wasa';
    const t = document.createElement('span');
    t.className = 'search-title';
    t.textContent = title;
    li.appendChild(t);
    if (sub) {
      const s = document.createElement('span');
      s.className = 'search-sub';
      s.textContent = sub;
      li.appendChild(s);
    }
    li.addEventListener('click', onClick);
    list.appendChild(li);
  }

  async function doSearch(q) {
    q = (q || '').trim();
    if (!q) return;
    const ql = q.toLowerCase();
    list.innerHTML = '';
    list.hidden = false;

    // 1) WASA solutions & recorded sites — local, instant.
    const locals = localMatches(ql);
    if (locals.length) {
      addGroup('WASA solutions & sites');
      locals.slice(0, 8).forEach((m) => {
        addResult(m.title, m.sub, () => { m.run(); list.hidden = true; input.value = m.title; });
      });
    }

    // 2) Places — OpenStreetMap / Nominatim.
    addGroup('Places');
    const loading = document.createElement('li');
    loading.className = 'search-empty';
    loading.textContent = 'Searching places…';
    list.appendChild(loading);
    try {
      const url = 'https://nominatim.openstreetmap.org/search'
        + '?q=' + encodeURIComponent(q)
        + '&format=json&limit=6&addressdetails=0';
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      loading.remove();
      if (!data || !data.length) {
        const li = document.createElement('li');
        li.className = 'search-empty';
        li.textContent = locals.length ? 'No matching places' : 'No results';
        list.appendChild(li);
        return;
      }
      data.forEach((r) => {
        const li = document.createElement('li');
        li.textContent = r.display_name;
        li.addEventListener('click', () => {
          flyToCoord(parseFloat(r.lat), parseFloat(r.lon));
          list.hidden = true;
          input.value = r.display_name.split(',')[0];
        });
        list.appendChild(li);
      });
    } catch (e) {
      loading.textContent = 'Place search failed: ' + e.message;
    }
  }

  function flyToCoord(lat, lon) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 6000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-55), roll: 0 },
      duration: 1.6,
    });
  }

  goBtn.addEventListener('click', () => doSearch(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(input.value); }
    else if (e.key === 'Escape') { list.hidden = true; input.blur(); }
  });
  // Click outside the search box closes the dropdown.
  document.addEventListener('click', (e) => {
    if (!document.getElementById('search-box').contains(e.target)) list.hidden = true;
  });
}

// ---------- PHOTO LIGHTBOX ----------
// The site photos live inside the Cesium InfoBox, which renders into a
// same-origin sandboxed iframe. Inline on* handlers are stripped there, so we
// delegate clicks on the photo links from the PARENT document and open a
// full-screen overlay on this page (with prev/next) instead of a new tab.
// If the iframe is ever unreachable, the links keep their target="_blank".
function setupPhotoLightbox(viewer) {
  const box = document.getElementById('photo-lightbox');
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  if (!box || !img) return;

  let photos = [];
  let idx = 0;
  function render() {
    img.src = photos[idx];
    if (counter) counter.textContent = photos.length > 1 ? (idx + 1) + ' / ' + photos.length : '';
  }
  function open(list, start) {
    photos = (list || []).filter(Boolean);
    if (!photos.length) return;
    idx = Math.min(Math.max(start || 0, 0), photos.length - 1);
    render();
    box.hidden = false;
  }
  function close() { box.hidden = true; img.removeAttribute('src'); }
  function step(d) { if (photos.length) { idx = (idx + d + photos.length) % photos.length; render(); } }

  document.getElementById('lightbox-close').addEventListener('click', close);
  document.getElementById('lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  document.getElementById('lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  // Click the dark backdrop (but not the image/buttons) to close.
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  // Delegate photo clicks inside the InfoBox iframe. Re-run on every selection
  // change in case Cesium rebuilds the iframe document.
  const frame = viewer.infoBox && viewer.infoBox.frame;
  if (!frame) return;
  function isPhotoHref(a) {
    return a && (a.getAttribute('href') || '').indexOf('photos/') !== -1;
  }
  function attach() {
    let doc;
    try { doc = frame.contentDocument; } catch (e) { return; }   // cross-origin: keep _blank
    if (!doc || doc.__wasaPhotoBound) return;
    doc.__wasaPhotoBound = true;
    doc.addEventListener('click', (e) => {
      const a = e.target && e.target.closest && e.target.closest('a');
      if (!isPhotoHref(a)) return;
      e.preventDefault();
      const links = Array.prototype.slice.call(doc.querySelectorAll('a')).filter(isPhotoHref);
      open(links.map((l) => l.getAttribute('href')), links.indexOf(a));
    });
  }
  frame.addEventListener('load', attach);
  attach();
  viewer.selectedEntityChanged.addEventListener(() => setTimeout(attach, 0));
}

// ---------- LIVE CURSOR COORDINATES ----------
// Reads back the lat/lng under the mouse cursor as the user moves it across
// the globe. Cesium's pickEllipsoid resolves a screen point to a world
// position; we convert to cartographic and format. Shown at bottom-center
// next to the scale bar.
function setupCursorCoordinates(viewer) {
  const el = document.getElementById('cursor-coords');
  if (!el) return;
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(({ endPosition }) => {
    const ellipsoid = viewer.scene.globe.ellipsoid;
    // First try a terrain pick (accurate over surfaces), then fall back to
    // ellipsoid pick if the ray missed (looking at the sky).
    let cartesian = viewer.scene.pickPosition(endPosition);
    if (!Cesium.defined(cartesian) || !cartesian) {
      cartesian = viewer.camera.pickEllipsoid(endPosition, ellipsoid);
    }
    if (!cartesian) { el.hidden = true; return; }
    const carto = Cesium.Cartographic.fromCartesian(cartesian, ellipsoid);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    el.textContent = `lat ${lat.toFixed(5)}, lon ${lon.toFixed(5)}`;
    el.hidden = false;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  // Hide the readout when the cursor leaves the canvas.
  viewer.scene.canvas.addEventListener('mouseleave', () => { el.hidden = true; });
}

// setupCamControls removed — the on-screen camera nav cluster is gone.
// Cesium's native mouse/touch input (drag = pan, right-drag = tilt,
// scroll = zoom) covers the same functionality without DOM clutter.

// North arrow: rotate the SVG so the red half always points to true
// north. Click flies the camera back to heading: 0 while keeping the
// current position and tilt.
function setupNorthArrow(viewer) {
  const btn = document.getElementById('north-arrow');
  if (!btn) return;
  const svg = btn.querySelector('svg');
  if (!svg) return;

  btn.addEventListener('click', () => {
    const cam = viewer.camera;
    cam.flyTo({
      destination: cam.positionWC.clone(),
      orientation: { heading: 0, pitch: cam.pitch, roll: 0 },
      duration: 0.8,
    });
  });

  let lastTick = 0;
  viewer.scene.postRender.addEventListener(() => {
    const now = performance.now();
    if (now - lastTick < 100) return;       // throttle to ~10 Hz
    lastTick = now;
    const deg = Cesium.Math.toDegrees(viewer.camera.heading);
    svg.style.transform = 'rotate(' + (-deg).toFixed(1) + 'deg)';
  });
}
