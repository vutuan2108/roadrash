# Highway Brawl 3D

Game đua mô tô đấm nhau trên đường Việt Nam, kèm chế độ đua ô tô drift, đồ họa 3D (three.js), chơi đơn hoặc **chơi online nhiều người** với phòng chờ (cả mô tô lẫn drift).

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

Mỗi phòng có tối đa 8 người. Chủ phòng chọn **Thể loại** trong phòng chờ:

- **MÔ TÔ:** tay đua máy lấp chỗ trống cho đủ 12 xe. Mỗi người đua bằng chiếc xe đang chọn trong cửa hàng. Tiền thưởng, tiền phạt và hư hỏng xe được tính vào garage của từng người.
- **Ô TÔ DRIFT:** mỗi người đua bằng chiếc xe đang chọn trong gara drift, không có xe máy. Xem phần **Đua drift online** bên dưới.

Vào **CHƠI ONLINE** từ menu ĐUA Ô TÔ DRIFT thì phòng mới tạo ra sẵn ở thể loại drift.

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
| ↓ / S | Phanh. Nhấp nhẹ chỉ giảm ít, giữ càng lâu phanh càng gấp (giữ hơn 1 giây là phanh hết cỡ) |
| ← → / A D | Lái |
| Z / J, X / K | Đánh / đạp bên trái, bên phải |
| Space / Shift (giữ cùng tăng ga) | Bốc đầu. Giữ sẵn lúc đếm ngược để xuất phát bốc đầu, tăng tốc nhanh hơn |
| ESC / P | Tạm dừng. Khi đua online: mở menu, Q để rời cuộc đua |
| M | Bật / tắt âm thanh |

Khi té xe, người lái văng ra, tự đứng dậy, chạy lại dựng xe rồi chạy tiếp.

Vào cua, xe nghiêng theo tốc độ và độ gắt của cua. Xe thể thao nghiêng tới gần 60°, người lái dạt người vào trong và chống gối. Vào cua quá nhanh thì xe trượt rộng ra một chút và tự mất tốc độ, nên phanh trước các cua gắt.

## Các chặng đua

- **Đường phố:** Ven biển Mũi Né, Rừng thông Đà Lạt, Đèo Hải Vân, Sài Gòn về đêm. Có xe cộ và cảnh sát.
- **Trường đua (GP):** Phú Quốc (vòng 4,8 km), Tam Đảo (3,8 km, đồi dốc), đêm Sài Gòn (4,2 km, đèn pha). Đường kín, không có xe cộ và cảnh sát. Cấp 1–2 chạy 2 vòng, từ cấp 3 chạy 3 vòng. Có vỉa đỏ trắng, bẫy sỏi, khán đài, khu pit và bản đồ nhỏ góc phải màn hình.

Về TOP 3 ở 4 chặng khác nhau để lên cấp.

## Các mẫu xe

Các xe được dựng theo dáng và màu sơn gốc của xe thật:

| Xe | Kiểu | Màu gốc |
|---|---|---|
| Kawasaki Z900 | Naked, khung mắt cáo | Xanh lá chanh, đen |
| Yamaha YZF-R1 | Superbike | Xanh dương, ốp sườn bạc, mâm xanh |
| Kawasaki Ninja 1000SX | Sport-touring, kính cao | Xanh lục |
| BMW S 1000 RR | Superbike, cánh gió | Trắng, xanh, đỏ (Motorsport) |
| Kawasaki W800 | Cổ điển, máy 2 xi-lanh tản nhiệt gió, mâm căm | Đen, dải bạc |
| Honda Africa Twin | Adventure, bánh trước 21", lốp gai | Trắng, đỏ, xanh (Tricolor), mâm vàng |
| Honda Rebel 1100 | Bobber | Đen |
| Honda Winner X | Côn tay 150 cc, dựng từ mẫu 3D (.glb) và ảnh xe thật | Đỏ, tem xanh trắng HRC, ốp carbon |
| Yamaha Exciter 155 | Côn tay 155 cc, 2 mắt LED, pô chụp bạc | Xanh GP, ốp sườn bạc |
| Suzuki Raider R150 | Côn tay 150 cc, pô crôm vểnh | Đen, sọc đỏ trắng |
| Yamaha YZF-R15 V4 | Sport 155 cc, mặt giống R1 | Xanh Racing Blue, phuộc vàng |
| Honda SH 160i | Tay ga | Trắng, viền xám |
| Honda CBR250RR | Sport 250 cc 2 xi-lanh, dựng từ mẫu 3D (.glb) | Đỏ, tem xanh trắng HRC |
| Honda CBR1000RR Fireblade | Superbike 1000 cc, dựng từ mẫu 3D có sẵn (xem phần Ghi công) | Đỏ, tem xanh trắng HRC |

