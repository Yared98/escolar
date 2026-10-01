import os
import re

handlers_dir = r"d:\Projetos\escolar\backend\src\handlers"
files = [os.path.join(handlers_dir, f) for f in os.listdir(handlers_dir) if f.endswith(".rs")]

for filepath in files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # Add TenantDb import
    if "TenantDb" not in content:
        if "crate::config::AppState" in content:
            content = content.replace("crate::config::AppState", "crate::{config::AppState, db::TenantDb}")
        elif "config::AppState" in content:
            content = content.replace("config::AppState", "config::AppState, db::TenantDb")
        else:
            content = "use crate::db::TenantDb;\n" + content

    # Replace Extractor in function signatures
    content = re.sub(r"State\s*\(\s*state\s*\)\s*:\s*State\s*<\s*AppState\s*>", "TenantDb(mut db): TenantDb", content)
    content = re.sub(r"State\s*\(\s*_state\s*\)\s*:\s*State\s*<\s*AppState\s*>", "TenantDb(mut db): TenantDb", content)

    # Some handlers might still need AppState if they use it for something other than pool, but right now AppState only has `pool`.
    # Replace usages
    content = content.replace("&state.pool", "&mut *db.0")
    content = content.replace("state.pool.begin()", "db.0.begin()")
    
    # Also, some handlers might do AppState passed as Extension or whatever, but usually it's State.

    if content != original_content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Refactored {filepath}")
