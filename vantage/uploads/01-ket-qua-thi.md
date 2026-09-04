# 01 · TRANG KẾT QUẢ THI — "BIÊN BẢN MỐC"
### Prompt end-to-end cho Claude Code · FLAGSHIP của bộ overhaul
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Nhiệm vụ: redesign hoàn toàn giao diện trang **kết quả thi** của Vantage (`/results/:id`) theo design language "Vươn tới đỉnh cao" (đọc `vantage/design-system.html` trong repo — nguồn chân lý duy nhất v1.4.1).

Trang này là **flagship nghệ thuật của sản phẩm**: đây là màn người dùng nhìn kỹ nhất sau 90 phút làm bài, và là màn duy nhất họ sẽ chụp lại chia sẻ. Nếu 7 màn overhaul chỉ được làm tử tế một màn, đó phải là màn này.

**Giữ nguyên tuyệt đối:** logic chấm điểm, dữ liệu kết quả, luồng lưu/truy vấn. Đây là UI/UX redesign, không phải rewrite. Copy tiếng Việt chỉ tinh chỉnh nhãn cho khớp design language (liệt kê mọi thay đổi copy ở cuối báo cáo).

## CONTEXT

- Route cần redesign: `<ĐIỀN: ví dụ src/pages/results/[id].tsx hoặc results.html>`
- Cấu trúc dữ liệu kết quả hiện có: `<ĐIỀN: danh sách câu, đáp án đã chọn, đáp án đúng, thời gian làm, giải thích từng câu, chuyên đề của từng câu — nêu rõ trường nào CÓ, trường nào KHÔNG>`
- Render toán: KaTeX đã có trong app `<ĐIỀN đường dẫn module nếu cần>`
- Deploy: Cloudflare Pages. Không thêm dependency: **cấm chart library** (Chart.js/Recharts/D3) — mặt cắt tự vẽ bằng SVG thuần; KaTeX dùng bản sẵn có.

## NORTH-STAR CONCEPT

Hai hình ảnh trung tâm, KHÔNG hơn:

1. **Tờ giấy chấm của người thầy giỏi** — giấy kem, mực than, chữ toán typeset sắc như ấn bản in; mực vermillion chỉ xuất hiện đúng những chỗ học trò vấp, như nét bút của thầy.
2. **Mặt cắt địa hình của đề thi** — toàn bộ đề vẽ thành một sườn dốc: trục hoành là thứ tự câu (cột mốc), trục tung là độ khó (cao độ). Nhìn một lượt biết "sườn nào đã gãy".

Từ khóa cảm xúc để tự kiểm: HỌC THUẬT · TÂN NGƯỠNG (đọc như giấy thật) · TRUNG THỰC (sai tô đậm, không né) · ẤM. Nếu trông như dashboard analytics SaaS (gauge tròn, bar chart màu mè, confetti) → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens `:root` + `[data-theme="dark"]`, 3 font (Space Grotesk / Be Vietnam Pro / IBM Plex Mono), `--ease-out`, icon SVG kẻ tay, theme toggle, hook `window.VTG_REFRESH_COLORS`. **Nếu tokens chưa tồn tại trong codebase (landing chưa merge): dừng lại, báo ngay — phải chạy foundation trước.**
- Trang này dùng đúng shell chung: wordmark `VANTAGE ▲`, nav (Công cụ / Lộ trình / Hỏi đáp / theme toggle / CTA `VÀO ÔN THI`), `canvas#bgField` fixed `100dvh` (kèm rule CSS `#bgField{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh}` — bài học bug cover; sanity check `getBoundingClientRect()` == viewport), footer `GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ`.
- Quy tắc cứng: **không emoji trong UI** (kể cả 🎉 khi điểm cao — cắm cờ đỉnh ▲ thay); không gradient; không glassmorphism; không shadow lan tỏa; bo góc ≤16px; mọi màu qua `var()` (SVG dùng `currentColor`/`style="stroke:var(--accent)"`; canvas/SVG động đọc `*-rgb` tokens runtime).

## SECTION-BY-SECTION SPEC

Layout: **một cột editorial**, max-width 880px (cảm giác tờ A4), khoảng thở `--s8`/`--s9` giữa các vùng, mobile xuống một cột hẹp tự nhiên. Không sidebar, không grid widget.

