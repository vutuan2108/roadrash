// Ford Mustang 1965 hardtop ("Ford Mustang 1965" by Pooya_dh on Sketchfab, CC-BY-NC-4.0): navy with white stripes.
// Real car: wheelbase 108 in (2.743 m), V8, about 56 % of the weight on the front axle.
const INSIDE = [53, 55, 86, 90, 96, 109, 111, 112, 113, 114, 130, 132, 133, 134, 135];   // dashboard, seats, mirror, column
module.exports = {
  name: 'm65', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/ford_mustang_1965.glb', out: 'F:/hb_tmp/cars/m65.js',
  header: '// Ford Mustang 1965: "Ford Mustang 1965" by Pooya_dh (https://sketchfab.com/3d-models/ford-mustang-1965-5f4e3965f79540a9888b5d05acea5943),\n' +
    '// licensed CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// Non-commercial use only.\n',
  wb: 2.743, a: 1.207, err: 0.0015, errLo: 0.006, errW: 0.0025,
  byName: p => INSIDE.includes(p.id) ? 'drop' : p.id === 11 ? 'black' : null,
  mats: {
    drop: [6, 7, 14, 20, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 43, 46],
    white: [0, 4], grille: [1, 15, 17, 47], under: [2, 11, 16, 19], paint: [3], alu: [5, 10, 28], glass: [8], black: [9],
    tail: [12, 13], head: [18, 29, 30, 31], amber: [21, 27], lamp: [22, 26],
    disc: [41], rim: [42], tyre: [44, 45],
  },
  wheel: ['disc', 'rim', 'tyre'],
  colors: { rim: '#c4c8ce' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.52, 0.36, 0.035, -2.5], [-0.52, 0.36, 0.035, -2.5]],
};
