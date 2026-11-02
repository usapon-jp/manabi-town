// 「つくる」: 子どもが草原を自分で作りかえる。いまは「みち」（草をかって自由な形の道をつくる）。
// やったことは1つずつ「操作」として覚えるので、「もどす」でいつでも取り消せ、
// 操作のたびにプロフィールへ自動で保存される（きょうだいごとに別の草原）。
// 画面の部品は world のコンテナの中に自分で作る（index.html・css・main.js には触らない）。
import * as THREE from 'three';
import { currentProfile, save, onChange } from './store.js';
import { heightAt } from './terrain.js';

const MAX_OPS = 300;      // 覚えておく操作の数（保存の大きさをおさえる）
const MAX_PTS = 400;      // ひとなぞりの点の数
const MIN_STEP = 0.35;    // 点を打つ最小のきょり（m）。細かすぎると保存が重い
const ROAM = 29;          // つくれるはんい（中心から）
const BRUSH = [0.7, 1.2, 1.9];
const BRUSH_NAME = ['ほそい', 'ふつう', 'ふとい'];

const CSS = `
.wedit { position: fixed; right: calc(8px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); z-index: 4;
  display: flex; flex-direction: column; gap: 5px; align-items: stretch; width: 58px; font-family: inherit; -webkit-user-select: none; user-select: none; }
.wedit[hidden] { display: none; }
.wedit button { all: unset; box-sizing: border-box; cursor: pointer; text-align: center; font-size: 12px; font-weight: 700; line-height: 1;
  padding: 8px 2px; border-radius: 14px; background: rgba(255, 252, 240, 0.93); color: #6b4a2b; border: 2px solid #e2d3ad;
  box-shadow: 0 2px 6px rgba(80, 60, 30, 0.18); -webkit-tap-highlight-color: transparent; }
.wedit button:active { transform: scale(0.96); }
.wedit button.on { background: #8aa66a; color: #fff; border-color: #6f8c52; }
.wedit button[disabled] { opacity: 0.45; cursor: default; }
.wedit .fab { display: grid; place-items: center; gap: 3px; padding: 8px 4px; font-size: 12px; }
.wedit .fab svg { width: 24px; height: 24px; }
.wedit .tools { display: flex; flex-direction: column; gap: 5px; }
.wedit .tools[hidden] { display: none; }
.wedit .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.wedit .row2 button { padding: 7px 0; font-size: 13px; }
.wedit .size { display: grid; place-items: center; gap: 3px; }
.wedit .size i { display: block; border-radius: 50%; background: #c9a35e; }
.wedit-msg { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 74px); transform: translateX(-50%); z-index: 6; padding: 8px 14px;
  border-radius: 14px; background: rgba(255, 252, 240, 0.96); color: #6b4a2b; font-weight: 700; font-size: 14px; border: 2px solid #e2d3ad; pointer-events: none; }
`;

export function createEditor({ container, scene, cut, pick, rotate }) {
  const st = { editing: false, tool: 'path', size: 1, stroke: null, loadedId: null, visible: false };

  // ---- 保存（プロフィールごと） ----
  const ops = () => {
    const p = currentProfile();
    if (!p) return null;
    if (!p.world || !Array.isArray(p.world.ops)) p.world = { v: 1, ops: [] };
    return p.world.ops;
  };
  function replay() {
    cut.clear();
    for (const op of ops() || []) if (op.t === 'path') cut.stroke(op.pts, op.r);
  }
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
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 28V14"/><path d="M16 17c-5 0-8-3-8-8 5 0 8 3 8 8z"/><path d="M16 14c0-4 2.5-7 7-7 0 4-2.5 7-7 7z"/></svg>
      <span>つくる</span>
    </button>
    <div class="tools" hidden>
      <button type="button" data-a="tool" data-v="path">みち</button>
      <button type="button" data-a="tool" data-v="bed" disabled>はな</button>
      <button type="button" data-a="tool" data-v="river" disabled>かわ</button>
      <button type="button" class="size" data-a="size"></button>
      <div class="row2"><button type="button" data-a="left" aria-label="左をむく">◀</button><button type="button" data-a="right" aria-label="右をむく">▶</button></div>
      <button type="button" data-a="undo">もどす</button>
      <button type="button" data-a="done">おわり</button>
    </div>`;
  container.appendChild(root);
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
    q('undo').disabled = !(ops() || []).length;
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

  // なぞっているあいだの丸い目印
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.renderOrder = 5;
  scene.add(ring);

  function setEditing(on) {
    st.editing = on && st.visible;
    st.stroke = null;
    ring.visible = false;
    refreshButtons();
  }

  // ---- 操作 ----
  function commit(op) {
    const list = ops();
    if (!list) return;
    if (list.length >= MAX_OPS) { say('もう いっぱい！ もどして へらしてね'); replay(); return; }
    list.push(op);
    save();              // 自動保存
    refreshButtons();
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

  function place(p) {
    const r = Math.hypot(p.x, p.z);
    if (r > ROAM) { p.x *= ROAM / r; p.z *= ROAM / r; }
    ring.position.set(p.x, heightAt(p.x, p.z) + 0.08, p.z);
    ring.scale.setScalar(BRUSH[st.size]);
  }

  // world.js の pointer から呼ばれる（editing のあいだだけ）
  function pointer(type, e) {
    if (type === 'down') {
      const p = pick(e);
      if (!p) return;
      place(p);
      ring.visible = true;
      if (st.tool === 'path') {
        const r = BRUSH[st.size];
        st.stroke = { r, pts: [round(p.x), round(p.z)], last: { x: p.x, z: p.z } };
        cut.stroke([p.x, p.z], r);
      }
    } else if (type === 'move') {
      const p = pick(e);
      if (!p) return;
      place(p);
      const s = st.stroke;
      if (!s) return;
      if (Math.hypot(p.x - s.last.x, p.z - s.last.z) < MIN_STEP) return;
      if (s.pts.length >= MAX_PTS * 2) return;
      cut.stroke([s.last.x, s.last.z, p.x, p.z], s.r);
      s.pts.push(round(p.x), round(p.z));
      s.last = { x: p.x, z: p.z };
    } else {
      ring.visible = false;
      const s = st.stroke;
      st.stroke = null;
      if (s && type === 'up') commit({ t: 'path', r: s.r, pts: s.pts });
      else if (s) replay();   // とちゅうでキャンセルされたら、なぞりをなかったことにする
    }
  }
  const round = (v) => Math.round(v * 10) / 10;

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
