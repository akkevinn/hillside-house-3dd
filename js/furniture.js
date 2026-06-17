// furniture.js — a small library of furniture & fixtures built from primitives.
// Every factory returns a THREE.Group whose local origin sits on the floor (y=0),
// centered on the footprint, so callers just set group.position.
import * as THREE from 'three';

/* ---------------------------------------------------------------- palette */
export const PAL = {
  wallWhite: 0xf4f1ea,
  wallWarm:  0xe9e2d4,
  floorWood: 0xb5895c,
  floorWood2:0x8a6440,
  floorTile: 0xe7e7e2,
  concrete:  0xcfcdc7,
  woodDark:  0x5a3d28,
  woodMid:   0x8a5a36,
  woodLight: 0xc9a673,
  fabricBlue:0x4a6075,
  fabricSage:0x7c8a6a,
  fabricSand:0xc9b79c,
  charcoal:  0x33373b,
  cream:     0xede6d8,
  green:     0x4f7a4a,
  greenDk:   0x355f33,
  steel:     0xb8bdc2,
  glass:     0x9fc3d6,
  black:     0x1c1d1f,
  gold:      0xc9a24a,
  terracotta:0xb1573a,
};

/* ------------------------------------------------------------- primitives */
export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.85,
    metalness: o.metal ?? 0.0,
    transparent: o.opacity != null,
    opacity: o.opacity ?? 1,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
}

export function box(w, h, d, color, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color.isMaterial ? color : mat(color, o));
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  return m;
}

export function cyl(rt, rb, h, color, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20), color.isMaterial ? color : mat(color, o));
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  return m;
}

function G(...children) { const g = new THREE.Group(); children.forEach(c => c && g.add(c)); return g; }

/* ------------------------------------------------------------------ rug */
export function rug(w, d, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, { rough: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.receiveShadow = true;
  return G(m);
}

/* ----------------------------------------------------------------- sofa */
export function sofa(len = 2.2, color = PAL.fabricBlue) {
  const g = G();
  const depth = 0.95, seatH = 0.42, armW = 0.18;
  g.add(box(len, 0.16, depth, color, { pos: [0, 0.20, 0], rough: 0.95 }));            // base
  g.add(box(len, 0.55, 0.18, color, { pos: [0, 0.50, -depth / 2 + 0.09], rough: 0.95 })); // back
  g.add(box(armW, 0.5, depth, color, { pos: [-len / 2 + armW / 2, 0.42, 0], rough: 0.95 }));
  g.add(box(armW, 0.5, depth, color, { pos: [len / 2 - armW / 2, 0.42, 0], rough: 0.95 }));
  const seats = Math.max(2, Math.round(len / 0.9));
  const sw = (len - armW * 2) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -len / 2 + armW + sw * (i + 0.5);
    g.add(box(sw - 0.04, 0.16, depth - 0.22, PAL.cream, { pos: [x, 0.36, 0.05], rough: 0.95 })); // cushion
    g.add(box(sw - 0.06, 0.36, 0.12, PAL.cream, { pos: [x, 0.55, -depth / 2 + 0.2], rough: 0.95 })); // back pillow
  }
  // little feet
  [[-len/2+0.1,0.07,depth/2-0.1],[len/2-0.1,0.07,depth/2-0.1],[-len/2+0.1,0.07,-depth/2+0.1],[len/2-0.1,0.07,-depth/2+0.1]]
    .forEach(p => g.add(cyl(0.03,0.03,0.14,PAL.woodDark,{pos:p,seg:8})));
  return g;
}

export function armchair(color = PAL.fabricSage) {
  const g = sofa(0.95, color);
  return g;
}

/* --------------------------------------------------------- coffee table */
export function coffeeTable() {
  const g = G();
  g.add(box(1.1, 0.06, 0.6, PAL.woodMid, { pos: [0, 0.42, 0] }));
  [[-0.5,0.21,-0.25],[0.5,0.21,-0.25],[-0.5,0.21,0.25],[0.5,0.21,0.25]]
    .forEach(p => g.add(box(0.06, 0.42, 0.06, PAL.woodDark, { pos: p })));
  return g;
}

/* ------------------------------------------------------ TV console + TV */
export function tvWall(w = 2.0) {
  const g = G();
  g.add(box(w, 0.4, 0.4, PAL.woodDark, { pos: [0, 0.25, 0] })); // console
  // TV
  const tv = box(1.4, 0.8, 0.05, PAL.black, { pos: [0, 1.35, -0.05], rough: 0.4 });
  g.add(tv);
  g.add(box(1.32, 0.72, 0.02, 0x0a1c2a, { pos: [0, 1.35, -0.02], rough: 0.2, emissive: 0x14324a, emissiveIntensity: 0.6 }));
  return g;
}

