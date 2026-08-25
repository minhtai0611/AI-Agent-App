"""Institutions Phase 3 — plain-language cohort report narration.

Near-total reuse of AiRouterClient: requests a JSON envelope ({"narrative": "..."})
rather than adding a new non-JSON completion method, so router_client.py stays
untouched.
"""
import json
from pathlib import Path

from app.agent.router_client import AiRouterClient

_PROMPT_PATH = Path(__file__).parent / "prompts" / "narrate_cohort_report.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")


async def narrate_cohort_summary(client: AiRouterClient, cohort_stats: dict, at_risk_signals: list[dict]) -> str:
    user_prompt = json.dumps({"cohort_stats": cohort_stats, "at_risk_signals": at_risk_signals}, ensure_ascii=False)
    result = await client.complete_json(_SYSTEM_PROMPT, user_prompt)
    return result.get("narrative", "")
