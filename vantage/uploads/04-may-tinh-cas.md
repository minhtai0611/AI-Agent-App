# 04 · MÁY TÍNH CAS — "ĐỒNG HỒ ĐO CAO · DỤNG CỤ CỦA NGƯỜI LEO NÚI"
### Prompt end-to-end cho Claude Code · `/calculator`
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Redesign trang **máy tính CAS** (`/calculator`) của Vantage theo design language "Vươn tới đỉnh cao" (`vantage/design-system.html` — v1.4.1). Hiện trạng: 6 tab form + hệ phương trình + số phức xếp thành kho, vùng kết quả in thô, nút "Kiểm tra với máy chủ" lộ kỹ thuật.

**Giữ nguyên tuyệt đối:** engine giải toán, tập phép toán, độ chính xác kết quả. UI/UX redesign thuần. Mọi thay đổi copy liệt kê cuối báo cáo.

## CONTEXT

- Route: `<ĐIỀN>`
- Danh sách phép toán hiện có: `<ĐIỀN: 6 phép giải tích + hệ PT + số phức... — liệt kê đủ>`
- Cú pháp input hiện tại: `<ĐIỀN: dạng text tự do? từng trường riêng từng phép? đã có parser nào?>`
- KaTeX: đã có trong app.
- Deploy: Cloudflare Pages; không thêm dependency.

## NORTH-STAR CONCEPT

**Mặt đồng hồ đo cao / la bàn của người leo núi**: một dụng cụ duy nhất, một mặt kính, vòng chia độ chạy quanh. Người dùng không "điền form" — họ **đưa một biểu thức lên mặt kính và đọc kết quả được typeset như trang sách**.

Chất liệu nghệ thuật lớn nhất của trang = **toán học được trình bày đẹp**: kết quả và từng bước biến đổi qua KaTeX, in như giáo trình hay. Tự kiểm: DỤNG CỤ · TẬP TRUNG · CHỮ TOÁN ĐẸP. Nếu trông như admin form nhiều tab → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens, fonts, `--ease-out`, theme toggle, `VTG_REFRESH_COLORS`. Chưa có → dừng và báo.
- Shell chung: wordmark `VANTAGE ▲`, nav chung, `#bgField` fixed `100dvh` (rule CSS bắt buộc + sanity rect check), footer chung.
- Cứng: không emoji; không gradient/glass/shadow lan; bo góc ≤16px; màu qua `var()`.

## SECTION-BY-SECTION SPEC

Layout: cột giữa max-width 760px — như mặt dụng cụ đặt giữa khung; mọi thứ tập trung, không rải ngang.

### 1. Đầu trang

- Kicker mono `TRẠM · DỤNG CỤ · D·02`; H1 `Đồng hồ đo cao.`; sub một dòng: *"Gõ biểu thức, đọc kết quả và từng bước biến đổi — như cách máy "nghĩ", không chỉ đáp số."*

### 2. Mặt kính — MỘT Ô NHẬP DUY NHẤT ở trung tâm

- **Bỏ toàn bộ 6 tab form.** Một ô nhập lớn (mono 18–20px, padding s5, `border: 1px solid var(--line)`, focus viền `var(--accent)` 2px), placeholder mờ: `ví dụ: lim(x→0) sin(x)/x · ∫x² dx · det [[1,2],[3,4]]…`
- **Preview KaTeX sống** ngay dưới ô (debounce 120ms): biểu thức render đẹp khi gõ; lỗi cú pháp → preview mờ + dòng mono `var(--accent-deep)`: `MỰC CHƯA ĐỌC ĐƯỢC DÒNG NÀY — kiểm tra dấu và ngoặc`.
- Enter = đo. Giữ một nút primary duy nhất cạnh ô: `ĐO ▲`.

### 3. Rail phép toán — vòng chia độ quanh mặt kính

- Rail ngang mono 13px trên ô nhập (desktop; mobile thành rail cuộn ngang): `∂ ĐẠO HÀM · ∫ TÍCH PHÂN · lim GIỚI HẠN · Σ TỔNG/DÃY · TAYLOR · ODE · HỆ PT · SỐ PHỨC` — `<ĐIỀN đúng tập phép hiện có>`.
- Chọn một phép = gạch chân accent 2px + đổi placeholder thành ví dụ của phép đó; **cấm tab bo tròn/nền chip**.
- Khi parser tự nhận diện được phép từ biểu thức gõ tự do → rail tự nhảy gạch chân tới phép đó (chip mono nhỏ `TỰ NHẬN DIỆN: ∫`). Nếu parser không nhận diện được (hiện tại) → rail đóng vai chọn chế độ, ghi rõ trong plan thay vì sáng tác mới.

### 4. Kết quả — trang sách, không phải console

