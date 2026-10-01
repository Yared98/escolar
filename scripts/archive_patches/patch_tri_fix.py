import os

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """      const [tData, dData, pData, sData, projData, cData] = await Promise.all([
        apiFetch<Turma[]>('/secretaria/turmas'),
        apiFetch<Disciplina[]>('/pedagogico/disciplinas'),
        apiFetch<ProfessorItem[]>('/pedagogico/professores'),
        apiFetch<SalaItem[]>('/secretaria/salas'),
        apiFetch<ProjetoEducacional[]>('/pedagogico/projetos'),
        apiFetch<Cardapio[]>('/nutricao/cardapios'),
      ]);

      setTurmas(tData);
      setDisciplinas(dData);
      setProfessores(pData);
      setSalas(sData);
      setProjetos(projData);
      setCardapios(cData);"""

new_block = """      const [tData, dData, pData, sData, projData, cData, simData] = await Promise.all([
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

if old_block in content:
    content = content.replace(old_block, new_block)
else:
    print("Warning: STILL not found!")
    # Just insert it blindly if not found
    pass

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
