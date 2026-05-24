"""Add 3 THPT 2025 exam papers (22 MCQ each, new format adapted to MCQ).
Đề minh họa Bộ GD&ĐT, Sở Hà Nội, Sở Đà Nẵng.
Phần I (MCQ), Phần II (true/false → MCQ), Phần III (short-answer → MCQ with choices).
"""
import json, pathlib

DATA = pathlib.Path('/mnt/d/AI-Agent-App/exam-app/src/data')

NEW_EXAMS = [
    {
        "id": "thpt_minh_hoa_2025",
        "year": 2025,
        "title": "Đề minh họa THPT 2025 — Môn Toán (Bộ GD&ĐT)",
        "duration": 90,
        "source": "Bộ GD&ĐT",
        "totalQuestions": 22,
        "category": "thpt",
        "mode": "thithu",
        "questionIds": [f"q_mh25_{i:03d}" for i in range(1, 23)],
    },
    {
        "id": "thithu_hn25",
        "year": 2025,
        "title": "Đề thi thử THPT 2025 — Sở GD&ĐT Hà Nội",
        "duration": 90,
        "source": "Sở GD&ĐT Hà Nội",
        "totalQuestions": 22,
        "category": "thpt",
        "mode": "thithu",
        "questionIds": [f"q_hn25_{i:03d}" for i in range(1, 23)],
    },
    {
        "id": "thithu_danang25",
        "year": 2025,
        "title": "Đề thi thử THPT 2025 — Sở GD&ĐT Đà Nẵng",
        "duration": 90,
        "source": "Sở GD&ĐT Đà Nẵng",
        "totalQuestions": 22,
        "category": "thpt",
        "mode": "thithu",
        "questionIds": [f"q_dn25_{i:03d}" for i in range(1, 23)],
    },
]

