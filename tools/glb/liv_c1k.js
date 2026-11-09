// CBR1000RR Fireblade livery: HRC tricolor in the Winner X's style. Red nose, tank and tail; a blue band edged white
// along the side panel; blue belly with a white HONDA and white blocks; white/blue tail stripe with CBR1000RR.
// Side view in metres (z forward, y up); only the painted parts use it.
window.LIVERY = (g, K) => {
  const { PX, PY, PAL } = K;
  const poly = (k, pts) => { g.fillStyle = PAL[k]; g.beginPath(); pts.forEach(([z, y], i) => i ? g.lineTo(PX(z), PY(y)) : g.moveTo(PX(z), PY(y))); g.closePath(); g.fill(); };
  const bar = (k, a, b, hw) => { const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy), nz = -dy / l * hw, ny = dz / l * hw;
    poly(k, [[a[0] + nz, a[1] + ny], [b[0] + nz, b[1] + ny], [b[0] - nz, b[1] - ny], [a[0] - nz, a[1] - ny]]); };
  g.fillStyle = PAL[1]; g.fillRect(0, 0, K.TW, K.TH);
  // side panel: white top edge, blue band, light-blue line, red pinstripe
  poly(4, [[0.80, 0.765], [0.40, 0.775], [0.05, 0.785], [-0.10, 0.75], [-0.10, 0.715], [0.05, 0.745], [0.40, 0.735], [0.78, 0.725]]);
  poly(2, [[0.78, 0.725], [0.40, 0.735], [0.05, 0.745], [-0.10, 0.715], [-0.06, 0.63], [0.10, 0.655], [0.40, 0.66], [0.62, 0.67]]);
  bar(3, [0.66, 0.705], [-0.05, 0.705], 0.006);
  bar(4, [0.60, 0.655], [0.0, 0.64], 0.006);
  // belly: blue lower half, white blocks above it, white edge on the front part
  poly(2, [[-0.55, 0.0], [0.55, 0.0], [0.55, 0.31], [0.32, 0.315], [-0.10, 0.31], [-0.55, 0.27]]);
  poly(4, [[-0.55, 0.27], [-0.10, 0.31], [0.32, 0.315], [0.55, 0.31], [0.55, 0.33], [0.32, 0.335], [-0.10, 0.33], [-0.55, 0.29]]);
  for (const [z0, w] of [[0.10, 0.08], [-0.05, 0.075], [-0.19, 0.07]]) poly(4, [[z0, 0.385], [z0 + w, 0.385], [z0 + w - 0.03, 0.345], [z0 - 0.03, 0.345]]);
  // nose: white sweep under the screen edge
  bar(4, [0.47, 0.985], [0.78, 0.80], 0.012);
  // tank: white and blue line along its lower edge
  bar(4, [0.30, 0.86], [-0.16, 0.81], 0.008);
  bar(2, [0.30, 0.845], [-0.16, 0.795], 0.006);
  // tail: white stripe with a blue one above it
  bar(4, [-0.46, 0.80], [-1.0, 0.925], 0.012);
  bar(2, [-0.46, 0.822], [-1.0, 0.947], 0.007);
  // lettering, each with a mirrored copy for the left side (spare strip under the bike)
  const text = (s, z, y, h, cls, dst, font = 'bold') => {
    g.font = `${font} ${h}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = PAL[cls]; g.fillText(s, PX(z), PY(y));
    const w = Math.ceil(g.measureText(s).width) + 12, hh = Math.ceil(h * 1.1) + 8;
    K.boxes.push([Math.round(PX(z) - w / 2), Math.round(PY(y) - hh / 2), w, hh, dst[0], dst[1]]);
  };
  text('HONDA', 0.02, 0.215, 56, 4, [20, 1190]);
  text('CBR1000RR', -0.74, 0.935, 22, 4, [300, 1190]);
  text('Fireblade', 0.52, 0.595, 30, 4, [600, 1190], 'bold italic');
  for (const [sx, sy, w, h, dx, dy] of K.boxes) {
    const im = g.getImageData(sx, sy, w, h), t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(im, 0, 0);
    g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(t, 0, 0); g.restore();
  }
};
