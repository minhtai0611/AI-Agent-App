import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry


def _safe(s: str, max_len: int = 200) -> str:
    """Strip newlines and cap length to prevent prompt injection."""
    return s.replace('\n', ' ').replace('\r', ' ')[:max_len]

STATIC_EXAM_ANALYSIS_INSTRUCTIONS = """Bạn là chuyên gia phân tích kết quả học tập cho học sinh ôn thi Toán.
Phân tích kết quả thi, các câu trả lời đúng/sai cụ thể, và gợi ý trường phù hợp dựa trên điểm số.
Trả lời bằng tiếng Việt. Luôn trả về JSON hợp lệ theo đúng định dạng yêu cầu, không có text ngoài JSON."""


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def build_analyze_prompt(
    result: dict,
    history: list[dict],
    student_name: str = "",
    wrong_questions: list[dict] = None,
    school_recommendations: list[dict] = None,
    exam_category: str = "",
    user_profile: dict = None,
) -> str:
    """Build the user prompt for exam analysis (shared by sync and streaming endpoints)."""
    topic_breakdown = result.get("topicBreakdown", {})
    weak_topics = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]

    safe_name = _safe(student_name) if student_name else ""
    grade = _safe(str((user_profile or {}).get("grade", "")), 5)
    province = _safe((user_profile or {}).get("province", "") or (user_profile or {}).get("location", ""))

    dynamic_parts = []
    if safe_name:
        dynamic_parts.append(f"Học sinh: {safe_name}")
    dynamic_parts.append(f"Điểm: {result.get('score', 0)}/10")
    dynamic_parts.append(f"Độ chính xác: {round(result.get('accuracy', 0) * 100)}%")
    dynamic_parts.append(f"Chủ đề yếu (< 60%): {', '.join(weak_topics) or 'Không có'}")
    dynamic_parts.append(f"Chi tiết theo chủ đề: {json.dumps(topic_breakdown, ensure_ascii=False)}")
    if len(history) >= 2:
        recent_scores = [r.get("score", 0) for r in history[-5:]]
        dynamic_parts.append(f"Điểm gần đây: {recent_scores}")

    if wrong_questions:
        wrong_summary = [
            {"topic": q.get("topic"), "difficulty": q.get("difficulty"), "question": _safe(q.get("question", ""), 80)}
            for q in wrong_questions[:5]
        ]
        dynamic_parts.append(f"Câu sai ({len(wrong_questions)} câu, ví dụ): {json.dumps(wrong_summary, ensure_ascii=False)}")

    # Add grade + province context for personalized school recommendation
    if grade:
        dynamic_parts.append(f"Lớp học sinh: {grade}")
    if province:
        dynamic_parts.append(f"Tỉnh/thành phố: {province}")

    # AI always generates school suggestions based on grade
    school_json_field = ""
    if grade and grade.isdigit():
        loc_note = f" tại {province}" if province else ""
        if int(grade) <= 9:
            dynamic_parts.append(
                f"Học sinh đang ôn thi vào lớp 10{loc_note}. "
                "Hãy gợi ý 3-4 trường THPT phù hợp với điểm Toán này, "
                "kèm điểm chuẩn tuyển sinh lớp 10 mới nhất (ưu tiên 2025-2026)."
            )
            school_insight_hint = (
                "Gợi ý 3-4 trường THPT phù hợp kèm điểm chuẩn môn Toán kỳ tuyển sinh lớp 10 "
                "mới nhất (ưu tiên 2025-2026). Giải thích ngắn tại sao phù hợp."
            )
        else:
            dynamic_parts.append(
                f"Học sinh đang học lớp {grade}{loc_note}. "
                "Hãy gợi ý 3-4 trường đại học/cao đẳng phù hợp, "
                "kèm điểm chuẩn 2026 hoặc 2025 (xét tuyển học bạ hoặc điểm thi THPT Quốc gia)."
            )
            school_insight_hint = (
                "Gợi ý 3-4 trường đại học/cao đẳng phù hợp kèm điểm chuẩn 2026 "
                "(hoặc 2025 nếu chưa có 2026, ghi rõ). "
                "Phù hợp với điểm Toán và tỉnh thành của học sinh."
            )
        school_json_field = f',\n  "school_insight": "{school_insight_hint}"'

    prompt = "\n".join(dynamic_parts) + f"""

Trả về JSON (không có text ngoài JSON):
{{
  "insights": "Nhận xét tổng quan 2-3 câu về kết quả thi",
  "question_analysis": "Phân tích cụ thể các câu trả lời sai nếu có, chỉ ra điểm cần cải thiện (2-3 câu)",
  "weak_topics": ["topic_key1", "topic_key2"],
  "recommendations": ["khuyến nghị 1", "khuyến nghị 2", "khuyến nghị 3"]{school_json_field}
}}"""

    return prompt


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
    prompt = build_analyze_prompt(
        result, history, student_name,
        wrong_questions=wrong_questions,
        school_recommendations=school_recommendations,
        exam_category=exam_category,
        user_profile=user_profile,
    )
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
