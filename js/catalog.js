// 子どもが持っている「つくるもの」の台帳と、ガチャ。
// 柵のかたち・置きもの（ひさし・レイズドベッド・丘の家）は、ここに足すだけでふえる。
// id は一度きめたら変えない（保存した操作が id で呼びだすため）。知らない id は、読みとばす。
import { currentProfile, save } from './store.js';

// rarity: common / uncommon / rare。own: 最初から持っている
export const ITEMS = {
  // 柵のかたち
  'fence:wood':  { kind: 'fence', label: '木の柵', rarity: 'common', own: true },
  'fence:stone': { kind: 'fence', label: '石垣', rarity: 'uncommon' },
  'fence:iron':  { kind: 'fence', label: 'てつの柵', rarity: 'rare' },
  // 置きもの
  'piece:raisedbed': { kind: 'piece', label: 'レイズドベッド', rarity: 'common', own: true },
  'piece:awning':    { kind: 'piece', label: 'ひさし', rarity: 'uncommon' },
  'piece:hill':      { kind: 'piece', label: '丘の家', rarity: 'rare' },
};
export const RARITY_WEIGHT = { common: 60, uncommon: 30, rare: 10 };
export const RARITY_LABEL = { common: 'ふつう', uncommon: 'めずらしい', rare: 'とてもめずらしい' };

const worldOf = (p) => {
  if (!p.world || !Array.isArray(p.world.ops)) p.world = { v: 1, ops: [] };
  return p.world;
};

// いま持っているものの id の集まり
export function ownedSet(p = currentProfile()) {
  const s = new Set(Object.keys(ITEMS).filter((id) => ITEMS[id].own));
  if (p) for (const id of worldOf(p).owned || []) if (ITEMS[id]) s.add(id);
  return s;
}
export const isOwned = (id, p) => ownedSet(p).has(id);
export const ownedOfKind = (kind, p) => Object.keys(ITEMS).filter((id) => ITEMS[id].kind === kind && isOwned(id, p));

// ガチャ1回: まだ持っていないものから、めずらしさの重みでえらぶ。ぜんぶ持っていれば null。
// rand を渡すと、テストしやすい（0〜1の乱数）。
export function drawItem(p = currentProfile(), rand = Math.random) {
  if (!p) return null;
  const have = ownedSet(p);
  const pool = Object.keys(ITEMS).filter((id) => !have.has(id));
  if (!pool.length) return null;
  const total = pool.reduce((n, id) => n + RARITY_WEIGHT[ITEMS[id].rarity], 0);
  let r = rand() * total;
  let pick = pool[pool.length - 1];
  for (const id of pool) { r -= RARITY_WEIGHT[ITEMS[id].rarity]; if (r < 0) { pick = id; break; } }
  const w = worldOf(p);
  w.owned = [...(w.owned || []), pick];
  save();
  return { id: pick, ...ITEMS[pick] };
}
