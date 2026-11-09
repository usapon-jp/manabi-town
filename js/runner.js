// 問題を1問ずつ出して答え合わせをする画面（クエストと小テストで共通）
// 画面いっぱいに出して、問題・答えるところ・つぎへ、をはっきり分ける。
import { h } from './ui.js';
import { createInkPad } from './ink/pad.js';
import { icon } from './icons.js';
import { askAI, aiErrorText, aiLeft } from './ai.js';
import { currentProfile, gradeLabel, updateProfile } from './store.js';

const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ばっちり！'];
export const KYOKASHO = '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", YuKyokasho, "Klee One", "Hiragino Mincho ProN", "Noto Serif CJK JP", "Noto Serif JP", "Yu Mincho", "MS Mincho", serif';

export function runQuestions(title, questions, onFinish, opts = {}) {
  const layer = document.getElementById('runner');
  // opts.minutes: 時間を決めた挑戦。時間になったら、いまの問題を答えたところで おしまい
  const endAt = opts.minutes ? Date.now() + opts.minutes * 60000 : 0;
  const clock = h('span', { class: 'chal-clock', hidden: !endAt });
  let clockId = 0;
  const tickClock = () => {
    const left = Math.max(0, endAt - Date.now());
    clock.textContent = left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}` : 'じかん！';
    clock.classList.toggle('over', left <= 0);
  };
  if (endAt) { tickClock(); clockId = setInterval(tickClock, 500); }
  const timeUp = () => endAt && Date.now() >= endAt;
  let index = 0;
  let score = 0;
  let pads = [];
  let finished = false;
  const results = []; // [{ q, ok }]（まちがえた問題を、あとで やりなおしに出すため）

  function cleanup() { pads.forEach((p) => p.destroy()); pads = []; }

  function close() {
    cleanup();
    clearInterval(clockId);
    // とちゅうで とじても、できた分は きろくに入れる
    if (!finished && results.length && opts.onAbort) opts.onAbort(score, results.length, results);
    layer.classList.remove('over');
    layer.hidden = true;
    layer.replaceChildren();
    document.body.classList.remove('running');
  }

  function render() {
    cleanup();
    const q = questions[index];
    const feedback = h('div', { class: 'feedback', role: 'status' });
    const next = h('button', { class: 'btn primary next', hidden: true, onclick: () => {
      index += 1;
      if (index < questions.length && !timeUp()) render(); else finish();
    } }, index + 1 < questions.length ? 'つぎへ' : 'けっかを見る');

    function judge(ok, answerText) {
      react(ok);
      results.push({ q, ok });
      if (ok) score += 1;
      feedback.className = `feedback ${ok ? 'ok' : 'ng'}`;
      feedback.textContent = ok
        ? `ピヨ先生「${PRAISE[index % PRAISE.length]}」`
        : `ピヨ先生「おしい！こたえは ${answerText} だよ」`;
      next.hidden = false;
      next.scrollIntoView?.({ block: 'nearest' });
    }

    let answerArea;
    let kind = q.kind;
    if (kind === 'choice') {
      const buttons = q.options.map((opt, i) => h('button', { class: 'option', style: `--i:${i}`, onclick: () => {
        buttons.forEach((b) => { b.disabled = true; });
        buttons[q.answer].classList.add('correct');
        if (i !== q.answer) buttons[i].classList.add('wrong');
        judge(i === q.answer, q.options[q.answer]);
      } }, opt));
      answerArea = h('div', { class: 'options' }, buttons);
    } else if (kind === 'write') {
      // 書けた／書けなかった（紙で自己採点でも、スマホで ピヨ先生の判定でも、同じようにポイントが入る）
      let mine = null;
      answerArea = writeArea(q, pads, (ok, comment) => {
        if (!mine) {
          react(ok);
          mine = { q, ok };
          results.push(mine);
        } else {
          mine.ok = ok;   // 「ほんとは 書けてたよ」で なおしたとき
        }
        score = results.filter((r) => r.ok).length;
        feedback.className = `feedback ${ok ? 'ok' : 'ng'}`;
        feedback.textContent = comment
          ? `ピヨ先生「${comment}」`
          : ok ? `ピヨ先生「${PRAISE[index % PRAISE.length]}」` : 'ピヨ先生「お手本を見て、ノートに3回書いてみよう」';
        next.hidden = false;
      }, (image, job) => {
        // テストモード: 採点は あとで まとめて。いまは つぎへ
        const r = { q, ok: false, image, wait: true };
        results.push(r);
        r.job = job.then((res) => { r.wait = false; r.judged = !!res; r.ok = !!res?.ok; r.comment = res?.comment || ''; });
        next.click();
      });
    } else {
      kind = 'number';
      answerArea = h('div', { class: 'math-area' },
        memoArea(pads),
        numberPad((value) => judge(Math.abs(value - q.answer) < 1e-9, String(q.answer).replace('-', '−')), q.answer));
    }

    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' },
      questions.map((_, i) => h('i', { class: i < index ? 'done' : i === index ? 'now' : '' })));

    // 正解ははずんで星が飛ぶ、まちがいはぷるっとゆれる
    function react(ok) {
      const box = layer.querySelector('.q-box');
      if (!box) return;
      box.classList.remove('hop', 'shake');
      void box.offsetWidth;
      box.classList.add(ok ? 'hop' : 'shake');
      if (ok) burst(box);
    }

    layer.replaceChildren(h('div', { class: `runner-card kind-${kind}` },
      h('div', { class: 'runner-top' },
        h('span', { class: 'chip' }, q.subject),
        endAt ? clock : dots,
        h('span', { class: 'progress' }, `${index + 1} / ${questions.length}`),
        h('button', { class: 'close', 'aria-label': 'とじる', onclick: close }, '×'),
      ),
      h('div', { class: `q-box${q.test ? ' has-stamp' : ''}` },
        q.test ? h('span', { class: 'test-stamp', 'aria-label': 'テストに出るよ' }, 'テストに', h('br'), '出るよ') : null,
        h('p', { class: 'prompt' }, q.prompt),
        q.big ? h('p', { class: `big ${kind === 'write' ? 'reading' : ''}` }, q.big, isEnglish(q.big) ? sayButton(q.big) : null) : null,
        q.context ? contextLine(q.context, q.big) : null,
        hintArea(q, () => !next.hidden),
      ),
      answerArea,
      h('div', { class: 'runner-foot' }, feedback, next),
    ));
  }

  // テストモードで 書いた問題が あれば、採点を まって まとめて 見せる（○×は なおせる）
  async function finish() {
    if (finished) return;
    const tested = results.filter((r) => 'image' in r);
    if (tested.length) {
      finished = true;
      cleanup();
      clearInterval(clockId);
      layer.replaceChildren(h('div', { class: 'runner-card result' },
        h('div', { class: 'q-box' }, h('p', { class: 'prompt' }, 'ピヨ先生が まとめて 採点してるよ…'), h('div', { class: 'write-status loading' }))));
      await Promise.all(tested.map((r) => r.job));
      if (!layer.isConnected || layer.hidden) return;
      const rows = tested.map((r) => {
        const mark = h('button', { class: `tm-mark ${r.ok ? 'ok' : 'ng'}`, 'aria-label': 'まるばつを かえる' }, r.ok ? '○' : '×');
        mark.addEventListener('click', () => { r.ok = !r.ok; mark.className = `tm-mark ${r.ok ? 'ok' : 'ng'}`; mark.textContent = r.ok ? '○' : '×'; });
        return h('div', { class: 'tm-row' },
          r.image ? h('img', { class: 'tm-img', src: r.image, alt: '' }) : h('span', { class: 'tm-img tm-blank' }, 'とばした'),
          h('div', { class: 'tm-text' }, h('small', {}, r.q.big || ''), h('b', {}, r.q.answerText),
            r.comment ? h('small', {}, r.comment) : !r.judged && r.image ? h('small', {}, '○×を 自分で つけてね') : null),
          mark);
      });
      layer.replaceChildren(h('div', { class: 'runner-card result tm' },
        h('div', { class: 'q-box' },
          h('p', { class: 'prompt' }, 'テストの 答え合わせ'),
          h('p', { class: 'tm-note' }, 'お手本と くらべて ちがったら ○× を おして なおしてね'),
          h('div', { class: 'tm-list' }, rows)),
        h('button', { class: 'btn primary next', onclick: () => { score = results.filter((x) => x.ok).length; showResult(); } }, 'けっかを見る')));
      return;
    }
    finished = true;
    showResult();
  }

  function showResult() {
    finished = true;
    cleanup();
    clearInterval(clockId);
    // 時間で おわった とき、やっていない問題は かぞえない
    if (results.length < questions.length) questions = questions.slice(0, results.length);
    setTimeout(() => { const b = layer.querySelector('.q-box'); if (b) burst(b, 14); }, 250);
    const perfect = score === questions.length;
    const extra = onFinish(score, questions.length, results);
    // opts.again は 関数でもOK（けっかを見てから「もう1回」を出すか きめる）
    const again = typeof opts.again === 'function' ? opts.again(results) : opts.again;
    layer.replaceChildren(h('div', { class: 'runner-card result' },
      h('div', { class: 'q-box' },
        h('p', { class: 'big' }, perfect ? 'ぜんもんせいかい！' : `${score} / ${questions.length} もん せいかい`),
        h('p', { class: 'prompt' }, perfect ? 'ピヨ先生「かんぺき！あしたもいっしょにがんばろう」' : 'ピヨ先生「まちがえたところは、またやってみようね」'),
        extra ? h('p', { class: 'reward' }, extra) : null,
      ),
      again
        ? h('div', { class: 'result-btns' },
          h('button', { class: 'btn primary next', onclick: () => { close(); again.onClick(); } }, again.label || 'もう1回'),
          h('button', { class: 'btn next', onclick: close }, 'もどる'))
        : h('button', { class: 'btn primary next', onclick: close }, 'もどる'),
    ));
  }

  document.body.classList.add('running');
  layer.hidden = false;
  render();
}

// 星がはじけて飛ぶ
function burst(box, count = 8) {
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = 70 + Math.random() * 60;
    const star = h('span', { class: 'star-pop', 'aria-hidden': 'true', style: `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.round(Math.random() * 180 - 90)}deg` }, icon(i % 3 ? 'star' : 'sparkles'));
    box.append(star);
    setTimeout(() => star.remove(), 800);
  }
}

// ---- 漢字・英単語を書く --------------------------------------------------------
// 書き方は2つから えらべる（えらんだ方を おぼえておく。つぎの問題からも同じ）
//   ピヨ採点 … スマホに書いて「こたえあわせ」で ピヨ先生（AI）が ○×（つながらないときは 自分で）
//   自己採点 … スマホに書いて、お手本を重ねて 自分で ○×
//   テスト     … スマホに書いて すぐ つぎへ。ピヨ先生は 裏で 採点して、さいごに まとめて ○×
const WRITE_MODES = [
  { id: 'piyo', label: 'ピヨ採点', ic: 'sparkles' },
  { id: 'self', label: '自己採点', ic: 'circle-check' },
  { id: 'test', label: 'テスト', ic: 'timer' },
];
// まえの よびかた（スマホ=ピヨ先生が判定、紙=自分で）も そのまま つかえるように
const LEGACY_MODE = { phone: 'piyo', paper: 'self' };
const EN_FONT = '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", ui-rounded, sans-serif';

function writeArea(q, pads, onJudge, onDefer) {
  const en = q.lang === 'en';
  const p = currentProfile();
  let mode = LEGACY_MODE[p?.writeMode] || (WRITE_MODES.some((m) => m.id === p?.writeMode) ? p.writeMode : 'self');
  let locked = false;   // 答え合わせを はじめたら、書き方は かえられない
  const body = h('div', { class: 'write-body' });
  const switches = WRITE_MODES.map((m) => h('button', { type: 'button', class: m.id === mode ? 'on' : '', onclick: () => {
    if (locked || mode === m.id) return;
    mode = m.id;
    if (p) updateProfile(p, { writeMode: mode });
    switches.forEach((b, i) => b.classList.toggle('on', WRITE_MODES[i].id === mode));
    draw();
  } }, icon(m.ic), m.label));
  const seg = h('div', { class: 'seg write-mode', role: 'group', 'aria-label': '書きかた' }, switches);
  const lock = () => { locked = true; seg.classList.add('locked'); switches.forEach((b) => { b.disabled = true; }); };

  function draw() {
    // まえの板を かたづける
    for (let i = pads.length - 1; i >= 0; i -= 1) if (pads[i].writePad) { pads[i].destroy(); pads.splice(i, 1); }
    body.replaceChildren(...(mode === 'test' && onDefer ? testBody() : phoneBody(mode === 'piyo')));
  }

  // ○× の2つのボタン（紙のときと、ピヨ先生が見られなかったとき）
  function selfJudge(okLabel, ngLabel) {
    const row = h('div', { class: 'self-judge', hidden: true },
      h('button', { class: 'judge ok', onclick: () => pick(true) }, h('b', {}, '○'), okLabel),
      h('button', { class: 'judge ng', onclick: () => pick(false) }, h('b', {}, '×'), ngLabel));
    function pick(ok) {
      row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      row.classList.add(ok ? 'picked-ok' : 'picked-ng');
      onJudge(ok);
    }
    return row;
  }

  // auto: ピヨ採点（こたえあわせで すぐ ピヨ先生が 見る）／ でなければ 自己採点
  function phoneBody(auto) {
    const chars = [...q.answerText];
    let showAnswer = false;
    const pad = createInkPad({
      className: 'write-pad',
      size: en ? 6 : 9,
      drawBackground: (ctx, w, hgt) => (en ? enLines(ctx, w, hgt, showAnswer && q.answerText) : kanjiCells(ctx, w, hgt, chars, showAnswer)),
    });
    pad.writePad = true;
    pads.push(pad);

    const undo = h('button', { class: 'btn small', onclick: () => pad.undo() }, '1つもどす');
    const clear = h('button', { class: 'btn small', onclick: () => pad.clear() }, 'ぜんぶけす');
    const tools = h('div', { class: 'write-tools' }, undo, clear);
    const check = h('button', { class: 'btn primary', disabled: true }, icon('circle-check'), ' こたえあわせ');
    pad.onChange(() => { check.disabled = locked || pad.isEmpty(); });
    const status = h('p', { class: 'write-status', role: 'status', hidden: true });
    const answer = h('p', { class: 'answer-text', hidden: true }, `こたえ：${q.answerText}`);
    const judgeRow = selfJudge('あってた', 'ちがった');
    const fix = h('button', { class: 'link fix-judge', hidden: true }, 'ほんとは 書けてたよ');
    fix.addEventListener('click', () => { fix.hidden = true; onJudge(true, 'ごめんね、ちゃんと 書けてたね！'); });

    check.addEventListener('click', async () => {
      if (locked || pad.isEmpty()) return;
      lock();
      check.hidden = true;
      tools.hidden = true;
      pad.el.classList.add('done');
      if (auto) { await piyoJudge(); return; }
      {
        // 自己採点: お手本を 重ねて 自分で ○×
        showAnswer = true;
        pad.redraw();
        answer.hidden = false;
        status.hidden = false;
        status.className = 'write-status';
        status.textContent = 'お手本と くらべて ○×を つけてね';
        judgeRow.hidden = false;
      }
    });

    async function piyoJudge() {
      const image = snapshot(pad.el);
      status.hidden = false;
      status.className = 'write-status loading';
      status.textContent = 'ピヨ先生が 見てるよ…';
      showAnswer = true;
      let r = null;
      try {
        r = await askAI({ action: 'judge', image, expected: q.answerText, reading: q.big || '', lang: en ? 'en' : 'ja' }, { timeout: 40000 });
      } catch (e) { /* 下で 自分で ○× にする */ }
      pad.redraw();   // お手本を 赤くうすく重ねる
      answer.hidden = false;
      if (r && typeof r.ok === 'boolean') {
        status.hidden = true;
        onJudge(r.ok, r.comment || '');
        if (!r.ok) fix.hidden = false;
      } else {
        status.className = 'write-status';
        status.textContent = 'いまは ピヨ先生が 見られないみたい。お手本と くらべて ○×を つけてね';
        judgeRow.hidden = false;
      }
    }

    return [h('div', { class: `write-frame ${en ? 'en' : ''}`, style: `--n:${en ? 3 : chars.length}` }, pad.el),
      tools, check, status, answer, judgeRow, fix];
  }

  // テスト: 書いたら すぐ つぎへ。採点は 裏で（さいごに まとめて 見る）
  function testBody() {
    const chars = [...q.answerText];
    const pad = createInkPad({
      className: 'write-pad',
      size: en ? 6 : 9,
      drawBackground: (ctx, w, hgt) => (en ? enLines(ctx, w, hgt, false) : kanjiCells(ctx, w, hgt, chars, false)),
    });
    pad.writePad = true;
    pads.push(pad);
    const undo = h('button', { class: 'btn small', onclick: () => pad.undo() }, '1つもどす');
    const clear = h('button', { class: 'btn small', onclick: () => pad.clear() }, 'ぜんぶけす');
    const done = h('button', { class: 'btn primary', disabled: true }, '書けた！ つぎへ');
    const skip = h('button', { class: 'link test-skip' }, 'わからない（とばす）');
    pad.onChange(() => { done.disabled = locked || pad.isEmpty(); });
    done.addEventListener('click', () => {
      if (locked || pad.isEmpty()) return;
      lock();
      const image = snapshot(pad.el);
      const job = askAI({ action: 'judge', image, expected: q.answerText, reading: q.big || '', lang: en ? 'en' : 'ja' }, { timeout: 60000 })
        .then((r) => (r && typeof r.ok === 'boolean' ? r : null)).catch(() => null);
      onDefer(image, job);
    });
    skip.addEventListener('click', () => { if (locked) return; lock(); onDefer(null, Promise.resolve({ ok: false, comment: '' })); });
    return [h('div', { class: `write-frame ${en ? 'en' : ''}`, style: `--n:${en ? 3 : chars.length}` }, pad.el),
      h('div', { class: 'write-tools' }, undo, clear), done, skip];
  }

  draw();
  return h('div', { class: 'write-area' }, seg, body);
}

// 漢字のマス（十字の点線）。showAnswer のときは お手本を赤くうすく重ねる
function kanjiCells(ctx, w, hgt, chars, showAnswer) {
  const n = chars.length;
  const cell = Math.min(hgt, w / n);
  const x0 = (w - cell * n) / 2;
  const y0 = (hgt - cell) / 2;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, hgt);
  ctx.strokeStyle = '#d9cdb4';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 1, y0 + 1, cell * n - 2, cell - 2);
  for (let i = 0; i < n; i += 1) {
    const x = x0 + cell * i;
    if (i > 0) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + cell); ctx.stroke(); }
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = '#eadfca';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + cell / 2, y0 + 6); ctx.lineTo(x + cell / 2, y0 + cell - 6);
    ctx.moveTo(x + 6, y0 + cell / 2); ctx.lineTo(x + cell - 6, y0 + cell / 2);
    ctx.stroke();
    ctx.restore();
    if (showAnswer) {
      ctx.fillStyle = 'rgba(226, 92, 72, 0.28)';
      ctx.font = `${Math.round(cell * 0.82)}px ${KYOKASHO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chars[i], x + cell / 2, y0 + cell / 2 + cell * 0.03);
    }
  }
  ctx.restore();
}

