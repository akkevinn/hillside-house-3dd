import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHouse, computeLayout, DEFAULTS } from './house.js';
import * as TX from './textures.js';
import * as F from './furniture.js';

const { PAL } = F;

/* ============================ renderer / scene (persistent) ============================ */
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top); grd.addColorStop(1, bottom); g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const skyDay = skyTexture('#8fb6e6', '#dfeaf3'), skyNight = skyTexture('#0a0e1a', '#222a3a');
scene.background = skyDay;

// Two lenses: a narrow ORBIT lens flattens perspective into the architectural
// "dollhouse" look of glossy floor-plan renders; a natural WALK lens is swapped in
// for first-person so it doesn't feel like a telescope. The view presets below were
// framed for the old 52° lens, so DOLLY pushes the camera back to keep that framing.
const ORBIT_FOV = 38, WALK_FOV = 70;
const DOLLY = Math.tan(THREE.MathUtils.degToRad(52) / 2) / Math.tan(THREE.MathUtils.degToRad(ORBIT_FOV) / 2);
const _dv = new THREE.Vector3(), _dt = new THREE.Vector3();
const dollied = (pos, target) => _dv.set(...pos).sub(_dt.set(...target)).multiplyScalar(DOLLY).add(_dt);

const camera = new THREE.PerspectiveCamera(ORBIT_FOV, 1, 0.05, 400);
camera.position.copy(dollied([12, 9, -12], [0, 1.4, 0]));
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true; orbit.dampingFactor = 0.07; orbit.target.set(0, 1.4, 0);
orbit.maxPolarAngle = Math.PI * 0.495; orbit.minDistance = 1.5; orbit.maxDistance = 60; orbit.autoRotateSpeed = 0.5;
orbit.zoomSpeed = 1.6; orbit.zoomToCursor = true;   // easier, cursor-anchored zoom

// the model is mirrored left-right (scale.x = -1) so the interior matches the site plan
const content = new THREE.Group(); content.scale.x = -1; scene.add(content);

const hemi = new THREE.HemisphereLight(0xdcebff, 0x6b5a44, 0.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 2.6);
sun.position.set(-13, 20, -7); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
const sc = 18; Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc });
sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5; scene.add(sun, sun.target);

/* ============================ textures (persistent) ============================ */
const tex = {
  wood: TX.woodFloor(), tile: TX.tile({ color: '#e9e7e1', grout: '#c2bfb7' }),
  tileBath: TX.tile({ color: '#dfe3e4', grout: '#a9adad' }), wall: TX.wall(),
  grass: TX.grass(), paving: TX.paving(),
  cement: TX.concrete({ color: '#c4c2bb' }), pebbles: TX.pebbles(),
};
tex.wall.repeat.set(3, 3);

/* ============================ model build / rebuild ============================ */
const params = { ...DEFAULTS };
let model = null;
const VERSIONS = [
  { id: 'default', name: 'Default' },
  { id: 'gym', name: 'Phase 1' },
  { id: 'phase2', name: 'Phase 2' },
  { id: 'phase3', name: 'Phase 3' },
];
// 'newborn' is archived: kept in code (furnish branch) but hidden from the selector.
let version = 'default';
const gymLike = v => v === 'gym' || v === 'newborn' || v === 'phase2';   // versions with the 2F gym/office
const $ = id => document.getElementById(id);
const C = (rect) => [(rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2];

function disposeGroup(g) { g.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); }); }

function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,20,24,0.82)';
  const x = 4, y = 10, w = 248, h = 44, r = 11;
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
  g.font = 'bold 26px Inter, system-ui, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.4, 0.35, 1); return s;
}

