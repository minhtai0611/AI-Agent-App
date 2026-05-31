"""
Unified math test case bank — 70 problems covering all 9 evaluation categories.

Each case is a dict with:
  id              : unique string identifier
  question        : problem text (Vietnamese + LaTeX $...$)
  category        : A–H (see test_wiki_math_system.py for descriptions)
  bloom_level     : 1–6 (Category A only; 0 = N/A)
  topic           : canonical topic label
  difficulty      : easy | medium | hard
  expected_answer : key phrase(s) that must appear in final_answer (case-insensitive)
                    Can be a string or list of strings (any one must match for pass).
                    Empty string "" = no answer check (structure/format check only).
  expected_valid  : True | False | None
                    True  = validator must return valid=True
                    False = validator should return valid=False (edge-case problems)
                    None  = no validation check (proof/open-ended)
  check_figure    : True = a figure must be generated (non-None, non-empty data)
  notes           : human-readable explanation of what this test exercises
"""

MATH_TEST_CASES: list[dict] = [

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY A — Bloom's Taxonomy (18 tests, 3 per level L1–L6)
    # ══════════════════════════════════════════════════════════════════

    # L1 Remember — pure recall of facts, formulas, definitions
    {
        "id": "A-L1-01",
        "question": "Đạo hàm của hàm số $\\sin x$ là gì?",
        "category": "A", "bloom_level": 1, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["cos x", "\\cos x"],
        "expected_valid": True, "check_figure": False,
        "notes": "Recall: basic derivative rule",
    },
    {
        "id": "A-L1-02",
        "question": "Công thức tính diện tích hình thang có hai đáy $a$, $b$ và chiều cao $h$ là gì?",
        "category": "A", "bloom_level": 1, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["(a+b)", "a + b"],
        "expected_valid": True, "check_figure": False,
        "notes": "Recall: trapezoid area formula",
    },
    {
        "id": "A-L1-03",
        "question": "Nếu $a > 1$ và $a^x = a^y$ thì $x$ và $y$ có quan hệ gì?",
        "category": "A", "bloom_level": 1, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x = y", "x bằng y"],
        "expected_valid": True, "check_figure": False,
        "notes": "Recall: exponential equality rule",
    },

    # L2 Understand — explain, interpret, restate
    {
        "id": "A-L2-01",
        "question": "Tại sao hàm số $f(x) = x^2$ đồng biến trên khoảng $(0, +\\infty)$? Giải thích bằng đạo hàm.",
        "category": "A", "bloom_level": 2, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["f'(x)", "2x", "dương"],
        "expected_valid": None, "check_figure": False,
        "notes": "Understand: interpret monotonicity via derivative sign",
    },
    {
        "id": "A-L2-02",
        "question": "Giải thích ý nghĩa hình học của đạo hàm $f'(x_0)$.",
        "category": "A", "bloom_level": 2, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["tiếp tuyến", "hệ số góc"],
        "expected_valid": None, "check_figure": False,
        "notes": "Understand: geometric meaning of derivative = slope of tangent",
    },
    {
        "id": "A-L2-03",
        "question": "Tại sao phương trình $x^2 + 1 = 0$ vô nghiệm trong tập số thực?",
        "category": "A", "bloom_level": 2, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x^2 \\geq 0", "x² ≥ 0", "không âm", "luôn dương"],
        "expected_valid": None, "check_figure": False,
        "notes": "Understand: explain why discriminant < 0 → no real roots",
    },

    # L3 Apply — execute known procedure on a new instance
    {
        "id": "A-L3-01",
        "question": "Tính tích phân $\\int_0^1 2x \\, dx$.",
        "category": "A", "bloom_level": 3, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["1"],
        "expected_valid": True, "check_figure": False,
        "notes": "Apply: power rule antiderivative + Newton-Leibniz",
    },
    {
        "id": "A-L3-02",
        "question": "Giải phương trình $2x + 3 = 7$.",
        "category": "A", "bloom_level": 3, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x = 2"],
        "expected_valid": True, "check_figure": False,
        "notes": "Apply: solve linear equation — simplest possible",
    },
    {
        "id": "A-L3-03",
        "question": "Tính đạo hàm của hàm số $f(x) = x^3 - 3x + 2$.",
        "category": "A", "bloom_level": 3, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["3x^2 - 3", "3x² - 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "Apply: polynomial differentiation",
    },

    # L4 Analyze — decompose, find structure, derive
    {
        "id": "A-L4-01",
        "question": "Tìm tất cả cực trị (cực đại, cực tiểu) của hàm số $f(x) = x^3 - 3x$.",
        "category": "A", "bloom_level": 4, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["cực đại", "cực tiểu", "x = -1", "x = 1"],
        "expected_valid": True, "check_figure": False,
        "notes": "Analyze: find critical points + classify with second derivative / sign chart",
    },
    {
        "id": "A-L4-02",
        "question": "Phân tích đa thức $x^3 - 6x^2 + 11x - 6$ thành nhân tử.",
        "category": "A", "bloom_level": 4, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["(x-1)", "(x-2)", "(x-3)"],
        "expected_valid": True, "check_figure": False,
        "notes": "Analyze: factor cubic — requires finding rational root then long division",
    },
    {
        "id": "A-L4-03",
        "question": "Tìm tập nghiệm của bất phương trình $x^2 - 5x + 6 < 0$.",
        "category": "A", "bloom_level": 4, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["(2, 3)", "2 < x < 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "Analyze: sign of quadratic on intervals — requires parabola analysis",
    },

    # L5 Evaluate — assess correctness, judge against criteria
    {
        "id": "A-L5-01",
        "question": "Kiểm tra xem $x = 2$ có phải là nghiệm của phương trình $x^2 - 5x + 6 = 0$ không. Trình bày lý do.",
        "category": "A", "bloom_level": 5, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["đúng", "là nghiệm", "thỏa mãn", "= 0"],
        "expected_valid": None, "check_figure": False,
        "notes": "Evaluate: verify by substitution — assessment of a claim",
    },
    {
        "id": "A-L5-02",
        "question": "Đánh giá: bất phương trình $\\log_2(x-1) > 3$ có tập nghiệm là $x > 9$ đúng hay sai?",
        "category": "A", "bloom_level": 5, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["đúng", "x > 9", "x-1 > 8"],
        "expected_valid": None, "check_figure": False,
        "notes": "Evaluate: verify logarithmic inequality solution",
    },
    {
        "id": "A-L5-03",
        "question": "Khẳng định: tập giá trị của hàm số $f(x) = \\sin x$ là $[-2, 2]$. Đúng hay sai? Tại sao?",
        "category": "A", "bloom_level": 5, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["sai", "[-1, 1]", "−1"],
        "expected_valid": None, "check_figure": False,
        "notes": "Evaluate: detect incorrect claim about range of sine function",
    },

    # L6 Create — synthesize new objects from constraints
    {
        "id": "A-L6-01",
        "question": "Xây dựng một hàm số $f(x)$ thỏa mãn đồng thời: $f'(x) = 3x^2$ và $f(0) = 5$.",
        "category": "A", "bloom_level": 6, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["x^3 + 5", "x³ + 5"],
        "expected_valid": True, "check_figure": False,
        "notes": "Create: construct function from derivative + initial condition",
    },
    {
        "id": "A-L6-02",
        "question": "Viết phương trình đường thẳng đi qua hai điểm $A(1, 2)$ và $B(3, 6)$.",
        "category": "A", "bloom_level": 6, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["y = 2x", "2x"],
        "expected_valid": True, "check_figure": False,
        "notes": "Create: construct line equation from two points",
    },
    {
        "id": "A-L6-03",
        "question": "Dựng phương trình bậc hai có hai nghiệm là $x_1 = 2$ và $x_2 = -3$.",
        "category": "A", "bloom_level": 6, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["x^2 + x - 6", "x² + x - 6"],
        "expected_valid": True, "check_figure": False,
        "notes": "Create: synthesize quadratic from roots via Vieta's formulas",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY B — THPT Domain Parity (18 tests, 3 per domain)
    # ══════════════════════════════════════════════════════════════════

    # Functions & Derivatives
    {
        "id": "B-FUNC-01",
        "question": "Tìm khoảng đồng biến của hàm số $f(x) = x^2 - 4x + 3$.",
        "category": "B", "bloom_level": 0, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["(2, +∞)", "(2; +∞)", "x > 2"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Functions easy: monotone increasing interval",
    },
    {
        "id": "B-FUNC-02",
        "question": "Tìm giá trị cực đại của hàm số $f(x) = -x^3 + 3x + 2$.",
        "category": "B", "bloom_level": 0, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["4", "f(-1) = 4"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Functions medium: local maximum value",
    },
    {
        "id": "B-FUNC-03",
        "question": "Tìm giá trị lớn nhất và giá trị nhỏ nhất của hàm số $f(x) = x^3 - 3x$ trên đoạn $[-2, 2]$.",
        "category": "B", "bloom_level": 0, "topic": "calculus", "difficulty": "hard",
        "expected_answer": ["2", "-2"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Functions hard: global extrema on closed interval",
    },

    # Exponential & Logarithm
    {
        "id": "B-LOG-01",
        "question": "Giải phương trình $2^x = 8$.",
        "category": "B", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x = 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Exponential easy: direct exponential equation",
    },
    {
        "id": "B-LOG-02",
        "question": "Giải phương trình $\\log_2(x-1) + \\log_2(x+1) = 3$.",
        "category": "B", "bloom_level": 0, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["x = 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Logarithm medium: combine logs, solve, check domain",
    },
    {
        "id": "B-LOG-03",
        "question": "Tìm $x$ biết $4^x - 3 \\cdot 2^x - 4 = 0$.",
        "category": "B", "bloom_level": 0, "topic": "algebra", "difficulty": "hard",
        "expected_answer": ["x = 2"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Exponential hard: substitution t=2^x reduces to quadratic",
    },

    # Integrals & Applications
    {
        "id": "B-INT-01",
        "question": "Tính tích phân $\\int_0^2 x \\, dx$.",
        "category": "B", "bloom_level": 0, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["2"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Integrals easy: basic definite integral",
    },
    {
        "id": "B-INT-02",
        "question": "Tính diện tích hình phẳng giới hạn bởi đường cong $y = x^2$, trục hoành, đường thẳng $x = 0$ và $x = 1$.",
        "category": "B", "bloom_level": 0, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["1/3", "\\frac{1}{3}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Integrals medium: area under a curve",
    },
    {
        "id": "B-INT-03",
        "question": "Tính tích phân $\\int_0^{\\pi} x \\sin x \\, dx$.",
        "category": "B", "bloom_level": 0, "topic": "calculus", "difficulty": "hard",
        "expected_answer": ["π", "\\pi", "pi"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Integrals hard: integration by parts",
    },

    # Probability & Statistics
    {
        "id": "B-PROB-01",
        "question": "Có 4 bóng đỏ và 3 bóng xanh trong hộp. Chọn ngẫu nhiên 1 bóng. Tính xác suất chọn được bóng đỏ.",
        "category": "B", "bloom_level": 0, "topic": "probability", "difficulty": "easy",
        "expected_answer": ["4/7", "\\frac{4}{7}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Probability easy: classical probability",
    },
    {
        "id": "B-PROB-02",
        "question": "Gieo một xúc xắc cân đối hai lần. Tính xác suất để cả hai lần đều ra mặt chẵn.",
        "category": "B", "bloom_level": 0, "topic": "probability", "difficulty": "medium",
        "expected_answer": ["1/4", "0,25", "0.25", "\\frac{1}{4}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Probability medium: independent events",
    },
    {
        "id": "B-PROB-03",
        "question": "Từ 5 học sinh nam và 3 học sinh nữ, chọn ngẫu nhiên 3 học sinh. Tính xác suất để chọn được đúng 1 học sinh nữ.",
        "category": "B", "bloom_level": 0, "topic": "probability", "difficulty": "hard",
        "expected_answer": ["15/28", "\\frac{15}{28}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Probability hard: combinations — C(3,1)*C(5,2)/C(8,3)",
    },

    # Spatial Geometry (3D)
    {
        "id": "B-GEO3D-01",
        "question": "Trong không gian $Oxyz$, tính khoảng cách từ điểm $A(1, 2, 3)$ đến gốc tọa độ $O$.",
        "category": "B", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["√14", "\\sqrt{14}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT 3D Geometry easy: distance formula in Oxyz",
    },
    {
        "id": "B-GEO3D-02",
        "question": "Viết phương trình mặt phẳng đi qua ba điểm $A(1,0,0)$, $B(0,2,0)$, $C(0,0,3)$.",
        "category": "B", "bloom_level": 0, "topic": "geometry", "difficulty": "medium",
        "expected_answer": ["6x + 3y + 2z", "x/1 + y/2 + z/3 = 1"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT 3D Geometry medium: plane through 3 points",
    },
    {
        "id": "B-GEO3D-03",
        "question": "Tính khoảng cách từ điểm $M(1, 1, 1)$ đến mặt phẳng $(P): 2x + 2y + z = 9$.",
        "category": "B", "bloom_level": 0, "topic": "geometry", "difficulty": "hard",
        "expected_answer": ["4/3", "\\frac{4}{3}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT 3D Geometry hard: point-to-plane distance formula",
    },

    # Trigonometry
    {
        "id": "B-TRIG-01",
        "question": "Tính giá trị của biểu thức $\\sin 30° + \\cos 60°$.",
        "category": "B", "bloom_level": 0, "topic": "trigonometry", "difficulty": "easy",
        "expected_answer": ["1"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Trig easy: standard angle values",
    },
    {
        "id": "B-TRIG-02",
        "question": "Giải phương trình $2\\sin x - \\sqrt{3} = 0$ trên đoạn $[0, 2\\pi]$.",
        "category": "B", "bloom_level": 0, "topic": "trigonometry", "difficulty": "medium",
        "expected_answer": ["π/3", "\\frac{\\pi}{3}", "2π/3", "\\frac{2\\pi}{3}"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Trig medium: basic trig equation with two solutions",
    },
    {
        "id": "B-TRIG-03",
        "question": "Rút gọn biểu thức $\\dfrac{\\sin 3x}{\\sin x} - \\dfrac{\\cos 3x}{\\cos x}$ (với $\\sin x \\neq 0$, $\\cos x \\neq 0$).",
        "category": "B", "bloom_level": 0, "topic": "trigonometry", "difficulty": "hard",
        "expected_answer": ["2"],
        "expected_valid": True, "check_figure": False,
        "notes": "THPT Trig hard: simplify using sine subtraction formula → sin(2x)/sinx·cosx = 2",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY C — Retrieval Quality (10 tests)
    # These tests require a populated wiki DB — skipped when pool=None.
    # ══════════════════════════════════════════════════════════════════

    {
        "id": "C-RET-01",
        "question": "Giải phương trình bậc hai $x^2 - 5x + 6 = 0$.",
        "category": "C", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x = 2", "x = 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve quadratic-formula wiki unit",
    },
    {
        "id": "C-RET-02",
        "question": "Tính đạo hàm của $f(x) = e^{2x}$.",
        "category": "C", "bloom_level": 0, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["2e^{2x}", "2e^2x"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve chain rule wiki unit",
    },
    {
        "id": "C-RET-03",
        "question": "Tính $\\int x e^x \\, dx$.",
        "category": "C", "bloom_level": 0, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["xe^x - e^x", "e^x(x-1)"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve integration-by-parts wiki unit",
    },
    {
        "id": "C-RET-04",
        "question": "Tìm các tiệm cận của hàm số $f(x) = \\frac{x+1}{x-2}$.",
        "category": "C", "bloom_level": 0, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["x = 2", "y = 1"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve asymptotes wiki unit",
    },
    {
        "id": "C-RET-05",
        "question": "Chứng minh $\\sin^2 x + \\cos^2 x = 1$.",
        "category": "C", "bloom_level": 0, "topic": "trigonometry", "difficulty": "easy",
        "expected_answer": ["1"],
        "expected_valid": None, "check_figure": False,
        "notes": "Retrieval: should retrieve Pythagorean identity wiki unit",
    },
    {
        "id": "C-RET-06",
        "question": "Giải hệ phương trình $x + y = 5$ và $2x - y = 1$.",
        "category": "C", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x = 2", "y = 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve linear-systems wiki unit",
    },
    {
        "id": "C-RET-07",
        "question": "Tính số chỉnh hợp chập 2 của 5 phần tử.",
        "category": "C", "bloom_level": 0, "topic": "combinatorics", "difficulty": "easy",
        "expected_answer": ["20"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve permutation formula wiki unit",
    },
    {
        "id": "C-RET-08",
        "question": "Tính $\\lim_{x \\to 0} \\dfrac{\\sin x}{x}$.",
        "category": "C", "bloom_level": 0, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["1"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve standard limit wiki unit",
    },
    {
        "id": "C-RET-09",
        "question": "Tìm số hạng tổng quát của cấp số nhân có $u_1 = 2$ và công bội $q = 3$.",
        "category": "C", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["2 \\cdot 3^{n-1}", "2·3^(n-1)"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve geometric sequence wiki unit",
    },
    {
        "id": "C-RET-10",
        "question": "Tính thể tích khối cầu có bán kính $R = 3$.",
        "category": "C", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["36π", "36\\pi"],
        "expected_valid": True, "check_figure": False,
        "notes": "Retrieval: should retrieve sphere volume formula wiki unit",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY D — Multi-Domain Reasoning (5 tests)
    # These require combining two distinct THPT topics in one problem.
    # ══════════════════════════════════════════════════════════════════

    {
        "id": "D-MULTI-01",
        "question": "Cho đường tròn $(C): x^2 + y^2 = 4$. Tìm tọa độ các điểm trên đường tròn có hoành độ bằng $\\sqrt{3}$.",
        "category": "D", "bloom_level": 0, "topic": "geometry", "difficulty": "medium",
        "expected_answer": ["(√3, 1)", "(√3, -1)", "\\sqrt{3}"],
        "expected_valid": True, "check_figure": False,
        "notes": "Multi-domain: algebra (substitution) + geometry (circle equation)",
    },
    {
        "id": "D-MULTI-02",
        "question": "Tìm giá trị lớn nhất của hàm số $f(x) = \\ln x - x$ trên khoảng $(0, +\\infty)$.",
        "category": "D", "bloom_level": 0, "topic": "calculus", "difficulty": "hard",
        "expected_answer": ["-1", "f(1) = -1"],
        "expected_valid": True, "check_figure": False,
        "notes": "Multi-domain: calculus (derivative) + logarithm (ln domain/properties)",
    },
    {
        "id": "D-MULTI-03",
        "question": "Giải phương trình $\\log_3(x^2 - 2x) = 1$.",
        "category": "D", "bloom_level": 0, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["x = 3", "x = -1"],
        "expected_valid": True, "check_figure": False,
        "notes": "Multi-domain: logarithm (log equation) + algebra (quadratic from exponential form)",
    },
    {
        "id": "D-MULTI-04",
        "question": "Tính diện tích hình phẳng giới hạn bởi đường cong $y = x^2$ và đường thẳng $y = x$.",
        "category": "D", "bloom_level": 0, "topic": "calculus", "difficulty": "medium",
        "expected_answer": ["1/6", "\\frac{1}{6}"],
        "expected_valid": True, "check_figure": False,
        "notes": "Multi-domain: integration (area) + algebra (intersection of parabola and line)",
    },
    {
        "id": "D-MULTI-05",
        "question": "Từ 5 bạn nam và 3 bạn nữ, chọn ngẫu nhiên 3 người. Tính xác suất chọn được đúng 1 bạn nữ.",
        "category": "D", "bloom_level": 0, "topic": "probability", "difficulty": "hard",
        "expected_answer": ["15/28", "\\frac{15}{28}"],
        "expected_valid": True, "check_figure": False,
        "notes": "Multi-domain: combinatorics (C_3^1 * C_5^2 / C_8^3) + probability",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY E — Proof & Deduction (5 tests)
    # Tests formal reasoning chains — expect many failures here.
    # ══════════════════════════════════════════════════════════════════

    {
        "id": "E-PROOF-01",
        "question": "Chứng minh rằng tích $n(n+1)$ chia hết cho 2 với mọi số nguyên dương $n$.",
        "category": "E", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["chẵn", "chia hết cho 2", "n và n+1"],
        "expected_valid": None, "check_figure": False,
        "notes": "Proof easy: consecutive integers — one must be even",
    },
    {
        "id": "E-PROOF-02",
        "question": "Chứng minh bất đẳng thức $a^2 + b^2 \\geq 2ab$ với mọi $a, b \\in \\mathbb{R}$.",
        "category": "E", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["(a-b)^2", "(a - b)^2", "\\geq 0"],
        "expected_valid": None, "check_figure": False,
        "notes": "Proof easy: AM-GM via completing the square → (a-b)² ≥ 0",
    },
    {
        "id": "E-PROOF-03",
        "question": "Chứng minh rằng $\\sqrt{2}$ là số vô tỉ.",
        "category": "E", "bloom_level": 0, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["vô tỉ", "phản chứng", "mâu thuẫn"],
        "expected_valid": None, "check_figure": False,
        "notes": "Proof medium: classic irrationality proof by contradiction",
    },
    {
        "id": "E-PROOF-04",
        "question": "Bằng quy nạp toán học, chứng minh $1 + 2 + 3 + \\ldots + n = \\dfrac{n(n+1)}{2}$ với mọi $n \\geq 1$.",
        "category": "E", "bloom_level": 0, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["quy nạp", "n=1", "k+1", "n(n+1)/2"],
        "expected_valid": None, "check_figure": False,
        "notes": "Proof medium: mathematical induction — base case + inductive step",
    },
    {
        "id": "E-PROOF-05",
        "question": "Chứng minh rằng trong tam giác bất kỳ, tổng hai cạnh bất kỳ luôn lớn hơn cạnh còn lại.",
        "category": "E", "bloom_level": 0, "topic": "geometry", "difficulty": "medium",
        "expected_answer": ["bất đẳng thức tam giác", "lớn hơn"],
        "expected_valid": None, "check_figure": False,
        "notes": "Proof medium: triangle inequality — geometric proof",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY F — Figure & Visual (4 tests)
    # A figure (GeoGebra or SVG) must be generated.
    # ══════════════════════════════════════════════════════════════════

    {
        "id": "F-FIG-01",
        "question": "Tìm giao điểm của đồ thị hàm số $y = x^2 - 4$ với trục $Ox$ và trục $Oy$.",
        "category": "F", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["x = 2", "x = -2", "y = -4"],
        "expected_valid": True, "check_figure": True,
        "notes": "Figure: parabola intersections — should generate function graph",
    },
    {
        "id": "F-FIG-02",
        "question": "Cho tam giác $ABC$ với $A(0,0)$, $B(4,0)$, $C(2,3)$. Vẽ và tính diện tích tam giác.",
        "category": "F", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["6"],
        "expected_valid": True, "check_figure": True,
        "notes": "Figure: coordinate geometry — should generate triangle diagram",
    },
    {
        "id": "F-FIG-03",
        "question": "Tìm tọa độ đỉnh và vẽ đồ thị của Parabol $y = x^2 - 2x + 3$.",
        "category": "F", "bloom_level": 0, "topic": "geometry", "difficulty": "medium",
        "expected_answer": ["(1, 2)", "đỉnh"],
        "expected_valid": True, "check_figure": True,
        "notes": "Figure: parabola vertex + graph — should generate GeoGebra plot",
    },
    {
        "id": "F-FIG-04",
        "question": "Cho hình lập phương $ABCD.A'B'C'D'$ cạnh $a = 2$. Tính thể tích và vẽ hình.",
        "category": "F", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["8"],
        "expected_valid": True, "check_figure": True,
        "notes": "Figure: 3D cube — should attempt 3D figure generation",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY G — Edge Cases & Adversarial (6 tests)
    # The system must NOT hallucinate answers for impossible/undefined problems.
    # ══════════════════════════════════════════════════════════════════

    {
        "id": "G-EDGE-01",
        "question": "Tính $\\log_1(5)$.",
        "category": "G", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["không xác định", "undefined", "không tồn tại", "vô nghĩa"],
        "expected_valid": False, "check_figure": False,
        "notes": "Edge: log base 1 is undefined — must not return a numeric answer",
    },
    {
        "id": "G-EDGE-02",
        "question": "Giải phương trình $\\sqrt{x} = -2$.",
        "category": "G", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["vô nghiệm", "không có nghiệm", "∅"],
        "expected_valid": False, "check_figure": False,
        "notes": "Edge: sqrt ≥ 0 so no real solution — must not return x=4",
    },
    {
        "id": "G-EDGE-03",
        "question": "Tìm một tam giác có cả ba góc đều bằng $90°$.",
        "category": "G", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["không tồn tại", "vô lý", "180°", "mâu thuẫn"],
        "expected_valid": False, "check_figure": False,
        "notes": "Edge: impossible — sum of angles = 180°, not 270°",
    },
    {
        "id": "G-EDGE-04",
        "question": "Giải phương trình $\\sqrt{x-1} + \\sqrt{1-x} = 2$.",
        "category": "G", "bloom_level": 0, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["vô nghiệm", "không có nghiệm"],
        "expected_valid": False, "check_figure": False,
        "notes": "Edge: domain forces x=1, substituting gives 0 ≠ 2 — no solution",
    },
    {
        "id": "G-EDGE-05",
        "question": "Giải phương trình $\\dfrac{x+1}{x-1} + \\dfrac{x-1}{x+1} = \\dfrac{x^2+3}{x^2-1}$.",
        "category": "G", "bloom_level": 0, "topic": "algebra", "difficulty": "medium",
        "expected_answer": ["vô nghiệm", "không có nghiệm", "điều kiện"],
        "expected_valid": False, "check_figure": False,
        "notes": "Edge: extraneous roots — algebraic solution yields x=±1 but both excluded by denominator",
    },
    {
        "id": "G-EDGE-06",
        "question": "Tính chu vi của Mặt Trăng bằng cách nào?",
        "category": "G", "bloom_level": 0, "topic": "other", "difficulty": "easy",
        "expected_answer": ["ngoài phạm vi", "không hỗ trợ", "toán lớp", "không thuộc", "mặt trăng"],
        "expected_valid": False, "check_figure": False,
        "notes": "Edge: out-of-scope — astronomy/geography, not THPT math",
    },

    # ══════════════════════════════════════════════════════════════════
    # CATEGORY H — Language & Format Quality (4 tests)
    # Regex-checked: Vietnamese output, $...$ LaTeX, Bước N: format
    # ══════════════════════════════════════════════════════════════════

    {
        "id": "H-LANG-01",
        "question": "Giải phương trình $x + 2 = 5$.",
        "category": "H", "bloom_level": 0, "topic": "algebra", "difficulty": "easy",
        "expected_answer": ["x = 3"],
        "expected_valid": True, "check_figure": False,
        "notes": "Language: trivial problem — check format discipline on simple case",
    },
    {
        "id": "H-LANG-02",
        "question": "Tính $f'(x)$ nếu $f(x) = x^2$.",
        "category": "H", "bloom_level": 0, "topic": "calculus", "difficulty": "easy",
        "expected_answer": ["2x"],
        "expected_valid": True, "check_figure": False,
        "notes": "Language: derivative — check step format on LaTeX-heavy output",
    },
    {
        "id": "H-LANG-03",
        "question": "Một đồng xu cân đối được tung lên. Xác suất xuất hiện mặt ngửa là bao nhiêu?",
        "category": "H", "bloom_level": 0, "topic": "probability", "difficulty": "easy",
        "expected_answer": ["1/2", "0,5", "0.5"],
        "expected_valid": True, "check_figure": False,
        "notes": "Language: pure text problem — check no English words in output",
    },
    {
        "id": "H-LANG-04",
        "question": "Tính diện tích hình vuông có cạnh bằng $3$.",
        "category": "H", "bloom_level": 0, "topic": "geometry", "difficulty": "easy",
        "expected_answer": ["9"],
        "expected_valid": True, "check_figure": False,
        "notes": "Language: geometry — check final_answer appears in last step",
    },
]

# ── Sanity checks ──────────────────────────────────────────────────────────────

_EXPECTED_COUNTS = {"A": 18, "B": 18, "C": 10, "D": 5, "E": 5, "F": 4, "G": 6, "H": 4}

def _validate_cases():
    from collections import Counter
    counts = Counter(c["category"] for c in MATH_TEST_CASES)
    for cat, expected in _EXPECTED_COUNTS.items():
        actual = counts.get(cat, 0)
        assert actual == expected, f"Category {cat}: expected {expected} cases, got {actual}"
    ids = [c["id"] for c in MATH_TEST_CASES]
    assert len(ids) == len(set(ids)), "Duplicate IDs found in test cases"

_validate_cases()
