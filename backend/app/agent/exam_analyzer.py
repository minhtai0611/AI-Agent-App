import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_EXAM_ANALYSIS_INSTRUCTIONS = """Bạn là chuyên gia phân tích kết quả học tập cho học sinh ôn thi vào lớp 10.
Phân tích kết quả thi và đưa ra nhận xét cụ thể, điểm yếu cần cải thiện, và khuyến nghị thực tế.
Trả lời bằng tiếng Việt. Luôn trả về JSON hợp lệ theo đúng định dạng yêu cầu, không có text ngoài JSON."""


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def analyze_exam_result(
    client: AsyncOpenAI,
    result: dict,
    history: list[dict],
    student_name: str = "",
) -> dict:
    settings = get_settings()

    topic_breakdown = result.get("topicBreakdown", {})
    weak_topics = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]

    dynamic_parts = []
    if student_name:
        dynamic_parts.append(f"Học sinh: {student_name}")
    dynamic_parts.append(f"Điểm: {result.get('score', 0)}/10")
    dynamic_parts.append(f"Độ chính xác: {round(result.get('accuracy', 0) * 100)}%")
    dynamic_parts.append(f"Chủ đề yếu (< 60%): {', '.join(weak_topics) or 'Không có'}")
    dynamic_parts.append(f"Chi tiết: {json.dumps(topic_breakdown, ensure_ascii=False)}")
    if len(history) >= 2:
        recent_scores = [r.get("score", 0) for r in history[-5:]]
        dynamic_parts.append(f"Điểm gần đây: {recent_scores}")

    prompt = "\n".join(dynamic_parts) + """

Trả về JSON (không có text ngoài JSON):
{
  "insights": "Nhận xét tổng quan 2-3 câu",
  "weak_topics": ["topic_key1", "topic_key2"],
  "recommendations": ["khuyến nghị 1", "khuyến nghị 2", "khuyến nghị 3"]
}"""

    response = await call_with_retry(
        client,
        model=settings.default_model,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": STATIC_EXAM_ANALYSIS_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
    )

    content = _strip_code_fence(response.choices[0].message.content or "{}")
    return json.loads(content)