// 英語ノートの4本線（3本目が ベースライン）。word があれば お手本を うすく重ねる
function enLines(ctx, w, hgt, word) {
  const gap = hgt / 5;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, hgt);
  [1, 2, 3, 4].forEach((k) => {
    ctx.beginPath();
    ctx.setLineDash(k === 2 ? [5, 6] : []);
    ctx.strokeStyle = k === 3 ? '#e2b7a6' : '#d9cdb4';
    ctx.lineWidth = k === 3 ? 2 : 1.5;
    ctx.moveTo(10, gap * k); ctx.lineTo(w - 10, gap * k);
    ctx.stroke();
  });
  if (word) {
    let size = gap * 2.7;
    ctx.font = `${Math.round(size)}px ${EN_FONT}`;
    const tw = ctx.measureText(word).width;
    if (tw > w * 0.9) { size *= (w * 0.9) / tw; ctx.font = `${Math.round(size)}px ${EN_FONT}`; }
    ctx.fillStyle = 'rgba(226, 92, 72, 0.32)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(word, w / 2, gap * 3);
  }
  ctx.restore();
}

// 書いた字を 小さめの画像にする（お手本を重ねる前に とる）
function snapshot(canvas, max = 640) {
  const k = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(canvas.width * k));
  c.height = Math.max(1, Math.round(canvas.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

// ---- 算数のメモ ----------------------------------------------------------------

function memoArea(pads) {
  const pad = createInkPad({
    className: 'memo-pad',
    size: 5,
    color: '#5e4a35',
    drawBackground(ctx, w, hgt) {
      ctx.fillStyle = '#fffef9';
      ctx.fillRect(0, 0, w, hgt);
      ctx.strokeStyle = '#efe3cc';
      ctx.lineWidth = 1;
      for (let x = 20; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt); ctx.stroke(); }
      for (let y = 20; y < hgt; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    },
  });
  pads.push(pad);
  return h('div', { class: 'memo' },
    h('div', { class: 'memo-head' },
      h('span', {}, icon('pencil'), ' メモ（指で書けるよ）'),
      h('button', { class: 'link', onclick: () => pad.undo() }, 'もどす'),
      h('button', { class: 'link', onclick: () => pad.clear() }, 'けす')),
    pad.el);
}

function numberPad(onSubmit, answer = 0) {
  let text = '';
  const display = h('div', { class: 'pad-display' }, '　');
  const ok = h('button', { class: 'btn primary pad-ok', disabled: true }, 'こたえる');
  // 答えが小数の問題（とりこんだ小テストなど）は、−のかわりに 小数点 を出す
  const decimal = !Number.isInteger(Number(answer)) && Number(answer) >= 0;
  const keys = ['7', '8', '9', '⌫', '4', '5', '6', decimal ? '.' : '−', '1', '2', '3', '0'];
  let locked = false;

  function update() {
    display.textContent = text || '　';
    ok.disabled = !/\d/.test(text);
  }

  const pad = h('div', { class: 'pad' }, keys.map((k) => h('button', { class: `key ${/\d/.test(k) ? '' : 'fn'}`, onclick: () => {
    if (locked) return;
    if (k === '⌫') text = text.slice(0, -1);
    else if (k === '−') text = text.startsWith('−') ? text.slice(1) : `−${text}`;
    else if (k === '.') { if (!text.includes('.')) text = `${text || '0'}.`; }
    else if (text.replace('−', '').length < 7) text += k;
    update();
  } }, k)));

  ok.addEventListener('click', () => {
    if (locked) return;
    locked = true;
    ok.disabled = true;
    onSubmit(Number(text.replace('−', '-')));
  });

  return h('div', { class: 'number-answer' }, h('div', { class: 'answer-row' }, display, ok), pad);
}

// 英語の読み上げ（端末の音声。オフラインでも動き、お金はかからない）
const isEnglish = (s) => typeof s === 'string' && /[A-Za-z]/.test(s) && !/[ぁ-んァ-ン一-龯]/.test(s) && 'speechSynthesis' in window;
let enVoice;
function englishVoice() {
  if (enVoice !== undefined) return enVoice;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;   // まだ読みこみ中（つぎに おしたとき えらぶ）
  enVoice = vs.find((v) => /^en-US/i.test(v.lang) && /samantha|google|natural/i.test(v.name))
    || vs.find((v) => /^en-US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  return enVoice;
}
export function sayEnglish(text, slow = false) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const v = englishVoice();
    if (v) u.voice = v;
    u.rate = slow ? 0.6 : 0.9;
    speechSynthesis.speak(u);
  } catch (e) { /* 読み上げのない端末は なにもしない */ }
}
// 1回目はふつう、つづけて おすと ゆっくり
function sayButton(text) {
  let last = 0;
  return h('button', { class: 'say-btn', type: 'button', 'aria-label': 'よみあげ', onclick: (e) => {
    e.stopPropagation();
    const slow = Date.now() - last < 2500;
    last = Date.now();
    sayEnglish(text, slow);
  } }, icon('volume-2'));
}

// れいぶん: 「＿」のところに 問題のことばを 線つきで入れる（例: ふるさとの［きょうど］りょうりを 食べる）
function contextLine(sentence, word) {
  const [before, after = ''] = sentence.split('＿');
  return h('p', { class: 'context' }, before, h('span', { class: 'context-word' }, word), after);
}

// ピヨ先生のヒント（AI）。押すたびに 1→2→3 と少しずつ答えに近づく。答えは言わない
function hintArea(q, answered) {
  let level = 0;
  const text = h('p', { class: 'hint-text', hidden: true, role: 'status' });
  const btn = h('button', { class: 'hint-btn', type: 'button' }, icon('lightbulb'), h('span', {}, 'ヒント'));
  btn.onclick = async () => {
    if (answered() || level >= 3 || btn.disabled) return;
    btn.disabled = true;
    text.hidden = false;
    text.classList.add('loading');
    text.textContent = 'ピヨ先生が かんがえ中…';
    const p = currentProfile();
    const answer = q.kind === 'choice' ? q.options[q.answer] : q.kind === 'write' ? q.answerText : String(q.answer);
    try {
      const r = await askAI({ action: 'hint', level: level + 1, subject: q.subject, grade: p ? gradeLabel(p) : '',
        question: [q.prompt, q.big].filter(Boolean).join(' '), context: q.context || '', answer });
      level += 1;
      text.textContent = r.text || 'ピヨ先生が うまく こたえられなかった…もういちど おしてね';
    } catch (e) {
      text.textContent = aiErrorText(e);
    }
    text.classList.remove('loading');
    btn.disabled = level >= 3 || aiLeft() <= 0;
    btn.querySelector('span').textContent = level === 0 ? 'ヒント' : level < 3 ? 'もうすこし ヒント' : 'ヒントは ここまで';
  };
  return h('div', { class: 'hint' }, btn, text);
}
