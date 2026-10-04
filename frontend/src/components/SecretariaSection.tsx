'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatCpf, formatPhone, formatCep } from '@/lib/formatters';
import {
  Aluno,
  AlunosPage,
  AlunoStatusContagem,
  ProntuarioData,
  Turma,
  AlunoTurmaDetalhado,
  Sala,
  ProfessorItem,
  ProntuarioModal,
  EnsalamentoModal,
  ContratosPanel,
  NovaTurmaModal,
  TurmaAlunosModal,
  MatriculaModal,
  AlunosPanel,
  labelStatusAluno,
  statusAlunoBadgeClass,
  proximasAcoesStatus,
} from './secretaria';
import {
  UserCheck,
  PlusCircle,
  Search,
  Trash2,
  X,
  Users,
  UserPlus,
  HeartPulse,
  Shield,
  ShieldAlert,
  Edit3,
  Save,
  ArrowRightLeft,
  ListOrdered,
  DoorOpen,
  GraduationCap,
  School,
  RotateCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  MapPin,
  Phone,
  FileText,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

const PAGE_SIZE = 25;

export function SecretariaSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const [activeTabLocal, setActiveTabLocal] = useState<'alunos' | 'turmas' | 'contratos'>(() => {
    if (tabParam === 'turmas' || tabParam === 'contratos') return tabParam;
    return 'alunos';
  });

  useEffect(() => {
    if (tabParam === 'turmas' || tabParam === 'contratos' || tabParam === 'alunos') {
      setActiveTabLocal(tabParam);
    }
  }, [tabParam]);

  const activeTab: 'alunos' | 'turmas' | 'contratos' = activeTabLocal;

  const handleTabChange = (tab: 'alunos' | 'turmas' | 'contratos') => {
    setActiveTabLocal(tab);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('route', 'secretaria');
    params.set('tab', tab);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasCatalogo, setTurmasCatalogo] = useState<Turma[]>([]);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('ativo');
  const [filtroTurmaId, setFiltroTurmaId] = useState('');
  const [filtroSemTurma, setFiltroSemTurma] = useState(false);
  const [filtroAnoLetivo, setFiltroAnoLetivo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [alunosReloadToken, setAlunosReloadToken] = useState(0);
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [contagemStatus, setContagemStatus] = useState<AlunoStatusContagem[]>([]);
  const [alunosEnsalamento, setAlunosEnsalamento] = useState<Aluno[]>([]);
  const [menuStatusAlunoId, setMenuStatusAlunoId] = useState<string | null>(null);
  const [statusInicialMatricula, setStatusInicialMatricula] = useState<'ativo' | 'pre_matricula'>('ativo');
  const [filtroTurmaTexto, setFiltroTurmaTexto] = useState('');
  const [filtroTurmaTextoDebounced, setFiltroTurmaTextoDebounced] = useState('');
  const [filtroTurmaAno, setFiltroTurmaAno] = useState('');
  const [filtroTurmaTurno, setFiltroTurmaTurno] = useState('');
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario'>('dados_aluno');
  const [origemCrm, setOrigemCrm] = useState(false);
  const lastConsumedLeadRef = useRef<string | null>(null);
  const [showTurmaModal, setShowTurmaModal] = useState(false);
  const [showEnsalamentoModal, setShowEnsalamentoModal] = useState(false);
  const [selectedTurmaParaEnsalamento, setSelectedTurmaParaEnsalamento] = useState<Turma | null>(null);
  const [selectedAlunoIdParaEnsalamento, setSelectedAlunoIdParaEnsalamento] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [ensalamentoSuccess, setEnsalamentoSuccess] = useState<string | null>(null);

  // Prontuário Modal state (view / edit)
  const [selectedProntuarioModal, setSelectedProntuarioModal] = useState<{
    aluno: Aluno;
    prontuario: ProntuarioData;
  } | null>(null);
  const [isEditingProntuario, setIsEditingProntuario] = useState(false);
  const [editTipoSanguineo, setEditTipoSanguineo] = useState('O+');
  const [editAlergias, setEditAlergias] = useState('');
  const [editRestricoes, setEditRestricoes] = useState('');
  const [editMedicamentos, setEditMedicamentos] = useState('');
  const [editCuidados, setEditCuidados] = useState('');
  const [editHistorico, setEditHistorico] = useState('');
  const [prontuarioSuccess, setProntuarioSuccess] = useState<string | null>(null);

  // Form state - Aluno & Responsáveis
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('2012-05-15');

  // Responsável Legal
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [cpfResponsavelLegal, setCpfResponsavelLegal] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [parentescoResponsavelLegal, setParentescoResponsavelLegal] = useState('Mãe');

  // Responsável Financeiro (Unificado ou Separado)
  const [responsavelFinanceiroIgualLegal, setResponsavelFinanceiroIgualLegal] = useState(true);
  const [nomeResponsavelFinanceiro, setNomeResponsavelFinanceiro] = useState('');
  const [cpfResponsavelFinanceiro, setCpfResponsavelFinanceiro] = useState('');
  const [emailResponsavelFinanceiro, setEmailResponsavelFinanceiro] = useState('');
  const [telefoneResponsavelFinanceiro, setTelefoneResponsavelFinanceiro] = useState('');
  const [parentescoResponsavelFinanceiro, setParentescoResponsavelFinanceiro] = useState('Pai');

  // Endereço Residencial
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [estado, setEstado] = useState('SP');

  // Contatos Secundários & Emergência
  const [telefoneSecundario, setTelefoneSecundario] = useState('');
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState('');
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState('');
  const [contatoEmergenciaParentesco, setContatoEmergenciaParentesco] = useState('Avó');

  // Prontuário Médico Inicial
  const [tipoSanguineo, setTipoSanguineo] = useState('O+');
  const [alergias, setAlergias] = useState('');
  const [restricoesAlimentares, setRestricoesAlimentares] = useState('');
  const [medicamentosContinuos, setMedicamentosContinuos] = useState('');
  const [cuidadosEspeciais, setCuidadosEspeciais] = useState('');
  const [historicoObservacoes, setHistoricoObservacoes] = useState('');

  // Form state Turma
  const [nomeTurma, setNomeTurma] = useState('');
  const [codigoTurma, setCodigoTurma] = useState('');
  const [etapaEnsinoTurma, setEtapaEnsinoTurma] = useState('Ensino Fundamental I');
  const [serieTurma, setSerieTurma] = useState('1º Ano');
  const [turnoTurma, setTurnoTurma] = useState('Matutino');
  const [anoLetivoTurma, setAnoLetivoTurma] = useState(2026);
  const [capacidadeTurma, setCapacidadeTurma] = useState(30);
  const [salaIdTurma, setSalaIdTurma] = useState('');
  const [professorRegenteIdTurma, setProfessorRegenteIdTurma] = useState('');

  // Auxiliares pedagógicos
  const [salas, setSalas] = useState<Sala[]>([]);
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);

  // Modal Alunos & Chamada da Turma
  const [selectedTurmaAlunosModal, setSelectedTurmaAlunosModal] = useState<Turma | null>(null);
  const [turmaAlunos, setTurmaAlunos] = useState<AlunoTurmaDetalhado[]>([]);
  const [loadingTurmaAlunos, setLoadingTurmaAlunos] = useState(false);
  const [turmaAlunosMsg, setTurmaAlunosMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transferência de Aluno
  const [alunoParaTransferir, setAlunoParaTransferir] = useState<AlunoTurmaDetalhado | null>(null);
  const [turmaDestinoTransferenciaId, setTurmaDestinoTransferenciaId] = useState('');
  const [transferindo, setTransferindo] = useState(false);

  const loadCatalogo = useCallback(async () => {
    const settled = await Promise.allSettled([
      apiFetch<Turma[]>('/secretaria/turmas'),
      apiFetch<Sala[]>('/secretaria/salas'),
      apiFetch<ProfessorItem[]>('/academico/professores/disponiveis'),
    ]);
    const [turmasRes, salasRes, profsRes] = settled;
    const erros: string[] = [];

    if (turmasRes.status === 'fulfilled') {
      const items = (turmasRes.value || []).map((t) => {
        const matriculados = t.alunos_matriculados ?? 0;
        return {
          ...t,
          alunos_matriculados: matriculados,
          vagas_restantes:
            t.vagas_restantes ?? Math.max(0, (t.capacidade_maxima || 0) - matriculados),
        };
      });
      setTurmasCatalogo(items);
      setTurmas((prev) => (prev.length === 0 ? items : prev));
    } else {
      setTurmasCatalogo([]);
      erros.push('turmas');
    }

    if (salasRes.status === 'fulfilled') {
      setSalas(salasRes.value || []);
    } else {
      setSalas([]);
      erros.push('salas');
    }

    if (profsRes.status === 'fulfilled') {
      setProfessores(profsRes.value || []);
    } else {
      setProfessores([]);
    }

    if (erros.length > 0) {
      setFetchError(
        `Não foi possível carregar: ${erros.join(', ')}. Verifique a conexão com o servidor.`
      );
    }
  }, []);

  const loadTurmas = useCallback(async () => {
    setLoadingTurmas(true);
    try {
      const params = new URLSearchParams();
      if (filtroTurmaTextoDebounced.trim()) {
        params.set('q', filtroTurmaTextoDebounced.trim());
      }
      if (filtroTurmaAno) {
        params.set('ano_letivo', filtroTurmaAno);
      }
      if (filtroTurmaTurno) {
        params.set('turno', filtroTurmaTurno);
      }
      const qs = params.toString();
      const endpoint = qs ? `/secretaria/turmas?${qs}` : '/secretaria/turmas';
      const data = await apiFetch<Turma[]>(endpoint);
      const items = (data || []).map((t) => {
        const matriculados = t.alunos_matriculados ?? 0;
        return {
          ...t,
          alunos_matriculados: matriculados,
          vagas_restantes:
            t.vagas_restantes ?? Math.max(0, (t.capacidade_maxima || 0) - matriculados),
        };
      });
      setTurmas(items);
    } catch (err: unknown) {
      setTurmas([]);
      setFetchError(err instanceof Error ? err.message : 'Não foi possível carregar as turmas.');
    } finally {
      setLoadingTurmas(false);
    }
  }, [filtroTurmaTextoDebounced, filtroTurmaAno, filtroTurmaTurno]);

  const buildAlunosQuery = useCallback(
    (opts?: { page?: number; forEnsalamento?: boolean }) => {
      const params = new URLSearchParams();
      const pageNum = opts?.page ?? page;
      params.set('page', String(pageNum));
      params.set('limit', String(opts?.forEnsalamento ? 200 : PAGE_SIZE));

      if (opts?.forEnsalamento) {
        params.set('status', 'ativo');
        params.set('sem_turma', 'true');
        return params.toString();
      }

      if (searchDebounced.trim()) params.set('q', searchDebounced.trim());
      if (filtroStatus && filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (filtroStatus === 'todos') params.set('status', 'todos');
      if (filtroTurmaId) params.set('turma_id', filtroTurmaId);
      if (filtroSemTurma) params.set('sem_turma', 'true');
      if (filtroAnoLetivo) params.set('ano_letivo', filtroAnoLetivo);
      return params.toString();
    },
    [page, searchDebounced, filtroStatus, filtroTurmaId, filtroSemTurma, filtroAnoLetivo]
  );

  const loadAlunos = useCallback(async () => {
    setAlunosReloadToken((token) => token + 1);
  }, []);

  const loadAlunosEnsalamento = useCallback(async () => {
    try {
      const data = await apiFetch<AlunosPage>(
        `/secretaria/alunos?${buildAlunosQuery({ forEnsalamento: true, page: 1 })}`
      );
      setAlunosEnsalamento(data.items || []);
    } catch {
      setAlunosEnsalamento([]);
    }
  }, [buildAlunosQuery]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setFiltroTurmaTextoDebounced(filtroTurmaTexto), 350);
    return () => clearTimeout(t);
  }, [filtroTurmaTexto]);

  useEffect(() => {
    void loadTurmas();
  }, [loadTurmas]);

  // Busca/filtros: volta à página 1 no mesmo ciclo de evento dos chips/handlers
  // (efeito só para debounce de busca, que não passa por handler síncrono).
  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  useEffect(() => {
    void loadCatalogo();
  }, [loadCatalogo]);

  // Carrega alunos com cancelamento: evita resposta antiga zerar a lista ao trocar rota/filtro.
  useEffect(() => {
    if (activeTab !== 'alunos') return;
    let cancelled = false;
    async function carregarAlunos() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await apiFetch<AlunosPage | Aluno[]>(
          `/secretaria/alunos?${buildAlunosQuery()}`
        );
        if (cancelled) return;

        if (Array.isArray(data)) {
          setAlunos(data);
          setTotalAlunos(data.length);
          setContagemStatus([]);
        } else {
          setAlunos(data.items ?? []);
          setTotalAlunos(data.total ?? 0);
          setContagemStatus(data.contagem_status ?? []);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        // Mantém lista anterior; só sinaliza o erro (evita flash vazio em race/401).
        setFetchError(err instanceof Error ? err.message : 'Não foi possível carregar os alunos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void carregarAlunos();
    return () => {
      cancelled = true;
    };
  }, [buildAlunosQuery, alunosReloadToken, activeTab]);

  useEffect(() => {
    if (!searchParams) return;
    const isNovaMatricula =
      searchParams.get('nova_matricula') === '1' ||
      searchParams.get('nova_matricula') === 'true' ||
      searchParams.get('modal') === 'nova_matricula';

    if (isNovaMatricula) {
      const querySignature = searchParams.toString();
      if (lastConsumedLeadRef.current === querySignature) return;
      lastConsumedLeadRef.current = querySignature;

      const leadNome = searchParams.get('lead_nome') || searchParams.get('nome_responsavel') || '';
      const leadTelefone = searchParams.get('lead_telefone') || searchParams.get('telefone') || '';
      const leadEmail = searchParams.get('lead_email') || searchParams.get('email') || '';
      const leadAluno = searchParams.get('lead_aluno') || searchParams.get('nome_aluno') || searchParams.get('aluno') || '';

      if (leadAluno) {
        setNome(leadAluno);
      } else if (leadNome) {
        setNome(leadNome);
      }
      if (leadNome) {
        setNomeResponsavel(leadNome);
      }
      if (leadTelefone) {
        setTelefoneResponsavel(formatPhone(leadTelefone));
      }
      if (leadEmail) {
        setEmailResponsavel(leadEmail);
      }

      setOrigemCrm(true);
      setFormError(null);
      setFormSuccess(null);
      setModalTab('dados_aluno');
      setShowModal(true);
    }
  }, [searchParams]);

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) {
      setFormError('CPF do aluno deve conter exatamente 11 dígitos.');
      return;
    }

    if (!nome.trim() || !nomeResponsavel.trim()) {
      setFormError('Nome do aluno e nome do responsável legal são obrigatórios.');
      return;
    }

    try {
      const payload = {
        nome,
        cpf,
        data_nascimento: dataNascimento,
        nome_responsavel: nomeResponsavel,
        cpf_responsavel_legal: cpfResponsavelLegal ? cpfResponsavelLegal : undefined,
        email_responsavel: emailResponsavel,
        telefone_responsavel: telefoneResponsavel,
        parentesco_responsavel_legal: parentescoResponsavelLegal,
        responsavel_financeiro_igual_legal: responsavelFinanceiroIgualLegal,
        nome_responsavel_financeiro: responsavelFinanceiroIgualLegal ? nomeResponsavel : nomeResponsavelFinanceiro,
        cpf_responsavel_financeiro: responsavelFinanceiroIgualLegal ? cpfResponsavelLegal : cpfResponsavelFinanceiro,
        email_responsavel_financeiro: responsavelFinanceiroIgualLegal ? emailResponsavel : emailResponsavelFinanceiro,
        telefone_responsavel_financeiro: responsavelFinanceiroIgualLegal ? telefoneResponsavel : telefoneResponsavelFinanceiro,
        parentesco_responsavel_financeiro: responsavelFinanceiroIgualLegal ? parentescoResponsavelLegal : parentescoResponsavelFinanceiro,
        cep: cep || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        estado: estado || undefined,
        telefone_secundario: telefoneSecundario || undefined,
        contato_emergencia_nome: contatoEmergenciaNome || undefined,
        contato_emergencia_telefone: contatoEmergenciaTelefone || undefined,
        contato_emergencia_parentesco: contatoEmergenciaParentesco || undefined,
        tipo_sanguineo: tipoSanguineo || 'Não informado',
        alergias: alergias || undefined,
        restricoes_alimentares: restricoesAlimentares || undefined,
        medicamentos_continuos: medicamentosContinuos || undefined,
        cuidados_especiais: cuidadosEspeciais || undefined,
        historico_observacoes: historicoObservacoes || undefined,
        status: statusInicialMatricula,
      };

      await apiFetch<Aluno>('/secretaria/matriculas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFormSuccess(
        statusInicialMatricula === 'pre_matricula'
          ? 'Pré-matrícula cadastrada com sucesso!'
          : 'Matrícula e prontuário inicial cadastrados com sucesso!'
      );
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        void loadAlunos();
        void loadCatalogo();
      }, 900);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      if (errorMsg.includes('409') || errorMsg.toLowerCase().includes('conflito') || errorMsg.toLowerCase().includes('duplicate')) {
        setFormError('CPF já cadastrado para esta instituição de ensino (Conflito 409).');
      } else {
        setFormError(errorMsg || 'Não foi possível concluir a matrícula.');
      }
    }
  };

  const resetForm = () => {
    setNome('');
    setCpf('');
    setNomeResponsavel('');
    setCpfResponsavelLegal('');
    setEmailResponsavel('');
    setTelefoneResponsavel('');
    setResponsavelFinanceiroIgualLegal(true);
    setNomeResponsavelFinanceiro('');
    setCpfResponsavelFinanceiro('');
    setEmailResponsavelFinanceiro('');
    setTelefoneResponsavelFinanceiro('');
    setCep('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setTelefoneSecundario('');
    setContatoEmergenciaNome('');
    setContatoEmergenciaTelefone('');
    setAlergias('');
    setRestricoesAlimentares('');
    setMedicamentosContinuos('');
    setCuidadosEspeciais('');
    setHistoricoObservacoes('');
    setStatusInicialMatricula('ativo');
    setOrigemCrm(false);
    setFormSuccess(null);
    setFormError(null);
    setModalTab('dados_aluno');
  };

  const resetTurmaForm = () => {
    setNomeTurma('');
    setCodigoTurma('');
    setEtapaEnsinoTurma('Ensino Fundamental I');
    setSerieTurma('1º Ano');
    setTurnoTurma('Matutino');
    setAnoLetivoTurma(2026);
    setCapacidadeTurma(30);
    setSalaIdTurma('');
    setProfessorRegenteIdTurma('');
  };

  const handleCriarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nome: nomeTurma,
        codigo: codigoTurma || undefined,
        etapa_ensino: etapaEnsinoTurma,
        serie: serieTurma || undefined,
        turno: turnoTurma,
        ano_letivo: anoLetivoTurma,
        capacidade_maxima: capacidadeTurma,
        sala_id: salaIdTurma || undefined,
        professor_regente_id: professorRegenteIdTurma || undefined,
      };
      const novaTurma = await apiFetch<Turma>('/secretaria/turmas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const salaEscolhida = salas.find((s) => s.id === salaIdTurma);
      const profEscolhido = professores.find((p) => p.id === professorRegenteIdTurma);
      const turmaComDetalhes: Turma = {
        ...novaTurma,
        sala_nome: salaEscolhida ? salaEscolhida.nome : undefined,
        professor_regente_nome: profEscolhido ? profEscolhido.name : undefined,
        alunos_matriculados: 0,
        vagas_restantes: capacidadeTurma,
      };
      setTurmas((prev) => [turmaComDetalhes, ...prev]);
      setTurmasCatalogo((prev) => [turmaComDetalhes, ...prev]);
      setShowTurmaModal(false);
      resetTurmaForm();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível criar a turma.');
    }
  };

  const handleVerAlunosTurma = async (turma: Turma) => {
    setSelectedTurmaAlunosModal(turma);
    setLoadingTurmaAlunos(true);
    setTurmaAlunosMsg(null);
    setAlunoParaTransferir(null);
    try {
      const data = await apiFetch<AlunoTurmaDetalhado[]>(`/secretaria/turmas/${turma.id}/alunos`);
      setTurmaAlunos(data);
    } catch (err: unknown) {
      setTurmaAlunos([]);
      setTurmaAlunosMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível carregar os alunos da turma.',
      });
    } finally {
      setLoadingTurmaAlunos(false);
    }
  };

  const handleRenumerarChamada = async () => {
    if (!selectedTurmaAlunosModal) return;
    try {
      await apiFetch(`/secretaria/turmas/${selectedTurmaAlunosModal.id}/renumerar-chamada`, {
        method: 'POST',
      });
      const data = await apiFetch<AlunoTurmaDetalhado[]>(`/secretaria/turmas/${selectedTurmaAlunosModal.id}/alunos`);
      setTurmaAlunos(data);
      setTurmaAlunosMsg({ type: 'success', text: 'Chamada renumerada em ordem alfabética (1..N) com sucesso!' });
    } catch (err: unknown) {
      setTurmaAlunosMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível renumerar a chamada.',
      });
    }
  };

  const handleDesenturmarAluno = async (alunoId: string, nomeAluno: string) => {
    if (!selectedTurmaAlunosModal) return;
    if (!confirm(`Deseja desenturmar o aluno ${nomeAluno} da turma ${selectedTurmaAlunosModal.nome}?`)) return;

    try {
      await apiFetch(`/secretaria/turmas/${selectedTurmaAlunosModal.id}/alunos/${alunoId}`, {
        method: 'DELETE',
      });
      setTurmaAlunos((prev) => prev.filter((a) => a.aluno_id !== alunoId));
      const desenturmarMap = (t: Turma) =>
        t.id === selectedTurmaAlunosModal.id
          ? {
              ...t,
              alunos_matriculados: Math.max(0, (t.alunos_matriculados || 1) - 1),
              vagas_restantes: (t.vagas_restantes || 0) + 1,
            }
          : t;
      setTurmas((prev) => prev.map(desenturmarMap));
      setTurmasCatalogo((prev) => prev.map(desenturmarMap));
      setTurmaAlunosMsg({ type: 'success', text: `Aluno ${nomeAluno} desenturmado com sucesso!` });
    } catch (err: unknown) {
      setTurmaAlunosMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível desenturmar o aluno.',
      });
    }
  };

  const handleExecutarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaAlunosModal || !alunoParaTransferir || !turmaDestinoTransferenciaId) return;

    setTransferindo(true);
    try {
      await apiFetch('/secretaria/turmas/transferir', {
        method: 'POST',
        body: JSON.stringify({
          aluno_id: alunoParaTransferir.aluno_id,
          turma_origem_id: selectedTurmaAlunosModal.id,
          turma_destino_id: turmaDestinoTransferenciaId,
        }),
      });

      setTurmaAlunos((prev) => prev.filter((a) => a.aluno_id !== alunoParaTransferir.aluno_id));
      const transferMap = (t: Turma) => {
        if (t.id === selectedTurmaAlunosModal.id) {
          return {
            ...t,
            alunos_matriculados: Math.max(0, (t.alunos_matriculados || 1) - 1),
            vagas_restantes: (t.vagas_restantes || 0) + 1,
          };
        }
        if (t.id === turmaDestinoTransferenciaId) {
          return {
            ...t,
            alunos_matriculados: (t.alunos_matriculados || 0) + 1,
            vagas_restantes: Math.max(0, (t.vagas_restantes || 1) - 1),
          };
        }
        return t;
      };
      setTurmas((prev) => prev.map(transferMap));
      setTurmasCatalogo((prev) => prev.map(transferMap));
      setTurmaAlunosMsg({
        type: 'success',
        text: `Aluno ${alunoParaTransferir.nome} transferido de turma com sucesso!`,
      });
      setAlunoParaTransferir(null);
      setTurmaDestinoTransferenciaId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na transferência';
      setTurmaAlunosMsg({ type: 'error', text: msg });
    } finally {
      setTransferindo(false);
    }
  };

  const handleExcluirTurma = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir a turma "${nome}"?`)) return;
    try {
      await apiFetch(`/secretaria/turmas/${id}`, { method: 'DELETE' });
      setTurmas((prev) => prev.filter((t) => t.id !== id));
      setTurmasCatalogo((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível excluir a turma.');
    }
  };

  const handleEnsalamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaParaEnsalamento || !selectedAlunoIdParaEnsalamento) return;
    try {
      await apiFetch('/secretaria/turmas/matricular', {
        method: 'POST',
        body: JSON.stringify({
          turma_id: selectedTurmaParaEnsalamento.id,
          aluno_id: selectedAlunoIdParaEnsalamento,
        }),
      });
      const ensalamentoMap = (t: Turma) =>
        t.id === selectedTurmaParaEnsalamento.id
          ? {
              ...t,
              alunos_matriculados: (t.alunos_matriculados || 0) + 1,
              vagas_restantes: Math.max(0, (t.vagas_restantes || t.capacidade_maxima) - 1),
            }
          : t;
      setTurmas((prev) => prev.map(ensalamentoMap));
      setTurmasCatalogo((prev) => prev.map(ensalamentoMap));
      setEnsalamentoSuccess('Aluno enturmado com sucesso!');
      setTimeout(() => {
        setShowEnsalamentoModal(false);
        setSelectedTurmaParaEnsalamento(null);
        setSelectedAlunoIdParaEnsalamento('');
        setEnsalamentoSuccess(null);
      }, 700);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível enturmar o aluno.');
    }
  };

  const handleDeleteAluno = async (id: string) => {
    if (!confirm('Deseja inativar esta matrícula? O histórico e o prontuário serão preservados.')) return;
    try {
      await apiFetch(`/secretaria/alunos/${id}`, { method: 'DELETE' });
      setToastMsg('Aluno inativado com sucesso.');
      setMenuStatusAlunoId(null);
      void loadAlunos();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível inativar a matrícula.');
    }
  };

  const handleAlterarStatus = async (aluno: Aluno, novoStatus: string) => {
    const label = labelStatusAluno(novoStatus);
    if (!confirm(`Alterar status de ${aluno.nome} para “${label}”?`)) return;
    try {
      await apiFetch<Aluno>(`/secretaria/alunos/${aluno.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: novoStatus }),
      });
      setToastMsg(`Status atualizado para ${label}.`);
      setMenuStatusAlunoId(null);
      void loadAlunos();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível alterar o status.');
    }
  };

  const handleViewProntuario = async (aluno: Aluno) => {
    setIsEditingProntuario(false);
    setProntuarioSuccess(null);
    try {
      const data = await apiFetch<{
        aluno: Aluno;
        prontuario: ProntuarioData;
      }>(`/secretaria/prontuarios/${aluno.id}`);
      setSelectedProntuarioModal(data);
      initProntuarioEditFields(data.prontuario);
    } catch (err: unknown) {
      setSelectedProntuarioModal(null);
      setFetchError(err instanceof Error ? err.message : 'Não foi possível carregar o prontuário.');
    }
  };

  const initProntuarioEditFields = (p: ProntuarioData) => {
    setEditTipoSanguineo(p.tipo_sanguineo || 'Não informado');
    setEditAlergias(p.alergias || '');
    setEditRestricoes(p.restricoes_alimentares || '');
    setEditMedicamentos(p.medicamentos_continuos || '');
    setEditCuidados(p.cuidados_especiais || '');
    setEditHistorico(p.historico_observacoes || '');
  };

  const handleSalvarProntuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProntuarioModal) return;
    setProntuarioSuccess(null);

    const payload: ProntuarioData = {
      tipo_sanguineo: editTipoSanguineo,
      alergias: editAlergias,
      restricoes_alimentares: editRestricoes,
      medicamentos_continuos: editMedicamentos,
      cuidados_especiais: editCuidados,
      historico_observacoes: editHistorico,
    };

    try {
      const updated = await apiFetch<ProntuarioData>(`/secretaria/prontuarios/${selectedProntuarioModal.aluno.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSelectedProntuarioModal({
        aluno: selectedProntuarioModal.aluno,
        prontuario: updated,
      });
      setProntuarioSuccess('Prontuário clínico atualizado com sucesso!');
      setIsEditingProntuario(false);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível salvar o prontuário.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalAlunos / PAGE_SIZE));
  const fromItem = totalAlunos === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toItem = Math.min(page * PAGE_SIZE, totalAlunos);
  const contagemMap = Object.fromEntries(contagemStatus.map((c) => [c.status, c.total]));
  const turmasReferencia = turmasCatalogo.length > 0 ? turmasCatalogo : turmas;
  const anosLetivosTurma = Array.from(new Set(turmasReferencia.map((t) => t.ano_letivo))).sort((a, b) => b - a);
  const turmasFiltradas = turmas.filter((t) => {
    const q = filtroTurmaTexto.trim().toLowerCase();
    const matchTexto =
      !q ||
      t.nome.toLowerCase().includes(q) ||
      (t.codigo || '').toLowerCase().includes(q) ||
      (t.serie || '').toLowerCase().includes(q) ||
      (t.etapa_ensino || '').toLowerCase().includes(q);
    const matchAno = !filtroTurmaAno || String(t.ano_letivo) === filtroTurmaAno;
    const matchTurno = !filtroTurmaTurno || (t.turno || '').toLowerCase() === filtroTurmaTurno.toLowerCase();
    return matchTexto && matchAno && matchTurno;
  });

  return (
    <section id="secretaria" className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {fetchError && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{fetchError}</p>
          </div>
          <button
            onClick={() => {
              void loadAlunos();
              void loadCatalogo();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Tentar Novamente
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between gap-3">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="text-emerald-700 dark:text-emerald-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
            <span>Portal da Secretaria & Matrícula Online</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Gestão integral de alunos, responsáveis legal/financeiro, endereço, contatos de emergência e prontuário médico.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeTab === 'alunos' && (
            <button
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setOrigemCrm(false);
                setModalTab('dados_aluno');
                setShowModal(true);
              }}
              className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Nova Matrícula Completa</span>
            </button>
          )}
          {activeTab === 'turmas' && (
            <button
              onClick={() => setShowTurmaModal(true)}
              className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Nova Turma</span>
            </button>
          )}
        </div>
      </div>

      {/* Abas Superiores de Navegação */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
        <button
          type="button"
          onClick={() => handleTabChange('alunos')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'alunos'
              ? 'border-salvia-600 text-salvia-700 dark:text-salvia-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Alunos & Matrículas</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('turmas')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'turmas'
              ? 'border-salvia-600 text-salvia-700 dark:text-salvia-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Turmas & Ensalamento</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('contratos')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'contratos'
              ? 'border-salvia-600 text-salvia-700 dark:text-salvia-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Contratos & Parcelas</span>
        </button>
      </div>

      {/* Renderização Condicional: Alunos vs Turmas vs Contratos */}
      {activeTab === 'alunos' && (
        <AlunosPanel
          contagemStatus={contagemStatus}
          contagemMap={contagemMap}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          filtroTurmaId={filtroTurmaId}
          setFiltroTurmaId={setFiltroTurmaId}
          setFiltroSemTurma={setFiltroSemTurma}
          turmasReferencia={turmasReferencia}
          filtroAnoLetivo={filtroAnoLetivo}
          setFiltroAnoLetivo={setFiltroAnoLetivo}
          anosLetivosTurma={anosLetivosTurma}
          filtroSemTurma={filtroSemTurma}
          setSearchDebounced={setSearchDebounced}
          loading={loading}
          alunos={alunos}
          handleViewProntuario={handleViewProntuario}
          menuStatusAlunoId={menuStatusAlunoId}
          setMenuStatusAlunoId={setMenuStatusAlunoId}
          handleAlterarStatus={handleAlterarStatus}
          handleDeleteAluno={handleDeleteAluno}
          fromItem={fromItem}
          toItem={toItem}
          totalAlunos={totalAlunos}
          page={page}
          totalPages={totalPages}
        />
      )}

      {activeTab === 'turmas' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c120e]/80 p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative sm:col-span-1">
                {loadingTurmas ? (
                  <Loader2 className="w-4 h-4 text-salvia-600 animate-spin absolute left-3 top-2.5" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                )}
                <input
                  type="text"
                  value={filtroTurmaTexto}
                  onChange={(e) => setFiltroTurmaTexto(e.target.value)}
                  placeholder="Buscar turma, código ou série..."
                  className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
                {filtroTurmaTexto && (
                  <button
                    type="button"
                    onClick={() => setFiltroTurmaTexto('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={filtroTurmaAno}
                onChange={(e) => setFiltroTurmaAno(e.target.value)}
                className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100"
              >
                <option value="">Todos os anos letivos</option>
                {anosLetivosTurma.map((ano) => (
                  <option key={ano} value={String(ano)}>{ano}</option>
                ))}
              </select>
              <select
                value={filtroTurmaTurno}
                onChange={(e) => setFiltroTurmaTurno(e.target.value)}
                className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100"
              >
                <option value="">Todos os turnos</option>
                <option value="Matutino">Matutino</option>
                <option value="Vespertino">Vespertino</option>
                <option value="Noturno">Noturno</option>
                <option value="Integral">Integral</option>
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
              <span className="flex items-center gap-1.5 font-medium">
                {loadingTurmas ? (
                  <>
                    <Loader2 className="w-3 h-3 text-salvia-600 animate-spin" />
                    <span>Buscando turmas...</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-3 h-3 text-salvia-600" />
                    <span>
                      {turmasFiltradas.length}{' '}
                      {turmasFiltradas.length === 1 ? 'turma encontrada' : 'turmas encontradas'}
                      {(filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno) && ' (filtro ativo)'}
                    </span>
                  </>
                )}
              </span>
              {(filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroTurmaTexto('');
                    setFiltroTurmaAno('');
                    setFiltroTurmaTurno('');
                  }}
                  className="text-xs font-semibold text-salvia-700 hover:text-salvia-800 dark:text-salvia-400 dark:hover:text-salvia-300 underline transition"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {turmasFiltradas.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400 space-y-3">
                {loadingTurmas ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <Loader2 className="w-6 h-6 text-salvia-600 animate-spin" />
                    <p className="text-xs">Buscando turmas no servidor...</p>
                  </div>
                ) : filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno ? (
                  <div className="space-y-2">
                    <p>Nenhuma turma corresponde aos filtros aplicados.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTurmaTexto('');
                        setFiltroTurmaAno('');
                        setFiltroTurmaTurno('');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-salvia-700 dark:text-salvia-400 hover:underline"
                    >
                      <RotateCw className="w-3 h-3" />
                      Redefinir filtros de busca
                    </button>
                  </div>
                ) : (
                  <p>Nenhuma turma cadastrada. Use “Criar Nova Turma” para abrir a primeira.</p>
                )}
              </div>
            ) : turmasFiltradas.map((t) => {
              const matriculados = t.alunos_matriculados || 0;
              const vagasLivres = Math.max(0, t.capacidade_maxima - matriculados);
              const percentualOcupacao = Math.min(100, Math.round((matriculados / t.capacidade_maxima) * 100));

              return (
                <div key={t.id} className="p-4 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 shadow-sm hover:border-salvia-500/50 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.nome}</h3>
                        {t.codigo && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {t.codigo}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span>Ano Letivo {t.ano_letivo}</span>
                        <span>•</span>
                        <span className="font-semibold text-salvia-700 dark:text-salvia-400">{t.turno || 'Matutino'}</span>
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        vagasLivres > 0
                          ? 'bg-salvia-100 dark:bg-salvia-900/60 border-salvia-300 dark:border-salvia-600/40 text-salvia-800 dark:text-salvia-200'
                          : 'bg-rose-100 dark:bg-rose-900/60 border-rose-300 dark:border-rose-600/40 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      {vagasLivres > 0 ? `${vagasLivres} Vagas Disponíveis` : 'Turma Lotada'}
                    </span>
                  </div>

                  {/* Metadados Pedagógicos: Etapa, Série, Sala e Regente */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-[#141d17] p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                      <GraduationCap className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                      <span className="truncate" title={`${t.etapa_ensino || 'Fundamental'} - ${t.serie || 'Geral'}`}>
                        {t.etapa_ensino ? `${t.etapa_ensino}${t.serie ? ` (${t.serie})` : ''}` : 'Etapa Regular'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                      <DoorOpen className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                      <span className="truncate" title={t.sala_nome || 'Sala não atribuída'}>
                        {t.sala_nome ? t.sala_nome : 'Sala não atribuída'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <School className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                      <span className="truncate" title={t.professor_regente_nome ? `Regente: ${t.professor_regente_nome}` : 'Sem professor regente definido'}>
                        {t.professor_regente_nome ? `Regente: ${t.professor_regente_nome}` : 'Sem regente definido'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Ocupação & Vagas */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-600 dark:text-slate-400">Ocupação da Turma:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {matriculados} / {t.capacidade_maxima} alunos ({percentualOcupacao}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          percentualOcupacao >= 100
                            ? 'bg-rose-600'
                            : percentualOcupacao >= 80
                            ? 'bg-amber-500'
                            : 'bg-salvia-600'
                        }`}
                        style={{ width: `${percentualOcupacao}%` }}
                      />
                    </div>
                  </div>

                  {/* Ações da Turma */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <button
                      onClick={() => handleVerAlunosTurma(t)}
                      className="px-3 py-1.5 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Ver Alunos & Chamada</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setSelectedTurmaParaEnsalamento(t);
                          if (alunos.length > 0) {
                            setSelectedAlunoIdParaEnsalamento(alunos[0].id);
                          }
                          void loadAlunosEnsalamento().then(() => setShowEnsalamentoModal(true));
                        }}
                        className="px-2.5 py-1.5 bg-white dark:bg-[#141d17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all"
                        title="Enturmar Aluno"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-salvia-600" />
                        <span>Enturmar</span>
                      </button>

                      <button
                        onClick={() => handleExcluirTurma(t.id, t.nome)}
                        className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg transition-all"
                        title="Excluir Turma"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'contratos' && (
        <ContratosPanel
          alunos={alunos}
          onNavigateToFinanceiro={() => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('route', 'financeiro');
              url.searchParams.set('tab', 'ar');
              window.location.href = url.toString();
            }
          }}
        />
      )}

      {/* Modal Matrícula Online Completa (Multi-Tabs) */}
      {showModal && (
        <MatriculaModal
          setShowModal={setShowModal}
          modalTab={modalTab}
          setModalTab={setModalTab}
          formError={formError}
          formSuccess={formSuccess}
          origemCrm={origemCrm}
          handleMatricular={handleMatricular}
          nome={nome}
          setNome={setNome}
          cpf={cpf}
          setCpf={setCpf}
          dataNascimento={dataNascimento}
          setDataNascimento={setDataNascimento}
          statusInicialMatricula={statusInicialMatricula}
          setStatusInicialMatricula={setStatusInicialMatricula}
          nomeResponsavel={nomeResponsavel}
          setNomeResponsavel={setNomeResponsavel}
          parentescoResponsavelLegal={parentescoResponsavelLegal}
          setParentescoResponsavelLegal={setParentescoResponsavelLegal}
          cpfResponsavelLegal={cpfResponsavelLegal}
          setCpfResponsavelLegal={setCpfResponsavelLegal}
          telefoneResponsavel={telefoneResponsavel}
          setTelefoneResponsavel={setTelefoneResponsavel}
          emailResponsavel={emailResponsavel}
          setEmailResponsavel={setEmailResponsavel}
          responsavelFinanceiroIgualLegal={responsavelFinanceiroIgualLegal}
          setResponsavelFinanceiroIgualLegal={setResponsavelFinanceiroIgualLegal}
          nomeResponsavelFinanceiro={nomeResponsavelFinanceiro}
          setNomeResponsavelFinanceiro={setNomeResponsavelFinanceiro}
          parentescoResponsavelFinanceiro={parentescoResponsavelFinanceiro}
          setParentescoResponsavelFinanceiro={setParentescoResponsavelFinanceiro}
          cpfResponsavelFinanceiro={cpfResponsavelFinanceiro}
          setCpfResponsavelFinanceiro={setCpfResponsavelFinanceiro}
          telefoneResponsavelFinanceiro={telefoneResponsavelFinanceiro}
          setTelefoneResponsavelFinanceiro={setTelefoneResponsavelFinanceiro}
          emailResponsavelFinanceiro={emailResponsavelFinanceiro}
          setEmailResponsavelFinanceiro={setEmailResponsavelFinanceiro}
          cep={cep}
          setCep={setCep}
          logradouro={logradouro}
          setLogradouro={setLogradouro}
          numero={numero}
          setNumero={setNumero}
          complemento={complemento}
          setComplemento={setComplemento}
          bairro={bairro}
          setBairro={setBairro}
          cidade={cidade}
          setCidade={setCidade}
          estado={estado}
          setEstado={setEstado}
          telefoneSecundario={telefoneSecundario}
          setTelefoneSecundario={setTelefoneSecundario}
          contatoEmergenciaNome={contatoEmergenciaNome}
          setContatoEmergenciaNome={setContatoEmergenciaNome}
          contatoEmergenciaTelefone={contatoEmergenciaTelefone}
          setContatoEmergenciaTelefone={setContatoEmergenciaTelefone}
          contatoEmergenciaParentesco={contatoEmergenciaParentesco}
          setContatoEmergenciaParentesco={setContatoEmergenciaParentesco}
          tipoSanguineo={tipoSanguineo}
          setTipoSanguineo={setTipoSanguineo}
          alergias={alergias}
          setAlergias={setAlergias}
          restricoesAlimentares={restricoesAlimentares}
          setRestricoesAlimentares={setRestricoesAlimentares}
          medicamentosContinuos={medicamentosContinuos}
          setMedicamentosContinuos={setMedicamentosContinuos}
          cuidadosEspeciais={cuidadosEspeciais}
          setCuidadosEspeciais={setCuidadosEspeciais}
          historicoObservacoes={historicoObservacoes}
          setHistoricoObservacoes={setHistoricoObservacoes}
        />
      )}

      {/* Modal Visualizador e Editor do Prontuário Médico (Modularizado) */}
      <ProntuarioModal
        data={selectedProntuarioModal}
        onClose={() => setSelectedProntuarioModal(null)}
        onSaved={(updated) => {
          setSelectedProntuarioModal((prev) => (prev ? { ...prev, prontuario: updated } : null));
          setAlunos((prev) =>
            prev.map((a) => (a.id === selectedProntuarioModal?.aluno.id ? { ...a } : a))
          );
        }}
      />

      {/* Modal Criar Nova Turma Completa */}
      {showTurmaModal && (
        <NovaTurmaModal
          setShowTurmaModal={setShowTurmaModal}
          resetTurmaForm={resetTurmaForm}
          handleCriarTurma={handleCriarTurma}
          nomeTurma={nomeTurma}
          setNomeTurma={setNomeTurma}
          codigoTurma={codigoTurma}
          setCodigoTurma={setCodigoTurma}
          etapaEnsinoTurma={etapaEnsinoTurma}
          setEtapaEnsinoTurma={setEtapaEnsinoTurma}
          serieTurma={serieTurma}
          setSerieTurma={setSerieTurma}
          turnoTurma={turnoTurma}
          setTurnoTurma={setTurnoTurma}
          anoLetivoTurma={anoLetivoTurma}
          setAnoLetivoTurma={setAnoLetivoTurma}
          capacidadeTurma={capacidadeTurma}
          setCapacidadeTurma={setCapacidadeTurma}
          salaIdTurma={salaIdTurma}
          setSalaIdTurma={setSalaIdTurma}
          salas={salas}
          professorRegenteIdTurma={professorRegenteIdTurma}
          setProfessorRegenteIdTurma={setProfessorRegenteIdTurma}
          professores={professores}
        />
      )}

      {/* Modal Alunos da Turma & Livro de Chamada */}
      {selectedTurmaAlunosModal && (
        <TurmaAlunosModal
          selectedTurmaAlunosModal={selectedTurmaAlunosModal}
          setSelectedTurmaAlunosModal={setSelectedTurmaAlunosModal}
          turmaAlunos={turmaAlunos}
          loadingTurmaAlunos={loadingTurmaAlunos}
          handleRenumerarChamada={handleRenumerarChamada}
          turmaAlunosMsg={turmaAlunosMsg}
          setTurmaAlunosMsg={setTurmaAlunosMsg}
          alunoParaTransferir={alunoParaTransferir}
          setAlunoParaTransferir={setAlunoParaTransferir}
          handleExecutarTransferencia={handleExecutarTransferencia}
          turmaDestinoTransferenciaId={turmaDestinoTransferenciaId}
          setTurmaDestinoTransferenciaId={setTurmaDestinoTransferenciaId}
          turmasReferencia={turmasReferencia}
          transferindo={transferindo}
          handleDesenturmarAluno={handleDesenturmarAluno}
        />
      )}

      {/* Modal Ensalamento Interativo (Modularizado) */}
      <EnsalamentoModal
        isOpen={showEnsalamentoModal}
        turma={selectedTurmaParaEnsalamento}
        alunos={alunosEnsalamento}
        onClose={() => setShowEnsalamentoModal(false)}
        onSuccess={() => {
          void loadAlunos();
          void loadCatalogo();
          void loadAlunosEnsalamento();
        }}
      />
    </section>
  );
}
