# VANTAGE REDESIGN — Prompt end-to-end cho Claude Code

**Cách dùng:**
1. Mở Claude Code tại root repo của Vantage.
2. Điền 2 placeholder `<...>` trong mục Context (stack + đường dẫn trang hiện tại).
3. Copy toàn bộ khối bên dưới đường kẻ (`---`) và dán vào Claude Code.
4. Khi Claude Code đề xuất plan, duyệt kỹ phần **tokens** và **section spec** trước khi cho implement.

> Mẹo vận hành: yêu cầu Claude Code làm theo 2 pha — **Pha 1: foundation** (tokens, fonts, reset, icon set) rồi dừng lại cho bạn review; **Pha 2: từng section** (hero → stats → features → FAQ → CTA → footer), mỗi section xong chạy dev server để bạn xem. Không cho làm một lèo toàn bộ.

---
---

## VAI TRÒ & MỤC TIÊU

Bạn là senior product designer + front-end engineer. Nhiệm vụ: thiết kế lại toàn bộ giao diện landing page của **Vantage** — nền tảng ôn thi Toán THPT & tuyển sinh lớp 10 (Việt Nam) — theo design language "Vươn tới đỉnh cao" được mô tả đầy đủ dưới đây.

**Giữ nguyên tuyệt đối:** toàn bộ logic, routes, dữ liệu đề thi, luồng chức năng hiện có. Đây là UI/UX redesign, không phải rewrite. Nội dung tiếng Việt giữ nguyên thông điệp, chỉ được tinh chỉnh nhãn cho khớp design language (ghi chú mọi thay đổi copy vào cuối báo cáo).

## CONTEXT

- Framework/stack hiện tại: `<ĐIỀN: ví dụ Next.js 14 + Tailwind, hoặc HTML tĩnh + Cloudflare Pages>`
- File/route landing cần redesign: `<ĐIỀN: ví dụ app/page.tsx hoặc index.html>`
- Deploy target: Cloudflare Pages. Build phải pass, không thêm dependency nặng (không UI kit, không lottie; chỉ được thêm font qua Google Fonts link).

## NORTH-STAR CONCEPT

Metaphor duy nhất: **hành trình chinh phục đỉnh núi**. Mọi quyết định hình ảnh phải trả lời được: "nó có giúp người học cảm nhận độ cao — hành trình — cột mốc không?"

- **Bản đồ địa hình** (contour lines, SVG ellipse lồng nhau nghiêng ~-12°): pattern nền/điểm nhấn section.
- **Đường leo**: đường cong vermillion đi lên — hero, biểu đồ tiến độ, CTA cuối.
- **Cột mốc**: chấm tròn stroke accent + nhãn mono (MỐC 01 · ĐỀ 2023).
- **Cờ đỉnh**: tam giác ▲ vermillion nhỏ, chỉ xuất hiện ở logo và đích đến.
- **Sổ tay trắc địa**: nhãn kỹ thuật monospace, vạch cao độ, tọa độ.

Năm từ khóa cảm xúc để tự kiểm: HỌC THUẬT · CHÍNH XÁC · ĐỘ CAO · KIÊN NHẪN · ẤM. Nếu màn hình trông như crypto/SaaS neon → sai, làm lại.

## DESIGN TOKENS (bắt buộc dùng đúng, khai báo thành CSS custom properties ở :root)

