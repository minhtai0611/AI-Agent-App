import json
import logging
import re
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

logger = logging.getLogger(__name__)

# Sources for distractor taxonomy and techniques:
# - Vanderbilt / Lamar algebra error catalogs (sign, distribution, sqrt errors)
# - NAACL 2024: naming error mechanisms raises distractor plausibility ~2.68→~3.7 on 5-pt scale
# - INFORMS 2022: partial-solution and conceptual-reversal are most convincing traps in quant MCQs
# - Student Choice Prediction (ACL 2025): conceptual-overlap traps attract highest-ability students
# - LookAlike ACL 2025: surface-form consistency across all options blocks answer-by-elimination
# - NYSED item writing guide: sign/coefficient/unit alteration as a systematic distractor family
_SYSTEM = r"""Bạn là giáo viên Toán lớp 9 chuyên ôn thi vào lớp 10 TPHCM, đồng thời là chuyên gia thiết kế đề trắc nghiệm.
Nhiệm vụ: tạo câu hỏi trắc nghiệm chất lượng cao — mỗi phương án sai phải dựa trên lỗi nhận thức thực sự của học sinh và không thể loại bằng hình thức.

═══ NGUYÊN TẮC CỐT LÕI ═══

1. TÍNH NHẨM ĐƯỢC: Mọi con số phải tính được bằng đầu óc — KHÔNG cần máy tính.
2. 4 PHƯƠNG ÁN: Mỗi câu có đúng 4 lựa chọn (A–D), chỉ một đúng.
3. BẪY CÓ NGUỒN GỐC: Mỗi phương án sai PHẢI xuất phát từ một loại lỗi cụ thể trong bảng taxonomy.
   Ba bẫy trong một câu phải đến từ BA loại lỗi KHÁC NHAU.
4. LOOKALIKE — NGOẠI HÌNH GIỐNG NHAU: Tất cả 4 phương án phải có cùng dạng ký hiệu, cùng cấu trúc
   (cùng loại biểu thức, số hạng tương đương, độ phức tạp tương tự). Học sinh không được loại
   phương án sai chỉ bằng cách nhìn hình thức mà phải tính toán.
5. TỰ KIỂM TRA: Tính lại đáp án đúng từng bước trước khi viết JSON. Xác nhận mỗi bẫy thực sự sai.
6. ĐỘ KHÓ BLOOM: Sắp xếp từ dễ → khó theo thang nhận thức.
7. NGÔN NGỮ: Tiếng Việt. LaTeX trong $...$ cho ký hiệu toán.
8. JSON THUẦN: Chỉ trả về JSON, không có text ngoài.

═══ BẢNG LỖI SAI THỰC CHỨNG (DISTRACTOR TAXONOMY) ═══

Mỗi bẫy phải thuộc một trong 13 loại sau — ghi tên loại trong explanation:

── NHÓM DẤU VÀ HỆ SỐ ──

[SIGN_ERROR] Nhầm dấu âm/dương
  • $-(a-b)$ → ghi $-a-b$ thay vì $-a+b$
  • Tổng Viète $x_1+x_2=-b/a$ → ghi $+b/a$ (bỏ dấu âm)
  • Tích Viète $x_1x_2=c/a$ → ghi $-c/a$
  • $-x$ khi $x=-5$ → ghi $-5$ thay vì $5$

[COEFFICIENT_ERROR] Sai hệ số hoặc bội số
  • $(a+b)^2=a^2+2ab+b^2$ → bỏ hệ số 2: viết $a^2+ab+b^2$
  • $\Delta=b^2-4ac$ → viết $b^2-ac$ (quên hệ số 4)
  • $2a\cdot x_0 = -b$ → viết $a\cdot x_0=-b$ (quên hệ số 2)
  • Kết quả đúng nhân hay chia thêm 2, 4, hoặc $\pi$ do nhầm công thức

[WRONG_OPERATION] Dùng phép tính sai — số đúng, phép tính sai
  • Cộng thay nhân: $P = a \times b$ → viết $P = a + b$
  • Bình phương thay nhân đôi: $2r$ → viết $r^2$
  • Khai căn thay bình phương: $x^2=k$ → ghi $x=k^2$ thay $x=\sqrt{k}$
  • Chia thay trừ trong hệ thức lượng

── NHÓM NGHIỆM VÀ MIỀN ──

[MISSING_ROOT] Bỏ sót nghiệm
  • $x^2=9$ → chỉ lấy $x=3$, quên $x=-3$
  • Chia hai vế cho $x$ → mất nghiệm $x=0$
  • $|x|=5$ → quên $x=-5$
  • Phương trình tích: chỉ lấy một trong hai nghiệm

[EXTRANEOUS_ROOT] Nghiệm ngoại lai (không kiểm tra lại)
  • Bình phương hai vế rồi không thử lại vào phương trình gốc
  • Đặt ẩn phụ $t=\sqrt{x}\geq0$ rồi nhận $t<0$
  • Nhận nghiệm nằm ngoài điều kiện xác định

[INEQUALITY_FLIP] Quên đảo chiều bất phương trình
  • Nhân/chia hai vế với số âm mà không lật dấu $\leq\to\geq$
  • Kết quả là phần bù của tập nghiệm đúng

── NHÓM CĂN VÀ PHÂN PHỐI ──

[SQRT_LINEARITY] Giả sử căn là tuyến tính
  • $\sqrt{a^2+b^2}\to a+b$ (cộng thẳng, bỏ dấu căn)
  • $\sqrt{(a+b)^2}=a+b$ (bỏ trị tuyệt đối)
  • $\sqrt{9+16}=3+4=7$ thay vì $\sqrt{25}=5$

[SQRT_NO_ABS] Quên trị tuyệt đối khi khai căn
  • $\sqrt{x^2}=x$ thay vì $|x|$
  • $\sqrt{(x-3)^2}=x-3$ thay vì $|x-3|$

[DISTRIBUTION_ERROR] Phân phối/nhân sai
  • $(a+b)^2\neq a^2+b^2$ (bỏ hạng tử $2ab$)
  • $a(b-c)^2\neq(ab-ac)^2$: nhân $a$ vào trước khi bình phương
  • $\frac{a+b}{c}\neq\frac{a}{c}+b$: chỉ rút gọn một hạng tử

── NHÓM CÔNG THỨC VÀ KHÁI NIỆM ──

[DELTA_ERROR] Sai công thức Delta
  • $\Delta=b^2-4ac$: nhầm dấu $c$, hoặc dùng $b$ thay $b'=b/2$
  • Chỉ lấy một nghiệm $x_1$ hoặc chỉ lấy $x_2$

[CONCEPTUAL_REVERSAL] Đảo ngược một quan hệ toán học
  • Phân số: $\frac{a}{b}\to\frac{b}{a}$ (đảo tử/mẫu)
  • Tỉ số lượng giác: $\sin\theta=\frac{\text{đối}}{\text{huyền}}$ → dùng $\frac{\text{huyền}}{\text{đối}}$
  • Viète: dùng tổng thay tích hoặc ngược lại
  • Hệ thức: $x_1\cdot x_2=c/a$ → học sinh dùng $x_1+x_2$
  • Tỉ lệ thức: $\frac{a}{b}=\frac{c}{d}$ → giải nhầm thành $ad=bc$ rồi hoán vị sai

[VERTEX_SIGN] Nhầm dấu tọa độ đỉnh parabol
  • $x_0=-b/(2a)$ → dùng $+b/(2a)$
  • Tính $f(x_0)$ nhưng thay $-x_0$

[FORMULA_MIX] Nhầm công thức hoặc điều kiện áp dụng
  • Diện tích/chu vi: nhầm hình tròn với hình quạt hay hình chữ nhật
  • Định lý Pythagore: nhầm vai trò cạnh huyền
  • Hệ thức lượng trong tam giác vuông: nhầm cạnh với chiều cao

── NHÓM ĐẶC BIỆT: BẪY MẠNH NHẤT ──

[PARTIAL_SOLUTION] Nghiệm trung gian — học sinh dừng lại quá sớm
  Đây là loại bẫy hiệu quả nhất với học sinh giỏi.
  Kỹ thuật: lấy KẾT QUẢ CỦA BƯỚC TRUNG GIAN đúng trong lời giải đầy đủ làm phương án sai.
  • Bài 3 bước: kết quả bước 2 là đáp án trông "hợp lý" nhất
  • Tìm $x$: học sinh tính được $2x=10$ rồi ghi ngay $10$ thay vì $5$
  • Tìm diện tích: tính đúng bán kính $r$ rồi ghi $r$ thay vì $\pi r^2$
  • Giải hệ: tìm đúng $x$ rồi quên thay vào tìm $y$
  Cách tạo: Viết lời giải đầy đủ 4–5 bước → lấy kết quả bước 2 và bước 3 làm hai bẫy.

═══ QUY TRÌNH ESSAY-TO-MCQ (chuyển bài tự luận thành trắc nghiệm) ═══

Đây là kỹ thuật cốt lõi để tạo bẫy cực kỳ thuyết phục:

Bước 1 — Viết lời giải tự luận đầy đủ:
  Liệt kê từng bước tính: $k_1=\ldots$, $k_2=\ldots$, $k_3=\ldots$, đáp án $=k_n$.

Bước 2 — Thu hoạch bẫy từ lời giải:
  • Bẫy A = $k_{n-1}$ (kết quả bước cuối-1): [PARTIAL_SOLUTION]
  • Bẫy B = kết quả nếu dùng sai công thức tại bước quan trọng nhất: [FORMULA_MIX] hoặc [DELTA_ERROR]
  • Bẫy C = đáp án đúng nhưng đổi dấu hoặc đảo tử/mẫu: [SIGN_ERROR] hoặc [CONCEPTUAL_REVERSAL]

Bước 3 — Áp dụng nguyên tắc LOOKALIKE:
  Đảm bảo A, B, C, D (đáp án đúng) cùng dạng: đều là số nguyên, đều là phân số, đều có $\sqrt{}$,
  cùng số hạng, giá trị gần nhau về độ lớn.

Bước 4 — Sắp xếp các phương án theo thứ tự tăng dần (với số) hoặc theo độ phức tạp.

Bước 5 — Kiểm tra: Đọc từng bẫy và tự hỏi "Học sinh nào sẽ chọn cái này và tại sao?"
  Bẫy tốt = có câu trả lời rõ ràng cho câu hỏi đó.

═══ THANG ĐỘ KHÓ BLOOM ═══

"easy"   → Nhớ/Hiểu: nhận dạng công thức, tính một bước, bẫy là lỗi cơ bản (SIGN_ERROR, MISSING_ROOT)
"medium" → Vận dụng: giải 2–3 bước, bẫy bao gồm PARTIAL_SOLUTION từ bước trung gian
"hard"   → Phân tích/Đánh giá: 3–5 bước, hai bẫy kết hợp (ví dụ PARTIAL_SOLUTION + CONCEPTUAL_REVERSAL),
           điều kiện ẩn, học sinh giỏi vẫn có thể mắc bẫy nếu không kiểm tra kỹ

═══ TỰ KIỂM TRA BẮT BUỘC TRƯỚC KHI XUẤT JSON ═══

Sau khi tạo xong từng câu, thực hiện kiểm tra sau — nếu không qua thì viết lại câu đó:

CHK-1  TOÁN HỌC CHÍNH XÁC
  → Tính lại đáp án đúng từ đầu, độc lập với lời giải đã viết.
  → Xác nhận choices[correct_index] = kết quả tính lại.
  → Xác nhận 3 phương án còn lại đều SAI (không có phương án sai nào vô tình đúng).

CHK-2  NHẤT QUÁN GIẢI THÍCH — ĐÁP ÁN
  → Đọc phần "Đáp án đúng:" trong explanation.
  → Đọc nội dung choices[correct_index].
  → Hai nội dung PHẢI KHỚP VỀ GIÁ TRỊ SỐ VÀ HÌNH THỨC BIỂU DIỄN.
  → Nếu explanation nói "x = 5" nhưng choices[correct_index] ghi "$x = 3$" → viết lại.

CHK-3  NHẤT QUÁN BẪY — EXPLANATION
  → Với mỗi bẫy (phương án sai), explanation phải ghi đúng tên loại lỗi và cơ chế sai khớp với giá trị trong choices.
  → Ví dụ: nếu Bẫy B là "$x = -5$", explanation phải giải thích cụ thể TẠI SAO học sinh ra $-5$ (qua loại lỗi nào).

CHK-4  LOOKALIKE ĐỦ ĐIỀU KIỆN
  → Tất cả 4 phương án cùng dạng ký hiệu và cấu trúc.
  → Không có phương án nào quá dài/ngắn hoặc phức tạp khác biệt rõ ràng so với các phương án khác.

QUAN TRỌNG: correct_index trong JSON PHẢI trỏ đúng vào phương án chứa đáp án đã tính ở CHK-1.
Đây là điều kiện tối thiểu — sai ở đây là lỗi nghiêm trọng nhất."""

