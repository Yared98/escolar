import os

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Promise.all block again to throw instead of catch
bad_block = """      const [tData, dData, pData, sData, projData, cData, simData] = await Promise.all([
        apiFetch<Turma[]>('/secretaria/turmas').catch(() => []),
        apiFetch<Disciplina[]>('/pedagogico/disciplinas').catch(() => []),
        apiFetch<ProfessorItem[]>('/pedagogico/professores').catch(() => []),
        apiFetch<SalaItem[]>('/secretaria/salas').catch(() => []),
        apiFetch<ProjetoEducacional[]>('/pedagogico/projetos').catch(() => []),
        apiFetch<Cardapio[]>('/nutricao/cardapios').catch(() => []),
        apiFetch<SimuladoTri[]>('/academico/simulados_tri').catch(() => []),
      ]);

      setTurmas(tData.length ? tData : mockTurmas); // fallback just in case
      setDisciplinas(dData);
      setProfessores(pData);
      setSalas(sData);
      setProjetos(projData);
      setCardapios(cData);
      setSimulados(simData.length ? simData : [
        { id: 'sim-1', titulo: 'Simulado Preditivo Enem', disciplina: 'Geral', data_aplicacao: '2026-06-15', total_itens: 90 }
      ]);"""

good_block = """      const [tData, dData, pData, sData, projData, cData, simData] = await Promise.all([
        apiFetch<Turma[]>('/secretaria/turmas'),
        apiFetch<Disciplina[]>('/pedagogico/disciplinas').catch(() => []),
        apiFetch<ProfessorItem[]>('/pedagogico/professores').catch(() => []),
        apiFetch<SalaItem[]>('/secretaria/salas').catch(() => []),
        apiFetch<ProjetoEducacional[]>('/pedagogico/projetos').catch(() => []),
        apiFetch<Cardapio[]>('/nutricao/cardapios').catch(() => []),
        apiFetch<SimuladoTri[]>('/academico/simulados_tri').catch(() => []),
      ]);

      if (!tData || tData.length === 0) throw new Error("Fallback");

      setTurmas(tData);
      setDisciplinas(dData);
      setProfessores(pData);
      setSalas(sData);
      setProjetos(projData);
      setCardapios(cData);
      setSimulados(simData.length ? simData : [
        { id: 'sim-1', titulo: 'Simulado Preditivo Enem', disciplina: 'Geral', data_aplicacao: '2026-06-15', total_itens: 90 }
      ]);"""

if bad_block in content:
    content = content.replace(bad_block, good_block)
else:
    print("Warning: bad_block not found!")

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
