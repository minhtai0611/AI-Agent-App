# VANTAGE — MASTER AUDIT & TOTAL OVERHAUL PROMPT (CLAUDE CODE)
### BẢN PROMPT TỔNG LỰC ĐIỀU CHỈNH TOÀN BỘ 11 ROUTES & HỆ THỐNG MODAL
*Ngôn ngữ chuẩn: GIẤY — MỰC — CỜ ĐỈNH (Design System v1.4.1) · Ngày kiểm định: 2026-09-12*

---
---

## 1. VAI TRÒ & MỤC TIÊU CỐT LÕI

Bạn là **Lead Product Designer kiêm Principal Front-End Architect**. Nhiệm vụ của bạn là thực hiện **đại phẫu thuật toàn diện (Total System Overhaul)** toàn bộ mã nguồn của nền tảng **Vantage** (gồm tất cả các trang/routes và hệ thống modal) trên repository, loại bỏ 100% các tàn dư của **mã nguồn AI-generic / template SaaS**, tái thiết kế để mọi pixel, chuyển động, typography và layout đều thấm nhuần triết lý mỹ thuật **"VƯƠN TỚI ĐỈNH CAO — GIẤY, MỰC, CỜ ĐỈNH"**.

**Nguyên tắc bất di bất dịch:**
- **Giữ nguyên 100% logic nghiệp vụ:** dữ liệu 1.104 câu hỏi, engine chấm điểm (`scoringEngine.ts`), local draft saving, routing, logic toán học, và proctoring tracking.
- **Không rewrite kiến trúc framework:** làm sạch và refactor component UI/UX hiện có; không thêm thư viện ngoài (cấm Chart.js/Recharts/D3/Lottie/UI kits cồng kềnh).
- **Mọi trang = đúng một Signature Moment:** Không trang trí rời rạc.

---

## 2. BẢNG TỔNG HỢP AUDIT: SAI LỆCH HIỆN TẠI VS. CHUẨN THIẾT KẾ