## Đua ô tô drift

Vào **ĐUA Ô TÔ DRIFT** ở menu chính. Chạy hết cung đường và ghi điểm bằng những pha trượt ngang, một mình hoặc cùng tối đa 5 xe máy.

### Đối thủ máy

- Chọn số đối thủ ở dòng **ĐỐI THỦ MÁY** trong menu drift: dùng ← → để đổi từ TẮT đến 5 xe. Mặc định là 3.
- Các xe máy xuất phát hai xe một hàng sau vạch. Bạn đứng ở hàng thứ hai.
- Xe máy chạy cùng hạng xe với bạn (hạng xe dưới, ngang hoặc trên một bậc), màu sơn khác nhau và tay lái mạnh yếu khác nhau.
- Xe máy cũng drift và được chấm điểm theo đúng luật như bạn. Vào cua chúng xếp hàng drift nối đuôi nhau, ra đường thẳng thì vượt sang bên còn trống.
- Xe máy bám theo bạn. Bị bỏ xa thì chúng tăng tốc đuổi kịp, còn dẫn trước quá xa thì chậm lại chờ bạn.
- Trong vòng 30 m sau bạn, xe máy chạy theo đúng đường bạn chạy và drift ở những chỗ bạn drift. Xe gần bạn nhất giữ khoảng 2 m sau đuôi xe bạn để drift song hành (tandem): cả hai đều được điểm x1,5.
- Bạn chạy rất chậm hoặc dừng lại thì xe máy vượt lên, không đứng chờ sau bạn.
- Xếp hạng tính theo **tổng điểm drift**, không tính ai về đích trước. Bảng điểm trực tiếp hiện ở góc trên bên trái, chấm màu trên bản đồ nhỏ là vị trí từng xe.
- Khi bạn về đích, xe máy nào chưa về được chạy nốt tới đích rồi mới chốt bảng điểm. Hạng nhất thưởng thêm $3,000, hạng nhì $1,500, hạng ba $600.
- Xe máy về đích sẽ tấp vào lề rồi rời đường sau vài giây để không cản bạn. Xe đã về đích (kể cả xe bạn) không còn va chạm với xe khác.

### Phím điều khiển

Bộ phím theo các game drift trên PC như CarX Drift Racing và Forza Horizon (phanh tay ở Space, côn ở Shift, lên/xuống số E/Q, đổi camera C).

| Phím | Tác dụng |
|---|---|
| ↑ / W | Ga |
| ↓ / S | Phanh. Giữ khi xe đứng yên thì lùi |
| ← → / A D | Lái |
| Space | Phanh tay: khóa bánh sau để bắt đầu trượt |
| Shift | Côn. Giữ côn rồi vê ga, thả ra thì "đá côn" làm bánh sau mất bám |
| E / Q | Lên / xuống số. Bấm vào là chuyển sang số tay |
| T | Đổi giữa số tự động và số tay |
| N | Nitro. Bình nitro tự nạp lại khi drift |
| C | Đổi camera: bám sau xe, sau xa, nắp capo |
| R | Đặt lại xe lên đường, dùng khi xe bị kẹt hoặc quay ngược |
| H | Còi |
| ESC / P | Tạm dừng. Q để bỏ cuộc |

Cách drift:

