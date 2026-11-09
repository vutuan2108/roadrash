// Wrap a .glb as base64 in a JS file so a file:// page can load it without fetch.
const fs = require('fs');
const [src, out] = process.argv.slice(2);
fs.writeFileSync(out, 'window.GLB_B64 = "' + fs.readFileSync(src).toString('base64') + '";\n');
console.log('wrote', out);
