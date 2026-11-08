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
import { TOOLS, toolById } from './tools.js';
import { ITEMS, ownedOfKind, isOwned } from './catalog.js';
import { ownedSeeds, thumbSrc } from './gacha.js';
import { HOUSES, houseParts, buildPiece } from './pieces.js';
import { foldParts, foldAll } from './builds.js';
import { buildingArt } from './townart.js';
import { BRIDGE_MIN } from './structures.js';
import { icon } from './icons.js';

const MAX_OPS = 800;      // 覚えておく操作の数（保存の大きさをおさえる）
const MAX_PTS = 400;      // ひとなぞりの点の数
const MIN_STEP = 0.35;    // 点を打つ最小のきょり（m）。細かすぎると保存が重い
const RING_STEP = 0.5;
const ROAM = 29;          // つくれるはんい（中心から）
const BRUSH = [0.7, 1.2, 1.9];
const RBRUSH = [0.6, 0.95, 1.4];   // 川のはば
const BRUSH_NAME = ['ほそい', 'ふつう', 'ふとい'];
const DOT = { buttercup: '#ffd62e', lupine: '#a58bf0', tulip: '#ff8fae', clover: '#f4f1ea', dandelion: '#ffe777', sunflower: '#f0b020', cosmos: '#ff8fb3', lavender: '#9d7ef0' };

const CSS = `
.wedit { position: fixed; right: calc(8px + env(safe-area-inset-right, 0px)); top: calc(env(safe-area-inset-top, 0px) + 64px); max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 72px); overflow-y: auto; scrollbar-width: none; z-index: 4;
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
.wuse { position: fixed; right: calc(28px + env(safe-area-inset-right, 0px)); bottom: calc(var(--tabs-h, 0px) + env(safe-area-inset-bottom, 0px) + 120px); z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.wuse[hidden] { display: none; }
@media (orientation: landscape) and (max-height: 540px) { .wuse { bottom: calc(env(safe-area-inset-bottom, 0px) + 120px); } }
/* 横向きで画面がひくい（iPhone SE など）とき、「つくる」が道具ボタンとかさならないよう、道具ボタンの左がわへ */
@media (orientation: landscape) and (max-height: 420px) { .wedit { right: calc(106px + env(safe-area-inset-right, 0px)); } }
.wuse button { all: unset; box-sizing: border-box; cursor: pointer; display: grid; place-items: center; width: 62px; height: 62px; border-radius: 50%; color: #fff;
  background: rgba(70, 58, 48, 0.22); border: 1.5px solid rgba(255, 255, 255, 0.7); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.14);
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; transition: transform 0.12s; }
.wuse button.hold { transform: scale(0.94); background: rgba(255, 226, 168, 0.36); border-color: #ffe2a8; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.14), 0 0 14px rgba(255, 226, 168, 0.55); }
.wuse svg { width: 30px; height: 30px; stroke-width: 1.8; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)); }
.wuse .tname { font-size: 11px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7); pointer-events: none; }
/* ひとつもどす: 下の操作ボタンの近くだと おしまちがえるので、上の「つくる」の下に */
.wuse .wundo { position: fixed; right: calc(15px + env(safe-area-inset-right, 0px)); top: calc(env(safe-area-inset-top, 0px) + 132px); width: 44px; height: 44px; }
.wuse .wundo[hidden] { display: none; }
.wuse .wundo svg { width: 22px; height: 22px; }
.wuse button.wup { position: absolute; top: -34px; left: 50%; transform: translateX(-50%); width: 48px; height: 32px; border-radius: 16px; background: none; border: 0; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; color: #fff; opacity: 0.9; touch-action: manipulation; }
.wsel.tap { pointer-events: auto; }
.wsel.tap .wopt { cursor: pointer; }
.wuse .wup svg { width: 22px; height: 22px; stroke-width: 2.2; }
.wsel { position: absolute; right: 74px; bottom: 72px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; width: min(340px, calc(100vw - 160px)); pointer-events: none; }
.wsel[hidden], .wsp[hidden] { display: none; }
.wopt { display: grid; place-items: center; gap: 2px; width: 64px; padding: 10px 0 6px; border-radius: 50%/42%; color: #fff; font-size: 11px; font-weight: 800;
  background: rgba(70, 58, 48, 0.55); border: 1.5px solid rgba(255, 255, 255, 0.6); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7); transition: transform 0.1s; }
.wopt svg { width: 30px; height: 30px; stroke-width: 1.8; }
.wopt.on { transform: scale(1.18); background: rgba(255, 226, 168, 0.5); border-color: #ffe2a8; box-shadow: 0 0 16px rgba(255, 226, 168, 0.7); }
.wsp { position: absolute; right: 70px; bottom: calc(100% + 6px); display: flex; flex-wrap: wrap-reverse; justify-content: flex-end; gap: 6px; width: max-content; max-width: calc(100vw - 110px - env(safe-area-inset-right, 0px)); }
.wsp .carry { padding: 6px 11px; border-radius: 14px; background: rgba(255, 250, 235, 0.92); color: #6b4a2b; font-size: 12px; font-weight: 800; white-space: nowrap; border: 2px solid #ffe2a8; }
.wsp button.txt.more { padding: 5px 7px; }
.wsp button.txt.pick { display: flex; align-items: center; gap: 4px; padding: 3px 10px 3px 4px; }
.wsp button.txt.pick img { width: 26px; height: 26px; object-fit: contain; border-radius: 8px; background: rgba(255, 255, 255, 0.75); }
.wbag .bgrid button.on { background: #e3efd2; border-color: #8aa66a; color: #5a4636; }
.wsp button.cancel { background: rgba(255, 255, 255, 0.9); color: #6b4a2b; text-shadow: none; }
.wuse button.wgo.carrying { background: rgba(95, 211, 106, 0.55); border-color: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.14), 0 0 14px rgba(95, 211, 106, 0.7); }
.wbag .bgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.wbag .bgrid button { display: grid; justify-items: center; gap: 4px; padding: 10px 4px 8px; border-radius: 16px; text-align: center; font-size: 13px; line-height: 1.25; }
.wbag .bgrid button svg { width: 40px; height: 40px; stroke-width: 1.6; }
.wbag .bgrid button img { width: 64px; height: 64px; object-fit: contain; pointer-events: none; }
.wbag .bgrid button small { font-size: 11px; font-weight: 700; opacity: 0.75; }
.wbag .bgrid button.used { opacity: 0.5; cursor: default; }
.wbag .bhint { margin: 10px 0 0; font-size: 12px; font-weight: 700; text-align: center; opacity: 0.8; }
.wsp button { all: unset; width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.85); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); cursor: pointer; }
.wsp button.txt { width: auto; height: auto; padding: 5px 9px; border-radius: 12px; background: rgba(70, 58, 48, 0.55); color: #fff; font-size: 11px; font-weight: 800; white-space: nowrap; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7); }
.wsp button.txt.on { background: rgba(255, 226, 168, 0.55); }
.wsp button.on { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.95), 0 1px 4px rgba(0, 0, 0, 0.3); }
body.wedit-on #btnDash, body.wedit-on #btnJump { display: none; }   /* 指でなぞっているあいだは、パネルとかさなるので かくす */
.wparts { position: fixed; inset: 0; z-index: 20; background: rgba(70, 52, 32, 0.3); display: grid; place-items: center; padding: 12px; }
.wparts .pcard { width: min(560px, 100%); max-height: calc(100dvh - 24px); overflow-y: auto; background: #fffaf0; border-radius: 18px; padding: 14px; box-shadow: 0 8px 30px rgba(60, 40, 20, 0.35); color: #5a4636; }
.wparts .ptitle { margin: 0 0 8px; font-weight: 800; font-size: 17px; text-align: center; }
.wparts .prow { margin-bottom: 10px; }
.wparts .prow > b { display: block; font-size: 13px; margin-bottom: 4px; }
.wparts .popts, .wparts .pflow { display: flex; flex-wrap: wrap; gap: 6px; }
.wparts .pflow { margin-top: 6px; padding-left: 10px; }
.wparts button { all: unset; cursor: pointer; padding: 7px 11px; border-radius: 12px; font-size: 13px; font-weight: 700; background: #f1e7cf; border: 2px solid #e2d3ad; -webkit-tap-highlight-color: transparent; }
.wparts button.on { background: #8aa66a; color: #fff; border-color: #6f8c52; }
.wparts .pclose { display: block; margin: 8px auto 0; background: #fff; }
.wlevel { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgba(70, 52, 32, 0.35); padding: 16px; overflow: hidden; }
.wlevel .rays { position: absolute; left: 50%; top: 50%; width: 220vmax; height: 220vmax; margin: -110vmax 0 0 -110vmax; pointer-events: none; opacity: 0.55;
  background: repeating-conic-gradient(from 0deg, rgba(255, 236, 160, 0.55) 0deg 8deg, rgba(255, 236, 160, 0) 8deg 20deg); animation: wspin 24s linear infinite;
  -webkit-mask-image: radial-gradient(circle, #000 0, transparent 45%); mask-image: radial-gradient(circle, #000 0, transparent 45%); }
@keyframes wspin { to { transform: rotate(360deg); } }
.wlevel .confetti { position: absolute; inset: 0; pointer-events: none; }
.wlevel .confetti i { position: absolute; top: -14px; width: 9px; height: 15px; border-radius: 2px; opacity: 0; animation: wfall 3s ease-in infinite; }
@keyframes wfall { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), 105vh) rotate(720deg); opacity: 0.9; } }
.wlevel .lcard { position: relative; width: min(360px, 100%); padding: 18px 16px 16px; text-align: center; background: #fffaf0; border-radius: 24px; box-shadow: 0 10px 40px rgba(60, 40, 20, 0.45), 0 0 0 4px #ffe9a8; color: #5a4636; animation: wpop 0.6s cubic-bezier(0.3, 1.7, 0.5, 1) both; }
@keyframes wpop { 0% { transform: scale(0.4) rotate(-4deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
.wlevel .lt { margin: 0; font-size: 28px; font-weight: 800; color: #e0902b; letter-spacing: 0.06em; text-shadow: 0 2px 0 #fff, 0 0 12px #ffe9a8; animation: wbounce 1.2s ease-in-out infinite; }
@keyframes wbounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.wlevel .lpic { position: relative; width: 220px; height: 220px; margin: 4px auto 0; border-radius: 28px; overflow: hidden; background: #fff6dc; box-shadow: inset 0 0 0 3px #ffe9a8; }
.wlevel .lpic svg { width: 100%; height: 100%; animation: wfloat 2.6s ease-in-out infinite, wpop 0.8s 0.15s cubic-bezier(0.3, 1.7, 0.5, 1) both; }
@keyframes wfloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
.wlevel .spark { position: absolute; color: #ffd84a; font-size: 24px; animation: wtwinkle 1.4s ease-in-out infinite; text-shadow: 0 0 8px #fff; }
.wlevel .s1 { left: 6%; top: 14%; } .wlevel .s2 { right: 4%; top: 30%; animation-delay: 0.4s; font-size: 18px; } .wlevel .s3 { left: 20%; bottom: 8%; animation-delay: 0.8s; font-size: 20px; }
@keyframes wtwinkle { 0%, 100% { transform: scale(0.4) rotate(0); opacity: 0.3; } 50% { transform: scale(1.2) rotate(30deg); opacity: 1; } }
.wlevel .ln { margin: 4px 0 2px; font-size: 22px; font-weight: 800; }
.wlevel .ls { margin: 0 0 6px; font-size: 13px; font-weight: 700; }
.wlevel .lh { margin: 6px 0 12px; font-size: 13px; font-weight: 700; opacity: 0.75; }
.wlevel button { all: unset; cursor: pointer; padding: 11px 30px; border-radius: 18px; background: #8aa66a; color: #fff; font-weight: 800; box-shadow: 0 3px 0 #6f8c52; }
.wedit-msg { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 74px); transform: translateX(-50%); z-index: 6; padding: 8px 14px;
  border-radius: 14px; background: rgba(255, 252, 240, 0.96); color: #6b4a2b; font-weight: 700; font-size: 14px; border: 2px solid #e2d3ad; pointer-events: none; }
`;

