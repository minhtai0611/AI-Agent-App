import json
from openai import AsyncOpenAI, APIConnectionError, RateLimitError, APIStatusError
from tenacity import retry, stop_after_attempt, wait_exponential
from app.config import get_settings
from app.tools.registry import ALL_TOOLS, handle_tool_call

STATIC_BASE_INSTRUCTIONS = """Bạn là trợ lý tư vấn bán hàng cửa nhôm kính chuyên nghiệp.
Nhiệm vụ của bạn là tư vấn sản phẩm, báo giá ước tính, và giải đáp thắc mắc của khách hàng.
Luôn thân thiện, chính xác, và hữu ích. Trả lời bằng tiếng Việt."""

STATIC_PRODUCT_CATALOG = """## Danh mục sản phẩm
- Cửa nhôm Xingfa: cao cấp, bền, chống oxy hóa
- Cửa kính cường lực: an toàn, thẩm mỹ, hiện đại
- Cửa nhôm thông thường: tiết kiệm, phổ thông
- Cửa kính thông thường: nhẹ, trong suốt"""


def build_system_prompt(customer_name: str = "", funnel_stage: str = "") -> str:
    dynamic = ""
    if customer_name or funnel_stage:
        dynamic = f"\n## Thông tin khách hàng (dynamic)\n"
        if customer_name:
            dynamic += f"Tên: {customer_name}\n"
        if funnel_stage:
            dynamic += f"Giai đoạn: {funnel_stage}\n"
    return f"{STATIC_BASE_INSTRUCTIONS}\n\n{STATIC_PRODUCT_CATALOG}{dynamic}"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def call_with_retry(client: AsyncOpenAI, **kwargs):
    return await client.chat.completions.create(**kwargs)


async def run_agent(
    client: AsyncOpenAI,
    messages: list[dict],
    customer_name: str = "",
    funnel_stage: str = "",
) -> tuple[str, list[dict]]:
    settings = get_settings()

    full_messages = [
        {"role": "system", "content": build_system_prompt(customer_name, funnel_stage)},
        *messages,
    ]

    try:
        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=2048,
            messages=full_messages,
            tools=ALL_TOOLS,
        )
    except RateLimitError:
        return "Hệ thống đang bận, vui lòng thử lại sau.", messages
    except APIConnectionError:
        return "Không thể kết nối đến AI service.", messages
    except APIStatusError as e:
        return f"Lỗi hệ thống: {e.status_code}", messages

    choice = response.choices[0]

    # Tool call loop
    while choice.finish_reason == "tool_calls":
        tool_calls = choice.message.tool_calls
        assistant_msg = {
            "role": "assistant",
            "content": choice.message.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in tool_calls
            ],
        }
        full_messages.append(assistant_msg)

        for tc in tool_calls:
            args = json.loads(tc.function.arguments)
            result = handle_tool_call(tc.function.name, args)
            full_messages.append(
                {"role": "tool", "tool_call_id": tc.id, "content": result}
            )

        response = await call_with_retry(
            client,
            model=settings.default_model,
            max_tokens=2048,
            messages=full_messages,
            tools=ALL_TOOLS,
        )
        choice = response.choices[0]

    reply = choice.message.content or ""
    updated_messages = messages + [
        {"role": "assistant", "content": reply}
    ]
    return reply, updated_messages
