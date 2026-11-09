// Honda CBR1000RR (Sketchfab, Nieve5677, CC-BY-4.0): 113 parts, materials without colours -> each part gets a
// category (game material + colour). Part ids from c1k_list.js (game frame, scale 0.58: wheelbase 1.41 m).
module.exports = {
  name: 'c1k', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/honda_cbr1000rr.glb', out: 'F:/hb_tmp/c1k/c1k.js', cls: 'F:/hb_tmp/c1k/cls.json',
  header: '// Honda CBR1000RR Fireblade: "Honda CBR1000RR" by Nieve5677 (https://sketchfab.com/3d-models/honda-cbr1000rr-3cb6e14f27a94bf080bed9d98db21c70),\n' +
    '// licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: simplified, parts recoloured, HRC livery painted.\n',
  s: 0.58, frame: (x, y, z) => [z, y, -x], err: 0.002, errLo: 0.006,
  cats: {
    paint: [7, 26, 28, 40, 49, 54, 55],
    seat: [15, 53],
    rubber: [29, 112],
    rim: [63, 84, 64, 88, 89, 111],
    alu: [10, 24, 30, 2, 3, 12, 23, 25, 31, 32, 33, 79, 5, 22, 92, 85, 67, 74, 77, 78, 41, 72, 75, 1],
    engine: [18, 19, 0, 11, 13, 16, 94, 9, 14, 82, 20, 58, 37, 38, 4, 101, 102, 103, 21, 34, 17],
    black: [6, 56, 57, 59, 95, 96, 97, 98, 99, 100, 110, 68, 69, 70, 71, 73, 76, 80, 81, 104, 105, 108, 109, 46, 47, 48, 51, 39, 90, 91, 83, 60, 62],
    drop: [27],   // a decal layer floating on the tank top
    exhaust: [8],
    disc: [93, 35, 65, 87],
    sprocket: [66],
    caliper: [36, 86],
    fork: [50],
    screen: [45],
    lens: [107],
    mirrorGlass: [44],
    mirror: [43, 42],
    reflector: [106],
    headLed: [52],
    tailLed: [61],
  },
};
