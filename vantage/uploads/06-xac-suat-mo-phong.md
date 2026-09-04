# 06 · XÁC SUẤT & MÔ PHỎNG — "THUNG LŨNG HỘI TỤ"
### Prompt end-to-end cho Claude Code · `/probability`
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Redesign trang **xác suất & mô phỏng** (`/probability`) của Vantage theo design language "Vươn tới đỉnh cao" (`vantage/design-system.html` — v1.4.1). Hiện trạng: hai ô số + nút "Chạy mô phỏng" — trang thưa nhất toàn app, và vì thế là cơ hội nghệ thuật lớn nhất.

**Giữ nguyên tuyệt đối:** engine mô phỏng/thống kê hiện có. UI/UX redesign thuần. Mọi thay đổi copy liệt kê cuối báo cáo.

## CONTEXT

- Route: `<ĐIỀN>`
- Các thí nghiệm mô phỏng hiện có: `<ĐIỀN: tung đồng xu / xúc xắc / phân phối tùy chọn… — liệt kê đủ + tham số của từng loại>`
- Deploy: Cloudflare Pages; không thêm dependency; **cấm chart library** — cồn cát tự vẽ bằng `<canvas>` 2D.

## NORTH-STAR CONCEPT

**Thung lũng hội tụ.** Mỗi lần gieo là **một hạt cát rơi** xuống thung lũng; cồn cát dâng dần thành hình. Sau đủ nhiều lần gieo, **định lý giới hạn trung tâm tự vẽ ra một ngọn đồi** — histogram tích lũy *là* địa hình, đường lý thuyết là tuyến đỏ trải trên đồi. Toán học và metaphor trùng nhau hoàn toàn: đây là trang sẽ khiến người xem dừng lại.

Tự kiểm: MESMERIZING NHƯNG KỶ LUẬT · TOÁN TỰ HIỆN HÌNH · MỘT MÀN MỘT Ý. Cấm biến nó thành "particle playground" — hạt chỉ rơi khi người dùng gieo; không có gì trôi nổi vô nghĩa.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens, fonts, `--ease-out`, theme toggle, `VTG_REFRESH_COLORS` (canvas đăng ký hook, đổi theme không reload). Chưa có → dừng và báo.
- Shell chung + `#bgField` fixed `100dvh` (rule CSS bắt buộc + sanity rect check) + footer chung.
- Cứng: không emoji; không gradient/glass/shadow lan; bo góc ≤16px; màu canvas đọc runtime từ `*-rgb` tokens, cấm hex cứng.

## SECTION-BY-SECTION SPEC

### 1. Đầu trang

Kicker mono `TRẠM · DỤNG CỤ · D·05`; H1 `Thung lũng hội tụ.`; sub ≤60ch: *"Gieo từng hạt cát. Sau vài nghìn lần, ngọn đồi tự hiện hình — đó là định lý giới hạn trung tâm, nhìn bằng mắt."*

### 2. Sân khấu — SIGNATURE MOMENT: cồn cát dâng

Một `<canvas>` 2D lớn (tỉ lệ ~21:9, min-height 320px), border 1px `var(--line)`, radius 16px, nền giấy + vạch chia y nhạt mono (`n` đếm ở vạch trái):

- **Bins**: số cột theo thí nghiệm (đồng xu: 2 · xúc xắc: 6 · tổng 2 xúc xắc: 11 · tùy chọn: số trạng thái). Trục hoành nhãn mono giá trị mỗi cột.
- **Hạt rơi**: mỗi trial → lấy kết quả, thả một chấm tròn 3px (fill `var(--ink)` alpha .55) từ đỉnh canvas vào đúng cột: rơi theo parabol/ease-in (~420ms), **không bounce, không elastic** (kỷ luật motion của hệ); hạt đáp vào đỉnh cồn của cột và **nằm lại** (trở thành một phần cồn cát, fill chuyển alpha .35 để cồn đọc như một khối).
- **Cồn cát = histogram**: khi số trial lớn, không vẽ từng hạt nữa — cột dâng lên như mặt cồn (rect stack có mép trên hơi ngấm). Ngưỡng chuyển: <300 hạt vẽ rời; ≥300 vẽ khối. Khi tổng vượt chiều cao canvas: **y-scale morph** mượt 300ms (toàn bộ cồn co xuống tỉ lệ, nhãn vạch trục đổi theo).
- **Tuyến đỏ = lý thuyết**: đường phân phối chuẩn/nhị thức chuẩn hóa theo cồn, stroke `var(--accent)` 2px dash `4 3`; **draw-on 1200ms một lần** khi `n ≥ 100` lần đầu (hoặc toggle `TUYẾN LÝ THUYẾT` mặc định bật). Tuyến nằm TRÊN cồn cát — đúng ngôn ngữ "đường leo trên đồi".
- **Nhãn trắc lượng** mono 11px góc phải-trên canvas: `n = 10.000 · μ = 7.00 · σ = 2.41 · TUYẾN ĐỎ = LÝ THUYẾT`.
- Tốc độ gieo: ×1 (nhìn rõ hạt rơi) · ×100 (mưa hạt ~30/s, cột dâng thấy rõ) · ×1000 (gần như tức thì, cồn dâng trong ~1s). Không chạy vô hạn — người dùng chủ động từng đợt gieo.

### 3. Bàn điều khiển (dưới sân khấu, một hàng gọn)