/* ------------------------------------------------- dining table + chairs */
export function diningSet(seats = 6) {
  const g = G();
  const len = seats >= 6 ? 1.9 : 1.3, w = 0.9, topH = 0.75;
  g.add(box(len, 0.06, w, PAL.woodMid, { pos: [0, topH, 0] }));
  [[-len/2+0.12,topH/2,-w/2+0.12],[len/2-0.12,topH/2,-w/2+0.12],[-len/2+0.12,topH/2,w/2-0.12],[len/2-0.12,topH/2,w/2-0.12]]
    .forEach(p => g.add(box(0.07, topH, 0.07, PAL.woodDark, { pos: p })));
  const perSide = Math.ceil(seats / 2);
  for (let s = 0; s < perSide; s++) {
    const x = -len / 2 + (len / (perSide)) * (s + 0.5);
    [1, -1].forEach(dir => {
      if (s * 2 + (dir < 0 ? 1 : 0) >= seats && perSide * 2 > seats && dir < 0) return;
      const ch = chair();
      ch.position.set(x, 0, dir * (w / 2 + 0.28));
      ch.rotation.y = dir > 0 ? Math.PI : 0;
      g.add(ch);
    });
  }
  return g;
}

export function chair(color = PAL.woodLight) {
  const g = G();
  g.add(box(0.42, 0.05, 0.42, color, { pos: [0, 0.46, 0] }));         // seat
  g.add(box(0.42, 0.42, 0.05, color, { pos: [0, 0.68, -0.18] }));     // back
  [[-0.18,0.23,-0.18],[0.18,0.23,-0.18],[-0.18,0.23,0.18],[0.18,0.23,0.18]]
    .forEach(p => g.add(box(0.04, 0.46, 0.04, PAL.woodDark, { pos: p })));
  return g;
}

// Round pedestal dining table + chairs — saves space vs a rectangular table.
export function roundDiningSet(seats = 4, r = 0.6) {
  const g = G();
  const topH = 0.75;
  g.add(cyl(r, r, 0.05, mat(PAL.woodMid, { rough: 0.6 }), { pos: [0, topH, 0], seg: 28 }));        // round top
  g.add(cyl(0.07, 0.09, topH - 0.05, mat(PAL.woodDark), { pos: [0, (topH - 0.05) / 2, 0], seg: 12 })); // pedestal
  g.add(cyl(0.28, 0.28, 0.04, mat(PAL.woodDark), { pos: [0, 0.02, 0], seg: 20 }));                  // base foot
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    const ch = chair();
    ch.position.set(Math.cos(a) * (r + 0.32), 0, Math.sin(a) * (r + 0.32));
    ch.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));   // face the centre
    g.add(ch);
  }
  return g;
}

/* -------------------------------------------------------------- kitchen */
// L-shaped run along -x wall and back +z wall. Returns group anchored at corner.
export function kitchen() {
  const g = G();
  const ctH = 0.9, ctD = 0.6;
  const counterMat = mat(0x2c2f33, { rough: 0.5 });   // dark stone top
  const cabMat = mat(0xdfd8c8, { rough: 0.7 });        // cabinet doors
  // run A: length 3 along z
  const aLen = 3.0;
  g.add(box(ctD, 0.05, aLen, counterMat, { pos: [0, ctH, aLen / 2] }));
  g.add(box(ctD - 0.04, ctH - 0.05, aLen - 0.02, cabMat, { pos: [0, (ctH - 0.05) / 2, aLen / 2] }));
  // run B: length 1.6 along x
  const bLen = 1.8;
  g.add(box(bLen, 0.05, ctD, counterMat, { pos: [bLen / 2 + ctD / 2 - 0.001, ctH, ctD / 2] }));
  g.add(box(bLen, ctH - 0.05, ctD - 0.04, cabMat, { pos: [bLen / 2 + ctD / 2, (ctH - 0.05) / 2, ctD / 2] }));
  // sink
  g.add(box(0.5, 0.06, 0.4, PAL.steel, { pos: [0, ctH + 0.005, 1.0], rough: 0.3, metal: 0.8 }));
  g.add(box(0.46, 0.12, 0.36, 0x111316, { pos: [0, ctH - 0.04, 1.0] }));
  g.add(cyl(0.02, 0.02, 0.28, PAL.steel, { pos: [0.12, ctH + 0.16, 1.0], metal: 0.9, rough: 0.2 })); // faucet
  // stove
  g.add(box(0.55, 0.04, 0.5, 0x111316, { pos: [0, ctH + 0.02, 2.2], rough: 0.3 }));
  [[-0.12,2.08],[0.12,2.08],[-0.12,2.32],[0.12,2.32]].forEach(p =>
    g.add(cyl(0.07, 0.07, 0.02, 0x222428, { pos: [p[0], ctH + 0.05, p[1]], seg: 16 })));
  // range hood
  g.add(box(0.6, 0.25, 0.5, PAL.steel, { pos: [0, 1.95, 2.2], metal: 0.6, rough: 0.4 }));
  g.add(box(0.3, 0.45, 0.3, PAL.steel, { pos: [0, 2.3, 2.2], metal: 0.6, rough: 0.4 }));
  // upper cabinets along z run
  g.add(box(0.35, 0.7, aLen, cabMat, { pos: [-0.1, 1.95, aLen / 2] }));
  // backsplash
  g.add(box(0.02, 0.5, aLen, 0xeceae3, { pos: [-ctD / 2 + 0.01, ctH + 0.27, aLen / 2] }));
  return g;
}

