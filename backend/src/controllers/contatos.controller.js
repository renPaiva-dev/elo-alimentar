// Controller do RF-05, regra 6: registra o toque em "Conversar no WhatsApp".
// Nenhuma localização ou dado pessoal é recebido (regra 4 e AGENTS.md, Regra 6).
import { contatosRepository } from '../repositories/contatos.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const contatosController = {
  async criar(req, res) {
    const doacaoId = req.body?.doacao_id;
    if (!UUID.test(String(doacaoId ?? ''))) return res.status(400).json({ erro: 'Informe a doação (doacao_id).' });

    const contato = await contatosRepository.registrar(doacaoId);
    if (!contato) return res.status(404).json({ erro: 'Doação não encontrada ou não está mais ativa.' });

    res.location(`/api/v1/contatos/${contato.id}`);
    return res.status(201).json(contato);
  },
};
