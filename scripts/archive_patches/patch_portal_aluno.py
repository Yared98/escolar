with open('frontend/src/components/PortalAlunoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update all activeTab comparisons to use portal_ prefixed keys
replacements = [
    ("activeTab === 'boletim'", "activeTab === 'portal_boletim'"),
    ("activeTab === 'financeiro'", "activeTab === 'portal_financeiro'"),
    ("activeTab === 'diploma'", "activeTab === 'portal_diploma'"),
    ("activeTab === 'rotina'", "activeTab === 'portal_rotina'"),
    ("activeTab === 'portfolio'", "activeTab === 'portal_portfolio'"),
]
for old, new in replacements:
    content = content.replace(old, new)

# 2. Find and remove the entire horizontal tab navigation block
# Looking for the div that contains the tab buttons
start_marker = '{/* Navigation Tabs - managed by Sidebar */}'
tab_nav_start = '        <div className="flex border-b border-salvia-200 dark:border-salvia-800 overflow-x-auto gap-2 pb-1">'

# Find the tab nav block and remove it
idx = content.find(tab_nav_start)
if idx != -1:
    # Find the closing </div> that matches this opening
    depth = 0
    i = idx
    while i < len(content):
        if content[i:i+4] == '<div':
            depth += 1
        elif content[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                end_idx = i + 6
                # Also consume trailing newline/whitespace
                while end_idx < len(content) and content[end_idx] in '\r\n':
                    end_idx += 1
                content = content[:idx] + content[end_idx:]
                print(f"Removed tab nav block starting at {idx}")
                break
        i += 1
else:
    print("Tab nav block not found, trying alternate approach")
    # Remove lines with setActiveTab onClick buttons
    lines = content.split('\n')
    new_lines = []
    skip = False
    brace_depth = 0
    for line in lines:
        if 'onClick={() => setActiveTab(' in line and 'className' in line:
            # This is a tab button - skip the entire button block
            skip = True
            brace_depth = line.count('<') - line.count('>')
        elif skip:
            brace_depth += line.count('<') - line.count('>')
            if '/>' in line or ('</button>' in line):
                skip = False
                continue
        if not skip:
            new_lines.append(line)
    content = '\n'.join(new_lines)

# 3. Remove the import of setActiveTab dependencies since we no longer call it
# (useState is still used for other state; just remove setActiveTab calls)
# All onClick={() => setActiveTab(...)} should already be gone
# Clean up any remaining setActiveTab references
import re
# Remove any standalone setActiveTab references
content = re.sub(r"onClick=\{\(\) => setActiveTab\('[^']+'\)\}", '', content)

with open('frontend/src/components/PortalAlunoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PortalAlunoSection.tsx patched!")
print("Remaining setActiveTab refs:", content.count('setActiveTab'))
print("activeTab portal refs:", content.count("activeTab === 'portal_"))
