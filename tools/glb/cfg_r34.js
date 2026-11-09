// Nissan Skyline GT-R R34 ("Eddie's Nissan Skyline R34 NFS Underground" by Ddiaz Design on Sketchfab, CC-BY-NC-SA-4.0).
// The livery decals are left out (plain paint). Real car: wheelbase 2.665 m, about 55 % of the weight on the front axle.
module.exports = {
  name: 'r34', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/eddies_nissan_skyline_r34_nfs_underground.glb', out: 'F:/hb_tmp/cars/r34.js',
  header: '// Nissan Skyline GT-R R34: "Eddie\'s Nissan Skyline R34 NFS Underground" by Ddiaz Design (https://sketchfab.com/3d-models/eddies-nissan-skyline-r34-nfs-underground-9a6bc4ed690546a1bf02832764f1c888),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n' +
    '// The livery decals are not used.\n',
  wb: 2.665, a: 1.2, err: 0.002, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [2, 8, 20, 21, 25, 26],
    caliper: [0], calDark: [1], tyre: [3], disc: [4], rimDark: [5], rim: [6], rimLip: [7],
    amberLamp: [9], tail: [10], lamp: [11, 22], glass: [12], black: [13, 16, 23, 28], trim: [14, 18], grille: [15], paint: [17, 27],
    carbon: [19], exhaust: [24],
  },
  wheel: ['caliper', 'calDark', 'tyre', 'disc', 'rimDark', 'rim', 'rimLip'],
  colors: { caliper: '#c86a10', rim: '#9a9ea6' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.4, 0.3, 0.05, -2.32]],
};
