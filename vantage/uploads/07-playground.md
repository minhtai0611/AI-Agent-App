# 07 · MATH PLAYGROUND — "SỔ PHÁC CỦA NGƯỜI TRẮC ĐỊA"
### Prompt end-to-end cho Claude Code · `/playground`
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Redesign trang **Math Playground** (`/playground`) của Vantage theo design language "Vươn tới đỉnh cao" (`vantage/design-system.html` — v1.4.1). Đây là trang có engine đồ thị thật (expression engine tốt sẵn — **không viết lại engine**); vấn đề thuần chất liệu: trục tỉ lệ kỳ lạ (−64…64 × −16…15), biểu thức in text code thường, list hàm với nút 👁/✕ emoji.

**Giữ nguyên tuyệt đối:** expression engine, parser, "vẽ từ mô tả (AI)" nếu có. UI/UX + chất liệu hiển thị redesign. Mọi thay đổi copy liệt kê cuối báo cáo.

## CONTEXT

- Route: `<ĐIỀN>`
- Engine đồ thị: `<ĐIỀN đường dẫn: parser, plotter, có sẵn giao điểm/tiếp tuyến không?>`
- Tính năng "Vẽ từ mô tả (AI)": `<ĐIỀN: giữ nguyên cơ chế gọi>`
- Deploy: Cloudflare Pages; không thêm dependency; đồ thị tự vẽ canvas 2D (engine sẵn có), **cấm chart library**.

## NORTH-STAR CONCEPT

**Sổ phác của người trắc địa**: tờ giấy kẻ ô kỹ thuật, mỗi hàm vẽ bằng **một nét bút có hồn** (nét có vào–ra, không phải polyline máy tính), giao điểm ghim bằng **chốt trắc lượng** kèm tọa độ mono. Panel bên trái đọc như **lề sổ tay**: biểu thức được typeset (KaTeX), không in mã nguồn.

Tự kiểm: GIẤY KẺ · NÉT BÚT · CHỐT TỌA ĐỘ. Nếu trông như Desmos-clone mặc định (grid xám phẳng, list item chip, nút icon library) → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens, fonts, `--ease-out`, theme toggle, `VTG_REFRESH_COLORS`. Chưa có → dừng và báo.
- Shell chung + `#bgField` fixed `100dvh` (rule CSS bắt buộc + sanity rect check) + footer chung.
- Cứng: **không emoji (xóa 👁/✕ hiện tại)**; không gradient/glass/shadow lan; bo góc ≤16px; canvas đọc màu từ `*-rgb` tokens runtime.
- Màu thứ 4 cho hàm thứ 4: thêm token mới `--amber: #B07A2A` (dark: `#D0A050`) khai báo đúng ở `:root`/`[data-theme="dark"]` + `--amber-rgb` — đây là ngoại lệ có chủ đích duy nhất (mực vàng trong sổ tay), ghi rõ trong báo cáo.

## SECTION-BY-SECTION SPEC

### 1. Đầu trang

Kicker mono `TRẠM · DỤNG CỤ · D·04`; H1 `Sổ phác trắc địa.`; sub một dòng: *"Gõ hàm, xem nét mực tự vẽ. Giao điểm được ghim chốt, tọa độ ghi như sổ đo."*

### 2. Tờ giấy đồ thị (canvas chính, ~2fr)

- **Sửa viewport mặc định**: x ∈ [−12, 12], y ∈ [−8, 8], tỉ lệ vuông đơn vị (1 đơn vị x = 1 đơn vị y trên màn). Nút mono `KHUNG GỐC` để quay về mặc định sau pan/zoom.
- **Giấy kẻ kỹ thuật**: vạch phụ mỗi 0.5 đơn vị alpha `.06` của ink, vạch chính mỗi 2 đơn vị alpha `.14`; trục 0 đậm 1.5px `var(--ink)`; nhãn số mono 10px `var(--ink-3)` chỉ ở vạch chính, căn tránh chồng gốc 0. Pan = kéo giấy (con trỏ `grab`); zoom = cuộn chuột/pinch quanh điểm neo con trỏ.
- **Nét bút một lần (signature nhỏ, đúng spirit)**: mỗi hàm **draw-on** trái→phải ~900ms với stroke 2.4px đầu nét round + "vào nét/ra nét" (2 đoạn đầu-cuối taper width 1.2→2.4 và 2.4→1.2, alpha ngấm nhẹ) — cảm giác bút lông, không phải plotter. Thứ tự mực theo hàm: 1 `var(--accent)` · 2 `var(--altitude)` · 3 `var(--ink)` · 4 `var(--amber)`; hàm thứ 5+ lặp lại chu trình.
- **Giao điểm = chốt trắc lượng** (nếu engine đã tính giao điểm; `<ĐIỀN nếu chưa có — đề xuất độ ưu tiên>`): vòng stroke 1.5px ink + tâm đặc accent 3px + **chip tọa độ mono 11px** `(1.41; 2.00)` nền `var(--ink)` chữ `var(--paper)`, đặt lệch khỏi điểm 10px theo hướng trống (tránh đè nét).
- **Tiếp tuyến** (nếu engine có): toggle mono `TIẾP TUYẾN TẠI x = a` + thanh trượt a; đường tiếp tuyến dash `6 4` ink-2, chốt điểm chạm accent.
- Reduced-motion: hàm hiện nguyên nét, không draw-on; pan/zoom tức thì.

