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


async def generate_explanation(
    client: AsyncOpenAI,
    question: dict,
    chosen_index: int,
) -> dict:
    settings = get_settings()
    choices = question.get("choices", [])
    chosen_label = LABELS[chosen_index] if chosen_index < len(LABELS) else str(chosen_index)

    choices_text = "\n".join(
        f"  {LABELS[i]}. {c}" for i, c in enumerate(choices) if i < len(LABELS)
    )

    prompt = f"""Câu hỏi trắc nghiệm toán lớp 10:
{question.get('question', '')}

Các lựa chọn:
{choices_text}

Chủ đề: {question.get('topic', '')} | Mức độ: {question.get('difficulty', '')}
Học sinh đã chọn: {chosen_label}

QUAN TRỌNG: Chỉ trả về JSON, không có bất kỳ văn bản nào khác trước hoặc sau.
Xác định đáp án đúng bằng toán học, sau đó điền vào JSON:
{{"correct_index": <số nguyên 0–3 là index của đáp án đúng>, "explanation": "<2–3 câu tiếng Việt giải thích tại sao đáp án đó đúng, không dùng markdown>"}}"""

    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        max_tokens=600,
        messages=[
            {"role": "system", "content": STATIC_EXPLAIN_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content or ""
    content = _extract_json(raw)
    try:
        data = json.loads(content)
        # Validate correct_index is an int in [0, len(choices)-1]
        ci = int(data.get("correct_index", 0))
        data["correct_index"] = max(0, min(ci, len(choices) - 1))
        return data
    except (json.JSONDecodeError, ValueError):
        return {"correct_index": 0, "explanation": raw.strip()}