// Linear kitchen run along local +X, depth 0.6, opening toward -Z (back at +Z, put against wall).
export function kitchenLinear(len = 2.4, { sinkAt = 0.35, stoveAt = 0.72 } = {}) {
  const g = G();
  const ctH = 0.9, ctD = 0.6;
  const counterMat = mat(0x2b2e33, { rough: 0.35, metal: 0.1 });
  const cabMat = mat(0xe7e1d3, { rough: 0.55 });
  g.add(box(len, ctH - 0.05, ctD - 0.04, cabMat, { pos: [0, (ctH - 0.05) / 2, 0.0] }));      // base cabinet
  g.add(box(len, 0.05, ctD, counterMat, { pos: [0, ctH, 0] }));                                // top
  g.add(box(len, 0.6, 0.32, cabMat, { pos: [0, 1.95, 0.14] }));                                // upper cabinets (back)
  g.add(box(len, 0.5, 0.02, mat(0xeceae3, { rough: 0.4 }), { pos: [0, ctH + 0.27, 0.29] }));   // backsplash
  // sink
  const sx = -len / 2 + sinkAt * len;
  g.add(box(0.46, 0.05, 0.36, PAL.steel, { pos: [sx, ctH + 0.006, -0.03], metal: 0.85, rough: 0.25 }));
  g.add(box(0.4, 0.1, 0.3, 0x111316, { pos: [sx, ctH - 0.05, -0.03] }));
  g.add(cyl(0.018, 0.018, 0.26, PAL.steel, { pos: [sx, ctH + 0.15, 0.12], metal: 0.9, rough: 0.2 }));
  // stove
  const vx = -len / 2 + stoveAt * len;
  g.add(box(0.55, 0.03, 0.5, 0x121417, { pos: [vx, ctH + 0.02, -0.02], rough: 0.25, metal: 0.2 }));
  [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(p =>
    g.add(cyl(0.07, 0.07, 0.015, 0x26292d, { pos: [vx + p[0], ctH + 0.04, -0.02 + p[1]], seg: 16 })));
  g.add(box(0.6, 0.18, 0.42, PAL.steel, { pos: [vx, 1.62, 0.05], metal: 0.6, rough: 0.35 })); // hood
  return g;
}

export function washer() {
  const g = G();
  g.add(box(0.62, 0.85, 0.6, 0xeef0f2, { pos: [0, 0.42, 0], rough: 0.4, metal: 0.2 }));
  g.add(cyl(0.18, 0.18, 0.03, 0x2a2c2f, { pos: [0, 0.5, 0.31], seg: 24, rough: 0.2 }));
  g.add(cyl(0.13, 0.13, 0.04, 0x6fa0c0, { pos: [0, 0.5, 0.32], seg: 24, rough: 0.05, metal: 0.3, opacity: 0.5 }));
  return g;
}

export function fridge() {
  const g = G();
  g.add(box(0.7, 1.8, 0.7, 0xd7d9db, { pos: [0, 0.9, 0], metal: 0.5, rough: 0.35 }));
  g.add(box(0.04, 0.5, 0.04, 0x8a8d90, { pos: [0.3, 1.3, 0.36], metal: 0.7 }));
  g.add(box(0.04, 0.4, 0.04, 0x8a8d90, { pos: [0.3, 0.6, 0.36], metal: 0.7 }));
  return g;
}

/* ------------------------------------------------------------------ bed */
export function bed(w = 1.6, l = 2.0, color = PAL.fabricSand) {
  const g = G();
  g.add(box(w + 0.1, 0.3, l + 0.1, PAL.woodDark, { pos: [0, 0.2, 0] }));        // frame
  g.add(box(w, 0.22, l, PAL.cream, { pos: [0, 0.42, 0], rough: 0.95 }));        // mattress
  g.add(box(w, 0.12, l * 0.7, color, { pos: [0, 0.56, l * 0.12], rough: 0.97 }));// duvet
  g.add(box(w + 0.12, 0.9, 0.12, color, { pos: [0, 0.65, -l / 2 - 0.02], rough: 0.95 })); // headboard
  // pillows
  const pw = (w - 0.18) / 2;
  [-1, 1].forEach(s => g.add(box(pw, 0.14, 0.42, PAL.wallWhite, { pos: [s * (pw / 2 + 0.03), 0.6, -l / 2 + 0.34], rough: 0.97 })));
  return g;
}

export function nightstand(withLamp = true) {
  const g = G();
  g.add(box(0.45, 0.45, 0.4, PAL.woodMid, { pos: [0, 0.225, 0] }));
  if (withLamp) {
    g.add(cyl(0.03, 0.05, 0.28, PAL.woodDark, { pos: [0, 0.59, 0], seg: 10 }));
    g.add(cyl(0.12, 0.09, 0.16, 0xf2e4c0, { pos: [0, 0.78, 0], seg: 14, emissive: 0xffd9a0, emissiveIntensity: 0.5 }));
  }
  return g;
}

export function wardrobe(w = 1.6, h = 2.2) {
  const g = G();
  g.add(box(w, h, 0.6, PAL.woodLight, { pos: [0, h / 2, 0] }));
  for (let i = 0; i < Math.round(w / 0.5); i++) {
    const x = -w / 2 + (w / Math.round(w / 0.5)) * (i + 0.5);
    g.add(box(0.02, h - 0.1, 0.02, PAL.woodDark, { pos: [x + 0.18, h / 2, 0.31] }));
    g.add(box((w / Math.round(w/0.5)) - 0.03, h - 0.06, 0.01, 0x000000, { pos: [x, h/2, 0.301], opacity: 0.06 }));
  }
  return g;
}

export function desk() {
  const g = G();
  g.add(box(1.3, 0.05, 0.6, PAL.woodLight, { pos: [0, 0.74, 0] }));
  g.add(box(0.05, 0.74, 0.55, PAL.woodDark, { pos: [-0.6, 0.37, 0] }));
  g.add(box(0.45, 0.74, 0.55, PAL.woodMid, { pos: [0.42, 0.37, 0] })); // drawer block
  // monitor
  g.add(box(0.55, 0.34, 0.03, PAL.black, { pos: [0, 1.05, -0.18], rough: 0.3 }));
  g.add(box(0.5, 0.29, 0.01, 0x0a1c2a, { pos: [0, 1.05, -0.165], emissive: 0x16384f, emissiveIntensity: 0.5 }));
  g.add(cyl(0.06, 0.08, 0.12, 0x444, { pos: [0, 0.84, -0.18], seg: 12 }));
  return g;
}

export function officeChair(color = PAL.charcoal) {
  const g = G();
  g.add(cyl(0.03, 0.03, 0.46, 0x222, { pos: [0, 0.23, 0], seg: 10 }));
  g.add(box(0.46, 0.08, 0.46, color, { pos: [0, 0.48, 0], rough: 0.9 }));
  g.add(box(0.46, 0.5, 0.08, color, { pos: [0, 0.74, -0.2], rough: 0.9 }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(0.26, 0.04, 0.05, 0x222222, { pos: [Math.cos(a) * 0.16, 0.04, Math.sin(a) * 0.16] });
    leg.rotation.y = -a;
    g.add(leg);
  }
  return g;
}

export function bookshelf(w = 1.0, h = 1.9) {
  const g = G();
  g.add(box(w, h, 0.3, PAL.woodMid, { pos: [0, h / 2, 0] }));
  const shelves = 4;
  for (let s = 1; s < shelves; s++) {
    const y = (h / shelves) * s;
    g.add(box(w - 0.08, 0.03, 0.28, PAL.woodDark, { pos: [0, y, 0.01] }));
    // books
    let x = -w / 2 + 0.08;
    while (x < w / 2 - 0.12) {
      const bw = 0.03 + Math.abs(Math.sin(x * 53.1)) * 0.05;
      const bh = 0.18 + Math.abs(Math.cos(x * 31.7)) * 0.08;
      const col = [PAL.terracotta, PAL.fabricBlue, PAL.green, PAL.gold, PAL.charcoal, PAL.cream][Math.floor(Math.abs(Math.sin(x*97))*6)%6];
      g.add(box(bw, bh, 0.22, col, { pos: [x + bw / 2, y + bh / 2 + 0.015, 0.02] }));
      x += bw + 0.005;
    }
  }
  return g;
}

/* ------------------------------------------------------------- plants */
export function plant(h = 1.3) {
  const g = G();
  g.add(cyl(0.18, 0.14, 0.32, PAL.terracotta, { pos: [0, 0.16, 0], seg: 16 }));
  g.add(cyl(0.16, 0.16, 0.04, 0x3a2a1c, { pos: [0, 0.32, 0], seg: 16 }));
  const trunkH = h * 0.45;
  g.add(cyl(0.035, 0.05, trunkH, PAL.woodDark, { pos: [0, 0.32 + trunkH / 2, 0], seg: 8 }));
  // foliage clusters
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.12 + (i % 3) * 0.07;
    const yy = 0.32 + trunkH + (i % 4) * 0.12;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 0), mat(i % 2 ? PAL.green : PAL.greenDk, { rough: 1 }));
    s.position.set(Math.cos(a) * r, yy, Math.sin(a) * r);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

/* ------------------------------------------------------ bathroom fixtures */
export function toilet() {
  const g = G();
  g.add(box(0.36, 0.4, 0.55, PAL.wallWhite, { pos: [0, 0.2, 0.02], rough: 0.3 }));
  g.add(cyl(0.2, 0.18, 0.12, PAL.wallWhite, { pos: [0, 0.46, 0.1], seg: 18, rough: 0.3 }));
  g.add(box(0.36, 0.42, 0.18, PAL.wallWhite, { pos: [0, 0.46, -0.24], rough: 0.3 })); // tank
  return g;
}

export function basin() {
  const g = G();
  g.add(box(0.6, 0.55, 0.45, PAL.woodMid, { pos: [0, 0.42, 0] }));         // vanity
  g.add(box(0.66, 0.06, 0.5, 0x2c2f33, { pos: [0, 0.72, 0], rough: 0.4 })); // top
  g.add(cyl(0.16, 0.18, 0.1, PAL.wallWhite, { pos: [0, 0.78, 0], seg: 18, rough: 0.2 }));
  g.add(cyl(0.015, 0.015, 0.18, PAL.steel, { pos: [0, 0.86, -0.1], metal: 0.9, rough: 0.2 }));
  g.add(box(0.5, 0.7, 0.03, PAL.glass, { pos: [0, 1.35, -0.22], metal: 0.1, rough: 0.05, opacity: 0.5 })); // mirror
  return g;
}

export function shower(w = 1.0, d = 0.9) {
  const g = G();
  const h = 2.0;
  g.add(box(w, 0.04, d, 0xdedede, { pos: [0, 0.02, 0], rough: 0.4 })); // tray
  const glassMat = mat(PAL.glass, { opacity: 0.22, rough: 0.05, metal: 0.1, side: THREE.DoubleSide });
  g.add(box(0.02, h, d, glassMat, { pos: [w / 2, h / 2, 0], cast: false }));
  g.add(box(w, h, 0.02, glassMat, { pos: [0, h / 2, d / 2], cast: false }));
  g.add(cyl(0.06, 0.06, 0.04, PAL.steel, { pos: [0, h - 0.2, -d / 2 + 0.1], metal: 0.9, rough: 0.2, seg: 14 })); // head
  return g;
}

/* ---------------------------------------------------------------- stairs */
// Straight flight rising along +z. Origin at bottom-front-center.
export function stairs(steps = 16, rise = 0.1875, going = 0.25, width = 1.0) {
  const g = G();
  const stepMat = mat(PAL.woodMid, { rough: 0.7 });
  for (let i = 0; i < steps; i++) {
    g.add(box(width, rise, going, stepMat, { pos: [0, rise * (i + 0.5), going * (i + 0.5)] }));
    // riser face
    g.add(box(width, rise, 0.02, mat(PAL.woodLight, { rough: 0.8 }), { pos: [0, rise * (i + 0.5), going * i + 0.01] }));
  }
  const len = steps * going, hgt = steps * rise;
  // sloped handrail on the open side (+x)
  const railH = 0.95;
  const rail = box(0.05, 0.05, Math.hypot(len, hgt), mat(PAL.woodDark));
  rail.position.set(width / 2 - 0.04, railH + hgt / 2, len / 2);
  rail.rotation.x = -Math.atan2(hgt, len);
  g.add(rail);
  for (let i = 0; i < steps; i += 2) {
    g.add(cyl(0.018, 0.018, railH, mat(PAL.charcoal, { metal: 0.6, rough: 0.4 }),
      { pos: [width / 2 - 0.04, rise * (i + 1) + railH / 2, going * (i + 0.5)], seg: 8 }));
  }
  return g;
}

/* --------------------------------------------------- winder / spiral stair */
function link(p1, p2, r, material) {
  const d = new THREE.Vector3().subVectors(p2, p1), len = d.length();
  const c = cyl(r, r, len, material, { seg: 6, cast: true });
  c.position.copy(p1).addScaledVector(d, 0.5);
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return c;
}
// Winder staircase turning around a central newel (matches the fan stair in the plan).
export function spiralStair({ r0 = 0.12, r1 = 0.78, rise = 3.0, steps = 15, a0 = Math.PI * 0.5, sweep = Math.PI * 1.5, dir = 1 } = {}) {
  const g = G();
  const riseStep = rise / steps;
  const treadMat = mat(PAL.woodMid, { rough: 0.5 });
  const railMat = mat(PAL.woodDark, { rough: 0.4 });
  const postMat = mat(PAL.charcoal, { metal: 0.5, rough: 0.4 });
  const rMid = (r0 + r1) / 2, radial = r1 - r0;
  const railTop = [];
  for (let i = 0; i < steps; i++) {
    const ang = a0 + dir * (sweep / steps) * i;
    const arc = rMid * (sweep / steps);
    const y = riseStep * (i + 1);
    const t = box(radial, 0.05, arc * 1.08, treadMat);
    t.position.set(Math.cos(ang) * rMid, y, Math.sin(ang) * rMid);
    t.rotation.y = -ang; g.add(t);
    // riser
    const rsr = box(radial, riseStep, 0.02, mat(PAL.woodLight, { rough: 0.6 }));
    rsr.position.set(Math.cos(ang) * rMid, y - riseStep / 2, Math.sin(ang) * rMid);
    rsr.rotation.y = -ang; g.add(rsr);
    // baluster
    const top = new THREE.Vector3(Math.cos(ang) * r1, y + 0.9, Math.sin(ang) * r1);
    g.add(link(new THREE.Vector3(top.x, y, top.z), top, 0.016, postMat));
    railTop.push(top);
  }
  for (let i = 0; i < railTop.length - 1; i++) g.add(link(railTop[i], railTop[i + 1], 0.026, railMat));
  g.add(cyl(r0, r0, rise, mat(PAL.woodDark, { rough: 0.45 }), { seg: 18, pos: [0, rise / 2, 0] }));
  return g;
}

/* ---------------------------------------------------------------- railing */
export function railing(length, height = 1.0, axis = 'x') {
  const g = G();
  const postMat = mat(PAL.charcoal, { metal: 0.5, rough: 0.5 });
  const n = Math.max(2, Math.round(length / 0.18));
  for (let i = 0; i <= n; i++) {
    const t = -length / 2 + (length / n) * i;
    const p = cyl(0.012, 0.012, height, postMat, { seg: 6 });
    p.position.set(axis === 'x' ? t : 0, height / 2, axis === 'z' ? t : 0);
    g.add(p);
  }
  const top = box(axis === 'x' ? length : 0.05, 0.05, axis === 'z' ? length : 0.05, mat(PAL.woodMid));
  top.position.y = height;
  g.add(top);
  return g;
}

/* ------------------------------------------------------------ ceiling lamp */
export function pendant(drop = 0.5) {
  const g = G();
  g.add(cyl(0.005, 0.005, drop, 0x222, { pos: [0, -drop / 2, 0], seg: 6, cast: false }));
  g.add(cyl(0.16, 0.05, 0.2, 0x2a2c2f, { pos: [0, -drop - 0.1, 0], seg: 18, rough: 0.5 }));
  g.add(cyl(0.05, 0.05, 0.02, 0xffe9b0, { pos: [0, -drop - 0.19, 0], seg: 16, emissive: 0xffe9b0, emissiveIntensity: 1.2, cast: false }));
  return g;
}

/* ----------------------------------------------------------------- a car */
export function car(color = 0x7a8a99) {
  const g = G();
  const body = mat(color, { metal: 0.4, rough: 0.35 });
  g.add(box(1.75, 0.5, 4.3, body, { pos: [0, 0.55, 0] }));
  g.add(box(1.6, 0.5, 2.3, body, { pos: [0, 1.0, -0.1] }));
  g.add(box(1.5, 0.42, 2.0, 0x101418, { pos: [0, 1.02, -0.1], opacity: 0.7, rough: 0.1 }));
  [[-0.78,-1.4],[0.78,-1.4],[-0.78,1.4],[0.78,1.4]].forEach(p => {
    const w = cyl(0.34, 0.34, 0.22, 0x1a1a1a, { seg: 18, rough: 0.8 });
    w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.34, p[1]); g.add(w);
  });
  g.add(box(0.3, 0.12, 0.05, 0xfff3c0, { pos: [-0.6, 0.6, 2.15], emissive: 0xfff0b0, emissiveIntensity: 0.6 }));
  g.add(box(0.3, 0.12, 0.05, 0xfff3c0, { pos: [0.6, 0.6, 2.15], emissive: 0xfff0b0, emissiveIntensity: 0.6 }));
  return g;
}

