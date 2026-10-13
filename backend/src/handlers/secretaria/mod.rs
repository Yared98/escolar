mod alunos;
mod contratos;
mod familia;
mod matricula;
mod prontuario;
mod salas;
mod turmas;
mod vinculos;

pub use alunos::{
    atualizar_aluno, deletar_aluno, listar_alunos, listar_meus_alunos, vincular_responsavel_aluno,
};
pub use contratos::{assinar_contrato, criar_contrato, listar_contratos, obter_contrato};
pub use familia::{
    atualizar_autorizado_retirada, criar_autorizado_retirada, criar_grupo_familiar,
    deletar_autorizado_retirada, listar_autorizados_retirada, listar_grupos_familiares,
};
pub use matricula::criar_matricula;
pub use prontuario::{obter_prontuario, salvar_prontuario};
pub use salas::{criar_sala, deletar_sala, listar_salas};
pub use turmas::{atualizar_turma, criar_turma, deletar_turma, listar_turmas, obter_turma};
pub use vinculos::{
    desenturmar_aluno_turma, listar_alunos_turma, matricular_aluno_turma, renumerar_chamada_turma,
    transferir_aluno_turma,
};
