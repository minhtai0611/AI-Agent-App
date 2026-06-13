import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

THPT_CONTEXT = """
Bối cảnh: Đây là kỳ thi THPT Quốc gia Việt Nam. Các câu hỏi thường có bẫy sau:
- Nhầm lẫn giữa điều kiện cần và điều kiện đủ trong bài toán logarit, hàm số
- Bỏ sót nghiệm ngoài miền xác định
- Tính sai dấu khi khai triển công thức lượng giác
- Nhầm chiều tích phân hoặc quên hằng số C
Luôn gợi ý học sinh kiểm tra lại điều kiện trước khi kết luận.
"""

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


_HINT_STYLE_INSTRUCTIONS = {
    "socratic": "Hướng dẫn bằng cách đặt câu hỏi gợi mở, KHÔNG tiết lộ đáp án — hãy để học sinh tự khám phá.",
    "direct": "Đưa ra gợi ý trực tiếp, rõ ràng về cách tiếp cận từng bước. Hãy cụ thể và rõ ràng.",
    "visual": "Trình bày gợi ý theo các bước đánh số rõ ràng. Dùng ký hiệu toán học chuẩn và nhãn bước rõ ràng.",
}

_HINT_USER_STYLE = {
    "socratic": "Đặt 1–2 câu hỏi gợi mở, KHÔNG tiết lộ đáp án — để học sinh tự khám phá.",
    "direct":   "Đưa ra 1–2 bước tiếp cận trực tiếp, rõ ràng về cách giải. Không hỏi ngược lại.",
    "visual":   "Liệt kê các bước tiếp cận theo số thứ tự (1., 2., ...). Mỗi bước ngắn, rõ ràng.",
}

_ENCOURAGEMENT_INSTRUCTIONS = {
    'minimal': 'Be concise and direct. Skip praise.',
    'moderate': 'Brief encouragement is welcome.',
    'high': 'Be warm and encouraging throughout.',
}


async def generate_hint(
    client: AsyncOpenAI,
    question: dict,
    attempt_count: int = 1,
    previous_hints: list[str] | None = None,
    ai_preferences: dict | None = None,
) -> dict:
    settings = get_settings()
    level = _DETAIL_LEVEL.get(min(attempt_count, 3), _DETAIL_LEVEL[3])

    prefs = ai_preferences or {}
    hint_style = prefs.get("hint_style", "socratic")
    style_instruction = _HINT_STYLE_INSTRUCTIONS.get(hint_style, _HINT_STYLE_INSTRUCTIONS["socratic"])
    style_user_hint = _HINT_USER_STYLE.get(hint_style, _HINT_USER_STYLE["socratic"])
    encouragement_level = prefs.get("encouragement_level", "moderate")
    encouragement_instruction = _ENCOURAGEMENT_INSTRUCTIONS.get(encouragement_level, _ENCOURAGEMENT_INSTRUCTIONS["moderate"])
    lang_instruction = "Bạn có thể dùng thuật ngữ toán tiếng Anh khi cần thiết." if prefs.get("language_mix") == "mixed" else ""
    weak_focus_instruction = "Khi gợi ý, hãy nhấn mạnh các khái niệm nền tảng mà học sinh có thể chưa nắm vững." if prefs.get("weak_topic_focus", True) else ""

    prev_context = ""
    if previous_hints:
        shown = "\n".join(f"  Lần {i+1}: {h}" for i, h in enumerate(previous_hints))
        prev_context = f"\nCác gợi ý đã cung cấp (KHÔNG lặp lại, phải tiến xa hơn):\n{shown}\n"

    prompt = f"""Tôi cần bạn tạo một GỢI Ý ngắn (KHÔNG phải lời giải) cho câu hỏi toán sau.
Yêu cầu ({level}): {style_user_hint}
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
            {"role": "system", "content": THPT_CONTEXT + STATIC_HINT_INSTRUCTIONS + "\n" + style_instruction + "\n" + encouragement_instruction + ("\n" + lang_instruction if lang_instruction else "") + ("\n" + weak_focus_instruction if weak_focus_instruction else "")},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content or ""
    content = _strip_code_fence(raw)
    return json.loads(content)
