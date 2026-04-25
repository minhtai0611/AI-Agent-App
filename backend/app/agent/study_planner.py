import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_STUDY_PLAN_INSTRUCTIONS = """Bạn là chuyên gia lập kế hoạch học tập cho học sinh ôn thi vào lớp 10.
Tạo kế hoạch 4 tuần cá nhân hóa, thực tế và khả thi.
Trả lời bằng tiếng Việt. Luôn trả về JSON hợp lệ, không có text ngoài JSON."""

_DEFAULT_SCHEDULE = [
    {"week": 1, "focus": "Ôn tập kiến thức cơ bản", "tasks": ["Xem lại lý thuyết từng chủ đề", "Làm bài tập cơ bản", "Ghi chú các công thức quan trọng"]},
    {"week": 2, "focus": "Luyện tập dạng bài", "tasks": ["Làm đề thử theo chủ đề yếu", "Xem giải thích chi tiết", "Tổng kết lỗi sai"]},
    {"week": 3, "focus": "Ôn tập tổng hợp", "tasks": ["Làm đề thi tổng hợp", "Phân tích và sửa lỗi", "Ôn lại các chủ đề còn yếu"]},
    {"week": 4, "focus": "Thi thử và đánh giá", "tasks": ["Thi thử toàn phần có tính giờ", "Rà soát điểm yếu còn lại", "Ôn tập nhẹ trước ngày thi"]},
]


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def generate_study_plan(
    client: AsyncOpenAI,
    result: dict,
    history: list[dict],
    student_name: str = "",
) -> dict:
    settings = get_settings()

    topic_breakdown = result.get("topicBreakdown", {})
    weak_topics = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]

    lines = []
    if student_name:
        lines.append(f"Học sinh: {student_name}")
    lines.append(f"Điểm gần nhất: {result.get('score', 0)}/10")
    lines.append(f"Chủ đề yếu: {', '.join(weak_topics) or 'Không có'}")
    lines.append(f"Số đề đã thi: {len(history)}")

    prompt = "\n".join(lines) + """

Tạo kế hoạch học tập 4 tuần. Trả về JSON (không có text ngoài JSON):
{
  "plan": "Tổng quan kế hoạch (markdown, 3-5 điểm chính)",
  "weekly_schedule": [
    {"week": 1, "focus": "Chủ điểm tuần", "tasks": ["Nhiệm vụ 1", "Nhiệm vụ 2", "Nhiệm vụ 3"]}
  ]
}"""

    try:
        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=1500,
            messages=[
                {"role": "system", "content": STATIC_STUDY_PLAN_INSTRUCTIONS},
                {"role": "user", "content": prompt},
            ],
        )
        content = _strip_code_fence(response.choices[0].message.content or "{}")
        return json.loads(content)
    except Exception:
        return {"plan": "## Kế hoạch học tập\n- Ôn tập đều đặn mỗi ngày\n- Làm đề thử thường xuyên\n- Xem giải thích sau mỗi bài", "weekly_schedule": _DEFAULT_SCHEDULE}
