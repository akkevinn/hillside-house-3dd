// house.js — architectural shell, fully derived from a computed layout so the
// model can be rebuilt live when dimensions change. Units = metres.
import * as THREE from 'three';
import { box, mat, spiralStair, PAL } from './furniture.js';

export const DEFAULTS = {
  W: 5.0,          // width
  carport: 4.5,    // carport / front depth
  enclosed: 4.9,   // enclosed ground-floor depth (living/dining/kitchen)
  backyardL: 6.41, // backyard depth, left
  backyardR: 5.73, // backyard depth, right  (slanted back wall)
  floorH: 3.0,     // floor-to-floor
  overhang: 1.6,   // how far Lantai 2 cantilevers over the carport
};
export const CONST = { T: 0.13, SLAB: 0.22, YARD_H: 2.6 };

export function computeLayout(p = {}) {
  const P = { ...DEFAULTS, ...p };
  const W = P.W;
  const zCar = P.carport;
  const zEnc = P.carport + P.enclosed;
  const zF2 = Math.max(0.6, P.carport - P.overhang);
  const zBL = zEnc + P.backyardL;
  const zBR = zEnc + P.backyardR;
  const splitX = W * 0.668;
  const FH = P.floorH;
  const f2Back = zEnc + 0.8;            // Lantai 2 rear sits 80 cm back of the GF rear
  // Lantai-2 depth program from the plan: master 3.23 m → 0.92 m landing → bedrooms (rest).
  const masterZ1 = zF2 + 3.23;
  const HALL = 0.92;                    // connecting landing depth = stair landing width
  const bedZ0 = masterZ1 + HALL;
  // a COMPACT spiral that fits the 0.92 m landing (≈0.92 m across), centred in the right strip
  const sr1 = Math.min(0.42, HALL / 2 - 0.04);
  const scx = splitX + (W - splitX) / 2;
  const scz = (masterZ1 + bedZ0) / 2;
  const SV = { x0: scx - sr1 - 0.05, x1: scx + sr1 + 0.05, z0: masterZ1, z1: bedZ0 };
  return {
    P, W, zCar, zEnc, zF2, zBL, zBR, splitX, FH, SV, f2Back,
    spiral: { x: scx, z: scz, r1: sr1 },
    center: { cx: W / 2, cz: zBL / 2 },
    rooms: {
      living:  { x0: 0, x1: splitX, z0: zCar, z1: zCar + P.enclosed * 0.51 },
      dining:  { x0: 0, x1: splitX, z0: zCar + P.enclosed * 0.51, z1: zEnc },
      toilet:  { x0: splitX, x1: W, z0: zCar, z1: zCar + 1.1 },
      kitchen: { x0: splitX, x1: W, z0: SV.z1, z1: zEnc },
      master:  { x0: 0, x1: W * 0.8, z0: zF2, z1: masterZ1 },
      wc1:     { x0: W * 0.8, x1: W, z0: zF2, z1: masterZ1 },     // ensuite, full master depth
      wc2:     { x0: 0, x1: 1.5, z0: masterZ1, z1: bedZ0 },
      hall:    { x0: 1.5, x1: W, z0: masterZ1, z1: bedZ0 },        // landing — stair arrives here
      bed2:    { x0: 0, x1: W * 0.628, z0: bedZ0, z1: f2Back },
      bed3:    { x0: W * 0.628, x1: W, z0: bedZ0, z1: f2Back },
    },
  };
}

/* ---------------------------------------------------------- wall builder */
const { T, SLAB, YARD_H } = CONST;
const glassMat = () => new THREE.MeshPhysicalMaterial({
  color: 0xdff0f5, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.26,
  side: THREE.DoubleSide, envMapIntensity: 1.4,
});
const frameMat = mat(0x2c3034, { metal: 0.6, rough: 0.4 });

