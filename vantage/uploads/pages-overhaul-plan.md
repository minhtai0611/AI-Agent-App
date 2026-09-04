# KẾ HOẠCH OVERHAUL 6 TRANG — VANTAGE
### Từ "6 trang cùng một ngữ pháp AI" → 6 công cụ mỗi cái một chữ ký
*Ngày: 2026-08-31 · gốc: exam-app-ey0.pages.dev · ngôn ngữ: GIẤY — MỰC — CỜ ĐỈNH (design-system.html v1.4.1)*

---

## 0. Chẩn đoán chung — vì sao cả 6 trang đều "rập khuôn"?

| Dấu hiệu AI-template đang có | Bản chất vấn đề |
|---|---|
| Mọi trang = tiêu đề → filter/form → card → nút hành động → vùng kết quả | **Một ngữ pháp cho 6 công cụ khác bản chất** — mắt đọc ra ngay |
| Nút gọi tên kỹ thuật: "Bắt đầu", "Tính", "Chạy mô phỏng" | Ngôn ngữ framework, không phải ngôn ngữ người leo núi |
| Emoji trong UI (📝 lịch sử trống, 👁 playground) | Phá hệ thống biểu tượng kẻ tay của design language |
| Logo = chuỗi glyph `∫Σ√π∞Δ` | Không phải wordmark, không chữ ký |
| Meta "2025 · 22 câu · 90 phút · Bộ GD&ĐT" xếp hàng đều | Không có bảng số liệu kiểu trắc địa (tabular mono, căn phải) |
| Kết quả in thô, không typography | Đỉnh cao mĩ thuật của app toán chính là **chất liệu chữ toán** — đang bị bỏ phí |
| **Không trang nào có "signature moment"** | Đây là phân biệt thật giữa template và tác phẩm: một khoảnh khắc duy nhất mà chỉ công cụ này có |

**Nguyên tắc sửa:** không "trang trí thêm". Mỗi trang chọn **một hình ảnh trung tâm** (central metaphor) đúng bản chất công cụ, mọi quyết định layout/motion đều phục vụ nó. Quy tắc vàng giữ nguyên: *chiều sâu chỉ xuất hiện khi nó LÀ metaphor địa hình.*

---

## 1. Vỏ chung (page shell) — làm TRƯỚC, làm MỘT LẦN

Lý do 6 trang giống nhau ngoài ý muốn: mỗi trang tự sinh shell riêng. Chốt shell chung:

- Wordmark `VANTAGE ▲` (thay chuỗi ∫Σ√π∞Δ, glyph toán chuyển xuống footer làm chữ ký mờ).
- Nav: logo · Công cụ (dropdown 4 mục) · Lộ trình (Chọn đề, Lịch sử) · Hỏi đáp · theme toggle ☾/☀ · CTA "VÀO ÔN THI".
- **`bgField` ambient canvas trên MỌI trang** (7 đồi mép · vignette 0.12→0.05 · sky wash · `position:fixed;100dvh` — kèm sanity check `getBoundingClientRect` từ bài học bug cover).
- Số hiệu trang kiểu trắc địa: `TRẠM ·01/06` góc trên, corner mono dưới khung.
- Footer chung: `GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ`.
- Cấm tuyệt đối: emoji trong UI; thay bằng biểu tượng SVG kẻ tay (đã có bộ 4 icon công cụ).

---

## 2. Từng trang: hiện trạng → hình ảnh trung tâm → signature moment

### 2.1 `/exams` — CHỌN ĐỀ THI → **"TRẢM · bản đồ tuyến"**
*Hiện trạng:* chip lọc năm + lưới card giống hệt nhau + nút "Bắt đầu" + "+ Xem thêm". Đây là cửa ngõ sản phẩm và cũng là nơi "mùi AI" nồng nhất.

