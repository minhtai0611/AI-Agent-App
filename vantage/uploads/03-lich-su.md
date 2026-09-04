# 03 · TRANG LỊCH SỬ — "NHẬT KÝ HÀNH TRÌNH · SỔ LEO NÚI"
### Prompt end-to-end cho Claude Code · `/history`
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Redesign trang **lịch sử làm bài** (`/history`) của Vantage theo design language "Vươn tới đỉnh cao" (đọc `vantage/design-system.html` — v1.4.1). Hiện trạng: một câu chữ + emoji 📝 khi rỗng, danh sách generic khi có dữ liệu. Trang này phải kể được **câu chuyện tiến bộ** của chính người dùng.

**Giữ nguyên tuyệt đối:** nguồn dữ liệu lịch sử, liên kết tới từng kết quả. UI/UX redesign thuần. Mọi thay đổi copy liệt kê cuối báo cáo.

## CONTEXT

- Route cần redesign: `<ĐIỀN>`
- Dữ liệu mỗi lần thi: `<ĐIỀN: id kết quả, đề, điểm, thời gian làm, ngày làm; có group theo đề được không?>`
- Deploy: Cloudflare Pages; không thêm dependency; biểu đồ tự vẽ SVG thuần, **cấm chart library**.

## NORTH-STAR CONCEPT

**Cuốn sổ leo núi của người trắc địa.** Lịch sử không phải "danh sách giao dịch" — là nhật ký trắc lượng: mỗi lần thi là một số đo trên sườn; cùng đo một sườn nhiều lần thì vẽ thành đường zíc-zắc (switchback). Khi sổ còn trắng, trang phải đẹp như khi sổ đầy.

Tự kiểm: NHẬT KÝ · TIẾN BỘ NHÌN THẤY ĐƯỢC · TRUNG THỰC. Nếu trông như order history của sàn TMĐT → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens, fonts, `--ease-out`, theme toggle, `VTG_REFRESH_COLORS`. Chưa có tokens trong codebase → dừng, báo ngay.
- Shell chung: wordmark `VANTAGE ▲`, nav chung, `#bgField` fixed `100dvh` (rule CSS bắt buộc + sanity check rect == viewport), footer `GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ`.
- Cứng: không emoji (xóa 📝 hiện tại là ưu tiên số một); không gradient/glass/shadow lan; bo góc ≤16px; màu qua `var()`.

## SECTION-BY-SECTION SPEC

Layout một cột editorial max-width 880px, nhịp `--s8`.

### 1. Đầu trang

- Kicker mono `TRẠM · NHẬT KÝ`; H1 `Sổ leo núi của bạn.` (Space Grotesk 39px); sub ≤60ch: *"Mỗi lần thi là một số đo. Sườn nào càng leo lại, đường zíc-zắc càng rõ."*
- Phải cùng hàng (desktop): phiếu mono nhanh `TỔNG <n> MỐC · CAO NHẤT <x.xx>Đ`.

### 2. EMPTY STATE — làm ĐẦU TIÊN, coi như một thiết kế chính thức (không phải nội dung thay thế)

- Trung tâm: **cờ kẻ tay SVG** (cột 48px, cờ tam giác accent — tái dùng icon "Đỉnh/Mục tiêu" của design system ở cỡ lớn, stroke 1.5px), trên khung giấy sạch, không nền phụ.
- Dòng chính Space Grotesk 20px: `Sổ còn trắng — cột mốc đầu tiên chưa được cắm.`
- Dòng phụ ink-2: *"Chọn một đề ở trạm, làm hết mình. Trang này sẽ tự ghi lại."*
- Một CTA primary: `VỀ TRẠM CHỌN ĐỀ →`. Không gì thêm. Không emoji, không minh họa stock.

### 3. MẶT CẮT ĐỘ CAO — signature moment (chỉ vẽ khi ≥ 2 lần thi)

- SVG viewBox ~880×240, giấy sạch. Trục hoành = thời gian (vạch tháng mono `T7 · T8 · T9`); trục tung = điểm 0–10 (3 vạch mono `0 · 5 · 10` + gridline `var(--line-soft)`).
- **Đường hành trình**: polyline mượt qua mọi lần thi theo thời gian, 1.5px `var(--accent)`; mỗi lần thi = marker vòng stroke accent + tâm đặc 4px.
- **Switchback**: các lần thi CÙNG MỘT ĐỀ nối thêm bằng đường đứt nét `var(--altitude)` (dash 4 3) + nhãn mono nhỏ `LEO LẠI +0.50` ở đoạn dốc lên / `−0.50` ink-3 khi tụt. Đây là chi tiết kể chuyện: ai cũng nhìn ra "leo lại cùng sườn".
- Hover/tap marker → chip mono `M·07 · ĐỀ HÀ NỘI 2025 · 7.75Đ · 82/90′`; click → trang kết quả tương ứng.
- Motion: draw-on 1200ms trái→phải; markers stagger 40ms; reduced-motion vẽ tĩnh.
- `role="img"` + aria-label: *"12 lần thi từ tháng 7 đến tháng 9, điểm từ 6.5 lên 7.75."*