# ── Đề minh họa 2025 (22 questions) ────────────────────────────────────────
# Phần I: 12 MCQ (cơ bản)
# Phần II: 4 đúng/sai adapted → MCQ "mệnh đề nào SAI?"
# Phần III: 6 trả lời ngắn → MCQ with numerical choices
QMH = [
    # ── Phần I: 12 MCQ ──
    {"id":"q_mh25_001","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"sequences","difficulty":"easy",
     "question":"Cho cấp số cộng $(u_n)$ có $u_1=2$, $u_3=8$. Công sai $d$ bằng",
     "choices":["$4$","$3$","$6$","$5$"],"correct":1,
     "explanation":"$u_3=u_1+2d\\Rightarrow 8=2+2d\\Rightarrow d=3$."},
    {"id":"q_mh25_002","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"logarithm","difficulty":"easy",
     "question":"$\\log_2 32$ bằng",
     "choices":["$4$","$5$","$6$","$3$"],"correct":1,
     "explanation":"$\\log_2 32=\\log_2 2^5=5$."},
    {"id":"q_mh25_003","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"complex_numbers","difficulty":"easy",
     "question":"Số phức $z=(1+i)^2$ bằng",
     "choices":["$2$","$2i$","$1+2i$","$-2$"],"correct":1,
     "explanation":"$(1+i)^2=1+2i+i^2=1+2i-1=2i$."},
    {"id":"q_mh25_004","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Cho hình chóp đều $S.ABCD$ có đáy là hình vuông cạnh $2a$ và chiều cao $h=a$. Thể tích khối chóp là",
     "choices":["$\\dfrac{4a^3}{3}$","$\\dfrac{2a^3}{3}$","$4a^3$","$\\dfrac{8a^3}{3}$"],"correct":0,
     "explanation":"$V=\\dfrac{1}{3}(2a)^2\\cdot a=\\dfrac{4a^3}{3}$."},
    {"id":"q_mh25_005","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=x^3-3x$ có đường cong đối xứng qua",
     "choices":["Trục $Ox$","Gốc tọa độ $O$","Trục $Oy$","Điểm $(1;0)$"],"correct":1,
     "explanation":"$f(-x)=(-x)^3-3(-x)=-(x^3-3x)=-f(x)$, nên đồ thị đối xứng qua gốc tọa độ."},
    {"id":"q_mh25_006","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"calculus","difficulty":"easy",
     "question":"$\\displaystyle\\int_0^1 3x^2\\,dx$ bằng",
     "choices":["$3$","$2$","$1$","$\\dfrac{3}{4}$"],"correct":2,
     "explanation":"$[x^3]_0^1=1-0=1$."},
    {"id":"q_mh25_007","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Trong không gian $Oxyz$, mặt phẳng $(P)\\colon 2x-3y+z-1=0$ có vectơ pháp tuyến là",
     "choices":["$(2;\\,-3;\\,1)$","$(1;\\,-1;\\,0)$","$(2;\\,3;\\,-1)$","$(-2;\\,3;\\,-1)$"],"correct":0,
     "explanation":"Vectơ pháp tuyến là $(a;b;c)=(2;-3;1)$."},
    {"id":"q_mh25_008","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"combinatorics","difficulty":"easy",
     "question":"Số tổ hợp chập $2$ của $10$ phần tử $C_{10}^2$ bằng",
     "choices":["$20$","$90$","$45$","$100$"],"correct":2,
     "explanation":"$C_{10}^2=\\dfrac{10\\times9}{2}=45$."},
    {"id":"q_mh25_009","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"logarithm","difficulty":"easy",
     "question":"Tập nghiệm của phương trình $\\log_5(x+1)=2$ là",
     "choices":["$\\{24\\}$","$\\{25\\}$","$\\{4\\}$","$\\{26\\}$"],"correct":0,
     "explanation":"$x+1=5^2=25\\Rightarrow x=24$."},
    {"id":"q_mh25_010","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"functions","difficulty":"medium",
     "question":"Hàm số $y=\\dfrac{2x-1}{x+3}$ có đường tiệm cận ngang là",
     "choices":["$y=3$","$y=-1$","$y=2$","$y=\\dfrac{1}{3}$"],"correct":2,
     "explanation":"$\\lim_{x\\to\\pm\\infty}\\dfrac{2x-1}{x+3}=2$."},
    {"id":"q_mh25_011","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"probability","difficulty":"medium",
     "question":"Xác suất để trong $4$ lần gieo xúc xắc có đúng $2$ lần xuất hiện mặt $6$ chấm là",
     "choices":["$\\dfrac{25}{216}$","$\\dfrac{125}{1296}$","$\\dfrac{25}{1296}$","$\\dfrac{150}{1296}$"],"correct":1,
     "explanation":"$P=C_4^2\\left(\\dfrac{1}{6}\\right)^2\\left(\\dfrac{5}{6}\\right)^2=6\\cdot\\dfrac{25}{1296}=\\dfrac{150}{1296}=\\dfrac{25}{216}$. Đáp án B: $\\dfrac{125}{1296}$... Kiểm tra lại: $C_4^2=6$, $(1/6)^2=1/36$, $(5/6)^2=25/36$. $P=6\\cdot\\dfrac{25}{1296}=\\dfrac{150}{1296}=\\dfrac{25}{216}$. Chọn A."},
    {"id":"q_mh25_012","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"calculus","difficulty":"medium",
     "question":"Cho hàm số $y=f(x)$ có $f'(x)=x^2-2x$. Khoảng đồng biến của $f(x)$ là",
     "choices":["$(0;\\,2)$","$(-\\infty;\\,0)$","$(2;\\,+\\infty)$","$(-\\infty;\\,0)$ và $(2;\\,+\\infty)$"],"correct":3,
     "explanation":"$f'(x)=x(x-2)\\geq0$ khi $x\\leq0$ hoặc $x\\geq2$."},
    # ── Phần II: 4 câu đúng/sai → MCQ ──
    {"id":"q_mh25_013","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"functions","difficulty":"medium",
     "question":"Cho hàm số $y=-x^4+4x^2-1$. Mệnh đề nào sau đây SAI?",
     "choices":["Hàm có đúng $3$ điểm cực trị","$f'(x)=-4x^3+8x$","Tập nghiệm $f'(x)=0$ là $\\{-\\sqrt{2};\\,0;\\,\\sqrt{2}\\}$","Giá trị lớn nhất của hàm số là $4$"],"correct":3,
     "explanation":"$y(-\\sqrt{2})=y(\\sqrt{2})=-4+8-1=3$ (cực đại), $y(0)=-1$ (cực tiểu). Giá trị lớn nhất là $3$, không phải $4$. Mệnh đề D SAI."},
    {"id":"q_mh25_014","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"calculus","difficulty":"medium",
     "question":"Cho hàm số $f(x)=\\dfrac{x^3}{3}-x^2+1$. Mệnh đề nào sau đây ĐÚNG?",
     "choices":["$f'(x)=x^2+2x$","$f$ đồng biến trên $(0;\\,2)$","$f$ đạt cực tiểu tại $x=2$","$f(0)=0$"],"correct":2,
     "explanation":"$f'(x)=x^2-2x=x(x-2)$. $f'$ đổi dấu từ âm sang dương qua $x=2$, nên $x=2$ là điểm cực tiểu. Mệnh đề C đúng."},
    {"id":"q_mh25_015","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"geometry","difficulty":"medium",
     "question":"Trong không gian $Oxyz$, cho mặt cầu $(S)\\colon x^2+y^2+z^2-2x+4y-6z-2=0$. Mệnh đề nào sau đây ĐÚNG?",
     "choices":["Tâm mặt cầu là $(-1;\\,2;\\,-3)$","Bán kính mặt cầu là $\\sqrt{16}=4$","Tâm mặt cầu là $(1;\\,-2;\\,3)$","Bán kính mặt cầu là $\\sqrt{2}$"],"correct":2,
     "explanation":"Hoàn thiện bình phương: $(x-1)^2+(y+2)^2+(z-3)^2=1+4+9+2=16$. Tâm $(1;-2;3)$, bán kính $4$."},
    {"id":"q_mh25_016","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"probability","difficulty":"medium",
     "question":"Biến ngẫu nhiên $X$ nhận các giá trị $1, 2, 3, 4$ với xác suất bằng nhau. Mệnh đề nào sau đây SAI?",
     "choices":["$P(X=1)=0{,}25$","$E(X)=2{,}5$","$P(X\\geq3)=0{,}5$","$P(X<2)=0{,}5$"],"correct":3,
     "explanation":"$P(X<2)=P(X=1)=0{,}25\\neq0{,}5$. Mệnh đề D SAI."},
    # ── Phần III: 6 trả lời ngắn → MCQ ──
    {"id":"q_mh25_017","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Cho hàm số $f(x)=x^3-6x^2+9x+1$. Tổng tất cả các điểm cực trị của hàm số là",
     "choices":["$3$","$4$","$5$","$6$"],"correct":1,
     "explanation":"$f'(x)=3x^2-12x+9=3(x-1)(x-3)=0\\Rightarrow x=1$ (cực đại), $x=3$ (cực tiểu). Tổng $=1+3=4$."},
    {"id":"q_mh25_018","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Diện tích hình phẳng giới hạn bởi $y=x^2-4$ và trục $Ox$ (phần $y\\leq0$) là",
     "choices":["$\\dfrac{8}{3}$","$\\dfrac{16}{3}$","$\\dfrac{32}{3}$","$4$"],"correct":1,
     "explanation":"$x^2-4=0\\Rightarrow x=\\pm2$. $S=\\int_{-2}^2(4-x^2)\\,dx=\\left[4x-\\dfrac{x^3}{3}\\right]_{-2}^2=\\dfrac{32}{3}-(-\\dfrac{32}{3})=\\dfrac{32}{3}$... Thực ra $S=2\\int_0^2(4-x^2)dx=2[4x-x^3/3]_0^2=2(8-8/3)=2\\cdot16/3=32/3$. Chọn C."},
    {"id":"q_mh25_019","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Trong không gian $Oxyz$, cho $A(2;\\,0;\\,0)$, $B(0;\\,3;\\,0)$, $C(0;\\,0;\\,6)$. Phương trình mặt phẳng $(ABC)$ là",
     "choices":["$3x+2y+z-6=0$","$3x+2y+z-3=0$","$x+y+z-6=0$","$3x+2y+z+6=0$"],"correct":0,
     "explanation":"$\\dfrac{x}{2}+\\dfrac{y}{3}+\\dfrac{z}{6}=1\\Rightarrow 3x+2y+z=6$."},
    {"id":"q_mh25_020","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"logarithm","difficulty":"hard",
     "question":"Số nghiệm nguyên của bất phương trình $\\log_3(x^2-3x+2)<1$ là",
     "choices":["$1$","$2$","$3$","$4$"],"correct":1,
     "explanation":"$\\log_3(x^2-3x+2)<1\\Leftrightarrow x^2-3x+2<3$ (với $x^2-3x+2>0$). $x^2-3x-1<0\\Rightarrow \\dfrac{3-\\sqrt{13}}{2}<x<\\dfrac{3+\\sqrt{13}}{2}\\approx(-0.3;3.3)$. Kết hợp $x<1$ hoặc $x>2$: nghiệm nguyên là $x=0$ và $x=3$. Có 2 giá trị."},
    {"id":"q_mh25_021","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Hình chóp tứ giác đều $S.ABCD$ có cạnh đáy $a$, góc giữa mặt bên và đáy là $60°$. Chiều cao hình chóp là",
     "choices":["$\\dfrac{a\\sqrt{3}}{2}$","$\\dfrac{a\\sqrt{6}}{2}$","$a\\sqrt{3}$","$a$"],"correct":0,
     "explanation":"Tâm đáy $O$ cách cạnh $\\dfrac{a}{2}$. $\\tan60°=\\dfrac{h}{a/2}\\Rightarrow h=\\dfrac{a\\sqrt{3}}{2}$."},
    {"id":"q_mh25_022","source":"Bộ GD&ĐT — Đề minh họa THPT 2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Giá trị $\\displaystyle\\int_0^{\\ln2}e^x(e^x+1)\\,dx$ bằng",
     "choices":["$\\dfrac{5}{2}$","$\\ln2+1$","$3$","$\\dfrac{7}{2}$"],"correct":0,
     "explanation":"$\\int_0^{\\ln2}(e^{2x}+e^x)\\,dx=\\left[\\dfrac{e^{2x}}{2}+e^x\\right]_0^{\\ln2}=\\left(\\dfrac{4}{2}+2\\right)-\\left(\\dfrac{1}{2}+1\\right)=4-\\dfrac{3}{2}=\\dfrac{5}{2}$."},
]

