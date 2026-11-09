// CBR: the user's cbr.glb. The generator added three big sheets (one by the nose, two fanned out behind the tail) on
// thin threads; dropping the threads leaves them as separate parts, so only the largest part (the bike) is kept.
const deg = a => a * Math.PI / 180;
module.exports = {
  name: 'cbr', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/cbr.glb', out: 'F:/hb_tmp/cbr/cbr.js', cls: 'F:/hb_tmp/cbr/cls.json',
  header: '// Honda CBR1000RR-R body: mesh from the user\'s cbr.glb (stray sheets and wheels removed), painted HRC livery\n',
  largest: true,
  // what is left of the tail sheets: a flat wing either side of the tail end (the tail is +-0.13 wide there; the
  // silencers end lower, below y 0.9)
  cut: p => p[2] < -0.72 && p[1] > 0.9 && Math.abs(p[0]) > 0.15,
  rm: 0.012,
  wheels: [
    // front: the tyre (0.345 m round the sides, flattened at the bottom) with the mudguard fused onto it (cut up to
    // y 0.69, the nose starts at 0.70), the discs/calipers (hub cut); fork legs (x ~ +-0.08, ~24 deg rake) kept outside |x| 0.055
    { z: 0.614, y: 0.301, r: 0.345, x0: -0.1, x1: 0.1, fork: [-Math.sin(deg(24)), Math.cos(deg(24))], forkIn: [-0.055, 0.055], forkR: 0.04, guard: [0.07, 0.69] },
    { z: 0.614, y: 0.301, r: 0.19, x0: -0.165, x1: 0.165, fork: [-Math.sin(deg(24)), Math.cos(deg(24))], forkIn: [-0.055, 0.055], forkR: 0.04 },
    { z: -0.607, y: 0.33, r: 0.355, x0: -0.12, x1: 0.12 },   // the sidewalls bulge to +-0.107 (swingarm from 0.14)
    { z: -0.607, y: 0.33, r: 0.13, x0: -0.125, x1: 0.125 },
  ],
};
