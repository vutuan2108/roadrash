// Mazda RX-7 FD3S with the BN Sports BLS kit ("2018 BN Sports BLS FD RX7" by Ddiaz Design on Sketchfab, CC-BY-NC-SA-4.0).
// Real car: wheelbase 2.425 m, 50:50.
module.exports = {
  name: 'rx7bn', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/2018_bn_sports_bls_fd_rx7.glb', out: 'F:/hb_tmp/cars/rx7bn.js',
  header: '// Mazda RX-7 BN Sports: "2018 BN Sports BLS FD RX7" by Ddiaz Design (https://sketchfab.com/3d-models/2018-bn-sports-bls-fd-rx7-5bc518f3c2664ae2ad7b0a0783759b09),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  wb: 2.425, a: 1.2125, err: 0.002, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [2, 9, 12, 14, 19],
    calDark: [0], caliper: [1], tyre: [3], disc: [4], rim: [5], rimLip: [6], rimAccent: [7], rimDark: [8],
    grille: [10, 11, 16, 17], black: [13, 25], trim: [15], lamp: [18, 24], paint: [20], tail: [21], amberLamp: [22], glass: [23],
  },
  wheel: ['calDark', 'caliper', 'tyre', 'disc', 'rim', 'rimLip', 'rimAccent', 'rimDark'],
  colors: { caliper: '#f08a10', rim: '#b8bcc4' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.07, 0.27, 0.045, -2.17], [-0.07, 0.27, 0.045, -2.17]],
};
