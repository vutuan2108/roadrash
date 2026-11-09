// Ferrari F40 with the Liberty Walk kit ("LB-Works Ferrari F40 | www.vecarz.com" by vecarz on Sketchfab, CC-BY-NC-SA-4.0).
// Real car: wheelbase 2.45 m, mid engine - about 42 % of the weight on the front axle.
module.exports = {
  name: 'f40', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/lb-works_ferrari_f40__www.vecarz.com.glb', out: 'F:/hb_tmp/cars/f40.js',
  header: '// Ferrari F40 LB-Works: "LB-Works Ferrari F40 | www.vecarz.com" by vecarz (https://sketchfab.com/3d-models/lb-works-ferrari-f40-wwwvecarzcom-011cad3526e945799d6e98dde6390182),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  wb: 2.45, a: 1.421, err: 0.002, errLo: 0.006, errW: 0.0025,
  mats: {
    drop: [0, 4, 5, 6, 10, 15, 16, 17, 22],   // (10: the clear headlamp covers - one of them hid its lamps)
    black: [1], carbon: [2], paint: [3], glass: [7, 8, 9], lamp: [13, 14], grille: [11], head: [12], under: [18], alu: [19], tail: [20, 21],
    calDark: [23], caliper: [24], disc: [25, 26], rim: [27], tyre: [28],
  },
  wheel: ['calDark', 'caliper', 'disc', 'rim', 'tyre'],
  colors: { rim: '#2a2c30', caliper: '#b81414' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0, 0.26, 0.04, -1.86], [0.1, 0.25, 0.04, -1.86], [-0.1, 0.25, 0.04, -1.86]],
};
