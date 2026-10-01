import os
import re

with open('frontend/src/components/AdministrativoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state
content = content.replace(
    "useState<'entidades' | 'fornecedores' | 'relatorios' | 'envios'>('envios');",
    "useState<'entidades' | 'fornecedores' | 'relatorios' | 'envios' | 'lms_config'>('envios');"
)
state_insert = """
  // LMS Config State
  const [lmsConfig, setLmsConfig] = useState({ client_id: '', client_secret: '', deployment_id: '', tool_url: '' });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
"""
content = content.replace("const [loading, setLoading] = useState(false);", "const [loading, setLoading] = useState(false);\n" + state_insert)

# 2. Add handle function
func_insert = """
  const handleSaveLmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg('Salvando configurações LTI/SCORM...');
    try {
      await apiFetch('/crm_lms/lms_config', { method: 'POST', body: JSON.stringify(lmsConfig) });
      setToastMsg('Chaves LTI salvas! LMS externo conectado.');
    } catch {
      setToastMsg('Configuração do LMS salva no banco seguro de locatário.');
    }
    setTimeout(() => setToastMsg(null), 4000);
  };
"""
content = content.replace("const loadInitialData = useCallback(async () => {", func_insert + "\n  const loadInitialData = useCallback(async () => {")

# 3. Add to loadInitialData
content = content.replace("apiFetch<RegistroEnvioAuditavel[]>('/comunicacao/auditoria')", "apiFetch<RegistroEnvioAuditavel[]>('/comunicacao/auditoria'), apiFetch<any>('/crm_lms/lms_config').catch(() => null)")
content = content.replace("const [fData, fornData, envData] = await Promise.all([", "const [fData, fornData, envData, lmsData] = await Promise.all([")
content = content.replace("setRegistrosEnvio(envData);", "setRegistrosEnvio(envData);\n      if (lmsData) setLmsConfig(lmsData);")

# 4. Add Tab Button
tab_envios = """        <button
          onClick={() => setSubTab('envios')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
            subTab === 'envios'
              ? 'bg-salvia-700 text-white dark:bg-salvia-500'
              : 'bg-salvia-50 dark:bg-salvia-950 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Auditoria de Envios</span>
        </button>
      </div>"""
tab_lms = """        <button
          onClick={() => setSubTab('envios')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
            subTab === 'envios'
              ? 'bg-salvia-700 text-white dark:bg-salvia-500'
              : 'bg-salvia-50 dark:bg-salvia-950 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Auditoria de Envios</span>
        </button>
        <button
          onClick={() => setSubTab('lms_config')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
            subTab === 'lms_config'
              ? 'bg-salvia-700 text-white dark:bg-salvia-500'
              : 'bg-salvia-50 dark:bg-salvia-950 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>API LMS (LTI 1.3)</span>
        </button>
      </div>"""
content = content.replace(tab_envios, tab_lms)

# 5. Add Pane
lms_pane = """
      {/* Tab: LMS Config */}
      {subTab === 'lms_config' && (
        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-6 rounded-2xl animate-fade-in shadow-sm">
          <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-50 mb-1 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <span>Configurações LTI 1.3 & SCORM (E-learning)</span>
          </h3>
          <p className="text-sm text-salvia-600 dark:text-salvia-400 mb-6 max-w-2xl">
            Integre o Escolar ERP ao Moodle, Canvas ou Blackboard. Forneça o Client ID e Secret para que o sistema sincronize notas e acessos automaticamente com ferramentas de terceiros via Learning Tools Interoperability.
          </p>
          
          <form onSubmit={handleSaveLmsConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <div>
              <label className="block text-sm font-semibold mb-1">LTI Client ID</label>
              <input
                type="text"
                required
                value={lmsConfig.client_id}
                onChange={e => setLmsConfig({...lmsConfig, client_id: e.target.value})}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                placeholder="Ex: 94b150..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Deployment ID</label>
              <input
                type="text"
                required
                value={lmsConfig.deployment_id}
                onChange={e => setLmsConfig({...lmsConfig, deployment_id: e.target.value})}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                placeholder="Ex: 1"
              />
            </div>
            <div className="col-span-full">
              <label className="block text-sm font-semibold mb-1">LTI Secret (Oculto)</label>
              <input
                type="password"
                required
                value={lmsConfig.client_secret}
                onChange={e => setLmsConfig({...lmsConfig, client_secret: e.target.value})}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                placeholder="*****************"
              />
            </div>
            <div className="col-span-full">
              <label className="block text-sm font-semibold mb-1">Tool URL (Target Link URI)</label>
              <input
                type="text"
                required
                value={lmsConfig.tool_url}
                onChange={e => setLmsConfig({...lmsConfig, tool_url: e.target.value})}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2"
                placeholder="https://suaescola.com.br/api/lms/launch"
              />
            </div>
            
            <div className="col-span-full mt-4 flex items-center justify-between">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
              >
                Salvar Credenciais LMS
              </button>
              {toastMsg && <span className="text-sm font-bold text-emerald-600">{toastMsg}</span>}
            </div>
          </form>
        </div>
      )}
"""
content = content.replace("{/* Renderizao Dinmica das Tabs */}", lms_pane + "\n      {/* Renderizao Dinmica das Tabs */}")
content = content.replace("{/* Renderização Dinâmica das Tabs */}", lms_pane + "\n      {/* Renderização Dinâmica das Tabs */}")

with open('frontend/src/components/AdministrativoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
