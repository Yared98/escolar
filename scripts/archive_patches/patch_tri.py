import os
import re

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add SimuladoTri interfaces
interfaces = """
interface ProjetoEducacional {
"""
new_interfaces = """
interface SimuladoTri {
  id: string;
  titulo: string;
  descricao?: string;
  disciplina: string;
  data_aplicacao: string;
  total_itens: number;
}

interface ProjetoEducacional {
"""
content = content.replace(interfaces, new_interfaces)

# 2. Add state
state_search = "const [cardapios, setCardapios] = useState<Cardapio[]>([]);"
new_state = """const [cardapios, setCardapios] = useState<Cardapio[]>([]);
  const [simulados, setSimulados] = useState<SimuladoTri[]>([]);
  const [showModalSimulado, setShowModalSimulado] = useState(false);
  const [novoSimulado, setNovoSimulado] = useState({
    titulo: '',
    descricao: '',
    disciplina: 'Matemática',
    data_aplicacao: new Date().toISOString().split('T')[0],
  });
"""
content = content.replace(state_search, new_state)

# 3. Add fetch simulados to loadInitialData
load_data = """const [tData, dData, pData, sData, projData, cData] = await Promise.all(["""
new_load_data = """const [tData, dData, pData, sData, projData, cData, simData] = await Promise.all([
        apiFetch<Turma[]>('/pedagogico/turmas').catch(() => mockTurmas),
        apiFetch<Disciplina[]>('/pedagogico/disciplinas').catch(() => []),
        apiFetch<ProfessorItem[]>('/pedagogico/professores').catch(() => []),
        apiFetch<SalaItem[]>('/pedagogico/salas').catch(() => []),
        apiFetch<ProjetoEducacional[]>('/pedagogico/projetos').catch(() => []),
        apiFetch<Cardapio[]>('/nutricao/cardapios').catch(() => []),
        apiFetch<SimuladoTri[]>('/academico/simulados_tri').catch(() => []),
      ]);
      setTurmas(tData);
      setDisciplinas(dData);
      setProfessores(pData);
      setSalas(sData);
      setProjetos(projData);
      setCardapios(cData);
      setSimulados(simData.length ? simData : [
        { id: 'sim-1', titulo: 'Simulado Enem 2026', disciplina: 'Geral', data_aplicacao: '2026-05-10', total_itens: 45 }
      ]);
"""
# Replace the whole Promise.all block
old_block = """const [tData, dData, pData, sData, projData, cData] = await Promise.all([
        apiFetch<Turma[]>('/pedagogico/turmas').catch(() => mockTurmas),
        apiFetch<Disciplina[]>('/pedagogico/disciplinas').catch(() => []),
        apiFetch<ProfessorItem[]>('/pedagogico/professores').catch(() => []),
        apiFetch<SalaItem[]>('/pedagogico/salas').catch(() => []),
        apiFetch<ProjetoEducacional[]>('/pedagogico/projetos').catch(() => []),
        apiFetch<Cardapio[]>('/nutricao/cardapios').catch(() => []),
      ]);
      setTurmas(tData);
      setDisciplinas(dData);
      setProfessores(pData);
      setSalas(sData);
      setProjetos(projData);
      setCardapios(cData);"""

if old_block in content:
    content = content.replace(old_block, new_load_data)
else:
    print("Warning: Old block not found exactly!")

# 4. Add handleCriarSimulado function
create_func = """
  const handleCriarSimulado = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg({ text: 'Treinando Motor Preditivo (Parâmetros a, b, c) e salvando Simulado TRI...', type: 'success' });
    try {
      const payload = {
        titulo: novoSimulado.titulo,
        descricao: novoSimulado.descricao,
        disciplina: novoSimulado.disciplina,
        data_aplicacao: novoSimulado.data_aplicacao,
        itens: [
          { numero_item: 1, gabarito_correto: 'A', parametro_a: 1.5, parametro_b: 0.5, parametro_c: 0.2 },
          { numero_item: 2, gabarito_correto: 'C', parametro_a: 2.1, parametro_b: 1.0, parametro_c: 0.25 },
        ]
      };
      const res = await apiFetch<SimuladoTri>('/academico/simulados_tri', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSimulados([...simulados, res]);
      setToastMsg({ text: 'Simulado TRI Preditivo Criado com sucesso!', type: 'success' });
      setShowModalSimulado(false);
    } catch (err: any) {
      setToastMsg({ text: err.message || 'Falha ao criar Simulado.', type: 'error' });
    }
    setTimeout(() => setToastMsg(null), 4000);
  };
"""
content = content.replace("const handleSalvarCardapio = async", create_func + "\n  const handleSalvarCardapio = async")

