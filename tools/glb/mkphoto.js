// Wrap the photo as a data URL in a JS file (a data: image never taints the canvas)
const fs = require('fs');
const [src, out] = process.argv.slice(2);
fs.writeFileSync(out, 'window.PHOTO = "data:image/jpeg;base64,' + fs.readFileSync(src).toString('base64') + '";\n');
console.log('wrote', out);
