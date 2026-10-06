// Validação do payload do RF-02 na API (fail fast). Estoque, validade e unidade
// dependem do produto e são conferidos pela função registrar_venda no banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /vendas — corpo: { itens: [{ produto_id, quantidade }] }, de 1 a 30 itens.
 * @returns {{ok:true, itens:Object[]} | {ok:false, erro:string}}
 */
export function validarVenda(corpo) {
  const itens = corpo?.itens;
  if (!Array.isArray(itens) || itens.length < 1 || itens.length > 30) {
    return { ok: false, erro: 'Informe de 1 a 30 itens na venda.' };
  }
  for (const item of itens) {
    if (!UUID.test(String(item?.produto_id ?? ''))) return { ok: false, erro: 'Produto não encontrado.' };
    if (!(typeof item.quantidade === 'number' && item.quantidade > 0)) {
      return { ok: false, erro: 'A quantidade deve ser maior que zero.' };
    }
  }
  return { ok: true, itens: itens.map(({ produto_id, quantidade }) => ({ produto_id, quantidade })) };
}
