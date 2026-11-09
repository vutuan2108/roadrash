// Toyota GR86 2022, Pandem V1.5 aero kit ("2022 Pandem GR86 V1.5 Aero Kit" by Ddiaz Design on Sketchfab, CC-BY-NC-SA-4.0).
// Materials by index (car_list.js). Real car: wheelbase 2.575 m, 53 % of the weight on the front axle.
module.exports = {
  name: 'gr86', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/2022_pandem_gr86_v1.5_aero_kit.glb', out: 'F:/hb_tmp/cars/gr86.js',
  header: '// Toyota GR86 Pandem: "2022 Pandem GR86 V1.5 Aero Kit" by Ddiaz Design (https://sketchfab.com/3d-models/2022-pandem-gr86-v15-aero-kit-04fa19ccee604fc3aab2cc4d62d9dd7f),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  wb: 2.575, a: 1.21, err: 0.002, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [0, 7, 13, 14, 15, 16, 30, 31],
    caliper: [1], calDark: [2], disc: [3], rim: [4], rimLip: [5], tyre: [6],
    grille: [8, 9, 10, 11, 12, 20, 21, 22, 23, 32],
    black: [17, 27], carbon: [18], trim: [19],
    lamp: [24, 29], paint: [25], glass: [26], tail: [28],
  },
  byName: p => /WindowInside/.test(p.name) ? 'drop' : null,
  wheel: ['tyre', 'rim', 'rimLip', 'disc', 'caliper', 'calDark'],
  // exhaust tips [x, y, radius, z] (probe of the rear: twin tips in the diffuser)
  head: null, tail: null, exh: [[0.42, 0.24, 0.045, -2.11], [-0.42, 0.24, 0.045, -2.11]],
};
