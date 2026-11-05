// 毎日のクエスト（漢字・英単語・算数）をつくる。
// 同じ日・同じ子なら同じ問題になるよう、日付から乱数をつくる。
import { KANJI } from './data/kanji.js';
import { ENGLISH } from './data/english.js';
import { mathQuestion } from './math.js';

export const PER_SUBJECT = 3;
export const POINTS_PER_CORRECT = 10;
export const CLEAR_BONUS = 30;

export function seededRandom(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function choiceFromPairs(pairs, rand, count, make) {
  const picked = shuffle(pairs, rand).slice(0, count);
  return picked.map(([word, answer, sentence]) => {
    const wrong = shuffle(pairs.filter((p) => p[1] !== answer), rand).slice(0, 2).map((p) => p[1]);
    const options = shuffle([answer, ...wrong], rand);
    return make(word, options, options.indexOf(answer), sentence);
  });
}

// 漢字の問題。れいぶんの中で どのことばかを見せて、同じ読みの別のことばと まちがえないようにする
const kanjiWrite = ([word, reading, sentence]) => ({
  kind: 'write', subject: '漢字', prompt: 'かんじで 書けるかな？', big: reading, answerText: word, context: sentence,
});
const kanjiRead = (word, options, answer, sentence) => ({
  kind: 'choice', subject: '漢字', prompt: 'よみかたは？', big: word, options, answer, context: sentence,
});

// base: 入れる教科（作戦会議で きめる）。乱数の順番を かえないよう、作ってから えらぶ
export function buildDaily(bucket, seed, base = ['kanji', 'english', 'math'], rand = seededRandom(seed)) {
  // 漢字は 書き2もん＋読み1もん。書きはノートに書いて、お手本を見て自分で答え合わせ
  const picked = shuffle(KANJI[bucket], rand);
  const writes = picked.slice(0, PER_SUBJECT - 1).map(kanjiWrite);
  const rest = picked.slice(PER_SUBJECT - 1);
  const reads = choiceFromPairs(rest, rand, 1, kanjiRead);
  const kanji = [...writes, ...reads];
  const english = choiceFromPairs(ENGLISH[bucket], rand, PER_SUBJECT, (word, options, answer) => ({
    kind: 'choice', subject: '英単語', prompt: 'いみは？', big: word, options, answer,
  }));
  const math = Array.from({ length: PER_SUBJECT }, () => mathQuestion(bucket, rand));
  return [...(base.includes('kanji') ? kanji : []), ...(base.includes('english') ? english : []), ...(base.includes('math') ? math : [])];
}

// ボーナスのドリル（1教科だけ5もん）。毎日のクエストとは別の問題になるよう、たねを変える
export const DRILLS = [
  { id: 'kanji', label: '漢字ドリル', ic: 'pen-line' },
  { id: 'english', label: '英単語ドリル', ic: 'languages' },
  { id: 'math', label: '計算ドリル', ic: 'calculator' },
];
export const DRILL_COUNT = 5;

export function buildDrill(id, bucket, seed, rand = seededRandom(`drill:${id}:${seed}`)) {
  if (id === 'kanji') {
    const picked = shuffle(KANJI[bucket], rand);
    const writes = picked.slice(0, 3).map(kanjiWrite);
    const reads = choiceFromPairs(picked.slice(3), rand, DRILL_COUNT - 3, kanjiRead);
    return [...writes, ...reads];
  }
  if (id === 'english') {
    return choiceFromPairs(ENGLISH[bucket], rand, DRILL_COUNT, (word, options, answer) => ({
      kind: 'choice', subject: '英単語', prompt: 'いみは？', big: word, options, answer,
    }));
  }
  return Array.from({ length: DRILL_COUNT }, () => mathQuestion(bucket, rand));
}

// とりこんだ小テストを、クエストと同じ形の問題にする
export function quizQuestions(quiz) {
  return quiz.questions.map((q) => (
    q.options
      ? { kind: 'choice', subject: quiz.subject || '小テスト', prompt: q.q, options: q.options, answer: q.answer }
      : { kind: 'number', subject: quiz.subject || '小テスト', prompt: q.q, answer: Number(q.answer) }
  ));
}
