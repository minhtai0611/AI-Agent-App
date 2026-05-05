"""HTTP client for POST /math-ingest with retry + exponential backoff."""
import time
import urllib.request
import urllib.error
import json


def ingest_chunk(text: str, backend_url: str) -> dict:
    url = f"{backend_url.rstrip('/')}/math-ingest"
    payload = json.dumps({"text": text}).encode()
    delay = 1.0
    for attempt in range(1, 4):
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read())
                print(f"  → {len(text)} chars → {body['problems']} problems, {body['wiki_units']} wiki_units")
                return body
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500:
                raise RuntimeError(f"4xx {e.code}: {e.read().decode()}") from e
            print(f"  [attempt {attempt}/3] {e.code} — retrying in {delay:.0f}s")
        except (urllib.error.URLError, OSError) as e:
            print(f"  [attempt {attempt}/3] connection error: {e} — retrying in {delay:.0f}s")
        time.sleep(delay)
        delay *= 2
    raise RuntimeError(f"Failed after 3 retries ({len(text)} chars)")
