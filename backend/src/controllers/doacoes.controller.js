// Controller do RF-04 (RF-CORE): publicar doação, "Minhas doações" e mudança de status.
import { doacoesRepository } from '../repositories/doacoes.repository.js';
import { validarDoacao, validarStatus } from '../validators/doacao.validator.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAO_ENCONTRADA = { erro: 'Doação não encontrada.' };

/** RF-04, regra 4: toda tela trata como expirado o anúncio ativo com prazo_retirada <= agora. */
export function comStatusEfetivo(doacao, agora = Date.now()) {
  const expirou = doacao.status === 'ativo' && Date.parse(doacao.prazo_retirada) <= agora;
  return expirou ? { ...doacao, status: 'expirado' } : doacao;
}

export const doacoesController = {
  async criar(req, res) {
    const validacao = validarDoacao(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const doacao = await doacoesRepository.publicar(validacao.doacao);
    res.location(`/api/v1/doacoes/${doacao.id}`);
    return res.status(201).json(doacao);
  },

  async listar(req, res) {
    const lista = await doacoesRepository.findMinhas();
    return res.status(200).json(lista.map((d) => comStatusEfetivo(d)));
  },

  async obterPorId(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADA);
    const doacao = await doacoesRepository.findById(req.params.id);
    if (!doacao) return res.status(404).json(NAO_ENCONTRADA);
    return res.status(200).json(comStatusEfetivo(doacao));
  },

  async atualizar(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADA);
    const validacao = validarStatus(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const doacao = await doacoesRepository.alterarStatus(req.params.id, validacao.status);
    return res.status(200).json(doacao);
  },
};