### 1. Phiếu trắc lượng (đầu trang — thay thế "hero điểm số" kiểu SaaS)

- **Cấm gauge tròn / SVG ring / progress donut** — đó là tell SaaS kinh điển. Điểm số là **typography**: `7.75` bằng Space Grotesk 700 ~96px, tracking −0.02em; kèm `/10` mono nhỏ baseline-aligned.
- Bên dưới/cạnh: **phiếu số liệu mono 2 cột** (nhãn trái ink-3 uppercase 13px, giá trị phải tabular):

```
M·07            ĐỀ THI THỬ HÀ NỘI 2025
THỜI GIAN       82/90 PHÚT
TRẠM ĐẠT        17/22
SO LẦN TRƯỚC    ▲ +0.50        ← vermillion nếu tiến bộ, ▼ ink-3 nếu tụt;
                                  chưa từng làm đề này → "MỐC ĐẦU TIÊN" màu pine
```

- Phân tầng bằng `border-top: 2px solid var(--ink)` phía trên headline `BIÊN BẢN MỐC M·07`. Không hộp, không nền khác.
- Motion: điểm số count-up 0→n trong 900ms (easing cubic-out, `toLocaleString('vi-VN')`, trigger 1 lần khi vào viewport); phiếu số liệu Rise từng dòng stagger 60ms.
- Khi điểm ≥ 8: cột **cờ đỉnh ▲ vermillion 20px** cạnh điểm số, pulse 1 lần rồi yên — thay cho mọi hình thức "congratulations".

### 2. Mặt cắt địa hình của đề — SIGNATURE MOMENT DUY NHẤT CỦA TRANG

Một SVG reactive (viewBox ~880×260, scale theo container), giấy sạch — không dot-grid, không texture:

- **Trục hoành**: CÂU 01…N — vạch + nhãn mono 11px mỗi 5 câu (01 · 05 · 10 …), đường trục 1px `var(--ink)`.
- **Trục tung**: ĐỘ KHÓ 0→5 — 3 vạch mono (NHẸ · VỪA · DỐC) thay con số khô; gridlines ngang `var(--line-soft)`.
- **Đường mặt cắt**: polyline/Catmull-Rom qua độ khó từng câu, stroke `var(--ink)` 1.5px; **fill dưới đường `var(--ink)` alpha 0.05** → cảm giác sườn địa hình thật.
  - Nguồn độ khó: `<ĐIỀN — ưu tiên: trọng số điểm/phần của câu; nếu có thống kê % làm đúng toàn hệ thì dùng>`. Nếu không có dữ liệu độ khó thật: fallback đường tuyến tính theo thứ tự câu (câu sau khó hơn câu trước) + nhãn chân khung `ĐỘ KHÓ: ƯỚC LƯỢNG THEO CẤU TRÚC ĐỀ`.
- **Mỗi câu = một trạm** đặt đúng trên đường mặt cắt, chỉ 3 loại:
  - Đúng: chấm đặc `var(--pine)` 5px.
  - Sai: marker `var(--accent)` (vòng stroke 1.5px + tâm đặc) + **leader line mảnh rơi xuống trục hoành** — trạm vấp phải "đọc" được từ xa.
  - Bỏ trống: vòng rỗng `var(--ink-3)`.
- **Motion**: đường mặt cắt draw-on trái→phải 1400ms (`stroke-dashoffset`, `var(--ease-out)`); các trạm xuất hiện theo sau, stagger 35ms; marker pulse lan 1 lần duy nhất tại các trạm vấp. Reduced-motion: vẽ tĩnh ngay.
- **Tương tác**: hover/tap một trạm → `scrollIntoView({behavior:'smooth'})` tới item câu đó trong mục 3 + flash nền `var(--paper-2)` 600ms của item. (reduced-motion → `behavior:'auto'`).
- Chú giải mono 11px chân khung: `● TRẠM ĐẠT   ◎ TRẠM VẤP   ○ BỎ QUA`.
- `role="img"` + `aria-label` tóm tắt bằng chữ: *"17 trên 22 trạm đạt. Trạm vấp: câu 8, 12, 14, 19, 20."*

### 3. Nhật ký vấp — danh sách câu cần soi (phần dài nhất, đọc như trang sách)