```css
:root {
  /* Màu: giấy · mực · cờ đỉnh */
  --paper: #F5F2EA;        /* nền chính */
  --paper-2: #ECE8DD;      /* nền phụ, chip */
  --ink: #1C2333;          /* text chính */
  --ink-2: #4A5164;        /* text phụ */
  --ink-3: #8A8FA0;        /* nhãn mono, metadata */
  --line: rgba(28,35,51,.14);
  --line-soft: rgba(28,35,51,.08);
  --accent: #E4572E;       /* vermillion: CTA chính, marker, đường leo */
  --accent-deep: #B03E1C;  /* hover/active accent */
  --altitude: #2F5D8A;     /* dữ liệu phụ, link, đồ thị thứ 2 */
  --pine: #33705C;         /* trạng thái đúng/hoàn thành */

  /* Type scale 1.25 */
  --t-micro: 13px; --t-body: 16px; --t-lead: 20px; --t-h3: 25px;
  --t-h2: 31px; --t-h1: 39px; --t-hero: 61px;

  /* Spacing 4pt */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px;
  --s6:32px; --s7:48px; --s8:64px; --s9:96px; --s10:128px;

  /* Phụ trợ */
  --dot: rgba(28,35,51,.10);        /* dot-grid của khung địa hình */
  --summit-bg: var(--ink);          /* nền panel CTA cuối */
  --ink-rgb:28,35,51; --paper-rgb:245,242,234;   /* bản rgb để canvas dùng rgba() */
  --accent-rgb:228,87,46; --altitude-rgb:47,93,138;

  /* Radius & motion */
  --r-sm:6px; --r-md:10px; --r-lg:16px;
  --ease-out: cubic-bezier(0.22,1,0.36,1);
}

/* DARK — "đêm trắc địa": đảo giấy↔mực, accent sáng hơn 1 nấc */
[data-theme="dark"]{
  --paper:#12161F; --paper-2:#1A202B;
  --ink:#EDEAE0; --ink-2:#B9BDC9; --ink-3:#79808F;
  --line:rgba(237,234,224,.15); --line-soft:rgba(237,234,224,.08);
  --accent:#F06840; --accent-deep:#E4572E; --altitude:#6B9BD1; --pine:#4FA586;
  --dot:rgba(237,234,224,.12);
  --summit-bg:#0B0E13;
  --ink-rgb:237,234,224; --paper-rgb:18,22,31;
  --accent-rgb:240,104,64; --altitude-rgb:107,155,209;
}
```

**Bắt buộc có dark mode toggle** (nút sun/moon line-icon trong nav, cạnh CTA): khởi tạo từ `localStorage` (try/catch — sẽ throw trong một số môi trường sandbox) rồi fallback `prefers-color-scheme`; set `data-theme` trên `<html>` bằng inline script TRONG `<head>` để chống flash; mọi màu trong UI chỉ qua `var()` (kể cả SVG: dùng `currentColor` hoặc `style="stroke:var(--accent)"`, cấm hex hardcode); canvas địa hình đọc `getComputedStyle` lấy `*-rgb` tokens mỗi lần đổi theme qua một hook `window.VTG_REFRESH_COLORS` (reduced-motion thì vẽ lại frame tĩnh ngay); transition nền/chữ 350ms khi đổi theme. Panel CTA cuối và footer luôn tối ở cả hai theme (dark light → summit-bg đậm hơn nữa), contour giữ màu kem `#F5F2EA`.

**Quy tắc màu cứng:**
- Accent vermillion ≤ 5% diện tích màn hình: chỉ CTA chính, marker cột mốc, vạch đích, 1 từ khóa nhấn trong headline.
- Phân tầng bằng `border: 1px solid var(--line)` + nền paper-2. **Cấm** shadow lan tỏa kiểu SaaS; chỉ CTA có hover `translateY(-2px)` + `box-shadow: 0 10px 24px -14px rgba(176,62,28,.55)`.
- **Cấm** gradient (đặc biệt tím→xanh), glassmorphism/backdrop-blur trang trí (chỉ nav sticky được blur 8px trên nền paper 88%).
- Nền tối `--ink` được dùng đúng MỘT LẦN: panel CTA cuối trang (và footer kề nó).

## TYPOGRAPHY

Nạp qua Google Fonts (3 family đều hỗ trợ tiếng Việt):

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Be+Vietnam+Pro:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **Display — Space Grotesk 500/700**, tracking −0.02em: headline, số liệu lớn, tên tính năng.
- **Body — Be Vietnam Pro 400/500**, line-height 1.65, cỡ 16px (đoạn dẫn 20px).
- **Mono — IBM Plex Mono 400/500**: mọi nhãn kỹ thuật, số liệu, kicker (uppercase, letter-spacing .14em), nhãn marker.
- Line-clamping bằng max-width `ch`: headline ≤ 22ch, lead ≤ 60ch, body ≤ 68ch.

## ICONOGRAPHY

Tự vẽ inline SVG, KHÔNG dùng emoji, KHÔNG dùng icon library: viewBox 24×24, stroke 1.5px, `stroke-linecap/linejoin: round`, hình học tối giản, một màu `--ink`; được phép 1 nét phụ màu accent. Cần 5 icon: đề thi (clipboard+ruler), máy tính CAS (calculator), ma trận (ngoặc ma trận), đồ thị hàm số (trục + đường cong accent + điểm), đỉnh núi (tam giác + cờ). Ref gợi ý nét: xem file `vantage/design-system.html` mục 06 nếu có trong repo.

