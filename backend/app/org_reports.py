"""Institutions Phase 2 — branded PDF result reports/certificates.

Server-side generation (Jinja2 -> WeasyPrint) so reports are auditable and
fetchable via API/webhook, not just an interactive client-side download.
WeasyPrint needs system Cairo/Pango libraries — not a pure-pip install, so this
module lazy-imports it and raises a typed error (-> 503) if it's unavailable,
same pattern as OrgAuthNotConfiguredError/RouterNotConfiguredError.
"""
from jinja2 import Template

_TEMPLATE = Template(
    """<html><body style="font-family: sans-serif;">
    <h1>{{ org_name }}</h1>
    <h2>Exam result report</h2>
    <p>Member: {{ member_email }}</p>
    <p>Exam: {{ exam_id }}</p>
    <p>Score: {{ score }}</p>
    <p>Submitted: {{ submitted_at }}</p>
    </body></html>"""
)


class PdfReportsUnavailableError(RuntimeError):
    """Raised when WeasyPrint's system dependencies (Cairo/Pango) aren't installed."""


def render_attempt_pdf(org: dict, member_email: str, attempt: dict) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        raise PdfReportsUnavailableError(f"WeasyPrint unavailable: {exc}") from exc

    html = _TEMPLATE.render(
        org_name=org.get("name"), member_email=member_email,
        exam_id=attempt.get("exam_id"), score=attempt.get("score"),
        submitted_at=attempt.get("submitted_at"),
    )
    return HTML(string=html).write_pdf()