/* --------------------------------------------------------- framed artwork */
export function art(w = 0.8, h = 1.1, color = 0x6a7f8a) {
  const g = G();
  g.add(box(w + 0.06, h + 0.06, 0.03, PAL.woodDark, { pos: [0, 0, 0] }));
  g.add(box(w, h, 0.01, color, { pos: [0, 0, 0.02], rough: 0.6 }));
  return g;
}

/* ===================== outdoor / backyard ===================== */

// Temporary canopy: 4 posts + a canvas roof (covers the laundry/utility area).
export function canopy(w = 2.6, d = 2.2, h = 2.2, color = 0xdacbab) {
  const g = G();
  const post = mat(0x8d9197, { metal: 0.5, rough: 0.5 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    g.add(cyl(0.04, 0.04, h, post, { pos: [sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06)], seg: 8 })));
  g.add(box(w, 0.05, d, mat(color, { rough: 0.9, side: THREE.DoubleSide }), { pos: [0, h + 0.03, 0] }));  // canvas roof
  g.add(box(w, 0.14, 0.03, mat(0xc7b690, { rough: 0.9 }), { pos: [0, h - 0.05, d / 2 - 0.02] }));          // front valance
  return g;
}

// Jemuran — clothesline between two posts, with a few hanging clothes.
export function jemuran(w = 2.2, h = 1.6) {
  const g = G();
  const post = mat(0xb8bdc2, { metal: 0.4, rough: 0.5 });
  g.add(cyl(0.03, 0.03, h, post, { pos: [-w / 2, h / 2, 0], seg: 8 }));
  g.add(cyl(0.03, 0.03, h, post, { pos: [w / 2, h / 2, 0], seg: 8 }));
  g.add(box(0.05, 0.05, 0.5, post, { pos: [-w / 2, h, 0] }));
  g.add(box(0.05, 0.05, 0.5, post, { pos: [w / 2, h, 0] }));
  const lineMat = mat(0xeeeeee, { rough: 0.8 });
  [-0.18, 0, 0.18].forEach(dz => [h - 0.04, h - 0.22].forEach(yy => {
    const l = cyl(0.006, 0.006, w, lineMat, { seg: 4, cast: false });
    l.rotation.z = Math.PI / 2; l.position.set(0, yy, dz); g.add(l);
  }));
  const cols = [0x6fa0c0, 0xd98c6a, 0xeae4d8, 0x7c8a6a];
  [-0.6, -0.1, 0.4, 0.85].forEach((x, i) => {
    const c = box(0.42, 0.55, 0.02, mat(cols[i % 4], { rough: 0.95, side: THREE.DoubleSide }));
    c.position.set(x, h - 0.32, ((i % 3) - 1) * 0.18); g.add(c);
  });
  return g;
}