## MOTION SPEC

- Easing chuẩn toàn app: `cubic-bezier(0.22,1,0.36,1)`.
- **Draw**: đường contour/đường leo SVG — `pathLength="1"`, `stroke-dasharray:1`, animate `stroke-dashoffset:1→0`, 900–1400ms, bắt đầu khi vào viewport (IntersectionObserver, threshold .25–.35).
- **Rise**: headline theo từng từ (`span --i`, delay `calc(var(--i)*70ms)`), section reveal `translateY(12–16px)+fade` 380–550ms, stagger con 60ms.
- **Count**: số liệu đếm 0→n trong 900ms, easing cubic-out, format `toLocaleString('vi-VN')`, trigger 1 lần khi 25% vào viewport.
- **Marker pulse**: vòng tròn stroke accent lan 1→2.6×, opacity .45→0, 2.4s infinite.
- **Hover**: link nav gạch chân accent quét 0→100%; feat card `translateY(-3px)`; icon `translateX(4px)`.
- **Terrain 3D (hero)**: vanilla canvas, Không Three.js/WebGL (deploy Cloudflare Pages, phải chạy cả offline); camera nghiêng theo con trỏ, lerp 0.045; xem spec chi tiết ở mục Hero.
- **Depth parallax (panel CTA cuối)**: 2 tầng contour SVG dịch `translate3d` ±10–22px theo con trỏ, transition 450ms `var(--ease-out)`, về 0 khi rời chuột.
- **Bắt buộc** `@media (prefers-reduced-motion: reduce)`: tắt Draw/Pulse/Count/Rise (hiển thị trạng thái cuối ngay), terrain render đúng 1 frame tĩnh (progress=1), tắt parallax; chỉ giữ fade ≤10ms.
- Cấm: bounce/elastic easing, marquee vô nghĩa, animation đơn lẻ > 1.6s (trừ pulse ambient và drift camera), particle field, shape trôi nổi vô định, mọi thư viện 3D/animation nặng (three.js, GSAP, lottie). **Quy tắc vàng: chiều sâu chỉ xuất hiện khi NÓ LÀ metaphor địa hình** — không 3D trang trí thuần túy.

### 1b. Nền động ambient toàn trang (thẻ `<canvas id="bgField">` fixed, z-index 0, pointer-events none, `100vw × 100dvh`)
"Bản đồ địa hình đang thở": **7 đồi vô hình dồn ra mép/góc** (giữa màn hình sạch để đọc) × 5 vòng đồng mức, vẽ bằng dạng đóng `r(θ)=k/√(cos²θ/sx²+sin²θ/sz²)` từ các gaussian — **không particle, không noise texture**. Kỷ luật ambient cứng: stroke `--ink-rgb` **alpha ≤ 0.12 ở mép màn, ~0.05 ở trung tâm** nhờ vignette nội dung `vis=0.42+0.58·pow(cxr,1.4)` với `cxr = |cxpx − W/2| / (W/2)`, kèm "sky wash": 2 radial-gradient khổng lồ màu accent (alpha 0.05, góc phải-trên) và ink (0.035, trái-dưới) trôi theo parallax. Chu kỳ trôi 60–95s (`sin(t×0.0785×spd+ph)`), "đường mòn" accent alpha 0.13 vẽ dần 2.2s đúng 1 lần lúc tải rồi yên. Parallax: con trỏ ±18px với hệ số depth riêng từng đồi (0.6–1.5), cuộn trang 0.055×scrollY (lerp 0.05–0.07). DPR cap 1.5; dừng rAF khi `document.hidden`; `prefers-reduced-motion` → vẽ 1 frame tĩnh, không loop, không parallax. Màu đọc từ tokens và đăng ký vào `window.VTG_THEME_HOOKS` để theo theme. Nội dung chính nằm trên: `.nav,.hero,.features,.faq,.summit,footer{position:relative;z-index:1}` (nav giữ z-50). **Quan trọng — bài học từ bug cover: canvas bắt buộc có rule CSS `#bgField{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh}` trong stylesheet; thiếu rule này canvas rơi về kích thước inline 300×150 chỉ nằm trước header. Sanity check: đo `getBoundingClientRect()` của canvas phải bằng viewport.**

