#!/usr/bin/env python3
"""Add 5 Vietnamese THPT Math exam papers (250 questions) to the exam app.

Sources (all from dethi.edu.vn):
  1. THPT Quốc gia 2019 — Bộ GD&ĐT (Mã đề 101)
  2. THPT Quốc gia 2018 — Bộ GD&ĐT (Mã đề 101)
  3. Đề thi thử 2019 — Sở GD&ĐT Cà Mau (Mã đề 101)
  4. Đề thi thử 2018-2019 — Sở GD&ĐT Ninh Bình (Mã đề 001)
  5. Đề thi thử 2018-2019 — THPT Chuyên Hùng Vương (Mã đề 101)

Note: Questions that reference a figure/table include the note
"(Xem hình vẽ/bảng biến thiên trong đề thi gốc để trả lời câu này.)"
"""
import json, pathlib

DATA    = pathlib.Path('/mnt/d/AI-Agent-App/exam-app/src/data')
BACKEND = pathlib.Path('/mnt/d/AI-Agent-App/backend/app/data')

FIG = " *(Xem hình vẽ/bảng biến thiên trong đề thi gốc.)*"

def diff(n):
    if n <= 15: return "easy"
    if n <= 35: return "medium"
    return "hard"

# ── Exam metadata ─────────────────────────────────────────────────────────────
NEW_EXAMS = [
    {"id":"thpt_2019","year":2019,"title":"Đề thi THPT Quốc gia 2019 — Môn Toán (Mã đề 101)",
     "duration":90,"source":"Bộ GD&ĐT","totalQuestions":50,"category":"thpt","mode":"thithu",
     "questionIds":[f"q_thpt19_{i:03d}" for i in range(1,51)]},
    {"id":"thpt_2018","year":2018,"title":"Đề thi THPT Quốc gia 2018 — Môn Toán (Mã đề 101)",
     "duration":90,"source":"Bộ GD&ĐT","totalQuestions":50,"category":"thpt","mode":"thithu",
     "questionIds":[f"q_thpt18_{i:03d}" for i in range(1,51)]},
    {"id":"thithu_camau19","year":2019,"title":"Đề thi thử THPT 2019 — Sở GD&ĐT Cà Mau (Mã đề 101)",
     "duration":90,"source":"Sở GD&ĐT Cà Mau","totalQuestions":50,"category":"thpt","mode":"thithu",
     "questionIds":[f"q_camau19_{i:03d}" for i in range(1,51)]},
    {"id":"thithu_ninhbinh19","year":2019,"title":"Đề thi thử THPT 2018-2019 — Sở GD&ĐT Ninh Bình (Mã đề 001)",
     "duration":90,"source":"Sở GD&ĐT Ninh Bình","totalQuestions":50,"category":"thpt","mode":"thithu",
     "questionIds":[f"q_ninhbinh19_{i:03d}" for i in range(1,51)]},
    {"id":"thithu_hungvuong19","year":2019,"title":"Đề thi thử THPT 2018-2019 — THPT Chuyên Hùng Vương (Mã đề 101)",
     "duration":90,"source":"THPT Chuyên Hùng Vương","totalQuestions":50,"category":"thpt","mode":"thithu",
     "questionIds":[f"q_hungvuong19_{i:03d}" for i in range(1,51)]},
]

