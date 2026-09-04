# 05 · ĐẠI SỐ TUYẾN TÍNH — "MA TRẬN LÀ ĐỊA HÌNH"
### Prompt end-to-end cho Claude Code · `/linalg`
**Cách dùng:** điền placeholder `<...>` ở mục Context, copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Duyệt plan trước khi cho implement.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Redesign trang **đại số tuyến tính** (`/linalg`) của Vantage theo design language "Vươn tới đỉnh cao" (`vantage/design-system.html` — v1.4.1). Hiện trạng: 10 tab phép toán + lưới ô nhập generic + ô kết quả trống.

**Giữ nguyên tuyệt đối:** engine tính, tập 10 phép toán, độ chính xác. UI/UX redesign thuần. Mọi thay đổi copy liệt kê cuối báo cáo.

## CONTEXT

- Route: `<ĐIỀN>`
- 10 phép toán hiện có: `<ĐIỀN đủ tên>`
- Giới hạn kích thước ma trận hiện tại: `<ĐIỀN>`
- **Engine 3D để tái dùng**: code terrain của hero landing (`<ĐIỀN đường dẫn file/script>` — hàm `project()`, camera yaw/pitch lerp, fog theo độ sâu, đọc màu từ `--ink-rgb`/`--paper-rgb`/`--accent-rgb` tokens). **Clone logic này, cấm viết lại mò, cấm Three.js/WebGL.**
- Deploy: Cloudflare Pages; không thêm dependency.

## NORTH-STAR CONCEPT

**Ma trận không phải bảng số — ma trận là địa hình.** Giá trị từng ô = cao độ một nút lưới. Người dùng *nhìn thấy* phép toán thay vì đọc bảng khô: RREF là xới địa hình thành bậc thang; det ≈ 0 là địa hình sụp phẳng; eigenvectors là hai trục chính trên sườn.

Đây là màn duy nhất ngoài hero được phép dùng 3D — đúng quy tắc vàng: **chiều sâu chỉ xuất hiện khi nó LÀ metaphor**. Tự kiểm: ĐỊA HÌNH SỐNG · NHÌN THẤY PHÉP TOÁN. Nếu chỉ là form nhập + bảng kết quả + một đồ thị trang trí tách rời → sai, làm lại.

## SHELL & TOKENS — DÙNG CHUNG, CẤM SÁNG TÁC LẠI

- Đọc landing đã redesign: tokens, fonts, `--ease-out`, theme toggle, `VTG_REFRESH_COLORS` (canvas phải đăng ký hook này để đổi theme không cần reload). Chưa có → dừng và báo.
- Shell chung + `#bgField` fixed `100dvh` (rule CSS bắt buộc + sanity rect check) + footer chung.
- Cứng: không emoji; không gradient/glass/shadow lan; bo góc ≤16px; canvas đọc màu runtime từ `*-rgb` tokens, cấm hex cứng trong code canvas.

## SECTION-BY-SECTION SPEC

### 1. Đầu trang

Kicker `TRẠM · DỤNG CỤ · D·03`; H1 `Ma trận là địa hình.`; sub: *"Nhập một ma trận, nhìn nó dựng thành sườn núi. Mỗi phép toán là một cách xới địa hình."*

### 2. Layout 2 cột (desktop ≥900px): TRÁI = nhập liệu · PHẢI = địa hình sống

**Cột trái (~380px):**
- **Lưới ô nhập** (mặc định 3×3, tối đa 6×6 — xem quy tắc mesh mục 3): ô mono tabular 16px, nền giấy, `border: 1px solid var(--line-soft)`; ô đang focus viền `var(--accent)` 2px + caret accent; hover hàng/cột kẻ khung ink mờ. Ngoặc ma trận `[ ]` vẽ bằng SVG stroke 1.5px hai bên lưới — **chữ ký thị giác của công cụ**.
- Thêm/bớt hàng-cột: nút mono nhỏ `+ HÀNG` `− HÀNG` `+ CỘT` `− CỘT` đặt sát mép lưới (không phải button chrome mặc định).
- **Rail 10 phép toán**: danh sách dọc mono 13px `CỘNG · TRỪ · NHÂN · LŨY THỪA · CHUYỂN VỊ · NGHỊCH ĐẢO · ĐỊNH THỨC · HẠNG · RREF · EIGEN/SVD` — `<ĐIỀN đúng tập hiện có>`; chọn = gạch chân accent 2px; cấm tab bo tròn. Phép cần ma trận B (cộng/trừ/nhân) → lưới B trượt xuống dưới bằng height animation 240ms.
- Nút primary duy nhất: `XỚI ĐỊA HÌNH ▲` (hoặc Enter).

**Cột phải (co giãn):**
- Khung canvas theo đúng tỉ lệ hero card (~4:3), border 1px `var(--line)`, radius 16px, nền giấy. Corner mono 11px chỉ một nhãn: trên-trái `CAO ĐỘ = GIÁ TRỊ Ô · GRID n×n`.

### 3. Địa hình sống — SIGNATURE MOMENT

