import os

with open('backend/src/main.rs', 'r', encoding='utf-8') as f:
    content = f.read()

if "mod utils;" not in content:
    content = content.replace("mod routes;", "mod routes;\nmod utils;")
    
    with open('backend/src/main.rs', 'w', encoding='utf-8') as f:
        f.write(content)
