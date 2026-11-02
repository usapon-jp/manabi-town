// 宿題がまにあわなそうな時の「どうする？」相談。ピヨ先生がやさしく聞いて、子どもが自分で決める。
// 1) いま 何ページまで できてる？ → 2) のこりを どうする？（あした出す・つぎの提出日・日にちを決める）
// 3) 1日 何ページになるか見て「できそう？」→ 決めたら ていしゅつ日を書きかえる
import { h, toast, daysLabel } from './ui.js';
import { today, toISO, daysUntil, save } from './store.js';
import { homeworkPages, completeStep } from './planner.js';
import { icon } from './icons.js';

const POINTS_DECIDE = 10;   // じぶんで決めた

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); };
const md = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`; };

export function openRescue(p, item, deps) {
  const pages = homeworkPages(item);
  const total = Math.max(1, pages.length);
  let done = Math.min(item.stepsDone || 0, total);
  let date = null;

  const body = h('div', { class: 'rescue-body' });
  const close = () => sheet.remove();
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-card rescue' },
      h('div', { class: 'coach' }, h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 40, height: 40 }),
        h('p', { class: 'rescue-say' })),
      body,
      h('button', { class: 'link', onclick: close }, 'あとで')));
  document.body.append(sheet);
  const say = (t) => { sheet.querySelector('.rescue-say').textContent = t; };

  // 1) どこまで できてる？
  function stepDone() {
    say(`だいじょうぶ、いまから きめれば いいよ。${item.title}、どこまで できてる？`);
    let pick = done;
    const cells = h('div', { class: 'cells' });
    const draw = () => cells.replaceChildren(...(pages.length ? pages : [null]).map((n, idx) => h('button', {
      type: 'button', class: `cell ${idx < pick ? 'on' : ''}`,
      onclick: () => { pick = idx + 1 === pick ? idx : idx + 1; draw(); },
    }, idx < pick ? icon('check') : h('span', {}, n ?? 'できた'))));
    draw();
    body.replaceChildren(
      h('p', { class: 'rescue-hint' }, 'できたところまで タップしてね'),
      cells,
      h('button', { class: 'btn primary', onclick: () => {
        // ふえた分は きょうやった分として スタンプ＋ポイント
        const more = Math.max(0, pick - done);
        for (let i = 0; i < more; i += 1) completeStep(item);
        if (more) deps.gain(p, more * 5, `${item.title}: ${more}ページ`);
        done = Math.min(item.stepsDone || 0, total);
        if (done >= total) { say('ぜんぶ できてるね！ あとは だすだけ'); body.replaceChildren(h('button', { class: 'btn primary', onclick: () => { close(); deps.render(); } }, 'OK')); return; }
        stepHow();
      } }, pick > done ? `${pick - done}ページ ぶん スタンプして つぎへ` : 'つぎへ'));
  }

  // 2) のこりを どうする？
  function stepHow() {
    const left = total - done;
    say(done ? `${done}ページ できてるね、えらい！ のこり ${left}ページ、どうする？` : `のこり ${left}ページ。どうするか、じぶんで きめてみよう`);
    const next = p.items.filter((i) => i !== item && !i.done && i.type === 'homework' && i.title === item.title && i.date > item.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const own = h('input', { type: 'date', min: addDays(1), value: addDays(1) });
    const opt = (label, sub, d) => h('button', { type: 'button', class: 'rescue-opt', onclick: () => { date = d; stepPace(); } },
      h('b', {}, label), h('small', {}, sub));
    body.replaceChildren(
      daysUntil(item.date) >= 1 ? null : opt('あした だす', 'きょう のこりを がんばる', addDays(1)),
      daysUntil(item.date) === 0 ? opt('きょう だす', 'このまま きょう中に', item.date) : null,
      next ? opt(`つぎの ていしゅつ日（${md(next.date)}）に いっしょに だす`, `先生に「つぎに だします」と つたえよう`, next.date) : null,
      h('div', { class: 'rescue-own' }, h('span', {}, 'ひにちを じぶんで きめる'), own,
        h('button', { type: 'button', class: 'btn small', onclick: () => { if (own.value && own.value > today()) { date = own.value; stepPace(); } } }, 'これにする')));
  }

  // 3) 1日 何ページ？ できそう？
  function stepPace() {
    const left = total - done;
    // 提出日の前の日までに おわらせる（あした出すなら きょう中）
    const days = Math.max(1, daysUntil(date));
    const per = Math.ceil(left / days);
    say(days === 1 ? `${md(date)}に だすなら、きょう ${left}ページ。できそう？` : `${md(date)}に だすなら、1日 ${per}ページ くらい。できそう？`);
    body.replaceChildren(
      h('div', { class: 'rescue-plan' }, h('b', {}, `${per}`), h('span', {}, days === 1 ? 'ページ きょう' : `ページ × ${days}日`)),
      h('button', { class: 'btn primary', onclick: () => {
        item.date = date;
        item.rescued = { at: today(), pages: left };
        deps.gain(p, POINTS_DECIDE, `${item.title}: じぶんで きめた`);
        save();
        close();
        deps.render();
        toast(`じぶんで きめたね！ ${daysLabel(daysUntil(date))}まで いっしょに がんばろ`);
      } }, 'できそう！ これに きめる'),
      h('button', { class: 'btn', onclick: stepHow }, 'もうすこし へらしたい（えらびなおす）'));
  }

  if (pages.length) stepDone(); else stepHow();
}
