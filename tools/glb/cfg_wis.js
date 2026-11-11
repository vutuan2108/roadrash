// Nissan 180SX, Team Wisteria D1GP 2018 car #66 ("D1GP 2018 Osaka 66 Nissan WISTERIA 180SX" by Nieve5677 on Sketchfab,
// CC-BY-4.0). Low-poly game-style model: one textured body, the livery is left out (plain paint). Two template wheels
// sit at the origin (parts 0, 1) and are left out. Real car: wheelbase 2.475 m.
// Part 27 is the cabin and, at the back, the red tail lamp clusters painted in its texture (tex.html ?dump=26,27 ->
// wis_tri.json): the red faces are kept as the lens ('tailLens'), the round lamps (part 26, an additive layer) sit on it.
const LAMPS = [[0.01194, 0.0175], [0.01737, 0.01738]], onLamp = c => LAMPS.some(l => Math.hypot(Math.abs(c[0]) - l[0], c[1] - l[1]) < 0.0017);
module.exports = {
  name: 'wis', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/d1gp_2018_osaka_66_nissan_wisteria_180sx.glb', out: 'F:/hb_tmp/cars/wis.js',
  header: '// Nissan 180SX Wisteria D1GP: "D1GP 2018 Osaka 66 Nissan WISTERIA 180SX" by Nieve5677 (https://sketchfab.com/3d-models/d1gp-2018-osaka-66-nissan-wisteria-180sx-995bd0bc499a47869e146001f20f89fb),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, livery and driver left out, parts recoloured.\n',
  triColors: 'F:/hb_tmp/cars/wis_tri.json',
  wb: 2.475, a: 1.114, err: 0.0015, errLo: 0.005, errW: 0.002, rimK: 0.66,
  split: p => p.id === 27 ? (c, rgb) => c[2] > -0.045 || !rgb || onLamp(c) ? 'drop' : rgb[0] > 70 && rgb[2] < rgb[0] * 0.6 ? 'tailLens' : 'black'
    : p.id === 26 ? (c, rgb) => rgb && rgb[0] < 40 ? 'drop' : 'tail' : null,   // (black in the additive layer = nothing)
  byName(p) {
    if (p.id === 0 || p.id === 1) return 'drop';                   // template wheels at the origin
    if (p.id === 23) return 'drop';                                // driver
    if (p.id === 8) return 'under';
    if (p.id === 11 || p.id === 15) return 'paint';                // wing, bonnet
    if (p.id === 25) return 'black';                               // bonnet vents
    if (p.id === 10) return 'head';
    return null;
  },
  mats: { wheel: [0, 1], grille: [2], paint: [3], black: [5], drop: [7], glass: [8] },
  wheel: ['wheel'],
  colors: { rim: '#1a1b1e' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.45, 0.3, 0.05, -2.42]],
};