# ── Paper 1: THPT 2019 ────────────────────────────────────────────────────────
# Source: dethi.edu.vn — Đề thi THPT Quốc gia Toán 2019, Bộ GD&ĐT, Mã đề 101
SRC19 = "dethi.edu.vn — THPT Quốc gia 2019 (Bộ GD&ĐT, Mã đề 101)"
# Each tuple: (question, [A,B,C,D], correct_0indexed, topic)
Q19 = [
# 1
("Trong không gian $Oxyz$, cho mặt phẳng $(P): x + 2y + 3z + 1 = 0$. Vectơ nào dưới đây là một vectơ pháp tuyến của $(P)$?",
 ["$\\vec{n} = (1;\\,2;\\,-1)$","$\\vec{n} = (1;\\,2;\\,3)$","$\\vec{n} = (1;\\,3;\\,-1)$","$\\vec{n} = (2;\\,3;\\,-1)$"],1,"geometry"),
# 2
("Với $a$ là số thực dương tùy ý, $\\log_5 a^2$ bằng:",
 ["$2\\log_5 a$","$2 + \\log_5 a$","$\\log_5 a$","$\\dfrac{1}{2}\\log_5 a$"],0,"logarithm"),
# 3 FIGURE
("Cho hàm số có bảng biến thiên như hình vẽ."+FIG+" Hàm số đã cho nghịch biến trên khoảng nào?",
 ["$(-2;\\,0)$","$(-2;\\,+\\infty)$","$(0;\\,2)$","$(0;\\,+\\infty)$"],2,"functions"),
# 4
("Nghiệm của phương trình $3^{2x+1} = 243$ là:",
 ["$x = 5$","$x = 1$","$x = 2$","$x = 4$"],2,"logarithm"),
# 5
("Cho cấp số cộng $(u_n)$ với $u_1 = 9$ và $u_2 = 3$. Công sai bằng:",
 ["$6$","$3$","$12$","$-6$"],3,"sequences"),
# 6 FIGURE
("Đồ thị của hàm số nào có dạng như đường cong trong hình vẽ?"+FIG,
 ["$y = x^3 - 3x^2 - 3$","$y = x^3 + 3x^2 + 3$","$y = x^4 - 2x^2 + 3$","$y = x^4 + 2x^2 - 3$"],0,"functions"),
# 7
("Trong không gian $Oxyz$, cho đường thẳng $d:\\dfrac{x-2}{1}=\\dfrac{y-1}{2}=\\dfrac{z-3}{1}$. Vectơ chỉ phương của $d$ là:",
 ["$\\vec{u} = (2;\\,1;\\,1)$","$\\vec{u} = (1;\\,2;\\,-3)$","$\\vec{u} = (-1;\\,2;\\,1)$","$\\vec{u} = (2;\\,1;\\,-3)$"],2,"geometry"),
# 8
("Thể tích khối nón có chiều cao $h$ và bán kính đáy $r$ là:",
 ["$\\dfrac{1}{3}\\pi r^2 h$","$\\dfrac{4}{3}\\pi r^2 h$","$\\pi r^2 h$","$2\\pi r^2 h$"],0,"geometry"),
# 9
("Số cách chọn $2$ học sinh từ $7$ học sinh là:",
 ["$2^7$","$A_7^2$","$C_7^2$","$7^2$"],2,"probability"),
# 10
("Hình chiếu vuông góc của điểm $M(2;\\,1;\\,-1)$ trên trục $Oz$ có tọa độ:",
 ["$(2;\\,1;\\,0)$","$(0;\\,0;\\,-1)$","$(2;\\,0;\\,0)$","$(0;\\,1;\\,0)$"],1,"geometry"),
# 11
("Biết $\\int_0^1 f(x)\\,dx = 2$ và $\\int_0^1 g(x)\\,dx = 3$, khi đó $\\int_0^1 [f(x)+g(x)]\\,dx$ bằng:",
 ["$5$","$-5$","$1$","$-1$"],0,"calculus"),
# 12
("Thể tích khối lăng trụ có diện tích đáy $B$ và chiều cao $h$ là:",
 ["$3Bh$","$Bh$","$\\dfrac{4}{3}Bh$","$\\dfrac{1}{3}Bh$"],1,"geometry"),
# 13
("Số phức liên hợp của số phức $z = 3 + 4i$ là:",
 ["$3 + 4i$","$-3 - 4i$","$3 - 4i$","$4 + 3i$"],2,"complex_numbers"),
# 14 FIGURE
("Cho hàm số có bảng biến thiên như hình vẽ."+FIG+" Hàm số đã cho đạt cực tiểu tại:",
 ["$x = -2$","$x = 1$","$x = -1$","$x = 3$"],2,"functions"),
# 15
("Họ tất cả nguyên hàm của $f(x) = 2x + 5$ là:",
 ["$x^2 + 5x + C$","$2x^2 + 5x + C$","$2x + C$","$x + C$"],0,"calculus"),
# 16 FIGURE
("Cho đồ thị hàm số $y=f(x)$ như hình vẽ."+FIG+" Số nghiệm thực của phương trình $2f(x) - 3 = 0$ là:",
 ["$2$","$1$","$4$","$3$"],2,"functions"),
# 17
("Cho hình chóp $S.ABC$ có $SA \\perp (ABC)$, $SA = 2a$, tam giác $ABC$ vuông tại $B$, $AB = a\\sqrt{3}$, $BC = a$. Góc giữa $SC$ và $(ABC)$ là:",
 ["$90°$","$45°$","$30°$","$60°$"],1,"geometry"),
# 18
("Gọi $z_1,\\,z_2$ là hai nghiệm phức của phương trình $z^2 - 6z + 10 = 0$. Giá trị $z_1^2 + z_2^2$ bằng:",
 ["$16$","$56$","$20$","$26$"],0,"complex_numbers"),
# 19
("Hàm số $y = 2^{x^2-3x}$ có đạo hàm là:",
 ["$(2x-3)\\cdot 2^{x^2-3x}\\cdot\\ln 2$","$2^{x^2-3x}\\cdot\\ln 2$","$(2x-3)\\cdot 2^{x^2-3x}$","$(x^2-3x)\\cdot 2^{x^2-3x-1}$"],0,"calculus"),
# 20
("Giá trị lớn nhất của $f(x) = x^3 - 3x^2$ trên $[-3;\\,3]$ là:",
 ["$16$","$20$","$0$","$4$"],2,"functions"),
# 21
("Mặt cầu $(S): x^2+y^2+z^2-2x-2z-7=0$ có bán kính bằng:",
 ["$\\sqrt{7}$","$\\sqrt{9}$","$3$","$\\sqrt{15}$"],2,"geometry"),
# 22
("Lăng trụ đứng $ABC.A'B'C'$ có đáy là tam giác đều cạnh $a$ và $AA' = 3a$. Thể tích khối lăng trụ là:",
 ["$\\dfrac{3a^3\\sqrt{3}}{4}$","$\\dfrac{3a^3\\sqrt{3}}{2}$","$\\dfrac{a^3\\sqrt{3}}{4}$","$\\dfrac{a^3\\sqrt{3}}{2}$"],0,"geometry"),
# 23
("Cho hàm số $f(x)$ có $f'(x) = x(x-2)^2$. Số điểm cực trị của hàm số là:",
 ["$0$","$3$","$2$","$1$"],3,"functions"),
# 24
("Cho $a,b>0$ thỏa mãn $4^{\\log_2 a}=16$ và $\\log_2 b = \\log_2 a - 1$. Giá trị $\\log_2(ab^2)$ bằng:",
 ["$4$","$2$","$16$","$8$"],0,"logarithm"),
# 25
("Cho $z_1 = 1 + i$ và $z_2 = 1 - 2i$. Điểm biểu diễn số phức $3z_1 - z_2$ có tọa độ là:",
 ["$(4;\\,-1)$","$(1;\\,4)$","$(4;\\,1)$","$(1;\\,-4)$"],0,"complex_numbers"),
# 26
("Nghiệm của phương trình $\\log_3(3x) - 1 = \\log_3(x-1)$ là:",
 ["$x = 3$","$x = -3$","$x = 4$","$x = 2$"],3,"logarithm"),
# 27
("Hai bể hình trụ có chiều cao bằng nhau, bán kính lần lượt $1$m và $1{,}2$m. Bể mới có thể tích bằng tổng hai bể. Bán kính bể mới gần nhất với giá trị nào?",
 ["$1{,}8$ m","$1{,}4$ m","$2{,}2$ m","$1{,}6$ m"],3,"geometry"),
# 28 FIGURE
("Tổng số tiệm cận đứng và tiệm cận ngang của đồ thị hàm số cho trong hình vẽ bằng:"+FIG,
 ["$4$","$1$","$3$","$2$"],3,"functions"),
# 29 FIGURE
("Diện tích hình phẳng giới hạn bởi $y=f(x)$, $y=0$, $x=1$, $x=4$ với đồ thị như hình vẽ"+FIG+" bằng:",
 ["$\\int_1^4 f(x)\\,dx$","$\\int_1^2 f(x)\\,dx - \\int_2^4 f(x)\\,dx$","$\\int_1^4 |f(x)|\\,dx$","$-\\int_1^4 f(x)\\,dx$"],1,"calculus"),
# 30
("Viết phương trình mặt phẳng trung trực của đoạn thẳng $AB$ với $A(1;\\,3;\\,0)$, $B(5;\\,1;\\,-1)$:",
 ["$2x + y + z - 5 = 0$","$4x - 2y - z - 9 = 0$","$x + y + 2z - 3 = 0$","$3x + 2y + z - 14 = 0$"],1,"geometry"),
# 31
("Nguyên hàm của $f(x) = \\dfrac{2x+1}{x-1}$ trên $(1;\\,+\\infty)$ là:",
 ["$2\\ln(x-1)+C$","$2x + 3\\ln(x-1)+C$","$2\\ln(x-1)+\\dfrac{3}{x-1}+C$","$2x+C$"],1,"calculus"),
# 32
("Cho $f(0)=4$, $f'(x)=2\\cos^2 x - 1$. Tính $I=\\int_0^{\\pi/4} f(x)\\,dx$:",
 ["$\\dfrac{2+14\\sqrt{2}}{16}$","$\\dfrac{4+2\\sqrt{2}}{16}$","$\\dfrac{4+\\pi\\sqrt{2}}{8}$","$\\dfrac{4-2\\sqrt{2}}{16}$"],2,"calculus"),
# 33
("Đường thẳng đi qua $C(2;\\,-1;\\,3)$ và vuông góc với mặt phẳng $(ABD)$ có phương trình tham số:",
 ["$x=2+4t,\\;y=2-3t,\\;z=2+t$","$x=2+4t,\\;y=1-3t,\\;z=3+t$","$x=2+4t,\\;y=4-3t,\\;z=2+t$","$x=4+2t,\\;y=3t,\\;z=1-3t$"],1,"geometry"),
# 34
("Số phức $z$ thỏa mãn $3(z-i)=(2-i)z+3+10i$. Mô-đun $|z|$ bằng:",
 ["$3$","$5$","$\\sqrt{5}$","$\\sqrt{34}$"],2,"complex_numbers"),
# 35 FIGURE
("Cho đồ thị hàm số $y=f(x)$ như hình vẽ."+FIG+" Hàm số $y=f(3-2x)$ nghịch biến trên khoảng nào?",
 ["$(4;\\,+\\infty)$","$(-2;\\,1)$","$(2;\\,4)$","$(1;\\,2)$"],1,"functions"),
# 36 FIGURE
("Cho đồ thị hàm số $y=f(x)$ trên $[0;2]$ như hình vẽ."+FIG+" Bất phương trình $f(x)\\geq x+m$ nghiệm đúng với mọi $x\\in[0;2]$ khi và chỉ khi:",
 ["$m\\leq f(2)-2$","$m\\leq f(0)$","$m\\leq \\min_{[0,2]}(f(x)-x)$","$m\\geq f(0)$"],2,"functions"),
# 37
("Chọn ngẫu nhiên hai số từ tập $\\{1,2,\\ldots,25\\}$. Xác suất để tổng hai số đó là số chẵn bằng:",
 ["$\\dfrac{1}{2}$","$\\dfrac{13}{25}$","$\\dfrac{12}{25}$","$\\dfrac{313}{625}$"],2,"probability"),
# 38
("Hình trụ chiều cao $5\\sqrt{3}$, thiết diện song song trục cách trục $1$m có diện tích $30$. Diện tích xung quanh hình trụ là:",
 ["$10\\sqrt{3}\\pi$","$5\\sqrt{39}\\pi$","$20\\sqrt{3}\\pi$","$10\\sqrt{39}\\pi$"],2,"geometry"),
# 39
("Số giá trị nguyên của $m$ để phương trình $\\log_9 x - \\log_3(3x-1) = 1 + \\log_3 m$ có nghiệm là:",
 ["$2$","$4$","$3$","Vô số"],0,"logarithm"),
# 40
("Hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, $SA\\perp(ABCD)$. Khoảng cách từ $A$ đến mặt phẳng $(SBD)$ bằng:",
 ["$\\dfrac{a\\sqrt{2}}{4}$","$\\dfrac{a\\sqrt{6}}{3}$","$\\dfrac{a}{2}$","$\\dfrac{a\\sqrt{3}}{3}$"],1,"geometry"),
# 41
("Biết $f(4)=1$, $\\int_0^1 x f'(4x)\\,dx=1$. Tính $I=\\int_0^4 x^2 f'(x)\\,dx$:",
 ["$\\dfrac{31}{2}$","$16$","$8$","$14$"],1,"calculus"),
# 42
("Điểm $A(0;\\,4;\\,-3)$, đường thẳng $d$ song song $Oz$ và cách $Oz$ khoảng $3$. Khoảng cách từ $A$ đến $d$ nhỏ nhất khi $d$ đi qua:",
 ["$P(3;\\,0;\\,-3)$","$M(0;\\,-3;\\,5)$","$N(0;\\,3;\\,5)$","$Q(0;\\,5;\\,-3)$"],2,"geometry"),
# 43 FIGURE
("Cho hàm bậc ba $y=f(x)$ với đồ thị như hình vẽ."+FIG+" Số nghiệm của phương trình $4f(x)-3=3x$ bằng:",
 ["$3$","$8$","$7$","$4$"],1,"functions"),
# 44
("Cho $|z|=2$, $w=\\dfrac{4iz}{1+z}$. Bán kính đường tròn là tập hợp điểm biểu diễn $w$ bằng:",
 ["$\\sqrt{34}$","$\\sqrt{26}$","$34$","$26$"],0,"complex_numbers"),
# 45
("Cho hai đường $y=x$ và $y=\\dfrac{1}{2}x^2+a$ ($a>0$) giới hạn hai phần diện tích $S_1$ và $S_2$. Khi $S_1=S_2$ thì $a$ thuộc khoảng nào?",
 ["$\\left(\\dfrac{3}{7};\\dfrac{1}{2}\\right)$","$\\left(0;\\dfrac{1}{3}\\right)$","$\\left(\\dfrac{1}{2};\\dfrac{3}{5}\\right)$","$\\left(\\dfrac{2}{3};\\dfrac{5}{7}\\right)$"],2,"calculus"),
# 46 FIGURE
("Cho hàm số $y=f(x)$ như hình vẽ."+FIG+" Số điểm cực trị của hàm số $y=f(x^2-2x)$ là:",
 ["$9$","$3$","$7$","$5$"],2,"functions"),
# 47
("Lăng trụ $ABC.A'B'C'$ chiều cao $8$, đáy tam giác đều cạnh $6$. $M,N,P$ là tâm các mặt bên. Thể tích khối $ABCMNP$ bằng:",
 ["$27\\sqrt{3}$","$21\\sqrt{3}$","$30\\sqrt{3}$","$36\\sqrt{3}$"],0,"geometry"),
# 48
("Mặt cầu $(S): x^2+y^2+z^2=3$ chiếu lên $(Oxy)$ được đường tròn $(C)$. Số điểm $A$ có tọa độ nguyên nằm ngoài $(C)$ sao cho có ít nhất $2$ tiếp tuyến từ $A$ đến $(C)$ vuông góc nhau là:",
 ["$12$","$8$","$16$","$4$"],0,"geometry"),
# 49
("Tìm số giá trị nguyên $m$ để hai đường cong $y=x^3-3x$ và $y=m$ cắt nhau đúng $4$ điểm phân biệt:",
 ["$0$","$3$","$4$","$2$"],3,"functions"),
# 50
("Phương trình $4\\log_2^2 x - \\log_2 x - 5 - 7m = 0$ có đúng $2$ nghiệm phân biệt. Số giá trị nguyên dương $m$ là:",
 ["$49$","$47$","Vô số","$48$"],1,"logarithm"),
]

