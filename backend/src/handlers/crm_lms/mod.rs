pub mod crm;
pub mod lms;
pub mod whatsapp;

pub use crm::{
    adicionar_interacao_lead, atualizar_lead, calcular_cac, calcular_taxa_conversao,
    capturar_lead_publico, criar_lead, listar_leads, obter_lead, relatorio_funil_crm,
    CreateLeadPublicDto, ListLeadsQuery,
};
pub use lms::{
    lti_grade_sync, lti_launch, normalizar_nota_lti, obter_lms_config, obter_scorm_track,
    salvar_lms_config, scorm_track, validar_status_scorm,
};
pub use whatsapp::{
    classificar_intencao_chatbot, limpar_telefone, listar_protocolos_atendimento,
    responder_protocolo_atendimento, whatsapp_webhook, whatsapp_webhook_verify, IntencaoChatbot,
};

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_limpar_telefone_remove_caracteres_especiais() {
        assert_eq!(limpar_telefone("+55 (11) 98765-4321"), "5511987654321");
        assert_eq!(limpar_telefone("11999998888"), "11999998888");
        assert_eq!(limpar_telefone("(21) 9123-4567"), "2191234567");
    }

    #[test]
    fn test_classificar_intencao_segunda_via_pix() {
        assert_eq!(
            classificar_intencao_chatbot("Preciso da 2a via do boleto de março"),
            IntencaoChatbot::SegundaViaPix
        );
        assert_eq!(
            classificar_intencao_chatbot("Gostaria de pagar a mensalidade via Pix"),
            IntencaoChatbot::SegundaViaPix
        );
        assert_eq!(
            classificar_intencao_chatbot("Qual o valor da minha fatura?"),
            IntencaoChatbot::SegundaViaPix
        );
    }

    #[test]
    fn test_classificar_intencao_cardapio() {
        assert_eq!(
            classificar_intencao_chatbot("Qual é o cardápio do almoço hoje?"),
            IntencaoChatbot::Cardapio
        );
        assert_eq!(
            classificar_intencao_chatbot("O que tem de lanche na alimentação escolar?"),
            IntencaoChatbot::Cardapio
        );
    }

    #[test]
    fn test_classificar_intencao_horarios_e_calendario() {
        assert_eq!(
            classificar_intencao_chatbot("Qual é o horário de saída da turma?"),
            IntencaoChatbot::Horarios
        );
        assert_eq!(
            classificar_intencao_chatbot("Teremos aula no feriado de sexta?"),
            IntencaoChatbot::Horarios
        );
    }

    #[test]
    fn test_classificar_intencao_transbordo_humano() {
        assert_eq!(
            classificar_intencao_chatbot("Quero falar com um atendente da secretaria"),
            IntencaoChatbot::HumanoTransbordo
        );
        assert_eq!(
            classificar_intencao_chatbot("Pode me transferir para uma pessoa humana?"),
            IntencaoChatbot::HumanoTransbordo
        );
    }

    #[test]
    fn test_classificar_intencao_saudacao_default() {
        assert_eq!(
            classificar_intencao_chatbot("Olá, bom dia!"),
            IntencaoChatbot::SaudacaoOutros
        );
        assert_eq!(
            classificar_intencao_chatbot("Como você funciona?"),
            IntencaoChatbot::SaudacaoOutros
        );
    }

    #[test]
    fn test_normalizar_nota_escala_0_a_10() {
        assert_eq!(normalizar_nota_lti(8.5), 8.5);
        assert_eq!(normalizar_nota_lti(10.0), 10.0);
        assert_eq!(normalizar_nota_lti(0.0), 0.0);
    }

    #[test]
    fn test_normalizar_nota_escala_0_a_100_converte_para_0_a_10() {
        assert_eq!(normalizar_nota_lti(85.0), 8.5);
        assert_eq!(normalizar_nota_lti(92.5), 9.25);
        assert_eq!(normalizar_nota_lti(100.0), 10.0);
    }

    #[test]
    fn test_normalizar_nota_clamping_seguro() {
        assert_eq!(normalizar_nota_lti(-5.0), 0.0);
        assert_eq!(normalizar_nota_lti(120.0), 10.0);
    }

    #[test]
    fn test_validar_status_scorm_cmi_normativo() {
        assert!(validar_status_scorm("passed"));
        assert!(validar_status_scorm("completed"));
        assert!(validar_status_scorm("failed"));
        assert!(validar_status_scorm("incomplete"));
        assert!(validar_status_scorm("browsed"));
        assert!(validar_status_scorm("not attempted"));
        assert!(validar_status_scorm("PASSED"));

        assert!(!validar_status_scorm("invalid_status"));
        assert!(!validar_status_scorm("iniciado"));
    }

    #[test]
    fn test_lti_launch_url_e_target_link_structure() {
        let platform_url = "https://moodle.escola.edu.br/";
        let client_id = "test-client-123";
        let state_token = "lti_state_test";

        let launch_url = format!(
            "{}/auth/lti/launch.php?id={}&state={}",
            platform_url.trim_end_matches('/'),
            client_id,
            state_token
        );
        let jwt_target_link = format!("{}/mod/lti/view.php", platform_url.trim_end_matches('/'));

        assert_eq!(
            launch_url,
            "https://moodle.escola.edu.br/auth/lti/launch.php?id=test-client-123&state=lti_state_test"
        );
        assert_eq!(
            jwt_target_link,
            "https://moodle.escola.edu.br/mod/lti/view.php"
        );
    }

    #[test]
    fn test_calcular_cac_divisao_correta() {
        let cac = calcular_cac(12000.0, 40);
        assert_eq!(cac, 300.0);

        let cac_fracionario = calcular_cac(5555.55, 13);
        assert_eq!(cac_fracionario, 427.35);
    }

    #[test]
    fn test_calcular_cac_zero_matriculados() {
        assert_eq!(calcular_cac(5000.0, 0), 0.0);
        assert_eq!(calcular_cac(0.0, 0), 0.0);
    }

    #[test]
    fn test_calcular_taxa_conversao_percentual() {
        let taxa = calcular_taxa_conversao(200, 50);
        assert_eq!(taxa, 25.0);

        let taxa_frac = calcular_taxa_conversao(300, 45);
        assert_eq!(taxa_frac, 15.0);
    }

    #[test]
    fn test_calcular_taxa_conversao_zero_leads() {
        assert_eq!(calcular_taxa_conversao(0, 0), 0.0);
    }
}
