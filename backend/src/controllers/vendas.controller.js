// Controller do RF-02 (caixa mínimo). Nenhum dado do comprador é recebido nem gravado.
import { vendasRepository } from '../repositories/vendas.repository.js';
import { validarVenda } from '../validators/venda.validator.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAO_ENCONTRADA = { erro: 'Venda não encontrada.' };

export const vendasController = {
  async criar(req, res) {
    const validacao = validarVenda(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const venda = await vendasRepository.registrar(validacao.itens);
    res.location(`/api/v1/vendas/${venda.venda_id}`);
    return res.status(201).json(venda);
  },

  async obterPorId(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADA);
    const venda = await vendasRepository.findById(req.params.id);
    if (!venda) return res.status(404).json(NAO_ENCONTRADA);
    return res.status(200).json(venda);
  },
};
