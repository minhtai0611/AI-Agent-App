# 02 · TRANG CHỌN ĐỀ — "TRẠM · BẢN ĐỒ TUYẾN"
### Prompt end-to-end cho Claude Code · `/exams`
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Redesign trang **chọn đề thi** (`/exams`) của Vantage theo design language "Vươn tới đỉnh cao" (đọc `vantage/design-system.html` — nguồn chân lý v1.4.1). Đây là cửa ngõ sản phẩm và hiện là nơi "mùi AI-template" nồng nhất: chip filter + lưới card đồng nhất + nút "Bắt đầu" lặp lại vô tận.

**Giữ nguyên tuyệt đối:** dữ liệu đề, nhóm tuyến, logic filter năm, điều hướng vào phòng thi. Đây là UI/UX redesign. Mọi thay đổi copy liệt kê ở cuối báo cáo.

## CONTEXT

- Route cần redesign: `<ĐIỀN>`
- Cấu trúc dữ liệu đề: `<ĐIỀN: tên, năm, số câu, số phút, nguồn, nhóm/tuyến, có sẵn dữ liệu độ khó từng câu hay chỉ trọng số phần?>`
- Nhóm hiện có: Thi vào lớp 10 · Thi THPT Quốc gia · Luyện tập vào lớp 10 (quốc tế THCS) · Luyện tập THPT & ĐH (quốc tế).
- Deploy: Cloudflare Pages; không thêm dependency.

## NORTH-STAR CONCEPT

**Trang này là một TRẠM trên bản đồ dựng tuyến.** Mỗi đề thi là một cột mốc (mốc), mỗi nhóm đề là một tuyến màu khác nhau trên cùng một bản đồ. Người dùng không "duyệt danh sách" — họ **đọc bản đồ rồi chọn một mốc để cắm**.

Từ khóa tự kiểm: TRẮC ĐỊA · ĐỌC NHANH · KỶ LUẬT LƯỚI · ẤM. Nếu trông như trang danh mục khóa học/e-commerce (card đều nhau, chip filter, "+Xem thêm") → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens, 3 font, `--ease-out`, icon set, theme toggle, hook `VTG_REFRESH_COLORS`. Nếu tokens chưa tồn tại trong codebase → dừng, báo ngay (làm foundation trước).
- Shell chung bắt buộc: wordmark `VANTAGE ▲` (xóa hẳn chuỗi `∫Σ√π∞Δ` khỏi nav — glyph toán chỉ còn ở footer), nav chung, `canvas#bgField` fixed `100dvh` kèm rule CSS bắt buộc + sanity check `getBoundingClientRect()` == viewport, footer `GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ`.
- Cứng: không emoji trong UI; không gradient/glassmorphism/shadow lan; bo góc ≤16px; mọi màu qua `var()`.

## SECTION-BY-SECTION SPEC

### 1. Đầu trang — "TRẠM"

- Kicker mono: `TRẠM · BẢN ĐỒ TUYẾN · 40+ MỐC THẬT`.
- H1 Space Grotesk 39px: `Chọn mốc để cắm.` (thay "Chọn đề thi"); sub một dòng ink-2 ≤60ch: *"Mỗi đề là một cột mốc trên tuyến. Rê qua để xem độ dốc, cắm mốc để bắt đầu leo."*
- Note mono phải cùng hàng (desktop): `04 TUYẾN · LỌC THEO MỐC NĂM`.

### 2. Filter năm — BỎ chip, dùng THANH TRƯỚT MỐC THỜI GIAN

- Một thanh trượt dải (range) 2018–2025 kiểu trắc địa: track 1px ink, vạch mốc mono mỗi năm, fill đoạn chọn accent. **"Tất cả"** = kéo full dải. Nhãn đầu cuối mono 11px.
- Mobile: giữ thanh trượt (kéo ngón tốt), bỏ vạch lẻ, chỉ nhãn đầu–cuối.
- Filter áp cho cả 4 tuyến cùng lúc; tuyến nào hết đề trong dải năm → header tuyến mờ 40% + nhãn `TUYẾN NÀY CHƯA CÓ MỐC TRONG DẢI NĂM`.

### 3. Bốn tuyến — rail màu + BẢNG MỤC LỤC KỸ THUẬT (thay lưới card)

Mỗi tuyến là một section:

- **Rail màu dọc 3px** sát lề trái nội dung, chạy suốt chiều cao tuyến: THPT Quốc gia = `var(--accent)` · Vào lớp 10 = `var(--altitude)` · Quốc tế THCS = `var(--pine)` · Quốc tế THPT–ĐH = `var(--ink)`. (Đúng 4 màu từ tokens, không sinh màu thứ năm.)
- **Header tuyến**: `border-top: 2px solid var(--ink)`; trái: tên tuyến Space Grotesk 25px + mô tả một dòng ink-2; phải mono ink-3: `TUYẾN 01 · 15 MỐC`.
- **Bảng đề** (không card): mỗi hàng `border-top: 1px solid var(--line)`, padding `var(--s4)` 0, grid desktop:

