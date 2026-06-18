# Question Image Audit

**Total questions:** 2075  
**Total exams:** 86  
**Local images directory:** `exam-app\public\images\questions`  
**PNG files on disk:** 63

## Summary

| Class | Count | Meaning |
|-------|------:|---------|
| `HAS_LOCAL_IMAGE` | 63 | Local PNG present and file exists on disk — OK |
| `HAS_LOCAL_MISSING` | 0 | `image` field set but PNG **not found** on disk — BROKEN |
| `HAS_EXTERNAL_LINK` | 0 | `imageLink` only — external URL, no local image |
| `HAS_FIGURE_SVG` | 0 | Inline SVG via `figure.data` — OK |
| `NEEDS_IMAGE` | 46 | Text references a figure but **no** image/imageLink/figure — MISSING |
| `EXPLANATION_REF` | 0 | Explanation references a figure; question body does not have one |
| `CLEAN` | 1966 | No visual reference detected |

> **Adaptive Practice filter impact:** 46 questions are currently excluded from the adaptive pool due to image references without a local `image` field (governed by `questionUtils.js` IMAGE_REF_RE).

## Issues by Exam

| Exam | Missing file | Ext. link | Needs image | Expl-only |
|------|------------:|----------:|------------:|----------:|
| `intl_bece_gh_2022` | 0 | 0 | 1 | 0 |
| `lop10_lgh_173478` | 0 | 0 | 1 | 0 |
| `lop10_lgh_177656` | 0 | 0 | 1 | 0 |
| `lop10_lgh_177657` | 0 | 0 | 1 | 0 |
| `lop10_lgh_177714` | 0 | 0 | 1 | 0 |
| `lop10_lgh_180840` | 0 | 0 | 1 | 0 |
| `lop10_lgh_182313` | 0 | 0 | 3 | 0 |
| `lop10_lgh_182339` | 0 | 0 | 3 | 0 |
| `lop10_lgh_182635` | 0 | 0 | 4 | 0 |
| `thithu_camau19` | 0 | 0 | 8 | 0 |
| `thithu_hungvuong19` | 0 | 0 | 2 | 0 |
| `thithu_ninhbinh19` | 0 | 0 | 5 | 0 |
| `thpt_2018` | 0 | 0 | 5 | 0 |
| `thpt_2019` | 0 | 0 | 10 | 0 |

## NEEDS_IMAGE (46 questions)

Text explicitly references a figure but the question has no `image`, `imageLink`, or `figure` field. These questions are **excluded from Adaptive Practice** and show incomplete UI in Exam/Practice modes. Official source PDFs required to fix.

