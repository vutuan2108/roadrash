// Toyota Supra A80 ("Toyota Supra" by Mateusz Wolinski on Sketchfab, CC-BY-NC-4.0): the 3D look of the Supra A80.
// Real car: wheelbase 2.55 m.
module.exports = {
  name: 'supra', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/toyota_supra.glb', out: 'F:/hb_tmp/cars/supra.js',
  header: '// Toyota Supra A80: "Toyota Supra" by Mateusz Wolinski (https://sketchfab.com/3d-models/toyota-supra-16ab211659114ad1bf45095a67c0d325),\n' +
    '// licensed CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// Non-commercial use only.\n',
  wb: 2.55, a: 1.2, err: 0.002, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [0, 2, 4, 5, 6, 9, 17, 19],
    under: [1], wheel: [3], alu: [7, 18, 20], paint: [8], black: [10, 12, 23, 24], exhaust: [11], disc: [13], caliper: [14],
    glass: [15], head: [16], carbon: [21], tail: [22],
  },
  wheel: ['wheel', 'disc', 'caliper'],
  colors: { rim: '#c8ccd2', caliper: '#c01818' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.35, 0.31, 0.05, -2.21], [-0.35, 0.31, 0.05, -2.21]],
};
