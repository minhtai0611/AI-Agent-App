import json
import logging
import random
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

CHK-1  TOÁN HỌC CHÍNH XÁC — GIẢI TRƯỚC KHI ĐẶT correct_index
  → Viết lời giải tự luận đầy đủ từng bước số học cụ thể.
  → Ghi kết quả cuối: "Đáp án đúng = <giá trị>".
  → Tìm phần tử trong choices khớp giá trị đó → đó là correct_index.
  → Xác nhận 3 phương án còn lại đều SAI.
  → KHÔNG được gán correct_index trước rồi mới giải — luôn giải trước, gán sau.

CHK-2  NHẤT QUÁN GIẢI THÍCH — ĐÁP ÁN
  → Nội dung "Đáp án đúng:" trong explanation PHẢI KHỚP giá trị số với choices[correct_index].
  → Nếu không khớp → viết lại câu từ đầu.

CHK-3  NHẤT QUÁN BẪY — EXPLANATION
  → Với mỗi bẫy (phương án sai), explanation phải ghi đúng tên loại lỗi và cơ chế sai khớp với giá trị trong choices.

CHK-4  LOOKALIKE ĐỦ ĐIỀU KIỆN
  → Tất cả 4 phương án cùng dạng ký hiệu và cấu trúc.
  → Không có phương án nào quá dài/ngắn hoặc phức tạp khác biệt rõ ràng so với các phương án khác.

CHK-5  EXPLANATION NGẮN GỌN — KHÔNG BIỆN HỘ SAU
  → Explanation CHỈ được giải bài toán GỐC trong stem — KHÔNG được thử nghiệm thay đổi đề bài.
  → Nếu tính toán cho kết quả không khớp choices nào → viết lại câu hỏi để sửa, KHÔNG viết dài thêm để biện hộ.
  → Giới hạn: phần "Đáp án đúng:" tối đa 4 câu/bước; mỗi bẫy tối đa 1 câu ngắn.

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
5. PHÂN BỐ correct_index: trong {n} câu, đáp án đúng phải rải đều A/B/C/D — KHÔNG được tập trung vào một vị trí. Đặt đáp án đúng vào vị trí bất kỳ (0, 1, 2, hoặc 3) sau khi sắp xếp choices.

Trả về JSON hợp lệ, không có text nào ngoài JSON:
{{
  "questions": [
    {{
      "stem": "Nội dung câu hỏi (tiếng Việt, LaTeX $...$)",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_index": "<số nguyên 0-3, phân bố đều giữa các câu — KHÔNG luôn là 0>",
      "difficulty": "easy|medium|hard",
      "bloom_level": "remember|understand|apply|analyze",
      "explanation": "Đáp án đúng: <lời giải từng bước>. Bẫy <tên PA sai 1> [LOẠI_LỖI]: <cơ chế>. Bẫy <tên PA sai 2> [LOẠI_LỖI]: <cơ chế>. Bẫy <tên PA sai 3> [LOẠI_LỖI]: <cơ chế>."
    }}
  ]
}}"""


# Reviewer prompt: independent mathematical validation of each generated question.
# Uses default_model (sonnet) because haiku cannot reliably verify multi-step algebra
# (Vieta, completing the square, optimization with constraints, etc.).
_REVIEWER_SYSTEM = r"""Bạn là giáo viên Toán lớp 9 kiểm duyệt độc lập. Với MỖI câu hỏi:

BƯỚC 1 — GIẢI ĐỘC LẬP (bắt buộc, không đọc explanation trước):
  Đọc "stem". Tính kết quả đúng từ đầu theo từng bước số học cụ thể.
  Ghi kết quả tính được: result = <giá trị cụ thể>.

BƯỚC 2 — ĐỐI CHIẾU VỚI CHOICES:
  Tìm phần tử trong "choices" chứa giá trị = result ở Bước 1.
  Đó là correct_index thực sự (0=A, 1=B, 2=C, 3=D).

BƯỚC 3 — SO SÁNH VỚI correct_index ĐÃ CHO:
  Nếu correct_index đã cho = correct_index thực sự → valid: true.
  Nếu khác → valid: false, báo corrected_correct_index = correct_index thực sự.
  Nếu không có choice nào khớp result → valid: false, corrected_correct_index: null (bỏ câu).

