// 中2美術「地域のマーク」のテスト対策。10問ずつ、次の回では未出題を優先。
// 県章の画像は使用許可が必要な自治体もあるため、特徴を言葉で当てる形式にする。
import { ART_SYMBOL_QA, ART_SYMBOL_REGION_COUNT } from './data/art-symbols.js';
import { seededRandom, shuffle } from './quests.js';
import { runQuestions } from './runner.js';
import { recordResults } from './review.js';
import { practicePoints } from './more.js';
import { today } from './store.js';

const ROUND = 10;
const prioritized = (p, serial) => {
  const key = String(p.id) + ':art:' + today() + ':' + serial;
  return [
    ...shuffle(ART_SYMBOL_QA.slice(0, ART_SYMBOL_REGION_COUNT), seededRandom(key + ':region')),
    ...shuffle(ART_SYMBOL_QA.slice(ART_SYMBOL_REGION_COUNT), seededRandom(key + ':other')),
  ];
};

export function startArtSymbolQuiz(p, deps) {
  let pool = prioritized(p, Date.now());
  let at = 0;

  function nextRound() {
    if (at >= pool.length) {
      pool = prioritized(p, Date.now());
      at = 0;
    }
    const selected = pool.slice(at, at + ROUND);
    at += selected.length;
    const qs = selected.map(([prompt, correct, wrong, , explain]) => {
      const options = shuffle([correct, ...wrong], Math.random);
      return {
        kind: 'choice', subject: '美術', topic: '中2美術 P94〜95 地域のシンボルマーク',
        prompt, options, answer: options.indexOf(correct), explain, test: true,
      };
    });
    runQuestions('中2美術・シンボルマーク', qs, (score, total, results) => {
      recordResults(p, results, '中2美術・マーク');
      const message = practicePoints(p, score, total, '中2美術・シンボルマーク', deps);
      deps.render?.();
      return message;
    }, {
      again: {
        label: at < pool.length ? '残り' + (pool.length - at) + '問をやる' : 'もう1周',
        onClick: nextRound,
      },
    });
  }
  nextRound();
}
