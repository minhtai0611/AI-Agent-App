import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry


def _safe(s: str, max_len: int = 500) -> str:
    """Strip newlines and cap length to prevent prompt injection."""
    return s.replace('\n', ' ').replace('\r', ' ')[:max_len]

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


def _prefs_context(prefs: dict) -> str:
    """Return a short instruction fragment derived from user AI preferences."""
    if not prefs:
        return ""
    parts = []
    hint_style = prefs.get("hint_style", "socratic")
    if hint_style == "direct":
        parts.append("Phong cách: trả lời trực tiếp, giải thích rõ ràng")
    elif hint_style == "visual":
        parts.append("Phong cách: trực quan, chia từng bước rõ ràng")
    # socratic is the default — no extra instruction needed
    depth = prefs.get("explanation_depth", "detailed")
    if depth == "brief":
        parts.append("Độ chi tiết: rất ngắn gọn (tối đa 1 câu)")
    elif depth == "step-by-step":
        parts.append("Độ chi tiết: từng bước cụ thể")
    if prefs.get("language_mix") == "mixed":
        parts.append("Ngôn ngữ: có thể dùng thuật ngữ toán tiếng Anh khi cần")
    return (" " + "; ".join(parts) + ".") if parts else ""


async def generate_hint(
    client: AsyncOpenAI,
    question: dict,
    attempt_count: int = 1,
    previous_hints: list[str] | None = None,
    ai_preferences: dict | None = None,
) -> dict:
    settings = get_settings()
    level = _DETAIL_LEVEL.get(min(attempt_count, 3), _DETAIL_LEVEL[3])

    prev_context = ""
    if previous_hints:
        shown = "\n".join(f"  Lần {i+1}: {h}" for i, h in enumerate(previous_hints))
        prev_context = f"\nCác gợi ý đã cung cấp (KHÔNG lặp lại, phải tiến xa hơn):\n{shown}\n"

    safe_question = _safe(question.get('question', ''))
    safe_topic = _safe(question.get('topic', ''), 50)
    safe_difficulty = _safe(question.get('difficulty', ''), 30)
    prefs_note = _prefs_context(ai_preferences or {})

    prompt = f"""Tôi cần bạn tạo một GỢI Ý ngắn (KHÔNG phải lời giải) cho câu hỏi toán sau.
Yêu cầu ({level}): Đặt 1–2 câu hỏi gợi mở hoặc nhắc 1 khái niệm liên quan để học sinh tự suy nghĩ.{prefs_note}
Quy tắc bắt buộc:
- Tối đa 2 câu, viết liền mạch, không xuống dòng
- KHÔNG dùng markdown, KHÔNG dùng số thứ tự, KHÔNG dùng gạch đầu dòng
- KHÔNG tiết lộ đáp án hay ký hiệu A/B/C/D
- KÝ HIỆU TOÁN: Bọc MỌI biểu thức toán học trong $...$. Không dùng Unicode toán học ngoài dấu dollar.
Chủ đề: {safe_topic} | Mức độ: {safe_difficulty} | Lần {attempt_count}/3
Câu hỏi: {safe_question}{prev_context}
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
    return json.loads(content)
