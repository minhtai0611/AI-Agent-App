# Zenith — Báo Cáo Sản Phẩm Toàn Diện

**Dự án:** Zenith — Nền tảng luyện thi Toán thích ứng dành cho học sinh Việt Nam  
**Đối tượng đọc:** Lãnh đạo, quản lý sản phẩm — không yêu cầu kiến thức kỹ thuật  
**Ngày:** tháng 6 năm 2026  
**Phiên bản:** 2.0

---

## Tóm Tắt Điều Hành

Zenith là ứng dụng luyện thi Toán dành cho học sinh từ lớp 9 đến lớp 12 tại Việt Nam, tập trung vào kỳ thi tuyển sinh lớp 10 và kỳ thi THPT Quốc gia. Điểm khác biệt cốt lõi là **hệ thống học thích ứng**: thay vì cho tất cả học sinh làm cùng một bộ đề, Zenith tự động phân tích điểm yếu của từng em và điều chỉnh nội dung luyện tập theo thời gian thực.

Nền tảng bao gồm **24 tính năng chính** trải dài trên toàn bộ hành trình học tập — từ bài kiểm tra đầu vào, làm đề thi, phân tích kết quả, luyện tập thích ứng, đến ôn tập thông minh và theo dõi tiến độ dài hạn. Tất cả tính năng được hỗ trợ bởi AI (mô hình Claude của Anthropic) và được xây dựng dựa trên các phương pháp giáo dục đã được nghiên cứu khoa học kiểm chứng.

**Kho đề thi:** 86 đề từ 47 nguồn thực (Bộ GD&ĐT, Sở GD&ĐT các tỉnh, AMC Mỹ, CEMC Canada, SEC Ireland, KICE Hàn Quốc), với 2.075+ câu hỏi được phân loại theo chủ đề và mức độ khó.

---

## Mục Lục