function furnish(L, floor0, floor1, labels, lights) {
  const FH = L.FH, R = L.rooms;
  const put = (parent, obj, x, z, rotY = 0, y = 0) => { obj.position.set(x, y, z); obj.rotation.y = rotY; parent.add(obj); return obj; };
  const lampAt = (parent, x, y, z, color = 0xffe1b0, dist = 6) => { const p = new THREE.PointLight(color, 0, dist, 2); p.position.set(x, y, z); parent.add(p); lights.push(p); };

  /* --- LANTAI 1 --- */
  // living — L-shaped sectional facing the TV: a long arm faces the TV (on the solid left
  // wall) and a short return arm runs along the living/dining edge; TV centred on the wall.
  // Both arms clear the entry door (front) and the powder-room door (right) to walk through.
  let [lx, lz] = C(R.living);
  put(floor0, F.rug(2.2, 1.8, PAL.fabricSand), 1.55, lz + 0.2);
  put(floor0, F.tvWall(1.4), R.living.x0 + 0.16, lz + 0.1, Math.PI / 2);             // centred on the left wall, faces +x
  put(floor0, F.sofa(1.4, PAL.fabricBlue), R.living.x1 - 0.95, lz - 0.05, -Math.PI / 2); // long arm, faces -x toward TV (pulled forward)
  put(floor0, F.sofa(1.15, PAL.fabricBlue), 1.38, R.living.z1 - 0.4, Math.PI);           // return arm pushed back to the wall, meets the long arm at its rear corner
  put(floor0, F.plant(1.5), R.living.x1 - 0.32, R.living.z1 - 0.4);                     // back corner beside the sofa, clear of the TV
  // dining — round table (default); in "New Born Baby" the table is removed and the space
  // becomes a temporary sleeping area for mother + baby (husband uses the sofa as a sofa bed)
  let [dx, dz] = C(R.dining);
  if (version === 'phase2' || version === 'phase3') {
    // dining is extended ~1.5 m into the backyard (open-plan) → a bigger 6-seat table
    put(floor0, F.diningSet(6), R.dining.x0 + 1.55, R.dining.z1 + 0.15, 0);
  } else if (version === 'newborn') {
    // mother's bed + baby crib hug the solid LEFT wall so the kitchen-side opening (right)
    // and the backyard door (back-left) both stay clear to walk through
    put(floor0, F.bed(0.95, 2.0, PAL.fabricSand), R.dining.x0 + 1.0, R.dining.z0 + 1.05, Math.PI / 2);  // mother's single bed, headboard to wall
    put(floor0, F.crib(), R.dining.x0 + 0.66, R.dining.z0 - 0.1, Math.PI / 2);                          // crib tucked against the wall, just in front of the bed
    put(floor0, F.nightstand(), R.dining.x0 + 0.35, R.dining.z0 + 1.95, 0);                             // bedside, clear of the backyard door
  } else {
    put(floor0, F.roundDiningSet(4), dx, dz);
    put(floor0, F.plant(1.3), R.dining.x0 + 0.45, R.dining.z1 - 0.5);
  }
  // toilet
  put(floor0, F.toilet(), R.toilet.x1 - 0.25, R.toilet.z1 - 0.4, -Math.PI / 2);
  put(floor0, F.basin(), R.toilet.x0 + 0.45, R.toilet.z1 - 0.3, Math.PI);   // back wall, clear of the door
  // kitchen — counter along the right wall, shortened to leave a gap at its front end
  let [kx, kz] = C(R.kitchen);
  put(floor0, F.kitchenLinear(1.4), R.kitchen.x1 - 0.34, R.kitchen.z1 - 0.8, Math.PI / 2);
  // fridge fills that gap: corner against the right wall + the stair-side wall, in line with the counter
  put(floor0, F.fridge(), R.kitchen.x1 - 0.35, R.kitchen.z0 + 0.42, -Math.PI / 2);
  // Phase 2: the kitchen now reaches into the extension → continue the counter along the right wall
  if (version === 'phase2' || version === 'phase3') put(floor0, F.kitchenLinear(1.1), R.kitchen.x1 - 0.34, R.kitchen.z1 + 0.7, Math.PI / 2);
  // carport + greenery
  put(floor0, F.car(0x5f6b78), L.W - 1.05, Math.min(L.zCar - 0.25, 2.3));   // parked clear of the relocated door
  put(floor0, F.plant(1.7), 0.45, L.zCar - 0.8);

  // backyard — open lawn with a laundry/camping setup (default/Phase 1) OR the Phase 2 annex
  if (version === 'phase2' || version === 'phase3') {
    // Renovated backyard. LEFT column: kamar → shower → gudang (very back).
    // RIGHT: laundry (kept) + an open Taman that runs to the very back.
    // KAMAR (x0–2.6, z10.9–13.4): bed headboard on the left wall, nightstand + library
    put(floor0, F.bed(1.6, 2.0, PAL.fabricSand), 1.0, 12.15, Math.PI / 2);
    put(floor0, F.nightstand(), 0.32, 11.5, 0);
    put(floor0, F.bookshelf(0.9, 1.7), 2.32, 12.9, -Math.PI / 2);          // library against the divider wall
    // SHOWER (x0–2.6, z13.4–14.4): enclosure in the corner, glass toward the ensuite door
    put(floor0, F.shower(0.9, 0.9), 1.9, 13.95, Math.PI);
    // GUDANG / warehouse (x0–2.6, very back): shelving + crates
    put(floor0, F.bookshelf(1.2, 1.6), 1.0, 15.0, Math.PI);
    put(floor0, F.box(0.55, 0.55, 0.55, PAL.woodMid), 2.0, 14.85, 0, 0.275);
    put(floor0, F.box(0.5, 0.45, 0.5, PAL.woodLight), 0.6, 14.8, 0.3, 0.225);
    // LAUNDRY (x3.6–5) — kept: washer + sink along the right wall
    put(floor0, F.washer(), 4.6, 11.4, Math.PI / 2);
    put(floor0, F.basin(), 4.6, 12.1, Math.PI / 2);
    // TAMAN — open garden (right side) running to the very back.
    // jemuran toward the front; table + chairs by the rear wall so they don't clash with it
    put(floor0, F.jemuran(1.8), 3.7, 13.0, 0);
    put(floor0, F.campTable(), 3.5, 14.2, 0);
    put(floor0, F.campChair(0x4a6075), 3.5, 14.7, Math.PI);
    put(floor0, F.campChair(0x3f6f57), 2.95, 14.2, Math.PI / 2);
    put(floor0, F.plant(1.6), 2.9, 13.1);
    put(floor0, F.plant(1.3), L.W - 0.4, 13.9);
  } else {
    // dry tropical garden on a cemented yard (Default / Phase 1): keep the service corner
    // (canopy + washer + jemuran) and the santai set; add a feature tree, pots + stepping stones
    put(floor0, F.canopy(2.5, 2.2, 2.2), 1.3, L.zEnc + 1.15, 0);
    put(floor0, F.washer(), 0.7, L.zEnc + 0.5, 0);
    put(floor0, F.jemuran(2.0), 1.55, L.zEnc + 1.65, 0);
    // santai — table + chairs, shifted to the central cement, clear of the side beds
    put(floor0, F.campTable(), 2.9, L.zEnc + 3.6, 0);
    put(floor0, F.campChair(0x3f6f57), 2.9, L.zEnc + 2.75, 0);
    put(floor0, F.campChair(0xb1573a), 2.9, L.zEnc + 4.45, Math.PI);
    put(floor0, F.campChair(0x4a6075), 2.0, L.zEnc + 3.6, Math.PI / 2);
    put(floor0, F.campChair(0xc9a24a), 3.8, L.zEnc + 3.6, -Math.PI / 2);
    // stepping stones across the cement toward the back-left feature tree
    for (let i = 0; i < 4; i++) put(floor0, F.box(0.42, 0.06, 0.42, 0x9a948a), 1.35, L.zEnc + 2.3 + i * 0.85, 0, 0.03);
    // greenery in the pebble beds: a tall feature tree (back-left) + plants both sides
    put(floor0, F.plant(2.4), 0.5, L.zBL - 0.7);
    put(floor0, F.plant(1.3), 0.5, L.zEnc + 3.4);
    put(floor0, F.plant(1.5), L.W - 0.5, L.zBR - 0.7);
    put(floor0, F.plant(1.1), L.W - 0.5, L.zEnc + 3.4);
    put(floor0, F.plant(0.9), L.W - 0.55, L.zEnc + 0.7);   // potted accent by the entry
  }

  /* --- LANTAI 2 --- */
  const [mx, mz] = C(R.master), [b2x, b2z] = C(R.bed2), [b3x, b3z] = C(R.bed3), [hx, hz] = C(R.hall);
  // master — bed headboard against the FRONT wall, so it never blocks the door (which is in the rear wall)
  put(floor1, F.rug(2.4, 1.9, PAL.fabricSage), 1.7, R.master.z0 + 1.1, 0, FH);
  put(floor1, F.bed(1.8, 2.0, PAL.fabricSand), 1.8, R.master.z0 + 1.05, 0, FH);
  put(floor1, F.nightstand(), 0.65, R.master.z0 + 0.35, 0, FH);
  put(floor1, F.nightstand(), 2.95, R.master.z0 + 0.35, 0, FH);
  put(floor1, F.wardrobe(1.4, 2.2), 0.9, R.master.z1 - 0.32, Math.PI, FH);     // rear wall, left of the door
  // KM/WC 1 (master ensuite)
  put(floor1, F.shower(0.85, 0.95), R.wc1.x1 - 0.5, R.wc1.z0 + 0.55, 0, FH);
  put(floor1, F.toilet(), R.wc1.x1 - 0.45, R.wc1.z1 - 0.5, Math.PI, FH);
  put(floor1, F.basin(), R.wc1.x0 + 0.32, (R.wc1.z0 + R.wc1.z1) / 2, -Math.PI / 2, FH);
  // KM/WC 2 — door is on the right wall, so keep fixtures left/back of it
  put(floor1, F.toilet(), R.wc2.x0 + 0.32, R.wc2.z1 - 0.5, Math.PI / 2, FH);
  put(floor1, F.basin(), R.wc2.x1 - 0.55, R.wc2.z1 - 0.18, Math.PI, FH);   // back wall, clear of the door
  if (version === 'phase3') {
    // KAMAR BAYI (left-front) — bed headboard on the front wall, wardrobe clear of the side door
    put(floor1, F.bed(1.2, 2.0, PAL.fabricSand), R.bed3.x0 + 1.0, R.bed3.z0 + 1.1, 0, FH);
    put(floor1, F.nightstand(), R.bed3.x0 + 1.95, R.bed3.z0 + 0.4, 0, FH);
    put(floor1, F.wardrobe(1.1, 2.0), R.bed3.x1 - 0.28, R.bed3.z1 - 0.7, -Math.PI / 2, FH);      // right wall, at the back (clear of the door)
    put(floor1, F.rug(1.5, 1.2, PAL.fabricSage), R.bed3.x0 + 1.0, R.bed3.z0 + 1.5, 0, FH);
    // GYM & KERJA (left-back) — equipment kept off the side door; work corner at the rear
    put(floor1, F.rug(2.0, 1.6, 0x33373b), R.bed2.x0 + 1.1, R.bed2.z0 + 2.0, 0, FH);
    put(floor1, F.cableMachine(), R.bed2.x0 + 0.35, R.bed2.z0 + 1.5, Math.PI / 2, FH);           // left wall
    put(floor1, F.weightBench(), R.bed2.x0 + 1.15, R.bed2.z0 + 2.1, 0, FH);
    put(floor1, F.dumbbellRack(), R.bed2.x0 + 0.5, R.bed2.z0 + 0.55, 0, FH);
    put(floor1, F.desk(), R.bed2.x0 + 0.5, R.bed2.z1 - 0.6, Math.PI / 2, FH);
    put(floor1, F.officeChair(), R.bed2.x0 + 1.15, R.bed2.z1 - 0.6, -Math.PI / 2, FH);
    put(floor1, F.pullUpTower(), R.bed2.x1 - 0.5, R.bed2.z1 - 0.55, Math.PI, FH);
    // OPEN SHARING / PLAY (right, full depth): TV + sofa in the middle (between the two bedroom
    // doors), game + wardrobe up front, glass-floor lounge at the rear
    const px = (R.play.x0 + R.play.x1) / 2;
    put(floor1, F.tvWall(1.4), R.play.x1 - 0.16, R.play.z0 + 3.5, -Math.PI / 2, FH);             // TV on the outer wall
    put(floor1, F.sofa(1.8, PAL.fabricBlue), R.play.x0 + 0.6, R.play.z0 + 3.5, Math.PI / 2, FH);  // faces the TV, clear of both doors
    put(floor1, F.rug(2.2, 2.0, PAL.fabricSage), px, R.play.z0 + 3.5, 0, FH);
    put(floor1, F.pcTower(), R.play.x1 - 0.5, R.play.z0 + 2.3, 0, FH);                           // game station
    put(floor1, F.wardrobe(1.5, 2.0), R.play.x1 - 0.3, R.play.z0 + 0.95, -Math.PI / 2, FH);       // wardrobe in the sharing area (front corner)
    put(floor1, F.plant(1.4), R.play.x0 + 0.5, R.play.z0 + 0.8, 0, FH);
    // glass-floor lounge over the Taman (rear of the open play) — light armchairs so the floor reads
    put(floor1, F.armchair(PAL.fabricSand), R.glass.x0 + 0.85, R.glass.z0 + 0.95, Math.PI / 4, FH);
    put(floor1, F.armchair(PAL.fabricBlue), R.glass.x1 - 0.85, R.glass.z1 - 0.95, -Math.PI * 0.75, FH);
    put(floor1, F.plant(1.3), R.glass.x1 - 0.42, R.glass.z0 + 0.55, 0, FH);
  } else if (gymLike(version)) {
    // KAMAR TIDUR 2 → home gym + work corner
    put(floor1, F.desk(), R.bed2.x0 + 0.4, R.bed2.z1 - 0.7, Math.PI / 2, FH);          // work corner (back-left)
    put(floor1, F.officeChair(), R.bed2.x0 + 1.05, R.bed2.z1 - 0.7, -Math.PI / 2, FH);
    put(floor1, F.pcTower(), R.bed2.x0 + 0.45, R.bed2.z1 - 1.45, 0, FH);
    put(floor1, F.rug(2.0, 1.5, 0x33373b), R.bed2.x0 + 1.45, R.bed2.z0 + 1.35, 0, FH); // gym mat
    put(floor1, F.weightBench(), R.bed2.x0 + 1.3, R.bed2.z0 + 1.3, 0, FH);
    put(floor1, F.dumbbellRack(), R.bed2.x0 + 0.6, R.bed2.z0 + 0.45, 0, FH);
    put(floor1, F.cableMachine(), R.bed2.x1 - 0.35, R.bed2.z0 + 1.55, -Math.PI / 2, FH);
    put(floor1, F.pullUpTower(), R.bed2.x1 - 0.55, R.bed2.z1 - 0.55, Math.PI, FH);
    // KAMAR TIDUR 3 → nursery (crib only in "Gym & Office"; in "New Born Baby" it's moved downstairs)
    put(floor1, F.wardrobe(1.0, 1.7), R.bed3.x0 + 0.32, R.bed3.z0 + 1.0, Math.PI / 2, FH);
    put(floor1, F.rug(1.4, 1.3, PAL.fabricSage), R.bed3.x0 + 1.05, R.bed3.z0 + 1.5, 0, FH);
    put(floor1, F.plant(1.0), R.bed3.x1 - 0.35, R.bed3.z0 + 0.45, 0, FH);
    if (version === 'gym' || version === 'phase2') put(floor1, F.crib(), R.bed3.x1 - 0.55, R.bed3.z1 - 0.9, 0, FH);
  } else {
    // default — two bedrooms
    put(floor1, F.bed(1.4, 2.0, PAL.fabricBlue), R.bed2.x0 + 1.0, R.bed2.z0 + 1.25, Math.PI / 2, FH);
    put(floor1, F.wardrobe(1.2, 2.1), R.bed2.x1 - 0.32, R.bed2.z1 - 0.9, -Math.PI / 2, FH);
    put(floor1, F.rug(1.6, 1.3, PAL.fabricSand), R.bed2.x0 + 1.1, R.bed2.z0 + 1.25, 0, FH);
    put(floor1, F.bed(1.2, 2.0, PAL.fabricSand), R.bed3.x1 - 1.0, R.bed3.z0 + 1.25, -Math.PI / 2, FH);
    put(floor1, F.desk(), R.bed3.x0 + 0.36, R.bed3.z1 - 0.6, Math.PI / 2, FH);
  }
  // landing greenery
  put(floor1, F.plant(1.3), R.hall.x0 + 0.45, R.hall.z0 + 0.5, 0, FH);

  /* pendants + lamps */
  [[lx, lz], [dx, dz], [kx, kz]].forEach(([x, z]) => put(floor0, F.pendant(0.6), x, z, 0, FH - 0.06));
  [[1.8, R.master.z0 + 1.1], [b2x, b2z], [b3x, b3z], [hx, hz]].forEach(([x, z]) => put(floor1, F.pendant(0.5), x, z, 0, 2 * FH - 0.06));
  lampAt(floor0, lx, 2.5, lz); lampAt(floor0, dx, 2.5, dz); lampAt(floor0, kx, 2.5, kz);
  lampAt(floor1, mx, FH + 2.4, R.master.z0 + 1.2); lampAt(floor1, b2x, FH + 2.4, b2z); lampAt(floor1, b3x, FH + 2.4, b3z);
  lampAt(floor1, hx, FH + 2.4, hz);
  lampAt(floor1, (R.wc1.x0 + R.wc1.x1) / 2, FH + 2.4, (R.wc1.z0 + R.wc1.z1) / 2, 0xcfe8ff);

  /* labels */
  const gymVer = gymLike(version) || version === 'phase3';
  const b2Label = gymVer ? 'Gym & Kerja' : 'Kamar Tidur 2';
  const b3Label = gymVer ? 'Kamar Bayi' : 'Kamar Tidur 3';
  const diningLabel = version === 'newborn' ? 'Kamar Ibu & Bayi' : 'Ruang Makan';
  const backyardLab = (version === 'phase2' || version === 'phase3')
    ? [['Kamar', 1.0, 12.0, 1.6], ['Shower', 1.9, 13.9, 1.55], ['Gudang', 1.1, 15.0, 1.55],
       ['Laundry', 4.3, 11.5, 1.55], ['Taman', 3.6, 13.0, 1.6]]
    : [['Backyard', L.W / 2, (L.zEnc + L.zBL) / 2, 1.6]];
  const ph3lab = version === 'phase3'
    ? [['Sharing / Play', (R.play.x0 + R.play.x1) / 2, R.play.z0 + 2.2, 4.7],
       ['Lantai Kaca', (R.glass.x0 + R.glass.x1) / 2, (R.glass.z0 + R.glass.z1) / 2, 4.6]]
    : [];
  const lab = [
    ['Carport', L.W / 2, L.zCar - 1.6, 1.5], ['Ruang Tamu', lx, lz, 1.6], [diningLabel, dx, dz, 1.6],
    ['Dapur', kx, kz, 1.6], ['Toilet', (R.toilet.x0 + R.toilet.x1) / 2, (R.toilet.z0 + R.toilet.z1) / 2, 1.55],
    ...backyardLab,
    ['Kamar Tidur 1', mx, mz, 4.7], ['KM/WC 1', (R.wc1.x0 + R.wc1.x1) / 2, (R.wc1.z0 + R.wc1.z1) / 2, 4.6],
    ['KM/WC 2', (R.wc2.x0 + R.wc2.x1) / 2, (R.wc2.z0 + R.wc2.z1) / 2, 4.6], ['Hall', hx, hz, 4.6],
    [b2Label, b2x, b2z, 4.7], [b3Label, b3x, b3z, 4.7],
    ...ph3lab,
  ];
  // labels live in the un-mirrored scene → mirror only their position so the text stays readable
  lab.forEach(([t, x, z, y]) => { const s = makeLabel(t); s.position.set(L.center.cx - x, y, z - L.center.cz); labels.add(s); });
}

