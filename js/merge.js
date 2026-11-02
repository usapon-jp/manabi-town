// 2つの端末で同じ人の進みが別々にふえたとき、まとめる。
// base = 前にそろえたときの中身（ないときは null）、local = この端末、remote = クラウド。
// きまり:
//  - 片方しか変わっていないところは、変わったほうをとる
//  - ポイント・けいけんちは「ふえた分」を足しあわせる
//  - id のある並び（テスト・宿題・小テストなど）は id ごとにまとめる。消したものは消す
//  - ポイントの記録（log）は両方をあわせて、新しい順に200こまで
//  - どちらも同じところを変えていたら、この端末のほうをとる

const ADD = new Set(['points', 'xp']); // ふえた分を足すもの
const LOG_MAX = 200;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

function byId(arr) {
  return arr.length > 0 && arr.every((x) => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number'));
}
const logKey = (e) => `${e.at}|${e.n}|${e.reason}`;

function mergeLog(b, l, r) {
  const gone = new Set();
  // base にあって片方で消えたもの（200こをこえて落ちたもの）はそのまま落とす
  if (Array.isArray(b)) {
    const lk = new Set(l.map(logKey)); const rk = new Set(r.map(logKey));
    b.forEach((e) => { const k = logKey(e); if (!lk.has(k) || !rk.has(k)) gone.add(k); });
  }
  const seen = new Set(); const out = [];
  [...r, ...l].forEach((e) => { const k = logKey(e); if (seen.has(k) || gone.has(k)) return; seen.add(k); out.push(e); });
  out.sort((x, y) => (y.at || 0) - (x.at || 0));
  return out.slice(0, LOG_MAX);
}

function mergeById(b, l, r) {
  const bm = new Map((Array.isArray(b) ? b : []).filter(isObj).map((x) => [x.id, x]));
  const lm = new Map(l.map((x) => [x.id, x]));
  const rm = new Map(r.map((x) => [x.id, x]));
  const order = [...r.map((x) => x.id), ...l.map((x) => x.id).filter((id) => !rm.has(id))];
  const out = [];
  order.forEach((id) => {
    const bi = bm.get(id); const li = lm.get(id); const ri = rm.get(id);
    if (li && ri) { out.push(merge3(bi, li, ri)); return; }
    const only = li || ri;
    if (!bi) { out.push(only); return; }          // 片方で ふえた
    if (!same(only, bi)) out.push(only);          // 片方で消えたが、もう片方で変えていた → のこす
  });
  return out;
}

function mergeArray(b, l, r) {
  if (byId(l) || byId(r)) {
    if ((byId(l) || !l.length) && (byId(r) || !r.length)) return mergeById(b, l, r);
  }
  if (l.every((x) => typeof x !== 'object') && r.every((x) => typeof x !== 'object')) {
    // 文字や数の並び: 両方の追加をあわせ、どちらかで消したものは消す
    const bs = new Set(Array.isArray(b) ? b : []);
    const ls = new Set(l); const rs = new Set(r);
    const out = [];
    [...r, ...l].forEach((x) => {
      if (out.includes(x)) return;
      if (bs.has(x) && (!ls.has(x) || !rs.has(x))) return;
      out.push(x);
    });
    return out;
  }
  return l;
}

export function merge3(b, l, r, key) {
  if (same(l, r)) return l;
  if (b !== undefined && same(l, b)) return r;
  if (b !== undefined && same(r, b)) return l;
  if (l === undefined) return r;
  if (r === undefined) return l;
  if (key === 'log' && Array.isArray(l) && Array.isArray(r)) return mergeLog(b, l, r);
  if (ADD.has(key) && typeof l === 'number' && typeof r === 'number') {
    return typeof b === 'number' ? Math.max(0, r + (l - b)) : Math.max(l, r);
  }
  if (isObj(l) && isObj(r)) {
    const out = {};
    const bo = isObj(b) ? b : {};
    new Set([...Object.keys(r), ...Object.keys(l)]).forEach((k) => {
      const v = merge3(isObj(b) ? bo[k] : undefined, l[k], r[k], k);
      // 片方で消して、もう片方で変えていないなら消す
      if (isObj(b) && k in bo && (!(k in l) || !(k in r))) {
        const kept = k in l ? l[k] : r[k];
        if (same(kept, bo[k])) return;
      }
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  if (Array.isArray(l) && Array.isArray(r)) return mergeArray(b, l, r);
  return l;
}

// 1人分（プロフィール）をまとめる。base がないとき（はじめての引っ越し）は、
// ポイントを「クラウドの分 ＋ この端末にしかない記録の分」にする。
export function mergeProfile(base, local, remote) {
  const out = merge3(base ?? undefined, local, remote);
  if (!base && isObj(local) && isObj(remote)) {
    const rk = new Set((remote.log || []).map(logKey));
    const extra = (local.log || []).filter((e) => !rk.has(logKey(e)));
    const sum = extra.reduce((s, e) => s + (Number(e.n) || 0), 0);
    const plus = extra.reduce((s, e) => s + Math.max(0, Number(e.n) || 0), 0);
    out.points = Math.max(0, (Number(remote.points) || 0) + sum);
    if (typeof remote.xp === 'number' || typeof local.xp === 'number') out.xp = Math.max(0, (Number(remote.xp) || 0) + plus);
    out.id = remote.id;
    out.name = remote.name;
  }
  return out;
}
