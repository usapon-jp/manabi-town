// 「つくる」: 子どもが草原を自分で作りかえる。
//   みち … 草をかって、指でなぞった自由な形の道をつくる
//   はな … 好きな場所に花をうえる／なぞった形を丸太・石でかこんで花だんにする
//   かわ … 地面をほって川（ながれ）や小さな池をつくる（水はかんたんな水面）
// やったことは1つずつ「操作」として覚えるので、「もどす」でいつでも取り消せ、
// 操作のたびにプロフィールへ自動で保存される（きょうだいごとに別の草原）。
// 画面の部品は world のコンテナの中に自分で作る（index.html・css・main.js には触らない）。
import * as THREE from 'three';
import { currentProfile, save, onChange } from './store.js';
import { heightAt } from './terrain.js';
import { createBuilds, STAMP_STEP, loopLength, LOOP_MIN } from './builds.js';
import { SPECIES, SPECIES_KEYS } from './plants.js';
import { icon } from './icons.js';

const MAX_OPS = 300;      // 覚えておく操作の数（保存の大きさをおさえる）
const MAX_PTS = 400;      // ひとなぞりの点の数
const MIN_STEP = 0.35;    // 点を打つ最小のきょり（m）。細かすぎると保存が重い
const RING_STEP = 0.5;
const ROAM = 29;          // つくれるはんい（中心から）
const BRUSH = [0.7, 1.2, 1.9];
const RBRUSH = [0.6, 0.95, 1.4];   // 川のはば
const BRUSH_NAME = ['ほそい', 'ふつう', 'ふとい'];
const DOT = { buttercup: '#ffd62e', lupine: '#a58bf0', tulip: '#ff8fae', clover: '#f4f1ea', dandelion: '#ffe777' };

const CSS = `
.wedit { position: fixed; right: calc(8px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); z-index: 4;
  display: flex; flex-direction: column; gap: 5px; align-items: stretch; width: 58px; font-family: inherit; -webkit-user-select: none; user-select: none; }
.wedit[hidden], .wedit-sub[hidden] { display: none; }
.wedit button, .wedit-sub button { all: unset; box-sizing: border-box; cursor: pointer; text-align: center; font-size: 12px; font-weight: 700; line-height: 1;
  padding: 8px 2px; border-radius: 14px; background: rgba(255, 252, 240, 0.93); color: #6b4a2b; border: 2px solid #e2d3ad;
  box-shadow: 0 2px 6px rgba(80, 60, 30, 0.18); -webkit-tap-highlight-color: transparent; }
.wedit button:active, .wedit-sub button:active { transform: scale(0.96); }
.wedit button.on, .wedit-sub button.on { background: #8aa66a; color: #fff; border-color: #6f8c52; }
.wedit button[disabled] { opacity: 0.45; cursor: default; }
.wedit .fab { display: grid; place-items: center; gap: 3px; padding: 8px 4px; font-size: 12px; }
.wedit .fab svg { width: 28px; height: 28px; stroke-width: 1.8; }
.wedit .fab { background: rgba(255, 255, 255, 0.13); border: 1.5px solid rgba(255, 255, 255, 0.55); color: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.14);
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
.wedit .fab svg { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)); }
.wedit .fab.on { background: rgba(138, 166, 106, 0.85); border-color: rgba(255, 255, 255, 0.8); }
.wedit .tools { display: flex; flex-direction: column; gap: 5px; }
.wedit .tools[hidden] { display: none; }
.wedit .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.wedit .row2 button { padding: 7px 0; font-size: 13px; }
.wedit .size { display: grid; place-items: center; gap: 3px; }
.wedit .size i { display: block; border-radius: 50%; background: #c9a35e; }
.wedit-sub { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 158px); transform: translateX(-50%); z-index: 4;
  display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; max-width: calc(100vw - 20px); padding: 6px; border-radius: 18px;
  background: rgba(255, 252, 240, 0.75); font-family: inherit; -webkit-user-select: none; user-select: none; }
.wedit-sub button { padding: 9px 10px; font-size: 13px; white-space: nowrap; }
.wedit-sub .sw { width: 38px; height: 38px; padding: 0; border-radius: 50%; border-width: 3px; box-shadow: 0 2px 5px rgba(80,60,30,.25); }
.wedit-sub .sw.on { border-color: #6f8c52; box-shadow: 0 0 0 3px #fff, 0 2px 6px rgba(80,60,30,.3); }
.wedit-sub .sep { width: 2px; height: 26px; background: #e2d3ad; border-radius: 1px; }
@media (orientation: landscape) { .wedit-sub { bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); } }
.wedit-msg { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 74px); transform: translateX(-50%); z-index: 6; padding: 8px 14px;
  border-radius: 14px; background: rgba(255, 252, 240, 0.96); color: #6b4a2b; font-weight: 700; font-size: 14px; border: 2px solid #e2d3ad; pointer-events: none; }
`;