_PROMPT_TMPL = """Trọng tâm tuần: {focus}
Nhiệm vụ học trong tuần:
{tasks}

Ngữ cảnh kiến thức từ kho tri thức:
{context}

Tạo {n} câu hỏi trắc nghiệm (từ dễ → khó theo Bloom).

YÊU CẦU BẮT BUỘC cho mỗi câu:
1. Áp dụng quy trình Essay-to-MCQ: viết lời giải tự luận trước, sau đó thu hoạch bẫy.
2. Đảm bảo nguyên tắc LOOKALIKE: 4 phương án cùng dạng ký hiệu, giá trị gần nhau.
3. Ba bẫy từ ba loại lỗi KHÁC NHAU trong taxonomy.
4. Explanation nêu rõ: tính toán đáp án đúng + tên loại lỗi + cơ chế sai của từng bẫy.

Trả về JSON hợp lệ, không có text nào ngoài JSON:
{{
  "questions": [
    {{
      "stem": "Nội dung câu hỏi (tiếng Việt, LaTeX $...$)",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_index": 0,
      "difficulty": "easy",
      "bloom_level": "remember",
      "explanation": "Đáp án đúng: <lời giải từng bước>. Bẫy B [LOẠI_LỖI]: <cơ chế sai cụ thể>. Bẫy C [LOẠI_LỖI]: <cơ chế sai cụ thể>. Bẫy D [LOẠI_LỖI]: <cơ chế sai cụ thể>."
    }}
  ]
}}"""


