// Validação do payload do RF-04 na API (fail fast). Estoque, validade do produto,
// WhatsApp e limite de 20 ativos dependem do banco e são conferidos por publicar_doacao.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Data e hora com fuso explícito, ex.: 2026-10-01T18:00:00-03:00 (America/Fortaleza).
const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const MINUTO = 60_000;

/**
 * POST /doacoes — corpo: { produto_id, quantidade, prazo_retirada, observacao? }
 * @returns {{ok:true, doacao:Object} | {ok:false, erro:string}}
 */
export function validarDoacao(corpo, agora = Date.now()) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return { ok: false, erro: 'Envie os dados da doação em JSON.' };
  }
  const { produto_id: produtoId, quantidade, prazo_retirada: prazo, observacao, local_retirada: local } = corpo;

  if (!UUID.test(String(produtoId ?? ''))) return { ok: false, erro: 'Produto não encontrado.' };
  if (!(typeof quantidade === 'number' && Number.isFinite(quantidade) && quantidade > 0)) {
    return { ok: false, erro: 'A quantidade doada deve ser maior que zero.' };
  }

  const instante = DATA_HORA.test(String(prazo ?? '')) ? Date.parse(prazo) : NaN;
  if (Number.isNaN(instante)) return { ok: false, erro: 'Informe o prazo de retirada (data e hora).' };
  if (instante < agora + 30 * MINUTO) {
    return { ok: false, erro: 'O prazo de retirada deve ser de pelo menos 30 minutos a partir de agora.' };
  }
  if (instante > agora + 72 * 60 * MINUTO) {
    return { ok: false, erro: 'O prazo de retirada deve ser de no máximo 72 horas a partir de agora.' };
  }

  if (observacao !== undefined && observacao !== null) {
    if (typeof observacao !== 'string' || observacao.trim().length > 200) {
      return { ok: false, erro: 'A observação pode ter no máximo 200 caracteres.' };
    }
  }

  // Spec v1.2: local de retirada opcional; vazio = endereço do estabelecimento.
  if (local !== undefined && local !== null && local !== '') {
    if (typeof local !== 'string' || local.trim().length < 5 || local.trim().length > 150) {
      return { ok: false, erro: 'O local de retirada deve ter de 5 a 150 caracteres.' };
    }
  }

  return {
    ok: true,
    doacao: {
      produto_id: produtoId,
      quantidade,
      prazo_retirada: prazo,
      observacao: observacao?.trim() || null,
      local_retirada: local?.trim() || null,
    },
  };
}

/**
 * PATCH /doacoes/:id — corpo: { status: "retirado" | "cancelado" } (RF-04, regra 4).
 * @returns {{ok:true, status:string} | {ok:false, erro:string}}
 */
export function validarStatus(corpo) {
  const status = corpo?.status;
  if (!['retirado', 'cancelado'].includes(status) || Object.keys(corpo).length !== 1) {
    return { ok: false, erro: 'Use status "retirado" ou "cancelado".' };
  }
  return { ok: true, status };
}
