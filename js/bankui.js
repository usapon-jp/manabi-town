// 銀行の 画面（建物を タッチした ときの カード・レベルアップの ことば）。きまりは js/bank.js。
// カードは 下に 1まい。草原は 見えたまま。説明は みじかく。
import { h } from './ui.js';
import { currentProfile, save, onChange } from './store.js';
import { subjectNames } from './subjects.js';
import { currentIslandId, START } from './islands.js';
import { registerBuildingCard } from './eggui.js';
import {
  registerBank, bankOpen, bankLevel, shown, nextGain, canDeposit, canWithdraw, deposit, withdraw, settle,
} from './bank.js';

const LV_KEY = 'manabi-bank-lv';
const readLv = () => { try { const v = JSON.parse(localStorage.getItem(LV_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const writeLv = (v) => { try { localStorage.setItem(LV_KEY, JSON.stringify(v)); } catch (_) { /* おぼえられなくても 銀行は 動く */ } };

let deps = { isHome: () => true, say: null, render: null };

// main.js から。ひらく しくみの 名前を 登録して、建物の カードを つなぐ
export function initBank(d = {}) {
  deps = { ...deps, ...d };
  registerBank();
  registerBuildingCard('sansu', openBank);
  // 日が かわった ぶんの 利子と、レベルアップの ことば（町が 見えている ときだけ）
  setInterval(() => { if (deps.isHome()) tick(); }, 5000);
  onChange(() => { /* 利子は tick で つける。ここでは 何もしない */ });
  setTimeout(tick, 2500);
}

function tick(say) {
  const p = currentProfile();
  if (!p || currentIslandId(p) !== START || !bankOpen(p)) return;
  const subs = subjectNames(p);
  const g = settle(p, Date.now(), subs);
  if (g > 0) save();
  const lv = bankLevel(p, subs).lv;
  const seen = readLv();
  const was = seen[p.id];
  if (typeof was !== 'number') { seen[p.id] = lv; writeLv(seen); return; }   // はじめて 見た レベルは ことばを 出さない
  if (lv > was) {
    seen[p.id] = lv; writeLv(seen);
    (say || deps.say)?.(`ぎんこうが Lv${lv}に なったよ！`);
  }
}

function openBank(p, d, t) {
  const subs = t.subs;
  const gained = settle(p, Date.now(), subs);
  if (gained > 0) save();
  tick(t.piyoSay);
  const seen = readLv(); seen[p.id] = bankLevel(p, subs).lv; writeLv(seen);

  const bal = h('b', { class: 'bank-bal' });
  const lvTag = h('span', { class: 'bank-lv' });
  const words = h('p', { class: 'egg-words bank-words' });
  const next = h('p', { class: 'bank-next' });
  const meterI = h('i', {});
  const meter = h('div', { class: 'egg-meter bank-meter', 'aria-hidden': 'true' }, meterI);
  const msg = h('p', { class: 'egg-hint bank-msg', role: 'status' });
  const depRow = h('div', { class: 'bank-chips' });
  const outRow = h('div', { class: 'bank-chips' });

  const chip = (label, n, act) => h('button', { class: 'bank-chip', type: 'button', disabled: n > 0 ? null : true, onclick: () => act(n) }, label);
  const refresh = () => {
    const lv = bankLevel(p, subs);
    const ng = nextGain(p, subs);
    const dMax = canDeposit(p, subs);
    const wMax = canWithdraw(p);
    lvTag.textContent = `Lv${lv.lv}`;
    bal.textContent = `${shown(p)} pt`;
    if (ng.bal <= 0) words.textContent = 'あずけると まいにち ふえるよ';
    else if (ng.capped) words.textContent = `あした ${ng.gain}pt ふえるよ（いまは ここまで）`;
    else words.textContent = `あした ${ng.bal} × ${ng.mult} = ${ng.bal + ng.gain}`;
    next.textContent = lv.max ? 'ぎんこうは いちばん そだったよ！' : 'さんすうを べんきょうすると そだつよ';
    meterI.style.width = `${Math.max(6, Math.round(lv.k * 100))}%`;
    depRow.replaceChildren(
      h('span', { class: 'bank-lab' }, 'あずける'),
      chip('10', Math.min(10, dMax) === 10 ? 10 : 0, doDeposit), chip('50', Math.min(50, dMax) === 50 ? 50 : 0, doDeposit),
      chip('ぜんぶ', dMax, doDeposit));
    outRow.replaceChildren(
      h('span', { class: 'bank-lab' }, 'おろす'),
      chip('10', wMax >= 10 ? 10 : 0, doWithdraw), chip('50', wMax >= 50 ? 50 : 0, doWithdraw),
      chip('ぜんぶ', wMax, doWithdraw));
    if (dMax <= 0 && (p.points || 0) >= 1 && shown(p) >= lv.limit) msg.textContent = 'いっぱいだよ。べんきょうで おおきくなるよ';
  };
  const doDeposit = (n) => { if (deposit(p, n, Date.now(), subs)) { msg.textContent = `${n}pt あずけたよ`; refresh(); deps.render?.(); } };
  const doWithdraw = (n) => { if (withdraw(p, n, Date.now(), subs)) { msg.textContent = `${n}pt おろしたよ`; refresh(); deps.render?.(); } };

  msg.textContent = gained >= 1 ? `きょうは +${Math.floor(gained)}pt ふえたよ！` : '';
  t.showCard(
    h('div', { class: 'egg-head' }, t.eggIcon(d.color), h('b', {}, `${d.chara.name}の ${d.building.name}`), lvTag),
    h('div', { class: 'bank-book' }, h('small', {}, 'ちょきん'), bal, words),
    h('div', { class: 'bank-grow' }, meter, next),
    depRow, outRow, msg,
    t.studyBtn(p, t.subject));
  refresh();
}