| Tuyến / Route | File Live Bundle / Component | Lỗi rập khuôn AI phát hiện qua Audit | Giải pháp Overhaul theo Design System v1.4.1 |
|---|---|---|---|
| **Vỏ chung (Global Shell)** | `App.tsx`, `index.css`, `Nav.tsx`, `Footer.tsx` | Logo dùng chuỗi glyph `∫Σ√π∞Δ`; thiếu canvas ambient `#bgField` fixed 100dvh; theme toggle thiếu hook `VTG_REFRESH_COLORS`. | Wordmark `VANTAGE ▲`; `#bgField` fixed 100dvh với 7 đồi contour; footer chung `GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ`. |
| **Trang chủ (`/`)** | `Landing-B8sBp3Xx.js` | Có 4 emoji (`🧮 🔢 📋 📈`), thẻ bo góc 24px, glassmorphism, hero 3D giả lập thiếu tương tác theo chuột. | Hero 3D interactive terrain canvas (tilt lerp 0.045); stats section dạng mốc `M·01..M·03`; editorial FAQ rows. |
| **Trạm chọn đề (`/exams`)** | `ExamSelect-0MgnhI-w.js` | Emoji `✎`; chip năm bo tròn; lưới card lặp lại nút "Bắt đầu"; "+ Xem thêm" generic. | **Trảm · Bản đồ tuyến**: 4 tuyến rail màu; bảng mục lục kỹ thuật; dải contour độ khó 96×28 SVG; thanh trượt mốc năm. |
| **Sườn làm bài (`/test/:id`)** | `TestInterface-B55rYrlq.js` | 6 emoji (`✗ 🖼 🧮 📖 📋 ⚑`); đếm giờ Donut SVG quay tròn; thanh câu hỏi dạng vạch dash 8px/24px; button nảy spring. | **Bàn thi trắc địa**: Đồng hồ đo cao Barometer; tờ giấy thi KaTeX gáy mực 3px; bản đồ mốc 4 cột; thẻ chọn phím `[A] [B] [C] [D]`. |
| **Biên bản mốc (`/results/:id`)** | `Results-BbRAvur-.js` | 9 emoji (`✗ 🎊 📤 🔗 ⚠ 🏆 💪 🎬 ✦`); gauge tròn điểm số; dùng chart library SaaS; thẻ câu hỏi dày đặc. | **Biên bản mốc (Flagship)**: Điểm số Space Grotesk 700 96px; mặt cắt địa hình SVG 880×260; nhật ký vấp theo sườn; chế độ in `@media print`. |
| **Nhật ký hành trình (`/history`)** | `History-BYOFtU3R.js` | Emoji `📝 🏆`; empty state rỗng tuếch; danh sách entry card generic. | **Sổ leo núi**: Mặt cắt độ cao với đường zíc-zắc (switchback); empty state cuốn sổ trắng và cột cờ kẻ tay. |
| **Máy tính CAS (`/calculator`)** | `CasCalculator-CyX2HVn3.js` | 6 tab form rời rạc; kết quả text thô; nút "Kiểm tra với máy chủ" lộ cơ chế. | **Đồng hồ đo cao CAS**: 1 ô nhập duy nhất; rail phép toán chia độ `∂ · ∫ · lim · Σ`; KaTeX nhịp leo từng bước; badge tĩnh `ĐỐI CHIẾU: ENGINE NỘI BỘ ✓`. |
| **Đại số tuyến tính (`/linalg`)** | `LinearAlgebraWorkspace-Cm26p-vJ.js` | 10 tab bo tròn; lưới ô nhập thô; kết quả bảng số khô khan. | **Ma trận là địa hình**: Ma trận đổ thành mesh 3D sống; RREF xới phẳng; det≈0 sụp phẳng; Eigen vẽ 2 trục chính đỏ/xanh. |
| **Thung lũng hội tụ (`/probability`)** | `ProbabilitySimulator-OoVtRbdk.js` | 2 ô số + nút "Chạy mô phỏng"; không gian trống trải, vô hồn. | **Thung lũng hội tụ**: Hạt cát rơi tích tụ thành cồn dâng CLT = ngọn đồi thật; tuyến lý thuyết đỏ overlay; phiếu đối chiếu μ/σ. |
| **Sổ phác trắc địa (`/playground`)** | `MathPlayground-BpPF8Ocv.js` | Emoji `👁`; trục tọa độ lệch tỉ lệ (-64..64 × -16..15); biểu thức text thô. | **Sổ phác trắc địa**: Nét bút draw-on ngấm mực; chốt trắc lượng tại giao điểm; panel lề sổ typeset; viewport vuông chuẩn (-12..12 × -8..8). |
| **Khám phá khái niệm (`/concept/:id`)** | `ConceptExplorer-Dp2MAwPs.js` | Glassmorphism; pill tags generic; thiếu cảm giác trang sách định lý. | **Sổ tra cứu chuyên đề**: Trình bày như trang giáo trình typo chuẩn mực, cây kiến thức tiền đề dạng sơ đồ tuyến. |
| **Hệ thống 8 Modals toàn nền tảng** | Tất cả các file có Dialog/Modal/Sheet | Bo góc `rounded-2xl` (20-24px); backdrop blur loè nhoè; drawer kéo từ đáy giỏ hàng; form input xám xịt. | **Hệ thống cửa sổ trắc địa đồng nhất**: Bo góc 8px; gáy trên mực than 3px; bảng số liệu Ledger 2 cột mono; phím Esc đóng mượt. |

---

## 3. BA KỶ LUẬT THIẾT KẾ XUYÊN SUỐT (BẮT BUỘC TUÂN THỦ)

