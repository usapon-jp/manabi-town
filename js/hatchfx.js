// たまごが われて なかまが 生まれる 演出（js/eggs3d.js の hatch から 使う。2026-11-26 フミオさん OK）。
// 時間 k（秒）を わたすと その瞬間の すがたに する「時間だけで きまる」作り。
// → 動画の書き出し（lab/hatch/）でも ゲームの update(dt) でも 同じ見た目になる。
// 流れ: 3回 ゆれて ひびが のびる → ぎゅっと ためて ひびから 光 → 上の からが とぶ（かけら・光・きらきら）
//      → なかまが とびだして 着地 → きょろきょろ → うれしい ぴょん×2。
// なかまの 骨（Head・Neck・Tail1〜3）が あれば 首と しっぽも うごかす。無ければ 体だけ。
// 重さ: たまごの から 2まい（約1,400三角形）＋ スプライト 30まい。ひびの 絵は ひびが のびる ときだけ かきなおす。
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const HATCH_LEN = 5.4;          // 全体の 長さ（秒）
const POP = 2.35;                      // 上の からが とぶ 時刻
const CUT = 0.66, SEAM_N = 22;          // われめの 高さ と かどの数（山 11こ）
const SEG = SEAM_N * 3, ROWS = 14;     // かどが 頂点に のるように

const lighten = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();
const cssOf = (hex) => `#${new THREE.Color(hex).getHexString()}`;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// たまごの 形（js/eggs3d.js の eggGeometry と 同じ式）: 高さ y(0..1) → 半径
const radiusAt = (y) => { const t = Math.acos(1 - 2 * Math.min(1, Math.max(0, y))); return Math.sin(t) * (1 + 0.13 * Math.cos(t)) * 0.38; };
const vOf = (y) => Math.acos(1 - 2 * Math.min(1, Math.max(0, y))) / Math.PI;
// われめ: 山と谷が ふぞろいの ぎざぎざ（手で われた 感じ）。u = 0..1（まわり、0 が 正面）
const SEAM = (() => { const r = rand(23); return Array.from({ length: SEAM_N }, (_, i) => (i % 2 ? -1 : 1) * (0.018 + r() * 0.028) + (r() - 0.5) * 0.01); })();
const seamY = (u) => {
  const f = (((u % 1) + 1) % 1) * SEAM_N, i = Math.floor(f), t = f - i;
  return CUT + SEAM[i % SEAM_N] * (1 - t) + SEAM[(i + 1) % SEAM_N] * t;
};
// えだわかれの ひび（かどから 2〜3 つの 折れ線）
const TWIGS = (() => {
  const r = rand(5), out = [];
  for (let i = 0; i < SEAM_N; i++) {
    if (r() < 0.6) continue;
    const u = (i / SEAM_N) > 0.5 ? i / SEAM_N - 1 : i / SEAM_N;
    const up = SEAM[i] > 0 ? -1 : 1;      // 山なら 上へ（画面の y は 下が +）
    const n = 1 + Math.floor(r() * 2); let dx = 0, dy = 0; const pts = [];
    for (let j = 0; j < n; j++) { dx += (r() - 0.5) * 6; dy += up * (2 + r() * 2.5); pts.push([dx, dy]); }
    out.push({ u, pts });
  }
  return out;
})();

