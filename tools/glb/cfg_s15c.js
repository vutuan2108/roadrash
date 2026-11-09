// Nissan Silvia S15 custom build ("Nissan Silvia S15 Custom" by Socksthecat on Sketchfab, CC-BY-4.0).
// Materials by index (car_list.js). Real car: wheelbase 2.525 m, about 55 % of the weight on the front axle.
module.exports = {
  name: 's15c', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/nissan_silvia_s15_custom.glb', out: 'F:/hb_tmp/cars/s15c.js',
  header: '// Nissan Silvia S15 Custom: "Nissan Silvia S15 Custom" by Socksthecat (https://sketchfab.com/3d-models/nissan-silvia-s15-custom-2c3481e502c24d818d23a5eb2be8dac9),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, interior left out, parts recoloured.\n',
  wb: 2.525, a: 1.135, err: 0.0015, errLo: 0.006, errW: 0.0025,
  mats: {
    drop: [6, 11, 43, 47, 48, 49, 50, 51, 52, 53, 54, 55, 57, 60],
    glass: [0, 31], black: [1, 3, 9, 14, 15, 18, 22, 25, 29, 30, 59], paint: [2], alu: [4, 5, 10, 16, 26, 33],
    carbon: [7, 13], trim: [8, 23, 28, 32, 44, 56], white: [12], exhaust: [17, 19, 20, 21], grille: [24], under: [27, 45, 46],
    tail: [34, 36, 37], amberLamp: [35, 38], head: [39, 40, 41, 42], strap: [58],
    tyre: [61, 62, 74], lug: [63, 64], disc: [65, 66, 67], caliper: [68, 69], rim: [70, 72, 73], rimLip: [71],
  },
  wheel: ['tyre', 'lug', 'disc', 'caliper', 'rim', 'rimLip'],
  axisCats: ['rim'],   // the wheel's axle from the rim (this model's tyres sit a few degrees off it)
  // exhaust tips [x, y, radius, z]: the twin straight pipes under the rear bumper
  head: null, tail: null, exh: [[0.1, 0.21, 0.04, -2.38], [-0.1, 0.21, 0.04, -2.38]],
};