1. **QUY TẮC MỰC VERMILLION ≤ 5% DIỆN TÍCH:**
   * Màu `--accent` (`#E4572E` / Dark: `#F06840`) CHỈ ĐƯỢC PHÉP xuất hiện ở: 1 CTA chính, marker trạm vấp, cờ đỉnh ▲, và vạch cảnh báo thời gian chót (<10 phút).
   * Tuyệt đối cấm dùng accent tràn lan làm nền card hay viền trang trí.
2. **ZERO EMOJI TRÊN TOÀN BỘ CODEBASE:**
   * Xóa sạch 100% emoji (`🧮 🔢 📋 📈 ✎ ✗ 🖼 📖 ⚑ 🎊 📤 🔗 ⚠ 🏆 💪 🎬 ✦ 📝 👁`).
   * Thay thế bằng: icon SVG hình học kẻ tay (stroke 1.5px, `stroke-linecap/linejoin: round`) hoặc glyph typography ấn bản (`✓`, `✕`, `▲`, `▼`, `·`).
3. **KỶ LUẬT SỐ LIỆU MONO TABULAR:**
   * Mọi con số (điểm, thời gian, câu, năm, tọa độ, phần trăm) phải dùng `IBM Plex Mono` / `ui-monospace`, bật `font-variant-numeric: tabular-nums` và căn phải trong bảng đối chiếu.

---

## 4. DESIGN TOKENS & SHELL SYSTEM (CHUẨN DUY NHẤT)

Khai báo tại `:root` trong `index.css`:

```css
:root {
  /* Màu: Giấy · Mực · Cờ đỉnh */
  --paper:        #F5F2EA;        /* Nền chính giấy kem */
  --paper-2:      #ECE8DD;        /* Nền phụ, chip, bảng đối chiếu */
  --paper-3:      #E4DFC7;        /* Nền hover nhấn */
  --ink:          #1C2333;        /* Mực than chính */
  --ink-2:        #4A5164;        /* Mực phụ, mô tả */
  --ink-3:        #8A8FA0;        /* Nhãn kỹ thuật, mono meta */
  --line:         rgba(28,35,51,.14);
  --line-soft:    rgba(28,35,51,.08);
  --accent:       #E4572E;        /* Vermillion: CTA, marker, đường leo */
  --accent-deep:  #B03E1C;        /* Hover / active accent */
  --altitude:     #2F5D8A;        /* Xanh cao độ, dữ liệu phụ, link */
  --pine:         #33705C;        /* Xanh thông: trạm đạt, chuẩn xác */
  --dot:          rgba(28,35,51,.10);
  --summit-bg:    var(--ink);
  --ink-rgb:      28,35,51; 
  --paper-rgb:    245,242,234;
  --accent-rgb:   228,87,46; 
  --altitude-rgb: 47,93,138;

  /* Typography Scale (Modular 1.25) */
  --t-micro: 13px; --t-body: 16px; --t-lead: 20px; --t-h3: 25px;
  --t-h2: 31px; --t-h1: 39px; --t-hero: 61px;

  /* Font Families */
  --font-display: 'Space Grotesk','Be Vietnam Pro','Segoe UI',system-ui,sans-serif;
  --font-body:    'Be Vietnam Pro','Segoe UI',system-ui,sans-serif;
  --font-mono:    'IBM Plex Mono',ui-monospace,monospace;

  /* Spacing 4pt */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px;
  --s6:32px; --s7:48px; --s8:64px; --s9:96px; --s10:128px;

  /* Radius kỷ luật */
  --r-sm:4px; --r-md:6px; --r-lg:8px; --r-card:10px;

  /* Easing chuẩn */
  --ease-out: cubic-bezier(0.22,1,0.36,1);
}

/* DARK MODE — "Đêm trắc địa" */
[data-theme="dark"] {
  --paper:        #12161F; 
  --paper-2:      #1A202B; 
  --paper-3:      #242C3B;
  --ink:          #EDEAE0; 
  --ink-2:        #B9BDC9; 
  --ink-3:        #79808F;
  --line:         rgba(237,234,224,.15); 
  --line-soft:    rgba(237,234,224,.08);
  --accent:       #F06840; 
  --accent-deep:  #E4572E; 
  --altitude:     #6B9BD1; 
  --pine:         #4FA586;
  --dot:          rgba(237,234,224,.12);
  --summit-bg:    #0B0E13;
  --ink-rgb:      237,234,224; 
  --paper-rgb:    18,22,31;
  --accent-rgb:   240,104,64; 
  --altitude-rgb: 107,155,209;
}
```

