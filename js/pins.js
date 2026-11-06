// ピン留め: きょう 優先して やりたい ことを、リストの いちばん上に 出す（その日だけ）
// きろくは p.pins = { 'YYYY-MM-DD': [キー...] }（3日分だけ のこす）
import { today, toISO, save } from './store.js';

export function pinKey(t) {
  if (t.kind === 'mine') return `m:${t.id}`;
  if (t.kind === 'routine') return `r:${t.r?.id}`;
  if (t.kind === 'step') return `s:${t.item.id}:${t.label}`;
  return t.kind;
}

const todays = (p) => {
  if (!p.pins || typeof p.pins !== 'object') p.pins = {};
  return p.pins[today()] || [];
};

export const isPinned = (p, t) => todays(p).includes(pinKey(t));

export function togglePin(p, t) {
  const key = pinKey(t);
  const cut = new Date(); cut.setDate(cut.getDate() - 3);
  Object.keys(p.pins || {}).forEach((k) => { if (k < toISO(cut)) delete p.pins[k]; });
  const list = todays(p);
  p.pins[today()] = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  save();
}

// ピンした ものを 先頭に（ピンした 順）
export function sortPinned(p, tasks) {
  const list = todays(p);
  if (!list.length) return tasks;
  const rank = (t) => { const i = list.indexOf(pinKey(t)); return i < 0 ? 1e6 : i; };
  tasks.forEach((t) => { t.pin = list.includes(pinKey(t)); });
  return [...tasks].sort((a, b) => rank(a) - rank(b));   // 安定ソート
}
