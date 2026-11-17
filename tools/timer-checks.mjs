// node --experimental-default-type=module tools/timer-checks.mjs
// タイマーの「あとから たす」（js/timer.js）の たしかめ。いちばん大事なのは
//   「きょう・きのう だけ」「1日 90分まで（なおしても こえない）」「タイマーと 同じに 数える」
import assert from 'node:assert/strict';
globalThis.window = { dispatchEvent() {}, addEventListener() {} };
globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {}, append() {}, setAttribute() {} }; }, createElementNS() { return { style: {}, append() {}, setAttribute() {} }; }, body: { append() {} } };
const { addManual, manualRoom, manualOn, minutesOn, MANUAL_DAY_MAX, sessions } = await import('../js/timer.js');
const { studyMinutes } = await import('../js/eggs.js');
const { toISO } = await import('../js/store.js');

const NOW = new Date(2026, 10, 17, 16, 30).getTime();
const T = toISO(new Date(NOW));
const Y = toISO(new Date(2026, 10, 16));
const kid = () => ({ id: 'k1', grade: 'e4', sessions: [] });

// 1. きょうに たすと、タイマーと 同じ 形で 入る（おわりは いま）
{
  const p = kid();
  const s = addManual(p, { date: T, minutes: 25, kind: 'homework', subject: '算数・数学' }, NOW);
  assert.equal(s.minutes, 25); assert.equal(s.points, 25); assert.equal(s.manual, true);
  assert.equal(s.start + 25 * 60000, NOW);
  assert.equal(minutesOn(p, T), 25);
  assert.equal(studyMinutes(p, '算数・数学', NOW - 3600000), 25);   // たまごにも 数える
}
// 2. きのうも たせる（おわりは きのうの 夜8時）。おとといや あしたは だめ
{
  const p = kid();
  const s = addManual(p, { date: Y, minutes: 30, subject: '国語' }, NOW);
  assert.equal(s.date, Y); assert.equal(new Date(s.start + 30 * 60000).getHours(), 20);
  assert.equal(addManual(p, { date: '2026-11-15', minutes: 10, subject: '国語' }, NOW), null);
  assert.equal(addManual(p, { date: '2026-11-18', minutes: 10, subject: '国語' }, NOW), null);
  assert.equal(sessions(p).length, 1);
}
// 3. 1日 90分まで。こえる ぶんは けずる、もう ないときは null。日ごとに べつ
{
  const p = kid();
  assert.equal(manualRoom(p, T, NOW), MANUAL_DAY_MAX);
  assert.equal(addManual(p, { date: T, minutes: 200, subject: '英語' }, NOW).minutes, 90);
  assert.equal(manualRoom(p, T, NOW), 0);
  assert.equal(addManual(p, { date: T, minutes: 5, subject: '英語' }, NOW), null);
  assert.equal(manualRoom(p, Y, NOW), 90);
  // タイマーで 計った 分は わくに 入らない
  p.sessions.push({ id: 'x', date: T, start: NOW - 3600000, minutes: 60, kind: 'self', subject: '英語', points: 60 });
  assert.equal(manualOn(p, T), 90); assert.equal(minutesOn(p, T), 150);
}
// 4. へんな 数は 入れない
{
  const p = kid();
  assert.equal(addManual(p, { date: T, minutes: 0, subject: '英語' }, NOW), null);
  assert.equal(addManual(p, { date: T, minutes: 'abc', subject: '英語' }, NOW), null);
  assert.equal(addManual(p, { date: T, minutes: 10 }, NOW), null);
  assert.equal(addManual(p, { date: T, minutes: 12.6, subject: '英語' }, NOW).minutes, 13);
}
// 5. 🔥の 勉強した日は えらんだ 日に つく（きのうの 分で きょうは つかない）
{
  const p = kid();
  addManual(p, { date: Y, minutes: 20, subject: '国語' }, NOW);
  assert.deepEqual(p.activeDays, { [Y]: true });
  addManual(p, { date: T, minutes: 20, subject: '国語' }, NOW);
  assert.deepEqual(p.activeDays, { [Y]: true, [T]: true });
}
console.log('timer-checks: ok');
