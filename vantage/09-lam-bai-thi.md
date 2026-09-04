# 09 · TRANG LÀM BÀI THI — "BÀN THI TRẮC ĐỊA & SƯỜN LÀM BÀI"
### Prompt end-to-end cho Claude Code · MẢNH GHÉP TRUNG TÂM CÒN THIẾU
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Nhiệm vụ: redesign hoàn toàn giao diện trang **làm bài thi** của Vantage (`/test/:examId` — TestInterface) theo design language "Vươn tới đỉnh cao" (đọc `vantage/design-system.html` trong repo — nguồn chân lý duy nhất v1.4.1).

Trang này là **trọng tâm trải nghiệm học tập của sản phẩm**: đây là nơi người học ngồi liên tục từ 24 đến 90 phút với độ tập trung cao độ nhất. Khác với landing hay trang kết quả, màn thi đòi hỏi sự **tĩnh lặng, kỷ luật học thuật, tính trang nghiêm của phòng thi** và **chất lượng ấn bản giấy in**. 

Hiện tại trang làm bài mang đầy đủ dấu vết **"rập khuôn AI / SaaS generic"**: vòng tròn đếm giờ donut SVG xoay tròn sặc sỡ, emoji rải rác (`🖼`, `📖`, `🧮`, `📋 Công thức`, `⌨`), các nút chọn đáp án nảy spring giật cục kiểu casual game, thanh chỉ số câu hỏi đáy màn hình dạng vạch dash 8px/24px như carousel app điện thoại, và modal nộp bài generic.

**Giữ nguyên tuyệt đối:** logic tính giờ, state quản lý đáp án (answers state machine), sessionStorage draft backup, logic chuyển câu, phím tắt, chống gian lận (tab switch / proctoring review nếu có), và luồng submit chuyển sang `/results/current`. Đây là UI/UX redesign toàn diện, không phải rewrite backend/scoring logic.

## CONTEXT

- File/Component cần redesign: `src/components/TestInterface.tsx` (hoặc tương đương)
- Route: `/test/:examId`
- Render toán: KaTeX đã nạp sẵn trong app (`MathText` component)
- Deploy: Cloudflare Pages. Cấm thêm thư viện animation nặng hoặc UI kit; chỉ dùng CSS/Framer Motion sẵn có theo token hệ thống.

## NORTH-STAR CONCEPT

Hai hình ảnh trung tâm:

1. **Bàn thi trắc địa của sĩ tử** — giấy kem mịn (`--paper`), mực than sắc nét (`--ink`), chữ toán typeset chuẩn mực như đề thi in typo của Bộ GD&ĐT. Mọi yếu tố đồ họa không phục vụ giải toán đều phải lùi xuống làm nền.
2. **Sườn núi thực thời (Station Elevation Ridge)** — mỗi câu hỏi là một **Trạm dừng (Station 01..N)** trên sườn dốc. Tiến độ làm bài là cao độ leo thực tế; các câu khó hoặc câu cần xem lại được **cắm cờ trắc lượng ▲**.

Năm từ khóa cảm xúc để tự kiểm: **TĨNH LẶNG · HỌC THUẬT · CHÍNH XÁC · TẬP TRUNG · ẤM**. Nếu màn hình trông giống game trắc nghiệm Quizizz/Kahoot hoặc LMS đại trà với gradient tím/xanh, bóng đổ nổi, emoji → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Kế thừa toàn bộ tokens `:root` và `[data-theme="dark"]` từ `design-system.html`.
- Canvas `#bgField` fixed `100dvh` chạy nhẹ ở nền với độ mờ cực thấp (alpha 0.03–0.04) để không gây rối mắt khi đọc biểu thức toán.
- **Cấm tuyệt đối emoji trong toàn bộ UI**: thay thế toàn bộ emoji `🖼 📖 🧮 📋 ⌨ 📝 ✗` bằng ký hiệu hình học SVG kẻ tay (stroke 1.5px) hoặc glyph toán học (`✓`, `✕`, `▲`).
- Bo góc kỷ luật: thẻ lựa chọn `border-radius: 6px`, khối giấy `border-radius: 8px`. Cấm bo tròn pill `rounded-full` bừa bãi.

## SECTION-BY-SECTION SPEC

Bố cục tổng thể: **2 cột chuẩn phòng thi** (Desktop: Cột trái 1fr = Tờ đề thi A4; Cột phải 340px = Bản đồ mốc trắc địa & Sổ công thức nhanh; Mobile: sụp xuống 1 cột với navigation mượt mà).

### 1. Thanh trắc địa đầu bàn (Exam Top Bar)

