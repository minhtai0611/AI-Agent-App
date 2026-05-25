import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

THPT_ANALYSIS_CONTEXT = """
Khi phân tích kết quả thi THPT:
- Đề cập đến phân phối điểm chuẩn vào đại học theo tỉnh thành
- Nhấn mạnh rằng 8.0+ thường cần thiết cho trường top
- Chỉ ra xu hướng đề thi theo năm (khó hơn ở phần hình học không gian và tích phân)
- Ưu tiên gợi ý trường phù hợp với điểm thực tế, không chỉ trường mơ ước
"""

PROVINCIAL_DIFFICULTY_CONTEXT = """
Provincial THPT difficulty context (2024 data):
- Hà Nội, TP.HCM: difficulty 4/5, typical Math cutoff ~8.0, top schools require 9.0+
- Đà Nẵng, Hải Phòng, Cần Thơ: difficulty 3/5, typical cutoff ~7.0-7.2
- Most other provinces: difficulty 2-3/5, typical cutoff 6.4-6.8
- National average THPT Math 2024: 6.51
When province data is provided, calibrate school recommendations to provincial difficulty.
A score of 8.0 in Hà Nội is harder to achieve than 8.0 in a lower-difficulty province.
"""

STATIC_EXAM_ANALYSIS_INSTRUCTIONS = THPT_ANALYSIS_CONTEXT + PROVINCIAL_DIFFICULTY_CONTEXT + """Bạn là chuyên gia phân tích kết quả học tập cho học sinh ôn thi Toán.
Phân tích kết quả thi, các câu trả lời đúng/sai cụ thể, và gợi ý trường phù hợp dựa trên điểm số.
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
    wrong_questions: list[dict] = None,
    school_recommendations: list[dict] = None,
    exam_category: str = "",
    user_profile: dict = None,
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
    dynamic_parts.append(f"Chi tiết theo chủ đề: {json.dumps(topic_breakdown, ensure_ascii=False)}")
    if len(history) >= 2:
        recent_scores = [r.get("score", 0) for r in history[-5:]]
        dynamic_parts.append(f"Điểm gần đây: {recent_scores}")

    if wrong_questions:
        wrong_summary = [
            {"topic": q.get("topic"), "difficulty": q.get("difficulty"), "question": q.get("question", "")[:80]}
            for q in wrong_questions[:5]
        ]
        dynamic_parts.append(f"Câu sai ({len(wrong_questions)} câu, ví dụ): {json.dumps(wrong_summary, ensure_ascii=False)}")

    grade = str((user_profile or {}).get("grade", ""))
    province = (user_profile or {}).get("province", "") or (user_profile or {}).get("location", "")

    if school_recommendations:
        school_list = [
            f"{s['school']['name']} ({s['matchStrength']}, điểm chuẩn Toán: {s['cutoff']})"
            for s in school_recommendations[:6]
        ]
        # Derive school type from grade: ≤9 → high school (lớp 10), 10-12 → university
        if grade and grade.isdigit() and int(grade) <= 9:
            exam_type = "lớp 10"
            school_type_note = "trường THPT"
        else:
            exam_type = "đại học/THPT"
            school_type_note = "trường đại học/cao đẳng"
        loc_note = f" tại {province}" if province else ""
        dynamic_parts.append(
            f"Trường gợi ý{loc_note} ({school_type_note}, kỳ thi {exam_type}): {'; '.join(school_list)}"
        )

    # Add grade + province context for personalized school recommendation prompt
    if grade:
        dynamic_parts.append(f"Lớp học sinh: {grade}")
    if province:
        dynamic_parts.append(f"Tỉnh/thành phố: {province}")

    school_json_field = ""
    if school_recommendations:
        if grade and grade.isdigit() and int(grade) <= 9:
            school_insight_hint = "Nhận xét ngắn 1-2 câu về trường THPT phù hợp để thi vào lớp 10 với điểm số này"
        else:
            school_insight_hint = "Nhận xét ngắn 1-2 câu về trường đại học/cao đẳng phù hợp với điểm số này"
        school_json_field = f',\n  "school_insight": "{school_insight_hint}"'

    prompt = "\n".join(dynamic_parts) + f"""

Trả về JSON (không có text ngoài JSON):
{{
  "insights": "Nhận xét tổng quan 2-3 câu về kết quả thi",
  "question_analysis": "Phân tích cụ thể các câu trả lời sai nếu có, chỉ ra điểm cần cải thiện (2-3 câu)",
  "weak_topics": ["topic_key1", "topic_key2"],
  "recommendations": ["khuyến nghị 1", "khuyến nghị 2", "khuyến nghị 3"]{school_json_field}
}}"""

    response = await call_with_retry(
        client,
        model=settings.default_model,
        max_tokens=1200,
        messages=[
            {"role": "system", "content": STATIC_EXAM_ANALYSIS_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
    )

    content = _strip_code_fence(response.choices[0].message.content or "{}")
    return json.loads(content)
