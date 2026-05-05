from typing import Any

PRICE_ESTIMATE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_price_estimate",
        "description": "Tính giá ước tính cho sản phẩm cửa nhôm kính",
        "parameters": {
            "type": "object",
            "properties": {
                "product_type": {
                    "type": "string",
                    "description": "Loại sản phẩm (e.g. cửa nhôm Xingfa, cửa kính cường lực)",
                },
                "width_m": {"type": "number", "description": "Chiều rộng (mét)"},
                "height_m": {"type": "number", "description": "Chiều cao (mét)"},
            },
            "required": ["product_type", "width_m", "height_m"],
        },
    },
}

ALL_TOOLS: list[dict[str, Any]] = [PRICE_ESTIMATE_TOOL]

# Price table (VND per m²) — update as needed
PRICE_TABLE: dict[str, float] = {
    "cửa nhôm xingfa": 1_800_000,
    "cửa kính cường lực": 2_500_000,
    "cửa nhôm": 1_500_000,
    "cửa kính": 2_000_000,
}


def handle_tool_call(name: str, arguments: dict[str, Any]) -> str:
    if name == "get_price_estimate":
        product = arguments["product_type"].lower()
        width = float(arguments["width_m"])
        height = float(arguments["height_m"])
        area = width * height

        unit_price = next(
            (v for k, v in PRICE_TABLE.items() if k in product),
            1_600_000,
        )
        total = area * unit_price
        return (
            f"Diện tích: {area:.2f} m². "
            f"Đơn giá: {unit_price:,.0f} VND/m². "
            f"Tổng ước tính: {total:,.0f} VND."
        )
    return "Không tìm thấy tool."
