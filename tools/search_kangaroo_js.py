"""Search the mathkangaroo.ca JS bundle for PDF URLs and data patterns."""
import urllib.request
import re
import ssl
import sys

ctx = ssl.create_default_context()
url = 'https://mathkangaroo.ca/static/js/main.bc9eed11.js'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36',
    'Referer': 'https://mathkangaroo.ca/',
}
req = urllib.request.Request(url, headers=headers)
js_bytes = urllib.request.urlopen(req, timeout=20, context=ctx).read()
js = js_bytes.decode('utf-8', errors='replace')
print(f'JS bundle size: {len(js):,} chars', flush=True)

# Look for https:// URLs (escape brackets manually)
https_re = re.compile(r'https://[A-Za-z0-9._/\-?=%&+#~:@,;]{10,100}')
hits = https_re.findall(js)
unique_urls = list(dict.fromkeys(hits))
print(f'\n=== https:// URLs found: {len(unique_urls)} ===')
for h in unique_urls:
    print(' ', h)

# Look for PDF
pdf_re = re.compile(r'[A-Za-z0-9._/\-]{3,80}[.]pdf', re.IGNORECASE)
pdf_hits = list(dict.fromkeys(pdf_re.findall(js)))
print(f'\n=== PDF refs: {len(pdf_hits)} ===')
for h in pdf_hits[:20]:
    print(' ', h)

# Look for 2023 context
y23_re = re.compile(r'.{30}2023.{30}')
y23_hits = y23_re.findall(js)
print(f'\n=== 2023 contexts: {len(y23_hits)} ===')
for h in y23_hits[:10]:
    print(' ', h)

# Look for /static/js/ chunks that might have more data
chunk_re = re.compile(r'[A-Za-z0-9._/\-]{5,60}[.]chunk[.]js')
chunk_hits = list(dict.fromkeys(chunk_re.findall(js)))
print(f'\n=== Chunk refs: {len(chunk_hits)} ===')
for h in chunk_hits[:10]:
    print(' ', h)

# Print first/last 500 chars of bundle
print(f'\n=== Bundle start ===')
print(js[:500])
print(f'\n=== Bundle end ===')
print(js[-500:])