- Mặc định **chỉ liệt kê câu SAI + BỎ TRỐNG**; câu đúng ẩn sau toggle mono `XEM CẢ 22 TRẠM` ở đầu mục.
- **Nhóm theo chuyên đề** (nếu dữ liệu câu có trường chuyên đề `<ĐIỀN>`): header nhóm = đường kẻ 2px ink + mono uppercase `SƯỜN HÀM SỐ · VẤP 2/5 TRẠM`. Không có trường chuyên đề → một danh sách phẳng, không giả vờ nhóm.
- Mỗi item = **khối giấy**, không card: `border-top: 1px solid var(--line)`; grid `64px 1fr` — cột trái số câu mono `CÂU 12` (+ chip nhỏ `BỎ QUA` nếu trống), cột phải nội dung:
  - **Đề bài typeset KaTeX** đẹp: line-height 1.8, max-width 60ch; mọi biểu thức inline/block qua KaTeX, cấm để text thô kiểu `sqrt(x)+1/2`.
  - Phương án A–D xếp dọc mono nhãn: phương án **đã chọn mà sai** → vermillion + gạch ngang + ký tự `✕`; **đáp án đúng** → `var(--pine)` + ký tự `✓` + nhãn mờ `TRẠM CHUẨN · C`.
  - Lời giải trong `<details>/<summary>` native: summary mono `NHIỆP LEO — SOI TỪNG BƯỚC`; body mở ra là **chuỗi bước KaTeX từng dòng**, mỗi bước kèm by-line ink-3 mờ giải thích bằng lời (*"đạo hàm đổi dấu 2 lần ⇒ 2 cực trị"*). Dữ liệu không có lời giải → dòng mono ink-3 `TRẠM NÀY CHƯA CÓ NHẬT KÝ — MANG LÊN HỎI ĐÁP →` (link tới trang Hỏi đáp).
- Motion: items Rise (translateY 12px + fade, 380ms, stagger 50ms) khi vào viewport; mở details bằng height animation mượt 240ms (fallback tức thì nếu reduced-motion).

### 4. Bản đồ chuyên đề — BẢNG SỐ LIỆU, cố ý KHÔNG vẽ biểu đồ

Trang đã có signature moment ở mục 2; mục này giữ vai trò "phiếu đối chiếu" yên tĩnh:

- `<table>` thật, mono tabular căn phải: `CHUYÊN ĐỀ | TRẠM ĐẠT | SO LẦN TRƯỚC`.
- Dòng chuyên đề yếu nhất: giá trị màu `var(--accent)` + nhãn `MỤC TIÊU KẾ` — điểm yếu trở thành đỉnh cần chinh phục, đúng ngôn ngữ hero.
- Không có dữ liệu chuyên đề → **bỏ hẳn mục 4**, không render bảng rỗng.

### 5. CTA cuối — một mốc kế, không phải lưới đề

- Chọn ĐÚNG 1 đề gợi ý (logic gợi ý hiện có hoặc đơn giản: đề cùng tuyến, năm mới nhất, chưa làm) trình bày như một dòng mốc trắc địa: `MỐC KẾ TIẾP · ĐỀ THI THỬ ĐÀ NẴNG 2025 · 22 CÂU · 90 PHÚT` + nút primary accent `CẮM MỐC NÀY ▲`.
- Ghost link kề: `VỀ NHẬT KÝ HÀNH TRÌNH →` (`/history`).
- Không panel nền ink ở trang này (panel ink chỉ dành cho CTA cuối landing — giữ kỷ luật "một lần duy nhất").

## STATES (bắt buộc thiết kế đủ)

- **Loading**: khung skeleton `var(--paper-2)`, pulse chậm 2.4s, đúng layout thật (không spinner giữa màn).
- **Không tìm thấy kết quả / đã xóa**: trạng thái rỗng kiểu sổ tay — cờ kẻ tay SVG + `MỐC NÀY KHÔNG CÒN TRÊN BẢN ĐỒ.` + nút `VỀ TRẠM CHỌN ĐỀ`.
- **Điểm 0 hoặc bỏ hết**: vẫn trung thực, không né — mặt cắt ĐẦY trạm vấp chính là địa hình thật của người học; giọng chữ bình tĩnh, không an ủi sáo rỗng.
- **In/chia sẻ**: `@media print` — nền trắng tinh, mực đen, ẩn nav/CTA/bgField; tờ chấm phải in ra đẹp như giấy thật.

