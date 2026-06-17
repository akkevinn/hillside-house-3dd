// textures.js — procedural CanvasTextures (no external image assets needed).
// Each generator paints a seamless tile; callers set .repeat in metres.
import * as THREE from 'three';

function canvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function finish(c, { repeat = [1, 1], aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// deterministic pseudo-random so renders are stable
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function noise(g, w, h, amt, seed = 1) {
  const r = rng(seed);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/* ------------------------------------------------ wood floor (planks) */
export function woodFloor({ repeat = [1, 1] } = {}) {
  const c = canvas(512), g = c.getContext('2d');
  const base = ['#a9763f', '#b07c45', '#9c6a39', '#b58450', '#a06f3d'];
  const planks = 4;                 // planks across the tile
  const pw = c.width / planks;
  const r = rng(7);
  for (let i = 0; i < planks; i++) {
    g.fillStyle = base[Math.floor(r() * base.length)];
    g.fillRect(i * pw, 0, pw, c.height);
    // grain streaks
    for (let s = 0; s < 60; s++) {
      g.strokeStyle = `rgba(${60 + r() * 40},${40 + r() * 30},${20 + r() * 20},${0.05 + r() * 0.08})`;
      g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath();
      const x = i * pw + r() * pw;
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - .5) * 8, c.height * .33, x + (r() - .5) * 8, c.height * .66, x + (r() - .5) * 6, c.height);
      g.stroke();
    }
    // plank seam
    g.fillStyle = 'rgba(40,25,12,0.55)';
    g.fillRect(i * pw, 0, 2, c.height);
  }
  noise(g, c.width, c.height, 14, 11);
  return finish(c, { repeat });
}

/* ------------------------------------------------ ceramic / porcelain tile */
export function tile({ repeat = [1, 1], color = '#e9e7e1', grout = '#bdbab2', n = 2 } = {}) {
  const c = canvas(512), g = c.getContext('2d');
  g.fillStyle = grout; g.fillRect(0, 0, c.width, c.height);
  const t = c.width / n, gap = 6;
  const r = rng(3);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const shade = 1 - r() * 0.06;
    g.fillStyle = shadeHex(color, shade);
    g.fillRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap);
    // subtle sheen gradient per tile
    const grd = g.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
    grd.addColorStop(0, 'rgba(255,255,255,0.10)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.06)');
    g.fillStyle = grd;
    g.fillRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap);
  }
  noise(g, c.width, c.height, 6, 21);
  return finish(c, { repeat });
}

/* ------------------------------------------------ painted wall (subtle) */
export function wall({ repeat = [1, 1], color = '#efeae0' } = {}) {
  const c = canvas(256), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  noise(g, c.width, c.height, 8, 5);
  return finish(c, { repeat });
}

/* ------------------------------------------------ grass / lawn */
export function grass({ repeat = [1, 1] } = {}) {
  const c = canvas(256), g = c.getContext('2d');
  const r = rng(9);
  g.fillStyle = '#6f8a4a'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 4000; i++) {
    g.strokeStyle = `rgba(${50 + r() * 60},${90 + r() * 70},${40 + r() * 40},0.5)`;
    g.lineWidth = 1;
    const x = r() * c.width, y = r() * c.height, len = 2 + r() * 4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 2, y - len); g.stroke();
  }
  return finish(c, { repeat });
}

/* ------------------------------------------------ concrete / screed */
export function concrete({ repeat = [1, 1], color = '#c7c5bf' } = {}) {
  const c = canvas(256), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  const r = rng(13);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() * 255 | 0},${r() * 255 | 0},${r() * 255 | 0},0.025)`;
    g.beginPath(); g.arc(r() * c.width, r() * c.height, r() * 2, 0, 7); g.fill();
  }
  noise(g, c.width, c.height, 10, 31);
  return finish(c, { repeat });
}

/* ------------------------------------------------ paving (carport) */
export function paving({ repeat = [1, 1] } = {}) {
  return tile({ repeat, color: '#b9b6ae', grout: '#8d8a83', n: 2 });
}

/* ------------------------------------------------ rug weave */
export function fabric({ repeat = [1, 1], color = '#4a6075' } = {}) {
  const c = canvas(128), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  noise(g, c.width, c.height, 18, 41);
  return finish(c, { repeat });
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