- **Chọn thí nghiệm**: rail mono gạch chân (không chip/tab bo tròn): `ĐỒNG XU · XÚC XẮC · TỔNG 2 XÚC XẮC · TÙY CHỈNH p` — `<ĐIỀN theo engine thật>`. Chọn lại → reset cồn (xác nhận nếu n > 1000).
- **Nút gieo**: primary accent `GIEO ×1000 ▲` + hai ghost `×1` `×100` + ghost ink-3 `DỌN THUNG LŨNG` (reset).
- Tùy chọn p (khi chọn TÙY CHỈNH): một thanh trượt mono kiểu trắc địa (giống thanh năm ở `/exams`), nhãn `p = 0.35`.

### 4. Phiếu đối chiếu (dưới bàn điều khiển)

Bảng mono tabular căn phải, 2 cột `MÔ PHỎNG | LÝ THUYẾT`, 3 hàng: `μ (TRUNG BÌNH)` · `σ (ĐỘ LỆCH)` · `SAI KHÁC CHUẨN` (%). Hàng sai khác giá trị màu `var(--pine)` khi < 2%, `var(--accent)` khi ≥ 2% — con số *tự nói* sự hội tụ. **Không vẽ thêm biểu đồ nào khác — trang có đúng một signature moment.**

### 5. Dòng kết — chân trang nội dung

Một dòng mono ink-3 giữa cột: `ĐỊNH LÝ GIỚI HẠN TRUNG TÂM — HẠT NÀO CŨNG RƠI NGẪU NHIÊN, CỒN NÀO CŨNG DÂNG THÀNH ĐỒI.` (Không blockquote trang trí, không minh họa thêm.)

## STATES

- Chưa gieo lần nào: sân khấu trống + dòng mono mờ đặt giữa đáy: `THUNG LŨNG ĐANG PHẲNG — GIEO HẠT ĐẦU TIÊN`.
- Reduced-motion: không hạt rơi; bấm gieo ×n → cồn và tuyến đỏ render ngay trạng thái cuối sau 1 frame.
- Đổi theme: canvas đọc lại tokens, vẽ lại frame hiện tại không mất dữ liệu.

## MOTION SPEC

Hạt rơi 420ms ease-in (đọc `*--ease-out*` cho phần cuối đáp) · y-scale morph 300ms · tuyến đỏ draw-on 1200ms · nhãn số `n` count-up mono theo lô. DPR ≤1.75; dừng rAF khi `document.hidden` hoặc canvas khuất viewport (IntersectionObserver .08). Reduced-motion: trạng thái cuối ngay. Cấm: particle field ambient, confetti, shaker, bounce.

## COPY — ĐỔI CHỮ

| Cũ | Mới |
|---|---|
| Xác suất & mô phỏng | Thung lũng hội tụ. |
| Chạy mô phỏng | GIEO ×1000 ▲ |
| Số lần lặp / Số mẫu | Hạt cần gieo |
| Reset / Xóa | Dọn thung lũng |
| Đường lý thuyết (legend) | Tuyến đỏ = lý thuyết |

## A11Y & HIỆU NĂNG

- Canvas `role="img"` + aria-label sống: *"Đã gieo 10.000 hạt, trung bình mẫu 7.02 so lý thuyết 7.00"* — cập nhật mỗi lô gieo (aria-live="polite", tần suất ≤1 lần/giây).
- Bảng đối chiếu là `<table>` thật; nút gieo focus-visible outline accent; space/enter kích hoạt được.
- Vòng lặp rơi đáp 60fps tới DPR 1.75 trên laptop tầm trung với ×100 (tự đo DevTools trước khi báo xong); dữ liệu tính xong rồi mới animate — không tính trong frame rơi.
- Không layout shift: canvas có kích thước cố định theo aspect-ratio CSS.

## CHECKLIST CHỐNG AI-GENERIC

- [ ] Không chart library; hạt và cồn tự vẽ canvas 2D.
- [ ] Hạt chỉ rơi khi người dùng gieo (không particle vô nghĩa); không bounce/elastic.
- [ ] Đúng một signature moment: cồn cát + tuyến đỏ. Phiếu đối chiếu yên tĩnh bằng số.
- [ ] Accent chỉ ở: tuyến lý thuyết, nút gieo primary, gạch chân rail, số sai khác ≥2%.
- [ ] Toggle tuyến lý thuyết đúng dash `4 3`, draw-on một lần khi n≥100.
- [ ] Reduced-motion render frame cuối; dark mode đổi màu không reload; thung lũng không mất dữ liệu khi đổi theme.
- [ ] **Nghiệm thu bằng mắt**: 1440×900 (thung lũng phẳng / đang mưa hạt ×100 / n=10.000 có tuyến đỏ / dark) + 390×844 + quay một clip 5s cho chính mình xem lại — cồn dâng phải "gây mê" mà vẫn sạch.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo: in ra các thí nghiệm engine hỗ trợ + phân phối lý thuyết tương ứng từng loại. Plan → tôi duyệt → mới code.
2. Thứ tự: Sân khấu + cồn cát ×1 → ×100/×1000 + y-scale morph → tuyến lý thuyết → bàn điều khiển + phiếu đối chiếu → states/reduced-motion/dark. Mỗi bước build + chụp verify (kèm clip ngắn cho bước hạt rơi).
3. Kết thúc: production build, tự chấm checklist, danh sách copy thay đổi, lệch spec kèm lý do.

Bắt đầu bằng bước 1.
