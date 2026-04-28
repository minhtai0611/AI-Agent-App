from bs4 import BeautifulSoup

_MATH_KEYWORDS = frozenset({
    "equation", "formula", "theorem", "proof", "solve", "function",
    "derivative", "integral", "probability", "matrix", "angle", "triangle",
    "polynomial", "prime", "modulo", "combination", "permutation",
    "phương trình", "định lý", "xác suất",
})

_STRIP_TAGS = ["script", "style", "nav", "header", "footer", "aside"]


def is_math_relevant(chunk: str) -> bool:
    lower = chunk.lower()
    return any(kw in lower for kw in _MATH_KEYWORDS)


def html_to_chunks(html: str, chunk_size: int = 3000) -> list[str]:
    """Strip HTML, apply both gates, return quality-filtered chunks."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in _STRIP_TAGS:
        for el in soup.find_all(tag):
            el.decompose()

    text = soup.get_text(separator="\n")
    paragraphs = [p.strip() for p in text.split("\n\n")]

    # Gate 1: length filter
    paragraphs = [p for p in paragraphs if len(p) >= 80]

    # Accumulate into chunks <= chunk_size
    chunks: list[str] = []
    current_parts: list[str] = []
    current_len = 0

    for para in paragraphs:
        if current_len + len(para) + 2 > chunk_size and current_parts:
            chunks.append("\n\n".join(current_parts))
            current_parts = []
            current_len = 0
        current_parts.append(para)
        current_len += len(para) + 2

    if current_parts:
        chunks.append("\n\n".join(current_parts))

    # Gate 2: math relevance
    return [c for c in chunks if is_math_relevant(c)]
