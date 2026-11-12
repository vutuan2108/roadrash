// Nissan GT-R R35 with the Liberty Walk LB-Silhouette WORKS GT 35GT-RR kit ("2022 LB-Silhouette WORKS GT NISSAN 35GT-RR
// (R35)" by SIU Car Garage on Sketchfab, CC-BY-NC-4.0). Low-poly textured model: the body keeps its livery texture.
// Real car: wheelbase 2.78 m, about 54 % of the weight on the front axle.
module.exports = {
  name: 'r35', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/2022_lb-silhouette_works_gt_nissan_35gt-rr_r35.glb', out: 'F:/hb_tmp/cars/r35.js',
  header: '// Nissan GT-R R35 LB-Silhouette: "2022 LB-Silhouette WORKS GT NISSAN 35GT-RR (R35)" by SIU Car Garage (https://sketchfab.com/3d-models/2022-lb-silhouette-works-gt-nissan-35gt-rr-r35-19287829a2564641b586b6e4d0e0d7e9),\n' +
    '// licensed CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). Changed: simplified, parts recoloured, textures re-encoded (white areas take the paint).\n' +
    '// Non-commercial use only.\n',
  wb: 2.78, a: 1.279, err: 0.0015, errLo: 0.005, errW: 0.002,
  // part 8: the roof (black) with the round tail lamps and the headlamp inners in one mesh. The headlamps are dark
  // housings with a few bright reflectors, painted in the texture (tex.html ?dump=8 -> r35_tri.json); their dark
  // cover glass (material 10) is left out so they show
  triColors: 'F:/hb_tmp/cars/r35_tri.json',
  split: p => p.id === 8 ? (c, rgb) => { const s = rgb ? rgb[0] + rgb[1] + rgb[2] : 0;
    return c[2] < -1.9 ? (rgb && rgb[0] > rgb[1] * 1.5 ? 'tail' : 'black') : c[2] > 1.4 ? (s > 390 ? 'head' : s > 130 ? 'bezel' : 'black') : 'carbon'; } : null,
  // the body (material 2) and the bonnet (4) keep their textures: the white is the car's paint, the yellow and the
  // sponsors stay (tex_img.js file.glb 1 r35_tex1.txt 1024 paint:#ffffff:60, image 3 -> r35_tex3.txt 512)
  tex: { livery: 'F:/hb_tmp/cars/r35_tex1.txt', livery2: 'F:/hb_tmp/cars/r35_tex3.txt' },
  mats: { tyre: [0], rim: [1], livery: [2], livery2: [4], grille: [3], black: [5], under: [7], head: [8], glass: [9], drop: [10, 11] },
  wheel: ['tyre', 'rim'],
  colors: { rim: '#1a1b1e' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.2, 0.26, 0.045, -2.55], [-0.2, 0.26, 0.045, -2.55]],
};
