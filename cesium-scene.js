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

// ---------- DEMO LOCATION ----------
// Centred on Blantyre, southern Malawi — where Mapillary has dense crowd-
// sourced street-level coverage. The watershed and intervention sites are
// still fictional (placed for the visualisation) but they sit on real roads
// so the Mapillary Street View viewer can find imagery near every marker.
const CENTRE = { lat: -15.7861, lng: 35.0058 };

const WATERSHED = [
  [-15.7760, 34.9970],
  [-15.7775, 35.0150],
  [-15.7945, 35.0170],
  [-15.7965, 35.0000],
  [-15.7850, 34.9960],
];

const RIVER = [
  [-15.7790, 35.0000],
  [-15.7830, 35.0050],
  [-15.7870, 35.0080],
  [-15.7905, 35.0105],
  [-15.7935, 35.0130],
  [-15.7960, 35.0160],
];

// ---------- WASA INTERVENTIONS ----------
// `range` (metres above ground) and `pitch` (degrees, negative = look down)
// are tuned for Cesium's flyToBoundingSphere / lookAt style flight.
//
// `image` URLs use LoremFlickr — a free service that returns real, CC-licensed
// Flickr photos matching the supplied tags. The `lock` query param pins each
// card to a specific photo (otherwise we'd get a new one every reload). When
// you have real WASA-specific photos, replace each per-card URL.
const interventions = [
  {
    icon: 'A',
    title: 'Afforestation & Agroforestry',
    text:
      'Replants tree cover on cleared mountain slopes, pumping moisture back into the atmosphere ' +
      'through transpiration and anchoring topsoil. Agroforestry rows mix trees with food crops.',
    impact: 'Recovers transpiration, recharges groundwater, anchors soil',
    image: 'https://loremflickr.com/640/240/forest,tree-planting,africa/all?lock=1',
    pos: [-15.7795, 35.0015],
    range: 600, heading: 60, pitch: -35,
  },
  {
    icon: 'B',
    title: 'Conservation Agriculture',
    text:
      'Minimum tillage, mulching, and cover crops keep soils porous and shaded. Rainfall infiltrates ' +
      'instead of running off; organic matter triples soil water-holding capacity.',
    impact: 'Higher infiltration, lower evaporation loss',
    image: 'https://loremflickr.com/640/240/farm,field,mulch/all?lock=2',
    pos: [-15.7840, 35.0040],
    range: 400, heading: 20, pitch: -40,
  },
  {
    icon: 'C',
    title: 'Tied Ridges & Soil Ripping',
    text:
      'Small earthen cross-ridges trap rainfall where it falls; soil rippers break compacted layers ' +
      'so water moves into the root zone. Crops survive erratic-rainfall seasons.',
    impact: 'In-situ rainwater capture, deeper percolation',
    image: 'https://loremflickr.com/640/240/terrace,farming,contour/all?lock=3',
    pos: [-15.7880, 35.0090],
    range: 400, heading: 340, pitch: -40,
  },
  {
    icon: 'D',
    title: 'Erosion Control & Riparian Buffers',
    text:
      'Contour bunds, mulch strips, and grass tufts hold rainfall on the slope above the gully. ' +
      'Riparian buffers along the river trap sediment before it reaches downstream water bodies.',
    impact: 'Protected topsoil, reduced sediment in rivers',
    image: 'https://loremflickr.com/640/240/erosion,gully,soil/all?lock=4',
    pos: [-15.7915, 35.0050],
    range: 500, heading: 110, pitch: -35,
  },
  {
    icon: 'E',
    title: 'Rainwater Harvesting & Farm Ponds',
    text:
      'Two linked farm ponds store wet-season runoff for dry-season use. Inflow from the stream, ' +
      'outflow tied to terraced fields. The system recharges shallow groundwater and supports life year-round.',
    impact: 'Year-round water access, groundwater recharge',
    image: 'https://loremflickr.com/640/240/pond,farm,rainwater/all?lock=5',
    pos: [-15.7855, 35.0125],
    range: 400, heading: 0, pitch: -45,
  },
  {
    icon: 'F',
    title: 'Green Infrastructure',
    text:
      'Restored wetlands and small check dams flatten flood peaks and extend dry-season base flow. ' +
      'The watershed acts like a sponge instead of a fast pipe to the river.',
    impact: 'Lower flood peaks, longer base flow',
    image: 'https://loremflickr.com/640/240/wetland,marsh,river/all?lock=6',
    pos: [-15.7930, 35.0110],
    range: 500, heading: 70, pitch: -35,
  },
  {
    icon: 'G',
    title: 'Community Watershed Governance',
    text:
      'A local watershed committee — convened in the village near the outlet — decides where ponds and ' +
      'forest patches go, enforces grazing rules, and maintains the interventions between seasons.',
    impact: 'Durable, locally-owned landscape stewardship',
    image: 'https://loremflickr.com/640/240/village,community,africa/all?lock=7',
    pos: [-15.7861, 35.0058],
    range: 1800, heading: 0, pitch: -55,
  },
  {
    icon: 'H',
    title: 'Climate Information Services',
    text:
      'Seasonal forecasts and on-time advisories are broadcast from the school on the ridge. ' +
      'Farmers plant, irrigate, and harvest at the right moment — more crop per millimetre of rain.',
    impact: 'More crop per drop, fewer failed seasons',
    image: 'https://loremflickr.com/640/240/weather,station,clouds/all?lock=8',
    pos: [-15.7800, 35.0080],
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

  // ---------- SCALE BAR + NORTH ARROW + SEARCH + COORDS ----------
  // Cam-controls removed (Cesium's native input covers pan/tilt/zoom).
  // The north arrow remains as a lightweight orientation cue.
  setupScaleBar(viewer);
  setupNorthArrow(viewer);
  setupLocationSearch(viewer);
  setupCursorCoordinates(viewer);

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

  // ---------- WALK MODE (first-person) ----------
  // Drops the camera to ~2 m above ground at an intervention site and
  // switches input to FPS-style: drag-to-look + WASD to walk. No real ground
  // photos — just the satellite tile draped on the terrain — but it gives
  // the user a sense of being inside the watershed. Exits on Esc or the
  // Exit button. Re-attaches Cesium's default mouse interactions on exit.
  let walking = false;
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
    // Fly back to the overview camera.
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(CENTRE.lng, CENTRE.lat - 0.015, 4500),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-55), roll: 0 },
      duration: 1.4,
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

  async function openStreetView(idx) {
    const iv = interventions[idx];
    const [lat, lng] = iv.pos;

    // No token → show the bottom-right notice instead of opening the modal.
    if (!mlyToken) {
      mlyTokenNotice.style.display = 'block';
      // Auto-dismiss after 8 s so it doesn't linger.
      setTimeout(() => { mlyTokenNotice.style.display = 'none'; }, 8000);
      return;
    }

    mlyTitle.textContent = 'Street View — ' + iv.title;
    mlyEmpty.hidden = true;
    mlyOverlay.hidden = false;

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
        mlyEmptyMsg.textContent =
          'Mapillary has no street-level photos within ~250 m of this site. '
          + 'Try the "Fly to site" or "Walk here" buttons, or pick a card whose '
          + 'marker sits closer to a road.';
        mlyEmpty.hidden = false;
        return;
      }
      // Prefer 360° panoramas if any exist — they give the true Street View feel.
      const pano = data.data.find(d => d.is_pano);
      imageId = (pano || data.data[0]).id;
    } catch (e) {
      console.error('[mapillary] lookup failed', e);
      mlyEmptyMsg.textContent = 'Could not reach Mapillary: ' + e.message
        + '. Check that your token is valid (format MLY|...).';
      mlyEmpty.hidden = false;
      return;
    }

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
      catch (e) { console.warn('[mapillary] moveTo failed', e); }
    } else {
      // Library failed to load (network/CDN issue).
      mlyEmptyMsg.textContent = 'Mapillary library did not load. Reload the page.';
      mlyEmpty.hidden = false;
    }
  }

  document.getElementById('mly-close').addEventListener('click', () => {
    mlyOverlay.hidden = true;
  });

  // Expose for the cards builder; also used by the marker click below.
  window.__focusIntervention = focusIntervention;
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

    const walkBtn = document.createElement('button');
    walkBtn.className = 'map-walk-btn';
    walkBtn.type = 'button';
    walkBtn.textContent = 'Walk here';
    walkBtn.title = 'Drop the camera to ground level and walk around (WASD / drag to look / Esc to exit)';
    walkBtn.addEventListener('click', () => {
      if (window.__walkAt) window.__walkAt(idx);
    });

    const streetBtn = document.createElement('button');
    streetBtn.className = 'map-street-btn';
    streetBtn.type = 'button';
    streetBtn.textContent = 'Street View';
    streetBtn.title = 'Open Mapillary Street View — real ground-level photos near this site';
    streetBtn.addEventListener('click', () => {
      if (window.__streetView) window.__streetView(idx);
    });

    // Topical photo thumbnail via LoremFlickr (real Flickr CC photos tag-matched
    // to this intervention). Swap with a curated image when one is available.
    const thumb = document.createElement('img');
    thumb.className = 'map-card-img';
    thumb.src = iv.image;
    thumb.alt = iv.title;
    thumb.loading = 'lazy';
    thumb.referrerPolicy = 'no-referrer';

    card.append(thumb, head, desc, impact, btn, walkBtn, streetBtn);
    frag.appendChild(card);
  });
  container.replaceChildren(frag);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

  async function doSearch(q) {
    q = (q || '').trim();
    if (!q) return;
    list.innerHTML = '<li class="search-empty">Searching…</li>';
    list.hidden = false;
    try {
      const url = 'https://nominatim.openstreetmap.org/search'
        + '?q=' + encodeURIComponent(q)
        + '&format=json&limit=6&addressdetails=0';
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      list.innerHTML = '';
      if (!data || !data.length) {
        list.innerHTML = '<li class="search-empty">No results</li>';
        return;
      }
      data.forEach(r => {
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
      list.innerHTML = '<li class="search-empty">Search failed: ' + escapeHtml(e.message) + '</li>';
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