function rebuild() {
  // tear down old (house/furniture live under the mirrored `content`; labels stay upright in `scene`)
  if (model) {
    [model.house, model.floor0, model.floor1].forEach(g => { content.remove(g); disposeGroup(g); });
    scene.remove(model.labels); disposeGroup(model.labels);
  }
  const L = computeLayout(params, version);
  const { groups } = buildHouse(tex, L, version);
  const house = new THREE.Group(); Object.values(groups).forEach(g => house.add(g)); content.add(house);
  const floor0 = new THREE.Group(), floor1 = new THREE.Group();
  [floor0, floor1].forEach(g => { g.position.set(-L.center.cx, 0, -L.center.cz); content.add(g); });
  const labels = new THREE.Group(); scene.add(labels);
  const lights = [];
  furnish(L, floor0, floor1, labels, lights);

  // tag upper-storey structural pieces for the "Upper level" toggle
  const upperStructure = []; const bb = new THREE.Box3();
  groups.structure.children.concat(groups.wallsExt.children, groups.roof.children).forEach(o => { bb.setFromObject(o); if ((bb.min.y + bb.max.y) / 2 > 2.6) upperStructure.push(o); });

  // collect solid wall segments for walk-mode collision (tagged in house.js `place()`)
  const colliders = []; house.traverse(o => { if (o.isMesh && o.userData.collide) colliders.push(o); });
  content.updateMatrixWorld(true);   // so collider world matrices are current for the first raycast

  model = { house, groups, floor0, floor1, labels, lights, upperStructure, colliders, L };
  applyVisibility(); applyTime(); updateLegend();
  orbit.target.set(0, 1.4, 0);
}

