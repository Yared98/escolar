import os
import re

for f in ['src/handlers/financeiro.rs', 'src/handlers/agenda_admin.rs', 'src/handlers/notificacoes.rs']:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Revert all .to_string() inside Some()
    content = re.sub(r'Some\(([a-zA-Z0-9_.]+)\.to_string\(\)\)', r'Some(\1)', content)
    
    # Add .to_string() only to the entity_id parameter (the one after a string literal like "table")
    # Example: "faturas", Some(fatura.id),
    content = re.sub(r'("[a-zA-Z0-9_]+",\s*)Some\(([a-zA-Z0-9_.]+)\)(,\s*(Some|None)|\)\.await)', r'\1Some(\2.to_string())\3', content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