- **Dựng**: giá trị ô (clamp hiển thị về dải [−3, 3], ghi nhãn nếu clamp) → cao độ nút lưới terrain; mesh dùng đúng pipeline của hero (đường ngang alpha theo độ sâu, đường dọc thưa, fog, pitch cố định ~1.0 rad, con trỏ trong khung lái yaw ±0.12 lerp 0.045; không con trỏ → drift chậm `sin(t/6s)×0.08`).
- **Sống**: gõ số → terrain morph trực tiếp (debounce 150ms, lerp cao độ 0.2/frame). Reduced-motion → snap tức thì vẽ tĩnh.
- **Hành vi theo phép toán** (đây là chỗ "nhìn thấy phép toán"):
  - `RREF`: terrain morph 1200ms về địa hình của ma trận bậc thang — mắt thấy sườn "xẹp thành ruộng bậc thang".
  - `ĐỊNH THỨC` với |det| < 1e-9: nhãn accent trong khung `ĐỊA HÌNH SỤP PHẲNG — det ≈ 0` + mesh xẹp phẳng.
  - `EIGEN/SVD` (ma trận vuông 2×2/3×3): vẽ **hai trục chính** — stroke `var(--accent)` và `var(--altitude)` 2px đặt trên sườn + nhãn mono `λ₁`, `λ₂`.
  - Các phép còn lại: kết quả = ma trận mới → terrain morph sang địa hình mới.
- **Phiếu kết quả số** dưới canvas: mono tabular căn phải (`det = −14.000 · hạng = 3 · λ = …`) — người học vẫn cần số chính xác; terrain là cách *nhìn*, phiếu là cách *ghi*.
- **Guard kích thước**: mesh chỉ vẽ khi lưới ≤ 6×6. Lớn hơn → khung phải chuyển "phiếu số liệu" + dòng mono ink-3 `ĐỊA HÌNH CHỈ VẼ TỚI 6×6 — PHÉP ĐO LỚN HƠN ĐỌC Ở PHIẾU SỐ`. (Điều chỉnh ngưỡng theo giới hạn engine thật — ghi rõ lựa chọn trong báo cáo.)

### 4. Mobile (<900px)

Xếp chồng: rail phép toán thành rail cuộn ngang; lưới nhập full-width; địa hình dưới, tỉ lệ 4:3.

## STATES

- Ô nhập lỗi (ký tự lạ): ô viền `var(--accent-deep)` + mono 11px dưới lưới `Ô [2,3] CHƯA LÀ SỐ`.
- Ma trận suy biến cho phép đó (nghịch đảo khi det=0…): phiếu kết quả in mono `PHÉP XỚI NÀY KHÔNG XÁC ĐỊNH — det = 0` (không alert, không toast đỏ).
- Loading khi tính chậm: nút chuyển `ĐANG XỚI…` disabled.

## MOTION SPEC

Morph terrain lerp 0.2/frame · RREF/phép toán morph 1200ms `--ease-out` · trục eigen draw-on 600ms · lưới B slide 240ms. Reduced-motion: mọi morph snap; terrain một frame tĩnh; vẫn hover đọc nhãn. Hiệu năng: DPR ≤1.75; dừng rAF khi canvas khuất viewport/`document.hidden`.

## COPY — ĐỔI CHỮ

| Cũ | Mới |
|---|---|
| Đại số tuyến tính | Ma trận là địa hình. |
| Tính / Chạy | XỚI ĐỊA HÌNH ▲ |
| Kết quả | PHIẾU SỐ LIỆU |
| Ma trận khả nghịch/không khả nghịch | Địa hình dựng được / sụp phẳng — kèm số det |

## A11Y & HIỆU NĂNG

- Lưới ô nhập đi bằng phím (Tab qua ô, mũi tên càng tốt); mỗi ô có aria-label `hàng 2 cột 3`.
- Canvas `role="img"` + aria-label mô tả kết quả bằng chữ: *"Ma trận 3×3, định thức −14, hạng 3 — địa hình dựng đủ 3 sườn."*
- Rail phép toán là radio-group/tablist semantic; focus-visible outline accent.
- Terrain re-render khi đổi theme qua `VTG_REFRESH_COLORS` (đọc lại tokens, vẽ lại 1 frame nếu reduced-motion).

## CHECKLIST CHỐNG AI-GENERIC

- [ ] Không tab bo tròn; rail mono gạch chân accent.
- [ ] Ngoặc ma trận SVG kẻ tay hai bên lưới nhập — chữ ký có mặt.
- [ ] 3D dùng đúng engine hero (clone), không thư viện ngoài; màu từ tokens runtime.
- [ ] Người dùng nhìn THẤY: RREF = bậc thang; det≈0 = sụp phẳng; eigen = 2 trục màu. Nếu terrain chỉ "đẹp" mà không đổi theo phép toán → chưa xong.
- [ ] Phiếu số liệu mono tabular; không card kết quả bo góc.
- [ ] >6×6 có chế độ phiếu số + nhãn giải thích, không vỡ layout.
- [ ] **Nghiệm thu bằng mắt**: 1440×900 (rỗng / mesh 3×3 sống / RREF bậc thang / eigen có trục / dark) + 390×844.

## QUY TRÌNH LÀM VIỆC

1. Đọc repo: in ra 10 phép toán thật, giới hạn kích thước, và đường dẫn chính xác tới engine terrain của hero sẽ clone. Plan (kèm ngưỡng kích thước mesh đề xuất) → tôi duyệt → mới code.
2. Thứ tự: Lưới nhập + rail → Địa hình sống (morph theo gõ) → Hành vi theo phép (RREF → det → eigen) → Phiếu số → Mobile → States. Mỗi bước build + chụp verify.
3. Kết thúc: production build, tự chấm checklist, danh sách copy thay đổi, lệch spec kèm lý do.

Bắt đầu bằng bước 1.