## MOTION SPEC (trang này)

Chuẩn `--ease-out` toàn bộ: count-up điểm 900ms · draw-on mặt cắt 1400ms · stagger trạm 35ms · Rise items 380ms/stagger 50ms · details mở 240ms. `@media (prefers-reduced-motion: reduce)`: mặt cắt và mọi con số hiện trạng thái cuối ngay, chỉ giữ fade ≤10ms. Cấm: confetti, bounce, animation lặp vô hạn (ngoại lệ duy nhất toàn app là marker pulse của hero).

## COPY — ĐỔI CHỮ (bắt buộc thống nhất)

| Cũ (nếu có) | Mới |
|---|---|
| Kết quả / Xem kết quả | BIÊN BẢN MỐC M·.. |
| Đáp án đúng | Trạm chuẩn |
| Xem giải thích / đáp án chi tiết | Nhiệp leo — soi từng bước |
| Làm lại đề này | Leo lại sườn này |
| Đề tiếp theo / Làm đề khác | Mốc kế tiếp → CẮM MỐC NÀY ▲ |
| Chúc mừng / Great job! | (xóa; cờ đỉnh ▲ nói thay) |

Ngôn ngữ đề thi gốc (đề bài, phương án, lời giải) GIỮ NGUYÊN — metaphor chỉ bao quanh, không chạm vào nội dung học thuật.

## A11Y & HIỆU NĂNG

- Mặt cắt có `role="img"` + aria-label tóm tắt (như trên); bảng chuyên đề là `<table>` semantic; markers SVG có `<title>`.
- KaTeX kiểm tra contrast cả dark mode (mực đổi theo tokens, không hardcode).
- `:focus-visible` outline 2px accent offset 3px trên mọi trạm/hàng/items tương tác; trạm focusable bằng bàn phím, Enter nhảy tới câu.
- Trang đọc hoàn chỉnh khi JS tắt: mặt cắt render server/inline SVG tĩnh, count-up chỉ là gia vị.
- Không layout shift khi font/KaTeX nạp (đặt min-height vùng mặt cắt và phiếu).

## CHECKLIST CHỐNG AI-GENERIC — tự rà trước khi báo xong

- [ ] Không gauge/ring/donut cho điểm số; điểm là typography.
- [ ] Không bar chart/pie chart mặc định; mặt cắt là SVG tự vẽ duy nhất.
- [ ] Câu sai KHÔNG xếp card grid; danh sách giấy với border-top.
- [ ] Không emoji/ký hiệu cảm xúc (🎉👍😢); ✓/✕ là glyph mực, không emoji màu.
- [ ] Vermillion chỉ ở: trạm vấp, chữ chọn-sai, ▲ delta, 1 CTA chính, cờ đỉnh (nếu ≥8đ). Đếm trên ảnh chụp ≤5% diện tích.
- [ ] Mọi số liệu mono tabular căn phải; nhãn kỹ thuật uppercase + tracking .14em.
- [ ] Mặt cắt đúng 3 loại trạm, 1 đường, fill 0.05 — không thêm series thứ hai, không trang trí.
- [ ] Hover trạm nhảy đúng câu; flash nền hoạt động; keyboard đi được.
- [ ] Dark mode hoàn chỉnh không reload; print thử một trang giấy đẹp.
- [ ] **Nghiệm thu bằng mắt**: chụp 1440×900 ở 4 trạng thái (đầu trang / cuộn tới nhật ký vấp / dark / reduced-motion) + 390×844; so song song với bản cũ.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo trước; **in ra cấu trúc dữ liệu result thật** và chỉ rõ trường nào dùng cho: độ khó mặt cắt, chuyên đề, lời giải, lần làm trước cùng đề. Trình bày plan + danh sách file sẽ đụng; KHÔNG code cho tới khi tôi duyệt.
2. Implement theo thứ tự Phiếu → Mặt cắt → Nhật ký vấp → Bảng chuyên đề → CTA → States. Sau mỗi vùng: build + chụp verify + tự rà checklist.
3. Kết thúc: production build, **tự chấm theo checklist**, danh sách thay đổi copy, và mọi quyết định lệch spec kèm lý do (không âm thầm đổi).

Bắt đầu bằng bước 1: đọc repo và trình bày plan.
