// Run: node tools/thinking-checks.mjs
// Pure logic and isolated DOM checks; mobile layout is checked separately in Chrome.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(tag, doc) { this.tag = tag; this.doc = doc; this.children = []; this.attrs = {}; this.listeners = {}; this.scrollTop = 0; this.disabled = false; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  append(...children) { children.forEach(c => { c.parent = this; this.children.push(c); }); }
  replaceChildren(...children) { this.children.forEach(c => { c.parent = null; }); this.children = []; this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  get isConnected() { return this === this.doc.body || !!this.parent?.isConnected; }
  get classList() { return { add: name => { this.className = `${this.className || ''} ${name}`; } }; }
  querySelectorAll(selector) {
    const matches = el => selector.startsWith('.') ? (el.className || '').split(' ').includes(selector.slice(1)) : el.tag === selector;
    return this.children.flatMap(c => [ ...(matches(c) ? [c] : []), ...c.querySelectorAll(selector) ]);
  }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  focus() { this.doc.activeElement = this; }
  scrollIntoView() { this.scrolledIntoView = true; }
  click() { this.listeners.click?.({ target: this, currentTarget: this }); }
  get textContent() { return this.text || this.children.map(c => c.textContent).join(''); }
}
const document = {};
document.body = new Element('body', document);
document.createElement = tag => new Element(tag, document);
document.createTextNode = text => Object.assign(new Element('#text', document), { text });
document.querySelector = s => document.body.querySelector(s);
const source = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/\bexport /g, '');
const context = vm.createContext({ document, Node: Element });
vm.runInContext(source('js/ui.js') + '\n' + source('js/thinking.js') + '\nglobalThis.api = { THINKING_QUESTIONS, createThinkingSession, openThinkingClassroom };', context);
const { THINKING_QUESTIONS: bank, createThinkingSession, openThinkingClassroom } = context.api;
const snapshot = JSON.stringify(bank);

// Independently enumerate all assignments for the three logic problems.
const permutations = xs => xs.length ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map(p => [x, ...p])) : [[]];
const snacks = permutations(['りんご', 'クッキー', 'ケーキ']).filter(([rabbit, cat, fox]) => cat === 'ケーキ' && rabbit !== 'りんご' && fox !== 'クッキー');
const order = permutations(['ピヨ', 'モモ', 'ソラ']).filter(p => p.indexOf('ピヨ') < p.indexOf('モモ') && p.indexOf('ソラ') > p.indexOf('モモ'));
const boxes = permutations(['星', '月', '花']).filter(([red, blue]) => red === '星' && blue === '花');
assert.equal(snacks.length, 1); assert.equal(order.length, 1); assert.equal(boxes.length, 1);
const expected = { 'logic-snacks': snacks[0][0], 'logic-order': order[0][1], 'logic-boxes': boxes[0][2], 'reading-rain': '学校', 'reading-letter': '日曜日', 'reading-library': '行ける' };
assert.equal(new Set(bank.map(q => q.id)).size, 6);
for (const q of bank) assert.equal(q.choices[q.answer], expected[q.id], q.id);

// Every question reaches every answer position, while the answer text stays correct.
let seed = 70;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const positions = Object.fromEntries(bank.map(q => [q.id, new Set()]));
for (let i = 0; i < 2000; i++) {
  const session = createThinkingSession(rand);
  assert.equal(new Set(session.map(q => q.id)).size, 3);
  for (const q of session) {
    assert.equal(q.choices[q.answer], expected[q.id]);
    assert.equal(new Set(q.choices).size, 3);
    positions[q.id].add(q.answer);
  }
}
for (const seen of Object.values(positions)) assert.equal(seen.size, 3);
assert.equal(JSON.stringify(bank), snapshot);

// Real h() + classroom: hint, wrong/correct, repeated events, scrolling, result, close.
const findButton = text => document.body.querySelectorAll('button').find(b => b.textContent === text);
const opener = document.createElement('button'); document.body.append(opener);
for (const allCorrect of [true, false]) {
  opener.focus(); openThinkingClassroom();
  for (let n = 0; n < 3; n++) {
    const card = document.querySelector('.sheet-card');
    assert.equal(card.scrollTop, 0);
    assert.equal(document.activeElement, card.querySelector('.sheet-title'));
    const q = bank.find(q => card.textContent.includes(q.title));
    const hintButton = findButton('ヒントをみる'); hintButton.click();
    assert.equal(card.children.find(c => c.textContent === q.hint).hidden, false);
    const options = card.querySelector('.thinking-choices').querySelectorAll('button');
    const chosen = options.find(b => allCorrect ? b.textContent === expected[q.id] : b.textContent !== expected[q.id]);
    chosen.click(); chosen.click(); // Guard must survive queued duplicate events.
    assert.ok(options.every(b => b.disabled));
    assert.ok(card.querySelector('.thinking-feedback').textContent.includes(q.explain));
    card.scrollTop = 300;
    findButton(n === 2 ? 'けっかへ' : 'つぎの問題').click();
  }
  assert.ok(document.body.textContent.includes(`3もん中 ${allCorrect ? 3 : 0}もん せいかい`));
  assert.equal(document.querySelector('.sheet-card').scrollTop, 0);
  findButton('おわる').click(); assert.equal(document.querySelector('.thinking-overlay'), null);
  assert.equal(document.activeElement, opener);
}
openThinkingClassroom(); findButton('とじる').click();
assert.equal(document.querySelector('.thinking-overlay'), null);
openThinkingClassroom(); openThinkingClassroom();
assert.equal(document.body.querySelectorAll('.thinking-overlay').length, 1);
document.querySelector('.thinking-overlay').click();
assert.equal(document.querySelector('.thinking-overlay'), null);
console.log('PASS: unique logic solutions; six answer keys; 2,000 shuffled sessions; hint/correct/wrong/duplicate/scroll/result/close flows. No store or reward dependency.');

// Existing puzzle generators still import and produce usable data at every level.
for (const name of ['icepath', 'blocks', 'origami', 'pattern', 'section']) {
  const { default: game } = await import(`../js/brain/${name}.js`);
  for (let level = 0; level <= 8; level++) for (let n = 0; n < 10; n++) {
    const p = game.make(level, rand);
    if (name === 'icepath') {
      assert.equal(new Set(p.solution).size, p.solution.length);
      assert.equal(p.start, p.solution[0]); assert.equal(p.goal, p.solution.at(-1));
      for (let k = 1; k < p.solution.length; k++) {
        const a = p.solution[k - 1], b = p.solution[k];
        assert.equal(Math.abs(a % p.w - b % p.w) + Math.abs(Math.floor(a / p.w) - Math.floor(b / p.w)), 1);
      }
    } else {
      assert.ok(p.options.length > 1);
      assert.ok(Number.isInteger(p.answer) && p.answer >= 0 && p.answer < p.options.length);
    }
  }
}
console.log('PASS: existing five puzzle generators, levels 0–8, 450 puzzles (path continuity / answer index).');