- Chiều cao cố định 60px, nền `color-mix(in srgb, var(--paper) 92%, transparent)`, `backdrop-filter: blur(10px)`, border đáy 1px `var(--line)`.
- **Trái**: Wordmark `VANTAGE ▲` + badge mono `SƯỜN LÀM BÀI` (hoặc `ÔN LUYỆN`).
- **Giữa**: Tên đề thi (Space Grotesk 15px semi-bold) + meta dòng dưới mono 11.5px: `NGUỒN: [Tên nguồn] · [N] TRẠM · [CHẾ ĐỘ THI THẬT / ÔN LUYỆN]`.
- **Phải (Đồng hồ đo cao — thay thế hoàn toàn SVG Donut Countdown)**:
  - Khối đồng hồ mono trắc địa: khung 1px `var(--line)`, nền `var(--paper-2)`, vạch chỉ thị cơ học nhỏ 16px.
  - Con số đếm ngược Space Grotesk / Mono `24:00` tabular-nums.
  - Khi thời gian < 10 phút: đổi màu `var(--accent)`. Khi < 3 phút: đổi màu `var(--accent-deep)` + nhịp thở nhẹ.
  - Theme toggle icon `sun/moon` SVG tinh gọn + nút toàn màn hình (fullscreen).
- **Dải thước cao độ đáy bar (Altitude Strip)**: vạch cao độ mỏng 3px chạy ngang đáy bar, fill `var(--accent)` từ 0% → 100% theo câu hỏi hiện tại.

### 2. Tờ đề thi giấy kem (Main Question Paper)

Một khối giấy in ấn bản học thuật (`background: var(--paper)`, viền 1px `var(--line)`, gáy trên 3px `var(--ink)`):

- **Đầu tờ giấy**:
  - Trái: Nhãn trạm `TRẠM 01/12` (Space Grotesk 22px bold) + Chip chuyên đề mono `CĂN BẬC HAI & ĐẠI SỐ` + Mức độ khó `MỨC: VỪA`.
  - Phải: Nút **CẮM CỜ MỐC NÀY** (icon lá cờ SVG kẻ tay). Khi được chọn → nền vermillion 12%, viền accent, chữ `ĐÃ CẮM CỜ MỐC NÀY ▲`.
- **Nội dung đề bài**:
  - Typography Space Grotesk / Be Vietnam Pro 18.5px, line-height 1.75, màu `--ink`.
  - Toàn bộ công thức toán typeset bằng KaTeX sắc sảo. Biểu thức block có vạch lề trái 2px `var(--altitude)`.
  - Hình minh họa: nếu có SVG/image thật từ đề thi gốc thì đóng khung kỹ thuật giấy kem 1px viền; nếu chỉ có link nguồn ngoài thì hiển thị nút text mono: `XEM BẢN VẼ GỐC TRẮC ĐỊA →` (không dùng emoji 🖼).
- **Khối 4 phương án lựa chọn (A — B — C — D)**:
  - Bỏ hiệu ứng nhảy spring/lift của SaaS. Sử dụng thiết kế **thẻ kỹ thuật 2 phần**:
    * Cột phím trái 44px: chứa chữ cái `A`, `B`, `C`, `D` mono bold đóng khung nét mực mỏng.
    * Phần thân phải: biểu thức toán KaTeX căn dòng tự nhiên.
  - **Trạng thái**:
    * Bình thường: viền 1px `var(--line)`, nền `--paper`.
    * Hover: viền `var(--ink-2)`, nền `--paper-2`.
    * Đã chọn: viền 2px `var(--ink)` (dark mode: `var(--accent)`), nền `var(--paper-2)`, nhãn chữ cái đảo màu mực/giấy.

### 3. Bản đồ cột mốc (Surveyor's Station Map — Cột phải)

Thay thế hàng chấm dash li ti ở chân trang bằng **Bảng trắc lượng mốc 4 cột cố định**:

- Panel `BẢN ĐỒ CỘT MỐC` với số liệu mono: `07/12 ĐÃ CẮM`.
- Lưới các ô mốc hình vuông 40×40px đánh số `01`, `02`, ..., `N`:
  - Đang đứng (Current): viền 2px `--ink`, nền `var(--paper-2)`.
  - Đã làm (Answered): nền `--pine` 14%, viền `--pine` 40%, chữ xanh thông.
  - Cắm cờ (Flagged): chấm tròn vermillion nhỏ góc trên bên phải.
  - Chưa tới (Unanswered): viền 1px `--line-soft`.
- Chú giải mono 10.5px phía dưới: `● Đang đứng  ● Đã cắm mốc  ▲ Cờ cần xem  ○ Chưa tới`.

### 4. Dụng cụ trắc địa — Sổ tra cứu công thức nhanh (Field Pocket Book)

- Nút mở sổ công thức kiểu trắc địa: `SỔ CÔNG THỨC TOÁN [CẤP] → MỞ SỔ`.
- Modal / Slide-over thanh lịch: chia theo tab chuyên đề (Căn bậc hai, Hằng đẳng thức, Hệ thức lượng, Lượng giác...).
- Các công thức trình bày 2 cột (Tên định lý mono mờ | Biểu thức KaTeX sắc nét), nền giấy kem.

### 5. Chế độ Ôn Luyện vs Thi Thật (Practice vs Timed Mode)

