// Camada de persistência do RF-04. Publicar e mudar status mexem no estoque, então
// passam por funções transacionais no banco (AGENTS.md, Regra 7): uma chamada, tudo ou nada.
import { db } from '../config/supabaseClient.js';

// contatos(count): quantas entidades tocaram em "Conversar no WhatsApp" (RF-05, regra 6).
const CAMPOS = 'id, created_at, produto_id, quantidade, prazo_retirada, observacao, status, retirado_em, '
  + 'produto:produtos (nome, unidade, data_validade), contatos (count)';

export const doacoesRepository = {
  async publicar({ produto_id, quantidade, prazo_retirada, observacao }) {
    const { data, error } = await db().rpc('publicar_doacao', {
      p_produto_id: produto_id,
      p_quantidade: quantidade,
      p_prazo_retirada: prazo_retirada,
      p_observacao: observacao,
    });
    if (error) throw error;
    return data;
  },

  /** "Minhas doações": as do estabelecimento logado (o RLS filtra), mais recentes primeiro. */
  async findMinhas() {
    const { data, error } = await db()
      .from('doacoes')
      .select(CAMPOS)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async findById(id) {
    const { data, error } = await db().from('doacoes').select(CAMPOS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  /** RF-05: anúncios ativos no prazo, com os dados do estabelecimento. Só entidades (o banco confere). */
  async findMural(bairro) {
    const { data, error } = await db().rpc('listar_mural', { p_bairro: bairro ?? null });
    if (error) throw error;
    return data || [];
  },

  async alterarStatus(id, status) {
    const { data, error } = await db().rpc('alterar_status_doacao', { p_doacao_id: id, p_status: status });
    if (error) throw error;
    return data;
  },
};