---

## 5. KẾ HOẠCH TRIỂN KHAI 4 PHA CHO CLAUDE CODE

### PHA 1: NỀN TẢNG (FOUNDATION & SHELL CHUNG)
1. **Fonts & Head:** Nhúng Google Fonts (Space Grotesk 400/500/700, Be Vietnam Pro 400/500/600, IBM Plex Mono 400/500/600). Cài đặt inline script chống FOUC cho theme dark/light.
2. **Nav chung:** Wordmark `VANTAGE ▲` (xóa vĩnh viễn chuỗi `∫Σ√π∞Δ` khỏi nav), link Công cụ (dropdown), Lộ trình, Hỏi đáp, Theme Toggle SVG (sun/moon) và nút CTA viền `VÀO ÔN THI →`.
3. **Ambient Canvas `#bgField`:** Đặt fixed `100dvh` trên toàn bộ app, vẽ 7 vòng contour đồi trắc địa mờ nhẹ (alpha 0.035), lắng nghe hook `window.VTG_REFRESH_COLORS` khi đổi theme.
4. **Footer chung:** `VANTAGE ▲ · GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ`.

### PHA 2: OVERHAUL TỪNG ROUTE THEO SIGNATURE MOMENTS
1. **Route `/exams` (Trạm chọn đề):**
   * Bỏ chip năm và grid card cũ.
   * Xây dựng 4 Tuyến với 4 Rail màu dọc 3px (`--accent`, `--altitude`, `--pine`, `--ink`).
   * Mỗi đề = 1 hàng trong Bảng Mục Lục Kỹ Thuật (Tên đề | Năm | Số câu | Phút | Sparkline Contour 96×28 | CTA).
   * Hover hàng mở rộng thông tin nguồn + nút `CẮM MỐC XUẤT PHÁT ▲` (kích hoạt Modal xuất phát hoặc nhảy vào `/test/:id`).
2. **Route `/test/:examId` (Sườn làm bài — Bàn thi trắc địa):**
   * Đồng hồ đo cao Barometer Chronometer (thay donut countdown).
   * Tờ giấy thi A4 KaTeX sắc nét, gáy mực 3px, phương án A–D dạng thẻ kỹ thuật phím vuông `[A]`.
   * Cột phải: Bản đồ cột mốc 4 cột cố định (Đang đứng, Đã cắm, Cờ cần xem, Chưa tới).
   * Chế độ Thi thật vs Ôn luyện từng câu (khối "Nhịp leo — soi từng bước").
3. **Route `/results/:id` (Biên bản mốc — Flagship):**
   * Điểm số typography Space Grotesk 700 96px + Phiếu số liệu mono 2 cột.
   * Mặt cắt địa hình đề thi bằng SVG phản ứng (880×260), polyline Catmull-Rom qua độ khó, 3 loại trạm (Đúng: xanh thông, Sai: marker vermillion + leader line, Bỏ trống: vòng rỗng).
   * Danh sách câu sai dạng trang sách in với details KaTeX từng bước giải.
4. **Route `/history` (Sổ leo núi):**
   * Biểu đồ mặt cắt độ cao với các đường switchback nối các lần thi cùng đề.
   * Empty state sổ trắng với cột cờ kẻ tay: *"Sổ còn trắng — cột mốc đầu tiên chưa được cắm."*