### 3. Lề sổ tay (panel trái, ~320px)

- Mỗi hàm = **một dòng lề sổ**, không card: chấm mực màu 8px + biểu thức **typeset KaTeX lớn 16px** (không in `x^2+2x` thô) + domain mono ink-3 11px `x ∈ [−12, 12]` + hai nút SVG 12px (con mắt / gạch tròn — tự vẽ stroke 1.5px theo icon set, **không emoji**).
- Hover dòng → nét tương ứng trên giấy đậm 2.4→3.2px (và ngược lại, hover nét → dòng lề highlight `var(--paper-2)`).
- Ô thêm hàm: mono input placeholder `gõ: x^2 − 3x + 1 …` + preview KaTeX sống (tái dùng pattern preview của `/calculator` nếu đã làm).
- **"Vẽ từ mô tả (AI)" → đổi tên `PHÁC THEO LỜI`**, đặt cuối panel như một dòng ghi chú lề mono ink-3, mở ra textarea + nút ghost `PHÁC ▲`. Giữ nguyên cơ chế AI hiện có; kết quả AI trả về typeset như hàm nhập tay.

### 4. Mobile

Panel lề thành sheet dưới (kéo mở/đóng); giấy chiếm toàn màn; chốt tọa độ tap để hiện chip.

## STATES

- Hàm lỗi cú pháp: dòng lề viền trái `var(--accent-deep)` 3px + mono 11px `MỰC CHƯA ĐỌC ĐƯỢC — kiểm tra dấu/ngoặc` (không toast, không alert).
- Chưa có hàm nào: giấy trống + một nét ví dụ mờ alpha .25 của `y = x²/8 − 2` vẽ sẵn + nhãn mờ `NÉT MẪU — GÕ HÀM ĐỂ THAY`.
- Nhiều hàm: tối đa 4 màu, hàm thứ 5 ra nhãn mono `HẾT MỰC MÀU — DÙNG LẠI CHU TRÌNH MỰC` (không chặn cứng).

## MOTION SPEC

Draw-on 900ms/hàm · chip tọa độ fade+rise 160ms · hover đậm nét immediate · pan/zoom mượt theo rAF (không transition CSS). Reduced-motion: trạng thái cuối ngay. Cấm: animation nét nhấp nháy, glow quanh điểm, zoom "zoom-đạn" mất gốc.

## COPY — ĐỔI CHỮ

| Cũ | Mới |
|---|---|
| Math Playground | Sổ phác trắc địa. |
| Thêm hàm / Plot | VẼ NÉT NÀY |
| Vẽ từ mô tả (AI) | PHÁC THEO LỜI |
| Ẩn/Hiện, Xóa | (icon SVG mắt / gạch — không chữ, không emoji) |
| Reset view | KHUNG GỐC |

## A11Y & HIỆU NĂNG

- Canvas `role="img"` aria-label động: *"Đang vẽ 2 hàm: x bình trừ ba x cộng một; sin x. Hai giao điểm."*
- Mọi thao tác panel bằng bàn phím được; nút icon có aria-label (`Ẩn hàm số 2`).
- Đổi theme: giấy/nét/chốt đổi theo tokens không reload; DPR ≤1.75; dừng rAF khi khuất viewport/`document.hidden`.
- Không layout shift khi KaTeX panel render (min-height dòng lề).

## CHECKLIST CHỐNG AI-GENERIC

- [ ] Zero emoji trong DOM (gỡ 👁/✕); icon SVG kẻ tay bộ design system.
- [ ] Trục không còn tỉ lệ −64…64 × −16…15; khung gốc vuông −12…12 × −8…8.
- [ ] Biểu thức trong panel là KaTeX typeset, không text code.
- [ ] Nét hàm có draw-on + taper; giao điểm là chốt + chip tọa độ mono nền ink.
- [ ] Tối đa 4 mực màu (accent/altitude/ink/amber); không palette cầu vồng.
- [ ] Một signature nhỏ duy nhất (nét bút) — thang trượt tiếp tuyến và AI đều yên tĩnh, phụ.
- [ ] **Nghiệm thu bằng mắt**: 1440×900 (giấy trống có nét mẫu / 3 hàm + 2 chốt giao / sheet mobile mở / dark) + 390×844.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo: in ra năng lực engine thật (giao điểm? tiếp tuyến? domain?) + cơ chế "vẽ từ mô tả". Plan (kèm phần engine CHƯA có thì đề xuất bổ sung hay cắt khỏi scope) → tôi duyệt → mới code.
2. Thứ tự: Giấy kẻ + viewport gốc → Nét bút draw-on → Lề sổ tay + KaTeX → Chốt giao điểm → Phác theo lời → Mobile/states. Mỗi bước build + chụp verify.
3. Kết thúc: production build, tự chấm checklist, danh sách copy thay đổi, lệch spec kèm lý do.

Bắt đầu bằng bước 1.
