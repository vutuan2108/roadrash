// Ford Mustang GT (S550, 2018) drift build: wide arches left in black primer, big wing ("Ford Mustang GT Drift Spec" by
// blakebella on Sketchfab, CC-BY-4.0). The model faces -z. No livery in its textures: plain paint and black panels.
// Real car: wheelbase 2.72 m, about 53 % of the weight on the front axle.
module.exports = {
  name: 'gtd', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/car1211/ford_mustang_gt_drift_spec.glb', out: 'F:/hb_tmp/cars/gtd.js',
  header: '// Ford Mustang GT Drift Spec: "Ford Mustang GT Drift Spec" by blakebella (https://sketchfab.com/3d-models/ford-mustang-gt-drift-spec-0312ea7877eb444e9849f523e700d1cc),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, interior left out, parts recoloured.\n',
  frame: (x, y, z) => [-x, y, -z],
  wb: 2.72, a: 1.278, err: 0.002, errLo: 0.006, errW: 0.0025,
  // LightA: the lamps at both ends (cabin lights between them); the window material also covers the lamps
  split: p => p.mat === 13 ? c => c[2] > 1.7 ? 'head' : c[2] < -1.95 ? 'tail' : 'drop'
    : p.mat === 16 ? c => c[2] > 1.7 || c[2] < -1.95 ? 'drop' : 'glass' : null,
  byName: p => p.id === 1 ? 'drop' : null,   // (not a triangle mesh)
  mats: {
    drop: [0, 3, 10, 11, 14, 18],
    black: [1, 2, 15, 27], grille: [4, 5, 6, 7, 8, 9, 22], white: [12], under: [17], paint: [19], carbon: [20],
    rimAccent: [21], rim: [23, 25], disc: [24], tyre: [26],
  },
  wheel: ['tyre', 'rim', 'rimAccent', 'disc'],
  colors: { rim: '#2a2c30', rimAccent: '#c01818' },
  head: null, tail: null, exh: [[0.5, 0.22, 0.04, -2.32], [0.62, 0.22, 0.04, -2.32], [-0.5, 0.22, 0.04, -2.32], [-0.62, 0.22, 0.04, -2.32]],
};