function updateLegend() {
  let s;
  if (version === 'newborn')
    s = 'Lantai 1: carport · ruang tamu (kasur sofa) · kamar ibu &amp; bayi · dapur · toilet · backyard &nbsp;|&nbsp; Lantai 2: kamar utama · gym &amp; kerja · 2 KM/WC';
  else if (version === 'phase3')
    s = 'Lantai 1: carport · ruang tamu · <b>dapur &amp; ruang makan diperluas</b> · kamar · shower · gudang · laundry · taman (atap kaca) &nbsp;|&nbsp; Lantai 2 (penuh s/d belakang): kamar utama · kamar bayi · gym &amp; kerja · <b>sharing/play terbuka</b> (TV + game + lemari) dengan <b>lantai kaca</b> di atas taman · 2 KM/WC';
  else if (version === 'phase2')
    s = 'Lantai 1: carport · ruang tamu · toilet · <b>dapur &amp; ruang makan diperluas</b> (open-plan, dinding belakang dibongkar) &nbsp;|&nbsp; Backyard: kamar + perpustakaan · shower · laundry · gudang · taman terbuka &nbsp;|&nbsp; Lantai 2: kamar utama · gym &amp; kerja · kamar bayi · 2 KM/WC';
  else if (version === 'gym')
    s = 'Lantai 1: carport · ruang tamu · ruang makan · dapur · toilet · backyard &nbsp;|&nbsp; Lantai 2: kamar utama · gym &amp; kerja · kamar bayi · 2 KM/WC';
  else
    s = 'Lantai 1: carport · ruang tamu · ruang makan · dapur · toilet · backyard &nbsp;|&nbsp; Lantai 2: 3 kamar tidur · 2 KM/WC';
  $('legend').innerHTML = s;
}

