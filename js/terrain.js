// 草原の地面の高さ。なだらかな丘がつづき、はしっこは雲海へむかってゆるやかに下がる。
// 草・花・キャラ・建物はみんなここから高さをもらう。
export const EDGE_START = 25;

// 子どもがほった深さ（meadow が cutmask.digAt をつなぐ。ほっていなければ 0）
export const dug = { at: () => 0 };

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 0.22 * Math.sin(x * 0.13 + 0.7) * Math.cos(z * 0.11 - 0.4)
        + 0.12 * Math.sin(x * 0.29 + z * 0.21 + 2.0);
  if (r > EDGE_START) {
    const d = r - EDGE_START;
    h -= 0.03 * d * d;
  }
  return h - dug.at(x, z);
}
