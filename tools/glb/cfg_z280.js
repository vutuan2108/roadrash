// Datsun 280Z ("[FREE] Datsun 280Z" by Martin Trafas on Sketchfab, CC-BY-4.0). Real car: wheelbase 2.305 m, about 53 %
// of the weight on the front axle. All four tyres (and the brakes) are one mesh each: the build cuts them per wheel.
module.exports = {
  name: 'z280', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/free_datsun_280z.glb', out: 'F:/hb_tmp/cars/z280.js',
  header: '// Datsun 280Z: "[FREE] Datsun 280Z" by Martin Trafas (https://sketchfab.com/3d-models/free-datsun-280z-0789ab2ece9442de94b3c41595e0ecbd),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, interior left out, parts recoloured.\n',
  wb: 2.305, a: 1.083, err: 0.0015, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [10],
    black: [0, 8], tail: [1], disc: [2], paint: [3], carbon: [4], alu: [5], head: [6], lamp: [7], white: [9], amberLamp: [11],
    glass: [12], rim: [13], tyre: [14],
  },
  wheel: ['disc', 'rim', 'tyre'],
  colors: { rim: '#b08c40' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.45, 0.3, 0.035, -1.9]],
};
