// Toyota GT86 "Sugar Skull" drift car ("Toyota GT86 Sugar Skull" by VTDAT23 on Sketchfab, CC-BY-4.0): a wide-body GT86
// with a full wrap painted in the body's texture. The body (material 4) keeps its texture coordinates and the wrap
// rides along as an image: category 'livery'. The car's paint shows in the wrap's bare (smooth grey) patches. The cabin, the
// engine bay and the suspension are left out. Real car: wheelbase 2.570 m.
const DROP = [0, 2, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 20, 23, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 42, 43, 44, 45, 46, 49,
  50, 51, 52, 53, 56, 58, 59, 61,
  63];   // (63: the smoked cover over the tail lamps - the lens under it shows instead)
module.exports = {
  name: 'gt86ss', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/toyota_gt86_sugar_skull.glb', out: 'F:/hb_tmp/cars/gt86ss.js',
  header: '// Toyota GT86 Sugar Skull: "Toyota GT86 Sugar Skull" by VTDAT23 (https://sketchfab.com/3d-models/toyota-gt86-sugar-skull-33cb91ba4074499789394274e4d7eded),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, cabin and engine left out, parts recoloured, the wrap texture re-encoded (its bare patches take the paint).\n',
  wb: 2.57, a: 1.21, err: 0.002, errLo: 0.006, errW: 0.002,
  tex: { livery: 'F:/hb_tmp/cars/gt86ss_tex.txt' },   // (tex_img.js file.glb 4 that.txt 2048 neutral)
  // the glass material also covers the lamps at both ends: dark glass in the game, so those covers are left out
  split: p => p.mat === 1 ? c => c[2] < -1.8 || c[2] > 1.45 ? 'drop' : 'glass' : null,
  byName(p) {
    if (p.id === 9 || p.id === 69 || p.id === 14 || p.id === 127 || p.id === 106) return 'drop';   // HUD glass, cabin bits, inside mirror
    if (p.id === 86) return 'black';                                                               // cowl
    return null;
  },
  mats: {
    drop: DROP,
    livery: [4], glass: [1], black: [3, 11, 40, 64], carbon: [41], accent: [60], under: [25, 65],
    head: [54, 55], tail: [14, 57, 66], tailLens: [24], alu: [26, 47, 62], bezel: [48], exhaust: [35],
    tyre: [70, 71], rimDark: [69], lug: [67], rimAccent: [68], disc: [21], caliper: [22],
  },
  wheel: ['tyre', 'rimDark', 'lug', 'rimAccent', 'disc', 'caliper'],
  colors: { rimDark: '#e4e6ea',   // (white wheels)
     rimAccent: '#0a4d96', caliper: '#1a5aa8', lug: '#8a8e96' },
  // exhaust tips [x, y, radius, z] (the twin tips in the diffuser)
  head: null, tail: null, exh: [[0.5, 0.32, 0.06, -2.2], [-0.5, 0.32, 0.06, -2.2]],
};
