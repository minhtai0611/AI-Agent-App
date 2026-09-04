import os
import re

files = os.listdir("chunks")
modals_found = {}

for fname in sorted(files):
    if not fname.endswith(".js"): 
        continue
    with open(os.path.join("chunks", fname), "r", encoding="utf-8") as f:
        content = f.read()
    
    # Search for overlays / modals
    matches = []
    for m in re.finditer(r'fixed\s+inset-0|fixed\s+bottom-0|role="dialog"|modal|drawer|popup|AlertDialog', content, re.IGNORECASE):
        start = max(0, m.start() - 120)
        end = min(len(content), m.end() + 200)
        matches.append((m.group(0), content[start:end]))
    
    if matches:
        modals_found[fname] = matches

print("Files with overlays/modals:", len(modals_found))
for k, v in modals_found.items():
    print(f"\n==================== {k} ({len(v)} matches) ====================")
    for tag, snip in v[:5]:
        print(f"[{tag}] => {snip.strip()}\n")
