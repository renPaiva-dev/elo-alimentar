// Validação do RF-01 no cliente (fail fast), espelhando as regras da
// ESPECIFICACAO-MVP.md. O banco repete as mesmas regras (Princípio do Oráculo).

const MSG_VENCIDO = 'Produto vencido não pode ser cadastrado para venda nem para doação.';

/** Data de hoje no fuso America/Fortaleza, no formato AAAA-MM-DD. */
export function hojeFortaleza(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(agora);
}

function somarDias(isoData, dias) {
  const d = new Date(`${isoData}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Valida os dados do formulário e devolve o registro pronto para o banco.
 * @param {{nome:string, unidade:string, quantidade:number, preco:number, dataValidade:string}} dados
 *   preco em reais (ex.: 3.5) e dataValidade em AAAA-MM-DD
 * @param {string} hoje data de referência AAAA-MM-DD (injetável nos testes)
 * @returns {{ok:true, registro:Object} | {ok:false, erro:string}}
 */
export function validarProduto(dados, hoje = hojeFortaleza()) {
  if (!dados || typeof dados !== 'object') return { ok: false, erro: 'Os dados do formulário não podem estar vazios.' };

  const nome = String(dados.nome ?? '').trim();
  if (nome.length < 2 || nome.length > 60) return { ok: false, erro: 'O nome deve ter de 2 a 60 caracteres.' };

  const { unidade } = dados;
  if (!['un', 'kg', 'L'].includes(unidade)) return { ok: false, erro: 'Escolha a unidade: un, kg ou L.' };

  const quantidade = Number(dados.quantidade);
  if (unidade === 'un' && !(Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 9999)) {
    return { ok: false, erro: 'Para "un", informe um número inteiro de 1 a 9.999.' };
  }
  if (unidade !== 'un' && !(quantidade >= 0.1 && quantidade <= 999.9 && Math.round(quantidade * 10) === quantidade * 10)) {
    return { ok: false, erro: 'Para kg ou L, informe de 0,1 a 999,9 com no máximo 1 casa decimal.' };
  }

  const precoCentavos = Math.round(Number(dados.preco) * 100);
  if (!(precoCentavos >= 1 && precoCentavos <= 999999)) {
    return { ok: false, erro: 'O preço deve ficar entre R$ 0,01 e R$ 9.999,99.' };
  }

  const validade = String(dados.dataValidade ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return { ok: false, erro: 'Informe a data de validade.' };
  if (validade < hoje) return { ok: false, erro: MSG_VENCIDO };
  if (validade > somarDias(hoje, 730)) return { ok: false, erro: 'A validade não pode passar de 2 anos a partir de hoje.' };

  return {
    ok: true,
    registro: { nome, unidade, quantidade, preco_centavos: precoCentavos, data_validade: validade },
  };
}