## SECTION-BY-SECTION SPEC

### 1. Nav (sticky, h=64px)
Logo `VANTAGE` + ▲ accent. Link phải: Công cụ / Lộ trình / Hỏi đáp. CTA ghost-mono `VÀO ÔN THI →` (border ink, hover fill ink). Bỏ hẳn nav-link trên ≤760px (không cần hamburger cho landing).

### 2. Hero — BỎ layout "căn giữa 3 khối", dùng editorial 2 cột
- Grid `1.05fr .95fr`, gap 48px, min-height ~560px; mobile xếp chồng.
- Cột trái: kicker mono `ÔN THI TOÁN THPT · TUYỂN SINH 10 · KHÓA 2026` (vạch accent 32px trước), H1 `Tầm nhìn dẫn đường, vươn tới đỉnh cao.` với cụm "vươn tới đỉnh cao." màu accent, Rise từng từ; sub 20px tối đa 46ch; 2 CTA (primary accent `Bắt đầu ôn thi miễn phí →`, ghost `Xem công cụ`); dòng trust mono: `KHÔNG CẦN THẺ · DÙNG NGAY TRÊN TRÌNH DUYỆT · ∫Σ√π∞Δ`.
- Cột phải: **ĐỊA HÌNH 3D TRẮC ĐỊA** trong card border 1px radius 16px, nền dot-grid (`radial-gradient` 1px, size 22px, opacity .10), tỉ lệ khung ~640/520. Corner labels mono 11px ink-3: trên-trái `VN-02 · TỈ LỆ 1:63.000`, dưới-phải `ĐỊA HÌNH 3D · 2026`, dưới-trái `● DI CHUỘT ĐỂ NGHIÊNG GÓC NHÌN`.
  - **Kỹ thuật: vanilla `<canvas>` 2D tự viết projection** — cấm Three.js/WebGL/thư viện ngoài (deploy Cloudflare Pages, phải chạy offline, tổng JS < 12KB phần terrain). Implementation mẫu tham chiếu đầy đủ: file `vantage/hero-redesign-3d.html` (khối script đầu tiên) nếu có trong repo — clone logic, đừng viết lại mò.
  - **Địa hình — HAI ĐỈNH (hình dáng kể chuyện hai hành trình)**: lưới 64×46 điểm, x∈[-1.25, 1.25], z∈[0.02, 1.7]. Cao độ = đỉnh THPT `pow(gauss(x−0.34, z−0.86, 0.40, 0.44), 1.7)` (nón nhọn, dốc, cao ~1.0) + đỉnh lớp 10 `0.52×gauss(x+0.72, z−0.30, 0.34, 0.30)` (thấp, thoai thoải, ở gần camera hơn) + 2 gaussian phụ + gợn sine nhỏ. Mesh: đường ngang ink alpha theo độ sâu (0.055 xa → 0.33 gần, fog), đường dọc thưa 0.09.
  - **Camera**: pitch 1.03 rad, yaw −0.05 rad; con trỏ trong vùng hero lái yaw ±0.18 rad và pitch ±0.05 rad, lerp hệ số 0.045 mỗi frame; không có con trỏ (mobile) → drift chậm `sin(t/5.2s)×0.10`.
  - **HAI TUYẾN = HAI ĐỒ THỊ HÀM THẬT**, chung basecamp (0.02, 0.06) — label `MỐC 01 · XUẤT PHÁT`. Cách dựng: dựng đường cong dọc trục basecamp→đỉnh, lệch pháp tuyến theo giá trị hàm (nên hai đầu offset = 0, khớp chính xác điểm neo):
    - Tuyến THPT (đỏ `--accent`): offset `w(t) = t³ − 3t` với t ∈ [−√3, √3], amp 0.24 → chữ S qua 2 cực trị (hàm bậc ba kinh điển lớp 12). Delay 650ms, kéo 2.4s; cột mốc u=0.38/0.62/0.83 (`MỐC 02/03/04 · ĐỀ 2023/2024/2025`); cờ đỉnh cột 26px + `ĐỈNH · ĐH MƠ ƯỚC`. Formula tip: `z = t³ − 3t` / `HÀM BẬC BA · KHẢO SÁT & CỰC TRỊ · LỚP 12`.
    - Tuyến lớp 10 (xanh `--altitude`): offset `−(1 − (2u−1)²)` amp 0.16 → cung parabola cúi về phía camera. Trễ +800ms, kéo 2.0s; cột mốc u=0.46/0.76 (`L10 · ĐỀ 2024/2025`); cờ đỉnh cột 20px + `ĐỈNH 10 · TRƯỜNG MƠ ƯỚC`. Formula tip: `z = 1 − t²` / `PARABOLA · HÀM SỐ BẬC HAI · LỚP 10`.
    - Legend bản đồ (góc phải, mono): `THPT → ĐH MƠ ƯỚC · z = t³ − 3t` và `LỚP 10 → TRƯỜNG MƠ ƯỚC · z = 1 − t²`.
    - **Tooltip công thức**: hit-test chuột tới ≤72 mẫu của từng tuyến, ngưỡng 26 CSS px → chip nền `--ink` chữ `--paper` (công thức màu accent + note chương trình học), đuôi mũi tên, bám con trỏ; tuyến được hover đậm 2.4→3.4px. Tắt khi ở chế độ dữ liệu.
  - **LINK BẢN ĐỒ CHIA SẼ ĐƯỢC (tính năng lan truyền)**: điểm 6 chuyên đề đọc từ URL query theo slug cố định: `ham-so`, `luong-giac`, `oxyz`, `xac-suat`, `mu-log`, `nguyen-ham` (+ `name` tùy chọn). Quy tắc: parseFloat, chấp nhận dấu phẩy (`2,5`→2.5), clamp 0–10, làm tròn 0.5, tham số lạ/không hợp lệ bỏ qua; `name` cắt 24 ký tự và **chỉ được đưa vào DOM bằng `textContent`** (chống XSS). Khi URL có dữ liệu: tự mở thẳng chế độ Năng lực, đổi nhãn `HỌC SINH MẪU` → `ĐỊA HÌNH CỦA <TÊN>`, cập nhật `document.title`. Panel chỉnh điểm (6 range input `accent-color: var(--accent)`, thang 0–10 bước 0.5, nhãn mono + output số): kéo slider → terrain biến hình trực tiếp (vòng lặp đang chạy; reduced-motion thì vẽ lại frame tĩnh), cờ mục tiêu tự nhảy sang chuyên đề yếu nhất mới, URL đồng bộ bằng `history.replaceState` debounce 350ms (**bọc try/catch** — sandboxed iframe sẽ throw). Nút "SAO CHÉP LIÊN KẾT BẢN ĐỒ": `navigator.clipboard.writeText(shareURL)` → flash `ĐÃ CHÉP ✓` 1.6s; fallback: mở `<input readonly>` chứa URL để chép thủ công (kể cả `file://`/`origin:'null'`). Panel đóng/mở bằng chip `CHỈNH ĐIỂM CỦA BẠN`; mobile (<640px): mặc định đóng, panel full-width bám đáy khung.
  - **TAB “NĂNG LỰC · MẪU” — địa hình = dữ liệu thật**: 2 tab mono-pill (role=tablist) top-center của khung. Terrain morph (lerp `dataW` hệ số 0.07/frame) sang hàm mới: 6 gaussian tại 6 vị trí chuyên đề (HÀM SỐ 8.5 · LƯỢNG GIÁC 6.0 · HÌNH OXYZ 4.5 · XÁC SUẤT 7.0 · MŨ & LOGARIT 5.5 · NGUYÊN HÀM 9.0), biên độ `0.14 + score/10 × 0.80` — **cao độ = điểm**. Routes + cột mốc fade theo `1−dataW`. Nhãn tên chuyên đề (ink) + điểm (xanh; điểm yếu nhất màu accent) theo `dataW`. Khi `dataW > 0.55`: **cờ accent cắm tại chuyên đề yếu nhất** với nhãn `MỤC TIÊU KẾ · HÌNH OXYZ 4.5` — điểm yếu trở thành đỉnh cần chinh phục. Legend đổi thành `CAO ĐỘ = ĐIỂM THÀNH THẠO (0–10) · HỌC SINH MẪU`. Reduced-motion: snap tức thì, vẽ tĩnh.
  - **Màu canvas đọc runtime**: lấy `--ink-rgb`, `--paper-rgb`, `--accent`, `--altitude`, `--accent-rgb`, `--altitude-rgb`, `--pine` bằng `getComputedStyle` khi khởi tạo và mỗi lần `VTG_REFRESH_COLORS()` (đổi theme) — cấm hex cứng trong code canvas.
  - **Hiệu năng & a11y bắt buộc**: DPR cap `min(devicePixelRatio, 1.75)`; dừng rAF khi canvas khuất viewport (IntersectionObserver threshold .08) và khi `document.hidden`; resize re-render; `role="img"` + aria-label + fallback text trong thẻ `<canvas>` mô tả CẢ HAI chế độ; `prefers-reduced-motion` → 1 frame tĩnh progress=1, không loop/pulse/drift/hit-test; pointer thô: chỉ drift.

