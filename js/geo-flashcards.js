// 中2社会：テストプリント「地理 下2〜4」の一問一答。
// 表→答え→「できた」「もう一度」。1問ごとにプロフィールへ保存する。
import { h } from './ui.js';
import { save } from './store.js';
import { GEO_CARDS, GEO_REGIONS } from './data/geo-flashcards.js';

const SCORE = { known: 'できた', missed: 'もう一度' };

function progress(p, cards = GEO_CARDS) {
  const log = p.geoFlash || {};
  return {
    known: cards.filter((c) => log[c.id] === 'known').length,
    missed: cards.filter((c) => log[c.id] === 'missed').length,
    unseen: cards.filter((c) => !SCORE[log[c.id]]).length,
  };
}

// 出題順: 未学習 → × の問題。すべて ✓ なら最初から復習できる。
export function geoDeck(p, region = 'all', missedOnly = false) {
  const cards = GEO_CARDS.filter((c) => region === 'all' || c.region === region);
  if (missedOnly) return cards.filter((c) => p.geoFlash?.[c.id] === 'missed');
  const remaining = cards.filter((c) => p.geoFlash?.[c.id] !== 'known');
  return remaining.length ? remaining : cards;
}

export function openGeoFlashcards(p) {
  document.querySelector('.geo-layer')?.remove();
  const layer = h('div', { class: 'geo-layer', role: 'dialog', 'aria-modal': 'true',
    'aria-label': '中2社会 地理のフラッシュカード' });
  const close = () => layer.remove();
  let deck = [];
  let index = 0;
  let seen = 0;
  let right = 0;

  function top(title) {
    return h('div', { class: 'geo-top' },
      h('small', {}, '中2社会｜地理 下2〜4'),
      h('button', { type: 'button', class: 'geo-close', 'aria-label': 'とじる', onclick: close }, '×'));
  }

  function home() {
    const all = progress(p);
    const row = (label, note, action) => h('button', { type: 'button', class: 'geo-row', onclick: action },
      h('b', {}, label), h('small', {}, note), h('span', { 'aria-hidden': 'true' }, '›'));
    layer.replaceChildren(
      h('div', { class: 'geo-shell' },
        top(),
        h('h2', {}, '地理の一問一答 100問'),
        h('p', { class: 'geo-note' }, 'カードをタップして答えを確認。自分で ✓・× をつけよう。'),
        h('div', { class: 'geo-totals' },
          h('span', {}, '✓ 覚えた ', h('b', {}, String(all.known))),
          h('span', {}, '× 復習 ', h('b', {}, String(all.missed))),
          h('span', {}, '未学習 ', h('b', {}, String(all.unseen)))),
        row('全100問のつづき', '未学習・×から優先して出題', () => start('all')),
        ...GEO_REGIONS.map((r) => {
          const s = progress(p, GEO_CARDS.filter((c) => c.region === r.id));
          return row(r.label, s.known + ' / ' + r.cards.length + '問 覚えた', () => start(r.id));
        }),
        row('× の問題だけ復習', all.missed + '問', () => start('all', true)),
      ));
  }

  function result() {
    const s = progress(p);
    layer.replaceChildren(h('div', { class: 'geo-shell' }, top(),
      h('h2', {}, '今回の学習、おしまい！'),
      h('p', { class: 'geo-note' }, seen + '問チェックして、✓ は ' + right + '問。'),
      h('p', { class: 'geo-note' }, '全100問：覚えた ' + s.known + '問 ／ 復習 ' + s.missed + '問'),
      s.missed ? h('button', { type: 'button', class: 'btn primary geo-action', onclick: () => start('all', true) }, '× の問題をもう一度') : null,
      h('button', { type: 'button', class: 'btn geo-action', onclick: home }, '地方を選ぶ')));
  }

  function showCard() {
    if (index >= deck.length) return result();
    const card = deck[index];
    const content = h('div', { class: 'geo-card' });
    const actions = h('div', { class: 'geo-actions' });
    const showBack = () => {
      content.replaceChildren(h('small', {}, card.regionLabel + '｜答え'), h('strong', {}, card.back));
      actions.replaceChildren(
        h('button', { type: 'button', class: 'geo-mark missed', onclick: () => mark('missed') }, '× もう一度'),
        h('button', { type: 'button', class: 'geo-mark known', onclick: () => mark('known') }, '✓ できた'));
    };
    const mark = (status) => {
      p.geoFlash ||= {};
      p.geoFlash[card.id] = status;
      save();
      seen += 1;
      if (status === 'known') right += 1;
      index += 1;
      showCard();
    };
    content.replaceChildren(h('small', {}, card.regionLabel + '｜問題'), h('strong', {}, card.front));
    actions.replaceChildren(h('button', { type: 'button', class: 'btn primary geo-action', onclick: showBack }, '答えを見る'));
    layer.replaceChildren(h('div', { class: 'geo-shell' }, top(),
      h('div', { class: 'geo-progress' },
        h('span', {}, (index + 1) + ' / ' + deck.length + '問'),
        h('button', { type: 'button', class: 'geo-back', onclick: home }, '地方を選び直す')),
      h('button', { type: 'button', class: 'geo-flip', onclick: showBack }, content),
      actions));
  }

  function start(region = 'all', missedOnly = false) {
    deck = geoDeck(p, region, missedOnly);
    if (!deck.length) {
      home();
      return;
    }
    index = 0;
    seen = 0;
    right = 0;
    showCard();
  }

  document.body.append(layer);
  home();
}
