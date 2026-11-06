// ピヨを自分で動かす操作。うさぽん村と同じ形のスティック、ジャンプ、ダッシュ。
// スティック: 丸の中=ゆっくり、丸の外まで引っぱる=スタスタ。
// ダッシュ: 1回おすと開始、もう1回おすか、スティックから手をはなすと止まる。
// パソコンでは WASD / 矢印キーで歩く、スペースでジャンプ、Shift でダッシュ。
export const input = { jx: 0, jy: 0, dash: false, dashLatch: false, jump: false, keys: {} };

export function bindControls(root) {
  const joy = root.querySelector('#joy');
  const knob = root.querySelector('#knob');
  const dash = root.querySelector('#btnDash');
  const jump = root.querySelector('#btnJump');
  let id = null; let cx = 0; let cy = 0; let RC = 48;

  const set = (x, y) => {
    let dx = x - cx; let dy = y - cy;
    const m = Math.hypot(dx, dy); const OUT = RC + 22;
    if (m > OUT) { dx = (dx / m) * OUT; dy = (dy / m) * OUT; }
    const mm = Math.min(m, OUT);
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.classList.toggle('act', m > 8);
    const f = mm <= RC ? (0.5 * mm) / RC : 0.5 + 0.5 * Math.min(1, (mm - RC) / 22);
    input.jx = mm > 0 ? (dx / mm) * f : 0;
    input.jy = mm > 0 ? (-dy / mm) * f : 0;
  };
  joy.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; RC = r.width / 2;
    set(e.clientX, e.clientY);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    joy.classList.remove('act');
    input.jx = 0; input.jy = 0;
    if (input.dashLatch) stopDash();
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
  joy.addEventListener('lostpointercapture', end);
  // 指がはなれた合図が来なかったときも、スティックを戻す（勝手に走り続けない）
  const release = () => {
    if (id === null && input.jx === 0 && input.jy === 0) return;
    id = null;
    knob.style.transform = '';
    joy.classList.remove('act');
    input.jx = 0; input.jy = 0;
    if (input.dashLatch) stopDash();
  };
  window.addEventListener('pointerup', (e) => { if (e.pointerId === id) end(e); });
  window.addEventListener('pointercancel', (e) => { if (e.pointerId === id) end(e); });
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

  function stopDash() { input.dash = false; input.dashLatch = false; dash.classList.remove('hold'); }
  [dash, jump, joy].forEach((b) => b.addEventListener('contextmenu', (e) => e.preventDefault()));
  dash.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (input.dashLatch) { stopDash(); return; }
    input.dash = true; input.dashLatch = true; dash.classList.add('hold');
  });
  jump.addEventListener('pointerdown', (e) => { e.preventDefault(); input.jump = true; });

  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  window.addEventListener('keydown', (e) => {
    if (typing()) return;
    input.keys[e.code] = true;
    if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  window.addEventListener('blur', () => { input.keys = {}; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) input.keys = {}; });
}

// スティックとキーをまとめて、-1〜1 の向きにする
export function readMove() {
  const k = input.keys;
  let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + input.jx;
  let y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + input.jy;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  const dash = input.dash || !!(k.ShiftLeft || k.ShiftRight);
  return { x, y, mag: Math.min(1, m), dash };
}

export function takeJump() {
  const j = input.jump;
  input.jump = false;
  return j;
}
