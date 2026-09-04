# 10 · HỆ THỐNG CỬA SỔ & BIÊN BẢN (MODAL SYSTEM OVERHAUL)
### Prompt end-to-end cho Claude Code · REDESIGN TOÀN BỘ MODAL TOÀN NỀN TẢNG
**Cách dùng:** Điền Context nếu cần, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Nhiệm vụ: redesign toàn bộ hệ thống **Modal / Dialog / Drawer / Sheet / Alert** trên toàn bộ các trang của Vantage theo design language "Vươn tới đỉnh cao" (đọc `vantage/design-system.html` — nguồn chân lý duy nhất v1.4.1).

Hiện tại, tất cả các modal trong hệ thống đang bị **"rập khuôn AI / SaaS generic"**:
1. Thẻ bo góc 20–24px `rounded-2xl` kiểu Tailwind template.
2. Nền mờ kính gradient lòe loẹt (`glass-elevated`, `backdrop-blur-sm`, radial glow tím/cam).
3. Emoji trong tiêu đề và nội dung (`📋`, `🏆`, `📝`, `🖼`, `✗`).
4. Ngôn ngữ giao diện mang tính kỹ thuật/phần mềm ("Bắt đầu", "Nộp bài?", "Tạm dừng") thay vì ngôn ngữ trắc địa ("Lệnh xuất phát", "Gấp bài thi", "Khóa đồng hồ đo cao").

**Giữ nguyên tuyệt đối:** logic state mở/đóng, form data, callback handlers, navigation transitions. Đây là UI/UX overhaul toàn diện cho tất cả dialogs/overlays.

## CONTEXT & DANH SÁCH MODAL CẦN THAY THẾ

| # | Modal | Trang / File Component | Vai trò trong Metaphor |
|---|---|---|---|
| 1 | **Lệnh Xuất Phát Mốc** (Exam Departure Gate) | `/exams` (`ExamSelect.tsx`) | Phiếu chuẩn bị xuất phát leo, chọn Thi Thật vs Ôn Luyện |
| 2 | **Biên Bản Chốt Bài & Gấp Giấy** (Submit Review) | `/test/:id` (`TestInterface.tsx`) | Bảng số liệu kiểm kê mốc đã cắm, cảnh báo trạm chưa làm |
| 3 | **Sổ Tay Công Thức Bỏ Túi** (Formula Pocket) | `/test/:id` (`TestInterface.tsx`) | Sổ tra cứu 2 cột KaTeX, thay thế bottom drawer giỏ hàng |
| 4 | **Trạm Tạm Dừng & Khóa Giờ** (Exam Paused) | `/test/:id` (`TestInterface.tsx`) | Màn hình khóa đồng hồ cơ học khi học sinh rời tab |
| 5 | **Phiếu Báo Sai Lệch Mốc** (Question Report) | `/test`, `/results`, `/concept` | Phiếu đính chính ấn bản in LaTeX / đáp án lệch chuẩn |
| 6 | **Chứng Chỉ Cắm Đỉnh** (Share Certificate) | `/results/:id` (`Results.tsx`) | Thẻ in kết quả trắc lượng tỉ lệ vàng có dấu niêm phong |
| 7 | **Đóng Sổ Hành Trình** (Reset History) | `/history` (`History.tsx`) | Biên bản cảnh báo xóa trắng mốc đã cắm trên sườn núi |
| 8 | **Cài Đặt Giám Sát Kỳ Thi** (Org Proctoring) | `/org/settings` (`ProctoringSettings.tsx`) | Phiếu điều phối cấp độ giám sát trắc lượng |

---

## MASTER SPEC CẤU TRÚC MODAL TRẮC ĐỊA (DÙNG CHUNG)

Mọi modal trong toàn bộ hệ thống phải tuân thủ nghiêm ngặt khung kiến trúc sau:

### 1. Backdrop Overlay (`.vtg-overlay`)
- `position: fixed; inset: 0; z-index: 50;`
- Nền tối trắc địa ấm: `background: rgba(18, 22, 31, 0.68); backdrop-filter: blur(6px);`
- Transition opacity 220ms `var(--ease-out)`. Nhấn vào ngoài khung modal tự động đóng (nếu không phải modal bắt buộc).

