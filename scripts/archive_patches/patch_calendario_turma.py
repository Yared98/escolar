import os
import re

with open('frontend/src/components/CalendarioEscolarSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix initial state
bad_state = """  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    tipo: 'outro',
    visibilidade: 'todos',
    exige_confirmacao: false
  });"""
good_state = """  const [formData, setFormData] = useState({
    turma_id: null as string | null,
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    tipo: 'outro',
    visibilidade: 'todos',
    exige_confirmacao: false
  });"""
content = content.replace(bad_state, good_state)

# Fix reset state in handleSubmit
bad_reset = """      setFormData({
        titulo: '',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        tipo: 'outro',
        visibilidade: 'todos',
    exige_confirmacao: false
      });"""
good_reset = """      setFormData({
        turma_id: null,
        titulo: '',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        tipo: 'outro',
        visibilidade: 'todos',
        exige_confirmacao: false
      });"""
content = content.replace(bad_reset, good_reset)

with open('frontend/src/components/CalendarioEscolarSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
