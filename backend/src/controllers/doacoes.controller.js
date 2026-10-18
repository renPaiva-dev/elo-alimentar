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

/** PostgREST devolve contatos(count) como [{ count: n }]; a API expõe só o número. */
function comTotalDeContatos({ contatos, ...doacao }) {
  return { ...doacao, contatos: contatos?.[0]?.count ?? 0 };
}

/** Card do mural (RF-05, saída observável). Coordenadas são do estabelecimento, não de pessoas. */
function paraCardDoMural(l) {
  return {
    doacao_id: l.doacao_id,
    produto: l.produto_nome,
    unidade: l.unidade,
    quantidade: Number(l.quantidade),
    prazo_retirada: l.prazo_retirada,
    observacao: l.observacao,
    estabelecimento: l.estabelecimento_nome,
    bairro: l.bairro,
    latitude: l.latitude === null ? null : Number(l.latitude),
    longitude: l.longitude === null ? null : Number(l.longitude),
    whatsapp_comercial: l.whatsapp_comercial,
  };
}

export const doacoesController = {
  async criar(req, res) {
    const validacao = validarDoacao(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const doacao = await doacoesRepository.publicar(validacao.doacao);
    res.location(`/api/v1/doacoes/${doacao.id}`);
    return res.status(201).json(doacao);
  },

  // Comerciante: GET /doacoes                         → "Minhas doações" (RF-04)
  // Entidade:    GET /doacoes?status=ativo[&bairro=X] → mural (RF-05). A localização da
  //              entidade não é enviada: o navegador calcula a distância (regra 4).
  async listar(req, res) {
    if (req.perfil.tipo === 'entidade') {
      const { status, bairro } = req.query;
      if (status !== 'ativo') return res.status(400).json({ erro: 'Use status=ativo para ver o mural.' });
      if (bairro !== undefined && !(typeof bairro === 'string' && bairro.trim().length >= 2 && bairro.length <= 60)) {
        return res.status(400).json({ erro: 'Informe um bairro válido.' });
      }
      const mural = await doacoesRepository.findMural(bairro?.trim());
      return res.status(200).json(mural.map(paraCardDoMural));
    }

    const lista = await doacoesRepository.findMinhas();
    return res.status(200).json(lista.map((d) => comStatusEfetivo(comTotalDeContatos(d))));
  },

  async obterPorId(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADA);
    const doacao = await doacoesRepository.findById(req.params.id);
    if (!doacao) return res.status(404).json(NAO_ENCONTRADA);
    return res.status(200).json(comStatusEfetivo(comTotalDeContatos(doacao)));
  },

  async atualizar(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADA);
    const validacao = validarStatus(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const doacao = await doacoesRepository.alterarStatus(req.params.id, validacao.status);
    return res.status(200).json(doacao);
  },
};
