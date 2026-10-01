import os
import re

handlers_dir = r"d:\Projetos\escolar\backend\src\handlers"
files = [os.path.join(handlers_dir, f) for f in os.listdir(handlers_dir) if f.endswith(".rs")]

for filepath in files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # Replace &mut *db.0 with &mut *db
    content = content.replace("&mut *db.0", "&mut *db")
    content = content.replace("db.0.begin()", "db.begin()")
    
    # Wait, some places were `&mut *db.0.0` or something? No, just `&mut *db.0`.
    
    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed db.0 in {filepath}")
