import sys

def fix_db(filepath, func_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    start_idx = content.find(f"pub async fn {func_name}")
    if start_idx == -1:
        return

    brace_idx = content.find('{', start_idx)
    depth = 0
    end_idx = -1
    for i in range(brace_idx, len(content)):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                end_idx = i + 1
                break
    
    body = content[brace_idx:end_idx]
    
    body = body.replace("(&mut *db)", "&state.pool")
    body = body.replace("&mut *db", "&state.pool")
    body = body.replace("db.begin()", "state.pool.begin()")
    
    content = content[:brace_idx] + body + content[end_idx:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

handlers_to_revert = [
    (r"d:\Projetos\escolar\backend\src\handlers\auth.rs", "register_tenant"),
    (r"d:\Projetos\escolar\backend\src\handlers\auth.rs", "login"),
    (r"d:\Projetos\escolar\backend\src\handlers\auth.rs", "oauth_token"),
    (r"d:\Projetos\escolar\backend\src\handlers\crm_lms.rs", "whatsapp_webhook"),
    (r"d:\Projetos\escolar\backend\src\handlers\crm_lms.rs", "capturar_lead_publico"),
    (r"d:\Projetos\escolar\backend\src\handlers\regulatorio_ia.rs", "baixar_educacenso"),
    (r"d:\Projetos\escolar\backend\src\handlers\regulatorio_ia.rs", "validar_diploma_digital_publico")
]

for filepath, func_name in handlers_to_revert:
    fix_db(filepath, func_name)