### 3. Stats — TRÁNH hàng số liệu SaaS, dùng "sổ tay trắc địa"
Grid 3 cột, border-top `var(--line)`, mỗi ô border-left trừ ô đầu. Số: IBM Plex Mono 44px count-up (`40+`, `63`, `1.104` → render `1.104` kiểu vi-VN). Label mono uppercase 12px ink-3. Mobile: xếp dọc, border-top thay border-left.

### 4. Features "Công cụ đi cùng bạn" — BỎ card đồng nhất
Sec-head 2 phía: H2 trái, note mono phải (`04 DỤNG CỤ · NHƯ HỘP BÚT CỦA NGƯỜI LEO NÚI`). Grid 4 cột (→2 →1 responsive). Mỗi item: `border-top: 2px solid var(--ink)` (không box, không nền), số mục `D·01…04` mono accent, icon SVG line 34px, tên Space Grotesk 19px, mô tả body 15px ink-2. Hover: item lift -3px, icon trượt phải 4px. Nội dung 4 mục giữ nguyên: Thi thử đề thật / Máy tính CAS / Đại số tuyến tính / Math Playground.

### 5. FAQ — BỎ accordion mặc định, làm "mục lục sách"
5 câu hỏi hiện có giữ nguyên nội dung. Mỗi mục: border-top (mục cuối có cả border-bottom), grid `56px 1fr 24px`: số thứ tự `01…05` mono ink-3, câu hỏi Space Grotesk 19px, dấu `+` accent xoay 45° khi mở. Hover nền paper-2. Body thụt vào cột 2, max-width 64ch. Dùng `<details>/<summary>` native (a11y miễn phí) style lại, bỏ marker mặc định; mục 01 mở sẵn.

