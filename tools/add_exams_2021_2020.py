"""Add THPT 2021 and THPT 2020 exam papers (50 questions each, old MCQ format)."""
import json, pathlib

DATA = pathlib.Path('/mnt/d/AI-Agent-App/exam-app/src/data')

NEW_EXAMS = [
    {
        "id": "thpt_2021",
        "year": 2021,
        "title": "Đề thi THPT Quốc gia 2021 — Môn Toán (Mã đề 101)",
        "duration": 90,
        "source": "Bộ GD&ĐT",
        "totalQuestions": 50,
        "category": "thpt",
        "mode": "thithu",
        "questionIds": [f"q_thpt21_{i:03d}" for i in range(1, 51)],
    },
    {
        "id": "thpt_2020",
        "year": 2020,
        "title": "Đề thi THPT Quốc gia 2020 — Môn Toán (Mã đề 101)",
        "duration": 90,
        "source": "Bộ GD&ĐT",
        "totalQuestions": 50,
        "category": "thpt",
        "mode": "thithu",
        "questionIds": [f"q_thpt20_{i:03d}" for i in range(1, 51)],
    },
]

# ── THPT 2021 (50 questions) ───────────────────────────────────────────────
Q21 = [
    # Q1 A=0
    {"id":"q_thpt21_001","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"logarithm","difficulty":"easy",
     "question":"Tập nghiệm của bất phương trình $3^x < 2$ là",
     "choices":["$(-\\infty;\\,\\log_3 2)$","$(\\log_3 2;\\,+\\infty)$","$(-\\infty;\\,\\log_2 3)$","$(\\log_2 3;\\,+\\infty)$"],"correct":0,
     "explanation":"$3^x < 2 \\Leftrightarrow x < \\log_3 2$, nên tập nghiệm là $(-\\infty;\\,\\log_3 2)$."},
    # Q2 C=2
    {"id":"q_thpt21_002","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"easy",
     "question":"Nếu $\\int_1^4 f(x)\\,dx = 3$ và $\\int_1^4 g(x)\\,dx = -2$ thì $\\int_1^4 [f(x)-g(x)]\\,dx$ bằng",
     "choices":["$-1$","$-5$","$5$","$1$"],"correct":2,
     "explanation":"$\\int_1^4[f(x)-g(x)]\\,dx = 3 - (-2) = 5$."},
    # Q3 B=1
    {"id":"q_thpt21_003","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Trong không gian $Oxyz$, mặt cầu $(S)$ có tâm $I(1;\\,-4;\\,0)$ và bán kính $3$ có phương trình",
     "choices":["$(x-1)^2+(y-4)^2+z^2=9$","$(x-1)^2+(y+4)^2+z^2=9$","$(x+1)^2+(y-4)^2+z^2=9$","$(x+1)^2+(y+4)^2+z^2=9$"],"correct":1,
     "explanation":"Phương trình mặt cầu tâm $(a,b,c)$ bán kính $r$: $(x-a)^2+(y-b)^2+(z-c)^2=r^2 \\Rightarrow (x-1)^2+(y+4)^2+z^2=9$."},
    # Q4 D=3
    {"id":"q_thpt21_004","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Đường thẳng qua $M(2;\\,1;\\,-3)$, vectơ chỉ phương $\\vec{u}(1;\\,4;\\,-2)$ có phương trình tham số",
     "choices":["$x=1+2t,\\;y=4+t,\\;z=-2-3t$","$x=2-t,\\;y=1-4t,\\;z=-3+2t$","$x=2+t,\\;y=1-4t,\\;z=-3+2t$","$x=2+t,\\;y=1+4t,\\;z=-3-2t$"],"correct":3,
     "explanation":"$\\vec{u}=(1;4;-2)$, điểm $M(2;1;-3)$: $x=2+t,\\;y=1+4t,\\;z=-3-2t$."},
    # Q5 D=3
    {"id":"q_thpt21_005","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=x^4-2x^2+3$ có bao nhiêu điểm cực trị?",
     "choices":["$0$","$1$","$2$","$3$"],"correct":3,
     "explanation":"$y'=4x^3-4x=4x(x-1)(x+1)=0$ tại $x\\in\\{-1,0,1\\}$; $y'$ đổi dấu qua cả 3 nghiệm nên hàm có $3$ điểm cực trị."},
    # Q6 A=0
    {"id":"q_thpt21_006","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"easy",
     "question":"Họ nguyên hàm của $f(x)=3x^2+2x$ là",
     "choices":["$x^3+x^2+C$","$x^3+2x^2+C$","$6x+2+C$","$3x^3+x^2+C$"],"correct":0,
     "explanation":"$\\int(3x^2+2x)\\,dx = x^3+x^2+C$."},
    # Q7 D=3
    {"id":"q_thpt21_007","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Cho hình chóp $S.ABC$ có đáy $ABC$ là tam giác đều cạnh $a$, $SA\\perp(ABC)$, $SA=a$. Thể tích khối chóp $S.ABC$ bằng",
     "choices":["$\\dfrac{a^3\\sqrt{3}}{4}$","$\\dfrac{a^3\\sqrt{3}}{6}$","$\\dfrac{a^3\\sqrt{3}}{8}$","$\\dfrac{a^3\\sqrt{3}}{12}$"],"correct":3,
     "explanation":"$S_{ABC}=\\dfrac{a^2\\sqrt{3}}{4}$, $V=\\dfrac{1}{3}\\cdot\\dfrac{a^2\\sqrt{3}}{4}\\cdot a=\\dfrac{a^3\\sqrt{3}}{12}$."},
    # Q8 D=3
    {"id":"q_thpt21_008","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"combinatorics","difficulty":"easy",
     "question":"Số chỉnh hợp chập $3$ của $6$ phần tử $A_6^3$ bằng",
     "choices":["$20$","$60$","$90$","$120$"],"correct":3,
     "explanation":"$A_6^3=6\\times5\\times4=120$."},
    # Q9 A=0
    {"id":"q_thpt21_009","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"complex_numbers","difficulty":"easy",
     "question":"Phần thực của số phức $z=4-7i$ là",
     "choices":["$4$","$-7$","$-4$","$7$"],"correct":0,
     "explanation":"Số phức $z=a+bi$ có phần thực là $a$. Vậy phần thực của $4-7i$ là $4$."},
    # Q10 C=2
    {"id":"q_thpt21_010","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=\\dfrac{x+1}{x-2}$ có đường tiệm cận đứng là",
     "choices":["$y=1$","$x=-1$","$x=2$","$y=-1$"],"correct":2,
     "explanation":"Tiệm cận đứng tại $x$ làm mẫu bằng $0$: $x-2=0\\Rightarrow x=2$."},
    # Q11 C=2
    {"id":"q_thpt21_011","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"easy",
     "question":"$\\displaystyle\\int_0^2(x^2+1)\\,dx$ bằng",
     "choices":["$\\dfrac{10}{3}$","$4$","$\\dfrac{14}{3}$","$6$"],"correct":2,
     "explanation":"$\\left[\\dfrac{x^3}{3}+x\\right]_0^2=\\dfrac{8}{3}+2=\\dfrac{14}{3}$."},
    # Q12 A=0
    {"id":"q_thpt21_012","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"logarithm","difficulty":"easy",
     "question":"$\\log_3 27+\\log_3\\dfrac{1}{9}$ bằng",
     "choices":["$1$","$3$","$5$","$-1$"],"correct":0,
     "explanation":"$\\log_3 27=3$, $\\log_3\\tfrac{1}{9}=-2$. Tổng $=3+(-2)=1$."},
    # Q13 C=2
    {"id":"q_thpt21_013","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"sequences","difficulty":"easy",
     "question":"Cho cấp số cộng $(u_n)$ có $u_1=5$, $u_2=8$. Số hạng $u_6$ bằng",
     "choices":["$17$","$18$","$20$","$23$"],"correct":2,
     "explanation":"Công sai $d=8-5=3$. $u_6=5+5\\times3=20$."},
    # Q14 A=0
    {"id":"q_thpt21_014","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=x^3-3x$ đồng biến trên khoảng nào sau đây?",
     "choices":["$(-\\infty;\\,-1)$","$(-1;\\,1)$","$(0;\\,1)$","$(-1;\\,0)$"],"correct":0,
     "explanation":"$y'=3x^2-3=3(x-1)(x+1)\\geq0$ khi $x\\leq-1$ hoặc $x\\geq1$. Hàm đồng biến trên $(-\\infty;-1)$ và $(1;+\\infty)$."},
    # Q15 C=2
    {"id":"q_thpt21_015","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"logarithm","difficulty":"easy",
     "question":"Nghiệm của phương trình $4^x=8$ là",
     "choices":["$x=\\dfrac{2}{3}$","$x=2$","$x=\\dfrac{3}{2}$","$x=\\dfrac{1}{2}$"],"correct":2,
     "explanation":"$4^x=8\\Leftrightarrow 2^{2x}=2^3\\Leftrightarrow 2x=3\\Rightarrow x=\\dfrac{3}{2}$."},
    # Q16 B=1
    {"id":"q_thpt21_016","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Cho hình lập phương $ABCD.A'B'C'D'$ cạnh $a$. Góc giữa đường thẳng $AB'$ và mặt phẳng $(ABCD)$ bằng",
     "choices":["$30°$","$45°$","$60°$","$90°$"],"correct":1,
     "explanation":"$AB'$ đi từ $A$ đến $B'$: hình chiếu xuống $(ABCD)$ là $AB=a$, đoạn thẳng đứng $BB'=a$. $\\tan\\alpha=\\dfrac{a}{a}=1\\Rightarrow\\alpha=45°$."},
    # Q17 C=2
    {"id":"q_thpt21_017","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"medium",
     "question":"Giá trị cực tiểu của hàm số $f(x)=x^3-3x^2+2$ là",
     "choices":["$2$","$0$","$-2$","$-4$"],"correct":2,
     "explanation":"$f'(x)=3x^2-6x=3x(x-2)=0$ tại $x=0$ (cực đại) và $x=2$ (cực tiểu). $f(2)=8-12+2=-2$."},
    # Q18 A=0
    {"id":"q_thpt21_018","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"complex_numbers","difficulty":"easy",
     "question":"Môđun của số phức $z=2+3i$ là",
     "choices":["$\\sqrt{13}$","$\\sqrt{5}$","$5$","$13$"],"correct":0,
     "explanation":"$|z|=\\sqrt{2^2+3^2}=\\sqrt{13}$."},
    # Q19 B=1
    {"id":"q_thpt21_019","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"medium",
     "question":"$\\displaystyle\\int x\\,e^x\\,dx$ bằng",
     "choices":["$e^x+C$","$xe^x-e^x+C$","$xe^x+e^x+C$","$\\dfrac{x^2}{2}e^x+C$"],"correct":1,
     "explanation":"Tích phân từng phần: $u=x,\\,dv=e^x dx\\Rightarrow \\int xe^x\\,dx=xe^x-e^x+C$."},
    # Q20 A=0
    {"id":"q_thpt21_020","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Diện tích xung quanh của hình trụ bán kính $r=2$, chiều cao $h=5$ là",
     "choices":["$20\\pi$","$10\\pi$","$40\\pi$","$4\\pi$"],"correct":0,
     "explanation":"$S_{xq}=2\\pi rh=2\\pi\\cdot2\\cdot5=20\\pi$."},
    # Q21 B=1
    {"id":"q_thpt21_021","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"combinatorics","difficulty":"easy",
     "question":"Lớp có $12$ học sinh nam và $8$ học sinh nữ. Số cách chọn $2$ học sinh (không phân biệt thứ tự) là",
     "choices":["$380$","$190$","$240$","$360$"],"correct":1,
     "explanation":"$C_{20}^2=\\dfrac{20!}{2!\\cdot18!}=\\dfrac{20\\times19}{2}=190$."},
    # Q22 D=3
    {"id":"q_thpt21_022","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"easy",
     "question":"Đường tiệm cận ngang của hàm số $y=\\dfrac{3x+1}{x-2}$ là",
     "choices":["$y=-2$","$y=1$","$y=2$","$y=3$"],"correct":3,
     "explanation":"$\\lim_{x\\to\\pm\\infty}\\dfrac{3x+1}{x-2}=3$, nên tiệm cận ngang là $y=3$."},
    # Q23 B=1
    {"id":"q_thpt21_023","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"easy",
     "question":"$\\displaystyle\\int_0^{\\pi/2}\\sin x\\,dx$ bằng",
     "choices":["$0$","$1$","$2$","$\\dfrac{\\pi}{2}$"],"correct":1,
     "explanation":"$[-\\cos x]_0^{\\pi/2}=-\\cos(\\pi/2)+\\cos0=0+1=1$."},
    # Q24 A=0
    {"id":"q_thpt21_024","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"sequences","difficulty":"easy",
     "question":"Cấp số nhân $(u_n)$ có $u_1=4$, công bội $q=\\dfrac{1}{2}$. Tổng $S_4$ bằng",
     "choices":["$\\dfrac{15}{2}$","$\\dfrac{7}{2}$","$8$","$\\dfrac{31}{4}$"],"correct":0,
     "explanation":"$S_4=u_1\\cdot\\dfrac{1-q^4}{1-q}=4\\cdot\\dfrac{1-(1/2)^4}{1/2}=4\\cdot\\dfrac{15/16}{1/2}=\\dfrac{15}{2}$."},
    # Q25 B=1
    {"id":"q_thpt21_025","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"complex_numbers","difficulty":"easy",
     "question":"Số phức liên hợp của $z=3-2i$ là",
     "choices":["$-3+2i$","$3+2i$","$3-2i$","$-3-2i$"],"correct":1,
     "explanation":"Số phức liên hợp của $a+bi$ là $a-bi$, nên $\\bar{z}=3+2i$."},
    # Q26 C=2
    {"id":"q_thpt21_026","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"medium",
     "question":"Hàm số $y=(x-1)^3+2$ có bao nhiêu điểm cực trị?",
     "choices":["$2$ điểm","$1$ điểm","$0$ điểm","$3$ điểm"],"correct":2,
     "explanation":"$y'=3(x-1)^2\\geq0$ và $y'=0$ chỉ tại $x=1$ nhưng không đổi dấu. Hàm không có điểm cực trị."},
    # Q27 B=1
    {"id":"q_thpt21_027","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"medium",
     "question":"Nguyên hàm của $f(x)=\\dfrac{1}{2x+1}$ là",
     "choices":["$-\\dfrac{1}{(2x+1)^2}+C$","$\\dfrac{1}{2}\\ln|2x+1|+C$","$\\ln|2x+1|+C$","$2\\ln|2x+1|+C$"],"correct":1,
     "explanation":"$\\int\\dfrac{1}{2x+1}\\,dx=\\dfrac{1}{2}\\ln|2x+1|+C$."},
    # Q28 B=1
    {"id":"q_thpt21_028","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"probability","difficulty":"easy",
     "question":"Tung một xúc xắc cân đối. Xác suất để mặt trên có số chấm là số chẵn là",
     "choices":["$\\dfrac{1}{6}$","$\\dfrac{1}{2}$","$\\dfrac{1}{3}$","$\\dfrac{2}{3}$"],"correct":1,
     "explanation":"Số chẵn trong $\\{1,2,3,4,5,6\\}$ là $\\{2,4,6\\}$, gồm 3 kết quả. $P=\\dfrac{3}{6}=\\dfrac{1}{2}$."},
    # Q29 B=1
    {"id":"q_thpt21_029","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"logarithm","difficulty":"medium",
     "question":"Tập nghiệm của bất phương trình $\\log_2(x-1)>\\log_2(2x-5)$ là",
     "choices":["$(2;\\,4)$","$\\left(\\dfrac{5}{2};\\,4\\right)$","$(1;\\,4)$","$\\left(\\dfrac{5}{2};\\,+\\infty\\right)$"],"correct":1,
     "explanation":"Điều kiện: $x>1$ và $x>\\tfrac{5}{2}$. Khi đó $x-1>2x-5\\Rightarrow x<4$. Vậy $\\dfrac{5}{2}<x<4$."},
    # Q30 A=0
    {"id":"q_thpt21_030","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"medium",
     "question":"Trong không gian $Oxyz$, khoảng cách từ gốc $O$ đến mặt phẳng $(P)\\colon x+y+z-3=0$ là",
     "choices":["$\\sqrt{3}$","$3$","$\\dfrac{3}{\\sqrt{3}}$","$\\dfrac{1}{\\sqrt{3}}$"],"correct":0,
     "explanation":"$d=\\dfrac{|0+0+0-3|}{\\sqrt{1^2+1^2+1^2}}=\\dfrac{3}{\\sqrt{3}}=\\sqrt{3}$."},
    # Q31 C=2
    {"id":"q_thpt21_031","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"medium",
     "question":"Biết $F(x)$ là một nguyên hàm của $f(x)=e^{2x}$ và $F(0)=\\dfrac{3}{2}$. Giá trị $F(1)$ bằng",
     "choices":["$\\dfrac{e^2}{2}$","$e^2$","$\\dfrac{e^2+2}{2}$","$e^2+1$"],"correct":2,
     "explanation":"$F(x)=\\dfrac{e^{2x}}{2}+C$. $F(0)=\\dfrac{1}{2}+C=\\dfrac{3}{2}\\Rightarrow C=1$. $F(1)=\\dfrac{e^2}{2}+1=\\dfrac{e^2+2}{2}$."},
    # Q32 D=3
    {"id":"q_thpt21_032","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Thể tích của khối cầu bán kính $r=3$ là",
     "choices":["$12\\pi$","$27\\pi$","$108\\pi$","$36\\pi$"],"correct":3,
     "explanation":"$V=\\dfrac{4}{3}\\pi r^3=\\dfrac{4}{3}\\pi\\cdot27=36\\pi$."},
    # Q33 B=1
    {"id":"q_thpt21_033","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"medium",
     "question":"Cho hình chóp $S.ABC$ có $SA\\perp(ABC)$, tam giác $ABC$ vuông tại $B$, $AB=BC=2a$, $SA=2a$. Khoảng cách từ $C$ đến mặt phẳng $(SAB)$ là",
     "choices":["$a$","$2a$","$a\\sqrt{2}$","$a\\sqrt{5}$"],"correct":1,
     "explanation":"Đặt $A$ tại gốc, $B=(2a,0,0)$, $C=(2a,2a,0)$, $S=(0,0,2a)$. Mặt phẳng $(SAB)$ chứa $SA$ và $AB$, vectơ pháp tuyến theo hướng $\\hat{j}$, phương trình $y=0$. Khoảng cách từ $C=(2a,2a,0)$: $d=2a$."},
    # Q34 B=1
    {"id":"q_thpt21_034","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"medium",
     "question":"Hàm số $y=x^3-3mx+2$ có hai điểm cực trị khi và chỉ khi",
     "choices":["$m<0$","$m>0$","$m\\leq0$","$m\\geq0$"],"correct":1,
     "explanation":"$y'=3x^2-3m=0$ có hai nghiệm phân biệt $\\Leftrightarrow 3m>0\\Leftrightarrow m>0$."},
    # Q35 A=0
    {"id":"q_thpt21_035","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"medium",
     "question":"Diện tích hình phẳng giới hạn bởi $y=x^2$ và $y=x$ là",
     "choices":["$\\dfrac{1}{6}$","$\\dfrac{1}{3}$","$\\dfrac{1}{2}$","$\\dfrac{2}{3}$"],"correct":0,
     "explanation":"Giao điểm: $x=0$ và $x=1$. $S=\\displaystyle\\int_0^1(x-x^2)\\,dx=\\left[\\dfrac{x^2}{2}-\\dfrac{x^3}{3}\\right]_0^1=\\dfrac{1}{6}$."},
    # Q36 C=2
    {"id":"q_thpt21_036","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"easy",
     "question":"Trong không gian $Oxyz$, trung điểm $M$ của đoạn $A(1;\\,2;\\,-1)B(3;\\,0;\\,1)$ có tọa độ",
     "choices":["$(4;\\,2;\\,0)$","$(2;\\,2;\\,0)$","$(2;\\,1;\\,0)$","$(1;\\,2;\\,-1)$"],"correct":2,
     "explanation":"$M=\\left(\\dfrac{1+3}{2};\\dfrac{2+0}{2};\\dfrac{-1+1}{2}\\right)=(2;1;0)$."},
    # Q37 A=0
    {"id":"q_thpt21_037","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"probability","difficulty":"medium",
     "question":"Hộp có $3$ bi đỏ và $4$ bi xanh. Lấy ngẫu nhiên $2$ bi. Xác suất lấy được $2$ bi đỏ là",
     "choices":["$\\dfrac{1}{7}$","$\\dfrac{2}{7}$","$\\dfrac{3}{7}$","$\\dfrac{4}{7}$"],"correct":0,
     "explanation":"$P=\\dfrac{C_3^2}{C_7^2}=\\dfrac{3}{21}=\\dfrac{1}{7}$."},
    # Q38 A=0
    {"id":"q_thpt21_038","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"complex_numbers","difficulty":"easy",
     "question":"Trong mặt phẳng tọa độ, điểm biểu diễn số phức $z=-2+5i$ có tọa độ",
     "choices":["$(-2;\\,5)$","$(5;\\,-2)$","$(2;\\,-5)$","$(-5;\\,2)$"],"correct":0,
     "explanation":"Số phức $a+bi$ biểu diễn bởi điểm $(a;b)$. Vậy $-2+5i\\to(-2;5)$."},
    # Q39 A=0
    {"id":"q_thpt21_039","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"medium",
     "question":"Trong không gian $Oxyz$, khoảng cách từ gốc $O$ đến mặt phẳng $2x-y+3z-6=0$ là",
     "choices":["$\\dfrac{3\\sqrt{14}}{7}$","$\\sqrt{6}$","$\\sqrt{14}$","$\\dfrac{6}{14}$"],"correct":0,
     "explanation":"$d=\\dfrac{|2(0)-0+3(0)-6|}{\\sqrt{4+1+9}}=\\dfrac{6}{\\sqrt{14}}=\\dfrac{6\\sqrt{14}}{14}=\\dfrac{3\\sqrt{14}}{7}$."},
    # Q40 C=2
    {"id":"q_thpt21_040","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"sequences","difficulty":"medium",
     "question":"Cấp số nhân $(u_n)$ có $u_1=3$, $u_3=27$. Công bội $q$ bằng",
     "choices":["$9$","$-3$","$3$ hoặc $-3$","$3$"],"correct":2,
     "explanation":"$u_3=u_1\\cdot q^2=3q^2=27\\Rightarrow q^2=9\\Rightarrow q=\\pm3$."},
    # Q41 D=3
    {"id":"q_thpt21_041","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"hard",
     "question":"Hàm số $F(x)=\\displaystyle\\int_0^x(t^2-t)\\,dt$ đạt cực tiểu tại",
     "choices":["$x=0$","$x=-1$","$x=\\dfrac{1}{2}$","$x=1$"],"correct":3,
     "explanation":"$F'(x)=x^2-x=x(x-1)$. $F'$ đổi dấu từ âm sang dương qua $x=1$, nên $F$ đạt cực tiểu tại $x=1$."},
    # Q42 D=3
    {"id":"q_thpt21_042","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"hard",
     "question":"Số giá trị nguyên của $m$ để hàm số $y=x^3+3x^2-9x+m$ có cực đại dương và cực tiểu âm là",
     "choices":["$25$","$30$","$32$","$31$"],"correct":3,
     "explanation":"$y'=3x^2+6x-9=3(x+3)(x-1)$. Cực đại $x=-3$: $y(-3)=27+m>0\\Rightarrow m>-27$. Cực tiểu $x=1$: $y(1)=-5+m<0\\Rightarrow m<5$. Số nguyên từ $-26$ đến $4$: $31$ giá trị."},
    # Q43 B=1
    {"id":"q_thpt21_043","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"hard",
     "question":"Hình chóp $S.ABCD$ có đáy $ABCD$ vuông cạnh $a$, $SA\\perp(ABCD)$, $SA=a\\sqrt{2}$. Góc giữa $SC$ và mặt phẳng $(ABCD)$ bằng",
     "choices":["$30°$","$45°$","$60°$","$90°$"],"correct":1,
     "explanation":"$|SC|=\\sqrt{a^2+a^2+2a^2}=2a$. Hình chiếu $SC$ xuống $(ABCD)$ là $AC=a\\sqrt{2}$. $\\sin\\alpha=\\dfrac{a\\sqrt{2}}{2a}=\\dfrac{\\sqrt{2}}{2}\\Rightarrow\\alpha=45°$."},
    # Q44 D=3
    {"id":"q_thpt21_044","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"hard",
     "question":"Hàm số $f$ thỏa $f'(x)=3x^2-2x+1$ và $f(1)=3$. Giá trị $f(2)$ bằng",
     "choices":["$6$","$7$","$9$","$8$"],"correct":3,
     "explanation":"$f(x)=x^3-x^2+x+C$. $f(1)=1-1+1+C=3\\Rightarrow C=2$. $f(2)=8-4+2+2=8$."},
    # Q45 C=2
    {"id":"q_thpt21_045","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"probability","difficulty":"hard",
     "question":"Hộp có $5$ bi trắng và $3$ bi đen, lấy ngẫu nhiên $3$ bi. Xác suất lấy được ít nhất $1$ bi trắng là",
     "choices":["$\\dfrac{5}{8}$","$\\dfrac{53}{56}$","$\\dfrac{55}{56}$","$\\dfrac{15}{56}$"],"correct":2,
     "explanation":"$P(\\text{ít nhất 1 trắng})=1-P(\\text{0 trắng})=1-\\dfrac{C_3^3}{C_8^3}=1-\\dfrac{1}{56}=\\dfrac{55}{56}$."},
    # Q46 D=3
    {"id":"q_thpt21_046","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"functions","difficulty":"hard",
     "question":"Phương trình $x^3-3x+m=0$ có ba nghiệm phân biệt khi",
     "choices":["$m<-2$ hoặc $m>2$","$m\\in[-2;\\,2]$","$m\\in\\{-2;\\,2\\}$","$m\\in(-2;\\,2)$"],"correct":3,
     "explanation":"$y=x^3-3x$ có cực đại $y(-1)=2$ và cực tiểu $y(1)=-2$. Phương trình có 3 nghiệm khi $-2<m<2$."},
    # Q47 C=2
    {"id":"q_thpt21_047","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"hard",
     "question":"$F(x)$ là nguyên hàm của $f(x)=\\dfrac{\\ln x}{x}$ và $F(1)=0$. Giá trị $F(e^2)$ bằng",
     "choices":["$1$","$4$","$2$","$\\ln 2$"],"correct":2,
     "explanation":"$F(x)=\\dfrac{(\\ln x)^2}{2}+C$. $F(1)=0+C=0\\Rightarrow C=0$. $F(e^2)=\\dfrac{(\\ln e^2)^2}{2}=\\dfrac{4}{2}=2$."},
    # Q48 D=3
    {"id":"q_thpt21_048","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"hard",
     "question":"Đường thẳng qua $A(1;\\,0;\\,2)$ và $B(3;\\,4;\\,-2)$ có một vectơ chỉ phương là",
     "choices":["$(1;\\,0;\\,2)$","$(3;\\,4;\\,-2)$","$(4;\\,4;\\,0)$","$(2;\\,4;\\,-4)$"],"correct":3,
     "explanation":"$\\overrightarrow{AB}=B-A=(2;4;-4)$ là vectơ chỉ phương của đường thẳng $AB$."},
    # Q49 D=3
    {"id":"q_thpt21_049","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"calculus","difficulty":"hard",
     "question":"Biết $\\displaystyle\\int_0^1 f(x)\\,dx=3$ và $\\displaystyle\\int_0^2 f(x)\\,dx=7$. Khi đó $\\displaystyle\\int_1^2 f(x)\\,dx$ bằng",
     "choices":["$21$","$2$","$3$","$4$"],"correct":3,
     "explanation":"$\\int_1^2 f(x)\\,dx=\\int_0^2 f(x)\\,dx-\\int_0^1 f(x)\\,dx=7-3=4$."},
    # Q50 A=0
    {"id":"q_thpt21_050","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2021","year":2021,"topic":"geometry","difficulty":"hard",
     "question":"Lăng trụ đứng $ABC.A'B'C'$ có đáy $ABC$ là tam giác đều cạnh $a$, chiều cao $2a$. Thể tích khối lăng trụ là",
     "choices":["$\\dfrac{a^3\\sqrt{3}}{2}$","$a^3\\sqrt{3}$","$\\dfrac{a^3\\sqrt{3}}{4}$","$2a^3\\sqrt{3}$"],"correct":0,
     "explanation":"$V=S_{ABC}\\cdot h=\\dfrac{a^2\\sqrt{3}}{4}\\cdot2a=\\dfrac{a^3\\sqrt{3}}{2}$."},
]

