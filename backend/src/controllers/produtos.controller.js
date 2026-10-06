// Controller do RF-01: valida o payload, chama o repositório e escolhe o status HTTP.
// Erros do banco seguem para o middleware tratarErros (Express 5 repassa rejeições de async).
import { produtosRepository } from '../repositories/produtos.repository.js';
import { validarCadastro, validarEdicao } from '../validators/produto.validator.js';
import { hojeFortaleza } from '../../../src/services/validarProduto.js';
import { somarDias, diasParaVencer, rotuloValidade } from '../utils/validade.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAO_ENCONTRADO = { erro: 'Produto não encontrado.' };
const JANELA_ALERTA_DIAS = 3; // RF-03: fixa em 3 dias no MVP 1

function comValidade(produto, hoje) {
  const dias = diasParaVencer(produto.data_validade, hoje);
  return { ...produto, dias_para_vencer: dias, rotulo_validade: rotuloValidade(dias) };
}

export const produtosController = {
  async criar(req, res) {
    const validacao = validarCadastro(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const novo = await produtosRepository.create(validacao.registro);
    res.location(`/api/v1/produtos/${novo.id}`);
    return res.status(201).json(novo);
  },

  // GET /produtos                  → estoque completo (RF-01)
  // GET /produtos?vence_em_ate=3   → "Vencem em até 3 dias" (RF-03, regras 1 e 2)
  // GET /produtos?vencidos=true    → "Vencidos — retirar da venda" (RF-03, regra 3)
  // Só leitura: nada é gravado (RF-03, regra 6).
  async listar(req, res) {
    const { vence_em_ate: venceEmAte, vencidos } = req.query;
    if (venceEmAte !== undefined && vencidos !== undefined) {
      return res.status(400).json({ erro: 'Use vence_em_ate ou vencidos, não os dois.' });
    }

    const hoje = hojeFortaleza();
    if (venceEmAte !== undefined) {
      if (venceEmAte !== String(JANELA_ALERTA_DIAS)) {
        return res.status(400).json({ erro: 'A janela de alerta é fixa em 3 dias no MVP 1.' });
      }
      const lista = await produtosRepository.findVencendo(hoje, somarDias(hoje, JANELA_ALERTA_DIAS));
      return res.status(200).json(lista.map((p) => comValidade(p, hoje)));
    }
    if (vencidos !== undefined) {
      if (vencidos !== 'true') return res.status(400).json({ erro: 'Use vencidos=true.' });
      const lista = await produtosRepository.findVencidos(hoje);
      return res.status(200).json(lista.map((p) => comValidade(p, hoje)));
    }
    return res.status(200).json(await produtosRepository.findAll());
  },

  async obterPorId(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADO);
    const produto = await produtosRepository.findById(req.params.id);
    if (!produto) return res.status(404).json(NAO_ENCONTRADO);
    return res.status(200).json(produto);
  },

  async atualizar(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADO);
    const produto = await produtosRepository.findById(req.params.id);
    if (!produto) return res.status(404).json(NAO_ENCONTRADO);

    const validacao = validarEdicao(req.body, produto);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const atualizado = await produtosRepository.update(req.params.id, validacao.mudancas);
    if (!atualizado) return res.status(404).json(NAO_ENCONTRADO);
    return res.status(200).json(atualizado);
  },

  async remover(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADO);
    const produto = await produtosRepository.findById(req.params.id);
    if (!produto) return res.status(404).json(NAO_ENCONTRADO);

    // O produto existe; se nada foi apagado, quem barrou foi o RLS.
    const removido = await produtosRepository.remove(req.params.id);
    if (!removido) return res.status(403).json({ erro: 'Operação não permitida pela política de segurança do banco.' });
    return res.status(204).send();
  },
};