1. Vào cua, kéo phanh tay (Space), đá côn (Shift), hoặc đánh lái gắt khi đang chạy nhanh.
2. Giữ ga. Thả phím lái thì xe tự trả lái ngược để giữ góc trượt.
3. Khi đang trượt, phím lái quyết định hướng xe đi. Giữ phím về phía trong cua thì xe ôm cua chặt hơn, và nếu vào cua quá nhanh xe sẽ tự ghìm bớt tốc độ.
4. Thoát drift: nhấp phím lái ngược ra một nhịp (hoặc buông phím lái khoảng 1 giây). Xe đứng thẳng lại, hết khói và tăng tốc bình thường.
5. Đảo lái ở cua chữ S: giữ hẳn phím lái ngược ra kèm ga. Xe văng sang drift phía bên kia.
6. Nhả ga thì bánh sau bám lại và xe thôi trượt.

### Tính điểm

- Điểm của mỗi chuỗi drift tăng theo góc trượt và tốc độ.
- Hệ số nhân tăng dần tới x5: mỗi 3 giây trượt liên tục được thêm 1, mỗi lần đảo lái cũng được thêm 1.
- Trượt sát rào (cách dưới 1 m) được nhân đôi điểm.
- Song hành: drift trong vòng 7 m cạnh một xe khác cũng đang drift thì điểm x1,5.
- Sau 1,6 giây không trượt, điểm của chuỗi được cộng vào tổng.
- Chạm nhẹ vào rào hoặc vào xe khác thì chuỗi đang ghi bị trừ 30% điểm.
- Đâm mạnh vào rào hoặc vào xe khác, xoay xe, hoặc đặt lại xe thì mất hết điểm của chuỗi đang ghi.
- Khi hai xe chạm nhau, chỉ xe phía sau (xe đâm vào) bị trừ điểm. Hai xe đi song song chạm nhau thì cả hai đều bị trừ.
- Về đích được xếp hạng C, B, A, S hoặc SS, nhận tiền thưởng và lưu kỷ lục từng bản đồ.

### Bản đồ

Hai cung đèo có mặt đường rộng 18 m, rào cách tim đường 10,75 m. Mỗi đèo có nhiều đoạn cua nối tiếp nhau không có đường thẳng xen giữa (zíc zắc, rắn lượn, cua tay áo liên hoàn), nên có thể giữ một chuỗi drift rất dài và đẩy hệ số lên x5. Một lượt chạy đèo mất khoảng 3,5 phút.

- **Đèo Mã Pí Lèng** (Hà Giang, khoảng 5,5 km đổ dốc): vách đá dựng đứng, vực sông Nho Quế, cua tay áo, ba đoạn zíc zắc, hai đoạn rắn lượn bốn khúc.
- **Đèo Ô Quy Hồ** (Sa Pa, khoảng 5,3 km, lúc hoàng hôn): rừng thông, mười cua kẹp tóc, các khúc ngoặt nối tiếp.
- **Sân drift đêm Bình Dương** (3 vòng, mỗi vòng khoảng 2,4 km, tổng khoảng 7,2 km): đường rộng 22 m, 27 khúc cua mỗi vòng, hầu hết đoạn thẳng được bẻ bằng cua chữ S, có đèn pha và khán đài. Một lượt khoảng 5 phút.

### Xe

Mua xe trong **GARA Ô TÔ**. Danh sách cuộn được bằng ↑↓, dùng ← → để đổi màu sơn xe đã mua. Mỗi xe có một dòng "Ngoài đời" ghi máy, công suất xe zin và tốc độ tối đa thật, kèm các chỉ số trong game: công suất, mô-men, trọng lượng, vòng tua tối đa, tốc độ tối đa.

Các xe trong game đều là bản độ drift, mạnh hơn số liệu ngoài đời khoảng 45%. Tỉ số hộp số, cầu, vòng tua tối đa, trọng lượng, chiều dài cơ sở và phân bố tải trước/sau lấy theo xe thật.

