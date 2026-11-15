// 町を「島」ごとに分ける土台。学期ごとに島が1つずつふえ、画面に出すのは いつも島1つ分だけ。
// ここは 保存の形と「いま どの島にいるか」だけを あつかう（3D や 画面の部品には さわらない）。
//
// 保存の形（プロフィール p の中。これまでと同じく 端末どうしで そろう）:
//   p.world = {
//     v: 1 | 2,
//     ops: [...],                 // はじまりの島の「操作の並び」。これまでと同じ場所のまま 動かさない
//     isles: {                    // 2つめからの島（ひらいた島だけ）と、島ごとの おぼえがき
//       <島の id>: { ops: [...], ... },
//     },
//   }
// - はじまりの島の ops を p.world.ops のままにしているのは、いま子どもたちが使っているデータを
//   1文字も動かさずに引きつぐため。まだ古い版のままの端末が同じ p.world.ops を読み書きしても こわれない。
// - 島ごとに あとから足すもの（たまご・建物のたね など）は islandData(p, id) の入れ物に入れる。
//   島をまたぐもの（女の子の見た目・銀行 など）は p の直下か p.world の直下に、名前をつけて足す。
// - 「いま どの島にいるか」は端末ごとに おぼえる（そろえない。ほかの端末の移動で 画面が とつぜん変わらないように）。
// - 保存（save）は呼んだがわの仕事。ここは p を書きかえるだけ。

export const START = 'start';

// 島の台帳。あたらしい島は registerIsland で足す。id は保存に入るので、いちど決めたら変えない。
//   town: true … レベルで出る町の建物（家・風車・学校など）が ある島
//   dev: true  … ためし用。プロフィールには保存しない（開きなおすと消える）
const DEFS = new Map([[START, { id: START, name: 'はじまりの島', town: true }]]);

export function registerIsland(def) {
  if (!def || typeof def.id !== 'string' || !def.id || def.id === START) return false;
  DEFS.set(def.id, { ...def });
  return true;
}
export const islandDef = (id) => DEFS.get(id) || null;
export const allIslands = () => [...DEFS.values()];

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// p.world の形を たしかめて、足りないところだけ おぎなう。あるものは消さない
export function worldOf(p) {
  if (!plain(p.world)) p.world = { v: 1, ops: [] };
  else if (!Array.isArray(p.world.ops)) p.world.ops = [];
  return p.world;
}

// ためしの島（dev）の中身は、保存せずに ここで持つ
const devData = new Map();   // `${プロフィールid}|${島id}` -> { ops: [] }
function devRecord(p, id) {
  const k = `${p.id}|${id}`;
  if (!devData.has(k)) devData.set(k, { ops: [] });
  return devData.get(k);
}

// その島が ひらいているか。はじまりの島は いつも ひらいている
export function isOpen(p, id) {
  if (!p || !DEFS.has(id)) return false;
  if (id === START || DEFS.get(id).dev) return true;
  return plain(p.world?.isles) && plain(p.world.isles[id]);
}

// 島を ひらく（もう ひらいていれば そのまま）。ひらく条件を たしかめるのは 呼ぶがわ
export function openIsland(p, id) {
  if (!p || !DEFS.has(id)) return false;
  if (id === START || DEFS.get(id).dev) return true;
  const w = worldOf(p);
  if (!plain(w.isles)) w.isles = {};
  if (!plain(w.isles[id])) w.isles[id] = { ops: [] };
  if (!Array.isArray(w.isles[id].ops)) w.isles[id].ops = [];
  w.v = 2;
  return true;
}

export const openIslands = (p) => allIslands().filter((d) => isOpen(p, d.id));

// 島ごとの入れ物（操作の並び いがいの、その島だけの おぼえがき）。ひらいていない島は null
export function islandData(p, id) {
  if (!isOpen(p, id)) return null;
  if (DEFS.get(id).dev) return devRecord(p, id);
  const w = worldOf(p);
  if (!plain(w.isles)) w.isles = {};
  if (!plain(w.isles[id])) w.isles[id] = id === START ? {} : { ops: [] };
  return w.isles[id];
}

// その島の「操作の並び」。ひらいていない島・知らない島は null
export function islandOps(p, id) {
  if (!isOpen(p, id)) return null;
  if (id === START) return worldOf(p).ops;
  const rec = islandData(p, id);
  if (!Array.isArray(rec.ops)) rec.ops = [];
  return rec.ops;
}

// ---- いま どの島にいるか（端末ごと） ----
const AT_KEY = 'manabi-island';   // { [プロフィールid]: 島id }
let atMemo = null;
function readAt() {
  if (atMemo) return atMemo;
  try { const v = JSON.parse(localStorage.getItem(AT_KEY) || 'null'); atMemo = plain(v) ? v : {}; } catch (e) { atMemo = {}; }
  return atMemo;
}
const listeners = new Set();
export function onIslandChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// いまいる島。おぼえていた島が なくなっていたら（台帳から消えた・まだ ひらいていない）はじまりの島
export function currentIslandId(p) {
  if (!p) return START;
  const id = readAt()[p.id];
  return typeof id === 'string' && isOpen(p, id) ? id : START;
}

// 島を うつる。うつれたら true（ひらいていない島へは うつれない）
export function setCurrentIsland(p, id) {
  if (!p || !isOpen(p, id)) return false;
  if (currentIslandId(p) === id) return true;
  const at = readAt();
  if (id === START) delete at[p.id]; else at[p.id] = id;
  try { localStorage.setItem(AT_KEY, JSON.stringify(at)); } catch (e) { /* おぼえられなくても、この回は うつれる */ }
  listeners.forEach((fn) => fn(id));
  return true;
}

// いまの島 いがいの、ひらいている島の [{ def, ops }]（「ガチャの物は ぜんぶの島で1こ」などを しらべるとき）
export function otherIslands(p, exceptId) {
  return openIslands(p).filter((d) => d.id !== exceptId).map((d) => ({ def: d, ops: islandOps(p, d.id) || [] }));
}
