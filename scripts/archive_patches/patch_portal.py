import os

with open('frontend/src/components/PortalAlunoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add agenda state and load function
new_state = """  const [eventos, setEventos] = useState<any[]>([]);

  const loadEventos = async () => {
    try {
      const evs = await apiFetch<any[]>('/agenda/calendario');
      setEventos(evs || []);
    } catch (e) {
      console.error(e);
    }
  };
"""

content = content.replace('  const [rotinaInfo, setRotinaInfo] = useState<any>(null);', '  const [rotinaInfo, setRotinaInfo] = useState<any>(null);\n' + new_state)

# Load in useEffect
content = content.replace('      } else if (activeTab === \'rotina\') {\n        await loadRotina(dataFiltroRotina);', '      } else if (activeTab === \'rotina\') {\n        await loadRotina(dataFiltroRotina);\n      } else if (activeTab === \'eventos\') {\n        await loadEventos();')

# Tab button
tab_btn = """          <button
            onClick={() => setActiveTab('rotina')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'rotina'
                ? 'border-salvia-500 text-salvia-700 dark:text-salvia-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Baby className="w-5 h-5" />
            <span>Rotina (Infantil)</span>
          </button>
          <button
            onClick={() => setActiveTab('eventos')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'eventos'
                ? 'border-salvia-500 text-salvia-700 dark:text-salvia-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span>Agenda & Eventos</span>
          </button>"""

content = content.replace("""          <button
            onClick={() => setActiveTab('rotina')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'rotina'
                ? 'border-salvia-500 text-salvia-700 dark:text-salvia-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Baby className="w-5 h-5" />
            <span>Rotina (Infantil)</span>
          </button>""", tab_btn)

# Tab Content
tab_content = """
          {activeTab === 'eventos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-salvia-900 dark:text-salvia-100">Próximos Eventos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventos.filter(ev => ev.visibilidade === 'todos' || ev.visibilidade === 'responsaveis').map((ev) => (
                  <div key={ev.id} className="bg-white dark:bg-salvia-900 p-5 rounded-2xl border border-gray-100 dark:border-salvia-800 shadow-sm">
                    <div className="flex justify-between items-start">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                        {ev.tipo.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3">{ev.titulo}</h3>
                    <p className="text-gray-500 text-sm mt-1">{ev.descricao}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-salvia-800 flex items-center gap-4 text-xs font-medium text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(ev.data_inicio).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    
                    {ev.exige_confirmacao && (
                      <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                        <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">Confirmação de Presença (RSVP)</p>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const qtd = prompt('Quantos acompanhantes levará? (Deixe em branco ou 0 caso vá sozinho)');
                            apiFetch(`/agenda/eventos/${ev.id}/rsvp`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'confirmado', acompanhantes: Number(qtd) || 0 })
                            }).then(() => alert('Presença confirmada!'));
                          }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                            Irei Participar
                          </button>
                          <button onClick={() => {
                            apiFetch(`/agenda/eventos/${ev.id}/rsvp`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'recusado', acompanhantes: 0 })
                            }).then(() => alert('Marcado como ausente.'));
                          }} className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-2 rounded-lg text-sm font-medium transition-colors">
                            Não poderei ir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {eventos.filter(ev => ev.visibilidade === 'todos' || ev.visibilidade === 'responsaveis').length === 0 && (
                  <p className="text-gray-500">Nenhum evento agendado.</p>
                )}
              </div>
            </div>
          )}
"""

content = content.replace('      </div>\n    </div>\n  );\n}\n', tab_content + '      </div>\n    </div>\n  );\n}\n')

with open('frontend/src/components/PortalAlunoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
