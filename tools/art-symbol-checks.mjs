// 中2美術・シンボルマークの静的データ検査
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ART_SYMBOL_QA, ART_SYMBOL_REGION_COUNT } from '../js/data/art-symbols.js';
import { TEXT_BOOKS } from '../js/data/textbooks.js';

const book = TEXT_BOOKS.find((b) => b.id === 'art-symbols-p94-95');
assert.ok(book, '美術の教科書データが登録されている');
assert.equal(book.qa, ART_SYMBOL_QA);
assert.equal(book.subject.test('美術'), true);
assert.equal(book.subject.test('社会'), false);
assert.equal(book.match.test('教科書 P94〜95'), true);
assert.equal(book.match.test('教科書 94〜95'), true);
assert.equal(book.match.test('地域のシンボルマーク'), true);
assert.equal(book.match.test('地理 P156〜219'), false);
assert.equal(ART_SYMBOL_QA.length, 40);
assert.equal(ART_SYMBOL_REGION_COUNT, 23);
assert.equal(ART_SYMBOL_QA.slice(0, ART_SYMBOL_REGION_COUNT).filter((q) => /[都道府県]$/.test(q[1])).length, 23);
assert.equal(ART_SYMBOL_QA.filter((q) => q[5]).length, 38);
const cachedFiles = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
for (const [index, item] of ART_SYMBOL_QA.entries()) {
  const [prompt, correct, wrong, page, explain, imageSrc] = item;
  assert.ok(prompt.endsWith('？'), index + ': 問題文');
  assert.equal(typeof correct, 'string');
  assert.equal(wrong.length, 3);
  assert.equal(new Set([correct, ...wrong]).size, 4, index + ': 答えの重複');
  assert.ok([94, 95].includes(page));
  assert.ok(explain.length > 12, index + ': 解説');
  if (index < ART_SYMBOL_REGION_COUNT) assert.ok(imageSrc, index + ': 地域画像が必須');
  if (imageSrc) {
    assert.ok(existsSync(new URL('../' + imageSrc, import.meta.url)), index + ': 画像が存在する');
    assert.ok(cachedFiles.includes("'" + imageSrc + "'"), index + ': 画像がオフラインキャッシュ対象');
  }
}
console.log('中2美術・シンボルマーク: 40問／画像付き38問（地域23問は全画像）、4択・解説・範囲照合 OK');
