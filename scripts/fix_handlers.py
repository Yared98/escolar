import os
import re

handlers_dir = r"d:\Projetos\escolar\backend\src\handlers"
files = [os.path.join(handlers_dir, f) for f in os.listdir(handlers_dir) if f.endswith(".rs")]

for filepath in files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # Restaura assinatura
    content = content.replace("TenantDb(mut db): TenantDb", "State(state): State<AppState>")
    
    # Restaura state.pool
    content = content.replace("&mut *db.0", "&state.pool")
    content = content.replace("db.0.begin()", "state.pool.begin()")
    
    # Adiciona TenantDb(mut db): TenantDb mantendo o State(state)
    # Procurar por "State(state): State<AppState>" e adicionar "TenantDb(mut db): TenantDb" LOGO DEPOIS.
    content = re.sub(r"State\s*\(\s*state\s*\)\s*:\s*State\s*<\s*AppState\s*>", "State(state): State<AppState>, TenantDb(mut db): TenantDb", content)
    
    # E refaz a troca do state.pool para db.0 (pois no passo anterior restauramos)
    content = content.replace("&state.pool", "&mut *db.0")
    content = content.replace("state.pool.begin()", "db.0.begin()")
    
    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {filepath}")
