import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_HINT_INSTRUCTIONS = """Bạn là trợ lý AI của ứng dụng luyện thi toán lớp 10 TPHCM. \
Hỗ trợ tạo nội dung giáo dục. Trả lời bằng tiếng Việt."""

_DETAIL_LEVEL = {
    1: "gợi ý nhẹ — chỉ gợi hướng tư duy, không tiết lộ bất kỳ thông tin về đáp án",
    2: "gợi ý vừa — chỉ ra phương pháp giải cụ thể, vẫn không tiết lộ đáp án",
    3: "gợi ý chi tiết — giải thích từng bước tiếp cận, nhưng để học sinh tự chọn đáp án",
}


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def generate_hint(
    client: AsyncOpenAI,
    question: dict,
    attempt_count: int = 1,
    previous_hints: list[str] | None = None,
) -> dict:
    settings = get_settings()
    level = _DETAIL_LEVEL.get(min(attempt_count, 3), _DETAIL_LEVEL[3])

    prev_context = ""
    if previous_hints:
        shown = "\n".join(f"  Lần {i+1}: {h}" for i, h in enumerate(previous_hints))
        prev_context = f"\nCác gợi ý đã cung cấp (KHÔNG lặp lại, phải tiến xa hơn):\n{shown}\n"

    prompt = f"""Tôi cần bạn tạo một GỢI Ý ngắn (KHÔNG phải lời giải) cho câu hỏi toán sau.
Yêu cầu ({level}): Đặt 1–2 câu hỏi gợi mở hoặc nhắc 1 khái niệm liên quan để học sinh tự suy nghĩ.
Quy tắc bắt buộc:
- Tối đa 2 câu, viết liền mạch, không xuống dòng
- KHÔNG dùng markdown, KHÔNG dùng số thứ tự, KHÔNG dùng gạch đầu dòng
- KHÔNG tiết lộ đáp án hay ký hiệu A/B/C/D
Chủ đề: {question.get('topic', '')} | Mức độ: {question.get('difficulty', '')} | Lần {attempt_count}/3
Câu hỏi: {question.get('question', '')}{prev_context}
Trả về đúng định dạng JSON sau, không thêm text nào khác:
{{"hint": "<1–2 câu gợi ý tiếng Việt, không markdown>", "difficulty_note": ""}}"""

    response = await call_with_retry(
        client,
        model=settings.hint_model,
        max_tokens=512,
        messages=[
            {"role": "system", "content": STATIC_HINT_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content or ""
    content = _strip_code_fence(raw)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # AI returned plain text instead of JSON — wrap it directly
        return {"hint": raw.strip(), "difficulty_note": ""}