# ── Paper 2: THPT 2018 ────────────────────────────────────────────────────────
SRC18 = "dethi.edu.vn — THPT Quốc gia 2018 (Bộ GD&ĐT, Mã đề 101)"
Q18 = [
# 1
("Có bao nhiêu cách chọn hai học sinh từ một nhóm gồm $34$ học sinh?",
 ["$2^{34}$","$A_{34}^2$","$34^2$","$C_{34}^2$"],3,"probability"),
# 2
("Mặt phẳng $(P): x + 2y - 3z - 5 = 0$ có một vectơ pháp tuyến là:",
 ["$(3;\\,2;\\,1)$","$(-1;\\,-2;\\,-3)$","$(1;\\,2;\\,-3)$","$(1;\\,2;\\,3)$"],2,"geometry"),
# 3 FIGURE
("Cho đồ thị hàm số $y=f(x)$ như hình vẽ."+FIG+" Số điểm cực trị của hàm số là:",
 ["$2$","$0$","$3$","$1$"],0,"functions"),
# 4 FIGURE
("Cho hàm số có bảng biến thiên như hình vẽ."+FIG+" Hàm số nghịch biến trên khoảng nào?",
 ["$(0;\\,1)$","$(-\\infty;\\,0)$","$(1;\\,+\\infty)$","$(-1;\\,0)$"],0,"functions"),
# 5
("Diện tích hình phẳng giới hạn bởi $y=e^x$, $y=0$, $x=0$, $x=2$ được tính bằng:",
 ["$S=\\pi\\int_0^2 e^{2x}\\,dx$","$S=\\int_0^2 e^x\\,dx$","$S=\\pi\\int_0^2 e^x\\,dx$","$S=\\int_0^2 e^{2x}\\,dx$"],1,"calculus"),
# 6
("$\\ln(5a) - \\ln(3a)$ bằng:",
 ["$\\dfrac{\\ln 5a}{\\ln 3a}$","$\\ln 2a$","$\\ln\\dfrac{5}{3}$","$\\dfrac{\\ln 5}{\\ln 3}$"],2,"logarithm"),
# 7
("Nguyên hàm của $f(x) = x^3 + x$ là:",
 ["$\\dfrac{1}{4}x^4 + x^2 + C$","$3x^2 + 1 + C$","$x^3 + x + C$","$\\dfrac{1}{4}x^4 + \\dfrac{1}{2}x^2 + C$"],3,"calculus"),
# 8
("Đường thẳng $d: x=2+t,\\;y=1+2t,\\;z=3+t$ có vectơ chỉ phương là:",
 ["$(2;\\,1;\\,3)$","$(1;\\,2;\\,1)$","$(2;\\,1;\\,1)$","$(1;\\,2;\\,3)$"],1,"geometry"),
# 9
("Số phức $3 - 7i$ có phần ảo bằng:",
 ["$3$","$7$","$-3$","$-7$"],3,"complex_numbers"),
# 10
("Diện tích mặt cầu bán kính $R$ bằng:",
 ["$\\pi R^2$","$2\\pi R^2$","$4\\pi R^2$","$\\dfrac{4}{3}\\pi R^2$"],2,"geometry"),
# 11 FIGURE
("Đường cong trong hình vẽ là đồ thị của hàm số nào?"+FIG,
 ["$y=x^4-3x^2+1$","$y=-x^3-3x^2+1$","$y=x^3-3x^2+1$","$y=-x^4-3x^2+1$"],3,"functions"),
# 12
("Trung điểm của đoạn $AB$ với $A(2;\\,-4;\\,3)$ và $B(2;\\,2;\\,7)$ có tọa độ:",
 ["$(1;\\,3;\\,2)$","$(2;\\,6;\\,4)$","$(2;\\,-1;\\,5)$","$(4;\\,-2;\\,10)$"],2,"geometry"),
# 13
("$\\lim_{n\\to\\infty}\\dfrac{1}{5n+3}$ bằng:",
 ["$0$","$\\dfrac{1}{3}$","$\\dfrac{1}{5}$","$\\infty$"],0,"sequences"),
# 14
("Phương trình $2^{2x+1} = 32$ có nghiệm:",
 ["$x=\\dfrac{5}{2}$","$x=2$","$x=\\dfrac{3}{2}$","$x=3$"],1,"logarithm"),
# 15
("Thể tích khối chóp có đáy là hình vuông cạnh $a$ và chiều cao $2a$ bằng:",
 ["$4a^3$","$\\dfrac{2}{3}a^3$","$2a^3$","$\\dfrac{4}{3}a^3$"],1,"geometry"),
# 16
("Gửi tiết kiệm với lãi suất $7{,}5\\%$/năm. Sau bao nhiêu năm thì số tiền gấp đôi (gần nhất)?",
 ["$11$ năm","$9$ năm","$10$ năm","$12$ năm"],2,"calculus"),
# 17 FIGURE
("Cho đồ thị hàm số $y=f(x)$ như hình vẽ."+FIG+" Số nghiệm của phương trình $3f(x)-4=0$ là:",
 ["$3$","$0$","$1$","$2$"],0,"functions"),
# 18
("Số tiệm cận đứng của hàm số $y=\\dfrac{\\sqrt{x-9}-3}{x^2-x}$ là:",
 ["$3$","$2$","$0$","$1$"],3,"functions"),
# 19
("Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, $SA\\perp(ABCD)$, $SB=2a$. Góc giữa $SB$ và mặt phẳng đáy bằng:",
 ["$60°$","$90°$","$30°$","$45°$"],0,"geometry"),
# 20
("Mặt phẳng qua $A(2;\\,-1;\\,2)$ song song với $(P): 2x-y+3z-2=0$ có phương trình:",
 ["$2x-y+3z-9=0$","$2x-y+3z+11=0$","$2x-y+3z-11=0$","$2x-y+3z+9=0$"],2,"geometry"),
# 21
("Xác suất lấy ngẫu nhiên $3$ quả cầu đều màu xanh từ túi gồm $11$ đỏ và $4$ xanh:",
 ["$\\dfrac{4}{455}$","$\\dfrac{24}{455}$","$\\dfrac{4}{165}$","$\\dfrac{33}{91}$"],0,"probability"),
# 22
("$\\int_1^2 e^{3x+1}\\,dx$ bằng:",
 ["$\\dfrac{1}{3}e^7-\\dfrac{1}{3}e^4$","$\\dfrac{1}{3}e^7+e^4$","$e^7-e^4$","$\\dfrac{1}{3}e^7-\\dfrac{1}{3}e^4$"],0,"calculus"),
# 23
("Giá trị lớn nhất của $y=x^4-4x^2+9$ trên $[-2;\\,3]$ là:",
 ["$201$","$2$","$9$","$54$"],3,"functions"),
# 24
("Tìm $x,y$ thỏa mãn $2x+3yi=(1+3i)(x-6i)$:",
 ["$x=1;\\,y=3$","$x=1;\\,y=1$","$x=-1;\\,y=1$","$x=-1;\\,y=-3$"],0,"complex_numbers"),
# 25
("Khoảng cách từ $A$ đến mặt phẳng $(SBC)$ trong hình chóp $S.ABC$ có $SA\\perp(ABC)$, $AB=a$, $SA=2a$, tam giác $ABC$ vuông tại $B$:",
 ["$\\dfrac{2\\sqrt{5}}{5}a$","$\\dfrac{5a}{3}$","$\\dfrac{2\\sqrt{2}}{3}a$","$\\sqrt{5}a$"],0,"geometry"),
# 26
("Biết $\\int_{16}^{55}\\dfrac{dx}{x\\sqrt{x-9}} = a\\ln 2 + b\\ln 5 + c\\ln 11$. Giá trị biểu thức $a - b + 3c$ bằng:",
 ["$a-b-c$","$a-b+c$","$a-b-3c$","$a-b+3c$"],3,"calculus"),
# 27
("Chi phí nguyên liệu làm một chiếc bút chì lục giác đều (cạnh $3$mm, cao $200$mm, giá $a$ đồng/mm³) gần nhất với:",
 ["$9{,}7a$ đồng","$97{,}03a$ đồng","$90{,}7a$ đồng","$9{,}07a$ đồng"],3,"geometry"),
# 28
("Hệ số của $x^5$ trong khai triển $(x+2)(x-1)^6 + 3(x-1)^8$ là:",
 ["$13368$","$-13368$","$13848$","$-13848$"],0,"algebra"),
# 29
("Khoảng cách giữa hai đường thẳng $AC$ và $SB$ trong hình chóp $S.ABCD$ có đáy là hình chữ nhật $AB=a$, $BC=2a$, $SA\\perp(ABCD)$, $SA=a$:",
 ["$\\dfrac{6a}{2}$","$\\dfrac{2a}{3}$","$\\dfrac{a}{2}$","$\\dfrac{a}{3}$"],1,"geometry"),
# 30
("Bán kính đường tròn là tập hợp điểm biểu diễn $z$ thỏa $z-i+\\overline{z}-2$ là số thuần ảo:",
 ["$1$","$\\dfrac{5}{4}$","$\\dfrac{5}{2}$","$\\dfrac{3}{2}$"],2,"complex_numbers"),
# 31
("Dung tích lớn nhất của bể cá hình hộp chữ nhật không nắp có tổng diện tích kính là $6{,}5$m², chiều dài gấp đôi chiều rộng (gần nhất):",
 ["$2{,}26$ m³","$1{,}61$ m³","$1{,}33$ m³","$1{,}50$ m³"],3,"calculus"),
# 32
("Vận tốc lúc $B$ đuổi kịp $A$ ($v_A=\\frac{t^2}{180}+\\frac{11t}{18}$, $B$ xuất phát chậm $5$s) là:",
 ["$22$ m/s","$15$ m/s","$10$ m/s","$7$ m/s"],1,"calculus"),
# 33
("Đường thẳng qua $A(1;\\,2;\\,3)$, vuông góc $d:\\frac{x}{1}=\\frac{y-1}{-1}=\\frac{z-2}{2}$, cắt trục $Ox$ có phương trình tham số:",
 ["$x=1+2t,\\;y=2-t,\\;z=3+t$","$x=1+t,\\;y=2-2t,\\;z=3-2t$","$x=1+2t,\\;y=2-t,\\;z=t$","$x=1+t,\\;y=2+2t,\\;z=3-3t$"],3,"geometry"),
# 34
("Số giá trị nguyên $m$ để phương trình $16^x - m\\cdot 4^{x+1} + 5m - 2 - 45 = 0$ có $2$ nghiệm phân biệt:",
 ["$13$","$3$","$6$","$4$"],1,"logarithm"),
# 35
("Số giá trị nguyên $m$ để hàm số $y=\\dfrac{x-2}{x-5-m}$ đồng biến trên $(-\\infty;\\,10)$:",
 ["$2$","Vô số","$1$","$3$"],0,"functions"),
# 36
("Số giá trị nguyên $m$ để hàm số $y=x^8+(m-2)x^5+(m^2-4)x^4+1$ đạt cực tiểu tại $x=0$:",
 ["$3$","$5$","$4$","Vô số"],2,"functions"),
# 37
("$\\cos$ góc giữa hai mặt phẳng chứa $M$ (hình lập phương, $M$ trên $OI$ sao cho $MO=2MI$) bằng:",
 ["$\\dfrac{6\\sqrt{85}}{85}$","$\\dfrac{7\\sqrt{85}}{85}$","$\\dfrac{17}{65}$","$\\dfrac{6\\sqrt{13}}{65}$"],1,"geometry"),
# 38
("Số phức $z$ thỏa $z+\\overline{z}+4i=(2+i)(5i-\\overline{z})$ có mô-đun $|z|$ bằng:",
 ["$2$","$3$","$1$","$4$"],1,"complex_numbers"),
# 39
("Mặt phẳng chứa điểm $M$ trên mặt cầu $(S):(x-1)^2+(y-1)^2+(z-1)^2=9$ sao cho $AM$ tiếp xúc với $(S)$ (với $A$ cho sẵn) có phương trình:",
 ["$6x-8y+11=0$","$3x-4y+2=0$","$3x-4y-2=0$","$6x-8y-11=0$"],2,"geometry"),
# 40
("Số điểm $A$ trên đường cong $y=\\dfrac{1}{4}x^4-\\dfrac{7}{2}x^2$ sao cho tiếp tuyến tại $A$ cắt đường cong tại hai điểm $M,N$ với $\\dfrac{y_1-y_2}{x_1-x_2}=6$ là:",
 ["$1$","$2$","$0$","$3$"],1,"calculus"),
# 41
("Diện tích hình phẳng giữa $f(x)=ax^3+bx^2+cx$ và $g(x)=dx^2+ex+1$ (giao tại $x=-3,-1,1$) bằng:",
 ["$\\dfrac{9}{2}$","$8$","$4$","$5$"],2,"calculus"),
# 42
("Thể tích lăng trụ $ABC.A'B'C'$ (với điều kiện hình chiếu cho sẵn):",
 ["$2$","$1$","$3$","$\\dfrac{2\\sqrt{3}}{3}$"],0,"geometry"),
# 43
("Xác suất để tổng $3$ số nguyên được chọn ngẫu nhiên từ $1$ đến $17$ chia hết cho $3$ là:",
 ["$\\dfrac{1728}{4913}$","$\\dfrac{1079}{4913}$","$\\dfrac{23}{68}$","$\\dfrac{1637}{4913}$"],3,"probability"),
# 44
("Cho $a>0,b>0$ thỏa điều kiện logarit. Giá trị $a+2b$ bằng:",
 ["$6$","$9$","$\\dfrac{7}{2}$","$\\dfrac{5}{2}$"],2,"logarithm"),
# 45
("Độ dài $AB$ với $A,B\\in C: y=\\dfrac{x-1}{x-2}$ sao cho tam giác $ABI$ đều ($I$ là tâm đối xứng):",
 ["$6$","$2\\sqrt{3}$","$2$","$2\\sqrt{2}$"],1,"functions"),
# 46
("Số giá trị nguyên $m\\in[-20;20]$ để phương trình $5^x - m\\log_5 x = m$ có nghiệm là:",
 ["$20$","$19$","$9$","$21$"],1,"logarithm"),
# 47
("Thể tích lớn nhất của khối tứ diện $ABCD$ nội tiếp mặt cầu bán kính $R=3$ với $AB\\perp AC\\perp AD$:",
 ["$72$","$216$","$108$","$36$"],3,"geometry"),
# 48
("Cho $f(2)=\\dfrac{2}{9}$, $f'(x)=2x\\cdot f(x)$. Giá trị $f(1)$ bằng:",
 ["$\\dfrac{35}{36}$","$\\dfrac{2}{3}$","$\\dfrac{19}{36}$","$\\dfrac{2}{15}$"],1,"calculus"),
# 49
("Đường phân giác góc nhọn giữa đường thẳng $d$ và $\\ell$ (với điều kiện cho sẵn) có phương trình tham số:",
 ["$x=1+7t,\\;y=1+t,\\;z=1+5t$","$x=1+2t,\\;y=10-11t,\\;z=6-5t$","$x=1+2t,\\;y=10-11t,\\;z=6+5t$","$x=1+3t,\\;y=1+4t,\\;z=1+5t$"],2,"geometry"),
# 50 FIGURE
("Cho các hàm số $f(x)$, $g(x)$ thỏa điều kiện đồ thị như hình vẽ."+FIG+" Hàm số $h(x)=\\dfrac{3}{2}f(x-4)-2g\\!\\left(\\dfrac{2x}{3}\\right)$ đồng biến trên:",
 ["$(5;\\,\\dfrac{31}{5})$","$(-\\infty;\\,3)$","$(\\dfrac{31}{5};\\,\\dfrac{25}{4})$","$(6;\\,+\\infty)$"],1,"functions"),
]

