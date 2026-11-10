# Chuyển mẫu 3D (.glb) thành thân xe trong game

Đây là các script dùng để làm Honda Winner X (`white_mesh.glb` kèm ảnh chụp ngang) và Honda CBR250RR (`cbr.glb`, tem tự vẽ). Kết quả là các file `js/g3/winnerx.js` và `js/g3/cbr.js`. Game không cần thư mục này để chạy.

**Cần chuẩn bị:** Node.js, Microsoft Edge và `puppeteer-core` (cài ngoài repo, rồi đặt biến `PUPPETEER` trỏ tới nó). File tạm nằm ở `F:/hb_tmp/`, đổi trong script nếu cần. Trục xe trong game: x sang trái, y lên trên, z về phía trước.

## Đo mẫu

- `inspect.js`: xem cấu trúc file glb.
- `analyze.js`: đo tâm bánh, bán kính lốp và các điểm chính.
- `comps.js file.glb 0.2`: liệt kê các mảnh rời sau khi bỏ tam giác dài. Các tấm thừa AI sinh ra thường là mảnh riêng.
- `tyre.js`, `tyrew.js`, `ring.js`: đo bán kính và độ rộng lốp để cắt cho sạch.
- `near.js`: xem có gì nằm quanh trục bánh, để cắt chắn bùn mà không chạm vào đầu xe.
- `wide.js`: tìm phần thò ngang bất thường.
- `rider_pts.js`: đo yên, tay lái và gác chân để đặt tư thế người lái.
- `slice.html` (cần `data.js` tạo bằng `mkdata.js`): vẽ mặt cắt mesh.

## Làm sạch và đóng gói

`node build_glb.js cfg_xxx.js` thực hiện các bước:
- bỏ tam giác lỗi,
- cắt bánh xe (game tự vẽ bánh),
- cắt thêm vùng khai báo trong `cut`,
- giữ mảnh lớn nhất,
- nén lại và gắn bản đồ màu.

Mẫu cấu hình xem `cfg_cbr.js`. Winner X dùng `build_wx.js`, phiên bản riêng có lật chữ theo ảnh chụp.

## Màu sắc

Có hai cách:
- **Có ảnh chụp ngang:** chạy `mkphoto.js`, sau đó `pp.js photo.html out 1950 3100 ex1.js`. Script tự tách nền, tìm bánh xe và chia màu thành các vùng.
- **Không có ảnh:** xem hình bóng có lưới tọa độ bằng `pp.js "livery.html?ref=2"`, vẽ tem trong `liv_xxx.js`, rồi chạy `pp.js livery.html out 2048 1280 ex_liv.js`. Chữ được tự lật cho bên trái.

## Mẫu làm tay nhiều mảnh (CBR1000RR)

Mẫu tải từ Sketchfab gồm nhiều mảnh, hơn 1 triệu tam giác và vật liệu không có màu.

1. Xem tác giả và giấy phép bằng `inspect2.js`. Xem từng vật liệu bằng `mats.html`. Liệt kê các mảnh kèm vị trí bằng `c1k_list.js`.
2. Trong `cfg_c1k.js`, gán mỗi mảnh vào một nhóm màu: `paint` là dàn áo nhận tem, ngoài ra có `rubber`, `alu`, `black`, `drop` (bỏ đi)...
3. Chạy `node build_multi.js cfg_c1k.js`. Script cần `meshoptimizer` (đã cài ở `F:/hb_tmp/nodetools`). Nó hàn đỉnh, giản lược từng mảnh theo sai số tính bằng mét (`err` cho bản thường, `errLo` cho bản nhìn xa) rồi gom theo nhóm.
4. Vẽ tem cho nhóm `paint` bằng `livery.html?m=c1k` cùng `liv_c1k.js`. Xem kết quả bằng `multiview.html`.

Trong game, màu và vật liệu của từng nhóm nằm ở bảng `GLB_CAT` trong `models.js`.

## Mẫu ô tô drift

Mẫu nằm trong thư mục `car/` ở gốc repo (thư mục này không đưa lên git). Mỗi xe có một file cấu hình `cfg_<tên>.js` và cho ra `js/g3/<tên>.js`. Game vẽ chúng bằng `glbCar` trong `models.js`. Các file này không nằm trong `index.html`: `models.js` tải chúng khi cần (danh sách `CAR_FILES`). Thêm xe mới thì nhớ thêm tên vào `CAR_FILES`. Trong lúc file đang tải, game vẽ tạm một khối xe đơn giản.