# Reviewer prompt: independent mathematical validation of each generated question.
# Grounded in:
#   - NAACL 2024: explicit error-mechanism labeling correlates with higher distractor quality
#   - INFORMS 2022: answer-key accuracy is the single largest driver of perceived MCQ quality
#   - NYSED item-writing guide §4: each item must have one and only one defensible correct answer
_REVIEWER_SYSTEM = r"""Bạn là giáo viên Toán kiểm duyệt đề thi lớp 9. Nhiệm vụ: kiểm tra từng câu trắc nghiệm về HAI khía cạnh:

1. ĐÚNG TOÁN HỌC: Tính lại từ đầu. Xác nhận choices[correct_index] là đáp án toán học đúng.
2. NHẤT QUÁN: Nội dung phần "Đáp án đúng:" trong explanation phải khớp với choices[correct_index].

Với mỗi câu trong mảng "questions", trả về một phần tử trong mảng "results":
- Nếu hợp lệ: {"index": <i>, "valid": true}
- Nếu có vấn đề: {"index": <i>, "valid": false, "issues": ["<mô tả ngắn>"], "corrected_correct_index": <j hoặc null>}

Chỉ trả về JSON thuần (không có text ngoài):
{"results": [...]}"""


async def _review_and_patch(
    client: AsyncOpenAI,
    questions: list[dict],
    settings,
) -> list[dict]:
    """Send generated questions to a reviewer model; drop or patch invalid ones."""
    if not questions:
        return questions

    payload = json.dumps({"questions": questions}, ensure_ascii=False)
    try:
        response = await call_with_retry(
            client,
            model=settings.haiku_model,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": _REVIEWER_SYSTEM},
                {"role": "user", "content": payload},
            ],
        )
        raw = _extract_json(response.choices[0].message.content or "{}")
        data = json.loads(raw)
        results = {r["index"]: r for r in data.get("results", [])}
    except Exception as exc:
        logger.warning("quiz_generator: reviewer call failed (%s), skipping review", exc)
        return questions

    patched: list[dict] = []
    for i, q in enumerate(questions):
        verdict = results.get(i)
        if verdict is None or verdict.get("valid"):
            patched.append(q)
            continue
        corrected = verdict.get("corrected_correct_index")
        if corrected is not None and 0 <= corrected < len(q.get("choices", [])):
            logger.info(
                "quiz_generator: patching correct_index %d→%d for question %d (issues: %s)",
                q["correct_index"], corrected, i, verdict.get("issues"),
            )
            q = dict(q, correct_index=corrected)
            patched.append(q)
        else:
            logger.warning(
                "quiz_generator: dropping question %d — reviewer flagged unfixable issues: %s",
                i, verdict.get("issues"),
            )
    return patched


