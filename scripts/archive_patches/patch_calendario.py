import os

with open('frontend/src/components/CalendarioEscolarSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'visibilidade: string;',
    'visibilidade: string;\n  exige_confirmacao: boolean;'
)

content = content.replace(
    'visibilidade: \'todos\'',
    'visibilidade: \'todos\',\n    exige_confirmacao: false'
)

content = content.replace(
    'className="w-full border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 h-20 resize-none"',
    'className="w-full border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 h-20 resize-none"'
)

new_checkbox = """
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="exige_confirmacao"
                  checked={formData.exige_confirmacao}
                  onChange={e => setFormData({...formData, exige_confirmacao: e.target.checked})}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="exige_confirmacao" className="text-sm font-medium text-gray-700">
                  Exige Confirmação de Presença (RSVP)
                </label>
              </div>
              <div className="pt-2">"""

content = content.replace('<div className="pt-2">', new_checkbox)

new_badge = """
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">{ev.descricao}</p>
                {ev.exige_confirmacao && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold">
                    <span>Requer Confirmação (RSVP)</span>
                  </div>
                )}
              </div>"""

content = content.replace('                <p className="text-gray-500 text-sm mt-1 line-clamp-2">{ev.descricao}</p>\n              </div>', new_badge)

with open('frontend/src/components/CalendarioEscolarSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
