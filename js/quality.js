// 画質（草や花の数・解像度）。ふるい端末では「ひかえめ」にして、かるく動かす。
// きめかた: ?q=low / ?q=high（URLで試す） → 保存した画質 → 端末のスペックから推測。
// ふつうの画質でカクカクする（フレームが長い）と、自動で「ひかえめ」に下げて保存する。
const KEY = 'manabi-quality';

export function loadQuality() {
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q === 'low' || q === 'high') {
      if (q === 'high') localStorage.removeItem(KEY);   // ?q=high で、保存した「ひかえめ」をリセット
      return q;
    }
    const v = localStorage.getItem(KEY);
    if (v === 'low') return 'low';
  } catch (_) { /* 保存が使えない環境でも動かす */ }
  const mem = navigator.deviceMemory;            // Chrome系だけ。2GB以下は「ひかえめ」
  const cores = navigator.hardwareConcurrency;
  if ((mem && mem <= 2) || (cores && cores <= 2)) return 'low';
  return 'high';
}

export function saveLowQuality() {
  try { localStorage.setItem(KEY, 'low'); } catch (_) { /* 無視 */ }
}

// ふつうの画質で、およそ何fpsを下回ったら自動で下げるか（1フレームの平均が、この秒数をこえたら）
export const SLOW_FRAME_SEC = 0.037;   // 約27fps
export const WARMUP_FRAMES = 40;       // はじめの読みこみ中は数えない
export const SAMPLE_FRAMES = 90;
