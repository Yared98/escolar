import os
import re

with open('frontend/src/components/AcademicoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state for Portfolio
state_insert = """
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [portfolioData, setPortfolioData] = useState({ titulo: '', descricao: '', campos_bncc: 'Eu, o outro e o nós', midia_url: '' });
"""
content = content.replace("const [fixarNoMural, setFixarNoMural] = useState(false);", "const [fixarNoMural, setFixarNoMural] = useState(false);" + state_insert)

# 2. Add function to submit
func_insert = """
  const handleSalvarPortfolio = async () => {
    const payload = {
      aluno_id: selectedAlunoId,
      professor_id: 'prof-123',
      turma_id: 'turma-1',
      titulo: portfolioData.titulo,
      descricao: portfolioData.descricao,
      campos_experiencia_bncc: [portfolioData.campos_bncc],
      midia_url: portfolioData.midia_url,
      data_registro: new Date().toISOString().split('T')[0]
    };

    try {
      if (navigator.onLine) {
        await apiFetch('/academico/portfolio', { method: 'POST', body: JSON.stringify(payload) });
        setToastMsg({ text: '📸 Registro de Portfólio (BNCC) salvo e enviado aos pais!', type: 'success' });
      } else {
        throw new Error('Offline');
      }
    } catch {
      await db.sync_events.add({
        uuid: crypto.randomUUID(),
        tenant_id: tenant?.id || 'tenant-default',
        entity: 'portfolio_infantil',
        action: 'create',
        payload: payload as any,
        created_at: new Date().toISOString(),
        status: 'pending',
      });
      await refreshPendingCount();
      setToastMsg({ text: '💾 Portfólio salvo no modo Offline (IndexedDB).', type: 'success' });
    }
    setShowPortfolioModal(false);
    setPortfolioData({ titulo: '', descricao: '', campos_bncc: 'Eu, o outro e o nós', midia_url: '' });
    setTimeout(() => setToastMsg(null), 4000);
  };
"""
content = content.replace("const handleEnviarMensagemProfessora = async", func_insert + "\n  const handleEnviarMensagemProfessora = async")

# 3. Add button in the UI next to "Ocorrência Urgente"
btn_insert = """                  <button
                    onClick={() => setShowPortfolioModal(true)}
                    className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:hover:bg-amber-800/60 dark:text-amber-200 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all text-xs border border-amber-200 dark:border-amber-800"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Portfólio & Evolução (BNCC)</span>
                  </button>"""
# Find occurrence button to place next to it
occ_btn = """                  <button
                    onClick={() => setShowIncidentModal(true)}
                    className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:hover:bg-rose-800/60 dark:text-rose-200 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all text-xs border border-rose-200 dark:border-rose-800"
                  >"""
content = content.replace(occ_btn, btn_insert + "\n" + occ_btn)

# 4. Add Modal XML
modal_xml = """
      {/* MODAL: PORTFÓLIO INFANTIL (BNCC) */}
      {showPortfolioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-salvia-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-6 rounded-2xl w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 mb-4 flex items-center space-x-2">
              <Camera className="w-5 h-5 text-amber-500" />
              <span>Registro de Portfólio (Educação Infantil)</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-salvia-800 dark:text-salvia-200">Título da Atividade</label>
                <input
                  type="text"
                  value={portfolioData.titulo}
                  onChange={(e) => setPortfolioData({...portfolioData, titulo: e.target.value})}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                  placeholder="Ex: Descobrindo Cores com Tinta Guache"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-salvia-800 dark:text-salvia-200">Campo de Experiência (BNCC)</label>
                <select
                  value={portfolioData.campos_bncc}
                  onChange={(e) => setPortfolioData({...portfolioData, campos_bncc: e.target.value})}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                >
                  <option>O eu, o outro e o nós</option>
                  <option>Corpo, gestos e movimentos</option>
                  <option>Traços, sons, cores e formas</option>
                  <option>Escuta, fala, pensamento e imaginação</option>
                  <option>Espaços, tempos, quantidades, relações e transformações</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-salvia-800 dark:text-salvia-200">Observação Pedagógica</label>
                <textarea
                  value={portfolioData.descricao}
                  onChange={(e) => setPortfolioData({...portfolioData, descricao: e.target.value})}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                  rows={3}
                  placeholder="Descreva o desenvolvimento da criança nesta atividade..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-salvia-800 dark:text-salvia-200">Foto/Vídeo (URL ou Upload Mock)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={portfolioData.midia_url}
                    onChange={(e) => setPortfolioData({...portfolioData, midia_url: e.target.value})}
                    className="flex-1 bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                    placeholder="https://..."
                  />
                  <button className="bg-salvia-200 dark:bg-salvia-700 text-salvia-700 dark:text-salvia-200 p-2 rounded-xl">
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setShowPortfolioModal(false)}
                  className="flex-1 bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-700 dark:text-salvia-200 py-2.5 rounded-xl font-bold transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarPortfolio}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-bold transition-all text-sm shadow-sm"
                >
                  Salvar no Diário
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
"""
content = content.replace("{/* MODAL: OCORRÊNCIA URGENTE */}", modal_xml + "\n      {/* MODAL: OCORRÊNCIA URGENTE */}")

import_icons = "import {\n  Camera,"
content = content.replace("import {\n", import_icons)

with open('frontend/src/components/AcademicoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
