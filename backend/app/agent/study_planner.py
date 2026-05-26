import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_STUDY_PLAN_INSTRUCTIONS = """Bạn là giáo viên Toán lớp 9 chuyên ôn thi vào lớp 10 TPHCM.
Nhiệm vụ: nhìn vào từng câu sai cụ thể của học sinh, xác định đúng lỗ hổng kiến thức đằng sau mỗi câu sai, rồi lập kế hoạch 4 tuần nhắm trực tiếp vào các lỗ hổng đó.

Nguyên tắc bắt buộc:
- Không nói chung chung ("ôn lại tổ hợp", "luyện đại số"). Phải nêu đúng kỹ thuật còn thiếu ("luyện quy tắc đếm bù trong hoán vị có điều kiện", "ôn phân tích nghiệm bằng delta với tham số m").
- Mỗi nhiệm vụ trong tuần phải liên hệ trực tiếp đến loại bài mà học sinh đã sai — không thêm nội dung ngoài phạm vi các câu sai đã cho.
- Ưu tiên các lỗ hổng xuất hiện nhiều lần hoặc thuộc câu khó.
- Viết nhiệm vụ như hướng dẫn cụ thể cho học sinh, không phải nhận xét chung.
- LATEX BẮT BUỘC: Mọi ký hiệu toán học trong "tasks" và "focus" PHẢI được bọc trong $...$. Ví dụ: $x_1+x_2=-b/a$, $\Delta>0$, $x_1^2+x_2^2$, $|x_1-x_2|$. Không được viết ký hiệu toán dưới dạng plain text (x1+x2, delta, x^2).
Trả lời bằng tiếng Việt. Luôn trả về JSON hợp lệ, không có text ngoài JSON."""


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
    wrong_questions: list[dict] | None = None,
    topic_miss_counts: dict | None = None,
    student_name: str = "",
    learner_archetype: str | None = None,
) -> dict:
    settings = get_settings()

    lines = []
    if student_name:
        lines.append(f"Học sinh: {student_name}")
    lines.append(f"Điểm: {result.get('score', 0)}/10 ({round(result.get('accuracy', 0) * 100)}% đúng)")
    lines.append(f"Số đề đã thi: {len(history)}")
    if learner_archetype:
        lines.append(f"Learner type: {learner_archetype}")

    if wrong_questions:
        # Full miss picture per topic
        if topic_miss_counts:
            summary = ", ".join(f"{t}: {c} câu sai" for t, c in topic_miss_counts.items())
            lines.append(f"Tổng hợp câu sai theo chủ đề: {summary}")

        lines.append(
            f"\nCâu sai đại diện ({len(wrong_questions)} câu — được chọn từ các câu khó nhất mỗi chủ đề):"
        )
        for i, wq in enumerate(wrong_questions, 1):
            topic = wq.get("topic", "")
            diff = wq.get("difficulty", "")
            q_text = wq.get("question", "")[:130]
            correct = wq.get("correct_answer", "")
            expl = wq.get("explanation", "")[:100]
            lines.append(f"\nCâu {i} [{topic} / {diff}]: {q_text}")
            lines.append(f"  Đáp án đúng: {correct}")
            if expl:
                lines.append(f"  Vì sao: {expl}")

        lines.append(
            "\nDựa vào từng câu sai trên: (1) xác định đúng lỗ hổng kiến thức cụ thể (không phải tên chủ đề chung), "
            "(2) lập kế hoạch 4 tuần, mỗi tuần tập trung vào một nhóm lỗ hổng liên quan, "
            "(3) viết nhiệm vụ cụ thể — tên kỹ thuật, dạng bài, số bài luyện."
        )
    else:
        topic_breakdown = result.get("topicBreakdown", {})
        weak = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]
        lines.append(f"Chủ đề yếu: {', '.join(weak) or 'Không có'}")
        lines.append("\nTạo kế hoạch học tập 4 tuần dựa trên thông tin trên.")

    prompt = "\n".join(lines) + """

Trả về JSON (không có text ngoài JSON):
{
  "plan": "Tổng quan ngắn gọn: các lỗ hổng chính cần bù và lộ trình 4 tuần (markdown, 4-6 dòng)",
  "weekly_schedule": [
    {"week": 1, "focus": "Tên nhóm lỗ hổng cụ thể tuần này", "tasks": ["Nhiệm vụ cụ thể 1", "Nhiệm vụ cụ thể 2", "Nhiệm vụ cụ thể 3"]}
  ]
}"""

    try:
        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=2000,
            messages=[
                {"role": "system", "content": STATIC_STUDY_PLAN_INSTRUCTIONS},
                {"role": "user", "content": prompt},
            ],
        )
        content = _strip_code_fence(response.choices[0].message.content or "{}")
        return json.loads(content)
    except Exception:
        return {
            "plan": "## Kế hoạch học tập\n- Ôn tập đều đặn mỗi ngày\n- Làm đề thử thường xuyên\n- Xem giải thích sau mỗi bài",
            "weekly_schedule": [
                {"week": 1, "focus": "Ôn tập kiến thức cơ bản", "tasks": ["Xem lại lý thuyết từng chủ đề", "Làm bài tập cơ bản", "Ghi chú các công thức quan trọng"]},
                {"week": 2, "focus": "Luyện tập dạng bài", "tasks": ["Làm đề thử theo chủ đề yếu", "Xem giải thích chi tiết", "Tổng kết lỗi sai"]},
                {"week": 3, "focus": "Ôn tập tổng hợp", "tasks": ["Làm đề thi tổng hợp", "Phân tích và sửa lỗi", "Ôn lại các chủ đề còn yếu"]},
                {"week": 4, "focus": "Thi thử và đánh giá", "tasks": ["Thi thử toàn phần có tính giờ", "Rà soát điểm yếu còn lại", "Ôn tập nhẹ trước ngày thi"]},
            ],
        }
