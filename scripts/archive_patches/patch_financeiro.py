import os

file_path = 'frontend/src/components/FinanceiroSection.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useSearchParams to imports
content = content.replace("import React, { useState, useEffect, useCallback, useMemo } from 'react';", 
                          "import React, { useState, useEffect, useCallback, useMemo } from 'react';\nimport { useSearchParams } from 'next/navigation';")

# 2. Replace activeSubTab state with useSearchParams
old_state = "const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>('ar');"
new_state = """const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeSubTab = tabParam === 'ap' || tabParam === 'nfse' || tabParam === 'bi' || tabParam === 'conciliacao' ? tabParam : 'ar';"""

content = content.replace(old_state, new_state)

# 3. Remove the old Sub-tabs Navigation UI completely
start_idx = content.find('{/* Sub-tabs Navigation */}')
if start_idx != -1:
    # Find the end of the div
    end_idx = content.find('</div>', start_idx) + 6
    if end_idx > 6:
        content = content[:start_idx] + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("FinanceiroSection.tsx patched!")
