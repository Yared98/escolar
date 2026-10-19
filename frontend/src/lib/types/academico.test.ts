import { describe, expect, it } from 'vitest';
import {
  OCORRENCIA_DESCRICAO_MAX,
  TIPO_OCORRENCIA_LABEL,
  TIPOS_OCORRENCIA_FUNDAMENTAL,
  alunoTemResponsavel,
  dicaRecadoFamilia,
  formatarAvisoRecadoEnviado,
  formatarListaNomes,
  tipoOcorrenciaLabel,
  urlConversaAgenda,
} from './academico';

describe('tipoOcorrenciaLabel', () => {
  it('traduz os tipos do Fundamental para a linguagem da escola', () => {
    expect(tipoOcorrenciaLabel('comportamento')).toBe('Comportamento');
    expect(tipoOcorrenciaLabel('atraso')).toBe('Atraso');
    expect(tipoOcorrenciaLabel('falta_material')).toBe('Falta de material');
    expect(tipoOcorrenciaLabel('saude')).toBe('Saúde');
    expect(tipoOcorrenciaLabel('elogio')).toBe('Elogio');
    expect(tipoOcorrenciaLabel('outros')).toBe('Outros');
  });

  it('mantém os tipos históricos da Educação Infantil legíveis', () => {
    expect(tipoOcorrenciaLabel('febre')).toBe('Febre ou indisposição');
    expect(tipoOcorrenciaLabel('queda_arranhao')).toBe('Queda / arranhão');
    expect(tipoOcorrenciaLabel('atrito_colega')).toBe('Atrito com colega');
    // Grafia antiga gravada no banco antes da padronização.
    expect(tipoOcorrenciaLabel('outro')).toBe('Outros');
  });

  it('nunca mostra o código cru de um tipo desconhecido', () => {
    expect(tipoOcorrenciaLabel('grita')).toBe('Outros');
    expect(tipoOcorrenciaLabel('')).toBe('Outros');
  });

  it('todo tipo do formulário do professor tem nome amigável', () => {
    for (const tipo of TIPOS_OCORRENCIA_FUNDAMENTAL) {
      expect(TIPO_OCORRENCIA_LABEL[tipo.value]).toBe(tipo.label);
      expect(tipo.label.length).toBeGreaterThan(0);
    }
  });

  it('limita a descrição a 1000 caracteres', () => {
    expect(OCORRENCIA_DESCRICAO_MAX).toBe(1000);
  });
});

describe('helpers de recado à família (C16)', () => {
  it('alunoTemResponsavel identifica se o aluno possui responsável vinculado', () => {
    expect(alunoTemResponsavel({ responsavel_user_id: 'uuid-123' })).toBe(true);
    expect(alunoTemResponsavel({ responsavel_user_id: null })).toBe(false);
    expect(alunoTemResponsavel({ responsavel_user_id: undefined })).toBe(false);
    expect(alunoTemResponsavel({ responsavel_user_id: '' })).toBe(false);
  });

  it('dicaRecadoFamilia retorna a dica correta conforme o vínculo', () => {
    expect(dicaRecadoFamilia({ responsavel_user_id: 'uuid-123' })).toBe(
      'Enviar recado à família',
    );
    expect(dicaRecadoFamilia({ responsavel_user_id: null })).toBe(
      'Aluno sem responsável cadastrado',
    );
    expect(dicaRecadoFamilia({ responsavel_user_id: undefined })).toBe(
      'Aluno sem responsável cadastrado',
    );
  });

  it('formatarAvisoRecadoEnviado interpola o nome do responsável com fallback', () => {
    expect(formatarAvisoRecadoEnviado('Maria Silva')).toBe(
      'Recado enviado para Maria Silva',
    );
    expect(formatarAvisoRecadoEnviado('  João Santos  ')).toBe(
      'Recado enviado para João Santos',
    );
    expect(formatarAvisoRecadoEnviado('')).toBe(
      'Recado enviado para os responsáveis',
    );
    expect(formatarAvisoRecadoEnviado(undefined)).toBe(
      'Recado enviado para os responsáveis',
    );
  });

  it('formatarListaNomes formata 1, 2 ou mais nomes com pontuação correta', () => {
    expect(formatarListaNomes([])).toBe('');
    expect(formatarListaNomes(['Marina'])).toBe('Marina');
    expect(formatarListaNomes(['Marina', 'Paulo'])).toBe('Marina e Paulo');
    expect(formatarListaNomes(['Marina', 'Paulo', 'Carla'])).toBe('Marina, Paulo e Carla');
    expect(formatarListaNomes(['  Marina  ', '', ' Paulo '])).toBe('Marina e Paulo');
  });

  it('formatarAvisoRecadoEnviado suporta múltiplos responsáveis (C19)', () => {
    expect(formatarAvisoRecadoEnviado(['Marina', 'Paulo'])).toBe(
      'Recado enviado para Marina e Paulo',
    );
    expect(formatarAvisoRecadoEnviado(['Marina'])).toBe(
      'Recado enviado para Marina',
    );
    expect(formatarAvisoRecadoEnviado([])).toBe(
      'Recado enviado para os responsáveis',
    );
  });

  it('alunoTemResponsavel reconhece vínculo por responsaveis_com_acesso', () => {
    expect(
      alunoTemResponsavel({
        responsavel_user_id: null,
        responsaveis_com_acesso: [{ id: 'u1', nome: 'Marina' }],
      }),
    ).toBe(true);
    expect(
      alunoTemResponsavel({
        responsavel_user_id: null,
        responsaveis_com_acesso: [],
      }),
    ).toBe(false);
  });

  it('urlConversaAgenda monta a rota com parâmetros esperados', () => {
    expect(urlConversaAgenda('msg-uuid-999')).toBe(
      '/?route=agenda&tab=comunicacao&conversa=msg-uuid-999',
    );
  });
});
