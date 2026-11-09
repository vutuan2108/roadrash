// save the class map RLE + preview from photo.html
const fs = require('fs');
module.exports = async page => {
  const { rle, prev, res } = await page.evaluate(() => ({ rle: window.RLE, prev: window.TEXPREV, res: window.RESULT }));
  fs.writeFileSync('F:/hb_tmp/wx/cls.json', JSON.stringify({ ...res, rle }));
  fs.writeFileSync('F:/hb_tmp/wx/tex_prev.png', Buffer.from(prev.split(',')[1], 'base64'));
  console.log('rle base64 chars', rle.length);
};
