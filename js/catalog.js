// 3Dの箱庭（柵・おきもの）が読む「もちもの」の入り口。
// 中身の表は js/data/gacha.js、もっているかどうかは js/gacha.js（ガチャで出たもの＋最初から持っているもの）。
// 3Dの道具は ここの ITEMS[id].label / ownedOfKind(kind) / isOwned(id) を使う。
import { ITEMS as LIST } from './data/gacha.js';
export { ownedSet, isOwned, ownedOfKind } from './gacha.js';

export const ITEMS = Object.fromEntries(LIST.map((i) => [i.id, i]));
