#!/usr/bin/env python3
"""Fix Đà Nẵng 2025 + THPT 2021 questions with verified real content."""
import json, sys

QF = "exam-app/src/data/questions.json"
with open(QF) as f:
    qs = json.load(f)
qmap = {q["id"]: i for i, q in enumerate(qs)}

def upd(qid, **kw):
    idx = qmap.get(qid)
    if idx is None:
        print(f"NOT FOUND: {qid}"); return
    qs[idx].update(kw)
    print(f"Updated {qid}")

# ── Đà Nẵng 2025 ──────────────────────────────────────────────────────────────

# q_dn25_003  statistics median class  correct=0 (A=[60;90))
upd("q_dn25_003",
    question=(
        "Bảng phân phối tần số ghép nhóm điểm thi của $50$ học sinh: "
        "nhóm $[30;\\,60)$ có $20$ học sinh, nhóm $[60;\\,90)$ có $25$ học sinh, "
        "nhóm $[90;\\,120]$ có $5$ học sinh. Lớp trung vị là"
    ),
    choices=["$[60;\\,90)$", "$[30;\\,60)$", "$[90;\\,120]$", "$[45;\\,75)$"],
    correct=0,
    explanation=(
        "Tổng $n=50$, $n/2=25$. Tần số tích lũy: sau $[30;60)$ là $20$, "
        "sau $[60;90)$ là $45$. Vì $20<25\\leq45$ nên lớp trung vị là $[60;\\,90)$."
    ),
)

# q_dn25_012  dihedral angle [S,BC,A]  correct=1 (B=√3/3)
upd("q_dn25_012",
    question=(
        "Tứ diện $SABC$ có $SA=SB=SC=a$ và $SA\\perp SB$, $SB\\perp SC$, $SC\\perp SA$. "
        "$\\cos$ góc nhị diện $[S,\\,BC,\\,A]$ bằng"
    ),
    choices=[
        "$\\dfrac{2\\sqrt{5}}{5}$",
        "$\\dfrac{\\sqrt{3}}{3}$",
        "$\\dfrac{1}{3}$",
        "$\\dfrac{\\sqrt{5}}{5}$",
    ],
    correct=1,
    explanation=(
        "Đặt $S=(0,0,0)$, $A=(a,0,0)$, $B=(0,a,0)$, $C=(0,0,a)$. "
        "Hình chiếu vuông góc của $A$ và $S$ lên $BC$ đều là trung điểm "
        "$M=(0,\\tfrac{a}{2},\\tfrac{a}{2})$. "
        "$\\overrightarrow{MA}=(a,-\\tfrac{a}{2},-\\tfrac{a}{2})$, "
        "$\\overrightarrow{MS}=(0,-\\tfrac{a}{2},-\\tfrac{a}{2})$. "
        "$\\cos\\angle AMS = \\dfrac{\\overrightarrow{MA}\\cdot\\overrightarrow{MS}}"
        "{|\\overrightarrow{MA}||\\overrightarrow{MS}|}"
        "=\\dfrac{a^2/2}{\\sqrt{3a^2/2}\\cdot\\sqrt{a^2/2}}"
        "=\\dfrac{\\sqrt{3}}{3}$."
    ),
)

# q_dn25_016  radar question — ask which statement is FALSE  correct=3 (D)
upd("q_dn25_016",
    question=(
        "Radar đặt tại gốc $O(0;\\,0;\\,0)$ có tầm phát hiện $500$ km. "
        "UAV bay từ $A(300;\\,-400;\\,100)$ đến $B(-300;\\,400;\\,100)$ "
        "với tốc độ $900$ km/h. Mệnh đề nào sau đây SAI?"
    ),
    choices=[
        "Khoảng cách nhỏ nhất từ UAV đến radar là $100$ km",
        "UAV có đi qua vùng bị radar phát hiện trong hành trình",
        "$|OA|=\\sqrt{260\\,000}$ km",
        "Cả $A$ và $B$ đều nằm trong tầm phát hiện của radar",
    ],
    correct=3,
    explanation=(
        "$|OA|=\\sqrt{300^2+400^2+100^2}=\\sqrt{260000}\\approx510$ km $>500$ km, "
        "nên $A$ nằm ngoài tầm radar. Tương tự $|OB|=\\sqrt{260000}>500$. "
        "Khoảng cách nhỏ nhất từ $O$ đến đường $AB$: trung điểm $M(0;0;100)$, "
        "$|OM|=100<500$ (UAV vào vùng phát hiện). "
        "Mệnh đề SAI là D: cả $A$ lẫn $B$ đều ở ngoài tầm radar."
    ),
)

# q_dn25_017  tent pyramid height = 250 cm  correct=2 (C)
upd("q_dn25_017",
    question=(
        "Lều cắm trại hình chóp tứ giác đều có đáy vuông cạnh $200$ cm "
        "và thể tích bằng $\\dfrac{10\\,000\\,000}{3}$ cm³. Chiều cao của lều là"
    ),
    choices=["$100$ cm", "$200$ cm", "$250$ cm", "$300$ cm"],
    correct=2,
    explanation=(
        "$V=\\dfrac{1}{3}S_{\\text{đáy}}\\cdot h "
        "=\\dfrac{1}{3}\\times200^2\\times h=\\dfrac{10\\,000\\,000}{3}$. "
        "Suy ra $h=\\dfrac{10\\,000\\,000}{40\\,000}=250$ cm."
    ),
)