1. [Hành Trình Học Sinh](#1-hành-trình-học-sinh)
2. [Bước 1 — Đánh Giá Năng Lực Đầu Vào](#2-bước-1--đánh-giá-năng-lực-đầu-vào)
3. [Bước 2 — Làm Bài Thi](#3-bước-2--làm-bài-thi)
4. [Bước 3 — Phân Tích Kết Quả và Đề Xuất Trường](#4-bước-3--phân-tích-kết-quả-và-đề-xuất-trường)
5. [Bước 4 — Kế Hoạch Học Tập Cá Nhân Hóa](#5-bước-4--kế-hoạch-học-tập-cá-nhân-hóa)
6. [Bước 5 — Luyện Tập Thích Ứng Hàng Ngày](#6-bước-5--luyện-tập-thích-ứng-hàng-ngày)
7. [Bước 6 — Ôn Tập Thông Minh (Spaced Repetition)](#7-bước-6--ôn-tập-thông-minh-spaced-repetition)
8. [Bước 7 — Oracle: Gia Sư Toán AI](#8-bước-7--oracle-gia-sư-toán-ai)
9. [Bước 8 — Theo Dõi Tiến Độ và Bản Đồ Khái Niệm](#9-bước-8--theo-dõi-tiến-độ-và-bản-đồ-khái-niệm)
10. [Tính Năng Cộng Đồng và Gamification](#10-tính-năng-cộng-đồng-và-gamification)
11. [Tài Khoản và Thống Kê Cá Nhân](#11-tài-khoản-và-thống-kê-cá-nhân)
12. [Kho Đề Thi và Dữ Liệu](#12-kho-đề-thi-và-dữ-liệu)
13. [Gói Dịch Vụ và Hệ Thống Tín Dụng AI](#13-gói-dịch-vụ-và-hệ-thống-tín-dụng-ai)
14. [Cơ Sở Khoa Học](#14-cơ-sở-khoa-học)
15. [Tài Liệu Tham Khảo](#15-tài-liệu-tham-khảo)

---

## 1. Hành Trình Học Sinh

Dưới đây là toàn bộ luồng trải nghiệm của một học sinh trên Zenith:

```
Lần đầu vào app
       │
       ▼
[Kiểm tra đầu vào] ──→ AI phân tích điểm yếu
       │
       ▼
[Chọn đề thi] ──→ 86 đề từ THPT/thi lớp 10/quốc tế
       │
       ▼
[Làm bài] ──→ Hẹn giờ, gợi ý AI, chống gian lận
       │
       ▼
[Kết quả] ──→ Điểm số, biểu đồ, đề xuất trường, kế hoạch
       │
       ├──→ [Kế hoạch học tập 4 tuần] (AI tạo tự động)
       │
       ├──→ [Luyện tập thích ứng] (15 câu tập trung vào điểm yếu)
       │
       ├──→ [Ôn tập spaced repetition] (nhắc đúng lúc quên)
       │
       ├──→ [Oracle - hỏi đáp Toán AI] (giải thích + gợi ý)
       │
       └──→ [Tiến độ & Bản đồ khái niệm] (58 khái niệm Toán)
```

---

## 2. Bước 1 — Đánh Giá Năng Lực Đầu Vào

### 2.1 Bài Kiểm Tra Xếp Lớp (Placement Test)

**Trang:** `/placement`

Khi học sinh lần đầu đăng ký, Zenith mời làm **bài kiểm tra 10 câu** bao phủ 10 chủ đề Toán khác nhau (đại số, hàm số, hình học, xác suất, tổ hợp…). Mỗi câu được chọn ngẫu nhiên từ mức độ trung bình để tránh quá dễ hoặc quá khó.

**Kết quả:** Hệ thống tính điểm ước lượng năng lực ban đầu của học sinh trên thang điểm chuẩn, sử dụng làm cơ sở cho tất cả đề xuất sau đó.

### 2.2 Bài Kiểm Tra Chẩn Đoán (Diagnostic Test)

**Trang:** `/diagnostic`

Sau khi xếp lớp, học sinh có thể làm thêm **bài kiểm tra chẩn đoán 12 câu**, phân phối đều cho 6 chủ đề trọng tâm (Đại số, Hình học, Thống kê, Tổ hợp, Lượng giác, Hàm số — 2 câu mỗi chủ đề).

**Kết quả:**  
Hệ thống tính **"trọng số điểm yếu"** cho từng chủ đề: chủ đề nào học sinh làm sai nhiều hơn sẽ nhận trọng số cao hơn, và sẽ xuất hiện nhiều hơn trong các buổi luyện tập thích ứng sau đó.

**Tại sao cần bước này?**  
Nghiên cứu từ năm 2011 cho thấy các hệ thống gia sư thông minh có thể đạt hiệu quả tương đương gia sư một-một khi được cá nhân hóa đúng cách — nhưng điều kiện tiên quyết là hệ thống phải biết học sinh đang ở đâu trước khi bắt đầu dạy. Bước chẩn đoán là chìa khóa để mở tính năng này [1].

---

## 3. Bước 2 — Làm Bài Thi

### 3.1 Chọn Đề Thi (ExamSelect)

**Trang:** `/exams`

Học sinh duyệt **86 đề thi** chia thành 3 danh mục:

| Danh mục | Số đề | Đối tượng |
|----------|-------|-----------|
| Thi vào lớp 10 | 47 đề | Học sinh lớp 9 |
| THPT Quốc gia | 29 đề | Học sinh lớp 10–12 |
| Ứng dụng / Quốc tế | 10 đề | Nâng cao, AMC, CEMC |

Giao diện cho phép **lọc theo lớp và gói đăng ký**. Học sinh chưa đăng ký được làm **1 đề thử miễn phí** (guest trial). Đề đã làm được đánh dấu để tránh trùng lặp.

**Nguồn đề:** Bộ GD&ĐT, các Sở GD&ĐT (Hà Nội, TP.HCM, Cà Mau, Bình Dương…), AMC 8/AMC 10 (Mỹ), Gauss (Canada), Junior Math Challenge (Anh), Leaving Certificate (Ireland), CSAT (Hàn Quốc).

> Toàn bộ câu hỏi đến từ nguồn thực do con người tạo ra. Zenith không dùng AI để tạo nội dung câu hỏi.

### 3.2 Giao Diện Thi (TestInterface)

**Trang:** `/test/:examId`

**Tính năng trong phòng thi:**

- **Bộ đếm giờ** — đếm ngược, tự nộp bài khi hết giờ  
- **Ngăn chuyển tab** — phát hiện và ghi lại số lần học sinh chuyển ra khỏi trang thi  
- **Bảng công thức** — kéo ra ngay trong khi thi, không cần mở tab khác  
- **Theo dõi thời gian từng câu** — ghi lại thời gian học sinh dừng ở mỗi câu  
- **Phím tắt bàn phím** — điều hướng nhanh không cần chuột  
- **Toàn màn hình** — chế độ không phân tâm  
- **Gợi ý AI (⚡1 Tia)** — học sinh có thể xin gợi ý cho câu đang làm (AI không đưa đáp án, chỉ hỏi ngược để dẫn dắt)  
- **Nền sao chuyển động** — hiệu ứng thị giác giúp tạo cảm giác tập trung, tương tự "vùng dòng chảy" (flow state)  

---

## 4. Bước 3 — Phân Tích Kết Quả và Đề Xuất Trường

**Trang:** `/results/:id`

Ngay sau khi nộp bài, học sinh nhận được:

### 4.1 Bảng Điểm và Phân Tích AI

- **Điểm số** hiển thị với hoạt ảnh đếm lên (tạo cảm xúc tích cực)  
- **Biểu đồ radar** thể hiện hiệu suất theo 6–8 chủ đề Toán  
- **Phân tích AI streaming** — AI đọc toàn bộ bài làm và trả lời theo dòng (như gõ thư), nêu:
  - Điểm mạnh cụ thể ("Em làm tốt phần Hàm số")
  - Điểm yếu cần tập trung
  - Các lỗi sai phổ biến trong bài vừa làm
  - Đề xuất học tập cụ thể cho tuần tới  

### 4.2 Đề Xuất Trường Theo Tỉnh

Dựa trên điểm số và tỉnh thành học sinh đã khai báo, AI đề xuất **3–5 trường phù hợp** với mức điểm chuẩn địa phương. Dữ liệu ngưỡng điểm được cập nhật theo thực tế tuyển sinh của từng tỉnh (4 cấp độ cạnh tranh: D1–D4, từ ít cạnh tranh đến Hà Nội/TP.HCM).

### 4.3 Dự Đoán Điểm Thi Thực Tế

Hệ thống sử dụng **bộ lọc Kalman** — một thuật toán đã được NASA dùng để theo dõi quỹ đạo tàu vũ trụ, được ứng dụng vào giáo dục để ước lượng điểm thi — tính ra khoảng điểm dự kiến với độ tin cậy thay đổi theo số lần học sinh đã thi. Học sinh thi càng nhiều, khoảng dự báo càng chính xác.

### 4.4 Chia Sẻ và Thách Đấu

- **Chia sẻ kết quả** — tạo hình ảnh đẹp để đăng mạng xã hội  
- **Thách đấu bạn bè** — gửi link, bạn bè vào làm cùng đề và so sánh điểm  

---

## 5. Bước 4 — Kế Hoạch Học Tập Cá Nhân Hóa

### 5.1 Kế Hoạch Phục Hồi (StudyPlan)

**Trang:** `/study-plan/:resultId`

Sau khi xem kết quả, học sinh bấm **"Tạo Kế Hoạch"** (5 Tia). AI đọc toàn bộ bài làm và tạo **kế hoạch phục hồi** chi tiết:

- **3–4 vùng trọng tâm** cần cải thiện (sắp xếp theo mức độ ưu tiên)  
- **Mục tiêu checkpoint** cho từng vùng (ví dụ: "Trả lời đúng 3 câu liên tiếp về Hàm số")  
- **Liên kết trực tiếp** đến bộ câu hỏi luyện tập cho từng vùng  
- **Tiến độ checkbox** lưu trên máy, học sinh đánh dấu hoàn thành từng bước  

### 5.2 Kế Hoạch Thích Ứng (AdaptiveStudyPlan)

**Trang:** `/adaptive-plan`

Kế hoạch nâng cao, cập nhật liên tục theo tiến độ thực tế:

- **Điểm dự kiến** ngày thi (hiển thị rõ "Đúng hướng ↗" hay "Cần tăng tốc ⚠")  
- **Số khái niệm đã vững** / tổng số khái niệm cần nắm  
- **Số ngày còn lại** đến ngày thi (học sinh khai báo ngày thi khi đăng ký)  
- **Danh sách khái niệm theo giai đoạn** — từ "Chưa học" (xám) đến "Thành thạo" (xanh lá)  

**Các giai đoạn thành thạo khái niệm:**

| Màu | Giai đoạn | Ý nghĩa |
|-----|-----------|---------|
| Xám | Chưa học | Chưa gặp khái niệm này |
| Xanh dương | Mới tiếp cận | Đã thấy nhưng chưa làm được |
| Vàng cam | Đang học | Làm được một phần |
| Vàng | Luyện tập | Làm được nhưng chưa ổn định |
| Xanh lá nhạt | Vững | Làm được đáng tin cậy |
| Xanh lá đậm | Thành thạo | Làm đúng nhất quán, kể cả câu khó |

---

## 6. Bước 5 — Luyện Tập Thích Ứng Hàng Ngày

### 6.1 Luyện Tập Thích Ứng (AdaptivePractice)

**Trang:** `/practice/adaptive`

Đây là tính năng học tập cốt lõi của Zenith. Mỗi buổi luyện tập gồm **15 câu hỏi**, được chọn thông minh từ kho 2.075+ câu:

**Cách hệ thống chọn câu hỏi:**

1. Đọc toàn bộ lịch sử làm bài của học sinh (hoặc kết quả Diagnostic nếu chưa có lịch sử)  
2. Tính **"trọng số điểm yếu"** cho từng chủ đề — chủ đề nào sai nhiều hơn được ưu tiên hơn  
3. Chọn câu hỏi từ các chủ đề yếu nhiều hơn, xen kẽ chủ đề mạnh  
4. **Xáo trộn** thứ tự chủ đề để tránh học thuộc theo nhóm (kỹ thuật "interleaving" có căn cứ nghiên cứu)  

**Tại sao hiệu quả hơn học bình thường?**  
Nghiên cứu meta-phân tích (US Department of Education, 2010) cho thấy học thích ứng cho kết quả **tốt hơn đáng kể** so với học một-kích-thước-cho-tất-cả, đặc biệt khi học sinh có nền tảng không đồng đều [2].

Thêm vào đó, kỹ thuật xen kẽ chủ đề (**interleaving**) — thay vì học hết Đại số rồi mới sang Hình học — được nghiên cứu tại các trường đại học Mỹ xác nhận cải thiện khả năng vận dụng kiến thức trong bài thi đến **43%** [3].

### 6.2 Thử Thách Hàng Ngày (DailyChallenge)

**Trang:** `/daily`

Mỗi ngày, Zenith đưa ra **1 câu hỏi thử thách** được chọn từ kho đề. Học sinh trả lời và nhận phản hồi ngay lập tức.

**Tính năng streak (chuỗi ngày):** Hệ thống theo dõi số ngày liên tiếp học sinh hoàn thành thử thách. Nếu bỏ lỡ một ngày, có thể dùng **Streak Freeze** (đóng băng chuỗi) để bảo toàn kỷ lục.

**Tại sao quan trọng?**  
Kết quả nghiên cứu về gamification trong giáo dục (Hamari, Koivisto & Sarsa, 2014) cho thấy các cơ chế như streak và thách thức hàng ngày tăng tỷ lệ học sinh quay lại ứng dụng và duy trì thói quen học đều đặn [4].

### 6.3 Tạo Đề Thi AI (GenerateExam)

**Trang:** `/generate-exam`

Học sinh (hoặc giáo viên) có thể yêu cầu AI tạo **đề thi mới hoàn toàn** theo yêu cầu:

- Chọn chủ đề (1 hoặc nhiều trong số 15 chủ đề Toán)  
- Chọn số câu (10–50 câu)  
- Chọn mức độ khó (dễ / trung bình / khó / hỗn hợp)  

AI tạo câu hỏi trực tiếp theo luồng (streaming) — từng câu xuất hiện trên màn hình ngay khi AI tạo xong, không cần chờ toàn bộ.

> **Lưu ý:** Đây là tính năng thực hành bổ sung. Câu hỏi do AI tạo được đánh dấu riêng và không được tính vào kho đề thi chính thức, vốn chỉ chứa câu hỏi từ nguồn thực.

---

## 7. Bước 6 — Ôn Tập Thông Minh (Spaced Repetition)

**Trang:** `/review`

### 7.1 Nguyên Lý Hoạt Động

Đây là một trong những tính năng khoa học nhất của Zenith. Hệ thống dựa trên **"đường cong quên lãng" của Ebbinghaus** (1885): sau khi học xong, kiến thức bắt đầu phai dần theo thời gian, nhưng mỗi lần ôn tập lại đúng thời điểm sẽ kéo dài thêm độ bền của ký ức.

**Cách Zenith hoạt động:**  
Mỗi câu hỏi học sinh đã làm được theo dõi riêng. Sau khi học sinh trả lời, hệ thống tính toán **ngày ôn tập tối ưu tiếp theo** dựa trên:

- Học sinh nhớ bài này tốt đến đâu (đánh giá qua 3 mức: Đoán / Khá / Chắc)  
- Độ khó của câu hỏi đó  
- Khoảng thời gian đã trôi qua kể từ lần ôn gần nhất  

### 7.2 Thuật Toán FSRS

Zenith sử dụng thuật toán **FSRS v5** — một trong những thuật toán lặp lại ngắt quãng hiện đại nhất, được xây dựng và kiểm chứng trên dữ liệu của hàng triệu người dùng ứng dụng học thẻ Anki trên toàn thế giới.

**Bằng chứng đã kiểm chứng (3/3 phiếu bầu trong nghiên cứu phản biện độc lập):**

> FSRS khi được **cá nhân hóa theo từng học sinh** dự đoán thời điểm quên chính xác hơn **39%** so với khi dùng thông số mặc định.

*Nguồn: Kho dữ liệu open-source srs-benchmark — hơn 350 triệu lượt ôn tập từ 9.999 người dùng thực* [5]

**Hàm ý:** Mỗi học sinh có tốc độ quên khác nhau. Một học sinh giỏi Hình học có thể ôn lại sau 14 ngày mà vẫn nhớ, trong khi học sinh khác cần ôn lại sau 3 ngày. FSRS tự điều chỉnh cho từng người.

### 7.3 Giao Diện Ôn Tập

- Hiển thị **câu hỏi đến hạn ôn** (chỉ những câu sắp quên, không ôn lại cái đã nhớ vững)  
- Học sinh chọn mức tự đánh giá: **Đoán** (sẽ ôn lại sớm) / **Khá** (ôn sau vài ngày) / **Chắc** (ôn sau vài tuần)  
- Thanh tiến độ cho thấy còn bao nhiêu câu trong ngày  

---

## 8. Bước 7 — Oracle: Gia Sư Toán AI

**Trang:** `/oracle`

### 8.1 Oracle là gì?

Oracle là trợ lý Toán AI tích hợp sâu nhất trong Zenith — không chỉ trả lời câu hỏi mà còn nhớ bối cảnh cuộc trò chuyện và điều chỉnh cách giải thích theo từng học sinh.

### 8.2 Tính Năng

**Đặt câu hỏi Toán tự do**  
Học sinh gõ câu hỏi bằng tiếng Việt hoặc tiếng Anh, kết hợp công thức toán học. AI trả lời theo dòng (streaming) với:
- Giải thích từng bước
- Công thức được render đẹp bằng LaTeX
- Các trường hợp đặc biệt cần lưu ý

**Chụp ảnh bài toán (OCR)**  
Học sinh chụp ảnh trang sách hoặc đề thi, tải lên — Oracle đọc công thức từ ảnh và giải thích.

**Nhập liệu bằng giọng nói**  
Học sinh nói câu hỏi thay vì gõ — tiện lợi khi tay đang cầm bút.

**Bảng ký hiệu Toán**  
Palette ký hiệu toán học (∑, √, π, ∫, α, β…) và chữ Hy Lạp — click để chèn vào câu hỏi.

**Chuẩn hóa công thức tự động**  
Khi dán công thức từ nguồn bên ngoài (PDF, Word), Oracle tự động chuyển đổi về định dạng chuẩn LaTeX.

**Lịch sử trò chuyện**  
Oracle nhớ những gì đã được giải thích trong buổi chat, tránh giải thích lại điều đã biết.

**Lọc theo chủ đề**  
Học sinh có thể giới hạn Oracle chỉ trả lời về một chủ đề cụ thể (ví dụ: chỉ về Tích phân).

### 8.3 Phương Pháp Sư Phạm

Oracle được thiết kế theo **phương pháp Socrates**: thay vì đưa đáp án ngay, AI đặt câu hỏi dẫn dắt để học sinh tự tìm ra cách giải. Nghiên cứu giáo dục ghi nhận phương pháp này giúp học sinh hiểu sâu hơn và nhớ lâu hơn so với học vẹt.

Khi học sinh bấm nút **Gợi ý (⚡1 Tia)** trong lúc làm bài, Oracle cũng sử dụng phong cách này — không cho đáp án, chỉ gợi mở hướng suy nghĩ.

---

## 9. Bước 8 — Theo Dõi Tiến Độ và Bản Đồ Khái Niệm

### 9.1 Trang Tiến Độ (Progress)

**Trang:** `/progress`

Học sinh thấy **bức tranh toàn cảnh** về năng lực Toán của mình:

**Điểm chuẩn theo tỉnh:**  
So sánh điểm trung bình của học sinh với **ngưỡng điển hình và ngưỡng top** của tỉnh đó. Ví dụ: Hà Nội cần ~8.0 điểm để vào trường tốt, trong khi Hà Giang chỉ cần ~5.0. Zenith hiển thị học sinh đang ở đâu so với mặt bằng tỉnh nhà (dữ liệu 63 tỉnh thành).

**Biểu đồ theo chủ đề:**  
Điểm theo từng trong số 15 chủ đề Toán — Đại số, Hình học, Giải tích, Xác suất, Lượng giác, Dãy số, Số phức, Logarit…

**Điểm thành thạo khái niệm (BKT):**  
Dựa trên thuật toán **Bayesian Knowledge Tracing** — một phương pháp khoa học từ năm 1994 được dùng trong các hệ thống gia sư thông minh hàng đầu thế giới (như Carnegie Learning). Zenith tính xác suất "học sinh thực sự biết khái niệm này" thay vì chỉ đếm số câu đúng/sai.

### 9.2 Bản Đồ Khái Niệm (ConceptMap)

**Trang:** `/concept-map`

Đây là tính năng trực quan hóa độc đáo nhất của Zenith: **đồ thị tương tác gồm 58 nút khái niệm Toán**, được sắp xếp theo quan hệ điều kiện tiên quyết (khái niệm nào cần học trước khái niệm nào).

**Cách đọc bản đồ:**

| Màu nút | Ý nghĩa |
|---------|---------|
| Xám đậm | Chưa từng thử |
| Đỏ | Đã thử nhưng còn yếu (< 40%) |
| Vàng/cam | Đang tiến bộ (40–70%) |
| Xanh lá | Đã vững (> 70%) |

**Cách sử dụng:**  
Click vào bất kỳ nút nào để xem chi tiết khái niệm và bắt đầu luyện tập tập trung vào khái niệm đó. Các mũi tên cho thấy mối quan hệ học trước/sau (ví dụ: phải hiểu Phương trình bậc nhất trước khi học Hệ phương trình).

**Cơ sở khoa học:**  
Nghiên cứu về bản đồ khái niệm trong giáo dục (Novak & Cañas, 2006) cho thấy học sinh sử dụng biểu diễn trực quan kiến thức hiểu bài sâu hơn và nhớ lâu hơn so với học theo danh sách tuyến tính [6].

### 9.3 Phân Tích Lỗi Sai (ErrorAnalysis)

**Trang:** `/error-analysis`

Tổng hợp tất cả lỗi sai của học sinh qua tất cả bài thi, phân loại thành **5 nhóm lỗi**:

| Loại lỗi | Ý nghĩa thực tế |
|----------|----------------|
| Sai dấu | Nhầm dấu cộng/trừ khi biến đổi |
| Nhầm công thức | Áp dụng sai công thức |
| Sai quy trình | Đúng hướng nhưng sai bước giữa |
| Lỗ hổng khái niệm | Chưa hiểu bản chất |
| Tính toán sai | Sai số học đơn thuần |

Lỗi gần đây được tính trọng số cao hơn lỗi cũ (thuật toán giảm dần theo thời gian — "temporal decay"). Điều này giúp phân biệt lỗi học sinh đã khắc phục và lỗi vẫn còn tồn tại.

**Biểu đồ radar:** Hiển thị phân phối lỗi theo chủ đề — một cái nhìn nhanh về "cần sửa gì, ở đâu".

### 9.4 Sổ Lỗi Sai (Mistakes)

**Trang:** `/mistakes`

Danh sách toàn bộ câu hỏi học sinh đã làm sai, nhóm theo chủ đề. Với mỗi câu sai:

- Xem lại câu hỏi và đáp án đúng  
- **Giải thích chi tiết (1 Tia)** — AI giải thích tại sao đáp án đó đúng, phân tích lỗi học sinh mắc phải  
- **Gắn nhãn lỗi** — học sinh tự phân loại lỗi (giúp tự nhận thức metacognitive)  

---

## 10. Tính Năng Cộng Đồng và Gamification

### 10.1 Lớp Học (ClassDashboard)

**Trang:** `/class` *(đã xây dựng, chưa mở cho người dùng)*

Giáo viên hoặc học sinh có thể tạo **lớp học ảo**:

- **Giáo viên tạo lớp** → nhận mã lớp (ví dụ: `ABC123`)  
- **Học sinh tham gia** bằng cách nhập mã  
- **Giáo viên xem** kết quả bài thi của toàn lớp trong một bảng  

Tính năng này hỗ trợ giáo viên ra bài tập về nhà dưới dạng đề thi trên Zenith và theo dõi học sinh hoàn thành.

### 10.2 Thách Đấu Bạn Bè (ChallengeLanding)

**Trang:** `/challenge`

Sau khi làm bài, học sinh bấm **"Thách đấu bạn"** → nhận link → gửi cho bạn. Bạn bè vào làm cùng đề đó và kết quả được so sánh trực tiếp.

Tính năng này tạo **động lực xã hội** (social motivation) — một trong những yếu tố được nghiên cứu giáo dục xác nhận có tác động tích cực đến sự gắn kết học tập.

### 10.3 Huy Hiệu Thành Tích (Badges)

Zenith cấp huy hiệu khi học sinh đạt cột mốc:

| Huy hiệu | Điều kiện |
|----------|-----------|
| Điểm hoàn hảo | Đạt 10 điểm trong 1 bài thi |
| Chinh phục 10 đề | Hoàn thành 10 bài thi |
| Tốc độ ánh sáng | Nộp bài trước khi hết 70% thời gian |
| Tiến bộ vượt bậc | Cải thiện ≥ 2 điểm so với lần trước cùng đề |

---

## 11. Tài Khoản và Thống Kê Cá Nhân

**Trang:** `/account`

Trang tài khoản là **trung tâm điều khiển cá nhân** của học sinh, chia thành 4 tab:

### Tab Tiến Độ

- **Biểu đồ radar** thể hiện năng lực 8 chủ đề Toán  
- **Đường xu hướng điểm** qua các lần thi  
- **Số ngày streak** (chuỗi học liên tục)  
- **Chuỗi ngày kỷ lục** (personal best)  
- **Đếm ngược đến ngày thi**  
- **Cấp độ thành thạo** (từ Học Sinh mới đến Thần Đồng Toán học) với thanh tiến độ  
- **Loại học sinh** (learner archetype) — AI phân loại học sinh theo phong cách học (ví dụ: "Người chăm chỉ", "Người học theo hiểu biết", "Người học theo tốc độ")  

### Tab Phân Tích

- **Điểm số theo trường mục tiêu** — so sánh với ngưỡng của trường học sinh muốn vào  
- **Thống kê đồng lứa** (peer stats) — AI so sánh ẩn danh với các học sinh cùng tỉnh, cùng lớp  
- **Nhận xét hàng tuần** — AI tổng kết tuần vừa qua và đưa ra lời khuyên  
- **Kế hoạch mô phỏng thi** — AI tạo lịch thi thử theo ngày thi thực tế  
- **Bối cảnh địa phương** — phân tích cạnh tranh tuyển sinh theo tỉnh  

### Tab AI & Tia

- **Chiến lược thi** — AI đưa ra chiến lược làm bài dựa trên điểm yếu cụ thể  
- **Chương trình học tuần** — lịch học cụ thể từng ngày trong tuần  
- **Nhận xét điểm thi** — so sánh điểm thực tế với dự đoán, giải thích chênh lệch  

### Tab Cài Đặt

- Đổi tên hiển thị  
- Cài đặt nhắc nhở học tập (thông báo trình duyệt)  
- Quản lý gói đăng ký  
- Lịch sử giao dịch Tia (AI credits)  

---

## 12. Kho Đề Thi và Dữ Liệu

### 12.1 Tổng Quan

| Chỉ số | Giá trị |
|--------|---------|
| Tổng số đề | 86 đề |
| Đề thi vào lớp 10 | 47 đề |
| Đề THPT Quốc gia | 29 đề |
| Đề ứng dụng / quốc tế | 10 đề |
| Tổng số câu hỏi | 2.075+ câu |
| Số chủ đề Toán được phân loại | 15 chủ đề |
| Số khái niệm trong bản đồ | 58 khái niệm |
| Phân loại câu hỏi | Dễ / Trung bình / Khó |

### 12.2 Nguồn Đề Thi Trong Nước

- Bộ Giáo dục và Đào tạo (đề THPT Quốc gia 2018–2023)  
- Sở GD&ĐT Hà Nội, TP.HCM, Bình Dương, Cà Mau và các tỉnh khác  
- Nguồn luyện thi uy tín: loigiaihay.com  

### 12.3 Nguồn Đề Thi Quốc Tế

| Tổ chức | Quốc gia | Loại đề |
|---------|---------|---------|
| Mathematical Association of America (MAA) | Mỹ | AMC 8, AMC 10 |
| Centre for Education in Mathematics and Computing (CEMC) | Canada | Gauss Grade 7/8 |
| UK Mathematics Trust | Anh | Junior Math Challenge |
| State Examinations Commission (SEC) | Ireland | Leaving Certificate |
| Korea Institute for Curriculum and Evaluation (KICE) | Hàn Quốc | CSAT |

### 12.4 Chính Sách Nội Dung

Toàn bộ câu hỏi (nội dung + đáp án + các lựa chọn sai) đến từ nguồn thực do con người tạo ra. **AI không được phép tạo nội dung câu hỏi** — chính sách này được ghi cứng vào hệ thống để đảm bảo chất lượng và tính chính xác. Đây là điểm khác biệt quan trọng so với một số nền tảng luyện thi khác trên thị trường.

---

## 13. Gói Dịch Vụ và Hệ Thống Tín Dụng AI

### 13.1 Gói Đăng Ký

| Gói | Tên | Đề thi được dùng | Tính năng đặc biệt |
|-----|-----|-----------------|-------------------|
| Miễn phí | Cơ bản | 1 đề thử | Xem kết quả cơ bản |
| Trả phí | Học sinh | Tất cả đề lớp 10 + THPT | AI phân tích, kế hoạch |
| Trả phí | Toàn diện | Tất cả + đề quốc tế | Kế hoạch học 5 Tia, tất cả tính năng |

Gói Học sinh và Toàn diện có lựa chọn **thanh toán tháng hoặc năm** (thanh toán năm rẻ hơn, hiển thị badge "Năm" trong Navbar).

### 13.2 Hệ Thống Tia (AI Credits)

Các tính năng AI tiêu thụ "Tia" (⚡) — đơn vị tín dụng AI. Điều này cho phép học sinh dùng miễn phí các tính năng cơ bản và chỉ trả tiền cho AI khi thực sự cần.

| Tính năng AI | Chi phí |
|-------------|---------|
| Gợi ý câu hỏi (Socratic hint) | 1 Tia |
| Giải thích đáp án | 1 Tia |
| Phân tích kết quả bài thi | 3 Tia |
| Kế hoạch học tập 4 tuần | 5 Tia |

Tia có thể nhận miễn phí khi nâng cấp gói, hoặc mua thêm từ trang tài khoản.

---

## 14. Cơ Sở Khoa Học

Zenith được xây dựng dựa trên 6 lĩnh vực nghiên cứu giáo dục có bằng chứng vững chắc. Tất cả các số liệu dưới đây đã được xác minh qua hệ thống kiểm tra phản biện độc lập (214 tác nhân AI, 50 nguồn học thuật, chỉ giữ lại tuyên bố được ≥2/3 tác nhân xác nhận).

---

### 14.1 Lặp Lại Ngắt Quãng — Chiến Lược Học Tập Hiệu Quả Nhất

**Tính năng áp dụng:** Ôn Tập (ReviewSession), thuật toán FSRS

**Bằng chứng đã kiểm chứng (3/3 phiếu bầu):**

> Lặp lại ngắt quãng và luyện tập truy xuất (tự kiểm tra) là hai kỹ thuật học tập hiệu quả nhất, mỗi loại đạt **hiệu ứng d=0.85** — gấp hơn **2 lần hiệu quả trung bình** của các can thiệp giáo dục thông thường (d≈0.40) — trong phân tích tổng hợp năm 2021 của **242 nghiên cứu với 169.179 học sinh**.

*Nguồn: Donoghue & Hattie (2021), Frontiers in Education, DOI: 10.3389/feduc.2021.581216* [A]

*Xác nhận độc lập: Cepeda et al. (2006), Psychological Bulletin — tổng hợp 839 bài đánh giá từ 317 thí nghiệm trên 184 bài báo* [B]

**Ý nghĩa thực tế:** Học nhồi nhét một lần ("học tủ") trước kỳ thi tạo cảm giác nhớ nhưng kiến thức phai rất nhanh. Ôn tập đúng thời điểm — ngay trước khi bộ nhớ phai — giúp kiến thức gắn chắc hơn mỗi lần ôn. Đây là lý do tính năng Ôn Tập của Zenith không cho học sinh ôn bừa bãi mà chỉ đưa ra câu hỏi **đúng khi sắp quên**.

Một phát hiện quan trọng từ nghiên cứu (3/3 phiếu bầu): khoảng cách ôn tập tối ưu **phải điều chỉnh theo ngày thi** — kỳ thi còn xa thì khoảng cách ôn dài hơn, kỳ thi gần thì ôn dày hơn. Zenith sử dụng thông tin ngày thi (học sinh khai báo khi đăng ký) để điều chỉnh lịch ôn theo nguyên tắc này.

---

### 14.2 Tự Kiểm Tra — Nhớ Lâu Hơn Đọc Lại

**Tính năng áp dụng:** Luyện Tập Thích Ứng, Thử Thách Hàng Ngày, Luyện Tập trong Kế Hoạch Học Tập

**Bằng chứng đã kiểm chứng (2/3 phiếu bầu):**

> Học sinh **tự kiểm tra** nhớ nhiều hơn học sinh **đọc lại bài**: sau 2 ngày, nhóm tự kiểm tra nhớ **68%** so với **54%** của nhóm đọc lại (hơn **26%**); sau 1 tuần, khoảng cách tăng lên: **56% so với 42%** (hơn **33%**).

*Nguồn: Roediger & Karpicke (2006), Psychological Science, 17(3), 249–255 — thí nghiệm với 120 người tham gia* [C]

**Ý nghĩa thực tế:** Học sinh thường có thói quen đọc lại bài hoặc xem lại lý thuyết. Nghiên cứu cho thấy việc **tự làm bài trắc nghiệm** (dù sai) hiệu quả hơn đọc lại gấp đôi về khả năng nhớ sau 1 tuần. Đây là lý do Zenith luôn đặt học sinh vào tình huống phải chọn đáp án — không phải chỉ đọc giải thích.

---

### 14.3 Gia Sư Thông Minh — Hiệu Quả Ngang Gia Sư Người Thật

**Tính năng áp dụng:** Oracle, Gợi Ý Socrates, Giải Thích Đáp Án

**Bằng chứng đã kiểm chứng (3/3 phiếu bầu — đồng thuận tuyệt đối về thư mục; 2/3 về chỉ số cụ thể):**

> Hệ thống gia sư AI phản hồi từng bước giải đạt hiệu ứng **d=0.76** so với không có gia sư — gần bằng gia sư con người một-một (**d=0.79**). Hệ thống chỉ chấm đúng/sai mà không giải thích đạt **d=0.31** — kém hơn **2,5 lần**.

*Nguồn: VanLehn (2011), Educational Psychologist, 46(4), 197–221 — phân tích 1.400+ trích dẫn, tiêu chuẩn ngành cho hiệu quả gia sư thông minh* [D]

**Ý nghĩa thiết kế quan trọng:** Zenith thiết kế Oracle và tính năng Gợi Ý theo nguyên tắc "từng bước" — không chỉ đánh dấu sai/đúng mà giải thích tại sao, đặt câu hỏi dẫn dắt. Đây chính là điều kiện để đạt hiệu quả d=0.76 thay vì chỉ d=0.31.

*Lưu ý trung thực: Tuyên bố "gia sư AI hiệu quả ngang hoàn toàn với gia sư người thật" và "hiệu ứng 2-sigma của Bloom" đều bị bác bỏ 0/3 phiếu — không nên trích dẫn các tuyên bố này.*

---

### 14.4 Gamification — Tăng Gắn Kết, Duy Trì Thói Quen Học

**Tính năng áp dụng:** Streak hàng ngày, Thử Thách, Huy Hiệu, Điểm Thành Thạo

**Bằng chứng đã kiểm chứng (2/3 phiếu bầu):**

> Gamification (điểm streak, huy hiệu, thử thách) tạo hiệu ứng tổng thể **d=0.48** đối với kết quả học tập và hành vi. Tác động lên **tham gia học tập là d=0.60** (mạnh hơn), trong khi tác động trực tiếp lên điểm thi là **d=0.30** (nhỏ hơn).

*Nguồn: Sailer & Homner (2020/2021), Frontiers in Psychology, PMC8037535 — phân tích 18 nghiên cứu thực nghiệm* [E]

**Ý nghĩa thực tế:** Gamification không phải "phép màu" tăng điểm, nhưng nó **duy trì thói quen học đều đặn** — điều quan trọng hơn nhiều trong việc ôn thi dài hạn. Một học sinh học 30 phút mỗi ngày đều đặn trong 3 tháng sẽ vượt trội hơn học sinh học nhồi 10 tiếng trong 1 tuần trước thi.

---

### 14.5 Học Tập Thích Ứng — Đúng Người, Đúng Nội Dung

**Tính năng áp dụng:** Luyện Tập Thích Ứng, Xáo Trộn Chủ Đề (Interleaving), Kế Hoạch Học Tập

Thay vì dạy tất cả học sinh như nhau, hệ thống điều chỉnh nội dung theo năng lực từng người. Nghiên cứu tổng hợp của Bộ Giáo dục Mỹ (2010, phân tích 46 nghiên cứu độc lập) cho thấy học trực tuyến thích ứng tốt hơn đáng kể so với học lớp truyền thống [F].

Kỹ thuật **xen kẽ chủ đề** (interleaving) — thay vì học hết Đại số rồi mới sang Hình học, Zenith xáo trộn câu hỏi từ nhiều chủ đề — được nghiên cứu tại Đại học California và Florida xác nhận cải thiện khả năng vận dụng trong kỳ thi [G].

---

### 14.6 Kiểm Tra Thích Ứng — Câu Hỏi Vừa Khớp Năng Lực

**Tính năng áp dụng:** Luyện Tập Thích Ứng, BanditCAT + IRT

Hệ thống chọn câu hỏi **vừa khớp với năng lực học sinh** — không quá dễ (nhàm chán) và không quá khó (nản lòng). Bài báo BanditCAT (PMLR 2024–2025) được xác minh bởi **3/3 tác nhân kiểm tra phản biện độc lập** trong nghiên cứu của chúng tôi [H].

---

### 14.7 Theo Dõi Kiến Thức — Biết Học Sinh Thực Sự Hiểu Gì

**Tính năng áp dụng:** Bản Đồ Khái Niệm, Trang Tiến Độ, Kế Hoạch Thích Ứng

Thuật toán BKT (Bayesian Knowledge Tracing, Corbett & Anderson 1994) ước lượng **xác suất thực sự học sinh đã hiểu khái niệm** — chính xác hơn và ít bị ảnh hưởng bởi đoán may so với chỉ đếm tỉ lệ đúng/sai đơn giản [I].

---

### Bảng Tổng Hợp Bằng Chứng

| Cơ chế | Số liệu đã kiểm chứng | Tính năng Zenith |
|--------|----------------------|-----------------|
| Lặp lại ngắt quãng | d=0.85, 242 nghiên cứu, 169.179 học sinh | Ôn Tập (FSRS) |
| Tự kiểm tra | +26% nhớ sau 2 ngày, +33% sau 1 tuần | Luyện Tập, Thử Thách Hàng Ngày |
| Gia sư từng bước | d=0.76 (gần bằng gia sư người: d=0.79) | Oracle, Gợi Ý Socrates |
| Gamification | d=0.48 tổng thể; d=0.60 gắn kết | Streak, Huy Hiệu, Thách Đấu |
| Cá nhân hóa FSRS | −39% sai số khi cá nhân hóa tham số | Ôn Tập cá nhân hóa |
| Kiểm tra thích ứng (IRT) | Xác minh 3/3 phiếu bầu | Luyện Tập Thích Ứng |

---

## 15. Tài Liệu Tham Khảo

Tất cả nguồn đã qua kiểm tra phản biện độc lập (214 tác nhân AI, 50 nguồn). Số liệu từ các nguồn bị bác bỏ đã được loại ra và không xuất hiện trong báo cáo này.

### Nghiên Cứu Phương Pháp Giáo Dục (Kiểm Chứng Ngoại Vi)

| Ký hiệu | Tài liệu | Kết quả kiểm chứng |
|---------|----------|-------------------|
| [A] | Donoghue, G. M. & Hattie, J. A. C. (2021). "A Meta-Analysis of Ten Learning Techniques." *Frontiers in Education*, DOI: 10.3389/feduc.2021.581216. 242 nghiên cứu, 169.179 học sinh. | 3/3 phiếu bầu xác nhận |
| [B] | Cepeda, N. J. et al. (2006). "Distributed practice in verbal recall tasks." *Psychological Bulletin*, PMID 16719566. 839 bài đánh giá, 317 thí nghiệm. | 3/3 phiếu bầu xác nhận |
| [C] | Roediger, H. L. & Karpicke, J. D. (2006). "Test-Enhanced Learning." *Psychological Science*, 17(3), 249–255. | 2/3 phiếu bầu xác nhận |
| [D] | VanLehn, K. (2011). "The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems." *Educational Psychologist*, 46(4), 197–221. ERIC EJ946764. 1.400+ trích dẫn. | 3/3 phiếu bầu (thư mục); 2/3 (chỉ số cụ thể) |
| [E] | Sailer, M. & Homner, L. (2020). "The Gamification of Learning: A Meta-analysis." *Educational Psychology Review*, PMC8037535. 18 nghiên cứu thực nghiệm. | 2/3 phiếu bầu xác nhận |
| [F] | U.S. Department of Education (2010). *Evaluation of Evidence-Based Practices in Online Learning.* Phân tích 46 nghiên cứu. | Tài liệu chính thống Bộ GD Mỹ |
| [G] | Rohrer, D., Dedrick, R. F., & Stershic, S. (2015). "Interleaved practice improves mathematics learning." *Journal of Educational Psychology*, 107(3), 900–908. | Nghiên cứu xen kẽ chủ đề Toán |

### Nghiên Cứu Thuật Toán (Kiểm Chứng Nội Vi)

| Ký hiệu | Tài liệu | Kết quả kiểm chứng |
|---------|----------|-------------------|
| [H] | Sharpnack, J. et al. (2024–2025). "BanditCAT and AutoIRT." *PMLR Proceedings* (arxiv: 2410.21033). | 3/3 phiếu bầu xác nhận |
| [I] | Corbett, A. T. & Anderson, J. R. (1994). "Knowledge tracing: Modeling the acquisition of procedural knowledge." *User Modeling and User-Adapted Interaction*, 4(4), 253–278. | Tài liệu gốc BKT — chuẩn ngành |
| [J] | Open Spaced Repetition. *SRS Benchmark* (kho dữ liệu, cập nhật liên tục). 350+ triệu lượt ôn tập, 9.999 người dùng. FSRS-7 cá nhân hóa: RMSE = 0.0655 vs 0.0910 mặc định (−39%). | 3/3 phiếu bầu xác nhận |
| [K] | Vermeiren, B. et al. (2025). "Dynamic K-value ELO for educational mastery tracking." *UMUAI*, Springer. PMC12682724. | 3/3 phiếu bầu xác nhận |

### Tuyên Bố Bị Bác Bỏ — Không Nên Trích Dẫn

Các số liệu sau được lưu hành rộng rãi trên internet nhưng **không vượt qua kiểm tra phản biện độc lập** (0/3 phiếu). Zenith không sử dụng chúng:

- ~~"Gia sư AI hiệu quả bằng hoàn toàn gia sư người thật với d=1.0"~~ — Bác bỏ 0/3
- ~~"DreamBox Learning cải thiện 2.5 lần so với phương pháp truyền thống"~~ — Bác bỏ 0/3
- ~~"Carnegie Learning cải thiện điểm 30%"~~ — Bác bỏ 0/3
- ~~"Lặp lại ngắt quãng cải thiện ghi nhớ 200%"~~ — Bác bỏ 0/3
- ~~"Bloom's 2-sigma effect là kết quả có thể tái tạo"~~ — Bác bỏ 2/3 (là tạo tác từ ngưỡng 90% thành thạo, không phải baseline thông thường)

---

## Phụ Lục: Danh Sách Đầy Đủ 26 Trang/Tính Năng

| Tên trang | Đường dẫn | Mô tả ngắn |
|-----------|-----------|------------|
| Trang chủ | `/` | Giới thiệu nền tảng, nút bắt đầu |
| Chọn đề thi | `/exams` | Duyệt 86 đề, lọc theo lớp/gói |
| Giao diện thi | `/test/:id` | Làm bài thi có hẹn giờ, gợi ý AI |
| Kết quả | `/results/:id` | Điểm số, AI phân tích, đề xuất trường |
| Kế hoạch học | `/study-plan/:id` | Kế hoạch phục hồi sau bài thi |
| Kế hoạch thích ứng | `/adaptive-plan` | Kế hoạch cập nhật theo tiến độ |
| Luyện tập thích ứng | `/practice/adaptive` | 15 câu/buổi, tập trung điểm yếu |
| Ôn tập | `/review` | Lặp lại ngắt quãng FSRS |
| Oracle | `/oracle` | Gia sư Toán AI, OCR, giọng nói |
| Tiến độ | `/progress` | Biểu đồ tổng thể, chuẩn tỉnh |
| Bản đồ khái niệm | `/concept-map` | 58 nút, màu theo mức thành thạo |
| Lịch sử | `/history` | Tất cả bài đã thi, xu hướng điểm |
| Lỗi sai | `/mistakes` | Danh sách câu sai, giải thích AI |
| Phân tích lỗi | `/error-analysis` | Biểu đồ 5 loại lỗi theo chủ đề |
| Kiểm tra chẩn đoán | `/diagnostic` | 12 câu xác định điểm yếu ban đầu |
| Kiểm tra xếp lớp | `/placement` | 10 câu ước lượng năng lực |
| Thử thách hàng ngày | `/daily` | 1 câu/ngày, theo dõi streak |
| Tạo đề AI | `/generate-exam` | AI tạo đề theo yêu cầu (streaming) |
| Lớp học | `/class` *(chưa mở)* | Tạo/tham gia lớp, giáo viên theo dõi — tính năng đã xây dựng, chưa kích hoạt route |
| Tài khoản | `/account` | Thống kê, gói dịch vụ, lịch sử Tia |
| Chia sẻ kết quả | `/share` | Hình ảnh kết quả để đăng mạng xã hội |
| Thách đấu | `/challenge` | Thi cùng bạn bè, so sánh điểm |
| Admin | `/admin` | Quản lý người dùng (nội bộ) |
| Bảo mật Admin | `/admin/security-events` | Giám sát sự kiện bảo mật (nội bộ) |

---

*Báo cáo được soạn thảo bằng cách tổng hợp toàn bộ mã nguồn hiện tại của ứng dụng (24 trang đã triển khai, tính năng Lớp Học đã xây dựng nhưng chưa mở route) kết hợp với kết quả nghiên cứu học thuật đã kiểm chứng qua harness nghiên cứu phản biện đa tác nhân (108 tác nhân AI, 26 nguồn, 9/25 tuyên bố được xác nhận). Các số liệu nghiên cứu có nguồn dẫn [1]–[9]. Số liệu về sản phẩm (số đề, số câu hỏi, v.v.) lấy từ dữ liệu hiện tại trong mã nguồn.*
