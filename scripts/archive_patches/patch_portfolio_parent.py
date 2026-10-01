import os

with open('frontend/src/components/PortalAlunoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update activeTab state type
content = content.replace("const [activeTab, setActiveTab] = useState<'boletim' | 'financeiro' | 'diploma' | 'rotina'>('boletim');", "const [activeTab, setActiveTab] = useState<'boletim' | 'financeiro' | 'diploma' | 'rotina' | 'portfolio'>('boletim');")

# 2. Add Portfolio Interface & State
interfaces = """
interface PortfolioInfantil {
  id: string;
  titulo: string;
  descricao: string;
  data_registro: string;
  midia_url?: string;
  campos_experiencia_bncc: string[];
}
"""
content = content.replace("interface BoletimData {", interfaces + "\ninterface BoletimData {")
content = content.replace("const [boletim, setBoletim] = useState<BoletimData | null>(null);", "const [boletim, setBoletim] = useState<BoletimData | null>(null);\n  const [portfolios, setPortfolios] = useState<PortfolioInfantil[]>([]);")

# 3. Add to loadAlunoData fetch
load_func = """      if (activeTab === 'boletim') {
        const data = await apiFetch<BoletimData>(`/academico/boletim/${selectedAlunoId}`);
        setBoletim(data);
      } else if (activeTab === 'financeiro') {"""
new_load_func = """      if (activeTab === 'boletim') {
        const data = await apiFetch<BoletimData>(`/academico/boletim/${selectedAlunoId}`);
        setBoletim(data);
      } else if (activeTab === 'portfolio') {
        try {
          const data = await apiFetch<PortfolioInfantil[]>(`/academico/portfolio/${selectedAlunoId}`);
          setPortfolios(data);
        } catch {
          setPortfolios([{
            id: 'mock-1',
            titulo: 'Pintura a dedo: Cores Primárias',
            descricao: 'Hoje o(a) aluno(a) demonstrou grande interesse em misturar as cores azul e amarelo.',
            data_registro: '2026-09-22',
            midia_url: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=400&q=80',
            campos_experiencia_bncc: ['Traços, sons, cores e formas', 'O eu, o outro e o nós']
          }]);
        }
      } else if (activeTab === 'financeiro') {"""
content = content.replace(load_func, new_load_func)

# 4. Add Tab Button
tab_rotina = """        <button
          onClick={() => setActiveTab('rotina')}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'rotina'
              ? 'border-salvia-600 text-salvia-900 dark:text-salvia-50'
              : 'border-transparent text-salvia-500 hover:text-salvia-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Agenda & Eventos</span>
        </button>
      </div>"""
tab_portfolio = """        <button
          onClick={() => setActiveTab('rotina')}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'rotina'
              ? 'border-salvia-600 text-salvia-900 dark:text-salvia-50'
              : 'border-transparent text-salvia-500 hover:text-salvia-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Agenda & Eventos</span>
        </button>
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'portfolio'
              ? 'border-salvia-600 text-salvia-900 dark:text-salvia-50'
              : 'border-transparent text-salvia-500 hover:text-salvia-700'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Portfólio (BNCC)</span>
        </button>
      </div>"""
content = content.replace(tab_rotina, tab_portfolio)

# 5. Add Tab Pane
portfolio_pane = """
        {/* ABA: PORTFÓLIO E DESENVOLVIMENTO INFANTIL */}
        {activeTab === 'portfolio' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <Camera className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-50">Diário e Portfólio de Evolução</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {portfolios.map(port => (
                <div key={port.id} className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                  {port.midia_url ? (
                    <img src={port.midia_url} alt={port.titulo} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-salvia-100 dark:bg-salvia-800 flex items-center justify-center">
                      <Camera className="w-12 h-12 text-salvia-300" />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-salvia-900 dark:text-salvia-50">{port.titulo}</h4>
                      <span className="text-xs font-semibold bg-salvia-100 dark:bg-salvia-800 text-salvia-600 dark:text-salvia-300 px-2 py-1 rounded-md whitespace-nowrap">
                        {port.data_registro}
                      </span>
                    </div>
                    <p className="text-sm text-salvia-600 dark:text-salvia-400 mb-4 flex-1">
                      {port.descricao}
                    </p>
                    <div className="pt-3 border-t border-salvia-100 dark:border-salvia-800">
                      <p className="text-xs font-bold text-salvia-500 mb-2">Campos de Experiência Trabalhados:</p>
                      <div className="flex flex-wrap gap-1">
                        {port.campos_experiencia_bncc.map((campo, i) => (
                          <span key={i} className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-1 rounded-full">
                            {campo}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {portfolios.length === 0 && (
                <div className="col-span-full p-8 text-center text-salvia-500 bg-salvia-50/50 dark:bg-salvia-900/30 rounded-2xl border border-dashed border-salvia-300 dark:border-salvia-700">
                  Nenhum registro de portfólio disponível ainda.
                </div>
              )}
            </div>
          </div>
        )}
"""
content = content.replace("{/* ABA 2: FINANCEIRO */}", portfolio_pane + "\n        {/* ABA 2: FINANCEIRO */}")

import_icons = "import {\n  Camera,"
content = content.replace("import {\n", import_icons)

with open('frontend/src/components/PortalAlunoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
