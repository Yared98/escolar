import os
import re

handlers_dir = r"d:\Projetos\escolar\backend\src\handlers"
files = [os.path.join(handlers_dir, f) for f in os.listdir(handlers_dir) if f.endswith(".rs")]

for filepath in files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # We need to find functions that have Extension(active_tenant): Extension<ActiveTenant>
    # and State(state): State<AppState>
    
    # Simple check: Does the file have Extension<ActiveTenant>?
    if "Extension<ActiveTenant>" not in content:
        continue
        
    print(f"Processing {filepath}...")
    
    # We will use regex to find handler functions and inject the transaction logic.
    # But wait, python script might be too brittle. Is there a better way?
    
