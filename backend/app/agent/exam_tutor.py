from openai import AsyncOpenAI, APIConnectionError, RateLimitError, APIStatusError
from tenacity import RetryError
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_TUTOR_INSTRUCTIONS = """Bạn là gia sư toán học chuyên ôn thi lớp 10 TPHCM.
Không tự giới thiệu tên hay nhà phát triển. Đi thẳng vào nhận xét kết quả và hướng dẫn ôn tập.
Giải thích từng bước rõ ràng, dùng tiếng Việt, luôn khuyến khích học sinh.
Tập trung vào các chủ đề yếu của học sinh."""


def build_tutor_system_prompt(exam_context: dict, student_name: str = "") -> str:
    lines = [STATIC_TUTOR_INSTRUCTIONS, "\n## Thông tin học sinh (dynamic)"]
    if student_name:
        lines.append(f"Tên: {student_name}")

    exam_id = exam_context.get("examId", "")
    if exam_id:
        lines.append(f"Đề thi: {exam_id}")

    topic_breakdown = exam_context.get("topicBreakdown", {})
    if topic_breakdown:
        weak = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]
        if weak:
            lines.append(f"Chủ đề yếu: {', '.join(weak)}")

    weak_topics = exam_context.get("weakTopics", [])
    if weak_topics:
        lines.append(f"Cần ôn tập: {', '.join(weak_topics)}")

    return "\n".join(lines)


async def run_tutor(
    client: AsyncOpenAI,
    messages: list[dict],
    exam_context: dict,
    student_name: str = "",
) -> tuple[str, list[dict]]:
    settings = get_settings()
    system_msg = {"role": "system", "content": build_tutor_system_prompt(exam_context, student_name)}

    # API requires at least one user turn; inject a silent greeting trigger when the
    # conversation is empty (first open), but don't persist it in the returned history.
    if not messages:
        api_messages = [system_msg, {"role": "user", "content": "Chào gia sư! Em vừa làm xong bài kiểm tra. Gia sư có thể nhận xét kết quả và hướng dẫn em ôn tập không?"}]
    else:
        api_messages = [system_msg, *messages]

    try:
        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=2048,
            messages=api_messages,
        )
    except (RateLimitError, RetryError):
        return "Hệ thống đang bận, vui lòng thử lại sau.", messages
    except APIConnectionError:
        return "Không thể kết nối đến AI service.", messages
    except APIStatusError as e:
        return f"Lỗi hệ thống: {e.status_code}", messages

    reply = response.choices[0].message.content or ""
    return reply, messages + [{"role": "assistant", "content": reply}]
