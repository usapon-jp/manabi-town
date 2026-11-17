// 中2社会・地理フラッシュカードの静的な回帰検査
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GEO_CARDS, GEO_REGIONS } from '../js/data/geo-flashcards.js';
import { geoDeck } from '../js/geo-flashcards.js';

assert.deepEqual(GEO_REGIONS.map((r) => r.cards.length), [34, 34, 32]);
assert.equal(GEO_CARDS.length, 100);
assert.equal(new Set(GEO_CARDS.map((c) => c.id)).size, 100);
assert.equal(new Set(GEO_CARDS.map((c) => c.front)).size, 100);
for (const c of GEO_CARDS) {
  assert.ok(c.front.endsWith('？'), c.id + ': 問題文');
  assert.ok(c.back.trim(), c.id + ': 答え');
  assert.ok(c.regionLabel, c.id + ': 地方');
}
assert.equal(geoDeck({}).length, 100);
const p = { geoFlash: { 'kyushu-1': 'known', 'kyushu-2': 'missed' } };
assert.equal(geoDeck(p).length, 99);
assert.equal(geoDeck(p, 'kyushu').length, 33);
assert.deepEqual(geoDeck(p, 'all', true).map((c) => c.id), ['kyushu-2']);
assert.equal(geoDeck(p, 'kinki', true).length, 0);
const allKnown = { geoFlash: Object.fromEntries(GEO_CARDS.map((c) => [c.id, 'known'])) };
assert.equal(geoDeck(allKnown).length, 100, '全部覚えたら再挑戦できる');

const study = readFileSync(new URL('../js/study.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert.match(study, /p\.grade === 'j2'[\s\S]*?中2社会｜地理 下2〜4/);
for (const path of ['js/geo-flashcards.js', 'js/data/geo-flashcards.js']) {
  assert.ok(sw.includes("'" + path + "'"), path + ': オフライン対応');
}
console.log('中2地理：九州34／中国四国34／近畿32＝100問、進捗・復習・学年・キャッシュ OK');
