// 3Dモデル（GLB）の キャラを 草原の 絵本の 絵柄に そろえる。
// - 光: 草原と 同じ Lambert（日なた・日かげ・夜で 明るさが かわる）。かげは 2だんの やわらかい トゥーン
// - 色: すこし あたたかく、すこし ひかえめに。こまかい 模様は すこし ぼかす（絵の具で ぬった ように）
// - コントラスト: ひくめに（つや なし・マット。草原の クリーム色に すこし よせる）
// - 紙: 表面に ごく うすい 紙の つぶつぶ
// - ふち線: こげ茶の 細い 線（うら面を ふくらませる やりかた。0 で なし。いまは なし）
// - 足もとの かげ: ふちが ぼけた まるい かげ（softShadow）
// 女の子（avatar3d.js）と ピヨ先生（world.js）の 両方に つかう。
import * as THREE from 'three';

const LINE = 0x6b4a3c;   // ふち線の 色（こげ茶）

// opts: { shadow: かげの 明るさ(0〜1), faceShadow: 顔の かげ, blur: ぼかし, warm: あたたかさ, line: ふち線の 太さ（モデルの 長さ。0 で なし）, faceNames: 顔の メッシュ名, tintMeshes: { メッシュ名: 'hair' | 'eye' } 色あいを ずらす メッシュ }
export function picturebook(model, opts = {}) {
  const o = {
    shadow: 0.82, faceShadow: 0.92, blur: 0.8, warm: 0.15, glow: 0.05, flat: 1.0, tint: 0, line: 0, faceNames: ['face'],
    ...opts,
  };
  const meshes = [];
  model.traverse((m) => { if (m.isMesh) meshes.push(m); });
  for (const m of meshes) {
    // 法線の ない モデル（ピヨ先生の GLB）は、光が 計算できず 端末によっては 真っ黒に なる。ここで 作る
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    const isFace = o.faceNames.some((n) => m.name.toLowerCase().includes(n));
    const conv = (mat) => toBookMaterial(mat, { ...o, shadow: isFace ? o.faceShadow : o.shadow, tintSlot: o.tintMeshes?.[m.name] || null });
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    if (o.line > 0) addOutline(m, o.line);
  }
}

function toBookMaterial(src, o) {
  const mat = new THREE.MeshLambertMaterial({
    map: src.map || null,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    side: src.side,
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    depthWrite: src.depthWrite,
  });
  // ほんの すこし 自分で 光らせて、日かげでも 色が しずみすぎない ように
  if (src.map && o.glow > 0) { mat.emissiveMap = src.map; mat.emissive = new THREE.Color(0xffffff).multiplyScalar(o.glow); }
  mat.name = src.name;
  // 町の 光の やわらげ（worldlook.js）は キャラには かけない（自分の 2だんの かげを つかう）
  mat.defines = { PB_CHAR: '' };
  // 色あいを ずらす（髪の色・目の色）。uniform を あとから かえるだけで、作りなおさない（setColorShift）
  //   hair: ピンクの ところ（髪）だけ ずらす / eye: 青い ところ（目）だけ ずらす
  const tintMode = o.tintSlot === 'hair' ? 1 : o.tintSlot === 'eye' ? 2 : 0;
  if (tintMode) mat.userData.pbShift = { value: new THREE.Vector3(0, 1, 1) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.pbShadow = { value: o.shadow };
    if (tintMode) shader.uniforms.pbShift = mat.userData.pbShift;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float pbShadow;${tintMode ? `\nuniform vec3 pbShift;\n${HSV_GLSL}` : ''}`)
      .replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
        'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        // 2だんの かげ（さかいめは やわらかく）
        'float dotNL = mix( pbShadow, 1.0, smoothstep( -0.1, 0.45, dot( geometryNormal, directLight.direction ) ) );',
      ))
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv, ${o.blur.toFixed(2)} );
  diffuseColor *= sampledDiffuseColor;${tintMode ? `
  {
    vec3 pbHsv = pbRgb2hsv( diffuseColor.rgb );
    // 髪は ピンクの ところだけ（毛先の 水色・お花は そのまま）、目は 青い ところだけ
    float pbK = smoothstep( ${tintMode === 2 ? '0.1, 0.05' : '0.16, 0.1'}, abs( fract( pbHsv.x - ${tintMode === 2 ? '0.58' : '0.93'} + 0.5 ) - 0.5 ) ) * smoothstep( 0.1, 0.2, pbHsv.y );
    vec3 pbTo = pbHsv2rgb( vec3( fract( pbHsv.x + pbShift.x ), clamp( pbHsv.y * pbShift.y, 0.0, 1.0 ), clamp( pbHsv.z * pbShift.z, 0.0, 1.0 ) ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, pbTo, pbK );
  }` : ''}
  // 紙の つぶつぶ（面に ついて 動く）と、絵の具の むら
  float pbG = fract( sin( dot( floor( vMapUv * 700.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  float pbM = sin( vMapUv.x * 23.0 + sin( vMapUv.y * 17.0 ) * 1.7 ) * sin( vMapUv.y * 19.0 + 0.7 );
  diffuseColor.rgb *= 0.965 + 0.045 * pbG + 0.025 * pbM;
#endif
  // すこし あたたかく、すこし ひかえめに（草原の 色に よせる）
  float pbL = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  diffuseColor.rgb = mix( vec3( pbL ), diffuseColor.rgb, 1.0 ) * mix( vec3( 1.0 ), vec3( 1.05, 1.0, 0.9 ), ${o.warm.toFixed(2)} );
  // コントラストを ひくく（明るい ところも 暗い ところも まんなかへ）、草原の クリーム色に すこし よせる
  diffuseColor.rgb = mix( vec3( 0.55, 0.52, 0.45 ), diffuseColor.rgb, ${o.flat.toFixed(2)} );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.96, 0.9, 0.76 ), ${o.tint.toFixed(2)} );
`);
  };
  mat.customProgramCacheKey = () => `pb-${o.shadow}-${o.blur}-${o.warm}-${o.glow}-${o.flat}-${o.tint}-${tintMode}`;
  return mat;
}

