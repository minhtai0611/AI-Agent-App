# 08 · HERO POLISH PASS — "CHỈNH TAY SAU KHI AI DỰNG"
### Spec dán thẳng vào Claude Code · landing hero hiện tại (v1.4.x)
**Cách dùng:** copy toàn bộ từ sau đường kẻ dưới đây, dán vào Claude Code tại root repo. Đây là **polish pass, không phải redesign** — phạm vi sửa chặt trong các mục P1–P4, cấm "tiện thể" thay đổi layout/tokens/copy.

---
---

## VAI TRÒ & PHẠM VI

Bạn là senior front-end engineer + design polisher. Landing hero đã được redesign và nhìn tổng thể đúng ngôn ngữ "Vươn tới đỉnh cao" (đọc `vantage/design-system.html`). Nhiệm vụ: **pass chỉnh tay cuối** — sửa đúng các điểm dưới đây mà mắt người soi ra trên ảnh verify 1440×900, không đụng gì khác.

**Cấm trong pass này:** đổi layout 2 cột, đổi tokens/màu/font, thêm section, thêm animation mới, viết lại engine terrain. Nếu thấy vấn đề ngoài phạm vi — liệt kê vào báo cáo, không tự sửa.

## P1 · NỀN `#bgField`: CONTOUR KHÔNG BAO GIỜ ĐƯỢC CẮT NHAU

**Hiện trạng (soi trên ảnh verify):** các hệ contour của 7 đồi được vẽ chồng lên nhau nên **đường đồng mức giao cắt lung tung** — trên bản đồ trắc địa thật điều này không tồn tại; nhìn như vết nứt trên giấy và các đường còn **chạy xuyên qua vùng headline**, gây nhiễu đọc.

**Sửa:**
1. Đổi cách sinh contour thành **MỘT trường cao độ duy nhất**: `h(x,y) = Σᵢ gaussᵢ(x,y)` (giữ nguyên 7 đồi/thông số hiện có), rồi vẽ đường đồng mức trên trường tổng hợp bằng **marching squares** (lưới nội suy ~128×72, 5–6 mức iso). Đường đồng mức của một trường liên tục *theo toán học không thể tự cắt* — đây là fix gốc, không phải vá.
   - Hiệu năng: trường tính 1 lần/resize vào Float32Array; mỗi frame chỉ offset pha drift chậm đúng spec cũ (chu kỳ 60–95s); giữ 60fps ở DPR ≤1.5. Nếu marching squares vượt ngân sách frame, phương án B được phép: giữ ellipse-per-hill nhưng khi hai đường thuộc hai đồi khác nhau lại gần <14px thì fade alpha đường ưu tiên thấp về 0 (không bao giờ cho cắt nhau). Ghi rõ đã chọn A hay B trong báo cáo kèm số đo fps.
2. **Vùng đọc sạch:** tăng vignette nội dung trong vùng bounding box của khối headline + sub + CTA hero: alpha contour trong vùng đó ×0.35 (và theo quy tắc cũ toàn trung tâm ~0.05 → hạ còn ~0.03–0.04). Mục tiêu: **không một đường contour nào xuyên qua bounding box của H1** ở 1440×900 và 390×844.
3. Giữ nguyên: sky wash 2 vệt, đường mòn accent vẽ dần 1 lần, parallax con trỏ/cuộn, dừng rAF khi hidden, reduced-motion → 1 frame tĩnh (frame tĩnh cũng phải từ marching squares — không cắt nhau).
4. Sanity check giữ nguyên từ bài học bug cover: rule CSS `position:fixed;inset:0` + `getBoundingClientRect()` == viewport sau resize.

## P2 · MAP CARD HERO: TỪ ~14 NHÃN VỀ ≤ 7

**Hiện trạng:** quá nhiều nhãn mono cạnh tranh (4 corner labels + legend block 4 dòng + 2 tab + 2 cờ đỉnh + 4 cột mốc + nhãn trục) — "sổ tay trắc địa" đang bị thành "bảng thông số". Art direction là quyền CẮT.

**Giữ lại (đúng 7 thứ trong card):**
1. Cụm tab `● LỘ TRÌNH / ○ NĂNG LỰC · MẪU` (top-center).
2. Corner trên-trái: `VN-02 · TỈ LỆ 1:63.000`.
3. Corner dưới-phải: `ĐỊA HÌNH 3D · 2 TUYẾN`.
4. Cờ đỉnh THPT + nhãn `ĐỈNH · ĐH MƠ ƯỚC`.
5. Cờ đỉnh lớp 10 + nhãn `ĐỈNH 10 · TRƯỜNG MƠ ƯỚC`.
6. `MỐC 01 · XUẤT PHÁT` tại basecamp.
7. Các nhãn mốc tuyến theo format RÚT GỌN: `M·02 — 2023`, `M·03 — 2024`, `M·04 — 2025`, `L10 — 2024`, `L10 — 2025` (bỏ chữ "MỐC"/"ĐỀ" lặp lại).

