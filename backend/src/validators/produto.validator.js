// Validação do payload JSON do RF-01 na API (fail fast, antes de ir ao banco).
// O cadastro reaproveita as regras do cliente (src/services/validarProduto.js);
// o banco repete as mesmas regras (Princípio do Oráculo).
import { validarProduto, hojeFortaleza } from '../../../src/services/validarProduto.js';
import { somarDias } from '../utils/validade.js';

const MSG_VENCIDO = 'Produto vencido não pode ser cadastrado para venda nem para doação.';
const CAMPOS_EDITAVEIS = ['preco_centavos', 'quantidade', 'data_validade'];

function ehObjeto(corpo) {
  return corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo);
}

/**
 * POST /produtos — corpo: { nome, unidade, quantidade, preco_centavos, data_validade (AAAA-MM-DD) }
 * @returns {{ok:true, registro:Object} | {ok:false, erro:string}}
 */
export function validarCadastro(corpo, hoje = hojeFortaleza()) {
  if (!ehObjeto(corpo)) return { ok: false, erro: 'Envie os dados do produto em JSON.' };
  // Centavos não inteiros viram NaN e caem na mesma mensagem de preço, na ordem dos campos.
  const { preco_centavos: precoCentavos } = corpo;
  const preco = Number.isInteger(precoCentavos) ? precoCentavos / 100 : NaN;
  return validarProduto({ ...corpo, preco, dataValidade: corpo.data_validade }, hoje);
}

/**
 * PATCH /produtos/:id — RF-01, regra 3: só preço, quantidade e validade podem mudar,
 * e a validade só pode ir para uma data válida pela regra 1.
 * @param {Object} produto registro atual (define a unidade usada na regra da quantidade)
 * @returns {{ok:true, mudancas:Object} | {ok:false, erro:string}}
 */
export function validarEdicao(corpo, produto, hoje = hojeFortaleza()) {
  if (!ehObjeto(corpo) || Object.keys(corpo).length === 0) {
    return { ok: false, erro: 'Informe ao menos um campo para editar: preco_centavos, quantidade ou data_validade.' };
  }
  if (Object.keys(corpo).some((campo) => !CAMPOS_EDITAVEIS.includes(campo))) {
    return { ok: false, erro: 'Só é possível editar preco_centavos, quantidade e data_validade.' };
  }

  if ('preco_centavos' in corpo) {
    const p = corpo.preco_centavos;
    if (!(Number.isInteger(p) && p >= 1 && p <= 999999)) {
      return { ok: false, erro: 'O preço deve ficar entre R$ 0,01 e R$ 9.999,99.' };
    }
  }

  if ('quantidade' in corpo) {
    const q = corpo.quantidade;
    if (produto.unidade === 'un' && !(Number.isInteger(q) && q >= 1 && q <= 9999)) {
      return { ok: false, erro: 'Para "un", informe um número inteiro de 1 a 9.999.' };
    }
    if (produto.unidade !== 'un' && !(typeof q === 'number' && q >= 0.1 && q <= 999.9 && Math.round(q * 10) === q * 10)) {
      return { ok: false, erro: 'Para kg ou L, informe de 0,1 a 999,9 com no máximo 1 casa decimal.' };
    }
  }

  if ('data_validade' in corpo) {
    const v = String(corpo.data_validade ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, erro: 'Informe a data de validade.' };
    if (v < hoje) return { ok: false, erro: MSG_VENCIDO };
    if (v > somarDias(hoje, 730)) return { ok: false, erro: 'A validade não pode passar de 2 anos a partir de hoje.' };
  }

  return { ok: true, mudancas: { ...corpo } };
}
