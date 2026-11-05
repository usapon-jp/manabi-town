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

// 並びの1こを見分ける名前: id か key（ふりかえりの記録）。どちらもなければ中身そのもの
const okId = (v) => typeof v === 'string' || typeof v === 'number';
const ident = (x) => (isObj(x) && okId(x.id) ? `id:${x.id}` : isObj(x) && okId(x.key) ? `key:${x.key}` : `json:${JSON.stringify(x)}`);
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
  const bm = new Map((Array.isArray(b) ? b : []).map((x) => [ident(x), x]));
  const lm = new Map(l.map((x) => [ident(x), x]));
  const rm = new Map(r.map((x) => [ident(x), x]));
  const order = [...new Set([...rm.keys(), ...lm.keys()])];
  const out = [];
  order.forEach((id) => {
    const bi = bm.get(id); const li = lm.get(id); const ri = rm.get(id);
    if (lm.has(id) && rm.has(id)) { out.push(merge3(bi, li, ri)); return; }
    const only = lm.has(id) ? li : ri;
    if (!bm.has(id)) { out.push(only); return; }          // 片方で ふえた
    if (!same(only, bi)) out.push(only);          // 片方で消えたが、もう片方で変えていた → のこす
  });
  return out;
}

// 並び: 1こずつ見分けて、両方の追加をあわせ、どちらかで消したものは消す。
// id/key のあるもの（テスト・宿題・ふりかえり）は中身もまとめる。ないもの（実力テストの記録など）は同じ中身を1つに
// 同じものが2こ以上ある並び（座標の数の列など、順番に意味があるもの）は、まぜずに この端末のほうをとる
const uniq = (a) => new Set(a.map(ident)).size === a.length;
function mergeArray(b, l, r) {
  if (!uniq(l) || !uniq(r) || (Array.isArray(b) && !uniq(b))) return l;
  return mergeById(b, l, r);
}

export function merge3(b, l, r, key) {
  // ポイント・けいけんちは、同じ数でも「両方で同じだけ ふえた」かもしれないので、先に足す
  if (ADD.has(key) && typeof l === 'number' && typeof r === 'number' && typeof b === 'number') return Math.max(0, r + (l - b));
  const grew = isObj(l) && isObj(b) && [...ADD].some((k) => typeof b[k] === 'number' && l[k] !== b[k]);
  if (same(l, r) && !grew) return l;
  if (b !== undefined && same(l, b)) return r;
  if (b !== undefined && same(r, b)) return l;
  if (l === undefined) return r;
  if (r === undefined) return l;
  if (key === 'log' && Array.isArray(l) && Array.isArray(r)) return mergeLog(b, l, r);
  if (ADD.has(key) && typeof l === 'number' && typeof r === 'number') {
    return Math.max(l, r);
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
  // レベルの とっておき（js/progress.js）は、高いレベルのほうを のこす（レベルが下がらないように）
  const keeps = [local?.lvKeep, remote?.lvKeep].filter((k) => isObj(k) && typeof k.lv === 'number');
  if (keeps.length && isObj(out)) out.lvKeep = keeps.reduce((a, b) => (b.lv > a.lv || (b.lv === a.lv && b.base > a.base) ? b : a));
  return out;
}
