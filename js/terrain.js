// 草原の地面の高さ。なだらかな丘がつづき、はしっこは雲海へむかってゆるやかに下がる。
// 草・花・キャラ・建物はみんなここから高さをもらう。
export const EDGE_START = 25;

// 子どもがほった深さ（meadow が cutmask.digAt をつなぐ。ほっていなければ 0）
export const dug = { at: () => 0 };

// 子どもがかけた橋の床。橋の上では、ゆるやかにそった床の高さをかえす
export const decks = {
  list: [],
  at(x, z) {
    for (const d of decks.list) {
      const dx = x - d.cx; const dz = z - d.cz;
      const u = dx * d.ux + dz * d.uz;
      if (u < -d.L / 2 || u > d.L / 2) continue;
      const v = -dx * d.uz + dz * d.ux;
      if (Math.abs(v) > d.W / 2) continue;
      return d.y0 + d.arch * Math.sin((Math.PI * (u + d.L / 2)) / d.L);
    }
    return null;
  },
};

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 0.22 * Math.sin(x * 0.13 + 0.7) * Math.cos(z * 0.11 - 0.4)
        + 0.12 * Math.sin(x * 0.29 + z * 0.21 + 2.0);
  if (r > EDGE_START) {
    const d = r - EDGE_START;
    h -= 0.03 * d * d;
  }
  const g = h - dug.at(x, z);
  if (decks.list.length) { const dk = decks.at(x, z); if (dk != null && dk > g) return dk; }
  return g;
}