const HSV_GLSL = `
vec3 pbRgb2hsv( vec3 c ) {
  vec4 K = vec4( 0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0 );
  vec4 p = mix( vec4( c.bg, K.wz ), vec4( c.gb, K.xy ), step( c.b, c.g ) );
  vec4 q = mix( vec4( p.xyw, c.r ), vec4( c.r, p.yzx ), step( p.x, c.r ) );
  float d = q.x - min( q.w, q.y );
  return vec3( abs( q.z + ( q.w - q.y ) / ( 6.0 * d + 1e-10 ) ), d / ( q.x + 1e-10 ), q.x );
}
vec3 pbHsv2rgb( vec3 c ) {
  vec3 p = abs( fract( c.xxx + vec3( 1.0, 2.0 / 3.0, 1.0 / 3.0 ) ) * 6.0 - 3.0 );
  return c.z * mix( vec3( 1.0 ), clamp( p - 1.0, 0.0, 1.0 ), c.y );
}`;

// 色あいの ずらしを かえる（sh = [色あい, あざやかさ, 明るさ]）。しかけの ない 材質は 何もしない
export function setColorShift(mat, sh) {
  const u = mat?.userData?.pbShift;
  if (u) u.value.set(sh[0], sh[1], sh[2]);
}

// うら面を 法線の 向きに ふくらませた 同じ形を、こげ茶で かく
function addOutline(mesh, width) {
  const mat = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>\n  transformed += normalize( objectNormal ) * ${width.toFixed(4)};`,
    );
    // スキンなしの メッシュでも objectNormal が あるように
    if (!mesh.isSkinnedMesh) {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <beginnormal_vertex>\n#include <begin_vertex>');
    }
  };
  mat.customProgramCacheKey = () => `pb-line-${width}-${mesh.isSkinnedMesh}`;
  let line;
  if (mesh.isSkinnedMesh) {
    line = new THREE.SkinnedMesh(mesh.geometry, mat);
    line.bind(mesh.skeleton, mesh.bindMatrix);
    line.bindMode = mesh.bindMode;
  } else {
    line = new THREE.Mesh(mesh.geometry, mat);
  }
  line.name = `${mesh.name}__line`;
  line.frustumCulled = false;
  line.position.copy(mesh.position); line.quaternion.copy(mesh.quaternion); line.scale.copy(mesh.scale);
  mesh.parent.add(line);
  // 本体が かくれたら 線も かくす
  Object.defineProperty(line, 'visible', { get: () => mesh.visible, set: () => {} });
}

// 足もとの やわらかい かげ（まんなかが こく、ふちへ すうっと うすく）
let shadowTex = null;
export function softShadow(radius, opacity = 0.32) {
  if (!shadowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ color: 0x26331a, alphaMap: shadowTex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
