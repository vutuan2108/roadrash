// Nissan 180SX ("Nissan 180sx [FREE]" by autoNgraphic on Sketchfab, CC-BY-4.0): aero kit, wing, SSR / Work wheels.
// The model faces -z. Real car (RPS13): wheelbase 2.475 m, about 55 % of the weight on the front axle.
const part = n => p => (p.name || '').startsWith(n);
module.exports = {
  name: 'n180', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/nissan_180sx_free.glb', out: 'F:/hb_tmp/cars/n180.js',
  header: '// Nissan 180SX: "Nissan 180sx [FREE]" by autoNgraphic (https://sketchfab.com/3d-models/nissan-180sx-free-b37cea6e8a864a2aa602934ddb0e6ff0),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, interior left out, parts recoloured.\n',
  frame: (x, y, z) => [-x, y, -z],
  wb: 2.475, a: 1.114, err: 0.0015, errLo: 0.006, errW: 0.0025,
  byName(p) {
    const n = p.name || '';
    if (/^(interior|Bride_seats)/.test(n)) return 'drop';
    if (p.mat === 0) return /^door_/.test(n) ? 'drop' : /^chassis/.test(n) ? 'under' : /^boot_spoiler/.test(n) ? 'carbon' : 'black';
    if (p.mat === 5) return /^(misc_a|boot_spoiler)/.test(n) ? 'alu' : 'drop';
    if (p.mat === 13) return /^misc_a/.test(n) ? 'grille' : 'drop';
    if (p.mat === 17) return /^boot/.test(n) ? 'black' : 'drop';
    if (p.mat === 32) return /^taillights/.test(n) ? 'tail' : 'drop';
    if (p.mat === 2 && /^door_/.test(n)) return 'drop';
    return null;
  },
  mats: {
    drop: [7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 33, 34, 35, 37, 41],
    paint: [1], black: [2, 4], under: [3], alu: [6, 36, 38], glass: [21], tail: [30, 31], lamp: [39, 40], exhaust: [42],
    tyre: [43], disc: [44], rim: [45, 46, 47],
  },
  wheel: ['tyre', 'disc', 'rim'],
  colors: { rim: '#c8ccd2' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.47, 0.2, 0.055, -2.38]],
};
