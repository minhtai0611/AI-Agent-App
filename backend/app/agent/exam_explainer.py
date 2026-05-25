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

STATIC_EXPLAIN_INSTRUCTIONS = """Bạn là gia sư toán học chuyên ôn thi lớp 10 TPHCM. \
Phân tích câu hỏi trắc nghiệm, xác định đáp án đúng bằng lập luận toán học, rồi giải thích ngắn gọn. \
Trả lời bằng tiếng Việt."""

LABELS = ["A", "B", "C", "D"]


import re

def _extract_json(text: str) -> str:
    """Return the first {...} block found anywhere in the text."""
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    # Fallback: strip code fences and return
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


_EXPLANATION_DEPTH_INSTRUCTIONS = {
    "brief": "Giải thích ngắn gọn — chỉ 2-3 câu nêu bật ý chính.",
    "detailed": "Giải thích đầy đủ, chi tiết để học sinh hiểu rõ.",
    "step-by-step": "Trình bày giải thích theo các bước đánh số. Mỗi bước trên một dòng riêng.",
}


async def generate_explanation(
    client: AsyncOpenAI,
    question: dict,
    chosen_index: int,
    ai_preferences: dict | None = None,
) -> dict:
    settings = get_settings()

    explanation_depth = (ai_preferences or {}).get("explanation_depth", "detailed")
    depth_instruction = _EXPLANATION_DEPTH_INSTRUCTIONS.get(explanation_depth, _EXPLANATION_DEPTH_INSTRUCTIONS["detailed"])
    choices = question.get("choices", [])

    # Ground truth from question data — never let AI guess the correct answer
    correct_index = int(question.get("correct", 0))
    correct_index = max(0, min(correct_index, len(choices) - 1))
    base_explanation = question.get("explanation", "")

    chosen_label = LABELS[chosen_index] if chosen_index < len(LABELS) else str(chosen_index)
    correct_label = LABELS[correct_index] if correct_index < len(LABELS) else str(correct_index)

    choices_text = "\n".join(
        f"  {LABELS[i]}. {c}" for i, c in enumerate(choices) if i < len(LABELS)
    )

    # If the question already has an explanation, use it directly without an AI call
    if base_explanation:
        student_context = (
            f"Bạn đã chọn đúng ({correct_label})! " if chosen_index == correct_index
            else f"Bạn chọn {chosen_label}, đáp án đúng là {correct_label}. "
        )
        return {
            "correct_index": correct_index,
            "explanation": student_context + base_explanation,
        }

    # No pre-written explanation — ask AI to explain, but correct_index is already known
    prompt = f"""Câu hỏi trắc nghiệm toán lớp 10:
{question.get('question', '')}

Các lựa chọn:
{choices_text}

Chủ đề: {question.get('topic', '')} | Mức độ: {question.get('difficulty', '')}
Học sinh đã chọn: {chosen_label}
Đáp án đúng: {correct_label} (index {correct_index}) — đây là sự thật, không được thay đổi.

QUAN TRỌNG: Chỉ trả về JSON, không có bất kỳ văn bản nào khác trước hoặc sau.
Giải thích ngắn gọn tại sao đáp án {correct_label} đúng:
{{"correct_index": {correct_index}, "explanation": "<2–3 câu tiếng Việt giải thích, không dùng markdown>"}}"""

    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        max_tokens=400,
        messages=[
            {"role": "system", "content": THPT_CONTEXT + STATIC_EXPLAIN_INSTRUCTIONS + "\n" + depth_instruction},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content or ""
    content = _extract_json(raw)
    try:
        data = json.loads(content)
        # Always use ground-truth correct_index regardless of what AI returns
        data["correct_index"] = correct_index
        return data
    except (json.JSONDecodeError, ValueError):
        return {"correct_index": correct_index, "explanation": raw.strip()}
