import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_EXPLAIN_INSTRUCTIONS = """Bạn là gia sư toán học chuyên ôn thi lớp 10 TPHCM. \
Phân tích câu hỏi trắc nghiệm, xác định đáp án đúng bằng lập luận toán học, rồi giải thích ngắn gọn. \
Trả lời bằng tiếng Việt."""

LABELS = ["A", "B", "C", "D"]


import re

def _extract_json(text: str) -> str:
    """Return the first {...} block found anywhere in the text."""
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    # Fallback: strip code fences and return
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


def _prefs_context(prefs: dict) -> str:
    if not prefs:
        return ""
    parts = []
    depth = prefs.get("explanation_depth", "detailed")
    if depth == "brief":
        parts.append("Giải thích rất ngắn gọn (tối đa 1–2 câu)")
    elif depth == "step-by-step":
        parts.append("Giải thích từng bước cụ thể")
    if prefs.get("hint_style") == "direct":
        parts.append("Phong cách trực tiếp, rõ ràng")
    if prefs.get("language_mix") == "mixed":
        parts.append("Có thể dùng thuật ngữ toán tiếng Anh")
    return ("\n[Tùy chỉnh: " + "; ".join(parts) + "]") if parts else ""


async def generate_explanation(
    client: AsyncOpenAI,
    question: dict,
    chosen_index: int,
    ai_preferences: dict | None = None,
) -> dict:
    settings = get_settings()
    choices = question.get("choices", [])

    # Ground truth from question data — never let AI guess the correct answer
    correct_index = int(question.get("correct", 0))
    correct_index = max(0, min(correct_index, len(choices) - 1))
    base_explanation = question.get("explanation", "")

    chosen_label = LABELS[chosen_index] if chosen_index < len(LABELS) else str(chosen_index)
    correct_label = LABELS[correct_index] if correct_index < len(LABELS) else str(correct_index)

    choices_text = "\n".join(
        f"  {LABELS[i]}. {c}" for i, c in enumerate(choices) if i < len(LABELS)
    )

    # If the question already has an explanation, use it directly without an AI call
    if base_explanation:
        student_context = (
            f"Bạn đã chọn đúng ({correct_label})! " if chosen_index == correct_index
            else f"Bạn chọn {chosen_label}, đáp án đúng là {correct_label}. "
        )
        return {
            "correct_index": correct_index,
            "explanation": student_context + base_explanation,
        }

    prefs_note = _prefs_context(ai_preferences or {})

    # No pre-written explanation — ask AI to explain, but correct_index is already known
    prompt = f"""Câu hỏi trắc nghiệm toán lớp 10:
{question.get('question', '')}

Các lựa chọn:
{choices_text}

Chủ đề: {question.get('topic', '')} | Mức độ: {question.get('difficulty', '')}
Học sinh đã chọn: {chosen_label}
Đáp án đúng: {correct_label} (index {correct_index}) — đây là sự thật, không được thay đổi.{prefs_note}

QUAN TRỌNG: Chỉ trả về JSON, không có bất kỳ văn bản nào khác trước hoặc sau.
Giải thích ngắn gọn tại sao đáp án {correct_label} đúng:
{{"correct_index": {correct_index}, "explanation": "<2–3 câu tiếng Việt giải thích, không dùng markdown>"}}"""

    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        max_tokens=400,
        messages=[
            {"role": "system", "content": STATIC_EXPLAIN_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content or ""
    content = _extract_json(raw)
    try:
        data = json.loads(content)
        # Always use ground-truth correct_index regardless of what AI returns
        data["correct_index"] = correct_index
        return data
    except (json.JSONDecodeError, ValueError):
        return {"correct_index": correct_index, "explanation": raw.strip()}
