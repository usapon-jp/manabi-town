// キャラクターの設定。新しいキャラは GLB を assets/models/ に置き、ここに1つ足すだけ。
// bones は骨の名前（GLB 内の名前。記号は無視して比べる）。足りない骨は動かさない。
export const CHARACTERS = {
  piyo: {
    name: 'ピヨちゃん',
    model: 'assets/models/piyo_base_rig.glb',
    height: 1.0,          // 箱庭の中での背の高さ
    speed: 1.6,           // 歩く速さ
    bones: {
      hips: 'mixamorig:Hips',
      spine: 'mixamorig:Spine',
      head: 'mixamorig:Head',
      leftArm: 'mixamorig:LeftArm',
      rightArm: 'mixamorig:RightArm',
      leftLeg: 'mixamorig:LeftUpLeg',
      rightLeg: 'mixamorig:RightUpLeg',
    },
    walk: { legSwing: 0.6, armFlap: 0.45, bob: 0.06 },
    fallbackColor: 0xffd84d,
  },
};
