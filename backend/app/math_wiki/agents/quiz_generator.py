import json
import logging
import re
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

logger = logging.getLogger(__name__)

_SYSTEM = """Bạn là giáo viên Toán lớp 9 chuyên ôn thi vào lớp 10 TPHCM.
Nhiệm vụ: tạo câu hỏi trắc nghiệm kiểm tra nhanh kiến thức theo trọng tâm tuần học.

Nguyên tắc bắt buộc:
- Mọi phép tính phải làm được bằng đầu óc — KHÔNG cần máy tính, không cần bảng số.
- Mỗi câu có đúng 4 phương án (A, B, C, D). Phương án sai phải là "bẫy" thực sự:
  dùng lỗi sai phổ biến (nhầm dấu, bỏ nghiệm, tính sai căn, nhầm công thức Delta).
- Sắp xếp từ dễ → khó trong danh sách câu hỏi.
- Câu hỏi và giải thích viết bằng tiếng Việt.
- Cho phép dùng LaTeX trong dạng $...$ cho ký hiệu toán học.
- Trả về JSON hợp lệ, không có text ngoài JSON."""

_PROMPT_TMPL = """Trọng tâm tuần: {focus}
Nhiệm vụ học trong tuần: {tasks}

Ngữ cảnh kiến thức từ kho tri thức:
{context}

Tạo {n} câu hỏi trắc nghiệm (từ dễ đến khó) kiểm tra đúng kỹ năng trong nhiệm vụ trên.

Trả về JSON:
{{
  "questions": [
    {{
      "stem": "Nội dung câu hỏi (tiếng Việt, LaTeX $...$ được phép)",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_index": 0,
      "difficulty": "easy",
      "explanation": "Giải thích ngắn tại sao đáp án đúng (và tại sao các bẫy sai)"
    }}
  ]
}}"""


def _fix_latex_escapes(text: str) -> str:
    """Double-escape backslashes that are not valid JSON escape sequences.

    LLMs frequently emit bare LaTeX (e.g. \sqrt, \frac, \alpha) inside JSON
    strings.  These are invalid JSON escape sequences and cause json.loads to
    raise JSONDecodeError.  Valid JSON escapes after '\' are: " \ / b f n r t u.
    """
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)


def _extract_json(text: str) -> str:
    """Strip code fences, repair LaTeX escapes, and extract a valid JSON object."""
    text = text.strip()
    # Remove code fences
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    # Try direct parse
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass
    # Fix unescaped LaTeX backslashes (e.g. \sqrt → \\sqrt) and retry
    fixed = _fix_latex_escapes(text)
    try:
        json.loads(fixed)
        return fixed
    except json.JSONDecodeError:
        pass
    # Fall back to extracting the outermost { ... } object
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
            max_tokens=3000,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        raw = _extract_json(response.choices[0].message.content or "{}")
        data = json.loads(raw)
        questions = data.get("questions", [])
        # Validate basic shape
        return [
            q for q in questions
            if isinstance(q.get("stem"), str)
            and isinstance(q.get("choices"), list)
            and len(q["choices"]) == 4
            and isinstance(q.get("correct_index"), int)
        ]
    except Exception as exc:
        logger.error("quiz_generator: generation failed: %s", exc)
        raise
