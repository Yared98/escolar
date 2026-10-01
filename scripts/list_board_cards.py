import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)

for l in data.get('lists', []):
    print(f"=== {l.get('name')} ({l.get('publicId')}) - Total: {len(l.get('cards', []))} ===")
    for c in l.get('cards', []):
        print(f"  [{c.get('publicId')}] {c.get('title')}")
