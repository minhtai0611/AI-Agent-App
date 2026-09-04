# VANTAGE — BỘ PROMPT OVERHAUL 7 MÀN + 1 POLISH PASS
### Dùng với Claude Code · khuôn giống `claude-code-prompt.md` (landing)
*Ngôn ngữ: GIẤY — MỰC — CỜ ĐỈNH v1.4.1 · Ngày: 2026-08-31*

---

## CÁCH DÙNG

1. Mở Claude Code tại root repo Vantage.
2. Mở file prompt cần làm, điền các placeholder `<...>` trong mục CONTEXT.
3. Copy toàn bộ khối sau đường kẻ (`---`) trong file đó, dán vào Claude Code.
4. Khi nó đề xuất plan: duyệt kỹ **dữ liệu nguồn** (map vào signature moment) và **những gì nó định CẮT** trước khi cho code.
5. Mỗi prompt đều ép quy trình: plan → duyệt → làm từng vùng → nghiệm thu bằng mắt. Đừng bỏ bước duyệt.

## ĐIỀU KIỆN TIÊN QUYẾT

- Landing redesign đã merge (tokens, fonts, shell, `#bgField`, hook `VTG_REFRESH_COLORS`
  đã tồn tại trong codebase). Nếu chưa — làm landing trước, các prompt này giả định
  shell đã có và CẤM sáng tác lại shell.
- `vantage/design-system.html` nằm trong repo (nguồn chân lý duy nhất).

## THỨ TỰ THỰC HIỆN

| # | File | Màn | Vì sao ở vị trí này |
|---|---|---|---|
| 1 | `01-ket-qua-thi.md` | `/results/:id` — Biên bản mốc | Giá trị nghệ thuật lớn nhất; nơi người dùng chụp màn hình chia sẻ |
| 2 | `02-chon-de.md` | `/exams` — Trạm chọn đề | Cửa ngõ traffic, mùi template nồng nhất |
| 3 | `06-xac-suat-mo-phong.md` | `/probability` — Thung lũng hội tụ | Màn trình diễn chữ ký, làm sớm để giữ lửa |
| 4 | `03-lich-su.md` | `/history` — Nhật ký hành trình | Gắn dữ liệu người dùng, nối với trang kết quả đã đẹp |
| 5 | `04-may-tinh-cas.md` | `/calculator` — Đồng hồ đo cao | Tái cấu trúc form, typeset bước giải |
| 6 | `05-dai-so-tuyen-tinh.md` | `/linalg` — Ma trận là địa hình | To nhất; tái dùng engine 3D của hero |
| 7 | `07-playground.md` | `/playground` — Sổ phác trắc địa | Engine tốt sẵn, chủ yếu là chất liệu hiển thị |
| 8 | `08-hero-polish-pass.md` | Hero landing | Chạy bất kỳ lúc nào; độc lập với 7 màn |

## BA KỶ LUẬT XUYÊN SUỐT (nhắc bản thân mỗi lần duyệt)

1. **Một màn = một signature moment.** Trang nào có 2 cái "hay ho" trở lên là đang
   quá tải — cắt bớt. Trang kết quả có mặt cắt địa hình thì bản đồ chuyên đề chỉ được
   là bảng số liệu yên tĩnh.
2. **Pass cắt 30%.** Sau khi Claude Code build xong một vùng, rà từng phần tử:
   "bỏ nó đi, màn có mất ý không?" — không mất thì bỏ. AI mặc định luôn THÊM.
3. **Nghiệm thu bằng mắt, không bằng smoke test.** Chụp 1440×900 ở 4 trạng thái
   (đầu trang / cuộn sâu / dark / reduced-motion hoặc empty-error). So song song
   bản cũ — mắt bạn mới là điều kiện ship cuối cùng.

## SAU 7 MÀN NÀY

Còn một màn lớn chưa có prompt: **màn làm bài thi** (nơi người dùng ngồi 90 phút).
Đó là prompt tiếp theo cần viết — khi đó trải nghiệm leo núi mới khép kín:
trạm chọn đề → sườn làm bài → biên bản mốc → nhật ký hành trình.