```
| TÊN ĐỀ (1fr, Space Grotesk 17px) | NĂM | CÂU | PHÚT | DẢI ĐỘ DỐC | CTA |
                                    mono   mono  mono     96×28        ghost
                                     căn phải tabular, ink-3
```

- **Dải độ dốc (sparkline contour)**: SVG siêu nhỏ 96×28 trong chính hàng — đường độ khó từng câu của đề, 1px `var(--ink)` alpha .55, fill dưới đường alpha .06. Nguồn dữ liệu: `<ĐIỀN — trọng số phần/câu; nếu không có: đường tuyến tính theo thứ tự câu>`. Một màu mực duy nhất — **cấm tô màu theo độ khó**. Hover hàng → tooltip mono: `DỐC NHẤT · PHẦN TỰ LUẬN` hoặc `CÂU 44–50`.
- **Hover hàng (desktop)**: hàng mở thêm chiều cao (max-height transition 240ms `var(--ease-out)`) lộ mô tả đầy đủ + nguồn đầy đủ + nút primary accent `CẮM MỐC NÀY ▲`. Mobile (không hover): hàng đầu của tuyến mặc định mở, các hàng khác tap để mở; CTA luôn hiện trong phần mở. CTA dạng ghost ở hàng đóng: `M·N →` mono.
- **"+ Xem thêm" → tuyến tự kéo dài**: mỗi tuyến mặc định 5 hàng; nhấn `+ NÉT TIẾP (26)` (mono, accent) append 5 hàng nữa với Rise stagger 24ms; hết thì ẩn nhãn.

### 4. Mobile

- Rail màu chuyển thành vạch ngang 3px trên header tuyến; bảng sụp thành: tên đề (1 dòng, clamp) + hàng mono meta gọn + dải độ dốc phải; CTA theo phần mở.

## STATES

- **Dải năm không có đề**: như mục 2 (tuyến mờ + nhãn), không cần empty page riêng.
- **Đề thiếu dữ liệu độ khó**: dải độ dốc fallback đường tuyến tính — không ẩn cột.
- **Đang tải**: skeleton 5 hàng/tuyến, pulse 2.4s, đúng nhịp hàng thật.

## MOTION SPEC

Hàng Rise khi vào viewport (translateY 8px + fade, 300ms, stagger 24ms) · dải độ dốc draw-on 600ms mỗi hàng (IntersectionObserver .3) · mở hàng 240ms · thanh trượt năm không animation ngoài fill. Reduced-motion: mọi thứ trạng thái cuối ngay. Cấm: hover lift kiểu card, shadow, skeleton shimmer rainbow.

## COPY — ĐỔI CHỮ

| Cũ | Mới |
|---|---|
| Chọn đề thi | Chọn mốc để cắm. |
| Bắt đầu | CẮM MỐC NÀY ▲ |
| + Xem thêm (n đề) | + NÉT TIẾP (n) |
| Bắt đầu với một đề thi phù hợp... | Mỗi đề là một cột mốc trên tuyến... (sub mới ở mục 1) |

Tên đề, nguồn, số liệu: giữ nguyên nội dung gốc.

## A11Y & HIỆU NĂNG

- Thanh trượt năm là `<input type="range">` thật (2 cái = dải) hoặc role=slider kèm aria-valuetext `2018 đến 2025`; sparkline `aria-hidden`.
- Hàng đề điều hướng bằng thẻ `<a>`/`<button>` thật; focus-visible outline accent.
- Todo list: `<table>` không bắt buộc (hàng có tương tác mở), nhưng thứ tự DOM phải đọc được bằng screen reader: tên → meta → CTA.
- Ảnh/SVG inline không làm layout shift (đặt width/height dải độ dốc).

## CHECKLIST CHỐNG AI-GENERIC — tự rà trước khi báo xong

- [ ] Không một card nào giống hệt card nào; bảng hàng với border-top.
- [ ] Không chip filter; thanh trượt mốc năm đúng kiểu trắc địa.
- [ ] Logo nav là `VANTAGE ▲`; `∫Σ√π∞Δ` chỉ ở footer.
- [ ] Đúng 4 màu tuyến từ tokens; accent chỉ ở rail THPT + CTA primary + fill thanh trượt.
- [ ] Dải độ dốc một màu mực, 96×28, không trục, không màu-heat.
- [ ] Mọi số (năm/câu/phút) mono tabular căn phải.
- [ ] Hover hàng mở mượt; mobile tap mở được; không hàng nào mất CTA.
- [ ] **Nghiệm thu bằng mắt**: chụp 1440×900 (đầu trang / cuộn tới tuyến 3 / dark / filter thu hẹp) + 390×844; so với bản cũ song song.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo, in ra cấu trúc dữ liệu đề + nơi sinh độ khó cho dải độ dốc. Trình bày plan + file sẽ đụng; KHÔNG code tới khi tôi duyệt.
2. Implement theo thứ tự Đầu trang → Thanh năm → Một tuyến hoàn chỉnh (THPT) → nhân bản 3 tuyến → Mobile → States. Sau mỗi bước: build + chụp verify.
3. Kết thúc: production build, tự chấm checklist, danh sách copy thay đổi, mọi lệch spec kèm lý do.

Bắt đầu bằng bước 1.