/* ============================ visibility / time ============================ */
function applyVisibility() {
  if (!model) return;
  model.groups.roof.visible = $('roof').checked && $('upper').checked;
  model.groups.wallsExt.visible = $('walls').checked;
  model.labels.visible = $('labels').checked;
  model.floor1.visible = $('upper').checked;
  model.upperStructure.forEach(o => o.visible = $('upper').checked);
  $('roof').disabled = !$('upper').checked;
}
let night = false;
function applyTime() {
  if (night) {
    scene.background = skyNight; scene.fog = new THREE.Fog(0x0a0e1a, 28, 90);
    sun.intensity = 0.12; sun.color.set(0x3a4a6a); hemi.intensity = 0.12; renderer.toneMappingExposure = 1.1;
    model?.lights.forEach(l => l.intensity = l.color.getHex() === 0xcfe8ff ? 9 : 14);
  } else {
    scene.background = skyDay; scene.fog = new THREE.Fog(0xcfe0f0, 50, 130);
    // warmer, softer, slightly brighter daylight — the airy, evenly-lit look of glossy renders
    sun.intensity = 2.4; sun.color.set(0xfff3e0); hemi.intensity = 0.5; renderer.toneMappingExposure = 1.06;
    model?.lights.forEach(l => l.intensity = 0);
  }
}