export function createEditor({ container, scene, cut, wind, pick, rotate, setWalls, town, toScreen, onCelebrate }) {
  const st = {
    editing: false, tool: 'path', size: 1, stroke: null, loadedId: null, visible: false,
    bedMode: 'plant', species: 'tulip', border: 'log', riverMode: 'line',
    fenceStyle: 'fence:wood', piece: 'piece:raisedbed', part: 'part:door',
    carry: false,   // おきものを ピヨが もって あるいている
    spOpen: false,  // 柵のかたち・花の色の えらびが ひらいている
    selTap: false,  // 道具の一覧を ⌃ の タップで ひらいている
  };
  const builds = createBuilds({ scene, wind, cut, setWalls, setTown: (m) => town?.setOverrides(m) });

  // ---- 保存（プロフィールごと） ----
  const ops = () => {
    const p = currentProfile();
    if (!p) return null;
    if (!p.world || !Array.isArray(p.world.ops)) p.world = { v: 1, ops: [] };
    return p.world.ops;
  };
  const replay = () => { builds.rebuild(ops() || []); refreshHand?.(); };
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
      <button type="button" data-a="tool" data-v="parts">パーツ</button>
      <button type="button" data-a="tool" data-v="move">うごかす</button>
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
    <span data-group="river"><button type="button" data-s="rmode" data-v="line">ながれ</button> <button type="button" data-s="rmode" data-v="pond">いけ</button> <button type="button" data-s="rmode" data-v="fill">うめる</button></span>
    <span data-group="bed"><button type="button" data-s="mode" data-v="plant">うえる</button>
    <button type="button" data-s="mode" data-v="ring">かこむ</button>
    <span class="sep"></span></span>
    <span data-group="plant">${SPECIES_KEYS.filter((k) => !SPECIES[k].gacha || ownedSeeds(currentProfile()).has(k)).map((k) => `<button type="button" class="sw" data-s="species" data-v="${k}" aria-label="${SPECIES[k].label}" style="background:${DOT[k]}"></button>`).join(' ')}</span>
    <span data-group="ring"><button type="button" data-s="border" data-v="log">まるた</button> <button type="button" data-s="border" data-v="stone">いし</button></span>`;
  container.appendChild(sub);
  // ---- 道具（ピヨの足もとで使う）。ボタンをおして歩くと足もとが変わる。上にスワイプすると道具をえらべる ----
  const use = document.createElement('div');
  use.className = 'wuse';
  use.hidden = true;
  use.innerHTML = `<div class="wsel" hidden></div>
    <div class="wsp" hidden>${SPECIES_KEYS.map((k) => `<button type="button" data-sp="${k}" aria-label="${SPECIES[k].label}" style="background:${DOT[k]}"></button>`).join('')}</div>
    <button type="button" class="wundo" aria-label="ひとつもどす" hidden></button>
    <button type="button" class="wup" aria-label="道具を えらぶ"></button>
    <button type="button" class="wgo"></button><span class="tname"></span>`;
  container.appendChild(use);
  const UNDO_SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
  use.querySelector('.wundo').innerHTML = UNDO_SVG;
  const CHECK_SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  use.querySelector('.wup').innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/></svg>';
  const selEl = use.querySelector('.wsel');
  selEl.innerHTML = TOOLS.map((t) => `<div class="wopt" data-id="${t.id}">${t.svg}<span>${t.label}</span></div>`).join('');
  const goBtn = use.querySelector('.wgo');
  const spEl = use.querySelector('.wsp');
  const hand = { id: 'mower' };
  function refreshHand() {
    const t = toolById(hand.id);
    if (hand.id !== 'piece' && st.carry) stopCarry(true);
    const carrying = hand.id === 'piece' && st.carry;
    goBtn.innerHTML = carrying ? CHECK_SVG : t.svg;
    goBtn.classList.toggle('carrying', carrying);
    goBtn.setAttribute('aria-label', carrying ? 'ここに おく' : t.label);
    use.querySelector('.tname').textContent = carrying ? 'ここに おく' : t.label;
    // 道具につく小さな選び: 花の色／柵のかたち（もっているものだけ）。おきものは もちもの一覧から えらぶ
    const kind = hand.id === 'fence' ? 'fence' : hand.id === 'part' ? 'part' : null;
    if (hand.id === 'piece') {
      if (carrying) {
        spEl.innerHTML = `<span class="carry">${esc(carryLabel())}を もってるよ</span><button type="button" class="txt cancel" data-cancel="1">やめる</button>`;
        spEl.hidden = false;
      } else spEl.hidden = true;
    } else if (kind) {
      const ids = ownedOfKind(kind);
      const bag = kind === 'piece' ? bagItems() : [];
      const labelOf = (id) => ITEMS[id]?.label || bag.find((b) => b.key === id)?.label || id;
      const all = [...ids, ...bag.map((b) => b.key)];
      const curOf = () => (kind === 'fence' ? st.fenceStyle : kind === 'part' ? st.part : st.piece);
      const setCur = (v) => { if (kind === 'fence') st.fenceStyle = v; else if (kind === 'part') st.part = v; else st.piece = v; };
      if (!all.includes(curOf())) setCur(all[0]);
      // いまの1つだけ（絵つき）。タップで 絵の一覧を ひらいて えらぶ
      const cur = curOf();
      spEl.innerHTML = cur ? `<button type="button" class="txt pick" data-pick="${kind}" aria-label="${esc(labelOf(cur))}を かえる">${ITEMS[cur] ? `<img src="${thumbSrc(ITEMS[cur])}" alt="" onerror="this.remove()">` : ''}${esc(labelOf(cur))} ▾</button>` : '';
      spEl.hidden = !cur;
    } else if (hand.id === 'flower') {
      const have = ownedSeeds(currentProfile());
      const keys = SPECIES_KEYS.filter((k) => !SPECIES[k].gacha || have.has(k));
      if (!keys.includes(st.species)) st.species = keys[0];
      const show = st.spOpen ? keys : [st.species];
      spEl.innerHTML = show.map((k) => `<button type="button" data-sp="${k}" aria-label="${SPECIES[k].label}" style="background:${DOT[k]}"></button>`).join('') + (st.spOpen ? '' : '<button type="button" class="txt more" data-open="1" aria-label="花を えらぶ">▾</button>');
      spEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.sp === st.species));
      spEl.hidden = false;
    } else spEl.hidden = true;
  }
  spEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cancel) { stopCarry(); return; }
    if (b.dataset.pick) { openBag(b.dataset.pick); return; }
    if (!st.spOpen) { st.spOpen = true; refreshHand(); return; }   // とじている時は、タップで ひらくだけ
    if (b.dataset.sp) st.species = b.dataset.sp;
    else if (b.dataset.id) { if (hand.id === 'fence') st.fenceStyle = b.dataset.id; else if (hand.id === 'part') st.part = b.dataset.id; else st.piece = b.dataset.id; }
    st.spOpen = false;   // えらんだら とじる
    refreshHand();
  });
  // えらびが ひらいている時、ほかの所を タップしたら とじる
  document.addEventListener('pointerdown', (e) => {
    if (st.selTap && !e.target.closest?.('.wopt') && !upBtn.contains(e.target)) closeSelTap();   // 道具の すきまも「外」
    if (!st.spOpen || spEl.contains(e.target)) return;
    st.spOpen = false; refreshHand();
  }, true);
  refreshHand();

  const walk = { held: false, id: null, kind: null, pts: null, last: null, seed: 0, startY: 0, sel: false };
  const handRadius = (t) => (t.width === 'river' ? RBRUSH[1] : t.width === 'stamp' ? 0.5 : BRUSH[st.size]);
  function walkStart(e) {
    if (walk.held) return;
    walk.held = true; walk.id = e.pointerId; walk.startY = e.clientY; walk.sel = false;
    goBtn.classList.add('hold');
    try { goBtn.setPointerCapture(e.pointerId); } catch (_) { /* 古い端末 */ }
    walk.pts = null; walk.last = null; walk.kind = hand.id;
  }
  // 上に はじくと、道具の 一覧が ひらく（はなしても 出たまま。タップで えらぶ）
  function markSel(i) {
    [...selEl.children].forEach((el, k) => el.classList.toggle('on', k === i)); walk.selIdx = i;
    use.querySelector('.tname').textContent = i < 0 ? 'やめる' : TOOLS[i]?.label || '';
  }
  // 道具ごとの、みじかい つかいかた（道具をかえた時に出す）
  const TOOL_HINT = {
    mower: 'おしたまま あるくと 草を かるよ', fill: 'おしたまま あるくと 水や あなを うめるよ', seed: 'おしたまま あるくと 草が はえるよ',
    flower: 'かった 土の上を おしたまま あるくと 花が さくよ', shovel: 'おしたまま あるくと ほれるよ。3回で 水が でるよ',
    fence: 'おしたまま あるくと 柵が のびるよ', bridge: '岸で おして、むこう岸まで あるいて はなしてね',
    part: '家の そばで おすと、パーツを つけられるよ', piece: 'ボタンを タップして、おくものを えらんでね',
  };
  function chooseTool(id) {
    if (id === hand.id) { refreshHand(); return; }
    hand.id = id; st.spOpen = true;
    refreshHand();
    if (TOOL_HINT[id]) say(TOOL_HINT[id]);
  }
  // ⌃ を タップしても 道具の一覧が ひらく（ゆびで えらぶ。外を タップで とじる）
  const upBtn = use.querySelector('.wup');
  function closeSelTap() { if (!st.selTap) return; st.selTap = false; selEl.hidden = true; selEl.classList.remove('tap'); refreshHand(); }
  upBtn.addEventListener('click', () => {
    if (st.selTap) { closeSelTap(); return; }
    st.selTap = true; selEl.classList.add('tap'); selEl.hidden = false;
    markSel(Math.max(0, TOOLS.findIndex((t) => t.id === hand.id)));
  });
  selEl.addEventListener('click', (e) => {
    const o = e.target.closest('.wopt'); if (!o || !st.selTap) return;
    st.selTap = false; selEl.hidden = true; selEl.classList.remove('tap');
    chooseTool(o.dataset.id);
  });
  function openSel() {
    walk.sel = true;
    if (walk.pts) { walk.pts = null; walk.last = null; replay(); }   // ここまでのなぞりはなかったことに
    selEl.hidden = false;
    markSel(Math.max(0, TOOLS.findIndex((t) => t.id === hand.id)));
  }
  goBtn.addEventListener('pointermove', (e) => {
    if (!walk.held || e.pointerId !== walk.id) return;
    if (!walk.sel && walk.startY - e.clientY > 38) openSel();
    // ひらいたあとは、指を うごかしても まだ えらばない（はなしてから タップで えらぶ）
  });
  function walkEnd(e) {
    if (!walk.held || (e && e.pointerId !== walk.id)) return;
    walk.held = false;
    const keep = walk.attachTarget;   // はなした しゅんかんの、はめられる場所
    walk.attachNow = keep;
    hideGhost();
    goBtn.classList.remove('hold');
    if (walk.sel) {
      // 指を はなしても 一覧は 出したまま。道具を タップで えらぶ／ほかの所を タップで とじる
      walk.sel = false;
      if (e && e.type === 'pointerup') {
        st.selTap = true; selEl.classList.add('tap'); selEl.hidden = false;
        refreshHand();
        markSel(Math.max(0, TOOLS.findIndex((t) => t.id === hand.id)));
      } else { selEl.hidden = true; refreshHand(); }
      walk.pts = null; walk.last = null;
      return;
    }
    walkCommit();
  }
  // 柵・橋・おきもの: 1回ぶんを1つの操作にして、すぐ画面に出す
  function commitBuild(t, pts) {
    if (!pts) return;
    let op = null;
    const seed = 1 + Math.floor(Math.random() * 1e6);
    if (t.op === 'fence') {
      if (pts.length < 4) { say('あるきながら おして、柵を ひいてね'); return; }
      op = { t: 'fence', style: st.fenceStyle.split(':')[1], seed, pts };
    } else if (t.op === 'bridge') {
      if (pts.length < 4 || Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) < BRIDGE_MIN - 0.4) { say('橋は、岸から むこう岸まで あるいてね'); return; }
      op = { t: 'bridge', seed, x0: pts[0], z0: pts[1], x1: pts[2], z1: pts[3] };
    } else if (t.op === 'place') {
      const bag = bagItems().find((b) => b.key === st.piece);
      if (bag) {                       // バッグから出す（しまっていた建物・おきもの）
        if (!validPlace(pts[0], pts[1], bag.r, bag.kind === 'town' ? bag.id : null, bag.kind === 'piece' ? bag.h : null)) { say('ここには おけないよ（赤い わっか）'); return; }
        op = bag.kind === 'town'
          ? { t: 'town', id: bag.id, x: pts[0], z: pts[1], rot: pts[2], stored: false }
          : { t: 'pmove', hx: bag.h.ox, hz: bag.h.oz, x: pts[0], z: pts[1], rot: pts[2], stored: false };
      } else {
        if (!isOwned(st.piece)) { say('それは まだ もっていないよ'); return; }
        // ガチャで出た物は、1こずつ（さいしょから持っている物は、なんこでも）
        if (!ITEMS[st.piece]?.own && foldAll(ops() || []).eff.some((o) => o.t === 'place' && o.k === st.piece)) { say('もう ならべてるよ。うごかすなら「うごかす」を つかってね'); return; }
        if (!validPlace(pts[0], pts[1], PIECE_R[st.piece] || 0.9, null, null)) { say('ここには おけないよ（赤い わっか）'); return; }
        op = { t: 'place', k: st.piece, seed, x: pts[0], z: pts[1], rot: pts[2] };
      }
    }
    let ok = false;
    if (op && commit(op)) { builds.apply(op); ok = true; }
    clearTrail();
    return ok;
  }
  function walkCommit() {
    let pts = walk.pts;
    const t = toolById(walk.kind || hand.id);
    walk.pts = null; walk.last = null;
    if (t.op === 'place') {
      // おきもの: もっていなければ もちもの一覧をひらく。もっていれば、みどりの わっかの所に おく
      if (!st.carry) { openBag(); return; }
      if (!carryAt) return;
      if (commitBuild(t, carryAt)) { stopCarry(); say('おいたよ！'); }
      return;
    }
    if (t.op === 'attach') { commitAttach(); return; }
    if (t.op === 'fence' || t.op === 'bridge' || t.op === 'place') { commitBuild(t, pts); return; }
    if (!pts || pts.length < 2) return;   // 1点だけ（その場で1回おした）でも、1つの操作として保存する
    const op = t.op === 'plant' ? { t: 'plant', s: st.species, seed: walk.seed, pts } : { t: t.op, r: handRadius(t), pts };
    if (commit(op) && (t.op === 'dig' || t.op === 'fill')) replay();   // 高さが変わるので、花などを置きなおす
  }
  goBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); walkStart(e); });
  goBtn.addEventListener('pointerup', walkEnd);
  goBtn.addEventListener('pointercancel', walkEnd);
  goBtn.addEventListener('lostpointercapture', walkEnd);
  use.querySelector('.wundo').addEventListener('click', undo);
  const q = (a) => root.querySelector(`[data-a="${a}"]`);
  const toolsEl = root.querySelector('.tools');
  let msgEl = null; let msgTimer = 0;
  function say(text) {
    if (!msgEl) { msgEl = document.createElement('div'); msgEl.className = 'wedit-msg'; document.body.appendChild(msgEl); }
    msgEl.textContent = text; msgEl.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msgEl.hidden = true; }, 2600);
  }
  function refreshButtons() {
    q('toggle').classList.toggle('on', st.editing);
    toolsEl.hidden = !st.editing;
    document.body.classList.toggle('wedit-on', st.editing);
    use.hidden = !st.visible || st.editing;   // 指でなぞっているあいだは、足もとの道具をかくす
    root.querySelectorAll('[data-a="tool"]').forEach((b) => b.classList.toggle('on', b.dataset.v === st.tool));
    const dot = 8 + st.size * 5;
    q('size').innerHTML = `<i style="width:${dot}px;height:${dot}px"></i><span>${BRUSH_NAME[st.size]}</span>`;
    q('size').hidden = !(st.tool === 'path' || (st.tool === 'river' && (st.riverMode === 'line' || st.riverMode === 'fill')));
    q('undo').disabled = !(ops() || []).length;
    use.querySelector('.wundo').hidden = !(ops() || []).length;
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
    else if (a === 'tool') { st.tool = b.dataset.v; refreshButtons(); if (st.tool === 'move') say('たてものや おきものを タップ → 「バッグに しまう」'); }
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

  // ---- 「おける？」「はめられる？」の赤・緑 ----
  const GREEN = 0x5fd36a; const RED = 0xe5604d;
  const ghost = new THREE.Group();
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [disc, rim]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 9; ghost.add(m); }
    ghost.visible = false; scene.add(ghost);
  }
  const marks = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.95, depthTest: false }));
    m.renderOrder = 10; m.visible = false; scene.add(m); return m;
  });
  function hideGhost() { ghost.visible = false; marks.forEach((m) => { m.visible = false; }); }
  function showGhost(x, z, r, ok) {
    ghost.position.set(x, heightAt(x, z) + 0.07, z);
    ghost.scale.setScalar(Math.max(0.25, r));
    ghost.children.forEach((c) => c.material.color.setHex(ok ? GREEN : RED));
    ghost.visible = true;
  }
  const ahead = (pos, heading, d) => ({ x: pos.x + Math.sin(heading) * d, z: pos.z + Math.cos(heading) * d });
  // ここに置けるか: 水の上でない・はんいの中・町の建物や、ほかのおきものとかさならない
  function validPlace(x, z, r, selfId, selfH) {
    if (Math.hypot(x, z) > ROAM) return false;
    if (cut.isWater(x, z)) return false;
    if (town && !town.canPlace(x, z, r, selfId)) return false;
    for (const o of foldAll(ops() || []).eff) {
      if (o.t !== 'place') continue;
      if (selfH && o.ox === selfH.ox && o.oz === selfH.oz) continue;
      if (Math.hypot(x - o.x, z - o.z) < r + (PIECE_R[o.k] || 0.9) * 0.6 + 0.2) return false;
    }
    return true;
  }
  // いま手に持っているおきものの、大きさと「出せるか」（ガチャで出た物は1こずつ）
  function pieceSel() {
    const bag = bagItems().find((b) => b.key === st.piece);
    if (bag) return { r: bag.r, selfId: bag.kind === 'town' ? bag.id : null, h: bag.kind === 'piece' ? bag.h : null, allowed: true };
    const owned = isOwned(st.piece);
    const placed = foldAll(ops() || []).eff.some((o) => o.t === 'place' && o.k === st.piece);
    return { r: PIECE_R[st.piece] || 0.9, selfId: null, h: null, allowed: owned && (ITEMS[st.piece]?.own || !placed) };
  }
  // パーツ: ピヨが持って、はめられる場所（光る玉）に合わせる。合うとみどり
  function socketWorld(h, sid) {
    const s = HOUSES[h.k].sockets[sid];
    const c = Math.cos(h.rot || 0); const sn = Math.sin(h.rot || 0);
    return { x: h.x + s.x * c + s.z * sn, z: h.z - s.x * sn + s.z * c, y: heightAt(h.x, h.z) + s.y, slot: s.slot };
  }
  function attachTick(pos, heading) {
    const slot = ITEMS[st.part]?.slot;
    let house = null; let hd = 7;
    for (const h of houses()) { const d = Math.hypot(pos.x - h.x, pos.z - h.z); if (d < hd) { hd = d; house = h; } }
    marks.forEach((m) => { m.visible = false; });
    walk.attachTarget = null;
    if (!house || !slot) { hideGhost(); return; }
    const g = ahead(pos, heading, 1.3);
    let best = null; let bd = 2.0; let i = 0;
    for (const sid of Object.keys(HOUSES[house.k].sockets)) {
      const w = socketWorld(house, sid);
      if (w.slot !== slot || i >= marks.length) continue;
      marks[i].position.set(w.x, w.y, w.z); marks[i].material.color.setHex(RED); marks[i].visible = true; marks[i].scale.setScalar(1);
      const d = Math.hypot(g.x - w.x, g.z - w.z);
      if (d < bd) { bd = d; best = { i, sid }; }
      i += 1;
    }
    if (best) { marks[best.i].material.color.setHex(GREEN); marks[best.i].scale.setScalar(1.6); walk.attachTarget = { h: house, sid: best.sid }; }
    showGhost(g.x, g.z, 0.4, !!best);
  }
  function commitAttach() {
    const t = walk.attachNow; walk.attachNow = null;
    if (!t) { say('はめられる 場所に ちかづいてね（光る玉）'); return; }
    if (commit({ t: 'parts', hx: t.h.ox, hz: t.h.oz, socket: t.sid, part: st.part })) replay();
  }

  // ---- おきものを もって あるく ----
  // 一覧でえらぶ → ピヨの前に その おきもの（とわっか）が ついてくる → 「ここに おく」で おく
  let carryAt = null;              // いま おく場所 [x, z, rot]（おけない所なら null）
  const previews = new Map();      // おきものの見本（種類ごとに1つ作って つかいまわす）
  let preview = null;
  function carryLabel() {
    return ITEMS[st.piece]?.label || bagItems().find((b) => b.key === st.piece)?.label || 'おきもの';
  }
  function previewFor(key) {
    const k = key.startsWith('bag:piece:') ? bagItems().find((b) => b.key === key)?.h?.k : key.startsWith('bag:') ? null : key;
    if (!k) return null;
    if (!previews.has(k)) {
      let m = null;
      try { m = buildPiece({ k, x: 0, z: 0, rot: 0, seed: 7 })?.mesh || null; } catch (_) { m = null; }
      if (m) { m.visible = false; scene.add(m); }
      previews.set(k, m);
    }
    return previews.get(k);
  }
  function startCarry(key) {
    st.piece = key; st.carry = true; carryAt = null;
    if (preview) preview.visible = false;
    preview = previewFor(key);
    refreshHand();
    say('あるいて 場所を きめてね。わっかが みどりの所で「おく」');
  }
  function stopCarry(quiet) {
    st.carry = false; carryAt = null;
    if (preview) preview.visible = false;
    preview = null;
    hideGhost();
    if (!quiet) refreshHand();
  }
  function carryTick(pos, heading) {
    const sel = pieceSel();
    const g = ahead(pos, heading, Math.min(3.4, Math.max(1.5, sel.r + 0.8)));   // 大きい物でも、画面の中に輪が見えるように、まえに出しすぎない
    const ok = sel.allowed && validPlace(g.x, g.z, sel.r, sel.selfId, sel.h);
    showGhost(g.x, g.z, sel.r, ok);
    carryAt = ok ? [round(g.x), round(g.z), Math.round(heading * 100) / 100] : null;
    goBtn.classList.toggle('carrying', ok);
    if (preview) {
      const bob = Math.sin(performance.now() / 260) * 0.05;
      preview.position.set(g.x, heightAt(g.x, g.z) + 0.18 + bob, g.z);   // すこし うかせて「もっている」かんじに
      preview.rotation.y = heading;
      preview.visible = true;
    }
  }
  // もちもの一覧（おきもの）
  let bagSheet = null;
  function closeBag() { bagSheet?.remove(); bagSheet = null; }
  function openBag(kind = 'piece') {
    closeBag();
    const placed = new Set(foldAll(ops() || []).eff.filter((o) => o.t === 'place').map((o) => o.k));
    const HOUSE_SVG = toolById('piece').svg;
    // 3Dモデルから撮った絵（ガチャと同じ）。絵がなければ線の絵
    const pic = (id) => (ITEMS[id] ? `<img src="${thumbSrc(ITEMS[id])}" alt="" draggable="false" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.svg))" data-svg="${esc(ITEMS[id].svg || HOUSE_SVG)}">` : HOUSE_SVG);
    const PICK = {
      fence: { title: '柵の かたちを えらぶ', hint: 'ボタンを おしたまま あるくと のびるよ', cur: () => st.fenceStyle, set: (v) => { st.fenceStyle = v; } },
      part: { title: 'かざる パーツを えらぶ', hint: '家の そばで ボタンを おしてね', cur: () => st.part, set: (v) => { st.part = v; } },
    }[kind];
    const cards = PICK ? ownedOfKind(kind).map((id) => `<button type="button" data-k="${id}" class="${PICK.cur() === id ? 'on' : ''}">${pic(id)}<span>${esc(ITEMS[id]?.label || id)}</span></button>`) : [
      ...ownedOfKind('piece').map((id) => {
        const used = !ITEMS[id]?.own && placed.has(id);   // ガチャで出た物は1こずつ
        return `<button type="button" data-k="${id}" class="${used ? 'used' : ''}">${pic(id)}<span>${esc(ITEMS[id]?.label || id)}</span>${used ? '<small>おいてあるよ</small>' : ''}</button>`;
      }),
      ...bagItems().map((b) => `<button type="button" data-k="${b.key}">${b.kind === 'piece' ? pic(b.h.k) : HOUSE_SVG}<span>${esc(b.label)}</span><small>しまった物</small></button>`),
    ];
    bagSheet = document.createElement('div');
    bagSheet.className = 'wparts wbag';
    bagSheet.innerHTML = `<div class="pcard"><p class="ptitle">${PICK ? PICK.title : 'おきものを えらぶ'}</p><div class="bgrid">${cards.join('')}</div>
      <p class="bhint">${PICK ? PICK.hint : 'えらぶと ピヨが もつよ'}。ガチャで ふえるよ</p><button type="button" class="pclose">とじる</button></div>`;
    bagSheet.addEventListener('click', (e) => {
      if (e.target === bagSheet || e.target.closest('.pclose')) { closeBag(); return; }
      const b = e.target.closest('button[data-k]'); if (!b) return;
      if (PICK) { PICK.set(b.dataset.k); closeBag(); refreshHand(); return; }
      if (b.classList.contains('used')) { say('もう おいてあるよ。うごかすなら「つくる」の「うごかす」で'); return; }
      closeBag();
      startCarry(b.dataset.k);
    });
    document.body.appendChild(bagSheet);
  }

  const here = { x: 0, z: 0, rot: 0 };   // いまのピヨの場所とむき（おきものを、タップだけで置くとき）
  function clearTrail() { trail.visible = false; }

  function setEditing(on) {
    closeParts();
    st.editing = on && st.visible;
    st.stroke = null;
    ring.visible = false;
    trail.visible = false;
    refreshButtons();
  }

  // ---- 操作 ----
  // 同じ建物・おきものの「うごかす／まわす／しまう」は、さいごの値だけ残せば同じ結果になる。まとめて数をへらす
  function compactMoves(list) {
    const first = new Map();
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.t !== 'town' && o.t !== 'pmove') continue;
      const k = o.t === 'town' ? `t:${o.id}` : `p:${o.hx},${o.hz}`;
      const f = first.get(k);
      if (f == null) { first.set(k, i); continue; }
      Object.assign(list[f], o);
      list.splice(i, 1); i--;
    }
  }
  function commit(op) {
    const list = ops();
    if (!list) return false;
    if (list.length >= MAX_OPS) compactMoves(list);   // 建物の移動・回転のくり返しを1つにまとめて、あきを作る
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

  const brushR = () => (st.tool === 'path' ? BRUSH[st.size] : st.tool === 'river' ? (st.riverMode === 'line' || st.riverMode === 'fill' ? RBRUSH[st.size] : 0.3) : st.bedMode === 'plant' ? 0.55 : 0.3);
  function place(p) {
    const r = Math.hypot(p.x, p.z);
    if (r > ROAM) { p.x *= ROAM / r; p.z *= ROAM / r; }
    ring.position.set(p.x, heightAt(p.x, p.z) + 0.08, p.z);
    ring.scale.setScalar(brushR());
  }
  const round = (v) => Math.round(v * 10) / 10;
  let notCutAt = 0;
  function notCut() {
    const now = performance.now();
    if (now - notCutAt > 2500) { notCutAt = now; say('草を かった 土の上に まいてね'); }
  }

  // world.js の pointer から呼ばれる（editing のあいだだけ）
  // ---- バッグ: しまう・うごかす（置いた物と、町の建物） ----
  const PIECE_R = { 'piece:hill': 2.6, 'piece:raisedbed': 1.2, 'piece:awning': 1.4 };
  const moving = { target: null };
  // (x,z) のちかくで、うごかせる物 → { kind:'town'|'piece', id, label, x, z, r, rot, h? }
  function movableAt(x, z, e) {
    let best = null; let bd = 1e9;
    // まず、画面で見えている位置（建物のまんなかの上あたり）がタップに近いものを選ぶ。地面をうしろまでつきぬけるのを防ぐ
    if (e && toScreen) {
      let sb = 1e9; let pick2 = null;
      const cands = [];
      for (const o of foldAll(ops() || []).eff) if (o.t === 'place') cands.push({ kind: 'piece', id: `${o.ox},${o.oz}`, label: ITEMS[o.k]?.label || 'おきもの', x: o.x, z: o.z, r: PIECE_R[o.k] || 0.9, rot: o.rot || 0, h: o });
      for (const t of town?.movables() || []) cands.push({ kind: 'town', id: t.id, label: t.label, x: t.x, z: t.z, r: t.r, rot: t.rot });
      for (const c of cands) {
        const sp = toScreen(c.x, 0.9 + c.r * 0.3, c.z);
        if (!sp) continue;
        const dist = Math.hypot(e.clientX - sp.x, e.clientY - sp.y);
        const lim = Math.max(46, sp.scale * (c.r * 0.9 + 0.8));
        if (dist < lim && dist / lim < sb) { sb = dist / lim; pick2 = c; }
      }
      if (pick2) return pick2;
    }
    for (const o of foldAll(ops() || []).eff) {
      if (o.t !== 'place') continue;
      const r = PIECE_R[o.k] || 0.9;
      const d = Math.hypot(x - o.x, z - o.z) - r;
      if (d < 1.0 && d < bd) { bd = d; best = { kind: 'piece', id: `${o.ox},${o.oz}`, label: ITEMS[o.k]?.label || 'おきもの', x: o.x, z: o.z, r, rot: o.rot || 0, h: o }; }
    }
    const t = town?.itemAt(x, z);
    if (t) {
      const d = Math.hypot(x - t.x, z - t.z) - Math.max(t.r, 0.8);
      if (d < bd) best = { kind: 'town', id: t.id, label: t.label, x: t.x, z: t.z, r: t.r, rot: t.rot };
    }
    return best;
  }
  const moveOp = (m, fields) => (m.kind === 'town' ? { t: 'town', id: m.id, ...fields } : { t: 'pmove', hx: m.h.ox, hz: m.h.oz, ...fields });
  function moveTap(p, e) {
    if (!p) return;
    if (moving.target) {          // うごかす先をタップ
      const m = moving.target;
      const q = { x: p.x, z: p.z };
      const r = Math.hypot(q.x, q.z); if (r > ROAM) { q.x *= ROAM / r; q.z *= ROAM / r; }
      if (cut.isWater(q.x, q.z)) { say('水の上には おけないよ'); return; }
      if (town && !town.canPlace(q.x, q.z, m.r, m.kind === 'town' ? m.id : null)) { say('ほかの たてものと かさなってるよ'); return; }
      moving.target = null;
      if (commit(moveOp(m, { x: round(q.x), z: round(q.z) }))) replay();
      return;
    }
    const m = movableAt(p.x, p.z, e);
    if (!m) { say('うごかしたい たてものや おきものを タップしてね'); return; }
    openMove(m);
  }
  function openMove(m) {
    closeParts();
    partsSheet = document.createElement('div');
    partsSheet.className = 'wparts';
    partsSheet.innerHTML = `<div class="pcard"><p class="ptitle">${m.label}</p><div class="popts" style="justify-content:center">
      <button type="button" data-m="move">うごかす</button><button type="button" data-m="left">◀ まわす</button><button type="button" data-m="right">まわす ▶</button>
      <button type="button" data-m="store">バッグに しまう</button></div><button type="button" class="pclose">とじる</button></div>`;
    partsSheet.addEventListener('click', (e) => {
      if (e.target === partsSheet || e.target.closest('.pclose')) { closeParts(); return; }
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.m;
      if (a === 'move') { moving.target = m; closeParts(); say('おきたい 場所を タップしてね'); return; }
      if (a === 'store') { closeParts(); if (commit(moveOp(m, { stored: true }))) { replay(); say(`${m.label} を バッグに しまったよ`); } return; }
      const rot = m.rot + (a === 'left' ? -Math.PI / 4 : Math.PI / 4);
      m.rot = rot;
      if (commit(moveOp(m, { rot: Math.round(rot * 100) / 100 }))) replay();
    });
    document.body.appendChild(partsSheet);
  }
  // バッグにしまってある物（町の建物と、おきもの）
  function bagItems() {
    const list = (town?.stored() || []).map((s) => ({ key: `bag:town:${s.id}`, label: s.label, kind: 'town', id: s.id, r: s.r }));
    for (const h of foldAll(ops() || []).stored) list.push({ key: `bag:piece:${h.ox},${h.oz}`, label: ITEMS[h.k]?.label || 'おきもの', kind: 'piece', h, r: PIECE_R[h.k] || 0.9 });
    return list;
  }

  // ---- レベルアップのおしらせ（あたらしい たてものが出たとき。1レベルに1つずつ、順番に） ----
  const levelQueue = [];
  let levelShowing = false;
  function announce(_lv, items) {
    for (const it of items) if (!levelQueue.some((q) => q.lv === it.lv && q.label === it.label)) levelQueue.push({ lv: it.lv, label: it.label, id: it.main });
    levelQueue.sort((x, y) => x.lv - y.lv);
    if (st.visible) showLevel();
  }
  function chime() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ac = new Ctx(); const t0 = ac.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + i * 0.11); g.gain.linearRampToValueAtTime(0.12, t0 + i * 0.11 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.11 + 0.5);
        o.connect(g); g.connect(ac.destination); o.start(t0 + i * 0.11); o.stop(t0 + i * 0.11 + 0.55);
      });
      setTimeout(() => ac.close?.(), 1500);
    } catch (_) { /* 音が出せなくても続ける */ }
  }
  // 建物ごとに、言いかたを変える（「池が建った」は変なので）
  const VERB = { '看板と花だん': 'できたよ！', '池': 'できたよ！', '虹': 'かかったよ！', '噴水': 'できたよ！' };
  const announceText = (name) => `${name}が ${VERB[name] || '建ったよ！'}`;
  function showLevel() {
    if (levelShowing || !levelQueue.length) return;
    const q = levelQueue.shift();
    levelShowing = true;
    const art = buildingArt(q.label);
    const el = document.createElement('div');
    el.className = 'wlevel';
    const colors = ['#ff7a8a', '#ffd84a', '#8fd6f2', '#9fe0a0', '#c7a6ff', '#ffb27a'];
    const confetti = Array.from({ length: 44 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${(i % 11) * 0.09}s;animation-duration:${2.2 + (i % 5) * 0.35}s;--dx:${((i * 53) % 61) - 30}px"></i>`).join('');
    el.innerHTML = `<div class="rays"></div><div class="confetti">${confetti}</div>
      <div class="lcard"><p class="lt">レベル ${q.lv}！！</p>
      <p class="ln">${announceText(q.label)}</p>
      <div class="lpic">${art}<span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span></div>
      <p class="lh">しまう・うごかす:<br>つくる → うごかす → たてものを タップ</p><button type="button">やったね！</button></div>`;
    const done = () => { el.remove(); levelShowing = false; setTimeout(showLevel, 350); };
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('button')) done(); });
    document.body.appendChild(el);
    chime();
    onCelebrate?.();
  }

  // ---- 家のパーツ（扉・窓・ひさし・花箱）の付けかえ ----
  const SOCKET_NAME = { door: 'とびら', doorDeco: 'とびらの かざり', winL: 'まど（左）', winR: 'まど（右）', overDoor: 'とびらの ひさし', sillL: 'はこ（左）', sillR: 'はこ（右）', overL: 'ひさし（左）', overR: 'ひさし（右）' };
  function houses() { return foldParts(ops() || []).filter((o) => o.t === 'place' && HOUSES[o.k]); }
  function nearestHouse(x, z) {
    let best = null; let bd = 3.6;
    for (const o of houses()) { const d = Math.hypot(x - o.x, z - o.z); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  let partsSheet = null;
  function closeParts() { partsSheet?.remove(); partsSheet = null; }
  function openParts(h) {
    closeParts();
    const draw = () => {
      const cur = houses().find((o) => o.ox === h.ox && o.oz === h.oz);
      if (!cur) { closeParts(); return; }
      const parts = houseParts(cur);
      const sockets = HOUSES[cur.k].sockets;
      const owned = ownedOfKind('part');
      const rows = Object.entries(sockets).map(([sid, s]) => {
        const opts = owned.filter((id) => ITEMS[id].slot === s.slot);
        const now = parts[sid] || null;
        const btn = (id, label) => `<button type="button" data-s="${sid}" data-p="${id || ''}" class="${(now || '') === (id || '') ? 'on' : ''}">${label}</button>`;
        const flowerRow = now === 'part:flowerbox' ? `<div class="pflow">${[['', 'いろいろ'], ...SPECIES_KEYS.filter((k) => !SPECIES[k].gacha || ownedSeeds(currentProfile()).has(k)).map((k) => [k, SPECIES[k].label])].map(([k, l]) => `<button type="button" data-fs="${sid}" data-f="${k}" class="${(cur.flowers?.[sid] || '') === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
        return `<div class="prow"><b>${SOCKET_NAME[sid] || sid}</b><div class="popts">${btn('', 'なし')}${opts.map((id) => btn(id, ITEMS[id].label)).join('')}</div>${flowerRow}</div>`;
      }).join('');
      partsSheet.querySelector('.pbody').innerHTML = rows;
    };
    partsSheet = document.createElement('div');
    partsSheet.className = 'wparts';
    partsSheet.innerHTML = '<div class="pcard"><p class="ptitle">家の パーツ</p><div class="pbody"></div><button type="button" class="pclose">とじる</button></div>';
    partsSheet.addEventListener('click', (e) => {
      if (e.target === partsSheet || e.target.closest('.pclose')) { closeParts(); return; }
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s !== undefined) {
        const op = { t: 'parts', hx: h.ox, hz: h.oz, socket: b.dataset.s, part: b.dataset.p || null };
        if (commit(op)) replay();
      } else if (b.dataset.fs !== undefined) {
        const op = { t: 'parts', hx: h.ox, hz: h.oz, socket: b.dataset.fs, flower: b.dataset.f || null };
        if (commit(op)) replay();
      }
      draw();
    });
    document.body.appendChild(partsSheet);
    draw();
  }

  function pointer(type, e) {
    if (type === 'down' && st.tool === 'parts') {
      const p = pick(e);
      if (!p) return;
      const h = nearestHouse(p.x, p.z);
      if (h) openParts(h); else say('パーツを つけたい 家を タップしてね');
      return;
    }
    if (type === 'down' && st.tool === 'move') { moveTap(pick(e), e); return; }
    if (st.tool === 'parts' || st.tool === 'move') return;
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
      } else if (st.tool === 'river' && (st.riverMode === 'line' || st.riverMode === 'fill')) {
        const r = RBRUSH[st.size];
        const fill = st.riverMode === 'fill';
        st.stroke = { kind: fill ? 'fill' : 'dig', r, pts: [round(p.x), round(p.z)], last };
        cut.stroke([p.x, p.z], r, fill ? 'f' : 'b');
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
      if (s.kind === 'path' || s.kind === 'dig' || s.kind === 'fill') {
        if (d < MIN_STEP || s.pts.length >= MAX_PTS * 2) return;
        cut.stroke([s.last.x, s.last.z, p.x, p.z], s.r, s.kind === 'dig' ? 'b' : s.kind === 'fill' ? 'f' : 'r');
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
      else if (s.kind === 'fill') { if (commit({ t: 'fill', r: s.r, pts: s.pts })) replay(); }
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
    if (!cut.isCut(p.x, p.z)) { notCut(); return; }
    if (!builds.room(s.s)) { say('この花は もう いっぱい！'); return; }
    builds.addStamp(s.s, p.x, p.z, s.seed, s.pts.length / 2);
    s.pts.push(round(p.x), round(p.z));
    s.last = { x: p.x, z: p.z };
  }

  // 毎フレーム呼ばれる。ボタンをおしたまま歩くと、ピヨの足もとが道具のとおりに変わる（はやく走っているあいだは効かない）
  function tick(dt, pos, speedy, heading = 0) {
    here.x = pos.x; here.z = pos.z; here.rot = heading;
    if (st.carry && hand.id === 'piece' && !st.editing && !walk.sel) carryTick(pos, heading);
    if (!walk.held || walk.sel || st.editing) return;
    const t = toolById(walk.kind);
    const x = pos.x; const z = pos.z;
    if (t.op === 'place') return;   // おきものは carryTick（もって あるいている間ずっと）
    if (t.op === 'attach') { attachTick(pos, heading); return; }
    if (t.op === 'fence' || t.op === 'bridge') {
      if (speedy) return;
      if (!walk.pts) { walk.pts = [round(x), round(z)]; walk.last = { x, z }; return; }
      if (t.op === 'bridge') { walk.pts = [walk.pts[0], walk.pts[1], round(x), round(z)]; drawTrail(walk.pts, false); return; }
      if (Math.hypot(x - walk.last.x, z - walk.last.z) < 0.5 || walk.pts.length >= MAX_PTS * 2) return;
      walk.pts.push(round(x), round(z));
      walk.last = { x, z };
      drawTrail(walk.pts, false);
      return;
    }
    const r = handRadius(t);
    const ch = t.op === 'dig' ? 'b' : t.op === 'fill' ? 'f' : t.op === 'seed' ? 'e' : 'r';
    const step = t.op === 'plant' ? STAMP_STEP : MIN_STEP;
    if (t.op === 'plant') {
      // 花のタネ: 草をかった土の上にだけまける
      if (speedy) return;
      if (!walk.pts) { walk.pts = []; walk.last = null; walk.seed = 1 + Math.floor(Math.random() * 1e6); }
      if (walk.last && Math.hypot(x - walk.last.x, z - walk.last.z) < step) return;
      if (!cut.isCut(x, z)) { notCut(); return; }
      if (!builds.room(st.species)) { say('この花は もう いっぱい！'); return; }
      builds.addStamp(st.species, x, z, walk.seed, walk.pts.length / 2);
      walk.pts.push(round(x), round(z));
      walk.last = { x, z };
      if (walk.pts.length >= MAX_PTS * 2) walkCommit();
      return;
    }
    if (!walk.last) {
      if (speedy) return;
      walk.last = { x, z }; walk.pts = [round(x), round(z)];
      cut.stroke([x, z], r, ch);
      return;
    }
    if (speedy) { walk.last = { x, z }; return; }
    if (Math.hypot(x - walk.last.x, z - walk.last.z) < step) return;
    cut.stroke([walk.last.x, walk.last.z, x, z], r, ch);
    walk.pts.push(round(x), round(z));
    walk.last = { x, z };
    if (walk.pts.length >= MAX_PTS * 2) { walkCommit(); walk.last = { x, z }; walk.pts = [round(x), round(z)]; }
  }

  onChange(() => { sync(); refreshButtons(); });
  sync();

  return {
    tick,
    update(t) { builds.update(t); },
    get active() { return st.editing; },
    pointer,
    // 柵の道具のとき、置いた柵をタップするとしまえる（「もどす」で もどせる）
    tapWorld(e) {
      if (!st.visible || st.editing || hand.id !== 'fence') return;
      let best = null; let bd = 44;   // 画面で見えている柵が、タップから44px以内
      for (const o of foldAll(ops() || []).eff) {
        if (o.t !== 'fence') continue;
        const a = o.pts;
        for (let i = 0; i < a.length; i += 2) {
          const n = i + 3 < a.length ? Math.max(1, Math.ceil(Math.hypot(a[i + 2] - a[i], a[i + 3] - a[i + 1]) / 0.4)) : 1;
          for (let k = 0; k < n; k++) {
            const f = k / n;
            const x = i + 3 < a.length ? a[i] + (a[i + 2] - a[i]) * f : a[i];
            const z = i + 3 < a.length ? a[i + 1] + (a[i + 3] - a[i + 1]) * f : a[i + 1];
            for (const h of [0.15, 0.55]) {   // 柵の足もとと、横木の高さ
              const sp = toScreen?.(x, heightAt(x, z) + h, z);
              if (!sp) continue;
              const d = Math.hypot(e.clientX - sp.x, e.clientY - sp.y);
              if (d < bd) { bd = d; best = o; }
            }
          }
        }
      }
      if (!best) return;
      if (commit({ t: 'fenceoff', seed: best.seed, x: best.pts[0], z: best.pts[1] })) { replay(); refreshButtons(); say('柵を しまったよ（もどすで もどせるよ）'); }
    },
    // ホーム画面が出ているときだけボタンを出す
    setVisible(on) {
      st.visible = on;
      root.hidden = !on;
      if (!on) { setEditing(false); walkEnd(null); if (st.carry) stopCarry(); closeSelTap(); }
      refreshButtons();
      if (on) showLevel();
    },
    announce,
  };
}
