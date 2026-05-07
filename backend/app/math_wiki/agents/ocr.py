import base64
from openai import AsyncOpenAI
from app.config import get_settings

_SYSTEM_PROMPT = (
    "You are a Vietnamese math OCR assistant. Extract all text and mathematical content from the image.\n"
    "Rules:\n"
    "- Preserve all LaTeX notation exactly; wrap inline math in $...$  and display math in $$...$$\n"
    "- Keep Vietnamese text exactly as written\n"
    "- List each numbered problem separately\n"
    "- Do not solve or explain — only transcribe what is visible\n"
    "- If a symbol is unclear, use your best judgment"
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
