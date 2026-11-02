// 風でゆれる草・花で共通につかう部品（草と花、いろいろな植物がいっしょにゆれる）
import * as THREE from 'three';

// 両面の草や花びらが、うらがわでも暗くならないよう、向きによる反転をやめる
export const NORMAL_NO_FLIP = THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0');

// 風の共通パラメータ（草・花がいっしょにゆれる）
// cut: cutmask.js の uniforms（かった場所の地図）。つけると、かった所の草や花が短く・なくなる
export function makeWind(cut) {
  return { uTime: { value: 0 }, uActor: { value: new THREE.Vector3(999, 0, 999) }, ...(cut || {}) };
}

// stub: かった場所での高さの残り（草は0.12=かりあと、花などは0=なくなる）
export function addWind(material, wind, h, gain, stub = 0) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.uniforms.uActor = wind.uActor;
    shader.uniforms.uCut = wind.uCut;
    shader.uniforms.uCutR = wind.uCutR;
    shader.uniforms.uDig = wind.uDig;
    shader.vertexShader = 'uniform float uTime;\nuniform vec3 uActor;\nuniform sampler2D uCut;\nuniform sampler2D uDig;\nuniform float uCutR;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wk = clamp(position.y / ${h.toFixed(3)}, 0.0, 1.0);
        wk = wk * wk;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        mvPosition = instanceMatrix * mvPosition;
        vec4 wroot = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // 大きな風のなみが草原をわたっていく + こまかいそよぎ
        float gust = sin(wroot.x * 0.11 + wroot.z * 0.06 - uTime * 1.15) * 0.6
                   + sin(wroot.x * 0.29 - wroot.z * 0.21 - uTime * 2.4) * 0.25 + 0.25;
        float flutter = sin(uTime * 3.3 + wroot.x * 2.3 + wroot.z * 1.9) * 0.07;
        vec2 sway = vec2(gust + flutter, gust * 0.4 - flutter) * ${gain.toFixed(3)};
        // ピヨが近づくと、草がふわっとよける
        vec2 away = wroot.xz - uActor.xz;
        float ad = length(away);
        sway += normalize(away + vec2(0.0001)) * smoothstep(1.7, 0.0, ad) * ${(gain * 3.2).toFixed(3)};
        mvPosition.xz += sway * wk;
        // かった場所では、根もとにむけてちぢめる
        vec4 cm = texture2D(uCut, (wroot.xz + uCutR) / (2.0 * uCutR));
        float dg = texture2D(uDig, (wroot.xz + uCutR) / (2.0 * uCutR)).r;
        float cutv = max(smoothstep(0.35, 0.65, max(cm.r, cm.g)), smoothstep(0.05, 0.2, dg));
        vec3 cd = mvPosition.xyz - wroot.xyz;
        cd.y *= mix(1.0, ${stub.toFixed(3)}, cutv);
        cd.xz *= mix(1.0, ${stub > 0 ? '1.0' : '0.0'}, cutv);
        mvPosition.xyz = wroot.xyz + cd;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', NORMAL_NO_FLIP);
  };
}