- **Đáp số**: KaTeX cỡ lớn (28–34px), căn trái, đường kẻ 2px ink phía trên.
- **Chuỗi bước biến đổi = các nhịp leo**: mỗi bước một dòng `= …` KaTeX 20px; lề phải/trái by-line ink-3 mờ giải thích bằng lời (*"quy tắc L'Hôpital"*, *"chia tử và mẫu cho x"*). Bước Rise stagger 80ms.
- Nếu engine chỉ trả đáp số không có steps hiện nay: `<ĐIỀN>` — khi thiếu steps, hiển thị đáp số + by-line yên tĩnh `NHỊP LEO CHI TIẾT ĐANG ĐƯỢC HOÀN THIỆN CHO PHÉP NÀY`; KHÔNG bịa steps.
- **Bỏ nút "Kiểm tra với máy chủ".** Thay bằng badge mono tĩnh 11px góc vùng kết quả: `ĐỐI CHIẾU: ENGINE NỘI BỘ ✓` (pine) hoặc `ENGINE NGOÀI ✓` — trạng thái tĩnh, tin cậy, giấu cơ chế.

### 5. Nhật ký dụng cụ (dưới mặt kính)

- 5 phép tính gần nhất (localStorage nếu app đã lưu; `<ĐIỀN nếu chưa có>`): mỗi dòng mono 13px — biểu thức (truncate 40ch) → kết quả mờ · click nạp lại vào ô nhập. Header mono ink-3 `NHẬT KÝ DỤNG CỤ`. Trống → ẩn cả mục (không empty state riêng).

## STATES

- Input rỗng: vùng kết quả là dòng mono mờ `ĐƯA BIỂU THỨC LÊN MẶT KÍNH…` (không card "Kết quả sẽ hiện ở đây").
- Đang tính: nút `ĐO ▲` chuyển `ĐANG ĐO…` disabled 300–600ms; không spinner xoay.
- Engine lỗi/không giải được: mono accent-deep `PHÉP ĐO NÀY NGOÀI TẦM DỤNG CỤ — THỬ VIẾT DẠNG KHÁC`.

## MOTION SPEC

Preview KaTeX cập nhật mượt (không flicker: giữ kết quả cũ tới khi render mới xong) · Rise đáp số 380ms · steps stagger 80ms · rail gạch chân quét 200ms theo `--ease-out`. Reduced-motion: cập nhật tức thì, không stagger. Cấm: animation số nhảy nhảy ký tự, typing effect.

## COPY — ĐỔI CHỮ

| Cũ | Mới |
|---|---|
| Máy tính CAS | Đồng hồ đo cao. |
| Tính / Giải | ĐO ▲ |
| Kết quả | (không nhãn; đường kẻ 2px + đáp số tự nói) |
| Kiểm tra với máy chủ | ĐỐI CHIẾU: ENGINE NỘI BỘ ✓ (badge tĩnh) |
| Lỗi cú pháp | Mực chưa đọc được dòng này — kiểm tra dấu và ngoặc |

## A11Y & HIỆU NĂNG

- Ô nhập `<label>` thật; rail là `role="tablist"` hoặc radio-group semantic; Enter submit từ bất kỳ đâu trong form.
- KaTeX có fallback text (aria) cho biểu thức; contrast dark mode kiểm chứng.
- Debounce render ≤120ms; không block main thread quá 16ms khi gõ.

## CHECKLIST CHỐNG AI-GENERIC

- [ ] Không còn 1 tab bo tròn nào; rail mono gạch chân.
- [ ] Một ô nhập trung tâm — không còn "kho form".
- [ ] Không nút "Kiểm tra với máy chủ"; badge tĩnh thay thế.
- [ ] Đáp số + steps là KaTeX typeset; zero text thô kiểu `sqrt(x)/2` trên vùng kết quả.
- [ ] Accent chỉ ở: focus viền, gạch chân rail, nút ĐO, chữ lỗi (deep). Đếm ≤5% diện tích.
- [ ] **Nghiệm thu bằng mắt**: 1440×900 (đầu / có kết quả nhiều bước / lỗi cú pháp / dark) + 390×844; so song song bản cũ.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo: in ra tập phép toán thật, cơ chế nhận input hiện tại (tự do hay theo trường), engine trả steps hay chỉ đáp số. Plan → tôi duyệt → mới code. **Quyết định then chốt cần tôi duyệt: ô nhập tự do duy nhất có khả thi với parser hiện có không, hay giữ chọn phép ở rail nhưng gộp input lại.**
2. Thứ tự: Mặt kính + preview → Rail → Kết quả/steps → Nhật ký dụng cụ → States. Mỗi bước build + chụp verify.
3. Kết thúc: production build, tự chấm checklist, danh sách copy thay đổi, lệch spec kèm lý do.

Bắt đầu bằng bước 1.