**Gỡ bỏ:**
- Corner dưới-trái `● RÊ TUYẾN → XEM HÀM` — xóa hẳn (tooltip tự nói chuyện khi người dùng rê).
- Legend block góc phải (`THPT → ĐH MƠ ƯỚC · z = t³ − 3t` …) — xóa; công thức vốn đã có trong tooltip khi hover tuyến. Hai tuyến phân biệt bằng màu + cờ đỉnh là đủ.
- Mọi nhãn phụ khác trong card không nằm ở danh sách "giữ".

## P3 · NHÃN MỐC: LEADER LINE + ANTI-COLLISION

1. Mỗi nhãn mốc **offset ra khỏi tuyến 12px theo phương pháp tuyến** (hướng ra ngoài đồi), nối vào điểm mốc bằng **leader line** 10px stroke 1px alpha .3 — không nhãn nào được đặt đè lên nét tuyến hay đè mesh đường ngang (hiện `M·02 · ĐỀ 2023` đang đè tuyến).
2. **Collision pass** sau khi đặt nhãn: nếu bbox hai nhãn chồng nhau, trượt nhãn dọc theo tuyến ±16px tới khi tách; giữa hai cờ đỉnh tối thiểu 56px trên màn (hai cờ hiện gần chạm nhau — nếu cần, lệch nhãn cờ THPT sang phải 8–12px).
3. `MỐC 01 · XUẤT PHÁT` đặt **dưới** basecamp (không đè mép dưới mesh).
4. Áp dụng cho cả hai chế độ (LỘ TRÌNH và NĂNG LỰC: nhãn chuyên đề + điểm cũng qua cùng hệ offset/collision).

## P4 · ĐỒ CHỈNH NHỎ CÒN LẠI (typography & chi tiết)

1. **Headline rag**: kiểm ở 390×844 — tối đa 3 dòng, không dòng nào ≤2 chữ; nếu vỡ, chỉnh `max-width` khối headline (ch), không chỉnh cỡ chữ.
2. **Stats row**: baseline-align con số `40⁺` `63` `1.104` với đơn vị `+`; đảm bảo digit dùng tabular/lining figures (IBM Plex Mono mặc định tabular — kiểm bằng mắt dấu chấm ngàn `1.104` thẳng hàng).
3. **FAQ marker**: thống nhất dùng `+` xoay 45° thành `×` khi mở (hiện trạng thái mở đang là glyph `×` khác nét) — một glyph duy nhất, transform điều khiển.
4. **Trust line**: `∫Σ√π∞Δ` trong dòng trust giữ nguyên (đây là chữ ký cho phép); chỉ kiểm nó không vỡ dòng trên mobile.

## NGHIỆM THU PASS NÀY (bắt buộc, bằng mắt + bằng số)

- [ ] Contour crossing = **0** (soi 1440×900 và 390×844, cả frame tĩnh reduced-motion): không hai đường đồng mức nào giao nhau.
- [ ] Không contour nào xuyên bounding box H1; alpha vùng giữa ~0.03–0.04 (đo pixel bằng DevTools nếu nghi ngờ).
- [ ] Đếm nhãn trong map card ≤ **7**; không còn legend block; tooltip hover tuyến vẫn đầy đủ công thức.
- [ ] Không nhãn nào đè tuyến/mesh; 2 cờ đỉnh cách nhau ≥56px; `MỐC 01` nằm dưới basecamp.
- [ ] Chụp verify 4 trạng thái: hero 1440×900 · cuộn sâu · dark · reduced-motion — đối chiếu cặp trước/sau cạnh nhau trong báo cáo.
- [ ] fps nền ≥55 (DPR 1.5, laptop tầm trung) sau khi đổi marching squares; nếu dùng phương án B, nêu rõ.
- [ ] Báo cáo liệt kê: mọi thứ đã bị CẮT (danh sách "removed"), bất kỳ lệch spec nào kèm lý do.

## QUY TRÌNH

1. Đọc code hero/bgField hiện tại, xác nhận lại từng "hiện trạng" ở P1–P4 (cái nào đã đúng thì bỏ qua, nêu trong plan). Trình bày plan → tôi duyệt → mới sửa.
2. Sửa theo thứ tự P1 → P2 → P3 → P4; sau mỗi P: chụp verify + tự rà mục nghiệm thu tương ứng.
3. Kết thúc: production build, ảnh trước/sau ghép đôi, checklist tự chấm.

Bắt đầu bằng bước 1.
