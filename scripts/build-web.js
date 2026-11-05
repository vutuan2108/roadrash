'use strict';
// Build for static hosting (Vercel): copy the browser game into public/ and point it at the online game server
// given in the HB_SERVER environment variable (e.g. https://highway-brawl.onrender.com).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'public');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));
fs.cpSync(path.join(ROOT, 'js'), path.join(OUT, 'js'), { recursive: true });
const server = (process.env.HB_SERVER || '').trim();
fs.writeFileSync(path.join(OUT, 'js', 'config.js'),
  "'use strict';\n// written by scripts/build-web.js from the HB_SERVER environment variable\nconst HB_SERVER = " + JSON.stringify(server) + ';\n');
console.log('public/ is ready. Online game server: ' + (server || '(none set)'));
if (!server) console.warn('WARNING: HB_SERVER is not set - single player works, but online play needs the address of the game server.');
