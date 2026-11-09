// Mazda RX-7 FD3S with the VeilSide Fortune kit ("1997 VeilSide Fortune Mazda RX-7 FD Tokyo Drift" by Ddiaz Design on
// Sketchfab, CC-BY-NC-SA-4.0). Real car: wheelbase 2.425 m, 50:50.
module.exports = {
  name: 'rx7vs', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/1997_veilside_fortune_mazda_rx-7_fd_tokyo_drift.glb', out: 'F:/hb_tmp/cars/rx7vs.js',
  header: '// Mazda RX-7 VeilSide Fortune: "1997 VeilSide Fortune Mazda RX-7 FD Tokyo Drift" by Ddiaz Design (https://sketchfab.com/3d-models/1997-veilside-fortune-mazda-rx-7-fd-tokyo-drift-7db6bd58bb8f405abeb5ed02bcabc960),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  wb: 2.425, a: 1.2125, err: 0.002, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [1, 10, 12, 17, 19, 21, 23],
    wheel: [0], calDark: [2], glass: [3], black: [4, 14], amberLamp: [5], tail: [6, 8], lamp: [7, 9],   // (8: the smoked tail lamp covers)
    grille: [11, 15, 16, 22], carbon: [13], trim: [18], paint: [20],
  },
  wheel: ['wheel', 'calDark'],
  colors: { rim: '#a07a3a' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[-0.42, 0.33, 0.05, -2.12]],   // one big can, right of the diffuser
};
