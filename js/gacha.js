// ガチャのチケットと、ひく処理。数字はここ（GACHA）だけで調整できる。
//   チケットの手に入れかた: 毎日1回のログインボーナス／レベルアップごと／ポイントと交換
//   何が出るかは catalog.js（まだ持っていない物から、めずらしさの重みで1つ）
// 保存場所: p.tickets（チケットの数）、p.gachaDay（さいごにログインボーナスをもらった日）、p.gachaLv（ここまでのレベルぶん）
import { currentProfile, save, today } from './store.js';
import { levelInfo, totalXp } from './progress.js';
import { drawItem, ownedSet, ITEMS } from './catalog.js';

export const GACHA = {
  dailyTickets: 1,      // 毎日1回のログインボーナス
  levelTickets: 1,      // レベルが1つ上がるごと
  pointCost: 30,        // ポイント何点で、チケット1枚ぶんに交換できるか
  maxTickets: 99,       // ためておける上限
};

export const ticketsOf = (p = currentProfile()) => (p && Number(p.tickets)) || 0;

// 無料でもらえる分（きょうのログイン・上がったレベル）を、かくにんして足す。足した数をかえす
export function grantFree(p = currentProfile()) {
  if (!p) return { daily: 0, level: 0 };
  let daily = 0; let level = 0;
  const lv = levelInfo(totalXp(p)).lv;
  // はじめて見る人は、いまのレベルを基準にする（さかのぼってはくばらない）
  if (typeof p.gachaLv !== 'number') p.gachaLv = lv;
  if (lv > p.gachaLv) { level = (lv - p.gachaLv) * GACHA.levelTickets; p.gachaLv = lv; }
  const day = today();
  if (p.gachaDay !== day) { daily = GACHA.dailyTickets; p.gachaDay = day; }
  const add = daily + level;
  const before = ticketsOf(p);
  p.tickets = Math.min(GACHA.maxTickets, before + add);
  if (add || p.gachaLv !== lv) save();
  return { daily, level };
}

// ポイントをチケットに交換。ポイントだけをへらす（けいけんち・レベルは下がらない）
export function buyTicket(p = currentProfile()) {
  if (!p) return { ok: false, why: 'noprofile' };
  if (p.points < GACHA.pointCost) return { ok: false, why: 'points' };
  if (ticketsOf(p) >= GACHA.maxTickets) return { ok: false, why: 'full' };
  p.points -= GACHA.pointCost;
  p.tickets = ticketsOf(p) + 1;
  p.log.unshift({ at: Date.now(), n: -GACHA.pointCost, reason: 'ガチャのチケットと こうかん' });
  if (p.log.length > 200) p.log.length = 200;
  save();
  return { ok: true };
}

// ガチャを1回ひく。チケット1枚を使う。ぜんぶ持っていれば、チケットはへらさない
export function pull(p = currentProfile(), rand = Math.random) {
  if (!p) return { ok: false, why: 'noprofile' };
  if (ticketsOf(p) < 1) return { ok: false, why: 'tickets' };
  const item = drawItem(p, rand);
  if (!item) return { ok: false, why: 'complete' };
  p.tickets = ticketsOf(p) - 1;
  save();
  return { ok: true, item };
}

export const collection = (p = currentProfile()) => {
  const have = ownedSet(p);
  return Object.keys(ITEMS).map((id) => ({ id, ...ITEMS[id], have: have.has(id) }));
};
