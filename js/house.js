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

export function computeLayout(p = {}, version = 'default') {
  const P = { ...DEFAULTS, ...p };
  const W = P.W;
  const zCar = P.carport;
  const zEnc = P.carport + P.enclosed;
  const zF2 = Math.max(0.6, P.carport - P.overhang);
  const zBL = zEnc + P.backyardL;
  const zBR = zEnc + P.backyardR;
  const splitX = W * 0.668;
  const FH = P.floorH;
  const ph3 = version === 'phase3';
  // Phase 3 runs Lantai 2 back to the rear wall (straight, to the shorter right rear);
  // every other version keeps the short L2 that sits 80 cm back of the GF rear.
  const f2Back = ph3 ? zBR : zEnc + 0.8;
  // Lantai-2 depth program from the plan: master 3.23 m → 0.92 m landing → bedrooms (rest).
  const masterZ1 = zF2 + 3.23;
  const HALL = 0.92;                    // connecting landing depth = stair landing width
  const bedZ0 = masterZ1 + HALL;
  // a COMPACT spiral that fits the 0.92 m landing (≈0.92 m across), centred in the right strip
  const sr1 = Math.min(0.42, HALL / 2 - 0.04);
  const scx = splitX + (W - splitX) / 2;
  const scz = (masterZ1 + bedZ0) / 2;
  const SV = { x0: scx - sr1 - 0.05, x1: scx + sr1 + 0.05, z0: masterZ1, z1: bedZ0 };
  const rooms = {
    living:  { x0: 0, x1: splitX, z0: zCar, z1: zCar + P.enclosed * 0.51 },
    dining:  { x0: 0, x1: splitX, z0: zCar + P.enclosed * 0.51, z1: zEnc },
    toilet:  { x0: splitX, x1: W, z0: zCar, z1: zCar + 1.1 },
    kitchen: { x0: splitX, x1: W, z0: SV.z1, z1: zEnc },
    master:  { x0: 0, x1: W * 0.8, z0: zF2, z1: masterZ1 },
    wc1:     { x0: W * 0.8, x1: W, z0: zF2, z1: masterZ1 },     // ensuite, full master depth
    wc2:     { x0: 0, x1: 1.5, z0: masterZ1, z1: bedZ0 },
    hall:    { x0: 1.5, x1: W, z0: masterZ1, z1: bedZ0 },        // landing — stair arrives here
  };
  if (ph3) {
    // full second storey: two equal bedrooms stacked on the LEFT, one big OPEN sharing/play
    // area down the RIGHT (full depth); the rear of the play (over the Taman) is a glass floor
    const bX = W * 0.48, midZ = (bedZ0 + f2Back) / 2;
    rooms.bed3  = { x0: 0,  x1: bX, z0: bedZ0, z1: midZ };     // kamar bayi (left-front)
    rooms.bed2  = { x0: 0,  x1: bX, z0: midZ,  z1: f2Back };   // gym & kerja (left-back)
    rooms.play  = { x0: bX, x1: W,  z0: bedZ0, z1: f2Back };   // open sharing / play (right, full depth)
    rooms.glass = { x0: 2.6, x1: W, z0: 12.5,  z1: f2Back };   // glass-floor lounge over the Taman (part of the play)
  } else {
    rooms.bed2 = { x0: 0, x1: W * 0.628, z0: bedZ0, z1: f2Back };
    rooms.bed3 = { x0: W * 0.628, x1: W, z0: bedZ0, z1: f2Back };
  }
  return {
    P, W, zCar, zEnc, zF2, zBL, zBR, splitX, FH, SV, f2Back,
    spiral: { x: scx, z: scz, r1: sr1 },
    center: { cx: W / 2, cz: zBL / 2 },
    rooms,
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

export function buildHouse(textures = {}, L, version = 'default') {
  L = L || computeLayout();
  const TEX = textures;
  const { W, zCar, zEnc, zF2, zBL, zBR, splitX, FH, SV, f2Back } = L;
  const X0 = 0, X1 = W;
  // Phase 2 breaks the rear wall and pushes the dining/kitchen ~1.5 m into the
  // backyard (open-plan). gfBack = the conditioned ground floor's new rear line.
  const ph3 = version === 'phase3';
  const ph2 = version === 'phase2' || ph3;   // Phase 3 reuses the Phase 2 ground floor (annex)
  const gfBack = ph2 ? zEnc + 1.5 : zEnc;
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
  slab(groups.structure, X0, X1, 0, gfBack, 0.0, mat(0xb6b3ab, { rough: 0.9 }));
  if (ph2) {
    // Phase 2 renovated backyard. LEFT column = kamar → shower → gudang (very back, same
    // width as kamar/shower). RIGHT = laundry (kept) + an open Taman that runs to the very back.
    const bedR = 2.6, kmrB = 13.4, shB = 14.4, lndR = 3.6, wetB = 12.5;
    finishFloor(groups.grounds, X0, bedR, gfBack, kmrB, 0.0, TEX.wood);        // kamar
    finishFloor(groups.grounds, X0, bedR, kmrB, shB, 0.0, TEX.tileBath);       // shower
    finishFloor(groups.grounds, X0, bedR, shB, zBL, 0.0, TEX.tile);            // gudang (deepest, left)
    finishFloor(groups.grounds, lndR, X1, gfBack, wetB, 0.0, TEX.tile);        // laundry (kept)
    finishFloor(groups.grounds, bedR, lndR, gfBack, wetB, 0.0, TEX.paving);    // garden strip beside laundry
    finishFloor(groups.grounds, bedR, X1, wetB, wetB + 1.0, 0.0, TEX.paving);  // garden patio behind laundry
    finishFloor(groups.grounds, bedR, X1, wetB + 1.0, zBR, 0.0, TEX.grass);    // garden lawn to the back
    finishFloor(groups.grounds, bedR, 3.8, zBR, zBL, 0.0, TEX.grass);          // garden, deeper-left
  } else {
    // dry tropical garden: cemented yard with pebble planting beds along the two side walls
    finishFloor(groups.grounds, X0, X1, zEnc, zBL, 0.0, TEX.cement);              // cement base
    finishFloor(groups.grounds, X0, 0.9, zEnc + 2.5, zBL, 0.0, TEX.pebbles);      // left planting bed
    finishFloor(groups.grounds, X1 - 0.9, X1, zEnc + 2.5, zBR, 0.0, TEX.pebbles); // right planting bed
  }
  const f2m = mat(0xcaa46f, { rough: 0.85 });
  if (ph3) {
    // full L2 slab to the rear, but leave the glass-floor room (over the Taman) open in the slab
    const gr = L.rooms.glass, rz = gr.z0;
    slab(groups.structure, X0, SV.x0, zF2, rz, FH, f2m);
    slab(groups.structure, SV.x1, X1, zF2, rz, FH, f2m);
    slab(groups.structure, SV.x0, SV.x1, zF2, SV.z0, FH, f2m);
    slab(groups.structure, SV.x0, SV.x1, SV.z1, rz, FH, f2m);
    slab(groups.structure, X0, gr.x0, rz, f2Back, FH, f2m);           // left-of-glass back floor (gym + play, solid)
  } else {
    slab(groups.structure, X0, SV.x0, zF2, f2Back, FH, f2m);
    slab(groups.structure, SV.x1, X1, zF2, f2Back, FH, f2m);
    slab(groups.structure, SV.x0, SV.x1, zF2, SV.z0, FH, f2m);
    slab(groups.structure, SV.x0, SV.x1, SV.z1, f2Back, FH, f2m);
  }
  slab(groups.roof, X0, X1, zF2, f2Back, 2 * FH, mat(0xd6d2c8, { rough: 0.9 }));

  /* finishes */
  finishFloor(groups.structure, X0, splitX, zCar, gfBack, 0, TEX.wood);
  finishFloor(groups.structure, splitX, X1, zCar, gfBack, 0, TEX.tile);
  // the extension reaches 1.5 m back; its rear 0.7 m sticks out past the L2 floor → roof it at FH
  if (ph2) slab(groups.structure, X0, X1, f2Back, gfBack, FH, mat(0xcaa46f, { rough: 0.85 }));
  if (ph3) {
    const gr = L.rooms.glass, rz = gr.z0;
    finishFloor(groups.structure, X0, SV.x0, zF2, rz, FH, TEX.wood);
    finishFloor(groups.structure, SV.x1, X1, zF2, rz, FH, TEX.wood);
    finishFloor(groups.structure, SV.x0, SV.x1, SV.z1, rz, FH, TEX.wood);
    finishFloor(groups.structure, X0, gr.x0, rz, f2Back, FH, TEX.wood);   // left-of-glass back floor
    // glass floor over the Taman — see-through to the garden, sealed so no one can fall
    groups.structure.add(box(gr.x1 - gr.x0 - 0.14, 0.04, gr.z1 - gr.z0 - 0.14, glassMat(),
      { pos: [(gr.x0 + gr.x1) / 2, FH - 0.02, (gr.z0 + gr.z1) / 2], cast: false, receive: false }));
  } else {
    finishFloor(groups.structure, X0, SV.x0, zF2, f2Back, FH, TEX.wood);
    finishFloor(groups.structure, SV.x1, X1, zF2, f2Back, FH, TEX.wood);
    finishFloor(groups.structure, SV.x0, SV.x1, SV.z1, f2Back, FH, TEX.wood);
  }
  finishFloor(groups.structure, L.rooms.wc1.x0, X1, L.rooms.wc1.z0, L.rooms.wc1.z1, FH, TEX.tileBath);
  finishFloor(groups.structure, L.rooms.wc2.x0, L.rooms.wc2.x1, L.rooms.wc2.z0, L.rooms.wc2.z1, FH, TEX.tileBath);
  finishFloor(groups.grounds, X0, X1, 0, zCar, 0, TEX.paving);
  ceiling(groups.structure, X0, X1, zCar, gfBack, FH - 0.02);
  ceiling(groups.structure, X0, X1, zF2, f2Back, 2 * FH - 0.02);

  /* ===== GROUND walls ===== */
  wall(groups.wallsExt, 'x', zCar, X0, X1, 0, FH, [
    { from: 0.7, to: 1.6, sill: 0.9, head: 2.2, kind: 'window' },   // window & door swapped
    { from: 2.0, to: 2.9, sill: 0, head: 2.2, kind: 'door' },
  ], extMat);
  if (ph2) {
    // back wall pushed out to gfBack; doors dining→kamar, kitchen→taman (garden), kitchen→laundry
    wall(groups.wallsExt, 'x', gfBack, X0, X1, 0, FH, [
      { from: 0.7, to: 1.5, sill: 0, head: 2.1, kind: 'door' },
      { from: 2.75, to: 3.45, sill: 0, head: 2.1, kind: 'door' },
      { from: 3.9, to: 4.6, sill: 0, head: 2.1, kind: 'door' },
    ], extMat);
  } else {
    wall(groups.wallsExt, 'x', zEnc, X0, X1, 0, FH, [
      { from: 0.7, to: 1.6, sill: 0, head: 2.2, kind: 'door' },       // backyard door on the left (swapped)
      { from: 2.0, to: 3.3, sill: 0.2, head: 2.3, kind: 'window' },   // window to its right, clear of kitchen
    ], extMat);
  }
  // side walls are solid — windows only on front & back faces (extended to gfBack in Phase 2)
  wall(groups.wallsExt, 'z', X0, zCar, gfBack, 0, FH, [], extMat);
  wall(groups.wallsExt, 'z', X1, zCar, gfBack, 0, FH, [], extMat);
  // partitions —
  // entry → door on the right into the powder/toilet room (door in the living|toilet partition).
  // Behind the toilet the partition stops, so the staircase is reached openly from the left (no door).
  wall(groups.structure, 'z', splitX, zCar, L.rooms.toilet.z1, 0, FH, [
    { from: zCar + 0.28, to: zCar + 0.88, sill: 0, head: 2.05, kind: 'door' },
  ], intMat);
  // toilet back wall (solid) — encloses the powder room from the stair
  wall(groups.structure, 'x', L.rooms.toilet.z1, splitX, X1, 0, FH, [], intMat);
  // wall separating the staircase (with the fridge niche) from the kitchen
  wall(groups.structure, 'x', L.rooms.kitchen.z0, splitX, X1, 0, FH, [], intMat);

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
  // bZ = the landing's rear edge (= bedZ0). Use bed3.z0, which equals bedZ0 in every version
  // (bed2.z0 differs in Phase 3, where bed2 is the rear bedroom — using it ran the KM/WC 2
  // wall back through the child bedroom).
  const mb = L.rooms.master, w2 = L.rooms.wc2, b3 = L.rooms.bed3, mZ = mb.z1, bZ = L.rooms.bed3.z0;
  // master ↔ ensuite (KM/WC 1)
  wall(groups.structure, 'z', mb.x1, zF2, mZ, y2, FH, [
    { from: zF2 + 0.7, to: zF2 + 1.3, sill: 0, head: 2.05, kind: 'door' },
  ], intMat);
  // front-band rear wall (master / wc1  ↔  hall / wc2) — door from the landing into the master
  wall(groups.structure, 'x', mZ, X0, X1, y2, FH, [
    { from: 2.0, to: 2.7, sill: 0, head: 2.1, kind: 'door' },
  ], intMat);
  // KM/WC 2 ↔ landing (wall span is only the 0.92 m landing depth — keep the door inside it)
  wall(groups.structure, 'z', w2.x1, mZ, bZ, y2, FH, [
    { from: mZ + 0.18, to: mZ + 0.78, sill: 0, head: 2.05, kind: 'door' },
  ], intMat);
  if (ph3) {
    // bedrooms (x0..bX) on the left, one OPEN play area (x>bX) on the right
    const bX = L.rooms.bed3.x1, bz0 = L.rooms.bed3.z0, midZ = L.rooms.bed2.z0;
    // bedroom fronts + KM/WC 2 back wall (encloses the toilet); the play stays open to the landing
    wall(groups.structure, 'x', bz0, X0, bX, y2, FH, [], intMat);
    // play | bedrooms — a door into each bedroom
    wall(groups.structure, 'z', bX, bz0, f2Back, y2, FH, [
      { from: bz0 + 1.2, to: bz0 + 1.9, sill: 0, head: 2.1, kind: 'door' },   // → kamar bayi
      { from: midZ + 1.2, to: midZ + 1.9, sill: 0, head: 2.1, kind: 'door' }, // → gym & kerja
    ], intMat);
    // kamar bayi ↔ gym divider (the play area itself has no internal walls)
    wall(groups.structure, 'x', midZ, X0, bX, y2, FH, [], intMat);
  } else {
    // landing rear wall (hall / wc2  ↔  bed 2 / bed 3) — doors into both bedrooms, both reached
    // from the landing strip left of the stair void
    wall(groups.structure, 'x', bZ, X0, X1, y2, FH, [
      { from: 1.85, to: 2.5, sill: 0, head: 2.1, kind: 'door' },    // → bedroom 2
      { from: 3.2, to: 3.68, sill: 0, head: 2.1, kind: 'door' },    // → bedroom 3
    ], intMat);
    // bedroom 2 ↔ bedroom 3 divider
    wall(groups.structure, 'z', b3.x0, bZ, f2Back, y2, FH, [], intMat);
  }

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
  // Phase 3 backyard is two-storey, so its side + rear walls run full height to carry the L2
  const ybh = ph3 ? FH : YARD_H, bwmat = ph3 ? extMat : gmat;
  wall(groups.wallsExt, 'z', X0, gfBack, zBL, 0, ybh, [], bwmat);
  wall(groups.wallsExt, 'z', X1, gfBack, zBR, 0, ybh, [], bwmat);
  const dx = W, dz = zBR - zBL;
  const back = box(Math.hypot(dx, dz), ybh, T, bwmat, { pos: [W / 2, ybh / 2, (zBL + zBR) / 2] });
  back.rotation.y = -Math.atan2(dz, dx); groups.wallsExt.add(back);
  groups.wallsExt.add(box(0.25, 1.4, 0.25, gmat, { pos: [0.2, 0.7, 0.1] }));
  groups.wallsExt.add(box(0.25, 1.4, 0.25, gmat, { pos: [W - 0.2, 0.7, 0.1] }));

  /* ===== Phase 2 backyard: left column (kamar/shower/gudang) + laundry + open Taman ===== */
  if (ph2) {
    const bedR = 2.6, kmrB = 13.4, shB = 14.4, lndR = 3.6, wetB = 12.5, gudB = 15.25;
    const h = ph3 ? FH : YARD_H;   // Phase 3: full-height annex (L2 floor is its ceiling)
    const door = (from, to) => ({ from, to, sill: 0, head: 2.05, kind: 'door' });
    // left column internal walls (stacked front→back: kamar, shower, gudang)
    wall(groups.structure, 'x', kmrB, X0, bedR, 0, h, [door(0.45, 1.05)], intMat);  // kamar | shower (ensuite door)
    wall(groups.structure, 'x', shB, X0, bedR, 0, h, [], intMat);                   // shower | gudang (solid)
    // column divider: left rooms | open Taman, with doors kamar→taman and gudang→taman
    wall(groups.structure, 'z', bedR, gfBack, gudB, 0, h, [door(11.4, 12.0), door(14.6, 15.1)], intMat);
    // laundry box (right-front): door to the Taman strip, solid at the back
    wall(groups.structure, 'z', lndR, gfBack, wetB, 0, h, [door(11.4, 12.0)], intMat); // laundry | taman strip
    wall(groups.structure, 'x', wetB, lndR, X1, 0, h, [], intMat);                     // laundry | taman back (solid)
    if (!ph3) {
      // single-storey annex roofs (Phase 2 only — in Phase 3 the L2 floor is the ceiling)
      const rmat = mat(0xd6d2c8, { rough: 0.9 });
      slab(groups.roof, X0, bedR, gfBack, zBL, h + SLAB, rmat);    // roof over the left column, to the rear wall
      slab(groups.roof, lndR, X1, gfBack, wetB, h + SLAB, rmat);   // roof over the laundry; Taman open
    }
  }

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
