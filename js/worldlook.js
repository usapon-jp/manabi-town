// 町ぜんたいの「絵本の 世界」の 見た目（2026-11-18 フミオさん: やわらかく あたたかい 絵本の 世界に）。
// - 光: 草・花・木・建物の Lambert の かげを やわらかく（光の まわりこみ。かげの さかいめが ふんわり）
//        女の子と ピヨ先生（picturebook.js、PB_CHAR）は 自分の 2だんの かげを つかうので さわらない
// - 色の しあげ: ACES の あとに、ごく うすく あたたかい 色みと やさしい コントラストに（画面ぜんたいの ポストプロセスの かわり）。
//        1まいの 絵を あとから 加工しないので、スマホでも 重く ならない（各マテリアルの 最後で 計算するだけ）
// world.js が レンダラーを 作るときに applyWorldLook(renderer) を よぶ。
import * as THREE from 'three';

const WRAP = 0.4;   // 光の まわりこみ（0 で ふつう。大きいほど かげが うすく やわらかい）

let patched = false;
function patchChunks() {
  if (patched) return;
  patched = true;
  // かげの さかいめを やわらかく（キャラは 自分の かげの 計算を つかうので のぞく）
  THREE.ShaderChunk.lights_lambert_pars_fragment = THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
    'vec3 irradiance = dotNL * directLight.color;',
    `#ifndef PB_CHAR
	dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + ${WRAP.toFixed(2)} ) / ${(1 + WRAP).toFixed(2)} );
	#endif
	vec3 irradiance = dotNL * directLight.color;`,
  );
  // 色の しあげ: ACES → あたたかく・くらい ところを すこし もちあげる（すみっこの 黒を こげ茶に）
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    `vec3 CustomToneMapping( vec3 color ) {
	vec3 c = ACESFilmicToneMapping( color );
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	// くらい ところは ほんのり ももいろ、明るい ところは クリーム色に（夕方の 光の 色み）
	c *= mix( vec3( 1.0, 0.95, 0.93 ), vec3( 1.03, 1.0, 0.93 ), smoothstep( 0.0, 0.6, l ) );
	// いちばん くらい ところを すこし もちあげる（線形の 値。画面では こげ茶くらいに）
	c = c * 0.975 + vec3( 0.009, 0.006, 0.005 );
	return saturate( c );
}`,
  );
}

export function applyWorldLook(renderer) {
  patchChunks();
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = 1.05;
}
