// ガチャの画面。ホームの「ガチャ」ボタンからひらく。しくみは gacha.js、ものの一覧は catalog.js。
import { h, toast } from './ui.js';
import { icon } from './icons.js';
import { currentProfile } from './store.js';
import { GACHA, ticketsOf, buyTicket, pull, collection } from './gacha.js';
import { RARITY_LABEL } from './catalog.js';

const RARITY_COLOR = { common: '#8aa66a', uncommon: '#5b8def', rare: '#e0a52f' };

export function openGacha(onClose) {
  const close = () => { sheet.remove(); onClose?.(); };
  const body = h('div', { class: 'sheet-card gacha' });
  const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) close(); } }, body);
  let last = null;   // さいごに出たもの

  function render() {
    const p = currentProfile();
    if (!p) { close(); return; }
    const n = ticketsOf(p);
    const items = collection(p);
    const done = items.every((i) => i.have);
    body.replaceChildren(
      h('p', { class: 'sheet-title' }, 'ガチャ'),
      h('p', { class: 'sheet-sub gacha-tickets' }, icon('gift'), ` チケット ${n} まい`),
      last
        ? h('div', { class: 'gacha-result', style: `border-color:${RARITY_COLOR[last.rarity]}` },
          h('small', { style: `color:${RARITY_COLOR[last.rarity]}` }, RARITY_LABEL[last.rarity]),
          h('b', {}, last.label), h('span', {}, 'が でたよ！'))
        : null,
      done
        ? h('p', { class: 'sheet-sub' }, 'ぜんぶ あつめたよ！ すごい！')
        : h('button', {
          class: 'btn primary big-btn', disabled: n < 1 || null,
          onclick: () => {
            const r = pull(p);
            if (r.ok) last = r.item; else if (r.why === 'tickets') toast('チケットが ないよ');
            render();
          },
        }, n < 1 ? 'チケットが ないよ' : 'ひく（チケット 1まい）'),
      done ? null : h('button', {
        class: 'btn', disabled: p.points < GACHA.pointCost || null,
        onclick: () => {
          const r = buyTicket(p);
          if (r.ok) toast('チケットを 1まい もらったよ'); else if (r.why === 'points') toast('ポイントが たりないよ'); else if (r.why === 'full') toast('チケットが いっぱいだよ');
          render();
        },
      }, `ポイント ${GACHA.pointCost} で チケット 1まい（いま ${p.points}）`),
      h('p', { class: 'sheet-sub gacha-how' }, `まいにち1まい・レベルアップで ${GACHA.levelTickets}まい もらえるよ`),
      h('div', { class: 'gacha-grid' }, items.map((i) => h('div', { class: `gacha-item ${i.have ? 'have' : ''}`, style: i.have ? `border-color:${RARITY_COLOR[i.rarity]}` : '' },
        h('small', { style: `color:${RARITY_COLOR[i.rarity]}` }, RARITY_LABEL[i.rarity]),
        h('b', {}, i.have ? i.label : '？？？')))),
      h('button', { class: 'link', onclick: close }, 'とじる'),
    );
  }
  render();
  document.body.append(sheet);
}
