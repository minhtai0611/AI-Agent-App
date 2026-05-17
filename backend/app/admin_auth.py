import hmac
import hashlib
import datetime


def get_window_label(period: str, offset: int = 0) -> str:
    today = datetime.date.today()
    if period == "daily":
        return (today - datetime.timedelta(days=offset)).strftime("%Y-%m-%d")
    elif period == "weekly":
        return (today - datetime.timedelta(weeks=offset)).strftime("%Y-W%W")
    elif period == "monthly":
        year, month = today.year, today.month
        month -= offset
        while month <= 0:
            month += 12
            year -= 1
        return f"{year}-{month:02d}"
    elif period == "quarterly":
        q = ((today.month - 1) // 3) + 1
        year = today.year
        q -= offset
        while q <= 0:
            q += 4
            year -= 1
        return f"{year}-Q{q}"
    elif period == "annual":
        return str(today.year - offset)
    return (today - datetime.timedelta(weeks=offset)).strftime("%Y-W%W")


def get_expiry_date(period: str) -> str:
    today = datetime.date.today()
    if period == "daily":
        return (today + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    elif period == "weekly":
        days_until_next = (7 - today.weekday()) % 7 or 7
        return (today + datetime.timedelta(days=days_until_next)).strftime("%Y-%m-%d")
    elif period == "monthly":
        if today.month == 12:
            return f"{today.year + 1}-01-01"
        return f"{today.year}-{today.month + 1:02d}-01"
    elif period == "quarterly":
        q = ((today.month - 1) // 3) + 1
        next_q_month = q * 3 + 1
        if next_q_month > 12:
            return f"{today.year + 1}-01-01"
        return f"{today.year}-{next_q_month:02d}-01"
    elif period == "annual":
        return f"{today.year + 1}-01-01"
    days_until_next = (7 - today.weekday()) % 7 or 7
    return (today + datetime.timedelta(days=days_until_next)).strftime("%Y-%m-%d")


def derive_key(master: str, label: str) -> str:
    return hmac.new(master.encode(), label.encode(), hashlib.sha256).hexdigest()


def validate_admin_key(provided: str, master: str, period: str) -> bool:
    if not master or not provided:
        return False
    current = derive_key(master, get_window_label(period, offset=0))
    previous = derive_key(master, get_window_label(period, offset=1))
    return (
        hmac.compare_digest(provided.encode(), current.encode()) or
        hmac.compare_digest(provided.encode(), previous.encode())
    )
