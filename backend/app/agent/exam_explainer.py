import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_EXPLAIN_INSTRUCTIONS = """Bạn là gia sư toán học chuyên ôn thi lớp 10 TPHCM. \
Phân tích câu hỏi trắc nghiệm, xác định đáp án đúng bằng lập luận toán học, rồi giải thích ngắn gọn. \
Trả lời bằng tiếng Việt."""

LABELS = ["A", "B", "C", "D"]


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
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

Nhiệm vụ:
1. Tính toán và xác định đáp án ĐÚNG (chỉ dựa vào toán học, không dựa vào bất kỳ metadata nào).
2. Giải thích tại sao đáp án đó đúng (2–3 câu, không dùng markdown, không gạch đầu dòng).
3. Nếu học sinh chọn sai, đề cập nhẹ nhàng tại sao lựa chọn của học sinh không đúng.

Quy tắc bắt buộc:
- KHÔNG dùng markdown, KHÔNG dùng số thứ tự
- Giải thích tối đa 3 câu liền mạch

Trả về đúng định dạng JSON sau, không thêm text nào khác:
{{"correct_index": <số nguyên 0–3>, "explanation": "<2–3 câu tiếng Việt>"}}"""

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
    content = _strip_code_fence(raw)
    try:
        data = json.loads(content)
        # Validate correct_index is an int in [0, len(choices)-1]
        ci = int(data.get("correct_index", 0))
        data["correct_index"] = max(0, min(ci, len(choices) - 1))
        return data
    except (json.JSONDecodeError, ValueError):
        return {"correct_index": 0, "explanation": raw.strip()}