/* ============================ UI ============================ */
$('roof').onchange = applyVisibility;
$('walls').onchange = applyVisibility;
$('upper').onchange = applyVisibility;
$('labels').onchange = applyVisibility;
$('night').onchange = e => { night = e.target.checked; applyTime(); };
$('rotate').onchange = e => orbit.autoRotate = e.target.checked;

// design version selector
const verSel = $('version');
VERSIONS.forEach(v => { const o = document.createElement('option'); o.value = v.id; o.textContent = v.name; verSel.appendChild(o); });
verSel.value = version;
verSel.onchange = e => { version = e.target.value; rebuild(); };

// collapsible control panel — keep the 3D view clear, especially on mobile
$('panelClose').onclick = () => document.body.classList.add('panel-collapsed');
$('panelOpen').onclick = () => document.body.classList.remove('panel-collapsed');
if (innerWidth < 760) document.body.classList.add('panel-collapsed');   // start hidden on small screens

// dimension sliders -> live rebuild (throttled to one per frame)
let pending = false;
function scheduleRebuild() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; rebuild(); }); }
const dimInputs = [
  ['dW', 'W', v => v], ['dCar', 'carport', v => v], ['dEnc', 'enclosed', v => v],
  ['dBack', 'backyardL', v => v], ['dFH', 'floorH', v => v],
];
dimInputs.forEach(([id, key]) => {
  const el = $(id); if (!el) return;
  const out = $(id + 'v');
  el.value = params[key];
  if (out) out.textContent = (+params[key]).toFixed(key === 'W' || key === 'floorH' ? 1 : 2) + ' m';
  el.addEventListener('input', () => {
    params[key] = parseFloat(el.value);
    if (key === 'backyardL') params.backyardR = Math.max(2, params.backyardL - 0.68);
    if (out) out.textContent = params[key].toFixed(key === 'W' || key === 'floorH' ? 1 : 2) + ' m';
    scheduleRebuild();
  });
});
$('dReset').onclick = () => {
  Object.assign(params, DEFAULTS);
  dimInputs.forEach(([id, key]) => { const el = $(id), out = $(id + 'v'); if (el) el.value = params[key]; if (out) out.textContent = (+params[key]).toFixed(key === 'W' || key === 'floorH' ? 1 : 2) + ' m'; });
  rebuild();
};