### 6. CTA cuối "summit" — panel ink duy nhất của trang
Nền `--ink`, text paper. Contour ellipse stroke paper opacity thấp ~.16 làm nền (position absolute, bleed phải), 1 đường leo accent Draw-on-scroll + cờ đỉnh ở cuối. Kicker mono paper-50%: `CỘT MỐC TIẾP THEO LÀ CỦA BẠN`. H2 `Sẵn sàng bắt đầu leo?` với "bắt đầu leo?" accent. 1 CTA primary `Vào ôn thi ngay →`.

### 7. Footer (trên nền ink, kề CTA)
1 hàng mono 12px: trái `VANTAGE ▲ · VƯƠN TỚI ĐỈNH CAO`, phải link pháp lý/liên hệ hiện có. Border-top `rgba(245,242,234,.12)`.

## A11Y & HIỆU NĂNG (điều kiện bắt buộc)

- Contrast: ink/paper ≥ 12:1; accent `#E4572E` chỉ đặt text trên paper (≥ 4.5:1), không đặt text trắng cỡ nhỏ trên accent.
- `:focus-visible` outline 2px accent, offset 3px, mọi phần tử tương tác.
- Mọi SVG trang trí `aria-hidden="true"`; bản đồ hero có `role="img"` + aria-label mô tả.
- Landmark: header/nav/main/section/footer; H1 duy nhất; thứ tự heading không nhảy cấp.
- `prefers-reduced-motion` đầy đủ. Không layout shift khi font nạp (`display=swap` + fallback stack size-adjust tương đương).
- Canvas terrain: giữ 60fps ở DPR ≤ 1.75 trên laptop tầm trung (tự đo bằng DevTools Performance trước khi báo xong); tổng JS tự viết cho hiệu ứng ≤ 12KB gz; không blocking main thread > 16ms/frame.
- Mobile-first; breakpoint 560 / 760 / 900 / 980px. Không nội dung nào vượt viewport ngang.

## CHECKLIST CHỐNG AI-GENERIC — tự rà trước khi báo xong