# q_dn25_018  f(6)=84  correct=2 (C)
upd("q_dn25_018",
    choices=["$54$", "$75$", "$84$", "$120$"],
    correct=2,
    explanation=(
        "$f(x)=x^3+ax^2+bx+c$. Từ $f(1)=19$, $f'(3)=0$, $f(3)=3$: "
        "$a=-3,\\,b=-9,\\,c=30$. "
        "$f(6)=216-3\\times36-9\\times6+30=216-108-54+30=84$."
    ),
)

# ── THPT 2021 Q12-Q19, Q25 ────────────────────────────────────────────────────

# q_thpt21_012  log₃(x-1)=2 → x=10  correct=0 (A)
upd("q_thpt21_012",
    question="Nghiệm của phương trình $\\log_3(x-1)=2$ là",
    choices=["$x=10$", "$x=4$", "$x=28$", "$x=1$"],
    correct=0,
    explanation="$\\log_3(x-1)=2\\Rightarrow x-1=3^2=9\\Rightarrow x=10$.",
)

# q_thpt21_013  ∫[2f-1]dx=9  correct=2 (C)
upd("q_thpt21_013",
    question=(
        "Nếu $\\displaystyle\\int_0^3 f(x)\\,dx=6$ thì "
        "$\\displaystyle\\int_0^3[2f(x)-1]\\,dx$ bằng"
    ),
    choices=["$3$", "$6$", "$9$", "$12$"],
    correct=2,
    explanation=(
        "$\\int_0^3[2f(x)-1]\\,dx=2\\int_0^3f(x)\\,dx-\\int_0^3 1\\,dx"
        "=2\\times6-3=9$."
    ),
)

# q_thpt21_014  d(M,plane)=2/3  correct=0 (A)
upd("q_thpt21_014",
    question=(
        "Khoảng cách từ điểm $M(1;\\,1;\\,1)$ đến mặt phẳng "
        "$(P)\\colon x-2y+2z-3=0$ bằng"
    ),
    choices=[
        "$\\dfrac{2}{3}$",
        "$\\dfrac{1}{3}$",
        "$2$",
        "$\\dfrac{4}{3}$",
    ],
    correct=0,
    explanation=(
        "$d=\\dfrac{|1-2\\cdot1+2\\cdot1-3|}{\\sqrt{1^2+2^2+2^2}}"
        "=\\dfrac{|-2|}{3}=\\dfrac{2}{3}$."
    ),
)

# q_thpt21_015  CSC u1=2, d=3 → u5=14  correct=2 (C)
upd("q_thpt21_015",
    question=(
        "Cấp số cộng $(u_n)$ có $u_1=2$, công sai $d=3$. "
        "Số hạng $u_5$ bằng"
    ),
    choices=["$10$", "$12$", "$14$", "$17$"],
    correct=2,
    explanation="$u_5=u_1+4d=2+4\\times3=14$.",
)

# q_thpt21_017  2^x=8 → x=3  correct=2 (C)
upd("q_thpt21_017",
    question="Nghiệm của phương trình $2^x=8$ là",
    choices=["$x=1$", "$x=2$", "$x=3$", "$x=4$"],
    correct=2,
    explanation="$2^x=8=2^3\\Rightarrow x=3$.",
)

# q_thpt21_018  ∫x²dx  correct=0 (A)
upd("q_thpt21_018",
    question="Nguyên hàm của hàm số $f(x)=x^2$ là",
    choices=[
        "$\\dfrac{x^3}{3}+C$",
        "$2x+C$",
        "$x^3+C$",
        "$3x^2+C$",
    ],
    correct=0,
    explanation="$\\int x^2\\,dx=\\dfrac{x^3}{3}+C$.",
)

# q_thpt21_019  |3+4i|=5  correct=1 (B)
upd("q_thpt21_019",
    question="Môđun của số phức $z=3+4i$ bằng",
    choices=["$\\sqrt{7}$", "$5$", "$7$", "$25$"],
    correct=1,
    explanation="$|z|=\\sqrt{3^2+4^2}=\\sqrt{25}=5$.",
)

# q_thpt21_025  z+w=(4+2i)+(3-4i)=7-2i  correct=1 (B)
upd("q_thpt21_025",
    question=(
        "Cho $z=4+2i$ và $w=3-4i$. "
        "Số phức $z+w$ bằng"
    ),
    choices=["$7+2i$", "$7-2i$", "$1+6i$", "$1-6i$"],
    correct=1,
    explanation="$z+w=(4+3)+(2-4)i=7-2i$.",
)

# ── Save ──────────────────────────────────────────────────────────────────────
with open(QF, "w", encoding="utf-8") as f:
    json.dump(qs, f, ensure_ascii=False, indent=2)
print("Done — questions.json updated.")