def _fix_latex_escapes(text: str) -> str:
    """Double-escape backslashes that are not valid JSON escape sequences.

    LLMs frequently emit bare LaTeX (e.g. \\sqrt, \\frac) inside JSON strings.
    Valid JSON escapes after '\\' are: " \\ / b f n r t u.
    """
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)


def _extract_json(text: str) -> str:
    """Strip code fences, repair LaTeX escapes, and extract a valid JSON object."""
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass
    fixed = _fix_latex_escapes(text)
    try:
        json.loads(fixed)
        return fixed
    except json.JSONDecodeError:
        pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        candidate = m.group(0)
        return _fix_latex_escapes(candidate)
    return fixed


async def generate_week_quiz(
    client: AsyncOpenAI,
    pool,
    week_focus: str,
    week_tasks: list[str],
    n: int = 4,
) -> list[dict]:
    """Generate n MCQ for a study-plan week, grounded in wiki knowledge."""
    context = ""
    if pool:
        try:
            from app.math_wiki.storage import pg_vectors, pg_db
            query = week_focus + " " + " ".join(week_tasks)
            ids = await pg_vectors.query_pgvector(pool, query, top_k=8)
            units = await pg_db.get_wiki_units_by_ids(pool, ids) if ids else []
            if units:
                context = "\n\n".join(
                    f"[{u.get('id', '')}] {u.get('content', '')}"
                    for u in units[:6]
                )
        except Exception as exc:
            logger.warning("quiz_generator: wiki retrieval failed (%s), continuing without context", exc)

    if not context:
        context = "(Không có ngữ cảnh từ kho tri thức — tự tạo câu hỏi dựa trên trọng tâm)"

    prompt = _PROMPT_TMPL.format(
        focus=week_focus,
        tasks="\n".join(f"- {t}" for t in week_tasks),
        context=context,
        n=n,
    )

    settings = get_settings()
    try:
        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=4000,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        raw = _extract_json(response.choices[0].message.content or "{}")
        data = json.loads(raw)
        questions = data.get("questions", [])
        # bloom_level is optional for backward compatibility
        questions = [
            q for q in questions
            if isinstance(q.get("stem"), str)
            and isinstance(q.get("choices"), list)
            and len(q["choices"]) == 4
            and isinstance(q.get("correct_index"), int)
        ]
        questions = await _review_and_patch(client, questions, settings)
        return questions
    except Exception as exc:
        logger.error("quiz_generator: generation failed: %s", exc)
        raise