| Xe | Đặc điểm |
|---|---|
| Toyota AE86 Trueno | Có sẵn. Nhẹ, 190 mã lực, đèn pop-up, sơn trắng–đen kiểu "panda". Cần phanh tay hoặc đá côn để vào drift |
| Nissan Silvia S15 | 360 mã lực turbo, cân bằng, dễ drift |
| Mazda RX-7 FD3S | 405 mã lực, máy xoay 8000 vòng/phút, đèn pop-up |
| Toyota Supra A80 | 465 mã lực, 680 Nm, cánh gió lớn, đèn hậu tròn |
| Ford Mustang GT | V8 650 mã lực, 810 Nm, chỉ cần đạp ga là đuôi xe văng ra |
| Toyota GR86 Pandem | Thân rộng Pandem V1.5, cánh gió lớn. Xe zin (đời 2022): máy boxer 2.4 L, 228 mã lực, 250 Nm, 1270 kg, hộp số 6 cấp và cầu 4.30 lấy theo xe thật. Bản độ turbo trong game: 330 mã lực, 360 Nm, 0–100 km/h 4,0 giây |
| Nissan Silvia S15 Custom | Bản drift chuyên nghiệp: thân rộng, cánh GT, canard, lồng an toàn. SR20DET độ turbo lớn (khoảng 350 mã lực ngoài đời), bỏ bớt nội thất còn 1190 kg, góc lái lớn. Trong game 500 mã lực, 560 Nm, 0–200 km/h 8,7 giây |
| Datsun 280Z | Xe cổ thân rộng, mâm lưới SSR vàng. Ngoài đời: máy L28E 2.8 L 6 xi-lanh, 170 mã lực ở 5600 vòng/phút, 221 Nm, 1270 kg, số sàn 5 cấp, 205 km/h. Trong game 250 mã lực, 0–100 km/h 4,8 giây. Xe rẻ nhất sau AE86 |
| Nissan Skyline GT-R R34 | Xanh Bayside, nắp capo carbon, cánh gió. Ngoài đời: RB26DETT 2.6 L 6 xi-lanh twin-turbo, 280 mã lực, 392 Nm, 1560 kg, hộp số Getrag 6 cấp, cầu 3.545. Xe thật dẫn động 4 bánh, trong game là bản drift dẫn động cầu sau: 400 mã lực, 570 Nm |
| Mazda RX-7 VeilSide Fortune | Bộ thân VeilSide Fortune, cam phối đen. Máy xoay 13B-REW twin-turbo, xe zin 280 mã lực; bản độ VeilSide khoảng 400 mã lực. Trong game 580 mã lực, 0–200 km/h 8,0 giây |
| Mazda RX-7 BN Sports | Bộ thân BN Sports BLS, cánh GT lớn, đèn pop-up. Máy xoay 13B độ lớn, khoảng 600 mã lực ngoài đời. Trong game 700 mã lực, quay tới 8500 vòng/phút |
| Porsche 911 GT2 (993) | Máy boxer 3.6 L twin-turbo đặt sau, dẫn động cầu sau. Ngoài đời: 430 mã lực, 540 Nm, 1295 kg, 0–100 km/h 4,4 giây, 295 km/h. Trong game 615 mã lực, 0–100 km/h 2,6 giây. Nặng đuôi nên đuôi xe dễ văng |
| Ferrari F40 LB-Works | Bộ thân Liberty Walk. Ngoài đời: V8 2.9 L twin-turbo đặt giữa, 478 mã lực ở 7000 vòng/phút, 577 Nm, khoảng 1250 kg, 324 km/h. Trong game 685 mã lực, 835 Nm, 0–100 km/h 2,4 giây. Xe đắt nhất gara |

Tỉ số hộp số của F40 và GT2 (993) là số ước lượng vì không tìm được nguồn đáng tin; các số còn lại lấy theo tài liệu của xe thật.

Các xe GR86 Pandem, S15 Custom, Supra A80, Datsun 280Z, R34, hai chiếc RX-7, GT2 và F40 dựng từ mẫu 3D trong thư mục `car/` (xem phần Ghi công), có mâm, lốp, đĩa phanh và heo phanh riêng của mẫu. Bánh xe quay đúng trục và đánh lái được. Mẫu của xe được tải dần trong nền sau khi mở game. Nếu vào đua khi mẫu chưa tải xong, game hiện "ĐANG TẢI XE..." trong giây lát. Cách chuyển mẫu xem `tools/glb/README.md`.