// Folding camping chair (X-frame + fabric seat/back).
export function campChair(color = 0x3f6f57) {
  const g = G();
  const frame = mat(0x2a2c2f, { metal: 0.5, rough: 0.45 });
  const fab = mat(color, { rough: 0.95, side: THREE.DoubleSide });
  g.add(box(0.5, 0.04, 0.46, fab, { pos: [0, 0.42, 0] }));                                  // seat
  const back = box(0.5, 0.5, 0.04, fab, { pos: [0, 0.66, -0.21] }); back.rotation.x = -0.2; g.add(back);
  [-0.24, 0.24].forEach(sx => {                                                              // side X-frames
    const a = cyl(0.018, 0.018, 0.62, frame, { seg: 6 }); a.position.set(sx, 0.3, 0); a.rotation.x = 0.6; g.add(a);
    const b = cyl(0.018, 0.018, 0.62, frame, { seg: 6 }); b.position.set(sx, 0.3, 0); b.rotation.x = -0.6; g.add(b);
  });
  [-0.26, 0.26].forEach(sx => g.add(box(0.035, 0.035, 0.42, frame, { pos: [sx, 0.6, 0.02] })));  // armrests
  return g;
}

// Folding camping table.
export function campTable() {
  const g = G();
  const top = mat(0xc7ccd1, { metal: 0.3, rough: 0.5 });
  const leg = mat(0x2a2c2f, { metal: 0.5, rough: 0.45 });
  g.add(box(1.0, 0.05, 0.6, top, { pos: [0, 0.52, 0] }));
  [-0.4, 0.4].forEach(sx => {
    const a = cyl(0.02, 0.02, 0.72, leg, { seg: 6 }); a.position.set(sx, 0.26, 0); a.rotation.x = 0.7; g.add(a);
    const b = cyl(0.02, 0.02, 0.72, leg, { seg: 6 }); b.position.set(sx, 0.26, 0); b.rotation.x = -0.7; g.add(b);
  });
  return g;
}

