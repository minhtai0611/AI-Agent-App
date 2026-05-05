import re
from bs4 import BeautifulSoup, Tag

_MATH_KEYWORDS = frozenset({
    # core math
    "equation", "formula", "theorem", "proof", "solve", "function",
    "derivative", "integral", "probability", "matrix", "angle", "triangle",
    "polynomial", "prime", "modulo", "combination", "permutation",
    # statistics
    "distribution", "variance", "deviation", "regression", "hypothesis",
    "correlation", "confidence", "sample", "statistic", "population",
    "mean", "median", "interval", "p-value", "chi-square", "t-test",
    "anova", "normal", "binomial", "poisson", "inference", "estimat",
    # Vietnamese
    "phương trình", "định lý", "xác suất",
})

# table excluded: distribution tables, ANOVA tables, frequency tables carry real content
_STRIP_TAGS = ["script", "style", "nav", "header", "footer", "aside"]

# AoPS-specific navigation boilerplate — only applied when source == "aops"
_AOPS_BOILERPLATE_RE = re.compile(
    r"(Retrieved from|This article|AoPS Wiki|Art of Problem Solving"
    r"|Category\s*:|Navigation menu|Contents\s*\[|Jump to\s*(navigation|search)"
    r"|See also|External links|References\s*\[)",
    re.IGNORECASE,
)

# Generic web navigation boilerplate — applied to all sources
_GENERIC_BOILERPLATE_RE = re.compile(
    r"(Skip to (main )?content|Cookie (policy|notice)|Privacy policy"
    r"|Terms of (use|service)|All rights reserved|Breadcrumb"
    r"|Table of [Cc]ontents|Back to top|Share this page)",
    re.IGNORECASE,
)

# Asymptote diagram code blocks embedded in AoPS pages
_ASYMPTOTE_RE = re.compile(r"\[asy\].*?\[/asy\]", re.DOTALL | re.IGNORECASE)


def _replace_latex_imgs(soup: BeautifulSoup) -> None:
    """Replace <img> tags whose src contains 'latex' with their alt text (the LaTeX source)."""
    for img in soup.find_all("img", src=True):
        src = img.get("src", "")
        if "latex" in src:
            alt = img.get("alt", "").strip()
            if alt:
                img.replace_with(f" {alt} ")
            else:
                img.decompose()


def is_math_relevant(chunk: str) -> bool:
    lower = chunk.lower()
    return any(kw in lower for kw in _MATH_KEYWORDS)


def html_to_chunks(html: str, chunk_size: int = 3000, source: str = "generic") -> list[str]:
    """Strip HTML, recover LaTeX from img alt text, filter boilerplate, return quality chunks."""
    soup = BeautifulSoup(html, "html.parser")

    _replace_latex_imgs(soup)

    for tag in _STRIP_TAGS:
        for el in soup.find_all(tag):
            el.decompose()

    text = soup.get_text(separator="\n")
    if source == "aops":
        text = _ASYMPTOTE_RE.sub("", text)

    paragraphs = text.split("\n\n")
    cleaned: list[str] = []
    for para in paragraphs:
        if _GENERIC_BOILERPLATE_RE.search(para):
            continue
        if source == "aops" and _AOPS_BOILERPLATE_RE.search(para):
            continue
        stripped = para.strip()
        if len(stripped) >= 80:
            cleaned.append(stripped)

    chunks: list[str] = []
    current_parts: list[str] = []
    current_len = 0

    for para in cleaned:
        if current_len + len(para) + 2 > chunk_size and current_parts:
            chunks.append("\n\n".join(current_parts))
            current_parts = []
            current_len = 0
        current_parts.append(para)
        current_len += len(para) + 2

    if current_parts:
        chunks.append("\n\n".join(current_parts))

    return [c for c in chunks if is_math_relevant(c)]
