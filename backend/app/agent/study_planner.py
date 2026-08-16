import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry, extract_json
from app.agent.exam_analyzer import _PROVINCE_DATA

STATIC_RECOVERY_PATH_INSTRUCTIONS = """Bạn là huấn luyện viên thi Toán lớp 9 vào lớp 10.
Nhiệm vụ: nhìn vào điểm thi và từng câu sai cụ thể, xác định 1–2 lỗ hổng kiến thức quan trọng nhất, rồi tạo Recovery Path ngắn hạn (2–3 tuần) nhắm trực tiếp vào các lỗ hổng đó.

Nguyên tắc bắt buộc:
- score_gap: nêu khoảng cách điểm cụ thể và trường mục tiêu (nếu có). Không nói chung chung.
- focus_areas: tối đa 2 chủ đề. Ưu tiên chủ đề sai nhiều nhất hoặc ảnh hưởng điểm nhất.
- error_pattern: nêu đúng lỗi kỹ thuật cụ thể (không phải tên chủ đề). Ví dụ: "Sai ở bước xác định miền xác định logarit — xuất hiện 4/5 lần".
- tasks: 2–3 nhiệm vụ luyện tập cụ thể, liên hệ trực tiếp đến lỗi đã xác định.
- checkpoint: số câu cần trả lời đúng liên tiếp để coi là nắm vững (target: 3–5).
- LATEX BẮT BUỘC: mọi ký hiệu toán học trong tasks/error_pattern PHẢI bọc trong $...$. Ví dụ: $\\Delta > 0$, $\\log_a x$, $x^2 - 5x + 6 = 0$.
Trả lời bằng tiếng Việt. Luôn trả về JSON hợp lệ, không có text ngoài JSON."""


async def generate_study_plan(
    client: AsyncOpenAI,
    result: dict,
    history: list[dict],
    wrong_questions: list[dict] | None = None,
    topic_miss_counts: dict | None = None,
    student_name: str = "",
    learner_archetype: str | None = None,
    province: str = "",
) -> dict:
    settings = get_settings()

    lines = []
    if student_name:
        lines.append(f"Học sinh: {student_name}")
    lines.append(f"Điểm: {result.get('score', 0)}/10 ({round(result.get('accuracy', 0) * 100)}% đúng)")
    lines.append(f"Số đề đã thi: {len(history)}")
    if province and province in _PROVINCE_DATA:
        p = _PROVINCE_DATA[province]
        lines.append(
            f"Tỉnh: {province} | Mức điểm an toàn: {p['typical_cutoff']} | "
            f"Trường tốt yêu cầu: {p['top_schools_cutoff']}+ | "
            f"Dùng các ngưỡng này để xác định khoảng cách điểm (score_gap) cụ thể cho học sinh."
        )
        if p.get("topic_weights"):
            top_topics = sorted(p["topic_weights"].items(), key=lambda x: -x[1])[:5]
            weights_str = ", ".join(f"{t} ({w}%)" for t, w in top_topics)
            lines.append(
                f"Phân bố chủ đề đề thi {province} (5 chủ đề chiếm tỷ trọng cao nhất): {weights_str}. "
                f"Ưu tiên chọn focus_areas từ các chủ đề này vì chúng xuất hiện nhiều nhất trong đề thi tỉnh."
            )
    elif province:
        lines.append(f"Tỉnh: {province}")

    if wrong_questions:
        if topic_miss_counts:
            summary = ", ".join(f"{t}: {c} câu sai" for t, c in topic_miss_counts.items())
            lines.append(f"Tổng hợp câu sai theo chủ đề: {summary}")

        lines.append(
            f"\nCâu sai đại diện ({len(wrong_questions)} câu — câu khó nhất mỗi chủ đề):"
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
    else:
        topic_breakdown = result.get("topicBreakdown", {})
        weak = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]
        lines.append(f"Chủ đề yếu: {', '.join(weak) or 'Không có'}")

    prompt = "\n".join(lines) + """

Tạo Recovery Path dựa trên dữ liệu trên.
Trả về JSON (không có text ngoài JSON):
{
  "score_gap": "Mô tả khoảng cách điểm và mục tiêu cụ thể (1–2 câu)",
  "focus_areas": [
    {
      "topic": "Tên chủ đề",
      "error_pattern": "Mô tả lỗi kỹ thuật cụ thể",
      "tasks": ["Nhiệm vụ luyện tập cụ thể 1", "Nhiệm vụ 2"],
      "checkpoint": {"target": 5, "description": "Trả lời đúng 5 câu [chủ đề] liên tiếp"}
    }
  ],
  "retake_note": "Sau khi hoàn thành Focus 1 → Thử lại đề thi để so sánh điểm"
}"""

    try:
        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=1200,
            messages=[
                {"role": "system", "content": STATIC_RECOVERY_PATH_INSTRUCTIONS},
                {"role": "user", "content": prompt},
            ],
        )
        content = extract_json(response.choices[0].message.content or "{}")
        return json.loads(content)
    except Exception:
        return {
            "score_gap": "Phân tích cho thấy còn một số lỗ hổng cần bù. Tiếp tục ôn tập và thử lại đề thi.",
            "focus_areas": [
                {
                    "topic": "Ôn tập tổng quát",
                    "error_pattern": "Xem lại tất cả câu sai và tìm điểm chung.",
                    "tasks": [
                        "Lập danh sách từng câu sai: ghi rõ dạng bài, bước sai, công thức cần nắm — tra lại định nghĩa/định lý liên quan.",
                        "Làm lại 5–8 câu cùng dạng (từ đề thi năm trước), viết đầy đủ các bước trung gian không bỏ qua.",
                    ],
                    "checkpoint": {
                        "target": 3,
                        "description": "Trả lời đúng 3 câu liên tiếp trước khi sang chủ đề tiếp theo",
                    },
                }
            ],
            "retake_note": "Sau khi luyện xong → Thử lại đề thi để so sánh điểm",
        }
