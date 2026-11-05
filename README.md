# Highway Brawl 3D

Game đua mô tô đấm nhau trên đường Việt Nam, đồ họa 3D (three.js), chơi đơn hoặc **chơi online nhiều người** với phòng chờ.

## Chơi đơn

Mở thẳng file `index.html` bằng Chrome / Edge / Firefox. Không cần cài gì.

## Chơi online trên máy của bạn

Cần cài [Node.js](https://nodejs.org) bản 18 trở lên.

```
npm install
npm start
```

Mở http://localhost:3000, vào **CHƠI ONLINE**, sau đó:

1. Bấm **TẠO PHÒNG MỚI**. Bạn là chủ phòng.
2. Bấm **SAO CHÉP LINK MỜI** và gửi link cho bạn bè. Bạn bè cũng có thể tự nhập mã phòng gồm 4 chữ cái.
3. Bạn bè vào phòng và bấm **SẴN SÀNG**. Chủ phòng chọn chặng rồi bấm **BẮT ĐẦU ĐUA**.

Mỗi phòng có tối đa 8 người. Tay đua máy lấp chỗ trống cho đủ 12 xe. Mỗi người đua bằng chiếc xe đang chọn trong cửa hàng. Tiền thưởng, tiền phạt và hư hỏng xe được tính vào garage của từng người.

**Chơi cùng bạn bè chung mạng Wi-Fi / LAN:**

1. Chạy `npm start` trên một máy.
2. Gõ `ipconfig` trong terminal để xem địa chỉ IPv4 của máy đó, ví dụ `192.168.1.10`.
3. Bạn bè mở `http://192.168.1.10:3000`.

Nếu Windows hỏi về tường lửa (firewall) cho Node.js, chọn **Allow**.

## Đưa lên web (miễn phí với Render)

Máy chủ là một ứng dụng Node.js duy nhất. Nó vừa phát trang game, vừa chạy phòng chờ và cuộc đua qua WebSocket. Vì vậy cần một dịch vụ chạy được Node.js. Các trang chỉ phát file tĩnh như GitHub Pages hay Netlify không chạy được phần online.

1. Tạo tài khoản [GitHub](https://github.com) rồi tạo một repository mới, ví dụ `highway-brawl`.
2. Đẩy thư mục game lên repository đó. Không cần đẩy thư mục `node_modules`, file `.gitignore` đã loại nó ra.
   ```
   git init
   git add .
   git commit -m "Highway Brawl"
   git branch -M main
   git remote add origin https://github.com/<tên-bạn>/highway-brawl.git
   git push -u origin main
   ```
3. Tạo tài khoản [Render](https://render.com) và đăng nhập bằng GitHub.
4. Chọn **New → Blueprint** rồi chọn repository vừa tạo. Render đọc file `render.yaml` và tự cấu hình.

   Cách khác: chọn **New → Web Service** và điền:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Đợi Render build xong (vài phút). Bạn sẽ có địa chỉ dạng `https://highway-brawl.onrender.com`. Gửi địa chỉ này hoặc link mời phòng cho bạn bè.

Lưu ý:
- Gói Free của Render "ngủ" sau 15 phút không có ai truy cập. Lần mở đầu tiên sau đó mất khoảng 1 phút.
- Muốn chạy liên tục thì nâng gói, hoặc dùng dịch vụ khác chạy được Node.js như Railway, Fly.io hay VPS.
- Máy chủ đọc cổng từ biến môi trường `PORT`, các dịch vụ trên tự đặt sẵn.

## Đưa trang game lên Vercel (máy chủ online vẫn ở Render)

Vercel chỉ phát được trang game. Máy chủ online cần một tiến trình chạy liên tục để giữ phòng và chạy cuộc đua, nên vẫn phải đặt ở Render (hoặc Railway, Fly.io...). Game trên Vercel sẽ tự kết nối sang máy chủ đó.

1. Làm theo phần **Render** ở trên để có máy chủ online, ví dụ `https://highway-brawl.onrender.com`.
2. Vào [Vercel](https://vercel.com), chọn **Add New → Project** rồi **Import** cùng repository GitHub đó. File `vercel.json` đã cấu hình sẵn cách build, không cần chỉnh gì.
3. Trước khi bấm **Deploy**, mở mục **Environment Variables** và thêm:
   - **Name:** `HB_SERVER`
   - **Value:** địa chỉ máy chủ Render của bạn, ví dụ `https://highway-brawl.onrender.com`
4. Bấm **Deploy**. Gửi địa chỉ `https://<tên-dự-án>.vercel.app` cho bạn bè. Link mời phòng cũng dùng địa chỉ Vercel này.

Nếu sau này đổi địa chỉ máy chủ, sửa biến `HB_SERVER` rồi chọn **Redeploy** trên Vercel.

Lúc máy chủ Render gói Free đang "ngủ", game hiện "Đang đánh thức máy chủ online..." và tự thử lại cho đến khi vào được (khoảng 1 phút).

## Điều khiển

| Phím | Tác dụng |
|---|---|
| ↑ / W | Tăng ga |
| ↓ / S | Phanh |
| ← → / A D | Lái |
| Z / J, X / K | Đánh / đạp bên trái, bên phải |
| Space / Shift (giữ cùng tăng ga) | Bốc đầu |
| ESC / P | Tạm dừng. Khi đua online: mở menu, Q để rời cuộc đua |
| M | Bật / tắt âm thanh |

## Cấu trúc

- `index.html`, `js/`: game chạy trong trình duyệt.
  - `race.js` là phần mô phỏng cuộc đua.
  - `net.js` là phần online phía người chơi.
  - `g3/` là đồ họa 3D.
- `server/server.js`: máy chủ online. Nó dùng chung `race.js` với trình duyệt để mô phỏng cuộc đua.
- `js/config.js`: địa chỉ máy chủ online. Để trống nghĩa là dùng chính máy chủ đang phát trang.
- `scripts/build-web.js`, `vercel.json`: bước build cho Vercel. Bước này chép game vào `public/` và ghi `HB_SERVER` vào `js/config.js`.