function wall(group, axis, fixed, a, b, y0, height, openings = [], material) {
  const wm = material || mat(PAL.wallWhite, { rough: 0.95 });
  const place = (lo, hi, yLo, yHi) => {
    if (hi - lo < 0.002 || yHi - yLo < 0.002) return;
    const len = hi - lo, h = yHi - yLo, mid = (lo + hi) / 2, ym = (yLo + yHi) / 2;
    group.add(axis === 'x' ? box(len, h, T, wm, { pos: [mid, ym, fixed] })
                           : box(T, h, len, wm, { pos: [fixed, ym, mid] }));
  };
  // clamp openings into the wall span; drop degenerate ones
  const ops = openings.map(o => ({ ...o, from: Math.max(a + 0.18, o.from), to: Math.min(b - 0.18, o.to) }))
    .filter(o => o.to - o.from > 0.35).sort((p, q) => p.from - q.from);
  let cur = a;
  for (const op of ops) {
    place(cur, op.from, y0, y0 + height);
    if (op.sill > 0) place(op.from, op.to, y0, y0 + op.sill);
    if (op.head < height) place(op.from, op.to, y0 + op.head, y0 + height);
    if (op.kind === 'window') {
      const len = op.to - op.from, h = op.head - op.sill, mid = (op.from + op.to) / 2, ym = y0 + (op.sill + op.head) / 2;
      group.add(axis === 'x' ? box(len - 0.07, h - 0.07, 0.025, glassMat(), { pos: [mid, ym, fixed], cast: false })
                             : box(0.025, h - 0.07, len - 0.07, glassMat(), { pos: [fixed, ym, mid], cast: false }));
      const bw = 0.05, f = (w_, h_, d_, x_, y_, z_) => group.add(box(w_, h_, d_, frameMat, { pos: [x_, y_, z_], cast: false }));
      if (axis === 'x') { f(len, bw, 0.07, mid, y0 + op.sill + bw / 2, fixed); f(len, bw, 0.07, mid, y0 + op.head - bw / 2, fixed); f(bw, h, 0.07, op.from + bw / 2, ym, fixed); f(bw, h, 0.07, op.to - bw / 2, ym, fixed); f(bw * 0.6, h, 0.07, mid, ym, fixed); }
      else { f(0.07, bw, len, fixed, y0 + op.sill + bw / 2, mid); f(0.07, bw, len, fixed, y0 + op.head - bw / 2, mid); f(0.07, h, bw, fixed, ym, op.from + bw / 2); f(0.07, h, bw, fixed, ym, op.to - bw / 2); f(0.07, h, bw * 0.6, fixed, ym, mid); }
    } else if (op.kind === 'door') {
      const len = op.to - op.from, mid = (op.from + op.to) / 2, dh = op.head, leaf = mat(PAL.woodMid, { rough: 0.6 });
      group.add(axis === 'x' ? box(len - 0.06, dh - 0.04, 0.04, leaf, { pos: [mid, y0 + dh / 2, fixed] })
                             : box(0.04, dh - 0.04, len - 0.06, leaf, { pos: [fixed, y0 + dh / 2, mid] }));
    }
    cur = op.to;
  }
  place(cur, b, y0, y0 + height);
}