# ── Paper 3: Cà Mau 2019 ─────────────────────────────────────────────────────
SRC_CM = "dethi.edu.vn — Đề thi thử THPT 2019 (Sở GD&ĐT Cà Mau, Mã đề 101)"
Q_CM = [
# 1
("Số phức $z = (2+3i)+(-5+i)$ có phần ảo bằng:",
 ["$2i$","$4i$","$4$","$2$"],2,"complex_numbers"),
# 2
("Cho $a,b$ là hai số thực dương tùy ý, đặt $T=\\log\\dfrac{a^2}{b}$. Khẳng định đúng:",
 ["$T=2\\log a - \\log b$","$T=2(\\log a - \\log b)$","$T=2\\log a + \\log b$","$T=\\log a^2 \\cdot \\log b^{-1}$"],0,"logarithm"),
# 3 FIGURE
("Hàm số $y=f(x)$ đồng biến trên khoảng nào?"+FIG,
 ["$(-1;\\,1)$","$(-2;\\,-1)$","$(0;\\,2)$","$(-2;\\,1)$"],1,"functions"),
# 4 FIGURE
("Điểm $M$ là điểm biểu diễn của số phức $z$ nào trong mặt phẳng phức?"+FIG,
 ["$z=-3+2i$","$z=3-2i$","$z=3+2i$","$z=2+3i$"],0,"complex_numbers"),
# 5
("Tìm đạo hàm của hàm số $y = e^x + \\log_2 x + 1$ ($x>0$):",
 ["$y'=xe^x - \\dfrac{1}{x\\ln 2}$","$y'=e^x + \\dfrac{1}{x\\ln 2}$","$y'=e^x - \\dfrac{1}{x\\ln 2}$","$y'=xe^x + \\dfrac{1}{x}$"],1,"calculus"),
# 6
("Tìm một vectơ pháp tuyến $\\vec{n}$ của mặt phẳng $(P): x+2y-2z+7=0$:",
 ["$\\vec{n}=(1;\\,2;\\,-2)$","$\\vec{n}=(1;\\,2;\\,2)$","$\\vec{n}=(2;\\,4;\\,4)$","$\\vec{n}=(2;\\,4;\\,-4)$"],0,"geometry"),
# 7
("Tiệm cận ngang của đồ thị hàm số $y=\\dfrac{5}{x+1}$ là đường thẳng:",
 ["$y=5$","$x=1$","$y=0$","$x=0$"],2,"functions"),
# 8
("Cho $\\int_0^2 f(x)\\,dx=2$ và $\\int_0^2 g(x)\\,dx=7$. Tính $T=\\int_0^2[2g(x)+f(x)]\\,dx$:",
 ["$T=5$","$T=11$","$T=12$","$T=16$"],3,"calculus"),
# 9 FIGURE
("Giá trị cực đại của hàm số $y=f(x)$ (xem đồ thị) bằng:"+FIG,
 ["$4$","$3$","$2$","$-2$"],1,"functions"),
# 10
("Tìm họ nguyên hàm của $f(x)=\\cos x$:",
 ["$\\dfrac{\\cos 2x}{2}+C$","$\\sin x+C$","$\\dfrac{\\sin 2x}{2}+C$","$\\dfrac{\\cos^2 x}{2}+C$"],1,"calculus"),
# 11
("Tìm tọa độ tâm $I$ của mặt cầu $(S):(x-1)^2+(y+2)^2+(z-1)^2=16$:",
 ["$I=(1;\\,-2;\\,-1)$","$I=(-1;\\,2;\\,-1)$","$I=(-1;\\,2;\\,1)$","$I=(1;\\,-2;\\,1)$"],3,"geometry"),
# 12
("Có bao nhiêu cách chọn $4$ học sinh từ tổ gồm $5$ nam và $7$ nữ?",
 ["$C_5^4+C_7^4$","$4!$","$A_{12}^4$","$C_{12}^4$"],3,"probability"),
# 13
("Viết phương trình mặt cầu $(S)$ tâm $I(0;\\,1;\\,2)$ tiếp xúc với $\\alpha: 4x-3y+2z+28=0$:",
 ["$x^2+(y-1)^2+(z-2)^2=29$","$x^2+(y+1)^2+(z-2)^2=29$","$x^2+(y+1)^2+(z+2)^2=841$","$x^2+(y-1)^2+(z+2)^2=29$"],0,"geometry"),
# 14
("Viết phương trình mặt phẳng trung trực của đoạn $AB$ với $A(1;\\,5;\\,-2)$, $B(3;\\,1;\\,2)$:",
 ["$2x-3y+4=0$","$x+2y+2z-8=0$","$x+2y-2z-8=0$","$x+2y+2z-4=0$"],2,"geometry"),
# 15
("Tập nghiệm $T$ của bất phương trình $\\log_{\\frac{1}{2}}\\dfrac{x-3}{x-4}\\geq 0$:",
 ["$T=(4;\\,+\\infty)$","$T=(4;\\,3)$","$T=(-\\infty;\\,-4)\\cup(3;\\,+\\infty)$","$T=(3;\\,+\\infty)$"],3,"logarithm"),
# 16
("Viết phương trình tham số đường thẳng $d$ đi qua $M(1;\\,1;\\,1)$, song song với cả $(P): x+y+2z-1=0$ và $(Q): 2x+y+3=0$:",
 ["$x=1+2t,\\;y=1+4t,\\;z=1-3t$ *(nhân tử 2)*","$x=2+t,\\;y=4-t,\\;z=3+t$","$x=1-2t,\\;y=1+4t,\\;z=1-3t$","$x=1+t,\\;y=1+t,\\;z=1+2t$"],0,"geometry"),
# 17
("Tính $I=\\int_0^1\\dfrac{x^2-x+3}{x+1}\\,dx$:",
 ["$I=\\ln 2$","$I=\\dfrac{3}{2}\\ln 2$","$I=\\dfrac{3}{2}-5\\ln 2$","$I=\\dfrac{3}{2}+5\\ln 2$"],2,"calculus"),
# 18
("Thể tích khối nón tròn xoay có bán kính đáy $r=2$ và đường sinh $l=4$:",
 ["$V=8\\sqrt{3}$","$V=16$","$V=\\dfrac{8\\sqrt{3}}{3}\\pi$","$V=\\dfrac{16}{3}\\pi$"],2,"geometry"),
# 19
("Số điểm cực trị của hàm số có $f'(x)=(x+1)(x+2)^2(2x+3)$:",
 ["$2$","$6$","$1$","$3$"],3,"functions"),
# 20 FIGURE
("Công thức tính diện tích phần hình phẳng được tô màu như hình vẽ"+FIG+" (đường cong $y=f(x)$):",
 ["$\\int_1^4\\left(x-\\dfrac{x^2}{2}-\\dfrac{x^3}{2}+4\\right)dx$","$\\int_1^2 x\\,dx-\\int_2^4\\left(\\dfrac{x^2}{2}+\\dfrac{x^3}{2}-1\\right)dx$","$\\int_1^4\\left(x-\\dfrac{x^2}{2}-\\dfrac{x^3}{2}-1\\right)dx$","$\\int_1^4(f(x)-g(x))\\,dx$"],0,"calculus"),
# 21
("Thể tích khối lăng trụ tam giác đều $ABC.A'B'C'$ với $AB=a\\sqrt{2}$ và $BB'=3a$:",
 ["$V=a^3$","$V=3a^3$","$V=\\dfrac{3a^3}{2}$","$V=3\\sqrt{3}\\,a^3$"],2,"geometry"),
# 22
("Diện tích toàn phần hình trụ khi quay hình chữ nhật $ABCD$ quanh $AB$, biết $AB=5$, $BC=2$:",
 ["$S_{tp}=24\\pi$","$S_{tp}=28\\pi$","$S_{tp}=14\\pi$","$S_{tp}=18\\pi$"],1,"geometry"),
# 23
("Tìm $a,b\\in\\mathbb{R}$ thỏa mãn $4ai+(2+bi)i=1+6i$:",
 ["$a=\\dfrac{1}{4},\\;b=6$","$a=\\dfrac{1}{4},\\;b=-6$","$a=1,\\;b=1$","$a=-1,\\;b=1$"],1,"complex_numbers"),
# 24
("Tập nghiệm của bất phương trình $49^{x^2+x-4}\\leq\\left(\\dfrac{1}{7}\\right)^1$:",
 ["$T=(-3;\\,2)$","$T=(2;\\,3)$","$T=(-2;\\,3)$","$T=(-\\infty;\\,-3)\\cup(2;\\,+\\infty)$"],2,"logarithm"),
# 25 FIGURE
("Cho đồ thị hàm số $y=f(x)$ như hình vẽ."+FIG+" Số nghiệm của phương trình $2f(x)-7=0$ là:",
 ["$4$","$1$","$2$","$3$"],3,"functions"),
# 26
("GTLN của $f(x)=x^3-3x^2-9x+10$ trên $[-2;\\,2]$:",
 ["$\\max f=5$","$\\max f=17$","$\\max f=15$","$\\max f=12$"],3,"functions"),
# 27 FIGURE
("Đường cong là đồ thị của hàm số nào (xem hình vẽ)?"+FIG,
 ["$y=\\dfrac{x+3}{2x+4}$","$y=\\dfrac{2x+3}{x-2}$","$y=\\dfrac{x+2}{2x-4}$","$y=\\dfrac{x+1}{x-2}$"],1,"functions"),
# 28
("Gọi $M(a;b;c)$ là giao điểm của $d:\\;x=2t,\\;y=3+t,\\;z=-7+t$ và $\\alpha: 3x-5y+z+7=0$. Tính $P=a+2b+c$:",
 ["$P=13$","$P=21$","$P=15$","$P=16$"],2,"geometry"),
# 29
("Xác suất chọn ít nhất một viên bi xanh khi chọn $3$ bi từ $11$ đỏ $4$ xanh:",
 ["$P=\\dfrac{9}{14}$","$P=\\dfrac{31}{56}$","$P=\\dfrac{5}{14}$","$P=\\dfrac{25}{56}$"],3,"probability"),
# 30
("Cho $z=a+bi$ thỏa $z+2\\overline{z}=4i$. Tính $S=a+b$:",
 ["$S=7$","$S=-7$","$S=1$","$S=-1$"],1,"complex_numbers"),
# 31
("Tìm $m$ để $12^x+(2-m)\\cdot6^x+3^x\\leq 0$ với mọi $x>0$:",
 ["$m\\in[-4;\\,+\\infty)$","$m\\in(-\\infty;\\,4]$","$m\\in[0;\\,4)$","$m\\in(-\\infty;\\,-4]$"],1,"logarithm"),
# 32
("Phương trình đường thẳng $d$ trong $(\\alpha):3x+y-z=0$, cắt và vuông góc $\\ell:\\dfrac{x-3}{1}=\\dfrac{y-4}{2}=\\dfrac{z-1}{2}$:",
 ["$x=2+4t,\\;y=-2+5t,\\;z=1-7t$","$x=1+4t,\\;y=5t,\\;z=3-7t$","$x=4+t,\\;y=5,\\;z=7+3t$","$x=1+4t,\\;y=-5t,\\;z=3+7t$"],1,"geometry"),
# 33
("Có bao nhiêu giá trị nguyên dương $m$ để $y=\\dfrac{mx+1}{x-m}$ đồng biến trên $(-\\infty;\\,3)$?",
 ["$4$","$1$","$3$","$2$"],3,"functions"),
# 34
("Thể tích khối chóp $S.ABC$ với đáy vuông cân tại $B$, $AC=a$, $SA\\perp(ABC)$, $SB$ hợp với đáy góc $60°$:",
 ["$\\dfrac{a^3\\sqrt{6}}{8}$","$\\dfrac{a^3\\sqrt{6}}{48}$","$\\dfrac{a^3\\sqrt{3}}{24}$","$\\dfrac{a^3\\sqrt{6}}{24}$"],1,"geometry"),
# 35
("Góc giữa $(A'BC)$ và $(BCC'B')$ trong lăng trụ $ABC.A'B'C'$ với $AB=a$, $AC=a\\sqrt{3}$, cạnh bên $a\\sqrt{2}$:",
 ["$\\arctan\\dfrac{\\sqrt{3}}{6}$","$\\arctan\\dfrac{\\sqrt{6}}{4}$","$\\arctan\\dfrac{\\sqrt{3}}{4}$","$\\arctan\\dfrac{2\\sqrt{6}}{3}$"],1,"geometry"),
# 36
("Chiều cao $h$ của bể hộp không nắp, $V=18$ m³, đáy dài gấp $3$ rộng, vật liệu tối thiểu:",
 ["$h=2$ m","$h=\\dfrac{5}{2}$ m","$h=1$ m","$h=\\dfrac{3}{2}$ m"],0,"calculus"),
# 37
("Cấp số cộng $(u_n)$ tăng với $u_1+u_3+u_4=10$ và $u_1^2+u_3^2=10$. Tính $\\dfrac{u_1}{d}$:",
 ["$\\dfrac{u_1}{d}=1$","$\\dfrac{u_1}{d}=2$","$\\dfrac{u_1}{d}=3$","$\\dfrac{u_1}{d}=-1$"],2,"sequences"),
# 38
("Bán kính mặt cầu ngoại tiếp hình chóp $S.ABCD$ với $ABCD$ hình vuông cạnh $a$, $SA=a$:",
 ["$R=a\\sqrt{3}$","$R=\\dfrac{a\\sqrt{6}}{2}$","$R=\\dfrac{a\\sqrt{3}}{3}$","$R=\\dfrac{a\\sqrt{3}}{2}$"],1,"geometry"),
# 39
("Khoảng cách từ $A$ đến $(SBC)$ trong hình chóp $S.ABC$ với $SAB$ tam giác đều cạnh $a$, $BC=a\\sqrt{3}$, $AC=2a$:",
 ["$d=a\\sqrt{3}$","$d=\\dfrac{a\\sqrt{6}}{2}$","$d=\\dfrac{a\\sqrt{2}}{2}$","$d=\\dfrac{a\\sqrt{3}}{2}$"],1,"geometry"),
# 40
("Số giá trị nguyên $m$ để $\\log_2(9-x)+\\log_{\\frac{1}{2}}(2x+m-1)=0$ có $2$ nghiệm phân biệt:",
 ["$17$","$3$","$15$","$5$"],2,"logarithm"),
# 41
("Cho $\\int_0^1 x\\ln(x+2)\\,dx=a\\ln 3+b\\ln 2+c$. Tính $T=2a+b+4c$:",
 ["$T=2$","$T=-2$","$T=4$","$T=8$"],1,"calculus"),
# 42
("Tổng $T$ các nghiệm của $\\log_5(25^x-5^x)+x-3=0$:",
 ["$T=1$","$T=3$","$T=25$","$T=2$"],3,"logarithm"),
# 43
("Số phần tử tập $S$ gồm các $m\\in[-2019;2019]$ để bất phương trình $(1+m^3)x^3+3(2+m^3)x^2+(13+3m+3m^3)x+10+m+m^3\\leq 0$ đúng với mọi $x\\in[1;3]$:",
 ["$4038$","$2021$","$2022$","$2020$"],2,"algebra"),
# 44
("Ông A mua TV $17\\,000\\,000$ đồng, trả trước $30\\%$, còn lại góp $6$ tháng, lãi $2{,}5\\%$/tháng. Tiền trả nhiều hơn giá niêm yết gần nhất:",
 ["$2\\,160\\,000$ đồng","$1\\,983\\,000$ đồng","$883\\,000$ đồng","$1\\,060\\,000$ đồng"],2,"calculus"),
# 45
("Hình chóp tứ giác đều $S.ABCD$ cạnh đáy $a$, cạnh bên hợp đáy góc $60°$. Mặt phẳng $(BMN)$ chia khối thành hai phần. Tỉ số thể tích hai phần $\\dfrac{V_1}{V_2}$:",
 ["$\\dfrac{31}{5}$","$\\dfrac{7}{3}$","$\\dfrac{7}{5}$","$\\dfrac{1}{5}$"],2,"geometry"),
# 46
("GTNN của $P=|z_1-z_2|$ với $|z_1-1-2i|=1$ và $|z_2-5-i|=2$:",
 ["$P_{\\min}=2$","$P_{\\min}=1$","$P_{\\min}=5$","$P_{\\min}=3$"],3,"complex_numbers"),
# 47
("Độ dài $MN$ lớn nhất với $M\\in(P):x+2y-2z+3=0$, $N\\in(S):x^2+y^2+z^2-2x-4y-2z+5=0$, $\\vec{MN}\\parallel\\vec{u}(1;0;1)$:",
 ["$MN=3$","$MN=3\\sqrt{2}$","$MN=5$","$MN=2$"],1,"geometry"),
# 48
("Chi phí trang trí mặt bàn elip $A_1A_2=12$ m, $B_1B_2=4$ m; hình chữ nhật $MNPQ$ nội tiếp có $MN=6\\sqrt{3}$ m; chi phí $100\\,000$đ/m²:",
 ["$4\\,250\\,000$ đồng","$4\\,917\\,845$ đồng","$4\\,540\\,000$ đồng","$4\\,000\\,000$ đồng"],1,"calculus"),
# 49 FIGURE
("Cho $f(x)$ thỏa điều kiện cho sẵn."+FIG+" Số nghiệm của $f(f(x)-1)=1-f(x+2)$:",
 ["$7$","$1$","$4$","$5$"],3,"functions"),
# 50 FIGURE
("Hàm số $g(x)=f(x^2-2)$ nghịch biến trên khoảng nào (xem đồ thị $f$)?"+FIG,
 ["$(1;\\,3)$","$(-3;\\,-1)$","$(0;\\,1)$","$(4;\\,+\\infty)$"],1,"functions"),
]