QUY TẮC QUAN TRỌNG:
- KHÔNG được tin vào explanation — nó có thể sai hoặc cố tình biện hộ cho đáp án sai.
- KHÔNG được chấp nhận lý luận dài dòng thay đổi đề bài. Chỉ kiểm tra stem gốc.
- Nếu explanation mâu thuẫn với kết quả tính ở Bước 1 → luôn tin vào tính toán, không tin explanation.

Trả về JSON thuần (không có text ngoài):
{"results": [{"index": <i>, "valid": true|false, "corrected_correct_index": <j|null>}]}"""


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
            model=settings.default_model,
            max_tokens=3000,
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


def _validate_structure(questions: list[dict]) -> list[dict]:
    """Deterministic post-generation guard before questions reach the UI.

    Hard drops (structural):
      - correct_index not an int 0-3
      - choices count != 4
      - any choice is empty/missing
      - stem is empty

    Soft warns (content consistency — LLM reviewer already validated the math):
      - explanation missing "Đáp án đúng" section
      - choices[correct_index] value not found in explanation answer section
    """
    valid: list[dict] = []
    for i, q in enumerate(questions):
        ci = q.get("correct_index")
        choices = q.get("choices") or []
        stem = (q.get("stem") or "").strip()
        explanation = (q.get("explanation") or "").strip()

        # ── Hard structural checks ──────────────────────────────────────────
        if not isinstance(ci, int) or not (0 <= ci <= 3):
            logger.warning("quiz_validate: q%d dropped — invalid correct_index %r", i, ci)
            continue
        if len(choices) != 4:
            logger.warning("quiz_validate: q%d dropped — expected 4 choices, got %d", i, len(choices))
            continue
        if not all(isinstance(c, str) and c.strip() for c in choices):
            logger.warning("quiz_validate: q%d dropped — empty or non-string choice", i)
            continue
        if not stem:
            logger.warning("quiz_validate: q%d dropped — empty stem", i)
            continue

        # ── Soft content-consistency checks (warn only) ─────────────────────
        if not explanation:
            logger.warning("quiz_validate: q%d has no explanation", i)
        elif "Đáp án đúng" not in explanation:
            logger.warning("quiz_validate: q%d explanation missing 'Đáp án đúng' section", i)
        else:
            # Extract correct choice value (strip "A. " label and LaTeX $ markers + whitespace)
            correct_body = re.sub(r'^[A-D]\.\s*', '', choices[ci]).strip()
            # Get answer section (text before first "Bẫy" label)
            ans_section = re.split(r'\bBẫy\s+[A-D]\b', explanation, maxsplit=1)[0]

            def _norm(s: str) -> str:
                return re.sub(r'[\s$]', '', s)

            if correct_body and _norm(correct_body) not in _norm(ans_section):
                logger.warning(
                    "quiz_validate: q%d explanation/answer mismatch — "
                    "choice[%d]=%r not found in answer section %r",
                    i, ci, correct_body[:50], ans_section[:100],
                )

        valid.append(q)
    return valid


def _shuffle_answer_position(questions: list[dict]) -> list[dict]:
    """Randomly redistribute the correct answer across A/B/C/D positions.

    LLMs have a strong bias toward correct_index=0. This post-processor
    reassigns each question's correct answer to a random position so the
    distribution is uniform regardless of what the model output.
    """
    result = []
    for q in questions:
        old_idx = q["correct_index"]
        choices = list(q["choices"])
        new_idx = random.randint(0, 3)
        if new_idx != old_idx:
            choices[old_idx], choices[new_idx] = choices[new_idx], choices[old_idx]
            # Re-label A/B/C/D to match new positions
            relabeled = []
            for i, c in enumerate(choices):
                label = chr(65 + i) + ". "
                body = re.sub(r'^[A-D]\.\s*', '', c)
                relabeled.append(label + body)
            q = dict(q, choices=relabeled, correct_index=new_idx)
        result.append(q)
    return result


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
        questions = _validate_structure(questions)
        questions = _shuffle_answer_position(questions)
        return questions
    except Exception as exc:
        logger.error("quiz_generator: generation failed: %s", exc)
        raise