export function createEditor({ container, scene, cut, wind, pick, rotate }) {
  const st = {
    editing: false, tool: 'path', size: 1, stroke: null, loadedId: null, visible: false,
    bedMode: 'plant', species: 'tulip', border: 'log', riverMode: 'line',
  };
  const builds = createBuilds({ scene, wind, cut });

  // ---- 保存（プロフィールごと） ----
  const ops = () => {
    const p = currentProfile();
    if (!p) return null;
    if (!p.world || !Array.isArray(p.world.ops)) p.world = { v: 1, ops: [] };
    return p.world.ops;
  };
  const replay = () => builds.rebuild(ops() || []);
  // プロフィールが変わったら、そのこの草原にきりかえる
  function sync() {
    const p = currentProfile();
    const id = p ? p.id : null;
    if (id === st.loadedId) return;
    st.loadedId = id;
    replay();
    refreshButtons();
  }

  // ---- 画面の部品 ----
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'wedit';
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="fab" data-a="toggle" aria-label="つくる">
      <span class="fab-ic"></span>
      <span>つくる</span>
    </button>
    <div class="tools" hidden>
      <button type="button" data-a="tool" data-v="path">みち</button>
      <button type="button" data-a="tool" data-v="bed">はな</button>
      <button type="button" data-a="tool" data-v="river">かわ</button>
      <button type="button" class="size" data-a="size"></button>
      <div class="row2"><button type="button" data-a="left" aria-label="左をむく">◀</button><button type="button" data-a="right" aria-label="右をむく">▶</button></div>
      <button type="button" data-a="undo">もどす</button>
      <button type="button" data-a="done">おわり</button>
    </div>`;
  root.querySelector('.fab-ic').replaceWith(icon('sprout'));
  container.appendChild(root);
  // 「はな」のときだけ出る、画面した中央の道具ぶくろ
  const sub = document.createElement('div');
  sub.className = 'wedit-sub';
  sub.hidden = true;
  sub.innerHTML = `
    <span data-group="river"><button type="button" data-s="rmode" data-v="line">ながれ</button> <button type="button" data-s="rmode" data-v="pond">いけ</button></span>
    <span data-group="bed"><button type="button" data-s="mode" data-v="plant">うえる</button>
    <button type="button" data-s="mode" data-v="ring">かこむ</button>
    <span class="sep"></span></span>
    <span data-group="plant">${SPECIES_KEYS.map((k) => `<button type="button" class="sw" data-s="species" data-v="${k}" aria-label="${SPECIES[k].label}" style="background:${DOT[k]}"></button>`).join(' ')}</span>
    <span data-group="ring"><button type="button" data-s="border" data-v="log">まるた</button> <button type="button" data-s="border" data-v="stone">いし</button></span>`;
  container.appendChild(sub);
  const q = (a) => root.querySelector(`[data-a="${a}"]`);
  const toolsEl = root.querySelector('.tools');
  let msgEl = null; let msgTimer = 0;
  function say(text) {
    if (!msgEl) { msgEl = document.createElement('div'); msgEl.className = 'wedit-msg'; document.body.appendChild(msgEl); }
    msgEl.textContent = text; msgEl.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msgEl.hidden = true; }, 1800);
  }
  function refreshButtons() {
    q('toggle').classList.toggle('on', st.editing);
    toolsEl.hidden = !st.editing;
    root.querySelectorAll('[data-a="tool"]').forEach((b) => b.classList.toggle('on', b.dataset.v === st.tool));
    const dot = 8 + st.size * 5;
    q('size').innerHTML = `<i style="width:${dot}px;height:${dot}px"></i><span>${BRUSH_NAME[st.size]}</span>`;
    q('size').hidden = !(st.tool === 'path' || (st.tool === 'river' && st.riverMode === 'line'));
    q('undo').disabled = !(ops() || []).length;
    sub.hidden = !(st.editing && (st.tool === 'bed' || st.tool === 'river'));
    sub.querySelectorAll('[data-s="mode"]').forEach((b) => b.classList.toggle('on', b.dataset.v === st.bedMode));
    sub.querySelectorAll('[data-s="species"]').forEach((b) => b.classList.toggle('on', b.dataset.v === st.species));
    sub.querySelectorAll('[data-s="border"]').forEach((b) => b.classList.toggle('on', b.dataset.v === st.border));
    sub.querySelectorAll('[data-s="rmode"]').forEach((b) => b.classList.toggle('on', b.dataset.v === st.riverMode));
    const bed = st.tool === 'bed';
    sub.querySelector('[data-group="river"]').hidden = bed;
    sub.querySelector('[data-group="bed"]').hidden = !bed;
    sub.querySelector('[data-group="plant"]').hidden = !bed || st.bedMode !== 'plant';
    sub.querySelector('[data-group="ring"]').hidden = !bed || st.bedMode !== 'ring';
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'toggle') setEditing(!st.editing);
    else if (a === 'done') setEditing(false);
    else if (a === 'tool') { st.tool = b.dataset.v; refreshButtons(); }
    else if (a === 'size') { st.size = (st.size + 1) % BRUSH.length; refreshButtons(); }
    else if (a === 'left') rotate(-0.45);
    else if (a === 'right') rotate(0.45);
    else if (a === 'undo') undo();
  });
  sub.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = b.dataset.s;
    if (k === 'mode') st.bedMode = b.dataset.v;
    else if (k === 'rmode') st.riverMode = b.dataset.v;
    else if (k === 'species') st.species = b.dataset.v;
    else if (k === 'border') st.border = b.dataset.v;
    refreshButtons();
  });

  // なぞっているあいだの丸い目印と、かこみの線
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.renderOrder = 5;
  scene.add(ring);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((MAX_PTS + 2) * 3), 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xfff3b0, depthTest: false, transparent: true }));
  trail.frustumCulled = false;
  trail.renderOrder = 6;
  trail.visible = false;
  scene.add(trail);
  function drawTrail(pts, close) {
    const a = trailGeo.attributes.position;
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) a.setXYZ(i, pts[i * 2], heightAt(pts[i * 2], pts[i * 2 + 1]) + 0.15, pts[i * 2 + 1]);
    let cnt = n;
    if (close && n > 2) { a.setXYZ(n, pts[0], heightAt(pts[0], pts[1]) + 0.15, pts[1]); cnt = n + 1; }
    a.needsUpdate = true;
    trailGeo.setDrawRange(0, cnt);
    trail.visible = true;
  }

  function setEditing(on) {
    st.editing = on && st.visible;
    st.stroke = null;
    ring.visible = false;
    trail.visible = false;
    refreshButtons();
  }

  // ---- 操作 ----
  function commit(op) {
    const list = ops();
    if (!list) return false;
    if (list.length >= MAX_OPS) { say('もう いっぱい！ もどして へらしてね'); replay(); return false; }
    list.push(op);
    save();              // 自動保存
    refreshButtons();
    return true;
  }
  function undo() {
    const list = ops();
    if (!list || !list.length) return;
    list.pop();
    replay();
    save();
    refreshButtons();
    say('ひとつ もどしたよ');
  }

  const brushR = () => (st.tool === 'path' ? BRUSH[st.size] : st.tool === 'river' ? (st.riverMode === 'line' ? RBRUSH[st.size] : 0.3) : st.bedMode === 'plant' ? 0.55 : 0.3);
  function place(p) {
    const r = Math.hypot(p.x, p.z);
    if (r > ROAM) { p.x *= ROAM / r; p.z *= ROAM / r; }
    ring.position.set(p.x, heightAt(p.x, p.z) + 0.08, p.z);
    ring.scale.setScalar(brushR());
  }
  const round = (v) => Math.round(v * 10) / 10;

  // world.js の pointer から呼ばれる（editing のあいだだけ）
  function pointer(type, e) {
    if (type === 'down') {
      const p = pick(e);
      if (!p) return;
      place(p);
      ring.visible = true;
      const last = { x: p.x, z: p.z };
      if (st.tool === 'path') {
        const r = BRUSH[st.size];
        st.stroke = { kind: 'path', r, pts: [round(p.x), round(p.z)], last };
        cut.stroke([p.x, p.z], r);
      } else if (st.tool === 'river' && st.riverMode === 'line') {
        const r = RBRUSH[st.size];
        st.stroke = { kind: 'dig', r, pts: [round(p.x), round(p.z)], last };
        cut.stroke([p.x, p.z], r, 'b');
      } else if (st.tool === 'river') {
        st.stroke = { kind: 'pond', pts: [round(p.x), round(p.z)], last };
        drawTrail(st.stroke.pts, false);
      } else if (st.tool === 'bed' && st.bedMode === 'plant') {
        const seed = 1 + Math.floor(Math.random() * 1e6);
        st.stroke = { kind: 'plant', s: st.species, seed, pts: [], last };
        stamp(st.stroke, p);
      } else if (st.tool === 'bed') {
        st.stroke = { kind: 'ring', k: st.border, seed: 1 + Math.floor(Math.random() * 1e6), pts: [round(p.x), round(p.z)], last };
        drawTrail(st.stroke.pts, false);
      }
    } else if (type === 'move') {
      const p = pick(e);
      if (!p) return;
      place(p);
      const s = st.stroke;
      if (!s) return;
      const d = Math.hypot(p.x - s.last.x, p.z - s.last.z);
      if (s.kind === 'path' || s.kind === 'dig') {
        if (d < MIN_STEP || s.pts.length >= MAX_PTS * 2) return;
        cut.stroke([s.last.x, s.last.z, p.x, p.z], s.r, s.kind === 'dig' ? 'b' : 'r');
        s.pts.push(round(p.x), round(p.z));
        s.last = { x: p.x, z: p.z };
      } else if (s.kind === 'plant') {
        if (d < STAMP_STEP) return;
        stamp(s, p);
      } else if (s.kind === 'ring' || s.kind === 'pond') {
        if (d < RING_STEP || s.pts.length >= MAX_PTS * 2) return;
        s.pts.push(round(p.x), round(p.z));
        s.last = { x: p.x, z: p.z };
        drawTrail(s.pts, true);
      }
    } else {
      ring.visible = false;
      trail.visible = false;
      const s = st.stroke;
      st.stroke = null;
      if (!s) return;
      if (type !== 'up') { replay(); return; }     // とちゅうでキャンセルされたら、なかったことにする
      if (s.kind === 'path') commit({ t: 'path', r: s.r, pts: s.pts });
      else if (s.kind === 'dig') { if (commit({ t: 'dig', r: s.r, pts: s.pts })) replay(); }   // 高さが変わるので、花などを置きなおす
      else if (s.kind === 'pond') {
        if (loopLength(s.pts) < LOOP_MIN) { say('もっと ひろく かこんでね'); return; }
        if (commit({ t: 'pond', pts: s.pts })) replay();
      }
      else if (s.kind === 'plant') { if (s.pts.length) commit({ t: 'plant', s: s.s, seed: s.seed, pts: s.pts }); }
      else if (s.kind === 'ring') {
        if (loopLength(s.pts) < LOOP_MIN) { say('もっと ひろく かこんでね'); return; }
        const op = { t: 'ring', k: s.k, seed: s.seed, pts: s.pts };
        if (commit(op)) builds.apply(op);
      }
    }
  }
  // 花を1スタンプうえる（見た目はすぐ出す。いっぱいなら出さない）
  function stamp(s, p) {
    if (!builds.room(s.s)) { say('この花は もう いっぱい！'); return; }
    builds.addStamp(s.s, p.x, p.z, s.seed, s.pts.length / 2);
    s.pts.push(round(p.x), round(p.z));
    s.last = { x: p.x, z: p.z };
  }

  onChange(sync);
  sync();

  return {
    get active() { return st.editing; },
    pointer,
    // ホーム画面が出ているときだけボタンを出す
    setVisible(on) {
      st.visible = on;
      root.hidden = !on;
      if (!on) setEditing(false);
    },
  };
}
