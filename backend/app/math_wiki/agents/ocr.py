import base64
from openai import AsyncOpenAI
from app.config import get_settings

_SYSTEM_PROMPT = (
    "You are a Vietnamese math OCR assistant. Extract all text, mathematical content, and visual elements from the image.\n"
    "Rules:\n"
    "- Preserve all LaTeX notation exactly; wrap inline math in $...$  and display math in $$...$$\n"
    "- Keep Vietnamese text exactly as written\n"
    "- List each numbered problem separately\n"
    "- Do not solve or explain — only transcribe or describe what is visible\n"
    "- If a symbol is unclear, use your best judgment\n"
    "Visual elements — when the image contains shapes, graphs, or drawings that cannot be expressed as plain text:\n"
    "- Geometric figures: describe the shape (triangle, circle, quadrilateral…), label each vertex/point as shown,"
    " list all given side lengths, angles, and any marked equal/parallel/perpendicular relationships."
    " Example: 'Tam giác ABC vuông tại A, AB = 3, BC = 5, AC = 4'\n"
    "- Coordinate graphs / function plots: state axis labels and scale, identify key points (intercepts, maxima,"
    " minima, intersection points) with their coordinates, describe the curve type (line, parabola, circle…)."
    " Example: 'Đồ thị hàm số y = f(x) qua các điểm (0, 2) và (3, 0), là đường thẳng giảm dần'\n"
    "- Hand-drawn or complex diagrams: give a concise prose description of every element, dimension, and label"
    " that appears, sufficient for a solver to reconstruct the problem without seeing the image\n"
    "- Place visual descriptions inline, immediately after the problem text they accompany"
)


async def extract_math_from_image(
    client: AsyncOpenAI, image_bytes: bytes, mime_type: str
) -> str:
    settings = get_settings()
    data_uri = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"

    response = await client.chat.completions.create(
        model=settings.default_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_uri}},
                    {"type": "text", "text": "Trích xuất toàn bộ nội dung toán học từ hình ảnh này."},
                ],
            },
        ],
        max_tokens=4096,
    )

    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise ValueError("Claude Vision returned empty response")
    return text
