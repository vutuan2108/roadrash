// save the painted livery (window.CLSOUT) from livery.html as cls.json for build_glb.js
const fs = require('fs');
module.exports = async page => {
  const c = await page.evaluate(() => window.CLSOUT);
  fs.writeFileSync(process.env.CLS_OUT || 'F:/hb_tmp/cbr/cls.json', JSON.stringify(c));
  console.log('saved livery, rle chars', c.rle.length, 'boxes', c.boxes.length);
};