# 5. Add Tab Button
tab_nutricao = """        <div className="flex border-b border-salvia-200 dark:border-salvia-800 overflow-x-auto">"""
tab_btn = """        <div className="flex border-b border-salvia-200 dark:border-salvia-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tri')}
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'tri'
                ? 'border-salvia-600 text-salvia-900 dark:text-salvia-50 dark:border-salvia-400'
                : 'border-transparent text-salvia-500 hover:text-salvia-700 dark:hover:text-salvia-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Motor TRI (IA Preditiva)</span>
          </button>"""
content = content.replace(tab_nutricao, tab_btn)

# 6. Add Tab Content
tri_pane = """
      {/* ABA: MOTOR TRI E IA PREDITIVA */}
      {activeTab === 'tri' && (
        <div className="animate-fade-in p-6 bg-white dark:bg-salvia-900 rounded-b-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                <span>Simulados Preditivos (Teoria da Resposta ao Item)</span>
              </h3>
              <p className="text-sm text-salvia-600 dark:text-salvia-400 max-w-2xl mt-1">
                A tecnologia TRI cruza o histórico do aluno com os parâmetros de dificuldade (b), discriminação (a) e acerto casual (c). O painel gera análises de proficiência para o ENEM e exporta diretamente para o EducaCenso.
              </p>
            </div>
            <button
              onClick={() => setShowModalSimulado(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Simulado</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {simulados.map((s) => (
              <div key={s.id} className="bg-salvia-50 dark:bg-salvia-800/50 p-5 rounded-2xl border border-salvia-200 dark:border-salvia-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                    {s.disciplina}
                  </span>
                  <span className="text-xs text-salvia-500 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" /> {s.data_aplicacao}
                  </span>
                </div>
                <h4 className="font-bold text-salvia-900 dark:text-salvia-50 mb-1">{s.titulo}</h4>
                <p className="text-xs text-salvia-600 dark:text-salvia-400 line-clamp-2 mb-4">
                  {s.descricao || "Simulado preparatório para exames nacionais."}
                </p>
                <div className="flex justify-between items-center text-xs font-semibold text-salvia-500 pt-3 border-t border-salvia-200 dark:border-salvia-700">
                  <span>{s.total_itens} Itens TRI</span>
                  <button className="text-indigo-600 dark:text-indigo-400 hover:underline">Exportar Censo</button>
                </div>
              </div>
            ))}
            {simulados.length === 0 && (
              <div className="col-span-full p-8 text-center text-salvia-500 bg-salvia-50/50 dark:bg-salvia-900/30 rounded-2xl border border-dashed border-salvia-300 dark:border-salvia-700">
                Nenhum simulado cadastrado.
              </div>
            )}
          </div>
        </div>
      )}
"""
import_icons = "import {\n  BookOpen,\n  BrainCircuit,\n  Calendar,"
content = content.replace("import {\n  BookOpen,", import_icons)

content = content.replace("{/* ABA 1: DISCIPLINAS & MATRIZ CURRICULAR DA TURMA */}", tri_pane + "\n      {/* ABA 1: DISCIPLINAS & MATRIZ CURRICULAR DA TURMA */}")

# 7. Add Modal
modal_tri = """
      {/* MODAL: CRIAR SIMULADO TRI */}
      {showModalSimulado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-salvia-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                <span>Cadastrar Simulado (TRI)</span>
              </h3>
              <button onClick={() => setShowModalSimulado(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCriarSimulado} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Título do Exame</label>
                <input
                  type="text"
                  required
                  value={novoSimulado.titulo}
                  onChange={(e) => setNovoSimulado({ ...novoSimulado, titulo: e.target.value })}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ex: Simulado Geral Enem"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Área / Disciplina</label>
                  <select
                    value={novoSimulado.disciplina}
                    onChange={(e) => setNovoSimulado({ ...novoSimulado, disciplina: e.target.value })}
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  >
                    <option>Matemática</option>
                    <option>Linguagens</option>
                    <option>Ciências da Natureza</option>
                    <option>Geral (Múltiplas)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Data Aplicação</label>
                  <input
                    type="date"
                    required
                    value={novoSimulado.data_aplicacao}
                    onChange={(e) => setNovoSimulado({ ...novoSimulado, data_aplicacao: e.target.value })}
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Descrição</label>
                <textarea
                  value={novoSimulado.descricao}
                  onChange={(e) => setNovoSimulado({ ...novoSimulado, descricao: e.target.value })}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <p className="text-[10px] text-salvia-500 italic">
                * Os parâmetros (a, b, c) dos itens serão gerados aleatoriamente pelo Motor IA nesta demonstração.
              </p>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-all"
              >
                Ativar Modelo Preditivo
              </button>
            </form>
          </div>
        </div>
      )}
"""
content = content.replace("{/* MODAL: VINCULAR DISCIPLINA À MATRIZ DA TURMA */}", modal_tri + "\n      {/* MODAL: VINCULAR DISCIPLINA À MATRIZ DA TURMA */}")

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