/* ===================== gym & nursery ===================== */
const hbar = (len, r, material, x, y, z) => {     // horizontal bar along x
  const c = cyl(r, r, len, material, { seg: 8 }); c.rotation.z = Math.PI / 2; c.position.set(x, y, z); return c;
};

export function weightBench(color = 0x7a3030) {
  const g = G();
  const pad = mat(color, { rough: 0.85 }), frame = mat(0x3a3d42, { metal: 0.55, rough: 0.4 });
  g.add(box(0.34, 0.12, 1.15, pad, { pos: [0, 0.46, 0] }));
  [-0.45, 0.45].forEach(sz => {
    g.add(box(0.5, 0.05, 0.06, frame, { pos: [0, 0.04, sz] }));
    g.add(box(0.05, 0.4, 0.05, frame, { pos: [0.15, 0.24, sz] }));
    g.add(box(0.05, 0.4, 0.05, frame, { pos: [-0.15, 0.24, sz] }));
  });
  return g;
}

export function dumbbellRack() {
  const g = G();
  const frame = mat(0x3a3d42, { metal: 0.55, rough: 0.4 });
  const bar = mat(0x6a6d72, { metal: 0.7, rough: 0.3 }), wt = mat(0x222428, { rough: 0.6 });
  g.add(box(1.0, 0.05, 0.42, frame, { pos: [0, 0.34, 0] }));            // lower shelf
  g.add(box(1.0, 0.05, 0.42, frame, { pos: [0, 0.6, -0.16] }));         // upper shelf
  [[-0.46, 0.18], [0.46, 0.18], [-0.46, -0.2], [0.46, -0.2]].forEach(p => g.add(box(0.05, 0.66, 0.05, frame, { pos: [p[0], 0.33, p[1]] })));
  const db = (x, y, z) => {
    g.add(hbar(0.26, 0.018, bar, x, y, z));
    g.add(hbar(0.055, 0.06, wt, x - 0.12, y, z));
    g.add(hbar(0.055, 0.06, wt, x + 0.12, y, z));
  };
  for (let i = 0; i < 3; i++) { db(-0.3 + i * 0.3, 0.42, 0.02); db(-0.3 + i * 0.3, 0.68, -0.16); }
  return g;
}