Nếu bất kỳ mục nào còn tồn tại → chưa xong, sửa tiếp:
- [ ] Không một emoji nào trong UI (kể cả icon tính năng).
- [ ] Không gradient; không glassmorphism; không shadow lan tỏa; không bo góc >16px.
- [ ] Hero KHÔNG căn giữa badge+H1+sub+2 nút; có điểm nhấn đồ họa kể chuyện (bản đồ leo núi).
- [ ] Khối tính năng KHÔNG phải 4 hộp giống hệt nhau; dùng đường kẻ + nhịp editorial.
- [ ] Accent vermillion xuất hiện có chủ đích, ≤5% diện tích.
- [ ] Mọi nhãn kỹ thuật/số liệu dùng IBM Plex Mono; headline dùng Space Grotesk.
- [ ] Có ít nhất 4 motion pattern đúng spec (Draw, Rise, Count, Terrain-3D/Depth-parallax) và đều tôn trọng reduced-motion; 3D chỉ ở địa hình hero + contour CTA, không ở nơi khác.
- [ ] Địa hình có đúng 2 đỉnh 2 tuyến lệch pha (màu accent cho THPT, altitude cho lớp 10), basecamp chung, legend bản đồ.
- [ ] Hai tuyến là đồ thị hàm thật (bậc ba cho THPT, parabola cho lớp 10) và rê chuột vào tuyến thấy tooltip công thức.
- [ ] Tab "Năng lực" morph terrain thành đồi điểm số, cờ mục tiêu đúng ở chuyên đề yếu nhất; quay lại tab "Lộ trình" mượt không giật.
- [ ] Dark mode hoàn chỉnh: toggle trong nav, không flash theme khi tải trang, canvas đổi màu theo theme không cần reload, contrast ≥4.5:1 ở cả hai theme.
- [ ] Link chia sẻ: mở URL có `?ham-so=9&oxyz=2.5&name=An` → thẳng chế độ năng lực với đúng điểm + tên; chỉnh slider cập nhật URL; nút copy hoạt động (kể cả fallback); tham số rác/XSS bị vô hiệu.
- [ ] Nền động ambient đúng kỷ luật: contour trôi ≥60s chu kỳ, alpha ≤0.12 ở mép / ~0.05 giữa màn (vignette), sky wash 2 vệt sáng, không particle, reduced-motion tĩnh hẳn, đổi theme theo tokens.
- [ ] **Nghiệm thu bằng mắt (không chỉ smoke test):** canvas nền `position:fixed` phủ trọn viewport ở cùng trang LẪN khi cuộn sâu; icon theme-toggle hiện ở cả hai theme; nhãn bản đồ/hành trình không chồng đè; headline ngắt dòng cân.
- [ ] Từ "đỉnh / cột mốc / đoạn đường" xuất hiện nhất quán trong microcopy.

## QUY TRÌNH LÀM VIỆC

1. **Đọc repo trước**, liệt kê file sẽ đụng vào. Trình bày plan; KHÔNG code cho tới khi tôi duyệt plan.
2. **Pha 1 — foundation:** thêm fonts, khai báo tokens, reset cơ bản, set `::selection`, focus-visible, background paper. Dừng lại, báo để tôi review.
3. **Pha 2 — từng section** theo thứ tự Nav → Hero → Stats → Features → FAQ → CTA → Footer. Sau mỗi section: chạy build + tự rà checklist; liệt kê những gì đã làm/chưa chắc.
4. Kết thúc: chạy production build, báo lỗi nếu có, và viết phần **tự chấm theo checklist** + danh sách thay đổi copy.
5. Mọi quyết định lệch spec phải nêu rõ lý do thay vì âm thầm đổi.

Bắt đầu bằng bước 1: đọc repo và trình bày plan.
---
---

## Ghi chú vận hành sau khi redesign xong

1. **So sánh trước/sau:** mở song song trang cũ và bản mới ở cùng viewport, chụp lại — bạn sẽ tự nhìn ra chỗ chưa "thấm".
2. **Nhân bản sang app nội bộ** (màn làm bài, kết quả, lộ trình) bằng cùng prompt này, thay section spec bằng: progress = trục cao độ dọc có cột mốc; kết quả đề = "bản đồ lỗi sai" theo dạng câu.
3. **Vercel v0/Stitch** cũng dùng được prompt này để sinh phương án khác rồi so — nhưng giữ Claude Code làm bản chính vì nó đọc được repo của bạn.
