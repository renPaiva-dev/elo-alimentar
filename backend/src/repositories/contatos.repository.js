// Camada de persistência do RF-05, regra 6: 1 linha por toque em "Conversar no WhatsApp".
// O RLS só aceita o contato da própria entidade e para doação ativa no prazo.
import { db } from '../config/supabaseClient.js';

export const contatosRepository = {
  /** @returns {Promise<Object|null>} null quando a doação não existe ou não está mais ativa */
  async registrar(doacaoId) {
    const { data, error } = await db()
      .from('contatos')
      .insert([{ doacao_id: doacaoId }])
      .select('id, created_at, doacao_id')
      .single();
    // 42501: barrado pelo RLS (doação não ativa); 23503: doação inexistente.
    if (error && ['42501', '23503'].includes(error.code)) return null;
    if (error) throw error;
    return data;
  },
};