export function cableMachine() {
  const g = G();
  const frame = mat(0x33373b, { metal: 0.5, rough: 0.4 }), stack = mat(0x222428, { metal: 0.3, rough: 0.5 });
  g.add(box(0.5, 0.08, 0.6, frame, { pos: [0, 0.04, 0] }));             // base
  g.add(box(0.16, 2.1, 0.16, frame, { pos: [-0.15, 1.05, -0.2] }));     // back post
  g.add(box(0.4, 1.3, 0.42, stack, { pos: [-0.15, 0.75, -0.2] }));      // weight stack
  g.add(box(0.5, 0.12, 0.12, frame, { pos: [0.05, 2.05, -0.2] }));      // top arm
  const cable = cyl(0.008, 0.008, 1.3, mat(0x111316), { seg: 4 }); cable.position.set(0.28, 1.4, -0.2); g.add(cable);
  g.add(box(0.2, 0.04, 0.04, frame, { pos: [0.28, 0.74, -0.2] }));      // handle bar
  return g;
}

export function pullUpTower() {
  const g = G();
  const frame = mat(0x3a3d42, { metal: 0.55, rough: 0.4 }), pad = mat(0x222428, { rough: 0.8 });
  g.add(box(0.85, 0.08, 0.95, frame, { pos: [0, 0.04, 0] }));           // base
  [-0.36, 0.36].forEach(sx => g.add(box(0.07, 2.15, 0.07, frame, { pos: [sx, 1.07, -0.25] })));   // posts
  g.add(hbar(0.85, 0.025, frame, 0, 2.15, -0.1));                       // pull-up bar
  g.add(box(0.45, 0.55, 0.06, pad, { pos: [0, 1.5, -0.27] }));          // back pad
  [-0.28, 0.28].forEach(sx => g.add(box(0.05, 0.05, 0.45, frame, { pos: [sx, 1.25, 0] })));       // dip handles
  return g;
}