// y0(u)..y1(u) の あいだの からを つくる。uv は もとの たまごと 同じ（もようが つながる）
function shellGeo(y0, y1) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG, a = u * TAU, lo = y0(u), hi = y1(u);
    for (let j = 0; j <= ROWS; j++) {
      const y = lo + (hi - lo) * (j / ROWS);
      const r = Math.max(0.0005, radiusAt(y));
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push(u, vOf(y));
    }
  }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < ROWS; j++) {
    const a = i * (ROWS + 1) + j, b = a + ROWS + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// もよう＋ひび。crack: 0..1（正面の 1点から 左右へ のびる）、glow: ひびの 中の 光 0..1
function drawEgg(x, color, crack, glow) {
  const W = x.canvas.width, H = x.canvas.height, S = W / 256;
  x.fillStyle = cssOf(color); x.fillRect(0, 0, W, H);
  // 白い ぎざぎざの おび（js/eggs3d.js の もようと 同じ 配置）
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.beginPath(); x.moveTo(0, 62 * S);
  for (let i = 0; i <= 16; i++) x.lineTo(i * 16 * S, (i % 2 ? 54 : 70) * S);
  x.lineTo(W, 78 * S); for (let i = 16; i >= 0; i--) x.lineTo(i * 16 * S, ((i % 2 ? 54 : 70) + 12) * S); x.closePath(); x.fill();
  x.fillStyle = cssOf(lighten(color, 0.55));
  for (let i = 0; i < 8; i++) { x.beginPath(); x.arc((16 + i * 32) * S, (i % 2 ? 30 : 100) * S, 7 * S, 0, TAU); x.fill(); }
  if (crack <= 0) return;
  const P = (u, y) => [u * W, (1 - vOf(y)) * H];          // まわりは つなげて かいて、あとで 左右に ずらして 2回 かく
  // われめの 線（かどの 点を つなぐ）。正面 u=0 から 左右へ half まで → 1本の 線
  const half = crack * 0.5;
  const line = [];
  for (let i = -SEAM_N; i <= SEAM_N; i++) {
    const u = i / SEAM_N;
    if (u < -half || u > half) continue;
    line.push(P(u, seamY(u)));
  }
  if (half > 0) { line.unshift(P(-half, seamY(-half))); line.push(P(half, seamY(half))); }
  const stroke = (pts, w, style) => {
    if (pts.length < 2) return;
    x.strokeStyle = style; x.lineWidth = w; x.lineJoin = 'miter'; x.miterLimit = 6; x.lineCap = 'round';
    for (const ox of [0, W, -W]) {
      x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px + ox, py) : x.moveTo(px + ox, py))); x.stroke();
    }
  };
  const lines = [line];
  // えだわかれ: かどから 上下に のびる 細い ひび（ひびが そこまで 来たら 出る）
  const twigs = [];
  for (const t of TWIGS) if (Math.abs(t.u) < half) {
    const [px, py] = P(t.u, seamY(t.u));
    const k = clamp01((half - Math.abs(t.u)) / 0.06);
    const pts = [[px, py]];
    t.pts.forEach(([dx, dy]) => pts.push([px + dx * S * k, py + dy * S * k]));
    twigs.push(pts);
  }
  // こげ茶の ひび（本線 太め・枝 細め）。ためる ときは ひびの 中が 黄色く 光る
  if (glow > 0) {
    x.save(); x.shadowColor = `rgba(255,214,110,${glow})`; x.shadowBlur = 14 * S;
    stroke(line, 3.2 * S, `rgba(255,226,140,${glow})`);
    x.restore();
  }
  stroke(line, 1.7 * S, '#4b3427');
  for (const t of twigs) stroke(t, 0.8 * S, '#5a4032');
  if (glow > 0) stroke(line, 1.2 * S, `rgba(255,244,190,${Math.min(1, glow * 1.4)})`);
}

// ふわっと 光る 丸（ひかり・ほこり 用）
let dotTex = null;
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 29);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.generateMipmaps = false; dotTex.minFilter = THREE.LinearFilter;
  return dotTex;
}