let flying = false;
function flyTo(pos, target) {
  if (fp.enabled) exitFP();
  const p0 = camera.position.clone(), t0 = orbit.target.clone(), p1 = dollied(pos, target).clone(), t1 = new THREE.Vector3(...target); let t = 0;
  flying = true;   // pause orbit.update() so it doesn't fight the animation
  (function a() {
    t = Math.min(1, t + 1 / 54);
    const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(p0, p1, e); orbit.target.lerpVectors(t0, t1, e); camera.lookAt(orbit.target);
    if (t < 1) requestAnimationFrame(a); else flying = false;
  })();
}
$('vIso').onclick = () => flyTo([12, 9, -12], [0, 1.4, 0]);
$('vTop').onclick = () => flyTo([0.01, 26, 0.1], [0, 0, 0]);
$('vFront').onclick = () => flyTo([0, 4.5, -17], [0, 3, -2]);
$('vSide').onclick = () => flyTo([18, 5, 0], [0, 3, 0]);

/* ============================ first-person ============================ */
const fp = new PointerLockControls(camera, canvas); fp.enabled = false;
const keys = {}; addEventListener('keydown', e => keys[e.code] = true); addEventListener('keyup', e => keys[e.code] = false);
const vel = new THREE.Vector3(); let savedCam = null, walkLevel = 0;
// --- walk-mode wall collision (axis-separated raycasts → slide along walls) ---
const PLAYER_R = 0.28;                       // keep this far off any wall
const PROBE_Y = [0.5, 1.5];                  // sample knee + chest height so low walls also block
const _ray = new THREE.Raycaster(); _ray.far = 4;
const _dir = new THREE.Vector3(), _org = new THREE.Vector3();
// can the walker move `d` metres along world axis ('x' or 'z') from (x,z) at level y0?
function axisClear(x, z, y0, axis, d) {
  if (!model?.colliders.length || d === 0) return true;
  const s = Math.sign(d), reach = Math.abs(d) + PLAYER_R;
  _dir.set(axis === 'x' ? s : 0, 0, axis === 'z' ? s : 0);
  for (const dy of PROBE_Y) {
    _org.set(x, y0 + dy, z); _ray.set(_org, _dir); _ray.far = reach;
    if (_ray.intersectObjects(model.colliders, false).length) return false;
  }
  return true;
}
function enterFP() {
  savedCam = { p: camera.position.clone(), t: orbit.target.clone() }; orbit.enabled = false;
  walkLevel = 0;
  const [lx, lz] = C(model.L.rooms.living);
  camera.position.set(model.L.center.cx - lx, 1.65, lz - model.L.center.cz);   // mirrored x
  camera.fov = WALK_FOV; camera.updateProjectionMatrix();   // natural lens for first-person
  fp.getObject().rotation.set(0, Math.PI, 0); fp.enabled = true; fp.lock(); $('fpHint').style.display = 'block';
}
function exitFP() { fp.enabled = false; fp.unlock(); orbit.enabled = true; camera.fov = ORBIT_FOV; camera.updateProjectionMatrix(); if (savedCam) { camera.position.copy(savedCam.p); orbit.target.copy(savedCam.t); } $('fpHint').style.display = 'none'; $('walk').checked = false; }
$('walk').onchange = e => e.target.checked ? enterFP() : exitFP();
fp.addEventListener('unlock', () => { if (fp.enabled) exitFP(); });