### Đua drift online

1. Vào **ĐUA Ô TÔ DRIFT** rồi chọn **CHƠI ONLINE** (hoặc **CHƠI ONLINE** ở menu chính, rồi đổi thể loại sang **Ô TÔ DRIFT**).
2. Tạo phòng, gửi link mời. Chủ phòng chọn chặng drift bằng ◄ ►.
3. Khi mọi người bấm **SẴN SÀNG**, chủ phòng bấm **BẮT ĐẦU ĐUA**. Đếm ngược bắt đầu cùng lúc trên mọi máy, sau khi tất cả đã tải xong đường và xe.
4. Xếp hạng theo điểm drift. Bảng điểm trực tiếp ở góc trên bên trái, xe người khác hiện chấm màu trên bản đồ nhỏ. Drift sát xe người khác (dưới 7 m, cả hai cùng trượt) được điểm x1,5.
5. Khi người đầu tiên về đích, những người còn lại có 75 giây để về đích. Sau đó máy chủ chốt bảng điểm chung. Tiền thưởng như khi chơi đơn (theo điểm, xếp hạng và top 3), nhưng điểm online không tính vào kỷ lục chặng.

Trong lúc đua online, ESC mở menu. Cuộc đua không tạm dừng, xe của bạn tự trôi. Trong menu, bấm Q để rời cuộc đua.

Mỗi máy tự chạy vật lý cho xe của mình, nên đánh lái và drift không bị trễ mạng. Máy chủ chuyển tiếp vị trí của mọi xe 20 lần mỗi giây, và xe người khác hiện chậm hơn khoảng 0,1 giây cho mượt. Khi hai xe chạm nhau, mỗi máy chỉ đẩy xe của chính mình; xe phía sau (xe húc vào) bị trừ điểm chuỗi.

Cách đưa lên web để bạn bè chơi giống phần mô tô: chạy máy chủ ở Render, có thể đưa trang lên Vercel (xem mục **Đưa lên web (miễn phí với Render)** và **Đưa trang game lên Vercel** ở trên). Không cần cài thêm gì cho phần drift.

## Ghi công