- **Metaphor:** mỗi đề thi là một **trạm dừng (mốc)** trên tuyến; nhóm đề = 4 tuyến (THPT Quốc gia · Vào 10 · Quốc tế THCS · Quốc tế THPT/ĐH) = 4 tuyến màu khác nhau trên cùng một bản đồ.
- **Signature moment:** mỗi hàng đề có **dải contour độ khó siêu nhỏ** (difficulty profile 12–50 điểm dữ liệu thật của đề) — nhìn một lượt biết đề nào "dốc". Hover: hàng mở ra thành thẻ mốc với tuyến mini vẽ bằng route engine sẵn có.
- **Layout:** bỏ lưới card đồng nhất → **bảng mục lục kỹ thuật**: cột trái tuyến (rail màu), cột phải bảng đề căn phải số liệu (năm / số câu / phút / nguồn — mono tabular). Filter năm = thanh trượt mốc thời gian. "Xem thêm" → tuyến tự kéo dài (pagination ẩn).
- **Đổi chữ:** "Bắt đầu" → "CẮM MỐC NÀY ▲".

### 2.2 `/history` — LỊCH SỬ → **"NHẬT KÝ HÀNH TRÌNH · sổ leo núi"**
*Hiện trạng:* trạng thái rỗng chỉ là một câu chữ + emoji 📝.

- **Signature moment:** lịch sử làm bài vẽ thành **mặt cắt độ cao (elevation profile)** — mỗi lần thi là một số liệu trắc lượng: trục hoành thời gian, trục tung điểm, các lần thi cùng một đề xếp thành **đường zíc-zắc (switchback)** trên cùng một sườn. Không biểu đồ nào "template" hơn được vì đây là mặt cắt địa hình, đúng chất ngôn ngữ.
- **Empty state (sửa đầu tiên, đang mắc emoji):** cuốn sổ trắng với cột cờ kẻ tay ở trung tâm: *"Sổ còn trắng — cột mốc đầu tiên chưa được cắm."* + nút "VỀ TRẠM CHỌN ĐỀ".
- Mỗi entry: `M·07 · ĐỀ THI THỬ HÀ NỘI 2025 · 7.75đ · 82/90 PHÚT · ▲ +0.5 SO LẦN TRƯỚC`.

### 2.3 `/calculator` — MÁY TÍNH CAS → **"ĐỒNG HỒ ĐO CAO · dụng cụ của người leo núi"**
*Hiện trạng:* kho form (6 phép Giải tích + hệ phương trình + số phức), vùng "Kết quả" in thô, nút "Kiểm tra với máy chủ" lộ kỹ thuật.

- **Metaphor:** mặt đồng hồ đo cao/la bàn — input duy nhất ở giữa (không 6 tab form), **rail phép toán** chạy quanh như vạch chia độ: `∂ · ∫ · lim · Σ → Taylor · ODE`.
- **Signature moment:** kết quả typeset toán đẹp như trang sách (KaTeX đã có sẵn trong app) + **chuỗi bước biến đổi** hiện như từng nhịp leo: mỗi bước một dòng, by-line "vì sao" mờ ở lề. Lịch sử tính gần nhất = nhật ký dụng cụ dưới mặt kính.
- Sửa nhỏ: đổi "Kiểm tra với máy chủ" → badge trạng thái tĩnh `ĐỐI CHIẾU: ENGINE NỘI BỘ ✓` (ẩn cơ chế, giữ sự tin cậy).

### 2.4 `/linalg` — ĐẠI SỐ TUYẾN TÍNH → **"MA TRẬN LÀ ĐỊA HÌNH"**
*Hiện trạng:* 10 tab phép toán + lưới ô nhập +Cột/+Hàng + ô kết quả trống.

- **Signature moment (mạnh nhất toàn hệ, dùng lại đúng engine 3D đã có):** ma trận nhập vào **đổ thành mesh 3D** — giá trị từng ô = cao độ nút lưới (tái dùng `project()` + gaussian field từ hero v1.4). RREF = địa hình "xới phẳng" thành bậc thang; Định thức ≈ 0 = địa hình sụp thành tấm phẳng; Eigen/SVD = vẽ **hai trục chính** đỏ/xanh trên sườn. Người dùng *nhìn thấy* phép toán thay vì đọc bảng số khô.
- **Layout:** trái = lưới ô nhập (ô số mono, caret accent, hover kẻ khung mực), phải = vùng địa hình sống. 10 phép toán = rail dọc mono, không tab bo tròn.