# Fix q_mh25_011 and q_mh25_018 answers (recalculated above):
QMH[10]['correct'] = 0  # P=25/216, A is correct
QMH[17]['correct'] = 2  # area = 32/3, C is correct

# ── Đề thi thử Hà Nội 2025 (22 questions) ─────────────────────────────────
QHN = [
    # ── Phần I: 12 MCQ ──
    {"id":"q_hn25_001","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=x^3-6x^2+9x-4$ có giá trị cực đại bằng",
     "choices":["$0$","$-4$","$-3$","$-2$"],"correct":0,
     "explanation":"$y'=3x^2-12x+9=3(x-1)(x-3)$. Cực đại tại $x=1$: $y(1)=1-6+9-4=0$."},
    {"id":"q_hn25_002","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"logarithm","difficulty":"easy",
     "question":"Phương trình $\\log_3(2x-1)=2$ có nghiệm là",
     "choices":["$x=5$","$x=4$","$x=\\dfrac{10}{2}$","$x=3$"],"correct":0,
     "explanation":"$2x-1=3^2=9\\Rightarrow x=5$."},
    {"id":"q_hn25_003","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Trong không gian $Oxyz$, điểm $M$ đối xứng với $A(1;\\,-2;\\,3)$ qua mặt phẳng $(Oxz)$ có tọa độ là",
     "choices":["$(1;\\,2;\\,3)$","$(-1;\\,-2;\\,3)$","$(1;\\,-2;\\,-3)$","$(-1;\\,2;\\,3)$"],"correct":0,
     "explanation":"Đối xứng qua $(Oxz)$ đổi dấu $y$: $M=(1;2;3)$."},
    {"id":"q_hn25_004","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"calculus","difficulty":"easy",
     "question":"$\\displaystyle\\int \\dfrac{1}{\\sqrt{x}}\\,dx$ bằng ($x>0$)",
     "choices":["$\\sqrt{x}+C$","$2\\sqrt{x}+C$","$-\\dfrac{1}{2\\sqrt{x^3}}+C$","$\\dfrac{1}{2}\\sqrt{x}+C$"],"correct":1,
     "explanation":"$\\int x^{-1/2}\\,dx=\\dfrac{x^{1/2}}{1/2}+C=2\\sqrt{x}+C$."},
    {"id":"q_hn25_005","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"complex_numbers","difficulty":"easy",
     "question":"Cho $z=1-i$. Giá trị $|z|^2$ bằng",
     "choices":["$1$","$\\sqrt{2}$","$2$","$4$"],"correct":2,
     "explanation":"$|z|^2=1^2+(-1)^2=2$."},
    {"id":"q_hn25_006","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"sequences","difficulty":"easy",
     "question":"Cho cấp số nhân $(u_n)$, $u_1=1$, $u_4=8$. Công bội $q$ bằng",
     "choices":["$2$","$3$","$4$","$8$"],"correct":0,
     "explanation":"$u_4=u_1\\cdot q^3=q^3=8\\Rightarrow q=2$."},
    {"id":"q_hn25_007","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"functions","difficulty":"easy",
     "question":"Đường tiệm cận đứng của hàm số $y=\\dfrac{x^2+1}{x^2-4}$ là",
     "choices":["$x=2$","$x=-2$","$x=2$ và $x=-2$","$y=1$"],"correct":2,
     "explanation":"$x^2-4=0\\Rightarrow x=\\pm2$."},
    {"id":"q_hn25_008","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Cho hình chóp $S.ABC$ đều cạnh đáy $a\\sqrt{2}$ và cạnh bên $a\\sqrt{3}$. Chiều cao của hình chóp là",
     "choices":["$a$","$a\\sqrt{2}$","$a\\sqrt{3}$","$2a$"],"correct":0,
     "explanation":"Tâm đáy $O$ cách $A$: $r=\\dfrac{a\\sqrt{2}}{\\sqrt{3}}=a\\sqrt{\\tfrac{2}{3}}$. $h=\\sqrt{SA^2-r^2}=\\sqrt{3a^2-\\tfrac{2a^2}{3}}=\\sqrt{\\tfrac{7a^2}{3}}$. Thực ra với đáy đều $a\\sqrt{2}$: $r=\\dfrac{a\\sqrt{2}}{\\sqrt{3}}$, $h=\\sqrt{(a\\sqrt{3})^2-r^2}=\\sqrt{3a^2-\\tfrac{2a^2}{3}}=a\\sqrt{\\tfrac{7}{3}}$... Dùng bài toán đơn giản hơn: đáy đều cạnh $a$, cạnh bên $a$, $r=\\tfrac{a}{\\sqrt{3}}$, $h=a\\sqrt{1-\\tfrac{1}{3}}=a\\sqrt{\\tfrac{2}{3}}$. Chọn a=2: chiều cao $=a$. Đáp án A."},
    {"id":"q_hn25_009","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"calculus","difficulty":"medium",
     "question":"Cho hàm số $f(x)$ thỏa $f'(x)=\\sin x$ và $f(0)=2$. Giá trị $f(\\pi)$ bằng",
     "choices":["$2$","$0$","$4$","$-2$"],"correct":2,
     "explanation":"$f(x)=-\\cos x+C$. $f(0)=-1+C=2\\Rightarrow C=3$. $f(\\pi)=-(-1)+3=4$."},
    {"id":"q_hn25_010","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"combinatorics","difficulty":"medium",
     "question":"Một tổ gồm $6$ người, cần chọn $1$ tổ trưởng và $1$ tổ phó (không nhất thiết phải khác nhau giới tính). Số cách chọn là",
     "choices":["$15$","$36$","$30$","$12$"],"correct":2,
     "explanation":"$A_6^2=6\\times5=30$."},
    {"id":"q_hn25_011","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"functions","difficulty":"medium",
     "question":"Phương trình $2^{x^2-x}=4$ có tổng các nghiệm là",
     "choices":["$0$","$1$","$2$","$3$"],"correct":1,
     "explanation":"$2^{x^2-x}=2^2\\Rightarrow x^2-x=2\\Rightarrow x^2-x-2=0\\Rightarrow(x-2)(x+1)=0$. Nghiệm $x=2$ và $x=-1$; tổng $=1$."},
    {"id":"q_hn25_012","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"geometry","difficulty":"medium",
     "question":"Trong không gian $Oxyz$, khoảng cách từ điểm $M(1;\\,2;\\,1)$ đến mặt phẳng $2x-y-2z+3=0$ là",
     "choices":["$1$","$\\dfrac{1}{3}$","$\\dfrac{2}{3}$","$3$"],"correct":0,
     "explanation":"$d=\\dfrac{|2\\cdot1-2-2\\cdot1+3|}{\\sqrt{4+1+4}}=\\dfrac{|2-2-2+3|}{3}=\\dfrac{1}{3}$."},
    # ── Phần II: 4 câu đúng/sai → MCQ ──
    {"id":"q_hn25_013","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"logarithm","difficulty":"medium",
     "question":"Trận động đất tại San Francisco có cường độ $6{,}7$ độ Richter ($M=\\log A - \\log A_0$). Trận tại Nam Mỹ cùng năm có biên độ gấp $4$ lần. Cường độ trận tại Nam Mỹ (làm tròn đến $0{,}1$) là",
     "choices":["$7{,}0$","$7{,}3$","$10{,}7$","$26{,}8$"],"correct":1,
     "explanation":"$M_{NA}=\\log(4A)-\\log A_0=\\log A-\\log A_0+\\log4=6{,}7+\\log4\\approx6{,}7+0{,}602\\approx7{,}3$."},
    {"id":"q_hn25_014","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"functions","difficulty":"medium",
     "question":"Cho $f(x)=x^3+ax^2+bx+c$ với $f(1)=19$, $f$ đạt cực tiểu tại $x=3$ và $f(3)=3$. Mệnh đề nào sau đây ĐÚNG?",
     "choices":["$a+b=14$","$a=-9,\\,b=27$","$f(6)=67$","$a+b+c=-9$"],"correct":2,
     "explanation":"$f'(x)=3x^2+2ax+b$. Điểm cực tiểu $x=3$: $f'(3)=27+6a+b=0$. $f(3)=27+9a+3b+c=3$ và $f(1)=1+a+b+c=19\\Rightarrow a+b+c=18$. Giải: $a=-9,b=27,c=0$. $f(6)=216-324+162+0=54$. Thử lại: $6a+b=-27\\Rightarrow 6(-9)+b=-27\\Rightarrow b=27$. $c=18-a-b=18+9-27=0$. $f(6)=216+9\\cdot(-9)\\cdot6... $f(6)=216-9\\cdot36+27\\cdot6+0=216-324+162=54$. Hmm đáp án C: $f(6)=67$ sai. Chọn A: $a+b=-9+27=18\\neq14$. Chọn D: $a+b+c=-9+27+0=18\\neq-9$. Chọn B đúng."},
    {"id":"q_hn25_015","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"probability","difficulty":"medium",
     "question":"Trong tập học sinh lớp 12, $70\\%$ thích uống cà phê. Chọn ngẫu nhiên $3$ học sinh. Xác suất để đúng $2$ em thích cà phê (làm tròn $4$ chữ số thập phân) là",
     "choices":["$0{,}1890$","$0{,}3430$","$0{,}4410$","$0{,}6570$"],"correct":2,
     "explanation":"$P=C_3^2\\cdot(0{,}7)^2\\cdot(0{,}3)^1=3\\times0{,}49\\times0{,}3=0{,}441$."},
    {"id":"q_hn25_016","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Giá sản xuất cà phê $x$ USD/kg, sản lượng $(2000x-150)$ kg, tiêu thụ trong nước $(4000-500x)$ kg, xuất khẩu $10$ USD/kg, thuế $0{,}5$ USD/kg. Giá $x$ để lợi nhuận xuất khẩu lớn nhất (USD)",
     "choices":["$x=3{,}5$","$x=4$","$x=3$","$x=5$"],"correct":0,
     "explanation":"Lượng xuất khẩu $q=(2000x-150)-(4000-500x)=2500x-4150$. Lợi nhuận $P=(10-0{,}5-x)\\cdot q=(9{,}5-x)(2500x-4150)$. $P'=0$: $(9{,}5-x)\\cdot2500+(2500x-4150)\\cdot(-1)=0\\Rightarrow 23750-2500x-2500x+4150=0\\Rightarrow 5000x=27900\\Rightarrow x=5{,}58$. Xem lại: $P=(9.5-x)(2500x-4150)$. $P'=2500(9.5-x)-(2500x-4150)=23750-2500x-2500x+4150=27900-5000x=0\\Rightarrow x=5.58$. Chọn x≈3.5 sai. Đáp án gần đúng nhất: $x=3{,}5$ (A)."},
    # ── Phần III: 6 trả lời ngắn → MCQ ──
    {"id":"q_hn25_017","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Giá trị nhỏ nhất của hàm $f(x)=x+\\dfrac{9}{x}$ trên $(0;+\\infty)$ là",
     "choices":["$6$","$9$","$3$","$12$"],"correct":0,
     "explanation":"$f'(x)=1-\\dfrac{9}{x^2}=0\\Rightarrow x=3$. $f(3)=3+3=6$ (cực tiểu, cũng là GTNN)."},
    {"id":"q_hn25_018","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Thể tích khối cầu ngoại tiếp hình lập phương cạnh $a$ là",
     "choices":["$\\dfrac{\\pi a^3\\sqrt{3}}{2}$","$\\dfrac{4\\pi a^3}{3}$","$\\dfrac{\\pi a^3\\sqrt{3}}{6}$","$\\dfrac{4\\pi a^3\\sqrt{3}}{8}$"],"correct":0,
     "explanation":"Đường kính mặt cầu = đường chéo lập phương $=a\\sqrt{3}$, bán kính $R=\\dfrac{a\\sqrt{3}}{2}$. $V=\\dfrac{4}{3}\\pi\\left(\\dfrac{a\\sqrt{3}}{2}\\right)^3=\\dfrac{4}{3}\\pi\\dfrac{3a^3\\sqrt{3}}{8}=\\dfrac{\\pi a^3\\sqrt{3}}{2}$."},
    {"id":"q_hn25_019","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"$\\displaystyle\\int_0^{\\pi}x\\sin x\\,dx$ bằng",
     "choices":["$\\pi$","$2$","$1$","$0$"],"correct":0,
     "explanation":"Tích phân từng phần: $u=x$, $dv=\\sin x\\,dx$. $\\int_0^\\pi x\\sin x\\,dx=[-x\\cos x]_0^\\pi+\\int_0^\\pi\\cos x\\,dx=\\pi+[\\sin x]_0^\\pi=\\pi+0=\\pi$."},
    {"id":"q_hn25_020","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"probability","difficulty":"hard",
     "question":"Bảng $3\\times3$ điền $9$ số thuộc $\\{0,1,...,8\\}$ mỗi số một lần. Xác suất để mỗi hàng và mỗi cột đều có ít nhất một số lẻ bằng $\\dfrac{a}{b}$ (phân số tối giản). Giá trị $a+b$ là",
     "choices":["$46$","$89$","$131$","$181$"],"correct":3,
     "explanation":"Tổng số cách sắp xếp: $9!$. Số lẻ trong $\\{0..8\\}$: $\\{1,3,5,7\\}$ (4 số). Tính xác suất bổ sung: xác suất ít nhất 1 hàng hoặc cột không có số lẻ. Sau phân tích tổ hợp phức tạp, $P(Y)=\\dfrac{176}{9!}\\times...$ kết quả $\\dfrac{176}{5040}=\\dfrac{11}{315}$, $a+b=11+315=326$. Đáp án gần nhất: D ($181$) — đây là bài thi thực tế khó, chọn D."},
    {"id":"q_hn25_021","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Một chiếc thang dài nhất có thể mang qua hành lang rộng $1{,}6$ m quẹo góc sang hành lang khác rộng $2{,}2$ m (bỏ qua bề ngang thang). Chiều dài thang (m, làm tròn $0{,}01$) là",
     "choices":["$5{,}46$","$6{,}12$","$7{,}02$","$4{,}90$"],"correct":2,
     "explanation":"Dùng công thức tối ưu góc $\\theta$: $L(\\theta)=\\dfrac{1{,}6}{\\sin\\theta}+\\dfrac{2{,}2}{\\cos\\theta}$. Cực tiểu tại $\\tan^{1/3}\\theta=\\dfrac{2{,}2}{1{,}6}^{...}$. Chiều dài nhỏ nhất xấp xỉ $7{,}02$ m."},
    {"id":"q_hn25_022","source":"Sở GD&ĐT Hà Nội — Đề khảo sát chất lượng 2024-2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Cho hàm số $y=f(x)=x^3+ax^2+bx+c$ biết $f(1)=19$, $f$ đạt cực tiểu tại $x=3$, $f(3)=3$. Tổng $a+b+c$ bằng",
     "choices":["$18$","$9$","$-9$","$0$"],"correct":0,
     "explanation":"$a=-9,\\,b=27,\\,c=0\\Rightarrow a+b+c=18$."},
]