- Mẫu 3D Honda CBR1000RR Fireblade (`js/g3/c1k.js`) dựa trên mẫu ["Honda CBR1000RR"](https://sketchfab.com/3d-models/honda-cbr1000rr-3cb6e14f27a94bf080bed9d98db21c70) của tác giả [Nieve5677](https://sketchfab.com/niev).
- Giấy phép: [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
- Mẫu đã được chỉnh sửa: giảm số tam giác, tô lại màu từng phần và vẽ tem HRC.
- Mẫu 3D Toyota GR86 Pandem (`js/g3/gr86.js`) dựa trên mẫu ["2022 Pandem GR86 V1.5 Aero Kit"](https://sketchfab.com/3d-models/2022-pandem-gr86-v15-aero-kit-04fa19ccee604fc3aab2cc4d62d9dd7f) của tác giả [Ddiaz Design](https://sketchfab.com/ddiaz-design).
  - Giấy phép: [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/): **không dùng cho mục đích thương mại**, và bản chỉnh sửa phải chia sẻ cùng giấy phép này.
  - Mẫu đã được chỉnh sửa: giảm số tam giác, bỏ nội thất và khoang máy, tô lại màu từng phần.
- Mẫu 3D Nissan Silvia S15 Custom (`js/g3/s15c.js`) dựa trên mẫu ["Nissan Silvia S15 Custom"](https://sketchfab.com/3d-models/nissan-silvia-s15-custom-2c3481e502c24d818d23a5eb2be8dac9) của tác giả [Socksthecat](https://sketchfab.com/Socksthecat).
  - Giấy phép: [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
  - Mẫu đã được chỉnh sửa: giảm số tam giác, bỏ nội thất, tô lại màu từng phần.
- Các mẫu 3D sau đây của tác giả [Ddiaz Design](https://sketchfab.com/ddiaz-design), giấy phép [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) (**không dùng cho mục đích thương mại**, bản chỉnh sửa chia sẻ cùng giấy phép):
  - Porsche 911 GT2 (`js/g3/gt2.js`): ["1995 Porsche 911 GT2 (993)"](https://sketchfab.com/3d-models/1995-porsche-911-gt2-993-2b3843db0f784ab0a8702f6361d16d2a).
  - Mazda RX-7 VeilSide Fortune (`js/g3/rx7vs.js`): ["1997 VeilSide Fortune Mazda RX-7 FD Tokyo Drift"](https://sketchfab.com/3d-models/1997-veilside-fortune-mazda-rx-7-fd-tokyo-drift-7db6bd58bb8f405abeb5ed02bcabc960).
  - Mazda RX-7 BN Sports (`js/g3/rx7bn.js`): ["2018 BN Sports BLS FD RX7"](https://sketchfab.com/3d-models/2018-bn-sports-bls-fd-rx7-5bc518f3c2664ae2ad7b0a0783759b09).
  - Nissan Skyline GT-R R34 (`js/g3/r34.js`): ["Eddie's Nissan Skyline R34 NFS Underground"](https://sketchfab.com/3d-models/eddies-nissan-skyline-r34-nfs-underground-9a6bc4ed690546a1bf02832764f1c888). Game không dùng lớp tem của mẫu.
  - Các mẫu đã được chỉnh sửa: giảm số tam giác, bỏ nội thất và khoang máy, tô lại màu từng phần.
- Mẫu 3D Ferrari F40 LB-Works (`js/g3/f40.js`) dựa trên mẫu ["LB-Works Ferrari F40 | www.vecarz.com"](https://sketchfab.com/3d-models/lb-works-ferrari-f40-wwwvecarzcom-011cad3526e945799d6e98dde6390182) của tác giả [vecarz](https://sketchfab.com/heynic).
  - Giấy phép: [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) (không dùng cho mục đích thương mại, bản chỉnh sửa chia sẻ cùng giấy phép).
  - Mẫu đã được chỉnh sửa: giảm số tam giác, bỏ nội thất, tô lại màu từng phần.
- Mẫu 3D Toyota Supra A80 (`js/g3/supra.js`) dựa trên mẫu ["Toyota Supra"](https://sketchfab.com/3d-models/toyota-supra-16ab211659114ad1bf45095a67c0d325) của tác giả [Mateusz Woliński](https://sketchfab.com/jeandiz).
  - Giấy phép: [CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/) (không dùng cho mục đích thương mại).
  - Mẫu đã được chỉnh sửa: giảm số tam giác, bỏ nội thất, tô lại màu từng phần.
- Mẫu 3D Datsun 280Z (`js/g3/z280.js`) dựa trên mẫu ["[FREE] Datsun 280Z"](https://sketchfab.com/3d-models/free-datsun-280z-0789ab2ece9442de94b3c41595e0ecbd) của tác giả [Martin Trafas](https://sketchfab.com/Bexxie).
  - Giấy phép: [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
  - Mẫu đã được chỉnh sửa: giảm số tam giác, tô lại màu từng phần.

## Cấu trúc

- `index.html`, `js/`: game chạy trong trình duyệt.
  - `race.js` là phần mô phỏng cuộc đua.
  - `drift.js` là chế độ đua ô tô drift: danh sách xe, bản đồ đèo, vật lý ô tô, hộp số, va chạm giữa các xe, tay lái máy và tính điểm.
  - `net.js` là phần online phía người chơi.
  - `g3/` là đồ họa 3D.
- `server/server.js`: máy chủ online. Nó dùng chung `race.js` với trình duyệt để mô phỏng cuộc đua mô tô; với phòng drift, nó chuyển tiếp vị trí xe giữa các người chơi và chốt bảng điểm.
- `js/config.js`: địa chỉ máy chủ online. Để trống nghĩa là dùng chính máy chủ đang phát trang.
- `scripts/build-web.js`, `vercel.json`: bước build cho Vercel. Bước này chép game vào `public/` và ghi `HB_SERVER` vào `js/config.js`.