/* ============================ loop ============================ */
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); composer?.setSize(innerWidth, innerHeight); }

/* ============================ ambient occlusion (GTAO) ============================
   Soft contact shadows where walls meet floors and under furniture. Loaded via guarded
   dynamic import: if any postprocessing file is missing, composer stays null and the loop
   falls back to a plain render — the app never breaks, AO just won't be there. Toggleable. */
let composer = null, aoEnabled = true;
try {
  const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/GTAOPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  // subtle — rooms are small (5 m), so a short radius keeps AO to corners/contacts, not whole walls
  gtao.updateGtaoMaterial({ radius: 0.4, distanceExponent: 1, thickness: 1, scale: 1,
    samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4,
    radiusExponent: 1, rings: 2, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new OutputPass());   // tone-map + sRGB at the end (reads renderer exposure)
} catch (e) {
  console.warn('Ambient occlusion unavailable — rendering without it:', e);
  composer = null;
}
const aoBox = $('ao');
if (aoBox) { aoBox.disabled = !composer; aoBox.checked = !!composer; aoBox.onchange = e => aoEnabled = e.target.checked; }

addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (fp.enabled && model) {
    vel.x -= vel.x * 10 * dt; vel.z -= vel.z * 10 * dt;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    vel.z -= fwd * 19 * dt; vel.x -= str * 19 * dt;
    if (keys.KeyE) walkLevel = 1; if (keys.KeyQ) walkLevel = 0;     // E = upstairs, Q = downstairs
    const o = fp.getObject();
    const ox = o.position.x, oz = o.position.z, baseY = walkLevel * model.L.FH;
    fp.moveRight(-vel.x * dt); fp.moveForward(-vel.z * dt);   // candidate move (camera-local → world XZ)
    const dx = o.position.x - ox, dz = o.position.z - oz;
    o.position.x = ox; o.position.z = oz;                    // revert, then re-apply per axis if clear (wall slide)
    if (axisClear(ox, oz, baseY, 'x', dx)) o.position.x = ox + dx;
    if (axisClear(o.position.x, oz, baseY, 'z', dz)) o.position.z = oz + dz;
    o.position.y = 1.65 + walkLevel * model.L.FH;
    // backstop: never leave the building footprint even if a wall is missing
    o.position.x = THREE.MathUtils.clamp(o.position.x, -model.L.W / 2 + 0.35, model.L.W / 2 - 0.35);
    o.position.z = THREE.MathUtils.clamp(o.position.z, -model.L.center.cz + 0.5, model.L.zBL - model.L.center.cz - 0.5);
  } else if (!flying) orbit.update();
  sun.target.position.set(0, 1, 0);
  if (composer && aoEnabled) {
    try { composer.render(); }                 // never let an AO failure freeze the loop
    catch (e) { console.warn('AO render failed — disabling:', e); composer = null; renderer.render(scene, camera); }
  } else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

rebuild();
tick();
window.__scene = scene;
