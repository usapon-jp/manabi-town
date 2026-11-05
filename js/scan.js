// プリントや範囲の写真を、アプリで撮る（または えらぶ）→ ピヨ先生（AI・Haiku）が読み取って → 予定にする。
// 写真は小さくしてから送る（1280px・JPEG）。送った写真はアプリには残さない。
import { h, toast } from './ui.js';
import { pickPhoto } from './pickphoto.js';
import { today, addItem, gradeLabel } from './store.js';
import { subjectNames } from './subjects.js';
import { askAI, aiErrorText } from './ai.js';
import { buildSteps } from './planner.js';
import { icon } from './icons.js';

const MAX_SIDE = 1280;

// 写真を小さくして base64（JPEG）にする
export function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

let busy = false;

// 「写真から入れる」ボタン。deps.render で画面を直す
export function scanButton(p, deps) {
  const read = async (file) => {
      if (!file || busy) return;
      busy = true;
      toast('ピヨ先生が 読んでるよ…', 20000);
      try {
        const image = await shrink(file);
        const r = await askAI({ action: 'scan', image, today: today(), grade: gradeLabel(p) }, { timeout: 45000 });
        document.getElementById('toast')?.classList.remove('show');
        if (!r.items?.length) { toast(r.note ? `うまく読めなかった…（${r.note}）` : 'うまく読めなかった…もういちど とってみてね', 4000); return; }
        openConfirm(p, r.items, r.note, deps);
      } catch (e) {
        toast(e.message === 'image' ? 'この写真は ひらけなかった' : aiErrorText(e).replace('ヒント', '読みとり'), 3500);
      } finally { busy = false; }
    };
  return h('div', { class: 'scan' },
    h('button', { type: 'button', class: 'btn scan-btn', onclick: () => pickPhoto(read, { title: 'プリント・範囲表を 入れる' }) },
      icon('camera'), h('span', {}, h('b', {}, '写真から入れる'), h('small', {}, 'プリント・範囲表を とる か えらぶ'))));
}

// 読み取った予定を見せて、チェックしたものだけ入れる（まちがいは直せる）
function openConfirm(p, items, note, deps) {
  // 受け口から ちがう教科名が来ても、アプリの教科にそろえる
  const SUBJECTS = subjectNames(p);
  const other = SUBJECTS.includes('その他') ? 'その他' : SUBJECTS[SUBJECTS.length - 1];
  const math = SUBJECTS.find((s) => /算数|数学/.test(s));
  const canon = (s) => (SUBJECTS.includes(s) ? s : math && /算数|数学/.test(s) ? math : other);
  const rows = items.map((it) => ({ ...it, subject: canon(String(it.subject || '')), on: true }));
  const list = h('ul', { class: 'scan-list' });
  const close = () => sheet.remove();
  const draw = () => list.replaceChildren(...rows.map((r) => {
    const subject = h('select', {}, SUBJECTS.map((s) => h('option', { value: s, selected: s === r.subject || null }, s)));
    subject.onchange = () => { r.subject = subject.value; };
    const title = h('input', { type: 'text', value: r.title, maxlength: 40 });
    title.oninput = () => { r.title = title.value; };
    const range = h('input', { type: 'text', value: r.range, placeholder: 'はんい（p.40〜52）', maxlength: 40 });
    range.oninput = () => { r.range = range.value; };
    const date = h('input', { type: 'date', value: r.date });
    date.onchange = () => { r.date = date.value; date.classList.toggle('need', !date.value); };
    return h('li', { class: `scan-row ${r.on ? '' : 'off'}` },
      h('label', { class: 'scan-on' },
        h('input', { type: 'checkbox', checked: r.on || null, onchange: (e) => { r.on = e.target.checked; draw(); } }),
        h('span', { class: 'chip' }, r.type === 'test' ? 'テスト' : '宿題'), subject),
      title, range, date);
  }));
  draw();
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card scan-card' },
      h('p', { class: 'sheet-title' }, '読みとれたよ'),
      h('p', { class: 'sheet-sub' }, 'まちがいは なおしてね。いれないものは チェックをはずす'),
      note ? h('p', { class: 'scan-note' }, note) : null,
      list,
      h('button', { class: 'btn primary', onclick: () => {
        const picked = rows.filter((r) => r.on);
        if (picked.some((r) => !r.title.trim() || !r.date)) { toast('名前と日にちを 入れてね（いれないものは チェックをはずす）', 3500); return; }
        const ok = picked;
        ok.forEach((r) => addItem(p, { type: r.type, subject: r.subject, title: r.title.trim(), range: r.range.trim(), date: r.date }));
        close();
        deps.render();
        if (ok.length) toast(`${ok.length}こ いれたよ。ホームを見てね`);
      } }, 'これで いれる'),
      h('button', { class: 'link', onclick: close }, 'やめる')));
  document.body.append(sheet);
}