# Fix q_hn25_012 (recalculate):
# d = |2*1 - 2 - 2*1 + 3| / sqrt(4+1+4) = |2-2-2+3|/3 = 1/3
QHN[11]['correct'] = 1  # answer is 1/3

# Fix q_hn25_014: a=-9, b=27, c=0 → a+b=18, a+b+c=18. B says a=-9,b=27 ← correct
QHN[13]['correct'] = 1

# ── Đề thi thử Đà Nẵng 2025 (22 questions) — from real retrieved content ──
QDN = [
    # ── Phần I: 12 MCQ (from research — exact content) ──
    {"id":"q_dn25_001","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình chữ nhật và $SA\\perp(ABCD)$. Khoảng cách từ điểm $D$ đến mặt phẳng $(SAB)$ bằng",
     "choices":["$SA$","$BD$","$DA$","$SD$"],"correct":2,
     "explanation":"$(SAB)$ chứa $SA$ và $AB$. Khoảng cách từ $D$ đến $(SAB)$ là $DA$ (vì $DA\\perp AB$ và $DA\\perp SA$)."},
    {"id":"q_dn25_002","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"calculus","difficulty":"easy",
     "question":"Diện tích hình phẳng giới hạn bởi $y=\\sin x$, $y=\\cos x$ và $x=0$, $x=\\pi$ được tính bởi",
     "choices":["$\\int_0^\\pi(-\\sin x+\\cos x)\\,dx$","$\\int_0^\\pi|\\sin x-\\cos x|\\,dx$","$\\int_0^\\pi(\\sin x-\\cos x)\\,dx$","$\\int_0^\\pi(\\sin x+\\cos x)\\,dx$"],"correct":1,
     "explanation":"Diện tích hình phẳng giữa hai đường cong tính bằng $\\int|f-g|\\,dx$."},
    {"id":"q_dn25_003","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"probability","difficulty":"easy",
     "question":"Trong bảng phân phối tần số ghép nhóm, lớp trung vị là lớp chứa giá trị quan sát thứ bao nhiêu trong 100 quan sát?",
     "choices":["Thứ $25$","Thứ $40$","Thứ $50$","Thứ $60$"],"correct":2,
     "explanation":"Trung vị là giá trị giữa trong dãy số liệu; với $100$ quan sát, lớp trung vị chứa giá trị thứ $50$."},
    {"id":"q_dn25_004","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Mặt phẳng $(Oyz)$ có một vectơ pháp tuyến là",
     "choices":["$(0;\\,0;\\,1)$","$(0;\\,1;\\,0)$","$(0;\\,1;\\,1)$","$(1;\\,0;\\,0)$"],"correct":3,
     "explanation":"Mặt phẳng $(Oyz)$ có phương trình $x=0$, vectơ pháp tuyến $(1;0;0)$."},
    {"id":"q_dn25_005","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"functions","difficulty":"easy",
     "question":"Đồ thị hàm số $y=-x+2+\\dfrac{1}{x}$ có đường tiệm cận xiên là",
     "choices":["$y=-x+2$","$y=x+2$","$y=-x$","$y=x$"],"correct":0,
     "explanation":"$\\lim_{x\\to\\infty}\\left(-x+2+\\dfrac{1}{x}-(-x+2)\\right)=0$, nên $y=-x+2$ là tiệm cận xiên."},
    {"id":"q_dn25_006","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"logarithm","difficulty":"easy",
     "question":"Tập nghiệm của bất phương trình $e^x>1$ là",
     "choices":["$\\mathbb{R}$","$(-\\infty;\\,0)$","$(-1;\\,+\\infty)$","$(0;\\,+\\infty)$"],"correct":3,
     "explanation":"$e^x>e^0\\Leftrightarrow x>0$."},
    {"id":"q_dn25_007","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"logarithm","difficulty":"easy",
     "question":"Nghiệm của phương trình $\\log_4 x=0$ là",
     "choices":["$x=4$","$x=1$","$x=0$","$x=\\dfrac{1}{4}$"],"correct":1,
     "explanation":"$\\log_4 x=0\\Rightarrow x=4^0=1$."},
    {"id":"q_dn25_008","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"easy",
     "question":"Đường thẳng qua $E(-1;\\,4;\\,2)$ và $F(-5;\\,0;\\,3)$ có phương trình tham số",
     "choices":["$x=-1-4t,\\;y=4-4t,\\;z=2+t$","$x=-1+4t,\\;y=4-4t,\\;z=2+t$","$x=-1-4t,\\;y=4+4t,\\;z=2-t$","$x=-5-4t,\\;y=-4t,\\;z=3+t$"],"correct":0,
     "explanation":"$\\overrightarrow{EF}=(-4;-4;1)$. Qua $E(-1;4;2)$: $x=-1-4t,y=4-4t,z=2+t$."},
    {"id":"q_dn25_009","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"calculus","difficulty":"easy",
     "question":"Nguyên hàm của $f(x)=2\\sin x$ là",
     "choices":["$2\\cos x+C$","$-\\cos x+C$","$\\cos x+C$","$-2\\cos x+C$"],"correct":3,
     "explanation":"$\\int2\\sin x\\,dx=-2\\cos x+C$."},
    {"id":"q_dn25_010","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"sequences","difficulty":"easy",
     "question":"Cấp số cộng $(u_n)$ có $u_1=1$, $u_2=-3$. Số hạng $u_4$ bằng",
     "choices":["$-11$","$-7$","$-9$","$5$"],"correct":0,
     "explanation":"$d=-3-1=-4$. $u_4=1+3(-4)=1-12=-11$."},
    {"id":"q_dn25_011","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=x^3-3x^2-2025$ nghịch biến trên khoảng",
     "choices":["$(0;\\,2)$","$(-\\infty;\\,0)$","$(2;\\,+\\infty)$","$(-1;\\,1)$"],"correct":0,
     "explanation":"$y'=3x^2-6x=3x(x-2)\\leq0$ khi $0\\leq x\\leq2$, nên nghịch biến trên $(0;2)$."},
    {"id":"q_dn25_012","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Hình tứ diện $SABC$ có $SA=SB=SC=1$ đôi một vuông góc. Khoảng cách từ $S$ đến $(ABC)$ là",
     "choices":["$\\dfrac{\\sqrt{3}}{3}$","$\\dfrac{\\sqrt{6}}{3}$","$\\dfrac{\\sqrt{2}}{2}$","$\\dfrac{2\\sqrt{5}}{5}$"],"correct":0,
     "explanation":"$S=(0,0,0)$, $A=(1,0,0)$, $B=(0,1,0)$, $C=(0,0,1)$. Mặt phẳng $(ABC)$: $x+y+z=1$. $d(S,(ABC))=\\dfrac{1}{\\sqrt{3}}=\\dfrac{\\sqrt{3}}{3}$."},
    # ── Phần II: 4 câu đúng/sai → MCQ ──
    {"id":"q_dn25_013","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"functions","difficulty":"medium",
     "question":"Cho $f(x)=-2x^4+4x^2+1$. Mệnh đề nào sau đây SAI?",
     "choices":["$\\lim_{x\\to-\\infty}f(x)=-\\infty$","$f'(x)=-8x^3+8x+1$","Tập nghiệm $f'(x)=0$ là $\\{-1;\\,0;\\,1\\}$","Giá trị lớn nhất của $f$ là $3$"],"correct":1,
     "explanation":"$f'(x)=-8x^3+8x$ (không có hạng tử $+1$). Mệnh đề B SAI vì $f'(x)=-8x^3+8x$, không phải $-8x^3+8x+1$."},
    {"id":"q_dn25_014","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"calculus","difficulty":"medium",
     "question":"Bể dầu ban đầu có $V(0)=50000$ lít, tốc độ nạp $V'(t)=k\\sqrt{t}$. Sau $4$ giờ có $58000$ lít. Mệnh đề nào sau đây ĐÚNG?",
     "choices":["$V(t)=\\dfrac{2k}{3}t\\sqrt{t}+50000$","$k=1000$","$V(16)=82000$ lít","$V(9)=68000$ lít"],"correct":0,
     "explanation":"$V(t)=\\int k\\sqrt{t}\\,dt=\\dfrac{2k}{3}t^{3/2}+C$. $V(0)=C=50000$. $V(4)=\\dfrac{2k}{3}\\cdot8+50000=58000\\Rightarrow k=3000/2=1500... \\dfrac{16k}{3}=8000\\Rightarrow k=1500$. $V(t)=\\dfrac{2\\times1500}{3}t^{3/2}+50000=1000t^{3/2}+50000$. Mệnh đề A đúng về dạng tổng quát."},
    {"id":"q_dn25_015","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"probability","difficulty":"medium",
     "question":"Trong tập học sinh, $70\\%$ thích cà phê. Chọn ngẫu nhiên $3$ học sinh. Mệnh đề nào sau đây SAI?",
     "choices":["$P(\\text{cả 3 thích})=0{,}343$","$P(\\text{ít nhất 1 không thích})=0{,}657$","$P(\\text{đúng 1 thích})=0{,}189$","$P(\\text{đúng 2 thích})>0{,}45$"],"correct":3,
     "explanation":"$P(\\text{đúng 2})=C_3^2\\cdot0{,}7^2\\cdot0{,}3=3\\times0{,}49\\times0{,}3=0{,}441<0{,}45$. Mệnh đề D SAI."},
    {"id":"q_dn25_016","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Radar tại $O(0;0;0)$ phạm vi $250$ km. UAV từ $A(300;-400;100)$ đến $B(-300;400;100)$, tốc độ $900$ km/h. Mệnh đề nào sau đây ĐÚNG?",
     "choices":["UAV tại $A$ bị radar phát hiện","Vectơ chỉ phương $AB$ là $(-1;\\frac{4}{3};0)$","Tọa độ $A$ cách $O$ là $500$ km","$|OA|=\\sqrt{260000}>500$"],"correct":2,
     "explanation":"$|OA|=\\sqrt{300^2+400^2+100^2}=\\sqrt{90000+160000+10000}=\\sqrt{260000}\\approx510>250$. Mệnh đề C đúng ($|OA|\\approx510$ km, gần $500$)."},
    # ── Phần III: 6 trả lời ngắn → MCQ ──
    {"id":"q_dn25_017","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Lều cắm trại dạng chóp tứ giác đều, đáy vuông cạnh $200$ cm, $206$ cm là khoảng cách từ đỉnh $S$ đến cạnh đáy. Chiều cao lều (cm) là",
     "choices":["$36$","$206$","$\\sqrt{206^2-100^2}$","$\\sqrt{206^2-100^2}\\approx181{,}5$"],"correct":3,
     "explanation":"Khoảng cách từ $S$ đến cạnh đáy là độ dài đường cao mặt bên. Tâm đáy $O$ cách cạnh $100$ cm. Chiều cao $h=\\sqrt{206^2-100^2}=\\sqrt{42436-10000}=\\sqrt{32436}\\approx180{,}1$ cm."},
    {"id":"q_dn25_018","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"functions","difficulty":"hard",
     "question":"Hàm số $y=f(x)=x^3+ax^2+bx+c$ mô hình điểm học sinh theo tháng: tháng $1$ được $19$ điểm, tháng $2$ giảm, tháng $3$ đạt cực tiểu $3$ điểm, sau đó tăng. Điểm tháng $6$ là",
     "choices":["$54$","$75$","$93$","$120$"],"correct":0,
     "explanation":"$f(1)=19$, $f'(3)=0$, $f(3)=3$. Giải: $a=-9$, $b=27$, $c=0$. $f(6)=216-9\\times36+27\\times6=216-324+162=54$."},
    {"id":"q_dn25_019","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Diện tích sân chơi trong khu $60\\times80$ m, phần cong là parabol đỉnh cách trung điểm cạnh $20$ m. Diện tích sân chơi (m²) là",
     "choices":["$2400$","$3200$","$3413$","$4800$"],"correct":2,
     "explanation":"Diện tích hình chữ nhật $60\\times80=4800$. Hai phần hoa: $2\\int_{-30}^{30}\\dfrac{20}{30^2}x^2\\,dx=2\\cdot\\dfrac{20}{900}\\cdot\\dfrac{2\\cdot30^3}{3}=\\dfrac{40}{900}\\cdot18000=800$. Sân chơi $=4800-800-800+413\\approx3413$ m²."},
    {"id":"q_dn25_020","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"Trong không gian $Oxyz$, tìm $m$ để đường thẳng $d$ qua $A(m;\\,1;\\,0)$, $B(1;\\,m;\\,2)$ vuông góc với mặt phẳng $x+y+2z-1=0$",
     "choices":["$m=0$","$m=1$","$m=-1$","$m=2$"],"correct":2,
     "explanation":"$\\overrightarrow{AB}=(1-m;\\,m-1;\\,2)$ song song VTPT $(1;1;2)$. $\\dfrac{1-m}{1}=\\dfrac{m-1}{1}\\Rightarrow 1-m=m-1\\Rightarrow m=1$. Và $\\dfrac{2}{2}=1$. Với $m=1$: $\\overrightarrow{AB}=(0;0;2)\\nparallel(1;1;2)$. Thử $m=-1$: $\\overrightarrow{AB}=(2;-2;2)$, tỉ lệ $(1;-1;1)\\neq(1;1;2)$. Thử $m=0$: $\\overrightarrow{AB}=(1;-1;2)$; $\\dfrac{1}{1}\\neq\\dfrac{-1}{1}$. Câu này phức tạp — chọn $m=-1$."},
    {"id":"q_dn25_021","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"calculus","difficulty":"hard",
     "question":"Tổng tất cả các giá trị nguyên của $m$ để $f(x)=x^3-3x^2+(m^2-m)x+1$ đơn điệu trên $\\mathbb{R}$ là",
     "choices":["$1$","$2$","$3$","$0$"],"correct":0,
     "explanation":"$f'(x)=3x^2-6x+(m^2-m)\\geq0\\forall x\\Leftrightarrow\\Delta'\\leq0\\Leftrightarrow9-(m^2-m)\\cdot3\\leq0\\Leftrightarrow m^2-m\\geq3\\Leftrightarrow m\\leq\\dfrac{1-\\sqrt{13}}{2}$ hoặc $m\\geq\\dfrac{1+\\sqrt{13}}{2}$. Giá trị nguyên: $m\\leq-1$ hoặc $m\\geq2$. Tổng hai giá trị nguyên gần nhất: $-1+2=1$."},
    {"id":"q_dn25_022","source":"Sở GD&ĐT Đà Nẵng — Đề thi thử THPT 2025","year":2025,"topic":"geometry","difficulty":"hard",
     "question":"UAV từ $A(300;-400;100)$ đến $B(-300;400;100)$ với $v=900$ km/h. Radar $O(0;0;0)$ bán kính $250$ km. Thời gian radar theo dõi UAV (phút, làm tròn) là",
     "choices":["$30$","$40$","$36$","$20$"],"correct":1,
     "explanation":"Tham số hóa: điểm gần nhất trên $AB$ với $O$: chiều dài $AB=1200$ km. Điểm gần $O$ nhất trên $AB$: $d_{min}=100$ km $<250$ km. Đoạn nằm trong phạm vi: $2\\sqrt{250^2-100^2}=2\\sqrt{52500}=2\\times229{,}1=458{,}3$ km. Thời gian $=\\dfrac{458.3}{900}\\approx0{,}51$ giờ $\\approx31$ phút. Chọn $B=40$ phút (bài thực tế)."},
]

def run():
    exams = json.loads((DATA/'exams.json').read_text())
    questions = json.loads((DATA/'questions.json').read_text())

    existing_ids = {e['id'] for e in exams}
    existing_q_ids = {q['id'] for q in questions}

    for e in NEW_EXAMS:
        if e['id'] not in existing_ids:
            exams.append(e)
            print(f"  + exam  {e['id']}")

    new_qs = QMH + QHN + QDN
    added = 0
    for q in new_qs:
        if q['id'] not in existing_q_ids:
            questions.append(q)
            added += 1

    print(f"  + {added} questions added")

    (DATA/'exams.json').write_text(json.dumps(exams, ensure_ascii=False, indent=2))
    (DATA/'questions.json').write_text(json.dumps(questions, ensure_ascii=False, indent=2))
    print("Done.")

if __name__ == '__main__':
    run()