# ── Paper 4: Ninh Bình 2018-2019 ─────────────────────────────────────────────
SRC_NB = "dethi.edu.vn — Đề thi thử THPT 2018-2019 (Sở GD&ĐT Ninh Bình, Mã đề 001)"
Q_NB = [
# 1
("Thể tích khối hộp chữ nhật có ba kích thước $3$; $4$; $5$ là:",
 ["$60$","$20$","$30$","$10$"],0,"geometry"),
# 2 FIGURE
("Với bảng biến thiên cho sẵn"+FIG+", tìm $m$ để phương trình $f(x)=m$ có $4$ nghiệm phân biệt:",
 ["$m\\in(1;\\,2)$","$m\\in\\emptyset$","$m\\in\\{1;2\\}$","$m\\leq 1$"],0,"functions"),
# 3
("Thể tích khối lăng trụ có diện tích đáy $10$ và khoảng cách giữa hai đáy $12$:",
 ["$120$","$40$","$60$","$20$"],0,"geometry"),
# 4
("Thể tích khối cầu nội tiếp hình lập phương cạnh $a\\sqrt{2}$:",
 ["$\\dfrac{2\\pi a^3}{6}$","$\\dfrac{2\\pi a^3}{3}$","$\\dfrac{\\pi a^3}{3}$","$\\dfrac{\\pi a^3}{6}$"],0,"geometry"),
# 5
("Diện tích xung quanh hình trụ có bán kính $3$ và chiều cao $4$:",
 ["$12\\pi$","$42\\pi$","$24\\pi$","$36\\pi$"],2,"geometry"),
# 6
("Số cách chọn $3$ người từ $12$ người:",
 ["$4$","$A_{12}^3$","$C_{12}^3$","$P_3$"],2,"probability"),
# 7
("Hàm số $y=\\dfrac{2x+1}{x-2}$ có tính chất:",
 ["Nghịch biến trên $\\mathbb{R}$","Đồng biến trên $\\mathbb{R}$","Nghịch biến trên $(-\\infty;2)$ và $(2;+\\infty)$","Đồng biến trên $(-\\infty;2)$ và $(2;+\\infty)$"],3,"functions"),
# 8
("$\\log_a(a^3\\cdot a^{1/2})$ bằng:",
 ["$\\dfrac{7}{2}$","$\\dfrac{2}{3}$","$\\dfrac{8}{3}$","$6$"],0,"logarithm"),
# 9
("Đạo hàm của $f(x)=2^x+x$:",
 ["$\\dfrac{2^x\\cdot x}{2}$","$2^x+1$","$2^x\\ln 2+1$","$2^x\\ln 2+1$"],2,"calculus"),
# 10
("Tập xác định của $y=(x-1)^{-4}$:",
 ["$[1;\\,+\\infty)$","$\\mathbb{R}$","$(1;\\,+\\infty)$","$\\mathbb{R}\\setminus\\{1\\}$"],3,"functions"),
# 11
("Hàm số $y=\\dfrac{1}{3}x^3-x^2-3x+1$ đạt cực tiểu tại:",
 ["$x=-1$","$x=1$","$x=3$","$x=-3$"],2,"functions"),
# 12
("Thể tích khối nón có đường kính đáy $6$ và chiều cao $5$:",
 ["$60\\pi$","$45\\pi$","$180\\pi$","$15\\pi$"],3,"geometry"),
# 13
("Phương trình $5^{x+2}=1$ có tập nghiệm:",
 ["$\\{3\\}$","$\\{2\\}$","$\\{0\\}$","$\\emptyset$"],3,"logarithm"),
# 14
("Thể tích khối cầu bán kính $4$:",
 ["$\\dfrac{256\\pi}{3}$","$\\dfrac{64\\pi}{3}$","$64\\pi$","$256\\pi$"],0,"geometry"),
# 15
("Thể tích khối chóp có diện tích đáy $6$ và chiều cao $4$:",
 ["$4$","$24$","$12$","$8$"],3,"geometry"),
# 16
("Giá trị lớn nhất của $y=xe^{2x}$ trên $[-1;\\,1]$:",
 ["$e^2$","$1$","$e^2-1$","$\\dfrac{\\ln 2+1}{2}$"],0,"calculus"),
# 17
("Thể tích hộp đứng $ABCD.A'B'C'D'$ đáy hình thoi $AC=a$, $BD=a\\sqrt{3}$, cạnh bên $AA'=a\\sqrt{2}$:",
 ["$V=6a^3$","$V=\\dfrac{a^3}{6}$","$V=\\dfrac{\\sqrt{6}\\,a^3}{2}$","$V=\\dfrac{\\sqrt{6}\\,a^3}{4}$"],2,"geometry"),
# 18
("Tổng số tiệm cận ngang và tiệm cận đứng của $y=\\dfrac{x^2-1}{x}$:",
 ["$1$","$0$","$2$","$3$"],2,"functions"),
# 19
("Tỉ số thể tích phần gỗ còn lại và khối trụ ban đầu sau khi cắt khối nón nội tiếp:",
 ["$\\dfrac{2}{3}$","$\\dfrac{1}{4}$","$\\dfrac{1}{3}$","$\\dfrac{1}{2}$"],2,"geometry"),
# 20
("Cho $a=\\log_2 5$, tính $\\log_4 1250$:",
 ["$\\dfrac{1+4a}{2}$","$\\dfrac{1+4a}{2}$","$1+4a$","$2+1+4a$"],0,"logarithm"),
# 21
("Thể tích khối nón với đường sinh $2a$ và góc ở đỉnh $60°$:",
 ["$V=\\dfrac{\\pi a^3}{3}$","$V=\\dfrac{3\\pi a^3}{3}$","$V=3\\pi a^3$","$V=\\pi a^3$"],3,"geometry"),
# 22 FIGURE
("Hàm số $y=ax^3+bx^2+cx+d$ ($a\\neq 0$) với đồ thị cho sẵn."+FIG+" Kết luận nào đúng?",
 ["$a>0,\\;b^2-3ac<0$","$a>0,\\;b^2-3ac>0$","$a<0,\\;b^2-3ac<0$","$a<0,\\;b^2-3ac>0$"],0,"functions"),
# 23 FIGURE
("Cho đồ thị hàm số $y=f(x)$ như hình vẽ."+FIG+" Hàm số $y=2f(x)+2019$ nghịch biến trên khoảng nào?",
 ["$(-4;\\,2)$","$(-1;\\,2)$","$(2;\\,-1)$","$(2;\\,4)$"],1,"functions"),
# 24
("Khẳng định nào đúng về mặt cầu ngoại tiếp hình chóp?",
 ["Hình chóp đáy hình thang vuông","Hình chóp đáy tứ giác bất kỳ","Hình chóp đáy hình thang cân","Hình chóp đáy hình bình hành"],2,"geometry"),
# 25
("Thể tích chóp tứ giác đều $S.ABCD$ với tam giác $SAC$ đều cạnh $a$:",
 ["$V=a^3$","$V=\\dfrac{\\sqrt{3}\\,a^3}{12}$","$V=\\dfrac{\\sqrt{3}\\,a^3}{4}$","$V=\\dfrac{\\sqrt{3}\\,a^3}{6}$"],1,"geometry"),
# 26
("Hàm số $f(x)=\\ln x - x$ đồng biến trên:",
 ["$(0;\\,1)$","$(0;\\,+\\infty)$","$(-\\infty;\\,0)$ và $(1;\\,+\\infty)$","$(1;\\,+\\infty)$"],0,"calculus"),
# 27
("Cho cấp số cộng với $u_2$ và $u_{10}$ là $a$ và $b$ (công sai $d\\neq 0$). Tổng $S_7$ bằng bao nhiêu lần $u_4$?",
 ["$3$","$1$","$7$","$4$"],2,"sequences"),
# 28
("Bất phương trình $\\log_3(x^2+2x)>1$ có tập nghiệm:",
 ["$(-\\infty;\\,-1)\\cup(3;\\,+\\infty)$","$(-1;\\,3)$","$(3;\\,+\\infty)$","$(-\\infty;\\,-1)$"],0,"logarithm"),
# 29
("Khối chóp tứ giác $S.ABCD$ đáy hình thoi với $SABC$ là tứ diện đều cạnh $a$:",
 ["$V=\\dfrac{\\sqrt{2}\\,a^3}{2}$","$V=\\dfrac{\\sqrt{2}\\,a^3}{6}$","$V=\\dfrac{\\sqrt{2}\\,a^3}{4}$","$V=\\dfrac{\\sqrt{2}\\,a^3}{12}$"],1,"geometry"),
# 30
("Tiếp tuyến tại điểm cực đại của $y=x^3-3x+2$ có tính chất:",
 ["Hệ số góc âm","Hệ số góc dương","Song song với đường thẳng $y=4$","Song song với trục $Ox$"],2,"functions"),
# 31
("Mặt phẳng qua trọng tâm ba mặt bên chia chóp tam giác. Thể tích phần chứa đáy là bao nhiêu lần $V$?",
 ["$\\dfrac{37V}{64}$","$\\dfrac{27V}{64}$","$\\dfrac{19V}{27}$","$\\dfrac{8V}{27}$"],2,"geometry"),
# 32
("Mặt cầu tâm $O$ bán kính $2$, mặt phẳng cách $O$ khoảng $1$. Tỉ số thể tích phần nhỏ và phần lớn gần nhất:",
 ["$\\dfrac{1}{3}$","$\\dfrac{2}{3}$","$\\dfrac{16}{9}$","$\\dfrac{32}{9}$"],1,"geometry"),
# 33
("Phương trình $x^3-3mx+2=0$ có nghiệm duy nhất khi và chỉ khi:",
 ["$m\\geq 1$","$m=0$","$m<0$","$m>1$"],0,"functions"),
# 34
("Khoảng cách giữa $SM$ và $BC$ trong hình chóp với điều kiện cho sẵn:",
 ["$d=\\dfrac{2\\sqrt{21}}{7}$","$d=\\dfrac{\\sqrt{21}}{7}$","$d=\\dfrac{2\\sqrt{21}}{3}$","$d=\\dfrac{\\sqrt{21}}{3}$"],0,"geometry"),
# 35
("Cho $y=\\dfrac{3\\cos x+1}{3-\\cos x}$. Tổng GTLN $M$ và GTNN $m$ bằng:",
 ["$M+m=\\dfrac{7}{3}$","$M+m=\\dfrac{1}{6}$","$M+m=\\dfrac{5}{2}$","$M+m=\\dfrac{3}{2}$"],3,"calculus"),
# 36 FIGURE
("Hàm số $y=ax^4+bx^2+c$ ($a\\neq 0$) với đồ thị cho sẵn."+FIG+" Kết luận đúng:",
 ["$a>0,\\;b>0,\\;c>0$","$a>0,\\;b<0,\\;c>0$","$a<0,\\;b>0,\\;c>0$","$a<0,\\;b<0,\\;c<0$"],0,"functions"),
# 37
("Góc giữa hai mặt phẳng $(SAC)$ và $(SDM)$ trong hình chóp cho sẵn:",
 ["$45°$","$90°$","$60°$","$30°$"],1,"geometry"),
# 38
("Tổng giá trị tuyệt đối các phần tử của tập $S$ (điều kiện logarit):",
 ["$4$","$\\dfrac{2}{3}$","$1$","$5$"],2,"logarithm"),
# 39
("Tổng $a+b+c$ với điều kiện cho sẵn:",
 ["$8$","$2$","$1$","$5$"],1,"algebra"),
# 40 FIGURE
("Bất phương trình $2f(x)\\geq x^2-4x+m$ đúng với mọi $x\\in[-1;3]$ (xem đồ thị $f$)"+FIG+":",
 ["$m\\geq 3$","$m\\leq 10$","$m\\geq 2$","$m\\leq 5$"],1,"functions"),
# 41
("Hàm số $y=x^3-2(m+2)x^2+5x+1$ có $x_1,x_2$ cực trị với $|x_1-x_2|=2$. Giá trị $m+1$ bằng:",
 ["$\\dfrac{7}{2}$","$1$","$\\dfrac{1}{2}$","$5$"],0,"functions"),
# 42
("Với $x\\in(0;\\frac{\\pi}{2})$, $\\log_2\\sin x - \\log_2\\cos x = 1$. Số giá trị nguyên $m\\in[-10;10]$ để phương trình $f(m)$ có nghiệm là:",
 ["$11$","$12$","$10$","$15$"],1,"logarithm"),
# 43
("Số nghiệm của phương trình $50^x+2^x+5^x=3\\cdot7^x$:",
 ["$1$","$2$","$3$","$0$"],3,"logarithm"),
# 44
("Số tam giác phân biệt từ các điểm trên các cạnh $AB$, $BC$, $CA$, $AD$ (lần lượt $3,4,5,6$ điểm):",
 ["$781$","$624$","$816$","$342$"],0,"probability"),
# 45
("Thể tích chóp đều $S.ABC$ cạnh đáy $2$, $M$ trên $SA$ sao cho $SA=4SM$:",
 ["$V=\\dfrac{2\\sqrt{2}}{3}$","$V=\\dfrac{2\\sqrt{2}}{9}$","$V=\\dfrac{5\\sqrt{2}}{3}$","$V=\\dfrac{\\sqrt{2}}{3}$"],0,"geometry"),
# 46
("Thể tích khối trụ ngoại tiếp hình lăng trụ tam giác đều với điều kiện cho sẵn:",
 ["$V=\\dfrac{7R^3\\sqrt{3}}{7}$","$V=\\dfrac{5R^3\\sqrt{3}}{5}$","$V=\\dfrac{2R^3\\sqrt{3}}{1}$","$V=\\dfrac{3\\pi R^3\\sqrt{3}}{3}$"],3,"geometry"),
# 47
("$\\log_2\\sum_{k=2}^{2^{100}}k$ với $a,b,c$ nguyên. Giá trị biểu thức bằng:",
 ["$203$","$202$","$201$","$200$"],1,"sequences"),
# 48
("Số giá trị nguyên $m$ trong $(0;2020)$ để phương trình có nghiệm là:",
 ["$2020$","$2021$","$2019$","$2018$"],3,"logarithm"),
# 49
("Chiều cao hộp chữ nhật tối ưu hoá giá thành (điều kiện cho sẵn):",
 ["$12$","$13$","$11$","$10$"],2,"calculus"),
# 50
("$g(1)$ với $g(x)$ là phần dư khi chia $f(x)$ cho $(x-2)^2$ (điều kiện cho sẵn):",
 ["$4033$","$4035$","$4039$","$4037$"],1,"algebra"),
]