export function pcTower() {
  const g = G();
  g.add(box(0.22, 0.46, 0.46, mat(0x1a1c1f, { rough: 0.4, metal: 0.2 }), { pos: [0, 0.23, 0] }));
  g.add(box(0.015, 0.34, 0.02, mat(0x2a6cff, { emissive: 0x1e54ff, emissiveIntensity: 0.7 }), { pos: [0.112, 0.27, 0.12] }));
  return g;
}

export function crib() {
  const g = G();
  const wood = mat(PAL.woodLight, { rough: 0.6 });
  g.add(box(0.74, 0.1, 1.32, wood, { pos: [0, 0.34, 0] }));             // base frame
  g.add(box(0.66, 0.14, 1.24, PAL.cream, { pos: [0, 0.46, 0], rough: 0.95 }));   // mattress
  [-0.36, 0.36].forEach(sx => {
    g.add(box(0.04, 0.04, 1.32, wood, { pos: [sx, 0.82, 0] }));
    for (let i = 0; i < 10; i++) g.add(cyl(0.012, 0.012, 0.46, wood, { pos: [sx, 0.6, -0.58 + i * 0.13], seg: 5 }));
  });
  [-0.62, 0.62].forEach(sz => {
    g.add(box(0.74, 0.04, 0.04, wood, { pos: [0, 0.82, sz] }));
    for (let i = 0; i < 5; i++) g.add(cyl(0.012, 0.012, 0.46, wood, { pos: [-0.3 + i * 0.15, 0.6, sz], seg: 5 }));
  });
  return g;
}