### 4. Chỉ 1 lần thi duy nhất → "MỐC ĐẦU TIÊN"

- Không vẽ biểu đồ. Một khối trang trọng: điểm số Space Grotesk 61px + phiếu mono (đề, thời gian, ngày) + cờ đỉnh nhỏ + dòng mono ink-3 `MỐC ĐẦU TIÊN — SƯỜN MỚI BẮT ĐẦU HIỆN HÌNH` + CTA ghost `LEO TIẾP ĐỂ VẼ SƯỜN →` (về `/exams`).

### 5. SỔ NHẬT KÝ — danh sách dưới biểu đồ

- Nhóm theo tháng: header nhóm mono ink-3 `THÁNG 8 · 2026` + border-top 1px; không có border-bottom cuối.
- Mỗi lần thi = một hàng đọc như dòng sổ tay, mono tabular, căn phải số:

```
M·07 · ĐỀ THI THỬ HÀ NỘI 2025     7.75Đ · 82/90 PHÚT      ▲ +0.50 SO LẦN TRƯỚC
```

(`▲+` accent khi tiến bộ, `▼−` ink-3 khi tụt, `·` khi lần đầu làm đề đó.)
- Hàng: `border-top: 1px solid var(--line)`; hover nền `var(--paper-2)`; toàn hàng click vào `/results/:id`; focus-visible outline accent.
- > 30 lần thi: `+ NÉT TIẾP` append 15 dòng (hoặc ẩn tháng cũ sau toggle) — không pagination kiểu số trang.

## STATES

- Loading: skeleton pulse 2.4s đúng nhịp (1 khung biểu đồ + 6 dòng).
- Lỗi tải dữ liệu: dòng mono ink-3 + nút thử lại; không màn trắng.
- Không có liên kết kết quả (kết quả đã xóa): hàng vẫn hiện, click mờ + nhãn `MỐC ĐÃ XÓA`.

## MOTION SPEC

Draw-on biểu đồ 1200ms · markers stagger 40ms · hàng Rise 300ms stagger 24ms · hover nền 160ms. Reduced-motion: trạng thái cuối ngay. Cấm: animation lặp, confetti khi điểm cao, tooltip bounce.

## COPY — ĐỔI CHỮ

| Cũ | Mới |
|---|---|
| Lịch sử | Sổ leo núi của bạn. |
| Bạn chưa làm bài thi nào... 📝 | Sổ còn trắng — cột mốc đầu tiên chưa được cắm. |
| Bắt đầu thi thử | VỀ TRẠM CHỌN ĐỀ → |
| Xem lại | (toàn hàng là link; không cần nhãn riêng) |

## A11Y & HIỆU NĂNG

- Biểu đồ có text fallback/aria-label tóm tắt; markers focusable, Enter vào kết quả.
- Danh sách nhóm theo tháng dùng heading thật (`<h3>` mono styled) để screen reader có mốc.
- Hàng là `<a>` thật; không `div onclick`.
- Trang hoạt động khi JS tắt: danh sách render sẵn; biểu đồ là SVG inline tĩnh.

## CHECKLIST CHỐNG AI-GENERIC

- [ ] Zero emoji trong DOM (grep kiểm chứng); empty state là cờ SVG kẻ tay.
- [ ] Không card/list-item generic bo góc + shadow; hàng sổ tay border-top mono.
- [ ] Biểu đồ tự vẽ: 1 đường accent + switchback đứt nét altitude; không chart library default look.
- [ ] Số mono tabular căn phải; ▲/▼ dùng glyph mực, không icon màu sặc.
- [ ] 3 mật độ đều đẹp: rỗng / 1 lần / nhiều lần — chụp đủ cả 3.
- [ ] Dark mode: biểu đồ đổi màu theo tokens không reload.
- [ ] **Nghiệm thu bằng mắt**: 1440×900 × (rỗng / nhiều dữ liệu / dark / reduced-motion) + 390×844; so song song bản cũ.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo, in ra shape dữ liệu lịch sử + cách group cùng đề (cho switchback). Plan → tôi duyệt → mới code.
2. Thứ tự: Empty state → Sổ nhật ký (dữ liệu giả 12 dòng) → Mặt cắt độ cao → Mốc đầu tiên → States. Mỗi bước build + chụp verify.
3. Kết thúc: production build, tự chấm checklist, danh sách copy thay đổi, lệch spec kèm lý do.

Bắt đầu bằng bước 1.