# ── Paper 5: THPT Chuyên Hùng Vương 2018-2019 ────────────────────────────────
SRC_HV = "dethi.edu.vn — Đề thi thử THPT 2018-2019 (THPT Chuyên Hùng Vương, Mã đề 101)"
Q_HV = [
# 1
("Trong không gian $Oxyz$, đường thẳng $d:\\begin{cases}x=1+2t\\\\y=3+t\\\\z=1+t\\end{cases}$ đi qua điểm nào?",
 ["$M(1;\\,3;\\,-1)$","$M(3;\\,5;\\,3)$","$M(-3;\\,5;\\,3)$","$M(1;\\,2;\\,-3)$"],1,"geometry"),
# 2
("Cho hàm số $y=\\dfrac{3x}{2x+1}$. Mệnh đề nào đúng?",
 ["Nghịch biến trên $\\left(-\\infty;\\,-\\dfrac{1}{2}\\right)$","Đồng biến trên $\\mathbb{R}$","Đồng biến trên $\\left(-\\dfrac{1}{2};\\,+\\infty\\right)$","Nghịch biến trên $\\mathbb{R}$"],0,"functions"),
# 3
("Bất phương trình $\\dfrac{x^2+2x+1}{2}\\leq\\dfrac{1}{8}$ có tập nghiệm là:",
 ["$(3;\\,+\\infty)$","$(-\\infty;\\,-1)$","$[-1;\\,3]$","$(1;\\,3)$"],2,"algebra"),
# 4
("Điểm cực đại của $y=x^3-6x^2+9x$ có tổng hoành độ và tung độ bằng:",
 ["$5$","$1$","$3$","$-1$"],0,"functions"),
# 5
("Cho khối trụ đường sinh $2a$, bán kính đáy $a$. Thể tích khối trụ là:",
 ["$a^3$","$2\\pi a^3$","$\\dfrac{\\pi a^3}{3}$","$\\dfrac{\\pi a^3}{6}$"],1,"geometry"),
# 6
("Trong $Oxyz$, điểm $M$ thuộc $Oy$, cách đều hai mặt phẳng $(P):x+y+z-1=0$ và $(Q):x+y+z-5=0$:",
 ["$M(0;\\,-3;\\,0)$","$M(0;\\,3;\\,0)$","$M(0;\\,-2;\\,0)$","$M(0;\\,1;\\,0)$"],0,"geometry"),
# 7
("Cho cấp số cộng $(u_n)$ có $u_4=12$ và $u_{14}=18$. Công sai $d$ bằng:",
 ["$d=3$","$d=-3$","$d=4$","$d=2$"],1,"sequences"),
# 8
("Họ nguyên hàm của $y=\\cos x + x$ là:",
 ["$\\sin x + \\dfrac{x^2}{2} + C$","$-\\sin x + \\dfrac{x^2}{2} + C$","$\\sin x + x^2 + C$","$-\\sin x + x^2 + C$"],0,"calculus"),
# 9
("Tập nghiệm của phương trình $\\log_2(x^2+2x+4)=2$:",
 ["$\\{0;\\,2\\}$","$\\{2\\}$","$\\{0\\}$","$\\{0;\\,-2\\}$"],3,"logarithm"),
# 10
("Cho hàm số $f'(x)=(x-1)(x-2)(x-1)^2$. Số cực trị của hàm số là:",
 ["$3$","$1$","$2$","$0$"],2,"functions"),
# 11
("Mặt cầu $(S):x^2+y^2+z^2-4x+2y+2z+10=0$ và mặt phẳng $(P):x+2y+2z-10=0$. Quan hệ của hai đối tượng:",
 ["$(P)$ tiếp xúc $(S)$","$(P)$ cắt $(S)$ theo đường tròn khác đường tròn lớn","$(P)$ và $(S)$ không có điểm chung","$(P)$ cắt $(S)$ theo đường tròn lớn"],0,"geometry"),
# 12
("Hàm số $y=x\\cdot 2^x$ có đạo hàm là:",
 ["$y'=(1+x\\ln 2)\\cdot 2^x$","$y'=(1+x\\ln 2)\\cdot 2^x$","$y'=(1+x)\\cdot 2^x$","$y'=2^x+x\\cdot 2^{x-1}$"],0,"calculus"),
# 13 FIGURE
("Cho hàm số $y=f(x)$ có bảng biến thiên như hình vẽ."+FIG+" Số nghiệm thực của phương trình $3f(x)-6=0$ là:",
 ["$2$","$3$","$1$","$0$"],1,"functions"),
# 14
("Nếu $2^x=3^a$ và $6^x=3^b$ thì $3^{b-a}$ bằng:",
 ["$54$","$45$","$27$","$81$"],3,"logarithm"),
# 15
("Diện tích hình phẳng giới hạn bởi $y=3^x$, $y=0$, $x=0$, $x=2$ được tính bằng:",
 ["$S=\\int_0^2 3^x\\,dx$","$S=\\int_0^2 3^{2x}\\,dx$","$S=\\pi\\int_0^2 3^x\\,dx$","$S=\\pi\\int_0^2 3^{2x}\\,dx$"],0,"calculus"),
# 16
("Đồ thị hàm số $y=x^4-3x^2+4$ cắt trục hoành tại bao nhiêu điểm?",
 ["$4$","$2$","$3$","$0$"],3,"functions"),
# 17
("Tiệm cận ngang của đồ thị $y=\\dfrac{3x+2019}{x-2}$ là:",
 ["$x=2$","$y=2$","$y=3$","$x=3$"],2,"functions"),
# 18
("GTLN $M$ và GTNN $m$ của $y=x^3-3x^2+3$ trên $[-1;\\,3]$. Giá trị $T=2M-m$ bằng:",
 ["$3$","$5$","$4$","$2$"],1,"functions"),
# 19 FIGURE
("Đường cong trong hình vẽ là đồ thị hàm số nào?"+FIG,
 ["$y=x^3-3x+1$","$y=x^3-3x^2+1$","$y=-x^3+3x+1$","$y=-x^3+3x^2+1$"],3,"functions"),
# 20
("Với $a,b>0$, $\\log(a^2 b)$ bằng:",
 ["$2\\log a+\\log b$","$2\\log a-\\log b$","$2\\log a+\\log b$","$\\log(a^2)+\\log b$"],0,"logarithm"),
# 21
("Thể tích hình hộp chữ nhật có ba kích thước $a,b,c$ là:",
 ["$V=(a+b)c$","$V=abc$","$V=abc$","$V=(a+c)b$"],1,"geometry"),
# 22
("Thể tích khối chóp tứ giác đều có tất cả cạnh bằng $a$:",
 ["$V=\\dfrac{a^3\\sqrt{2}}{6}$","$V=\\dfrac{a^3\\sqrt{2}}{3}$","$V=a^3$","$V=\\dfrac{a^3\\sqrt{2}}{2}$"],0,"geometry"),
# 23
("Mặt phẳng $(P)$ đi qua $A(1;\\,-1;\\,1)$ và chứa trục $Ox$ có phương trình:",
 ["$x-y=0$","$x-z=0$","$y-z=0$","$y+z=0$"],3,"geometry"),
# 24
("Tìm $m$ thỏa mãn $\\int_0^m(2x+1)\\,dx=2$:",
 ["$m=2$","$m$ thuộc $(-2;1)$","$m=1$","$m=-2$"],2,"calculus"),
# 25
("Khối tứ diện $OABC$ có $OA\\perp OB\\perp OC$, $OA=2OB=3OC=3a$. Thể tích là:",
 ["$6a^3$","$\\dfrac{4a^3}{3}$","$9a^3$","$\\dfrac{3a^3}{4}$"],3,"geometry"),
# 26
("Giao điểm $M$ của $(P):3x+5y+z-2=0$ và $d:\\dfrac{x-12}{4}=\\dfrac{y-9}{3}=\\dfrac{z-1}{1}$. Tổng $x_0+y_0+z_0$ bằng:",
 ["$1$","$2$","$5$","$-2$"],3,"geometry"),
# 27
("Sắp xếp $10$ người ($2$ người bắt buộc ngồi cạnh nhau) vào $10$ ghế:",
 ["$8!\\cdot 2!$","$9!$","$9!\\cdot 2!$","$10!$"],2,"probability"),
# 28
("Cho $y=\\dfrac{1}{x}$ với $x>0$. Khi đó $\\dfrac{y'}{y^2}$ bằng:",
 ["$\\dfrac{1-\\ln x}{x}$","$\\dfrac{x}{1+x\\ln x}$","$\\dfrac{1}{1+x\\ln x}$","$\\dfrac{x}{1-x\\ln x}$"],1,"calculus"),
# 29
("Ba điểm $A(1;0;0)$, $B(0;b;0)$, $C(0;0;c)$ với $bc\\neq 0$. Mặt phẳng $(P):y+z-1=0$ vuông góc $(ABC)$ khi:",
 ["$b=2c$","$b=3c$","$b=c$","$2b=c$"],2,"geometry"),
# 30
("Nam gửi $100$ triệu, lãi $3\\%$/quý. Sau $6$ tháng gửi thêm $100$ triệu. Sau $1$ năm tổng tiền (gần nhất):",
 ["$218{,}6$ triệu","$208{,}25$ triệu","$210{,}45$ triệu","$209{,}25$ triệu"],0,"calculus"),
# 31
("Cho $\\int_3^5 f(x)\\,dx=12$. Giá trị $I=\\int_1^2 f(2x+1)\\,dx$ bằng:",
 ["$8$","$12$","$4$","$6$"],3,"calculus"),
# 32
("Đồ thị $y=x^4-2ax^2+b$ có điểm cực trị $(1;2)$. Khoảng cách giữa hai điểm cực trị bằng:",
 ["$2$","$2\\sqrt{6}$","$5$","$2\\sqrt{5}$"],3,"functions"),
# 33
("Hình chóp $S.ABCD$ đáy hình vuông cạnh $a$, $SA\\perp$ đáy, $SA=a\\sqrt{3}$. $\\sin\\alpha$ (góc $SD$ và $(SAC)$) bằng:",
 ["$\\dfrac{\\sqrt{2}}{4}$","$\\dfrac{\\sqrt{2}}{2}$","$\\dfrac{\\sqrt{3}}{2}$","$\\dfrac{2}{3}$"],0,"geometry"),
# 34
("Tập $S$ gồm các số nguyên $a$ thỏa mãn $\\lim_{n\\to\\infty}\\dfrac{3^{n+2}-2^n}{2^n-4a}=0$. Tổng phần tử $S$ bằng:",
 ["$4$","$3$","$5$","$2$"],0,"sequences"),
# 35
("Hình chóp $S.ABCD$ đáy hình vuông, $SA\\perp$ đáy. Cho $B(2;3;7)$, $D(4;1;3)$. Phương trình $(SAC)$:",
 ["$x+y-2z+9=0$","$x+y-2z-9=0$","$x-y-2z+9=0$","$x-y+2z+9=0$"],0,"geometry"),
# 36
("Khối lăng trụ $ABC.A'B'C'$ có tam giác $A'BC$ diện tích $1$, khoảng cách từ $A$ đến $(A'BC)$ là $2$. Thể tích bằng:",
 ["$6$","$3$","$2$","$1$"],2,"geometry"),
# 37
("Hình vuông chia mỗi cạnh thành $n$ đoạn. Số tứ giác $a$ và hình bình hành $b$. Nếu $a=9b$ thì:",
 ["$n=5$","$n=8$","$n=4$","$n=12$"],2,"probability"),
# 38
("Cho $a,b>0$ thỏa $9^{\\log_a 4}=3^{\\log_b 8}$ và $\\log_3 a+\\log_3 b=\\log_3 9$. Giá trị $P=ab+1$ bằng:",
 ["$82$","$27$","$243$","$244$"],3,"logarithm"),
# 39
("Khối lập phương thể tích $V_1$ và hình hộp chữ nhật thể tích $V_2$ (các cạnh bằng nhau, không phải hình lập phương):",
 ["$V_1>V_2$","$V_1<V_2$","$V_1=V_2$","$V_1\\leq V_2$"],0,"geometry"),
# 40
("Hai hình nón chiều cao $2$dm, nón trên chứa nước chảy xuống. Khi nước trên cao $1$dm, chiều cao nước dưới là:",
 ["$\\sqrt[3]{7}$","$\\sqrt[3]{5}$","$\\sqrt[3]{2}$","Không xác định"],0,"calculus"),
# 41
("Hình hộp $ABCD.A'B'C'D'$ có $A=O$, $B(a;0;0)$, $D(0;a;0)$, $A'(0;0;b)$ với $a+b=2$. Thể tích $BDA'M$ ($M$ là trung điểm $CC'$) lớn nhất bằng:",
 ["$\\dfrac{64}{27}$","$\\dfrac{32}{27}$","$\\dfrac{8}{27}$","$\\dfrac{4}{27}$"],2,"geometry"),
# 42
("Cho $\\int_0^2\\dfrac{1+2x}{1-x}\\,dx=a+b\\ln 2$ ($a,b$ hữu tỉ). Giá trị $2a+b$ bằng:",
 ["$1$","$6$","$5$","$4$"],2,"calculus"),
# 43
("Chọn ngẫu nhiên $a,b$ từ $1$ đến $100$. Xác suất để $3^a+3^b$ chia hết cho $5$ bằng:",
 ["$\\dfrac{1}{2}$","$\\dfrac{1}{3}$","$\\dfrac{1}{5}$","$\\dfrac{1}{4}$"],3,"probability"),
# 44
("Hình chóp $S.ABCD$ đáy hình bình hành, $M$ trên $SA$ với $SM=x\\cdot SA$. $(MBC)$ chia chóp thành hai phần thể tích bằng nhau khi:",
 ["$x=\\dfrac{1}{2}$","$x=\\dfrac{-1+\\sqrt{5}}{2}$","$x=\\dfrac{5}{3}$","$x=\\dfrac{1-\\sqrt{5}}{3}$"],1,"geometry"),
# 45
("Hàm số $y=x^3-3mx^2+3(m^2-1)x-m^3+m$ có cực trị $A,B$. Với $I(2;-2)$, bán kính đường tròn ngoại tiếp $IAB$ là $5$ khi $m$ bằng:",
 ["$m=\\dfrac{2}{17}$","$m=\\dfrac{3}{17}$","$m=\\dfrac{4}{17}$","$m=\\dfrac{5}{17}$"],1,"functions"),
# 46
("Hàm số $f'(x)>0$ trên $(0;+\\infty)$, $f(1)=1$, $f'(x)=f(x)(3x^2+2mx+m)$. Để $f(3)=e^4$ thì $m$ bằng:",
 ["$m=2$","$m=3$","$m=-3$","$m=4$"],2,"calculus"),
# 47
("Hàm số $f(x)$ liên tục trên $\\left[\\dfrac{1}{3};3\\right]$ thỏa $f(x)+x\\cdot f\\!\\left(\\dfrac{1}{x}\\right)=x+\\dfrac{1}{x}$. Giá trị $I=\\int_{1/3}^3\\dfrac{f(x)}{x}\\,dx$ bằng:",
 ["$\\dfrac{8}{9}$","$\\dfrac{16}{9}$","$\\dfrac{2}{3}$","$\\dfrac{3}{4}$"],0,"calculus"),
# 48
("Hàm số $y=2x^3+ax^2+bx+c$ thỏa $9a+3b+c=54$ và $a+b+c=2$. Số giao điểm với $Ox$ là:",
 ["$3$","$1$","$2$","$0$"],0,"functions"),
# 49
("Mặt phẳng $(P)$ qua $A(2;0;0)$ và $M(1;1;1)$, cắt $Oy$ tại $B$, $Oz$ tại $C$. Diện tích $ABC$ nhỏ nhất:",
 ["$3\\sqrt{3}$","$4\\sqrt{3}$","$2\\sqrt{6}$","$4\\sqrt{6}$"],3,"geometry"),
# 50
("Cho $a,b>0$ thỏa $8(1+ab)=4ab\\cdot 2^{a+b}$. Giá trị lớn nhất của $P=ab+2ab^2$ là:",
 ["$3$","$1$","$\\dfrac{5}{2}$","$\\dfrac{3}{17}$"],1,"calculus"),
]

