// スマホの「戻る」ボタンを、アプリの中の「戻る」にする。
// いつも 履歴の一番上に1つ目印を立てておき、戻るが押されたら
//   ひらいているシート・画面を閉じる → ほかのタブならホームへ → ホームでは「もう1回でおわり」
// つくる（箱庭）の中では何もしない（「ひとつもどす」には つながない）。
import { toast } from './ui.js';

let atTop = false;
let exitArmedAt = 0;

function ensureTop() {
  if (atTop) return;
  try { history.pushState({ manabiBack: 1 }, ''); atTop = true; } catch { /* 使えない場所では何もしない */ }
}

// いちばん上にある閉じられる画面
function topLayer() {
  const list = [...document.querySelectorAll('body > .sheet, body > .chat, body > .runner')]
    .filter((el) => !el.hidden && el.isConnected);
  let best = null; let bestZ = -Infinity;
  list.forEach((el) => {
    const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
    if (z >= bestZ) { best = el; bestZ = z; }
  });
  return best;
}

function closeLayer(el) {
  if (el.classList.contains('sheet')) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // 外がわタップと同じ
  if (!el.isConnected || el.hidden) return;
  const btn = el.querySelector('.chat-close, button.close, button[aria-label*="とじる"]')
    || [...el.querySelectorAll('button')].find((b) => /^(とじる|もどる|キャンセル)$/.test(b.textContent.trim()));
  btn?.click();
}

function handleBack(api) {
  if (document.querySelector('.tour')) return 'stay';   // はじめての案内中
  const layer = topLayer();
  if (layer) {
    if (layer.classList.contains('timer-run')) { toast('タイマーは「おわり」か「やめる」で とめてね'); return 'stay'; }
    closeLayer(layer);
    return 'stay';
  }
  if (document.body.classList.contains('wedit-on')) { toast('つくるは「おわり」で とじてね'); return 'stay'; }
  if (document.body.classList.contains('menu-open')) { api.menuBtn?.click(); return 'stay'; }
  if (api.tab() !== 'home') { api.goHome(); return 'stay'; }
  if (Date.now() - exitArmedAt < 2500) return 'exit';
  exitArmedAt = Date.now();
  toast('もういちど おすと アプリを とじるよ');
  return 'stay';
}

export function initBack(api) {
  window.addEventListener('popstate', () => {
    if (!atTop) return;
    atTop = false;
    if (handleBack(api) === 'exit') { history.back(); return; }
    ensureTop();
  });
  // 勝手に履歴を足すと無視する端末があるので、最初のタップでも立てる
  window.addEventListener('pointerdown', ensureTop, true);
  if (navigator.userActivation?.hasBeenActive) ensureTop();
}
