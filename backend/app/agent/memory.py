import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry


async def compress_conversation(
    client: AsyncOpenAI,
    messages: list[dict],
) -> str:
    settings = get_settings()
    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content'] if isinstance(m['content'], str) else json.dumps(m['content'], ensure_ascii=False)}"
        for m in messages
        if m["role"] != "system"
    )
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        max_tokens=512,
        messages=[
            {
                "role": "system",
                "content": "Tóm tắt ngắn gọn cuộc hội thoại dưới đây, giữ lại các thông tin quan trọng về yêu cầu và sản phẩm của khách.",
            },
            {"role": "user", "content": history_text},
        ],
    )
    return response.choices[0].message.content or ""