function slab(group, x0, x1, z0, z1, yTop, material) {
  if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
  group.add(box(x1 - x0, SLAB, z1 - z0, material || mat(PAL.concrete, { rough: 0.9 }),
    { pos: [(x0 + x1) / 2, yTop - SLAB / 2, (z0 + z1) / 2], cast: false }));
}
function finishFloor(group, x0, x1, z0, z1, y, texture, color = 0xffffff) {
  if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
  let map = null;
  if (texture) { map = texture.clone(); map.needsUpdate = true; map.repeat.set(x1 - x0, z1 - z0); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    new THREE.MeshStandardMaterial({ map, color, roughness: 0.7, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y + 0.01, (z0 + z1) / 2); m.receiveShadow = true;
  group.add(m);
}
function ceiling(group, x0, x1, z0, z1, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat(0xf3f0ea, { rough: 1 }));
  m.rotation.x = Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true;
  group.add(m);
}

export function buildHouse(textures = {}, L) {
  L = L || computeLayout();
  const TEX = textures;
  const { W, zCar, zEnc, zF2, zBL, zBR, splitX, FH, SV, f2Back } = L;
  const X0 = 0, X1 = W;
  const groups = { structure: new THREE.Group(), wallsExt: new THREE.Group(), roof: new THREE.Group(), grounds: new THREE.Group() };

  const extMat = mat(PAL.wallWhite, { rough: 0.95 }); if (TEX.wall) extMat.map = TEX.wall;
  const intMat = mat(0xeae3d6, { rough: 0.95 });

  /* lot + grass */
  const lotMat = new THREE.MeshStandardMaterial({ map: TEX.grass || null, color: 0x84a05a, roughness: 1 });
  if (TEX.grass) TEX.grass.repeat.set(16, 24);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(28, Math.max(40, zBL + 12)), lotMat);
  lot.rotation.x = -Math.PI / 2; lot.position.set(W / 2, -0.03, zBL / 2); lot.receiveShadow = true;
  groups.grounds.add(lot);

  /* slabs */
  slab(groups.structure, X0, X1, 0, zEnc, 0.0, mat(0xb6b3ab, { rough: 0.9 }));
  // backyard: lawn for the open space + a small paved utility pad by the service door
  finishFloor(groups.grounds, X0, X1, zEnc, zBL, 0.0, TEX.grass);
  finishFloor(groups.grounds, 0.15, 2.6, zEnc + 0.1, zEnc + 2.2, 0.05, TEX.paving);
  const f2m = mat(0xcaa46f, { rough: 0.85 });
  slab(groups.structure, X0, SV.x0, zF2, f2Back, FH, f2m);
  slab(groups.structure, SV.x1, X1, zF2, f2Back, FH, f2m);
  slab(groups.structure, SV.x0, SV.x1, zF2, SV.z0, FH, f2m);
  slab(groups.structure, SV.x0, SV.x1, SV.z1, f2Back, FH, f2m);
  slab(groups.roof, X0, X1, zF2, f2Back, 2 * FH, mat(0xd6d2c8, { rough: 0.9 }));

  /* finishes */
  finishFloor(groups.structure, X0, splitX, zCar, zEnc, 0, TEX.wood);
  finishFloor(groups.structure, splitX, X1, zCar, zEnc, 0, TEX.tile);
  finishFloor(groups.structure, X0, SV.x0, zF2, f2Back, FH, TEX.wood);
  finishFloor(groups.structure, SV.x1, X1, zF2, f2Back, FH, TEX.wood);
  finishFloor(groups.structure, SV.x0, SV.x1, SV.z1, f2Back, FH, TEX.wood);
  finishFloor(groups.structure, L.rooms.wc1.x0, X1, L.rooms.wc1.z0, L.rooms.wc1.z1, FH, TEX.tileBath);
  finishFloor(groups.structure, L.rooms.wc2.x0, L.rooms.wc2.x1, L.rooms.wc2.z0, L.rooms.wc2.z1, FH, TEX.tileBath);
  finishFloor(groups.grounds, X0, X1, 0, zCar, 0, TEX.paving);
  ceiling(groups.structure, X0, X1, zCar, zEnc, FH - 0.02);
  ceiling(groups.structure, X0, X1, zF2, f2Back, 2 * FH - 0.02);

  /* ===== GROUND walls ===== */
  wall(groups.wallsExt, 'x', zCar, X0, X1, 0, FH, [
    { from: 0.7, to: 1.6, sill: 0.9, head: 2.2, kind: 'window' },   // window & door swapped
    { from: 2.0, to: 2.9, sill: 0, head: 2.2, kind: 'door' },
  ], extMat);
  wall(groups.wallsExt, 'x', zEnc, X0, X1, 0, FH, [
    { from: 0.7, to: 1.6, sill: 0, head: 2.2, kind: 'door' },       // backyard door on the left (swapped)
    { from: 2.0, to: 3.3, sill: 0.2, head: 2.3, kind: 'window' },   // window to its right, clear of kitchen
  ], extMat);
  // side walls are solid — windows only on front & back faces
  wall(groups.wallsExt, 'z', X0, zCar, zEnc, 0, FH, [], extMat);
  wall(groups.wallsExt, 'z', X1, zCar, zEnc, 0, FH, [], extMat);
  // partitions —
  // entry → door on the right into the powder/toilet room (door in the living|toilet partition).
  // Behind the toilet the partition stops, so the staircase is reached openly from the left (no door).
  wall(groups.structure, 'z', splitX, zCar, L.rooms.toilet.z1, 0, FH, [
    { from: zCar + 0.28, to: zCar + 0.88, sill: 0, head: 2.05, kind: 'door' },
  ], intMat);
  // toilet back wall (solid) — encloses the powder room from the stair
  wall(groups.structure, 'x', L.rooms.toilet.z1, splitX, X1, 0, FH, [], intMat);

  /* ===== FLOOR 2 walls ===== */
  const y2 = FH;
  wall(groups.wallsExt, 'x', zF2, X0, X1, y2, FH, [
    { from: 0.7, to: 2.0, sill: 0.9, head: 2.3, kind: 'window' },
    { from: 2.5, to: 3.6, sill: 0.9, head: 2.3, kind: 'window' },
  ], extMat);
  wall(groups.wallsExt, 'x', f2Back, X0, X1, y2, FH, [
    { from: 0.6, to: 2.2, sill: 0.9, head: 2.3, kind: 'window' },
    { from: W - 1.7, to: W - 0.4, sill: 0.9, head: 2.3, kind: 'window' },
  ], extMat);
  // side walls solid (windows only front & back); left/right extend to the deeper rear
  wall(groups.wallsExt, 'z', X0, zF2, f2Back, y2, FH, [], extMat);
  wall(groups.wallsExt, 'z', X1, zF2, f2Back, y2, FH, [], extMat);
  // F2 partitions — a central landing (where the stair arrives) with doors to
  // the master bedroom, KM/WC 2, bedroom 2 and bedroom 3. KM/WC 1 is the master ensuite.
  const mb = L.rooms.master, w2 = L.rooms.wc2, b3 = L.rooms.bed3, mZ = mb.z1, bZ = L.rooms.bed2.z0;
  // master ↔ ensuite (KM/WC 1)
  wall(groups.structure, 'z', mb.x1, zF2, mZ, y2, FH, [
    { from: zF2 + 0.7, to: zF2 + 1.3, sill: 0, head: 2.05, kind: 'door' },
  ], intMat);
  // front-band rear wall (master / wc1  ↔  hall / wc2) — door from the landing into the master
  wall(groups.structure, 'x', mZ, X0, X1, y2, FH, [
    { from: 2.0, to: 2.7, sill: 0, head: 2.1, kind: 'door' },
  ], intMat);
  // KM/WC 2 ↔ landing
  wall(groups.structure, 'z', w2.x1, mZ, bZ, y2, FH, [
    { from: mZ + 0.45, to: mZ + 1.05, sill: 0, head: 2.05, kind: 'door' },
  ], intMat);
  // landing rear wall (hall / wc2  ↔  bed 2 / bed 3) — doors into both bedrooms, both reached
  // from the landing strip left of the stair void
  wall(groups.structure, 'x', bZ, X0, X1, y2, FH, [
    { from: 1.85, to: 2.5, sill: 0, head: 2.1, kind: 'door' },    // → bedroom 2
    { from: 3.2, to: 3.68, sill: 0, head: 2.1, kind: 'door' },    // → bedroom 3
  ], intMat);
  // bedroom 2 ↔ bedroom 3 divider
  wall(groups.structure, 'z', b3.x0, bZ, f2Back, y2, FH, [], intMat);

  /* ===== spiral stair ===== */
  // compact spiral: more sweep/steps to climb within the tight 0.92 m landing
  const stair = spiralStair({ r0: 0.1, r1: L.spiral.r1, rise: FH, steps: 18, a0: -Math.PI / 2, sweep: Math.PI * 2.2 });
  stair.position.set(L.spiral.x, 0, L.spiral.z);
  groups.structure.add(stair);
  // stairwell guard rails around the three open edges (front edge is the master rear wall)
  groups.structure.add(box(T, 1.0, SV.z1 - SV.z0, mat(PAL.wallWhite), { pos: [SV.x0, FH + 0.5, (SV.z0 + SV.z1) / 2] }));
  groups.structure.add(box(T, 1.0, SV.z1 - SV.z0, mat(PAL.wallWhite), { pos: [SV.x1, FH + 0.5, (SV.z0 + SV.z1) / 2] }));
  groups.structure.add(box(SV.x1 - SV.x0, 1.0, T, mat(PAL.wallWhite), { pos: [(SV.x0 + SV.x1) / 2, FH + 0.5, SV.z1] }));

  /* ===== boundary / garden walls ===== */
  const gmat = mat(PAL.wallWarm, { rough: 0.95 }); if (TEX.wall) gmat.map = TEX.wall;
  wall(groups.wallsExt, 'z', X0, 0, zF2, 0, YARD_H, [], gmat);
  wall(groups.wallsExt, 'z', X1, 0, zF2, 0, YARD_H, [], gmat);
  wall(groups.wallsExt, 'z', X0, zEnc, zBL, 0, YARD_H, [], gmat);
  wall(groups.wallsExt, 'z', X1, zEnc, zBR, 0, YARD_H, [], gmat);
  const dx = W, dz = zBR - zBL;
  const back = box(Math.hypot(dx, dz), YARD_H, T, gmat, { pos: [W / 2, YARD_H / 2, (zBL + zBR) / 2] });
  back.rotation.y = -Math.atan2(dz, dx); groups.wallsExt.add(back);
  groups.wallsExt.add(box(0.25, 1.4, 0.25, gmat, { pos: [0.2, 0.7, 0.1] }));
  groups.wallsExt.add(box(0.25, 1.4, 0.25, gmat, { pos: [W - 0.2, 0.7, 0.1] }));

  /* ===== carport columns + roof parapet ===== */
  [[0.2, zF2], [W - 0.2, zF2]].forEach(([x, z]) =>
    groups.structure.add(box(0.22, FH, 0.22, mat(PAL.concrete, { rough: 0.9 }), { pos: [x, FH / 2, z] })));
  const ph = 0.45, pp = (x0, x1, z0, z1) => {
    groups.roof.add(box(x1 - x0, ph, T, mat(PAL.wallWhite), { pos: [(x0 + x1) / 2, 2 * FH + ph / 2, z0] }));
    groups.roof.add(box(x1 - x0, ph, T, mat(PAL.wallWhite), { pos: [(x0 + x1) / 2, 2 * FH + ph / 2, z1] }));
    groups.roof.add(box(T, ph, z1 - z0, mat(PAL.wallWhite), { pos: [x0, 2 * FH + ph / 2, (z0 + z1) / 2] }));
    groups.roof.add(box(T, ph, z1 - z0, mat(PAL.wallWhite), { pos: [x1, 2 * FH + ph / 2, (z0 + z1) / 2] }));
  };
  pp(X0, X1, zF2, f2Back);

  // centre on origin
  const { cx, cz } = L.center;
  Object.values(groups).forEach(g => { g.position.x -= cx; g.position.z -= cz; });
  return { groups, L };
}