| ID | Exam | Topic | Difficulty | Question (excerpt) |
|----|------|-------|------------|-------------------|
| `q_lgh_173478_12` | `lop10_lgh_173478` | căn thức | easy | Cho hình vẽ, độ dài cạnh BC là |
| `q_lgh_180840_05` | `lop10_lgh_180840` | hình học | medium | Có bao nhiêu tứ giác nội tiếp trong hình sau: |
| `q_lgh_177656_11` | `lop10_lgh_177656` | căn thức | easy | Cho hình vẽ. Diện tích phần tô màu là: |
| `q_lgh_177657_10` | `lop10_lgh_177657` | hệ phương trình | medium | Cho hình vẽ. Biết $\widehat {BOC} = 110^\circ$ . Số đo của $\overset\frown{BnC}$ bằng: |
| `q_lgh_177714_10` | `lop10_lgh_177714` | hệ phương trình | easy | Cho hình vẽ. Chọn khẳng định đúng. |
| `q_lgh_182313_01` | `lop10_lgh_182313` | hệ phương trình | easy | Cho đồ thị hàm số $y = a{x^2}$ là parabol như hình vẽ. Khi đó giá trị của $a$ bằng |
| `q_lgh_182313_08` | `lop10_lgh_182313` | đại số | easy | Trong các hình vẽ sau, hình nào có dạng đa giác đều? |
| `q_lgh_182313_12` | `lop10_lgh_182313` | căn thức | easy | Cho hình vẽ dưới đây Bán kính hình cầu bằng |
| `q_lgh_182339_07` | `lop10_lgh_182339` | hình học | medium | Trong các hình sau, hình nào sau đây không nội tiếp được đường tròn? |
| `q_lgh_182339_09` | `lop10_lgh_182339` | đại số | easy | Trong các hình dưới đây hình nào vẽ hai điểm A và B thỏa mãn phép quay thuận chiều $60^\ci… |
| `q_lgh_182339_12` | `lop10_lgh_182339` | hệ phương trình | easy | Tính diện tích mặt cầu của quả địa cầu trong hình vẽ sau, biết đường kính quả địa cầu $d =… |
| `q_lgh_182635_07` | `lop10_lgh_182635` | hệ phương trình | medium | Cho hình vẽ. Biết HA là tiếp tuyến của (O); I là trung điểm của BC và $\widehat {AHB} = 45… |
| `q_lgh_182635_09` | `lop10_lgh_182635` | đại số | easy | Cho vòng quay mặt trời gổm 8 cabin như hình vẽ. Hỏi để cabin A di chuyển đến vị trí cao nh… |
| `q_lgh_182635_10` | `lop10_lgh_182635` | hình học | medium | Cho hình trụ nội tiếp trong hình lập phương có cạnh bằng 40 cm (như hình vẽ). Khẳng định n… |
| `q_lgh_182635_12` | `lop10_lgh_182635` | hình học không gian | easy | Quan sát hình sau cho biết phần chung giữa mặt phẳng và hình cầu là hình gì? |
| `q_bece22_27` | `intl_bece_gh_2022` | geometry | medium | Trong cùng hình vẽ trên, góc ABC = 81° và góc DCE = 20°. Tìm y, biết y là góc bù của x. |
| `q_thpt19_003` | `thpt_2019` | functions | easy | Cho hàm số có bảng biến thiên như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.… |
| `q_thpt19_006` | `thpt_2019` | functions | easy | Đồ thị của hàm số nào có dạng như đường cong trong hình vẽ? *(Xem hình vẽ/bảng biến thiên… |
| `q_thpt19_014` | `thpt_2019` | functions | easy | Cho hàm số có bảng biến thiên như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.… |
| `q_thpt19_016` | `thpt_2019` | functions | medium | Cho đồ thị hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*… |
| `q_thpt19_028` | `thpt_2019` | functions | medium | Tổng số tiệm cận đứng và tiệm cận ngang của đồ thị hàm số cho trong hình vẽ bằng: *(Xem hì… |
| `q_thpt19_029` | `thpt_2019` | calculus | medium | Diện tích hình phẳng giới hạn bởi $y=f(x)$, $y=0$, $x=1$, $x=4$ với đồ thị như hình vẽ *(X… |
| `q_thpt19_035` | `thpt_2019` | functions | medium | Cho đồ thị hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*… |
| `q_thpt19_036` | `thpt_2019` | functions | hard | Cho đồ thị hàm số $y=f(x)$ trên $[0;2]$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đ… |
| `q_thpt19_043` | `thpt_2019` | functions | hard | Cho hàm bậc ba $y=f(x)$ với đồ thị như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi… |
| `q_thpt19_046` | `thpt_2019` | functions | hard | Cho hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)* Số điểm… |
| `q_thpt18_003` | `thpt_2018` | functions | easy | Cho đồ thị hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*… |
| `q_thpt18_004` | `thpt_2018` | functions | easy | Cho hàm số có bảng biến thiên như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.… |
| `q_thpt18_011` | `thpt_2018` | functions | easy | Đường cong trong hình vẽ là đồ thị của hàm số nào? *(Xem hình vẽ/bảng biến thiên trong đề… |
| `q_thpt18_017` | `thpt_2018` | functions | medium | Cho đồ thị hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*… |
| `q_thpt18_050` | `thpt_2018` | functions | hard | Cho các hàm số $f(x)$, $g(x)$ thỏa điều kiện đồ thị như hình vẽ. *(Xem hình vẽ/bảng biến t… |
| `q_camau19_003` | `thithu_camau19` | functions | easy | Hàm số $y=f(x)$ đồng biến trên khoảng nào? *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.… |
| `q_camau19_004` | `thithu_camau19` | complex_numbers | easy | Điểm $M$ là điểm biểu diễn của số phức $z$ nào trong mặt phẳng phức? *(Xem hình vẽ/bảng bi… |
| `q_camau19_009` | `thithu_camau19` | functions | easy | Giá trị cực đại của hàm số $y=f(x)$ (xem đồ thị) bằng: *(Xem hình vẽ/bảng biến thiên trong… |
| `q_camau19_020` | `thithu_camau19` | calculus | medium | Công thức tính diện tích phần hình phẳng được tô màu như hình vẽ *(Xem hình vẽ/bảng biến t… |
| `q_camau19_025` | `thithu_camau19` | functions | medium | Cho đồ thị hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*… |
| `q_camau19_027` | `thithu_camau19` | functions | medium | Đường cong là đồ thị của hàm số nào (xem hình vẽ)? *(Xem hình vẽ/bảng biến thiên trong đề… |
| `q_camau19_049` | `thithu_camau19` | functions | hard | Cho $f(x)$ thỏa điều kiện cho sẵn. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)* Số ng… |
| `q_camau19_050` | `thithu_camau19` | functions | hard | Hàm số $g(x)=f(x^2-2)$ nghịch biến trên khoảng nào (xem đồ thị $f$)? *(Xem hình vẽ/bảng bi… |
| `q_ninhbinh19_002` | `thithu_ninhbinh19` | functions | easy | Với bảng biến thiên cho sẵn *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*, tìm $m$ để… |
| `q_ninhbinh19_022` | `thithu_ninhbinh19` | functions | medium | Hàm số $y=ax^3+bx^2+cx+d$ ($a\neq 0$) với đồ thị cho sẵn. *(Xem hình vẽ/bảng biến thiên tr… |
| `q_ninhbinh19_023` | `thithu_ninhbinh19` | functions | medium | Cho đồ thị hàm số $y=f(x)$ như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*… |
| `q_ninhbinh19_036` | `thithu_ninhbinh19` | functions | hard | Hàm số $y=ax^4+bx^2+c$ ($a\neq 0$) với đồ thị cho sẵn. *(Xem hình vẽ/bảng biến thiên trong… |
| `q_ninhbinh19_040` | `thithu_ninhbinh19` | functions | hard | Bất phương trình $2f(x)\geq x^2-4x+m$ đúng với mọi $x\in[-1;3]$ (xem đồ thị $f$) *(Xem hìn… |
| `q_hungvuong19_013` | `thithu_hungvuong19` | functions | easy | Cho hàm số $y=f(x)$ có bảng biến thiên như hình vẽ. *(Xem hình vẽ/bảng biến thiên trong đề… |
| `q_hungvuong19_019` | `thithu_hungvuong19` | functions | medium | Đường cong trong hình vẽ là đồ thị hàm số nào? *(Xem hình vẽ/bảng biến thiên trong đề thi… |

## Local Image Inventory (HAS_LOCAL_IMAGE)

All questions with a local PNG confirmed present on disk:

| ID | image path | File size |
|----|-----------|----------:|
| `q_amc8_19_21` | `/images/questions/q_amc8_19_21.png` | 2,605 B |
| `q_amc8_19_22` | `/images/questions/q_amc8_19_22.png` | 29,749 B |
| `q_amc8_19_23` | `/images/questions/q_amc8_19_23.png` | 21,966 B |
| `q_amc8_19_24` | `/images/questions/q_amc8_19_24.png` | 9,793 B |
| `q_amc8_19_25` | `/images/questions/q_amc8_19_25.png` | 7,811 B |
| `q_amc8_22v_18` | `/images/questions/q_amc8_22v_18.png` | 10,110 B |
| `q_amc8_22v_19` | `/images/questions/q_amc8_22v_19.png` | 3,521 B |
| `q_amc8_22v_20` | `/images/questions/q_amc8_22v_20.png` | 36,287 B |
| `q_amc8_22v_21` | `/images/questions/q_amc8_22v_21.png` | 11,354 B |
| `q_amc8_22v_22` | `/images/questions/q_amc8_22v_22.png` | 18,249 B |
| `q_amc8_22v_23` | `/images/questions/q_amc8_22v_23.png` | 8,377 B |
| `q_amc8_22v_24` | `/images/questions/q_amc8_22v_24.png` | 3,182 B |
| `q_amc8_22v_25` | `/images/questions/q_amc8_22v_25.png` | 10,066 B |
| `q_cemc_g8_23_20` | `/images/questions/q_cemc_g8_23_20.png` | 44,468 B |
| `q_cemc_g8_23_21` | `/images/questions/q_cemc_g8_23_21.png` | 44,993 B |
| `q_cemc_g8_23_22` | `/images/questions/q_cemc_g8_23_22.png` | 29,884 B |
| `q_cemc_g8_23_23` | `/images/questions/q_cemc_g8_23_23.png` | 29,682 B |
| `q_cemc_g8_23_24` | `/images/questions/q_cemc_g8_23_24.png` | 45,389 B |
| `q_cemc_g8_23_25` | `/images/questions/q_cemc_g8_23_25.png` | 48,419 B |
| `q_ukmt_imc20_15` | `/images/questions/q_ukmt_imc20_15.png` | 19,685 B |
| `q_ukmt_imc20_16` | `/images/questions/q_ukmt_imc20_16.png` | 31,080 B |
| `q_ukmt_imc20_17` | `/images/questions/q_ukmt_imc20_17.png` | 32,741 B |
| `q_ukmt_imc20_18` | `/images/questions/q_ukmt_imc20_18.png` | 37,248 B |
| `q_ukmt_imc20_19` | `/images/questions/q_ukmt_imc20_19.png` | 53,926 B |
| `q_ukmt_imc20_20` | `/images/questions/q_ukmt_imc20_20.png` | 35,118 B |
| `q_ukmt_imc20_21` | `/images/questions/q_ukmt_imc20_21.png` | 28,986 B |
| `q_ukmt_imc20_22` | `/images/questions/q_ukmt_imc20_22.png` | 37,312 B |
| `q_ukmt_imc20_23` | `/images/questions/q_ukmt_imc20_23.png` | 49,340 B |
| `q_ukmt_imc20_24` | `/images/questions/q_ukmt_imc20_24.png` | 30,245 B |
| `q_ukmt_imc20_25` | `/images/questions/q_ukmt_imc20_25.png` | 16,274 B |
| `q_ukmt_jmc19_21` | `/images/questions/q_ukmt_jmc19_21.png` | 39,259 B |
| `q_ukmt_jmc19_22` | `/images/questions/q_ukmt_jmc19_22.png` | 55,736 B |
| `q_ukmt_jmc19_23` | `/images/questions/q_ukmt_jmc19_23.png` | 74,955 B |
| `q_ukmt_jmc19_24` | `/images/questions/q_ukmt_jmc19_24.png` | 59,109 B |
| `q_ukmt_jmc19_25` | `/images/questions/q_ukmt_jmc19_25.png` | 65,023 B |
| `q_amc8_2023_02` | `/images/questions/q_amc8_2023_02.png` | 11,278 B |
| `q_amc8_2023_04` | `/images/questions/q_amc8_2023_04.png` | 10,228 B |
| `q_amc8_2023_09` | `/images/questions/q_amc8_2023_09.png` | 34,096 B |
| `q_amc8_2023_12` | `/images/questions/q_amc8_2023_12.png` | 36,145 B |
| `q_amc8_2023_16` | `/images/questions/q_amc8_2023_16.png` | 18,786 B |
| `q_amc8_2023_17` | `/images/questions/q_amc8_2023_17.png` | 38,535 B |
| `q_amc8_2023_23` | `/images/questions/q_amc8_2023_23.png` | 2,625 B |
| `q_amc8_2022_01` | `/images/questions/q_amc8_2022_01.png` | 10,575 B |
| `q_amc8_2022_04` | `/images/questions/q_amc8_2022_04.png` | 5,189 B |
| `q_amc8_2022_10` | `/images/questions/q_amc8_2022_10.png` | 22,557 B |
| `q_amc8_2022_15` | `/images/questions/q_amc8_2022_15.png` | 26,004 B |
| `q_amc8_2022_19` | `/images/questions/q_amc8_2022_19.png` | 10,964 B |
| `q_amc8_2022_20` | `/images/questions/q_amc8_2022_20.png` | 4,225 B |
| `q_amc8_2022_24` | `/images/questions/q_amc8_2022_24.png` | 15,566 B |
| `q_amc10a_22_05` | `/images/questions/q_amc10a_22_05.png` | 12,650 B |
| `q_amc10a_22_09` | `/images/questions/q_amc10a_22_09.png` | 1,163 B |
| `q_amc10a_22_21` | `/images/questions/q_amc10a_22_21.png` | 25,165 B |
| `q_kg_2023_ab_02` | `/images/questions/q_kg_2023_ab_02.png` | 64,792 B |
| `q_kg_2023_ab_06` | `/images/questions/q_kg_2023_ab_06.png` | 37,349 B |
| `q_kg_2023_ab_09` | `/images/questions/q_kg_2023_ab_09.png` | 91,962 B |
| `q_kg_2023_ab_12` | `/images/questions/q_kg_2023_ab_12.png` | 33,159 B |
| `q_kg_2023_ab_15` | `/images/questions/q_kg_2023_ab_15.png` | 59,433 B |
| `q_kg_2023_ab_16` | `/images/questions/q_kg_2023_ab_16.png` | 67,102 B |
| `q_kg_2023_ab_19` | `/images/questions/q_kg_2023_ab_19.png` | 52,569 B |
| `q_kg_2023_c_25` | `/images/questions/q_kg_2023_c_25.png` | 58,795 B |
| `q_kg_2023_c_26` | `/images/questions/q_kg_2023_c_26.png` | 42,586 B |
| `q_kg_2023_c_29` | `/images/questions/q_kg_2023_c_29.png` | 80,258 B |
| `q_kg_2023_ab_04` | `/images/questions/q_kg_2023_ab_04.png` | 50,231 B |