- **Khi ở chế độ Thi thật (Timed)**: Không hiển thị đáp án đúng/sai hay lời giải trong khi làm bài để giữ trọn vẹn áp lực phòng thi.
- **Khi ở chế độ Ôn luyện (Practice)**:
  - Ngay sau khi chọn đáp án: xuất hiện khối phản hồi `✓ ĐẠT MỐC CHUẨN XÁC` (viền pine) hoặc `✕ TRẠM VẤP — CẦN ĐỐI CHIẾU` (viền accent).
  - Khối **NHỊP LEO — SOI TỪNG BƯỚC**: giải thích chi tiết KaTeX từng bước biến đổi, có by-line nghiêng mờ giải thích lý do toán học.

### 6. Biên bản chốt bài (Gấp bài thi & Cắm đích — Submit Dialog)

Khi ấn `GẤP BÀI THI ▲` hoặc hết giờ:

- Modal xác nhận thiết kế như một **Biên bản kiểm tra mốc**:
  - Bảng số liệu mono: Tổng số trạm · Số trạm đã cắm · Số câu chưa trả lời · Số cờ cần xem lại · Thời gian đã dùng.
  - Cảnh báo rõ ràng nếu còn câu chưa làm: `▲ CHÚ Ý: BẠN VẪN CÒN 3 CÂU CHƯA CẮM MỐC`.
  - Hai nút hành động: `LÀM TIẾP` (ghost) và `NỘP BÀI & XEM KẾT QUẢ ▲` (primary accent).

### 7. Điều hướng bàn phím (Keyboard Shortcuts)

- `A`, `B`, `C`, `D`: Chọn đáp án tương ứng.
- `←`, `→`: Chuyển lùi / tiến trạm câu hỏi.
- `F`: Cắm cờ / Bỏ cờ trạm hiện tại.
- `Esc`: Đóng sổ công thức / modal nộp bài.
- Dải ribbon mono mờ chân trang nhắc phím tắt, không làm phiền tầm nhìn.

## COPY — BẢNG ĐỔI CHỮ (Bắt buộc đồng bộ với hệ thống)

| Cũ (Generic LMS/Quiz) | Mới (Ngôn ngữ Trắc Địa Vantage) |
|---|---|
| Câu 1 / Câu hỏi 1 | TRẠM 01/12 |
| Đánh dấu câu này | CẮM CỜ MỐC NÀY ▲ |
| Nộp bài | GẤP BÀI THI ▲ |
| Còn câu chưa trả lời | BIÊN BẢN CHỐT: CÒN CÂU CHƯA CẮM MỐC |
| Xem công thức / Bảng công thức | SỔ TRA CỨU CÔNG THỨC TRẮC ĐỊA |
| Xem giải thích / Bước giải | NHỊP LEO — SOI TỪNG BƯỚC |
| Đúng rồi / Sai rồi | ĐẠT MỐC CHUẨN XÁC ✓ / TRẠM VẤP ✕ |
| Chúc bạn thi tốt | CHÍNH TÂM — KIÊN ĐỊNH — CẮM ĐÍCH |

## CHECKLIST CHỐNG AI-GENERIC (Tự rà trước khi nghiệm thu)

- [ ] Không có vòng tròn đếm ngược donut SVG sặc sỡ; dùng đồng hồ đo cao trắc địa.
- [ ] Không có bất kỳ emoji nào trong DOM (`🖼 📖 🧮 📋 ⌨ 📝 ✗`); toàn bộ là SVG hoặc glyph typographic.
- [ ] Các phương án A-B-C-D không có hiệu ứng nhảy lò xo spring giật nảy; chọn là khóa nét mực dứt khoát.
- [ ] Bảng mốc câu hỏi 4 cột rõ ràng, không dùng thanh dash 8px/24px trượt li ti.
- [ ] Công thức toán 100% qua KaTeX, có căn lề và xử lý phân số/căn thức chuẩn mực.
- [ ] Màu vermillion `--accent` chiếm ≤ 5% diện tích màn hình (chỉ cờ đánh dấu, cảnh báo thời gian cuối, và nút chốt bài).
- [ ] Bố cục đáp ứng hoàn hảo cả Light (giấy kem) và Dark (đêm trắc địa) không gây chói mắt khi làm bài ban đêm.
- [ ] Phím tắt A/B/C/D, mũi tên và F hoạt động trơn tru.

## QUY TRÌNH THỰC HIỆN ĐỀ XUẤT

1. Mở file `TestInterface.tsx` (hoặc component phòng thi tương ứng).
2. Tái cấu trúc layout thành 2 cột: Tờ giấy đề thi (trái) + Bản đồ mốc & Sổ công thức (phải).
3. Thay thế component đếm giờ bằng Barometer Chronometer.
4. Cập nhật thẻ câu hỏi, phương án A-B-C-D và modal chốt bài theo đúng tokens và typography.
5. Kiểm tra dark mode, phím tắt và test luồng submit sang `/results/current`.