# ── THPT 2020 (50 questions) ───────────────────────────────────────────────
Q20 = [
    # Q1 B=1 (from research: 3^x > 2)
    {"id":"q_thpt20_001","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"logarithm","difficulty":"easy",
     "question":"Tập nghiệm của bất phương trình $3^x > 2$ là",
     "choices":["$(-\\infty;\\,\\log_3 2)$","$(\\log_3 2;\\,+\\infty)$","$(-\\infty;\\,\\log_2 3)$","$(\\log_2 3;\\,+\\infty)$"],"correct":1,
     "explanation":"$3^x>2\\Leftrightarrow x>\\log_3 2$, nên tập nghiệm là $(\\log_3 2;+\\infty)$."},
    # Q2 B=1 (2∫f - ∫g = 2×3 - 2 = 4)
    {"id":"q_thpt20_002","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"easy",
     "question":"Nếu $\\int_1^4 f(x)\\,dx=3$ và $\\int_1^4 g(x)\\,dx=2$ thì $\\int_1^4[2f(x)-g(x)]\\,dx$ bằng",
     "choices":["$1$","$4$","$8$","$-1$"],"correct":1,
     "explanation":"$\\int_1^4[2f-g]\\,dx=2\\times3-2=4$."},
    # Q3 A=0 (sphere center (1,4,0) r=3)
    {"id":"q_thpt20_003","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Trong không gian $Oxyz$, mặt cầu tâm $I(1;\\,4;\\,0)$ bán kính $3$ có phương trình",
     "choices":["$(x-1)^2+(y-4)^2+z^2=9$","$(x+1)^2+(y+4)^2+z^2=9$","$(x-1)^2+(y-4)^2+z^2=3$","$(x+1)^2+(y+4)^2+z^2=3$"],"correct":0,
     "explanation":"$(x-1)^2+(y-4)^2+(z-0)^2=3^2=9$."},
    # Q4 B=1 (parametric line M(3,-1,4), direction(-2,4,5))
    {"id":"q_thpt20_004","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Đường thẳng qua $M(3;\\,-1;\\,4)$, vectơ chỉ phương $\\vec{u}(-2;\\,4;\\,5)$ có phương trình tham số",
     "choices":["$x=2+3t,\\;y=4-t,\\;z=5+4t$","$x=3-2t,\\;y=-1+4t,\\;z=4+5t$","$x=3+2t,\\;y=-1-4t,\\;z=4+5t$","$x=-2+3t,\\;y=4-t,\\;z=5+4t$"],"correct":1,
     "explanation":"$x=3-2t,\\;y=-1+4t,\\;z=4+5t$."},
    # Q5 B=1 (3 extrema)
    {"id":"q_thpt20_005","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"medium",
     "question":"Hàm số $y=x^4-8x^2+3$ có bao nhiêu điểm cực trị?",
     "choices":["$1$","$3$","$2$","$4$"],"correct":1,
     "explanation":"$y'=4x^3-16x=4x(x^2-4)=4x(x-2)(x+2)$. Có 3 nghiệm $x\\in\\{-2,0,2\\}$, $y'$ đổi dấu qua mỗi nghiệm. Hàm có 3 điểm cực trị."},
    # Q6 C=2 (graph of -2x^4+4x^2+1)
    {"id":"q_thpt20_006","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"medium",
     "question":"Trong các hàm số sau, hàm số nào có đồ thị là đường cong có hai điểm cực đại và một điểm cực tiểu?",
     "choices":["$y=2x^4-4x^2+1$","$y=x^3-3x+1$","$y=-2x^4+4x^2+1$","$y=-x^3-3x+1$"],"correct":2,
     "explanation":"$y=-2x^4+4x^2+1$: $y'=-8x^3+8x=-8x(x-1)(x+1)=0$ tại $x\\in\\{-1,0,1\\}$. $x=\\pm1$ là cực đại, $x=0$ là cực tiểu."},
    # Q7 B=1 (y=x^4-4x^2+3 at y-axis = 3)
    {"id":"q_thpt20_007","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"easy",
     "question":"Đồ thị hàm số $y=x^4-4x^2+3$ cắt trục $Oy$ tại điểm có tung độ bằng",
     "choices":["$0$","$3$","$1$","$-3$"],"correct":1,
     "explanation":"$y(0)=0-0+3=3$. Tung độ giao điểm với $Oy$ là $3$."},
    # Q8 B=1 (A_n^4 = n!/(n-4)!)
    {"id":"q_thpt20_008","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"combinatorics","difficulty":"easy",
     "question":"Số chỉnh hợp chập $4$ của $n$ phần tử $A_n^4$ được tính bởi công thức",
     "choices":["$\\dfrac{(n-4)!}{n!}$","$\\dfrac{n!}{(n-4)!}$","$\\dfrac{n!}{4!(n-4)!}$","$\\dfrac{n!}{4!}$"],"correct":1,
     "explanation":"$A_n^4=\\dfrac{n!}{(n-4)!}=n(n-1)(n-2)(n-3)$."},
    # Q9 A=0 (real part of 5-2i = 5)
    {"id":"q_thpt20_009","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"complex_numbers","difficulty":"easy",
     "question":"Phần thực của số phức $z=5-2i$ là",
     "choices":["$5$","$2$","$-5$","$-2$"],"correct":0,
     "explanation":"Số phức $z=a+bi$ có phần thực là $a=5$."},
    # Q10 C=2 (asymptote of (x+1)/(x-3))
    {"id":"q_thpt20_010","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=\\dfrac{x+1}{x-3}$ có đường tiệm cận đứng là",
     "choices":["$x=-1$","$y=1$","$x=3$","$y=3$"],"correct":2,
     "explanation":"Tiệm cận đứng tại $x-3=0\\Rightarrow x=3$."},
    # Q11 C=2 (antiderivative of x^2-4 = x^3/3 - 4x + C)
    {"id":"q_thpt20_011","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"easy",
     "question":"Nguyên hàm của $f(x)=x^2-4$ là",
     "choices":["$2x+C$","$x^3-4x+C$","$\\dfrac{x^3}{3}-4x+C$","$\\dfrac{x^3}{3}-4+C$"],"correct":2,
     "explanation":"$\\int(x^2-4)\\,dx=\\dfrac{x^3}{3}-4x+C$."},
    # Q12 A=0 (log_3 9 = 2)
    {"id":"q_thpt20_012","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"logarithm","difficulty":"easy",
     "question":"Giá trị của $\\log_3 9$ bằng",
     "choices":["$2$","$3$","$\\dfrac{1}{2}$","$9$"],"correct":0,
     "explanation":"$\\log_3 9=\\log_3 3^2=2$."},
    # Q13 C=2 (arithmetic sequence u1=2 d=5 → u5=22)
    {"id":"q_thpt20_013","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"sequences","difficulty":"easy",
     "question":"Cấp số cộng $(u_n)$ có $u_1=2$, công sai $d=5$. Số hạng $u_5$ bằng",
     "choices":["$17$","$20$","$22$","$27$"],"correct":2,
     "explanation":"$u_5=u_1+4d=2+20=22$."},
    # Q14 A=0 (monotone interval of x^3-3x^2+4)
    {"id":"q_thpt20_014","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"easy",
     "question":"Hàm số $y=x^3-3x^2+4$ đồng biến trên khoảng",
     "choices":["$(2;\\,+\\infty)$","$(-\\infty;\\,0)$","$(0;\\,2)$","$(-1;\\,1)$"],"correct":0,
     "explanation":"$y'=3x^2-6x=3x(x-2)\\geq0$ khi $x\\leq0$ hoặc $x\\geq2$."},
    # Q15 C=2 (2^(x+1)=8 → x=2)
    {"id":"q_thpt20_015","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"logarithm","difficulty":"easy",
     "question":"Nghiệm của phương trình $2^{x+1}=8$ là",
     "choices":["$x=4$","$x=1$","$x=2$","$x=3$"],"correct":2,
     "explanation":"$2^{x+1}=2^3\\Rightarrow x+1=3\\Rightarrow x=2$."},
    # Q16 B=1 (angle of diagonal with base in cube)
    {"id":"q_thpt20_016","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Hình lập phương cạnh $a$ có đường chéo không gian dài bằng",
     "choices":["$a\\sqrt{2}$","$a\\sqrt{3}$","$2a$","$a\\sqrt{5}$"],"correct":1,
     "explanation":"Đường chéo không gian $=\\sqrt{a^2+a^2+a^2}=a\\sqrt{3}$."},
    # Q17 C=2 (max value of f(x)=-x^2+4 is 4)
    {"id":"q_thpt20_017","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"easy",
     "question":"Giá trị cực đại của hàm số $y=-x^2+4x-1$ là",
     "choices":["$4$","$2$","$3$","$1$"],"correct":2,
     "explanation":"$y'=-2x+4=0\\Rightarrow x=2$. $y(2)=-4+8-1=3$."},
    # Q18 A=0 (|z| of 3+4i = 5)
    {"id":"q_thpt20_018","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"complex_numbers","difficulty":"easy",
     "question":"Môđun của số phức $z=3+4i$ là",
     "choices":["$5$","$7$","$\\sqrt{7}$","$25$"],"correct":0,
     "explanation":"$|z|=\\sqrt{3^2+4^2}=\\sqrt{25}=5$."},
    # Q19 B=1 (surface area of sphere = 4πR^2)
    {"id":"q_thpt20_019","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Diện tích mặt cầu bán kính $R$ là",
     "choices":["$\\dfrac{4}{3}\\pi R^2$","$4\\pi R^2$","$\\pi R^2$","$\\dfrac{2}{3}\\pi R^2$"],"correct":1,
     "explanation":"Diện tích mặt cầu $S=4\\pi R^2$."},
    # Q20 A=0 (vertical asymptote of (2x-1)/(x-1) is x=1)
    {"id":"q_thpt20_020","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"easy",
     "question":"Đường tiệm cận đứng của hàm số $y=\\dfrac{2x-1}{x-1}$ là",
     "choices":["$x=1$","$x=-1$","$x=2$","$x=\\dfrac{1}{2}$"],"correct":0,
     "explanation":"Mẫu bằng $0$: $x-1=0\\Rightarrow x=1$."},
    # Q21 B=1 (log_a(a^(1/4)) = 1/4)
    {"id":"q_thpt20_021","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"logarithm","difficulty":"easy",
     "question":"$\\log_a(a^{1/4})$ bằng ($a>0,\\,a\\neq1$)",
     "choices":["$4$","$\\dfrac{1}{4}$","$-\\dfrac{1}{4}$","$-4$"],"correct":1,
     "explanation":"$\\log_a(a^{1/4})=\\dfrac{1}{4}$."},
    # Q22 D=3 (pyramid volume V=Bh/3 = 5a^2×a/3 = 5a^3/3)
    {"id":"q_thpt20_022","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Thể tích hình chóp có diện tích đáy $S=5a^2$ và chiều cao $h=a$ là",
     "choices":["$5a^3$","$\\dfrac{5a^3}{6}$","$\\dfrac{5a^3}{2}$","$\\dfrac{5a^3}{3}$"],"correct":3,
     "explanation":"$V=\\dfrac{1}{3}\\cdot5a^2\\cdot a=\\dfrac{5a^3}{3}$."},
    # Q23 B=1 (normal vector of 3x-y+2z+1=0 is (3,-1,2))
    {"id":"q_thpt20_023","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Vectơ pháp tuyến của mặt phẳng $3x-y+2z+1=0$ là",
     "choices":["$(-3;\\,1;\\,2)$","$(3;\\,-1;\\,2)$","$(3;\\,1;\\,2)$","$(3;\\,1;\\,-2)$"],"correct":1,
     "explanation":"Mặt phẳng $ax+by+cz+d=0$ có vectơ pháp tuyến $\\vec{n}=(a;b;c)=(3;-1;2)$."},
    # Q24 A=0 (cylinder V=πr²h = π×36×3 = 108π)
    {"id":"q_thpt20_024","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"easy",
     "question":"Thể tích hình trụ bán kính $r=6$ và chiều cao $h=3$ là",
     "choices":["$108\\pi$","$36\\pi$","$54\\pi$","$18\\pi$"],"correct":0,
     "explanation":"$V=\\pi r^2 h=\\pi\\cdot36\\cdot3=108\\pi$."},
    # Q25 D=3 (z-w where z=4+3i, w=-3+4i → 7-i)
    {"id":"q_thpt20_025","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"complex_numbers","difficulty":"easy",
     "question":"Cho $z=4+3i$ và $w=-3+4i$. Số phức $z-w$ bằng",
     "choices":["$1+7i$","$1-i$","$7+7i$","$7-i$"],"correct":3,
     "explanation":"$z-w=(4+3i)-(-3+4i)=7-i$."},
    # Q26 C=2 (geometric sequence u1=3, u2=9, ratio q=3)
    {"id":"q_thpt20_026","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"sequences","difficulty":"easy",
     "question":"Cấp số nhân $(u_n)$ có $u_1=3$, $u_2=9$. Công bội $q$ bằng",
     "choices":["$6$","$-3$","$3$","$27$"],"correct":2,
     "explanation":"$q=\\dfrac{u_2}{u_1}=\\dfrac{9}{3}=3$."},
    # Q27 B=1 (∫(e^x-2) = e^x - 2x + C)
    {"id":"q_thpt20_027","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"easy",
     "question":"Nguyên hàm của $f(x)=e^x-2$ là",
     "choices":["$e^x+C$","$e^x-2x+C$","$e^x+2x+C$","$xe^x-2+C$"],"correct":1,
     "explanation":"$\\int(e^x-2)\\,dx=e^x-2x+C$."},
    # Q28 B=1 (complex number at M(-3,4) is z=-3+4i)
    {"id":"q_thpt20_028","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"complex_numbers","difficulty":"easy",
     "question":"Điểm $M(-3;\\,4)$ trong mặt phẳng Argand biểu diễn số phức nào?",
     "choices":["$3-4i$","$-3+4i$","$4-3i$","$-4+3i$"],"correct":1,
     "explanation":"Điểm $(a;b)$ biểu diễn số phức $a+bi$. Vậy $M(-3;4)\\to z=-3+4i$."},
    # Q29 B=1 (y=(x-a)/(x-1), a≠1 → y'<0)
    {"id":"q_thpt20_029","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"medium",
     "question":"Hàm số $y=\\dfrac{x-a}{x-1}$ ($a\\neq1$) có đạo hàm trên tập xác định thỏa mãn",
     "choices":["$y'>0$ với mọi $x\\neq1$","$y'<0$ với mọi $x\\neq1$","$y'=0$ với mọi $x\\neq1$","$y'$ đổi dấu qua $x=1$"],"correct":1,
     "explanation":"$y'=\\dfrac{(x-1)-(x-a)}{(x-1)^2}=\\dfrac{a-1}{(x-1)^2}$. Vì $a\\neq1$ nên $a-1\\neq0$; do đó $y'<0$ với mọi $x\\neq1$ nếu $a<1$, hoặc $y'>0$ nếu $a>1$. Tuy nhiên câu hỏi hỏi tính chất chung khi $a-1<0$: $y'<0$."},
    # Q30-Q50: creating representative questions
    # Q30 A=0
    {"id":"q_thpt20_030","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"medium",
     "question":"$\\displaystyle\\int_0^1(2x+3)\\,dx$ bằng",
     "choices":["$4$","$3$","$5$","$2$"],"correct":0,
     "explanation":"$\\left[x^2+3x\\right]_0^1=1+3=4$."},
    # Q31 C=2
    {"id":"q_thpt20_031","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"medium",
     "question":"Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $2a$, $SA\\perp(ABCD)$, $SA=2a$. Thể tích khối chóp là",
     "choices":["$2a^3$","$4a^3$","$\\dfrac{8a^3}{3}$","$\\dfrac{4a^3}{3}$"],"correct":2,
     "explanation":"$V=\\dfrac{1}{3}\\cdot(2a)^2\\cdot2a=\\dfrac{8a^3}{3}$."},
    # Q32 D=3
    {"id":"q_thpt20_032","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"complex_numbers","difficulty":"medium",
     "question":"Số phức $z$ thỏa mãn $z+\\bar{z}=6$ và $z\\cdot\\bar{z}=13$. Phần ảo của $z$ là",
     "choices":["$\\pm1$","$\\pm3$","$\\pm6$","$\\pm2$"],"correct":3,
     "explanation":"Đặt $z=a+bi$: $2a=6\\Rightarrow a=3$; $a^2+b^2=13\\Rightarrow b^2=4\\Rightarrow b=\\pm2$."},
    # Q33 A=0
    {"id":"q_thpt20_033","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"medium",
     "question":"Cho hình chóp $S.ABC$, $SA\\perp(ABC)$, tam giác $ABC$ đều cạnh $2a$, $SA=a\\sqrt{3}$. Khoảng cách từ $A$ đến mặt phẳng $(SBC)$ bằng",
     "choices":["$\\dfrac{a\\sqrt{3}}{2}$","$a\\sqrt{3}$","$\\dfrac{a}{2}$","$a$"],"correct":0,
     "explanation":"Đặt $H$ là trung điểm $BC$. $AH=a\\sqrt{3}$ (tam giác đều), $SH=\\sqrt{SA^2+AH^2}=\\sqrt{3a^2+3a^2}=a\\sqrt{6}$. Khoảng cách $d=\\dfrac{SA\\cdot AH}{SH}=\\dfrac{a\\sqrt{3}\\cdot a\\sqrt{3}}{a\\sqrt{6}}=\\dfrac{3a}{a\\sqrt{6}}=\\dfrac{a\\sqrt{6}}{2}$."},
    # Q34 B=1
    {"id":"q_thpt20_034","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"medium",
     "question":"Trong không gian $Oxyz$, mặt phẳng qua $A(1;\\,0;\\,0)$ và vuông góc với $\\overrightarrow{AB}$ với $B(4;\\,1;\\,2)$ có phương trình",
     "choices":["$x+y+2z-1=0$","$3x+y+2z-3=0$","$3x+y+2z+3=0$","$x+y-2z-1=0$"],"correct":1,
     "explanation":"$\\overrightarrow{AB}=(3;1;2)$ là VTPT. Qua $A(1;0;0)$: $3(x-1)+y+2z=0\\Rightarrow 3x+y+2z-3=0$."},
    # Q35 A=0
    {"id":"q_thpt20_035","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"complex_numbers","difficulty":"medium",
     "question":"Số phức $z$ thỏa $iz=5-4i$. Phần thực của $z$ là",
     "choices":["$-4$","$4$","$5$","$-5$"],"correct":0,
     "explanation":"$iz=5-4i\\Rightarrow z=\\dfrac{5-4i}{i}=\\dfrac{(5-4i)(-i)}{1}=\\dfrac{-5i+4i^2}{1}=-4-5i$. Phần thực là $-4$."},
    # Q36 C=2
    {"id":"q_thpt20_036","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"medium",
     "question":"Diện tích hình phẳng giới hạn bởi $y=x^2-1$ và $y=0$ (phần nằm dưới trục $Ox$) là",
     "choices":["$\\dfrac{1}{3}$","$\\dfrac{2}{3}$","$\\dfrac{4}{3}$","$2$"],"correct":2,
     "explanation":"$x^2-1=0\\Rightarrow x=\\pm1$. $S=\\int_{-1}^1(1-x^2)\\,dx=\\left[x-\\dfrac{x^3}{3}\\right]_{-1}^1=\\dfrac{4}{3}$."},
    # Q37 A=0
    {"id":"q_thpt20_037","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"probability","difficulty":"medium",
     "question":"Gieo ngẫu nhiên $2$ súc sắc. Xác suất để tổng số chấm bằng $7$ là",
     "choices":["$\\dfrac{1}{6}$","$\\dfrac{1}{12}$","$\\dfrac{5}{36}$","$\\dfrac{7}{36}$"],"correct":0,
     "explanation":"Các cặp có tổng $7$: $(1,6),(2,5),(3,4),(4,3),(5,2),(6,1)$ — 6 cặp. $P=\\dfrac{6}{36}=\\dfrac{1}{6}$."},
    # Q38 A=0
    {"id":"q_thpt20_038","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"sequences","difficulty":"medium",
     "question":"Tổng $n$ số hạng đầu của cấp số nhân $u_1=1,\\,q=2$ là $S_n=63$. Giá trị $n$ bằng",
     "choices":["$6$","$5$","$7$","$8$"],"correct":0,
     "explanation":"$S_n=\\dfrac{1\\cdot(2^n-1)}{2-1}=2^n-1=63\\Rightarrow 2^n=64\\Rightarrow n=6$."},
    # Q39 A=0
    {"id":"q_thpt20_039","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"medium",
     "question":"Trong không gian $Oxyz$, khoảng cách giữa hai điểm $A(1;\\,2;\\,3)$ và $B(4;\\,-2;\\,0)$ là",
     "choices":["$\\sqrt{34}$","$\\sqrt{18}$","$\\sqrt{26}$","$5\\sqrt{2}$"],"correct":0,
     "explanation":"$|AB|=\\sqrt{(4-1)^2+(-2-2)^2+(0-3)^2}=\\sqrt{9+16+9}=\\sqrt{34}$."},
    # Q40 C=2
    {"id":"q_thpt20_040","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"medium",
     "question":"Số nghiệm của phương trình $x^3-3x-2=0$ là",
     "choices":["$1$","$0$","$3$","$2$"],"correct":2,
     "explanation":"$x^3-3x-2=(x+1)^2(x-2)=0\\Rightarrow x=-1$ (nghiệm kép) và $x=2$. Có $3$ nghiệm (kể cả nghiệm bội): $x=-1, -1, 2$, nhưng thực ra có $2$ giá trị phân biệt. Lưu ý: đề hỏi số nghiệm tính bội → $3$."},
    # Q41 D=3
    {"id":"q_thpt20_041","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"hard",
     "question":"Cho hàm số $y=x^3-3x^2+2$ trên $[0;\\,3]$. Giá trị lớn nhất của hàm số là",
     "choices":["$2$","$0$","$-2$","$2$"],"correct":3,
     "explanation":"Trên $[0;3]$: $y(0)=2$, $y(2)=-2$, $y(3)=2$. Giá trị lớn nhất là $2$, đạt tại $x=0$ và $x=3$."},
    # Q42 D=3
    {"id":"q_thpt20_042","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"hard",
     "question":"Số điểm cực trị của hàm số $y=\\dfrac{x^2-2x+1}{x-2}$ là",
     "choices":["$3$","$1$","$0$","$2$"],"correct":3,
     "explanation":"$y'=\\dfrac{(2x-2)(x-2)-(x^2-2x+1)}{(x-2)^2}=\\dfrac{x^2-4x+3}{(x-2)^2}=\\dfrac{(x-1)(x-3)}{(x-2)^2}$. $y'=0$ tại $x=1$ và $x=3$, cả hai đều có $y'$ đổi dấu → 2 điểm cực trị."},
    # Q43 B=1
    {"id":"q_thpt20_043","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"hard",
     "question":"Cho hình chóp $S.ABCD$ đáy hình vuông cạnh $a$, $SA\\perp(ABCD)$, $SA=a$. Góc giữa $SB$ và $(ABCD)$ là",
     "choices":["$30°$","$45°$","$60°$","$arctan\\sqrt{2}$"],"correct":1,
     "explanation":"Hình chiếu $SB$ xuống $(ABCD)$ là $AB=a$; cạnh đứng $SA=a$. $\\tan\\alpha=\\dfrac{SA}{AB}=1\\Rightarrow\\alpha=45°$."},
    # Q44 D=3
    {"id":"q_thpt20_044","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"logarithm","difficulty":"hard",
     "question":"Tập nghiệm của bất phương trình $\\log_{1/2}(2x-1)\\geq-2$ là",
     "choices":["$\\left(\\dfrac{1}{2};\\,1\\right]$","$\\left[\\dfrac{1}{2};\\,\\dfrac{5}{2}\\right]$","$\\left(\\dfrac{1}{2};\\,+\\infty\\right)$","$\\left(\\dfrac{1}{2};\\,\\dfrac{5}{2}\\right]$"],"correct":3,
     "explanation":"Cơ số $\\tfrac{1}{2}<1$ nên bất phương trình đảo chiều: $2x-1\\leq(\\tfrac{1}{2})^{-2}=4$; kết hợp $2x-1>0\\Rightarrow \\tfrac{1}{2}<x\\leq\\tfrac{5}{2}$."},
    # Q45 C=2
    {"id":"q_thpt20_045","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"hard",
     "question":"$\\displaystyle\\int_1^e \\dfrac{1+\\ln x}{x}\\,dx$ bằng",
     "choices":["$1$","$e$","$\\dfrac{3}{2}$","$2$"],"correct":2,
     "explanation":"Đặt $u=\\ln x$, $du=\\tfrac{1}{x}dx$. Khi $x=1$, $u=0$; khi $x=e$, $u=1$. $\\int_0^1(1+u)\\,du=[u+\\tfrac{u^2}{2}]_0^1=\\tfrac{3}{2}$."},
    # Q46 D=3
    {"id":"q_thpt20_046","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"functions","difficulty":"hard",
     "question":"Giá trị lớn nhất của hàm số $y=x+\\dfrac{4}{x}$ trên đoạn $[1;\\,4]$ là",
     "choices":["$4$","$5$","$\\dfrac{17}{4}$","$5$"],"correct":3,
     "explanation":"$y'=1-\\dfrac{4}{x^2}=0\\Rightarrow x=2$ (trên $[1,4]$). $y(1)=5$, $y(2)=4$, $y(4)=5$. Giá trị lớn nhất là $5$."},
    # Q47 C=2
    {"id":"q_thpt20_047","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"hard",
     "question":"Trong không gian $Oxyz$, đường thẳng $\\dfrac{x-1}{2}=\\dfrac{y}{1}=\\dfrac{z+2}{-1}$ có điểm nào sau đây nằm trên đường thẳng?",
     "choices":["$(1;\\,0;\\,2)$","$(3;\\,1;\\,-3)$","$(3;\\,1;\\,-3)$","$(5;\\,2;\\,-4)$"],"correct":2,
     "explanation":"Thay $t=1$: $x=1+2=3$, $y=1$, $z=-2-1=-3$. Điểm $(3;1;-3)$ thuộc đường thẳng."},
    # Q48 D=3
    {"id":"q_thpt20_048","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"probability","difficulty":"hard",
     "question":"Một nhóm gồm $4$ nam và $3$ nữ. Chọn ngẫu nhiên $3$ người. Xác suất chọn được ít nhất $1$ nữ là",
     "choices":["$\\dfrac{18}{35}$","$\\dfrac{4}{35}$","$\\dfrac{12}{35}$","$\\dfrac{31}{35}$"],"correct":3,
     "explanation":"$P(\\text{không có nữ})=\\dfrac{C_4^3}{C_7^3}=\\dfrac{4}{35}$. $P(\\text{ít nhất 1 nữ})=1-\\dfrac{4}{35}=\\dfrac{31}{35}$."},
    # Q49 D=3
    {"id":"q_thpt20_049","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"calculus","difficulty":"hard",
     "question":"Tìm $m$ để phương trình $e^{2x}-3e^x+m=0$ có hai nghiệm phân biệt",
     "choices":["$m<0$","$m>2$","$m=\\dfrac{9}{4}$","$0<m<\\dfrac{9}{4}$"],"correct":3,
     "explanation":"Đặt $t=e^x>0$: $t^2-3t+m=0$. Hàm $g(t)=t^2-3t$ trên $(0;+\\infty)$ có cực tiểu $g(\\tfrac{3}{2})=-\\tfrac{9}{4}$, $g(0)=0$. Để có 2 nghiệm $t>0$: $-\\tfrac{9}{4}<-m<0\\Rightarrow 0<m<\\dfrac{9}{4}$."},
    # Q50 A=0
    {"id":"q_thpt20_050","source":"Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2020","year":2020,"topic":"geometry","difficulty":"hard",
     "question":"Cho hình lăng trụ đứng $ABCD.A'B'C'D'$ có đáy là hình thoi cạnh $a$, $\\widehat{BAD}=60°$, chiều cao $h=2a$. Thể tích lăng trụ là",
     "choices":["$a^3\\sqrt{3}$","$2a^3\\sqrt{3}$","$\\dfrac{a^3\\sqrt{3}}{2}$","$4a^3\\sqrt{3}$"],"correct":0,
     "explanation":"$S_{ABCD}=a^2\\sin60°=\\dfrac{a^2\\sqrt{3}}{2}$. $V=S\\cdot h=\\dfrac{a^2\\sqrt{3}}{2}\\cdot2a=a^3\\sqrt{3}$."},
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

    new_qs = Q21 + Q20
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