// chara: なかまの Object3D（足元 y=0、正面 +Z）。bones があれば 頭・しっぽも うごかす
export function createHatch({ color, eggH = 0.6, chara }) {
  const root = new THREE.Group();
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  let crackNow = -1, glowNow = -1;
  const setCrack = (c, g = 0) => { c = Math.round(c * 40) / 40; g = Math.round(g * 12) / 12; if (c === crackNow && g === glowNow) return; crackNow = c; glowNow = g; drawEgg(ctx, color, c, g); tex.needsUpdate = true; };
  setCrack(0);

  const outer = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffe2a0, emissiveIntensity: 0 });
  const inner = new THREE.MeshLambertMaterial({ color: 0xfff6e2, side: THREE.BackSide, emissive: 0xffd77a, emissiveIntensity: 0.25 });
  const pieces = (geo) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, outer), new THREE.Mesh(geo, inner)); return g; };
  const bottomGeo = shellGeo(() => 0, seamY), topGeo = shellGeo(seamY, () => 1);
  const egg = new THREE.Group();            // ゆれる 全体
  const bottom = pieces(bottomGeo), top = new THREE.Group();
  const topMesh = pieces(topGeo);
  topMesh.position.y = -0.8; top.position.y = 0.8; top.add(topMesh);   // 回る 中心を からの まんなかに
  egg.add(bottom, top);
  egg.scale.setScalar(eggH);
  root.add(egg);

  // かけら（白っぽい 小さな 三角）
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 0.8, 0], 3));
  shardGeo.computeVertexNormals();
  const shardMat = new THREE.MeshLambertMaterial({ color: lighten(color, 0.25), side: THREE.DoubleSide, transparent: true });
  const shards = [];
  const rs = rand(11);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(shardGeo, i % 3 ? shardMat : inner);
    m.visible = false;
    const a = (i / 12) * TAU + rs() * 0.4;
    shards.push({ m, a, sp: 0.8 + rs() * 0.9, vy: 1.6 + rs() * 1.6, spin: (rs() - 0.5) * 18, s: 0.05 + rs() * 0.05 });
    root.add(m);
  }
  // 光（ぱっと ひろがる）と きらきら
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xfff0b8, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  root.add(flash);
  const beams = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffd76a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  root.add(beams);
  const sparks = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: i % 2 ? 0xfff3a8 : lighten(color, 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.visible = false;
    const a = (i / 22) * TAU + rs() * 0.3;
    sparks.push({ s, a, sp: 0.4 + rs() * 0.9, vy: 1.4 + rs() * 1.8, life: 0.9 + rs() * 0.8, d: rs() * 0.25 });
    root.add(s);
  }

  // なかま
  const holder = new THREE.Group();
  root.add(holder);
  let bone = {};
  // なかまを 入れる（あとから 入れかえ できる）。restore() で 骨を もとに もどす
  function setChara(obj) {
    restore(); bone = {};
    holder.clear();
    if (!obj) return;
    holder.add(obj);
    obj.traverse((o) => { if (o.isBone) bone[o.name] = { o, q: o.quaternion.clone() }; });
  }
  function restore() { for (const b of Object.values(bone)) b.o.quaternion.copy(b.q); }
  setChara(chara);
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const turn = (name, x, y, z) => {
    const b = bone[name]; if (!b) return;
    tmpQ.setFromEuler(tmpE.set(x, y, z));
    b.o.quaternion.copy(b.q).multiply(tmpQ);
  };

  // k 秒目の すがた
  function pose(k) {
    // ---- 1. ゆれる（3回、だんだん 強く）→ ひびが のびる ----
    let rot = 0, hop = 0, sq = 1, glow = 0, crack = 0;
    for (const [at, amp, len] of [[0.15, 0.16, 0.5], [0.8, 0.24, 0.55], [1.4, 0.32, 0.6]]) {
      const t = k - at;
      if (t > 0 && t < len) { const e = Math.sin((t / len) * Math.PI); rot += Math.sin(t * 26) * amp * e; hop = Math.max(hop, Math.abs(Math.sin(t * 13)) * 0.05 * e); }
    }
    crack = 0.25 * smooth(0.2, 0.55, k) + 0.3 * smooth(0.85, 1.2, k) + 0.45 * smooth(1.45, 1.9, k);
    // ---- 2. ためる（ぎゅっと ちぢんで ふるえる・光る）----
    if (k > 2.0 && k < POP) {
      const t = (k - 2.0) / (POP - 2.0);
      sq = 1 - 0.1 * t; rot += Math.sin(k * 70) * 0.05 * t;
    } else if (k >= POP && k < POP + 0.25) {
      sq = 1 + 0.12 * Math.sin(((k - POP) / 0.25) * Math.PI);
    }
    glow = Math.max(smooth(1.6, POP, k) * 1.2, k > 0.2 && k < 2 ? 0.15 + 0.15 * Math.sin(k * 6) : 0);
    if (k > POP) glow = 1.2 * (1 - smooth(POP, POP + 0.8, k));
    setCrack(Math.min(1, crack), k < POP ? smooth(1.5, POP, k) : 0);
    outer.emissiveIntensity = glow * 0.12;
    egg.rotation.z = k < POP ? rot : 0;
    egg.position.y = k < POP ? hop : 0;
    egg.scale.set(eggH * (2 - sq) ** 0.5, eggH * sq, eggH * (2 - sq) ** 0.5);

    // ---- 3. ぱかっ: 上の からが とぶ ----
    const tp = k - POP;
    if (tp >= 0) {
      top.position.set(0.55 * tp, 0.8 + 4.2 * tp - 6 * tp * tp, -0.5 * tp);
      top.rotation.set(-tp * 4, 0, -tp * 7);
      const f = 1 - smooth(0.45, 0.8, tp);
      top.scale.setScalar(f);
      top.visible = f > 0.01;
    } else { top.position.set(0, 0.8, 0); top.rotation.set(0, 0, 0); top.scale.setScalar(1); top.visible = true; }
    // 下の から: なかまが 出たあと すこしして しずむ
    const bs = 1 - smooth(4.4, 5.0, k);
    bottom.scale.set(1, bs, 1); bottom.visible = bs > 0.01;
    // かけら
    for (const p of shards) {
      const t = tp;
      p.m.visible = t > 0 && t < 1.3;
      if (!p.m.visible) continue;
      const y = Math.max(0.02, eggH * CUT + p.vy * t - 4.5 * t * t);
      p.m.position.set(Math.sin(p.a) * (0.18 + p.sp * t), y, Math.cos(p.a) * (0.18 + p.sp * t));
      p.m.rotation.set(p.spin * t, p.a, p.spin * 0.6 * t);
      p.m.scale.setScalar(p.s * (1 - smooth(0.9, 1.3, t)));
    }
    // 光
    const fl = tp >= 0 ? Math.exp(-tp * 4.5) : 0;
    flash.material.opacity = fl * 0.85;
    flash.scale.setScalar(0.4 + (tp >= 0 ? (1 - Math.exp(-tp * 9)) * 1.5 : 0));
    flash.position.set(0, eggH * 0.65, 0);
    const pre = smooth(1.7, POP, k) * (k < POP ? 1 : 0);
    beams.material.opacity = pre * (0.55 + 0.25 * Math.sin(k * 40));
    beams.scale.setScalar(0.5 + pre * 0.9);
    beams.position.set(0, eggH * CUT, 0);
    for (const p of sparks) {
      const t = tp - p.d;
      p.s.visible = t > 0 && t < p.life;
      if (!p.s.visible) continue;
      p.s.position.set(Math.sin(p.a) * p.sp * t * 1.4, eggH * 0.6 + p.vy * t - 1.6 * t * t, Math.cos(p.a) * p.sp * t * 1.4);
      const q = t / p.life;
      p.s.material.opacity = Math.sin(q * Math.PI);
      p.s.scale.setScalar(0.08 + 0.12 * (1 - q));
    }

    // ---- 4. なかまが とびだす → 着地 → きょろきょろ → うれしい ぴょん ----
    const tc = k - POP - 0.05;
    holder.visible = tc > 0;
    if (tc > 0) {
      let y, z, s, sy = 1;
      if (tc < 0.55) {               // からの 中から ぴょーん
        const t = tc / 0.55;
        y = -0.15 + 0.15 * t + 0.75 * Math.sin(t * Math.PI) * (1 - 0.3 * t);
        z = 0.42 * smooth(0.15, 1, t);
        s = 0.55 + 0.45 * easeOutBack(clamp01(t * 1.3));
        sy = 1 + 0.18 * Math.sin(t * Math.PI);
      } else {
        y = 0; z = 0.42; s = 1;
        const t = tc - 0.55;
        if (t < 0.3) sy = 1 - 0.2 * Math.sin((t / 0.3) * Math.PI);   // 着地で むぎゅ
        const h = tc - 2.05;                                           // うれしい ぴょん×2
        if (h > 0 && h < 0.8) { const q = (h % 0.4) / 0.4; y = Math.sin(q * Math.PI) * 0.16; sy = 1 + 0.08 * Math.sin(q * Math.PI) - (q < 0.15 ? 0.1 : 0); }
      }
      holder.position.set(0, Math.max(-0.2, y), z);
      holder.scale.set(s * (1 / Math.sqrt(sy)), s * sy, s * (1 / Math.sqrt(sy)));
      holder.rotation.y = 0;
      // 頭: 出た しゅんかん 上を見る → 左右 きょろきょろ → くびかしげ
      const look = tc < 0.6 ? -0.25 * Math.sin((tc / 0.6) * Math.PI) : 0;
      const side = tc > 0.75 && tc < 1.9 ? Math.sin(((tc - 0.75) / 1.15) * TAU) * 0.45 : 0;
      const tilt = smooth(1.9, 2.1, tc) * 0.22;
      turn('Head', look, side, tilt);
      turn('Neck', look * 0.5, side * 0.3, 0);
      const wag = Math.sin(tc * (tc > 2 ? 14 : 7)) * (tc > 2 ? 0.55 : 0.3);
      turn('Tail1', 0, 0, wag * 0.5); turn('Tail2', 0, 0, wag * 0.7); turn('Tail3', 0, 0, wag);
    }
  }
  pose(0);
  return {
    root, holder, pose, setChara, restore, length: HATCH_LEN,
    dispose() {
      restore(); holder.clear();
      tex.dispose(); bottomGeo.dispose(); topGeo.dispose(); shardGeo.dispose();
      outer.dispose(); inner.dispose(); shardMat.dispose();
      for (const sp of [flash, beams, ...sparks.map((p) => p.s)]) sp.material.dispose();
    },
  };
}