Xem mẫu kèm texture thật bằng `pp.js "tex.html?f=file:///.../file.glb"`. Kết quả in ra màu trung bình của từng mảnh, đánh số giống `car_list.js`, để biết mảnh nào là đèn, lưới hay sợi carbon khi cả thân xe dùng chung một texture.

1. `node car_list.js file.glb` liệt kê vật liệu: số mảnh, số tam giác và vị trí. Xem hình theo màu vật liệu bằng `pp.js "mats.html?s=100&f=file:///.../file.glb"` (`s` đổi đơn vị mẫu sang mét để camera nhìn thấy).
2. Trong `cfg_xxx.js`:
   - `wb` là chiều dài cơ sở thật, `a` là khoảng từ trọng tâm tới cầu trước (giống `a` trong `DRIFT_CARS`).
   - `mats` gán vật liệu vào nhóm màu: `paint` nhận màu sơn của người chơi. `lamp` tự tách thành đèn pha (phía trước) và đèn hậu (phía sau). `amberLamp` tách thành xi-nhan và đèn hậu. `drop` bị bỏ (nội thất, khoang máy, logo).
   - `wheel` liệt kê các nhóm thuộc bánh xe. Script gán chúng vào bánh gần nhất, chỉ giữ bánh trước trái và bánh sau trái, đặt tâm ở trục bánh. Bên phải dùng bản lật đối xứng.
   - `exh` là vị trí miệng ống xả `[x, y, bán kính, z]` để đặt lửa pô.
   - `colors` đặt màu riêng cho các nhóm của xe đó, ví dụ mâm vàng hay heo phanh đỏ.
   - Mẫu dựng lốp và mâm thành một khối thì gán vào nhóm `wheel`. Script tìm bánh như với lốp, rồi cắt theo bán kính: phần nằm ngoài `rimK` (mặc định 0,72) lần bán kính lốp là lốp, phần bên trong là mâm.
   - Mẫu dựng cả 4 lốp (hoặc cả 4 phanh) chung một khối thì script tự cắt khối đó theo 4 góc xe.
   - Mẫu dựng bánh trước đang đánh lái thì góc lái đó bị bỏ, chỉ giữ góc camber.
   - `frame` xoay mẫu khi mẫu không quay đầu về +z, ví dụ `(x, y, z) => [-x, y, -z]` cho mẫu quay đầu về -z (180SX, Mustang GT-R).
   - `byName(part)` gán nhóm theo từng mảnh (tên, số thứ tự `id`, vật liệu), dùng khi một vật liệu phủ nhiều thứ khác nhau.
   - `split(part)` trả về một hàm chia một mảnh theo từng tam giác: hàm nhận tâm tam giác và trả về nhóm. Ví dụ mảnh mui xe của R35 chứa cả đèn hậu và đèn pha, nên cắt theo z.
   - `triColors` là file JSON màu texture của từng tam giác, xuất bằng `tex.html?dump=<id mảnh>`. Khi có file này, hàm của `split` nhận màu làm tham số thứ hai. Boss 302 dùng cách này để giữ sọc đen vẽ trong texture và tách viền crôm khỏi phần nhựa đen.
   - Bánh xe trong mẫu thường nghiêng (camber). Script đo trục thật của bánh từ bề mặt lốp, có tính theo diện tích tam giác, rồi lưu bánh theo trục đó. Góc nghiêng được ghi thành một phép quay cố định (`qf`, `qr`) để bánh quay không bị đảo. Nếu lốp và mâm của mẫu lệch trục nhau thì đặt `axisCats: ['rim']` để lấy trục theo mâm.
3. Chạy `node build_car.js cfg_xxx.js`. Script đo tâm bánh từ lốp, phóng theo `wb`, đặt bánh chạm đất, giản lược từng mảnh theo sai số (`err` cho bản gần, `errLo` cho bản xa, `errW` cho bánh xe) rồi ghi file vào `F:/hb_tmp/cars/`. Chép file đó vào `js/g3/`.
4. Màu và vật liệu của từng nhóm nằm ở bảng `CAR_CAT` trong `models.js`. Thông số lái và va chạm nằm ở `DRIFT_CARS` và `DRIFT_BODY` trong `js/drift.js`.

## Xem kết quả

`glbview.html?m=cbr` vẽ xe kèm shader giống trong game (`glbrt.js`, cấu hình CBR ở `cbrcfg.js`).

Trong `js/g3/models.js`, bảng `GLB_CFG` giữ các thông số của từng mẫu:
- tỉ lệ và độ lệch tâm của mẫu,
- vùng mặt nạ đèn, đèn hậu, mặt yên, tay lái,
- kiểu đĩa phanh.

Ngoài ra `GLB_STYLE` cho biết xe số mấy dùng mẫu nào.