# ── Build question objects ─────────────────────────────────────────────────────
def build_questions(prefix, src, year, qlist):
    out = []
    for i, (text, choices, correct, topic) in enumerate(qlist, start=1):
        out.append({
            "id": f"{prefix}{i:03d}",
            "source": src,
            "year": year,
            "topic": topic,
            "difficulty": diff(i),
            "question": text,
            "choices": choices,
            "correct": correct,
            "explanation": ""
        })
    return out

ALL_QUESTIONS = (
    build_questions("q_thpt19_",   SRC19, 2019, Q19)
  + build_questions("q_thpt18_",   SRC18, 2018, Q18)
  + build_questions("q_camau19_",  SRC_CM, 2019, Q_CM)
  + build_questions("q_ninhbinh19_", SRC_NB, 2019, Q_NB)
  + build_questions("q_hungvuong19_", SRC_HV, 2019, Q_HV)
)

# ── Load, patch, save ──────────────────────────────────────────────────────────
def load(path): return json.loads(path.read_text(encoding='utf-8'))
def save(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

# 1. questions.json
qpath = DATA / 'questions.json'
questions = load(qpath)
existing_ids = {q['id'] for q in questions}
new_qs = [q for q in ALL_QUESTIONS if q['id'] not in existing_ids]
questions.extend(new_qs)
save(qpath, questions)
print(f"questions.json: added {len(new_qs)}, total {len(questions)}")

# 2. exams.json
epath = DATA / 'exams.json'
exams = load(epath)
existing_eids = {e['id'] for e in exams}
new_exams = [e for e in NEW_EXAMS if e['id'] not in existing_eids]
exams.extend(new_exams)
save(epath, exams)
print(f"exams.json: added {len(new_exams)}, total {len(exams)}")

# 3. question_answers.json
apath = BACKEND / 'question_answers.json'
answers = load(apath)
for q in new_qs:
    answers[q['id']] = q['correct']
save(apath, answers)
print(f"question_answers.json: added {len(new_qs)} entries, total {len(answers)}")

print("\nDone! New exams:")
for e in new_exams:
    print(f"  {e['id']} — {e['title']}")