### 2.5 `/probability` — XÁC SUẤT & MÔ PHỎNG → **"THUNG LŨNG HỘI TỤ"**
*Hiện trạng:* hai số nhập + nút "Chạy mô phỏng" — trang thưa nhất, cũng cơ hội lớn nhất.

- **Signature moment:** histogram tích lũy vẽ thành **cồn cát dâng** — mỗi lần gieo là một hạt rơi xuống cột, phân phối dần dần thành **đường cong chuẩn = một ngọn đồi đúng nghĩa** (định lý giới hạn trung tâm *tự vẽ ra ngọn núi*). Đường lý thuyết overlay bằng **tuyến đỏ** sẵn có của design language. Sau N lần: nhãn `n = 10.000 · TUYẾN ĐỎ = LÝ THUYẾT · σ = 2.41`.
- Đây là trang sẽ khiến người xem dừng lại — không AI-template nào sinh ra cồn cát CLT.

### 2.6 `/playground` — MATH PLAYGROUND → **"SỔ PHÁC CỦA NGƯỜI TRẮC ĐỊA"**
*Hiện trạng:* đã là công cụ đồ thị có real expression engine (điểm cộng duy nhất không cần làm lại logic); vấn đề là trục −64…64 × −16…15 lệch tỉ lệ, biểu thức in bằng text thường, list + nút 👁/✕ generic.

- **Signature moment:** đồ thị là **nét bút một lần** — mỗi hàm vẽ draw-on với nét có tắt/ngấm (stroke taper), màu theo thứ tự mực: đỏ → xanh → mực → vàng đậm. Giao điểm = **chốt trắc lượng** (pin + tọa độ mono). Trục = giấy kẻ ô kỹ thuật: vạch chính đậm, vạch phụ mờ 4 lần, nhãn số mono căn lề.
- Panel trái = **lề sổ tay**: biểu thức typeset serif italic (không phải input code), domain `x ∈ [−a, b]` căn bảng. "Vẽ từ mô tả (AI)" đổi tên → **"PHÁC THEO LỜI"** đặt dưới như một dòng ghi chú lề.
- Sửa viewport mặc định: vuông tỉ lệ (−12…12 × −8…8), tránh aspect kỳ lạ hiện tại.

---

## 3. Thứ tự thực hiện (đề xuất)

| # | Hạng mục | Vì sao trước/sau | Effort |
|---|---|---|---|
| 1 | **Shell chung** (wordmark, nav, bgField, footer, bỏ emoji) | Một lần sửa gỡ "mùi AI" trên cả 6 trang cùng lúc — ROI cao nhất | S |
| 2 | **`/exams` — Trảm** | Cửa ngõ traffic, mùi template nồng nhất | M |
| 3 | **`/probability` — Thung lũng hội tụ** | Màn trình diễn chữ ký; chứng minh sản phẩm thoát khỏi template | M |
| 4 | **`/history` — Nhật ký** | Gắn với dữ liệu người dùng, kể chuyện tiến bộ | M |
| 5 | **`/calculator` — Đồng hồ đo cao** | Tái cấu trúc form; typeset bước giải | M |
| 6 | **`/linalg` — Ma trận là địa hình** | Tái dùng engine 3D; to nhưng đã có nền | L |
| 7 | **`/playground` — Sổ phác** | Engine tốt sẵn; chủ yếu là chất liệu hiển thị | M |

## 4. Mọi trang sau sửa phải qua nghiệm thu bằng mắt

- Chụp headless Chrome 1440×900 ở 4 trạng thái (hero/cuộn sâu/mode phụ/dark) — smoke test Node KHÔNG thấy được layout (bài học bug `#bgField` cover).
- Checklist canvas nền: `position:fixed`, rect == viewport, α contour ≤0.12 mép / ~0.05 giữa.
- Zero emoji trong DOM; mọi số liệu meta dùng mono tabular căn phải; mọi CTA dùng ngôn ngữ hành trình.
- Reduced-motion → mọi trang có 1 frame tĩnh đẹp (kể cả cồn cát và mặt cắt nhật ký).

*"Mĩ thuật ở đây là sự nhất quán của một thế giới quan: giấy, mực, địa hình, cột mốc — áp vào từng pixel quyết định, không trang trí rời rạc."*