5. **Route `/calculator` (CAS):** 1 ô input duy nhất + vành chia độ phép toán + nhịp leo typeset.
6. **Route `/linalg` (Đại số tuyến tính):** Mesh 3D địa hình trực quan hóa ma trận.
7. **Route `/probability` (Xác suất):** Cồn cát hội tụ CLT rơi hạt tạo đồi chuẩn.
8. **Route `/playground` (Math Playground):** Đồ thị nét bút draw-on + chốt trắc lượng giao điểm.

### PHA 3: OVERHAUL HỆ THỐNG 8 MODALS
Áp dụng cấu trúc khung trắc địa thống nhất:
1. **Lệnh Xuất Phát Mốc Thi** (`/exams`): Xem trước đề, mini contour, chọn Thi thật / Ôn luyện.
2. **Biên Bản Chốt Bài & Gấp Giấy Thi** (`/test/:id`): Bảng kiểm kê mốc chưa làm, click nhảy câu.
3. **Sổ Tay Công Thức Bỏ Túi** (`/test/:id`): Cửa sổ lật 4 tab chuyên đề KaTeX 2 cột.
4. **Trạm Tạm Dừng & Khóa Giờ** (`/test/:id`): Khóa đồng hồ khi rời tab, đếm số lần chuyển tab.
5. **Phiếu Báo Sai Lệch Mốc** (Toàn app): Phân loại lỗi ấn bản LaTeX / đáp án lệch chuẩn.
6. **Chứng Chỉ Cắm Đỉnh & Chia Sẻ** (`/results/:id`): Thẻ in tỉ lệ vàng có dấu niêm phong.
7. **Biên Bản Đóng Sổ Hành Trình** (`/history`): Xác nhận xóa trắng mốc an toàn.
8. **Cài Đặt Giám Sát Kỳ Thi** (`/org/*`): Bảng điều phối 3 cấp độ giám sát.

### PHA 4: NGHIỆM THU BẰNG MẮT & CODE CLEANUP
- Chụp ảnh kiểm thử 1440×900 và 390×844 ở 4 trạng thái: Default, Cuộn sâu, Dark mode, và Reduced motion.
- Chạy grep kiểm tra: không còn bất kỳ class `glass-elevated`, `glass-base`, `rounded-2xl` hay emoji nào trong mã nguồn.

---

## 6. COPY — TỪ ĐIỂN ĐỔI CHỮ TOÀN NỀN TẢNG

| Cũ (SaaS / Quiz Generic) | Mới (Ngôn ngữ Trắc Địa Vantage) |
|---|---|
| Chọn đề thi / Bắt đầu | TRẠM · BẢN ĐỒ TUYẾN → CẮM MỐC NÀY ▲ |
| Đang thi / Câu 1..N | SƯỜN LÀM BÀI → TRẠM 01/12 |
| Đánh dấu câu | CẮM CỜ MỐC NÀY ▲ |
| Nộp bài | GẤP GIẤY THI & CẮM ĐÍCH ▲ |
| Kết quả thi / Điểm số | BIÊN BẢN MỐC M·[ID] |
| Đáp án đúng | Trạm chuẩn |
| Lời giải chi tiết / Xem giải thích | Nhịp leo — soi từng bước |
| Làm lại đề này | Leo lại sườn này |
| Lịch sử làm bài | SỔ LEO NÚI · NHẬT KÝ HÀNH TRÌNH |
| Bảng công thức | SỔ TRA CỨU CÔNG THỨC TRẮC ĐỊA BỎ TÚI |
| Báo cáo lỗi | PHIẾU BÁO SAI LỆCH TRẮC LƯỢNG |
| Chia sẻ kết quả | CHỨNG CHỈ CẮM ĐỈNH M·[ID] |

---

## 7. BẮT ĐẦU THỰC HIỆN

1. Đọc kỹ file `vantage/design-system.html` làm nguồn chân lý duy nhất.
2. Quét toàn bộ repository, lập danh sách tất cả file sẽ chỉnh sửa.
3. Trình bày Action Plan ngắn gọn theo 4 Pha trên và bắt đầu thực thi từ **Pha 1 (Foundation & Shell)**.
