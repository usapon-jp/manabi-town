// 算数・数学の問題を学年ごとにその場でつくる。答えはすべて整数。
const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
// 表示用のマイナス記号
const n = (v) => (v < 0 ? `−${-v}` : `${v}`);
const signed = (v) => (v < 0 ? ` − ${-v}` : ` + ${v}`);

function q(prompt, answer) {
  return { kind: 'number', subject: '算数', prompt: 'けいさんしよう', big: prompt, answer };
}

function word(prompt, answer) {
  return { kind: 'number', subject: '算数', prompt, answer };
}

const MAKERS = {
  e4: [
    (r) => { const a = int(r, 12, 99), b = int(r, 3, 9); return q(`${a} × ${b}`, a * b); },
    (r) => { const b = int(r, 2, 9), c = int(r, 11, 99); return q(`${b * c} ÷ ${b}`, c); },
    (r) => { const a = int(r, 11, 39), b = int(r, 11, 29); return q(`${a} × ${b}`, a * b); },
    (r) => { const a = int(r, 100, 899), b = int(r, 100, 899); return q(`${a} + ${b}`, a + b); },
    (r) => { const a = int(r, 300, 999), b = int(r, 100, a - 1); return q(`${a} − ${b}`, a - b); },
  ],
  e6: [
    (r) => {
      const base = pick(r, [80, 120, 200, 240, 300, 400, 500, 600]);
      const pct = pick(r, [10, 20, 25, 50, 75]);
      return word(`${base} の ${pct}% は いくつ？`, (base * pct) / 100);
    },
    (r) => { const v = pick(r, [3, 4, 5, 40, 50, 60]), t = int(r, 2, 5); return word(`時速${v}km で ${t}時間 進むと 何km？`, v * t); },
    (r) => { const a = int(r, 2, 9), b = int(r, 2, 9), k = int(r, 2, 6); return word(`${a} : ${b} = ${a * k} : □ の □ は？`, b * k); },
    (r) => { const a = int(r, 3, 9), x = int(r, 3, 12); return word(`x × ${a} = ${a * x} の x は？`, x); },
    (r) => { const a = int(r, 2, 9), b = int(r, 2, 9); return word(`たて${a}cm、よこ${b}cm、高さ4cm の直方体の体積は 何cm³？`, a * b * 4); },
  ],
  j: [
    (r) => {
      const x = int(r, -4, 9), a = int(r, 2, 6);
      let b = int(r, -9, 9); if (b === 0) b = 3;
      return word(`${a}x${signed(b)} = ${n(a * x + b)} の x は？`, x);
    },
    (r) => {
      const x = int(r, -3, 9), y = int(r, -3, 9), ask = r() < 0.5 ? 'x' : 'y';
      return word(`x + y = ${n(x + y)}、x − y = ${n(x - y)} のとき ${ask} は？`, ask === 'x' ? x : y);
    },
    (r) => {
      const a = pick(r, [-3, -2, 2, 3, 4]), b = int(r, -5, 5), x = int(r, -3, 5);
      return word(`y = ${a === 1 ? '' : n(a)}x${b === 0 ? '' : signed(b)} で x = ${n(x)} のとき y は？`, a * x + b);
    },
    (r) => {
      let a = int(r, -4, 5), b = int(r, -4, 5);
      if (a === 0) a = 2; if (b === 0) b = -1;
      const p = int(r, 2, 5), s = int(r, 2, 4);
      return word(`a = ${n(a)}、b = ${n(b)} のとき ${p}a − ${s}b の値は？`, p * a - s * b);
    },
  ],
};

export function mathQuestion(bucket, rand) {
  const makers = MAKERS[bucket] || MAKERS.e4;
  return makers[Math.floor(rand() * makers.length)](rand);
}
