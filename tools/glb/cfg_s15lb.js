// Nissan Silvia S15, Liberty Walk LB-Super Silhouette kit ("2023 LBSuper Silhouette S15 Silvia" by Ddiaz Design on
// Sketchfab, CC-BY-NC-SA-4.0). The body skin (part 37) wears the sponsors' decals in a texture whose alpha is clear
// where the paint shows (tex_img.js file.glb 27 F:/hb_tmp/cars/s15lb_tex.txt 1024 overlay): category 'livery'. Part 27
// is the same skin with another map. Real car: wheelbase 2.525 m.
module.exports = {
  name: 's15lb', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/car1211/2023_lbsuper_silhouette_s15_silvia.glb', out: 'F:/hb_tmp/cars/s15lb.js',
  header: '// Nissan Silvia S15 LB-Super Silhouette: "2023 LB★SUPER SILHOUETTE S15 Silvia" by Ddiaz Design (https://sketchfab.com/3d-models/2023-lbsuper-silhouette-s15-silvia-702d9937d68b4542929dfef59d1079cd),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured, decal texture re-encoded.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  wb: 2.525, a: 1.135, err: 0.002, errLo: 0.006, errW: 0.002,
  tex: { livery: 'F:/hb_tmp/cars/s15lb_tex.txt' },
  byName: p => /WindowInside|SeatBelt/.test(p.name) ? 'drop' : p.id === 37 ? 'livery' : null,
  mats: {
    drop: [0, 6, 10, 11, 13, 15, 16, 19, 21, 22, 23],
    wheel: [3], caliper: [2], calDark: [1], glass: [4], white: [5], black: [7], paint: [8], alu: [9],
    grille: [12, 17, 18], carbon: [14], lamp: [20],
  },
  wheel: ['wheel', 'caliper', 'calDark'],
  colors: { rim: '#3c3e44', caliper: '#c01818' },
  head: null, tail: null, exh: [[-0.3, 0.3, 0.05, -2.28]],
};
