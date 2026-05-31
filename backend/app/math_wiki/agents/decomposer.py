"""Multi-domain query decomposer.

Detects when a problem spans two THPT math topics and splits it into
focused sub-questions for independent retrieval.
Returns quickly (Haiku) and is non-fatal — callers catch all exceptions.
"""
import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import DecomposedQuery

logger = logging.getLogger(__name__)

_PROMPT = """You are a math problem domain analyzer for Vietnamese high school (THPT) exams.

Given a math problem, identify whether it GENUINELY requires knowledge from two distinct THPT topics.
Output ONLY a JSON object with this exact schema:

{
  "primary_topic": "algebra",
  "secondary_topics": ["calculus"],
  "sub_questions": ["Find f'(x)", "Solve f'(x)=0"],
  "requires_multi_domain": true
}

THPT topics: algebra, calculus, geometry, trigonometry, combinatorics, probability, statistics, logarithm, functions, spatial_geometry

Rules:
- requires_multi_domain = true ONLY when the problem CANNOT be solved using knowledge from a single topic.
- sub_questions: 2-3 focused sub-questions that decompose the problem by topic.
- If the problem is single-topic, set requires_multi_domain=false and sub_questions=[].
- Output ONLY valid JSON. No prose, no markdown."""


async def decompose_query(client: AsyncOpenAI, question: str) -> DecomposedQuery:
    settings = get_settings()
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        messages=[
            {"role": "system", "content": _PROMPT},
            {"role": "user", "content": question},
        ],
        max_tokens=256,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return DecomposedQuery(
            primary_topic="algebra", secondary_topics=[],
            sub_questions=[], requires_multi_domain=False,
        )

    return DecomposedQuery(
        primary_topic=parsed.get("primary_topic", "algebra"),
        secondary_topics=parsed.get("secondary_topics", []),
        sub_questions=parsed.get("sub_questions", []),
        requires_multi_domain=bool(parsed.get("requires_multi_domain", False)),
    )
