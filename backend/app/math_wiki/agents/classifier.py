import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json, VALID_LABELS
from app.math_wiki.taxonomy import CANONICAL_TOPICS  # noqa: F401 — imported for canonical reference


async def classify_problem(client: AsyncOpenAI, problem_text: str) -> str:
    settings = get_settings()
    user_msg = (
        f"{problem_text}\n\n"
        "Respond ONLY with valid JSON in this exact format: "
        '{"label": "<category>"} '
        "where category is one of: algebra, geometry, statistics, probability, "
        "calculus, trigonometry, combinatorics, number_theory, "
        "complex_numbers, sequences, vectors, functions."
    )
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["CLASSIFY"]},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=50,
    )
    raw = response.choices[0].message.content or ""
    content = _extract_json(raw)
    try:
        parsed = json.loads(content)
        label = parsed.get("label", "")
    except json.JSONDecodeError:
        label = ""

    keyword_map = {
            "calculus": [
                "calculus", "derivative", "integral", "integrate", "differentiat",
                "limit", r"\int", "antiderivative", "indefinite", "definite",
                "dy/dx", "d/dx", "partial", "gradient", "divergence", "curl",
                "differential equation", "ode", "pde", "y''", "y'",
                # Vietnamese
                "đạo hàm", "tích phân", "nguyên hàm", "giới hạn", "vi phân",
                "phương trình vi phân", "cực trị hàm", "tiếp tuyến",
            ],
            "trigonometry": [
                "trigonometry", "trigonometric", "sine", "cosine", "tangent",
                r"\sin", r"\cos", r"\tan", r"\cot", r"\sec", r"\csc",
                "sin(", "cos(", "tan(", "arcsin", "arccos", "arctan",
                # Vietnamese
                "sin ", "cos ", "tan ", "cot ", "sinx", "cosx", "tanx",
                "công thức lượng giác", "hệ thức lượng",
            ],
            "algebra": [
                "algebra", "equation", "quadratic", "polynomial", "linear", "variable",
                # Vietnamese
                "phương trình", "hệ phương trình", "bất phương trình",
                "đa thức", "nhân tử", "rút gọn", "hằng đẳng thức",
            ],
            "geometry": [
                "geometry", "geometric", "triangle", "circle", "area", "perimeter", "volume", "angle",
                # Vietnamese
                "tam giác", "hình vuông", "hình chữ nhật", "hình thang", "hình tròn",
                "đường tròn", "hình hộp", "hình chóp", "hình trụ", "hình cầu",
                "diện tích", "chu vi", "thể tích", "góc", "đường thẳng", "mặt phẳng",
            ],
            "statistics": [
                "statistic", "mean", "median", "mode", "variance", "deviation", "frequency",
                # Vietnamese
                "trung bình", "trung vị", "phương sai", "độ lệch chuẩn", "tần số",
                "bảng số liệu", "biểu đồ",
            ],
            "probability": [
                "probability", "chance", "likelihood", "random", "event",
                # Vietnamese
                "xác suất", "biến cố", "ngẫu nhiên", "không gian mẫu",
            ],
            "combinatorics": [
                "combinatoric", "permutation", "combination", "factorial", "arrange",
                # Vietnamese
                "tổ hợp", "chỉnh hợp", "hoán vị", "giai thừa", "đếm",
            ],
            "number_theory": [
                "number theory", "prime", "divisor", "modular", "gcd", "lcm",
                # Vietnamese
                "số nguyên tố", "ước", "bội", "chia hết", "đồng dư", "ucln", "bcnn",
            ],
            "sequences": [
                # Vietnamese
                "dãy số", "cấp số cộng", "cấp số nhân", "công sai", "công bội",
                "số hạng", "tổng n số hạng", "giới hạn dãy",
                # English
                "sequence", "series", "arithmetic sequence", "geometric sequence",
            ],
            "vectors": [
                # Vietnamese
                "vectơ", "tích vô hướng", "tích có hướng", "tọa độ vectơ",
                # English
                "vector", "dot product", "cross product", "magnitude",
            ],
            "functions": [
                # Vietnamese
                "hàm số", "đồ thị hàm số", "tập xác định", "tập giá trị",
                "đơn điệu", "đồng biến", "nghịch biến", "hàm bậc", "hàm mũ", "hàm logarit",
                # English
                "function", "domain", "range", "monoton",
            ],
            "complex_numbers": [
                # Vietnamese
                "số phức", "phần thực", "phần ảo", "module", "argument",
                # English
                "complex number", "imaginary", "real part", "imaginary part",
            ],
        }

    # Always scan the question text — the model frequently mislabels calculus/trig as algebra.
    # A keyword hit on the question overrides the model's label.
    question_lower = problem_text.lower()
    keyword_label = next(
        (lbl for lbl, kws in keyword_map.items() if any(kw in question_lower for kw in kws)),
        None,
    )
    if label not in VALID_LABELS:
        label = keyword_label or "algebra"
    elif keyword_label and keyword_label != label:
        # Question text strongly signals a different category — trust the question.
        label = keyword_label
    return label
