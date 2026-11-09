// CBR250RR livery, HRC tricolor in the Winner X's style: red base, a blue sweep with white edges and white blocks
// along the fairing, white/blue tail stripe, black mechanicals, belly, screen and seat. Coordinates: side view in
// metres (z forward, y up) of the packed mesh.
window.LIVERY = (g, K) => {
  const { PX, PY, PAL } = K;
  const poly = (k, pts) => { g.fillStyle = PAL[k]; g.beginPath(); pts.forEach(([z, y], i) => i ? g.lineTo(PX(z), PY(y)) : g.moveTo(PX(z), PY(y))); g.closePath(); g.fill(); };
  const ell = (k, z, y, rz, ry) => { g.fillStyle = PAL[k]; g.beginPath(); g.ellipse(PX(z), PY(y), rz * 1000, ry * 1000, 0, 0, Math.PI * 2); g.fill(); };
  const bar = (k, a, b, hw) => {   // rotated rectangle along a -> b, half-width hw
    const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy), nz = -dy / l * hw, ny = dz / l * hw;
    poly(k, [[a[0] + nz, a[1] + ny], [b[0] + nz, b[1] + ny], [b[0] - nz, b[1] - ny], [a[0] - nz, a[1] - ny]]);
  };
  g.fillStyle = PAL[1]; g.fillRect(0, 0, K.TW, K.TH);
  // --- graphics on the fairing (drawn first; the black zones below trim them) ---
  poly(4, [[0.74, 0.745], [0.40, 0.735], [0.10, 0.745], [-0.26, 0.815], [-0.26, 0.765], [0.10, 0.70], [0.40, 0.69], [0.70, 0.70]]);   // white top edge
  poly(2, [[0.70, 0.70], [0.40, 0.69], [0.10, 0.70], [-0.26, 0.765], [-0.27, 0.64], [0.00, 0.595], [0.30, 0.575], [0.52, 0.60]]);     // blue sweep
  bar(3, [0.56, 0.665], [-0.24, 0.715], 0.007);                                                                                        // light-blue line
  bar(1, [0.46, 0.625], [-0.05, 0.645], 0.005);                                                                                        // red pinstripe
  for (const [z0, w] of [[0.36, 0.1], [0.20, 0.09], [0.05, 0.08]]) poly(4, [[z0, 0.585], [z0 + w, 0.58], [z0 + w - 0.04, 0.515], [z0 - 0.04, 0.52]]);   // white blocks
  poly(4, [[-0.08, 0.60], [-0.02, 0.595], [-0.07, 0.535], [-0.13, 0.54]]);
  // tail: white stripe with a blue one above it
  bar(4, [-0.27, 0.815], [-0.95, 0.955], 0.014);
  bar(2, [-0.30, 0.843], [-0.95, 0.983], 0.008);
  // --- black / dark parts ---
  // under the tail and behind the fairing: subframe, swingarm, rear hub, pegs
  poly(5, [[-1.05, -0.05], [-1.05, 0.88], [-0.88, 0.905], [-0.6, 0.84], [-0.4, 0.79], [-0.27, 0.75], [-0.26, 0.62], [-0.30, 0.40], [-0.36, 0.20], [-0.40, -0.05]]);
  // engine seen through the fairing cut-out
  ell(5, -0.05, 0.495, 0.125, 0.115); ell(6, -0.05, 0.495, 0.075, 0.07);
  // fork and everything under the nose; belly pan bottom
  poly(5, [[0.43, -0.05], [0.43, 0.40], [0.47, 0.55], [0.53, 0.635], [0.82, 0.635], [0.82, -0.05]]);
  poly(5, [[-0.42, -0.05], [0.46, -0.05], [0.46, 0.19], [-0.42, 0.19]]);
  // screen (smoked) and mirrors above the fairing's top edge
  poly(5, [[0.20, 1.26], [0.44, 1.26], [0.78, 0.875], [0.72, 0.855], [0.30, 0.955], [0.20, 0.995]]);
  // rider seat and pillion pad edges
  poly(5, [[-0.52, 0.99], [-0.20, 0.99], [-0.20, 0.865], [-0.52, 0.885]]);
  poly(5, [[-0.88, 1.12], [-0.48, 1.10], [-0.48, 1.035], [-0.88, 1.055]]);
  // upswept silencer: dark can, silver end cap
  bar(6, [-0.905, 0.835], [-0.45, 0.465], 0.068);
  bar(7, [-0.925, 0.852], [-0.86, 0.798], 0.07);
  // --- lettering (white on red), each with a mirrored copy for the left side ---
  const text = (s, z, y, h, cls, dst) => {
    g.font = `bold ${h}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = PAL[cls]; g.fillText(s, PX(z), PY(y));
    const w = Math.ceil(g.measureText(s).width) + 12, hh = Math.ceil(h * 1.1) + 8;
    K.boxes.push([Math.round(PX(z) - w / 2), Math.round(PY(y) - hh / 2), w, hh, dst[0], dst[1]]);
  };
  text('HONDA', 0.06, 0.275, 54, 4, [20, 1190]);
  text('CBR', -0.66, 0.985, 46, 4, [300, 1190]);
  for (const [sx, sy, w, h, dx, dy] of K.boxes) {   // copy each box flipped left-right into the spare strip at the bottom
    const im = g.getImageData(sx, sy, w, h), t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(im, 0, 0);
    g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(t, 0, 0); g.restore();
  }
};