### 2. Khung Giấy Trắc Địa (`.vtg-modal`)
- Khối hộp: `background: var(--paper); border: 1px solid var(--line); border-radius: 8px;` (Cấm bo tròn 20px+).
- Gáy trên mực than: `position: relative;` với thanh trên cùng `height: 3px; background: var(--ink);`.
- Bóng đổ trắc địa nhẹ: `box-shadow: 0 20px 48px -12px rgba(0,0,0,0.35);`.
- Animation: `translateY(16px) -> 0`, fade in 240ms `cubic-bezier(0.22, 1, 0.36, 1)`.

### 3. Tiêu Đề Modal (`.vtg-modal-head`)
- Nền `var(--paper-2)`, viền đáy 1px `var(--line)`, padding 20px 24px 16px.
- Kicker mono uppercase 10.5px vermillion: `[TÊN TUYẾN / CHUYÊN ĐỀ / LOẠI BIÊN BẢN]`.
- Tiêu đề Space Grotesk 19px bold, tracking −0.01em, màu `--ink`.
- Nút đóng `✕` tinh gọn (không phải nút tròn nổi).

### 4. Thân Modal (`.vtg-modal-body`) & Bảng Dữ Liệu (`.vtg-ledger-table`)
- Mọi thông số số liệu (số câu, phút, trạm) **bắt buộc dùng bảng kỹ thuật 2 cột**:
  - Cột trái: Nhãn IBM Plex Mono uppercase `var(--ink-3)`.
  - Cột phải: Giá trị mono tabular căn phải `var(--ink)`.
- Các công thức toán 100% typeset qua KaTeX.

### 5. Thanh Hành Động (`.vtg-modal-foot`)
- Nền `var(--paper-2)`, viền trên 1px `var(--line)`, căn phải.
- Nút phụ (Ghost): viền 1px `var(--line)`, nền `var(--paper)`, chữ `--ink`.
- Nút chính (Primary CTA): nền `var(--accent)`, viền `var(--accent)`, chữ trắng giấy `--paper`, phông IBM Plex Mono 12.5px bold, kết thúc bằng ký tự `▲`.

---

## COPY — BẢNG ĐỔI CHỮ MODAL TOÀN HỆ THỐNG

| Cũ (SaaS Generic) | Mới (Ngôn ngữ Trắc Địa Vantage) |
|---|---|
| Chuẩn bị thi / Bắt đầu thi | LỆNH XUẤT PHÁT MỐC [M·ID] → CẮM MỐC XUẤT PHÁT ▲ |
| Nộp bài? / Còn câu chưa làm | GẤP GIẤY THI & CẮM ĐÍCH / CÒN TRẠM CHƯA CẮM MỐC |
| Xem bảng công thức | SỔ TRA CỨU CÔNG THỨC BỎ TÚI |
| Bài thi đã tạm dừng / Chuyển tab | TRẠM TẠM DỪNG · ĐỒNG HỒ ĐO CAO ĐÃ KHÓA |
| Báo cáo câu hỏi lỗi | PHIẾU BÁO SAI LỆCH TRẮC LƯỢNG |
| Chia sẻ kết quả / Kỷ lục cá nhân | CHỨNG CHỈ CẮM ĐỈNH / BIÊN BẢN TRẮC LƯỢNG M·ID |
| Xóa lịch sử thi | ĐÓNG SỔ HÀNH TRÌNH & XÓA MỐC ĐÃ CẮM |

---

## CHECKLIST NGHIỆM THU TẤT CẢ MODAL

- [ ] Toàn bộ 8 modal đều có gáy mực 3px trên đỉnh khung.
- [ ] Không có modal nào dùng bo tròn `rounded-2xl` hoặc `rounded-3xl` (chuẩn là 8px).
- [ ] Không có bất kỳ emoji nào trong toàn bộ tiêu đề, nút bấm hay nội dung modal.
- [ ] Mọi con số thống kê xếp theo dạng bảng Ledger 2 cột mono tabular.
- [ ] Phím `Escape` đóng toàn bộ modal trơn tru.
- [ ] Hoạt động hoàn hảo ở cả 2 theme: Giấy kem (`--paper: #F5F2EA`) và Đêm trắc địa (`--paper: #12161F`).
