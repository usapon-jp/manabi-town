// 草をかった場所・ほった場所の地図。見えない大きな絵（と数字の表）で持つ。
//   絵（canvas）  : 赤＝みち、緑＝花だんの土。 … 草・花が短くなり、地面が土の色になる
//   ほり（dig）   : 0〜1。同じ場所をなぞるたびに 1/3 ずつふかくなり、3回で水がわく
//   水（water）   : 3回ほった所（や池）から、つながった溝へ水がながれこむ
// 方眼ではなく、なぞったとおりの自由な形がそのまま出る。
import * as THREE from 'three';

export const DIG_DEPTH = 0.34;   // いちばん深い所の深さ（m）
export const CUT_R = 32;         // 地図がおおうはんい（中心から）
const N = 256;                   // 地図の細かさ（約0.25m）
const PASS = 3;                  // 水がわくまでの回数

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createCutMask() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
  ctx.globalCompositeOperation = 'lighten'; // 重ねても、いちばん明るい所が残る
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false; tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;

  // ほりの表（見た目用の 8bit の絵にもして、シェーダーが読む）
  const dig = new Float32Array(N * N);    // かくていした深さ
  const sm = new Float32Array(N * N);     // いまなぞっている1回ぶん
  const disp = new Float32Array(N * N);   // 見える深さ = min(1, dig + sm/3)
  const u8 = new Uint8Array(N * N);
  const digTex = new THREE.DataTexture(u8, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  digTex.flipY = false; digTex.generateMipmaps = false;
  digTex.minFilter = THREE.LinearFilter; digTex.magFilter = THREE.LinearFilter;
  let touched = [];
  let digging = false;
  // 水の表: 0 か 255。3回ほった所・池から、つながった溝（1回以上ほった所）が水になる
  const water = new Uint8Array(N * N);
  const waterTex = new THREE.DataTexture(water, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  waterTex.flipY = false; waterTex.generateMipmaps = false;
  waterTex.minFilter = THREE.LinearFilter; waterTex.magFilter = THREE.LinearFilter;
  let sources = [];   // 最初からある池など [{x,z,r}]
  const queue = new Int32Array(N * N);
  // かった所（草が短い所）の表。花をまける場所の判定に使う
  const cutCpu = new Uint8Array(N * N);

  const toPx = (v) => ((v + CUT_R) / (2 * CUT_R)) * N;
  const cellOf = (x, z) => {
    const xx = Math.floor(toPx(x)); const yy = Math.floor(toPx(z));
    return xx < 0 || yy < 0 || xx >= N || yy >= N ? -1 : yy * N + xx;
  };

  function eachCell(px, py, pr, fn) {
    const x0 = Math.max(0, Math.floor(px - pr)); const x1 = Math.min(N - 1, Math.ceil(px + pr));
    const y0 = Math.max(0, Math.floor(py - pr)); const y1 = Math.min(N - 1, Math.ceil(py + pr));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx + 0.5 - px, yy + 0.5 - py) / pr;
      if (d < 1) fn(yy * N + xx, d);
    }
  }
  const setDisp = (i) => { disp[i] = Math.min(1, dig[i] + sm[i] / PASS); u8[i] = Math.round(disp[i] * 255); };

  function stamp(x, z, r, ch) {
    const px = toPx(x); const py = toPx(z); const pr = (r / (2 * CUT_R)) * N;
    if (ch === 'b') {
      eachCell(px, py, pr, (i, d) => {
        const f = d <= 0.72 ? 1 : 1 - (d - 0.72) / 0.28;
        if (f > sm[i]) { if (sm[i] === 0) touched.push(i); sm[i] = f; setDisp(i); }
      });
      return;
    }
    if (ch === 'e') {
      // 草のタネ: 道（赤）と花だんの土（緑）を消す。ほった所は残す
      ctx.globalCompositeOperation = 'multiply';
      const ge = ctx.createRadialGradient(px, py, 0, px, py, pr);
      ge.addColorStop(0, '#00f'); ge.addColorStop(0.72, '#00f'); ge.addColorStop(1, '#fff');
      ctx.fillStyle = ge;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      ctx.globalCompositeOperation = 'lighten';
      eachCell(px, py, pr, (i, d) => { if (d < 0.9) cutCpu[i] = 0; });
      return;
    }
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, '#f00'); g.addColorStop(0.72, '#f00'); g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    eachCell(px, py, pr, (i, d) => { if (d < 0.8) cutCpu[i] = 1; });
  }

  const inside = (poly, x, z) => {
    let c = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i]; const zi = poly[i + 1]; const xj = poly[j]; const zj = poly[j + 1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const bbox = (pts, pad) => {
    let a = 1e9; let b = -1e9; let c = 1e9; let d = -1e9;
    for (let i = 0; i < pts.length; i += 2) { a = Math.min(a, pts[i]); b = Math.max(b, pts[i]); c = Math.min(c, pts[i + 1]); d = Math.max(d, pts[i + 1]); }
    const w = (2 * CUT_R) / N;
    return [Math.max(0, Math.floor(toPx(a - pad))), Math.min(N - 1, Math.ceil(toPx(b + pad))), Math.max(0, Math.floor(toPx(c - pad))), Math.min(N - 1, Math.ceil(toPx(d + pad))), w];
  };
  const distToPoly = (pts, x, z) => {
    let best = 1e9;
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      const ax = pts[i]; const az = pts[i + 1]; const bx = pts[j]; const bz = pts[j + 1];
      const dx = bx - ax; const dz = bz - az; const L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
    return best;
  };

  function digEnd() {
    for (const i of touched) { dig[i] = disp[i]; sm[i] = 0; }
    touched = []; digging = false;
  }

  const api = {
    uniforms: { uCut: { value: tex }, uCutR: { value: CUT_R }, uDig: { value: digTex }, uWater: { value: waterTex } },
    // pts = [x0,z0,x1,z1,...] をつないで、半径 r の筆でなぞる。ch: 'r'=かる 'e'=草にもどす 'b'=ほる（ほりは digEnd までが1回）
    stroke(pts, r, ch = 'r') {
      if (ch === 'b' && !digging) digging = true;
      let lx = pts[0]; let lz = pts[1];
      stamp(lx, lz, r, ch);
      for (let i = 2; i < pts.length; i += 2) {
        const x = pts[i]; const z = pts[i + 1];
        const d = Math.hypot(x - lx, z - lz);
        const n = Math.max(1, Math.ceil(d / (r * 0.3)));
        for (let k = 1; k <= n; k++) stamp(lx + ((x - lx) * k) / n, lz + ((z - lz) * k) / n, r, ch);
        lx = x; lz = z;
      }
      tex.needsUpdate = true; digTex.needsUpdate = true;
    },
    // ほる1回ぶん（保存した操作を、はじめから作りなおすときに使う）
    digStroke(pts, r) { api.stroke(pts, r, 'b'); digEnd(); },
    digEnd,
    // 花だんの中（とじた形）を土にする
    fill(pts) {
      if (pts.length < 6) return;
      ctx.fillStyle = '#0f0'; ctx.strokeStyle = '#0f0'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(toPx(pts[0]), toPx(pts[1]));
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(toPx(pts[i]), toPx(pts[i + 1]));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const [x0, x1, y0, y1, w] = bbox(pts, 0.2);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (inside(pts, -CUT_R + (xx + 0.5) * w, -CUT_R + (yy + 0.5) * w)) cutCpu[yy * N + xx] = 1;
      tex.needsUpdate = true;
    },
    // いけ: とじた形の中を、いちばん深くほる（水がわく）。ふちはなだらかに
    pond(pts) {
      if (pts.length < 6) return;
      const [x0, x1, y0, y1, w] = bbox(pts, 1.4);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const i = yy * N + xx;
        const x = -CUT_R + (xx + 0.5) * w; const z = -CUT_R + (yy + 0.5) * w;
        let v = 0;
        if (inside(pts, x, z)) v = 1;
        else { const d = distToPoly(pts, x, z); if (d < 1.4) v = 0.28 * (1 - d / 1.4); }
        if (v > dig[i]) { dig[i] = v; disp[i] = v; u8[i] = Math.round(v * 255); }
      }
      digTex.needsUpdate = true;
    },
    // ほった深さ（m）。ピヨや花の高さをそろえるのに使う
    digAt(x, z) {
      const i = cellOf(x, z);
      return i < 0 ? 0 : DIG_DEPTH * sstep(0.1, 0.9, disp[i]);
    },
    // 池など、最初からある水。つなげた溝に水がながれこむ
    setSources(list) { sources = list || []; },
    // 水をつくりなおす。3回ほった所・池から、つながった溝（1回以上ほった所）まで水になる。ほる操作のあとに呼ぶ
    updateWater() {
      water.fill(0);
      let qh = 0; let qt = 0;
      const w = (2 * CUT_R) / N;
      const seed = (i) => { if (!water[i]) { water[i] = 255; queue[qt++] = i; } };
      for (let i = 0; i < N * N; i++) if (disp[i] >= 0.9) seed(i);
      for (const s of sources) {
        const x0 = Math.max(0, Math.floor(toPx(s.x - s.r))); const x1 = Math.min(N - 1, Math.ceil(toPx(s.x + s.r)));
        const y0 = Math.max(0, Math.floor(toPx(s.z - s.r))); const y1 = Math.min(N - 1, Math.ceil(toPx(s.z + s.r)));
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
          if (Math.hypot(-CUT_R + (xx + 0.5) * w - s.x, -CUT_R + (yy + 0.5) * w - s.z) <= s.r) seed(yy * N + xx);
        }
      }
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % N; const y = (i / N) | 0;
        if (x > 0) { const j = i - 1; if (!water[j] && disp[j] >= 0.3) seed(j); }
        if (x < N - 1) { const j = i + 1; if (!water[j] && disp[j] >= 0.3) seed(j); }
        if (y > 0) { const j = i - N; if (!water[j] && disp[j] >= 0.3) seed(j); }
        if (y < N - 1) { const j = i + N; if (!water[j] && disp[j] >= 0.3) seed(j); }
      }
      waterTex.needsUpdate = true;
    },
    // 水があるか
    isWater(x, z) { const i = cellOf(x, z); return i >= 0 && water[i] > 0; },
    // 草をかった土の上か（花のタネをまける所）。ほった所はだめ
    isCut(x, z) { const i = cellOf(x, z); return i >= 0 && cutCpu[i] === 1 && disp[i] < 0.05; },
    clear() {
      dig.fill(0); sm.fill(0); disp.fill(0); u8.fill(0); cutCpu.fill(0); water.fill(0); touched = []; digging = false;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
      ctx.globalCompositeOperation = 'lighten';
      tex.needsUpdate = true; digTex.needsUpdate = true; waterTex.needsUpdate = true;
    },
  };
  return api;
}
