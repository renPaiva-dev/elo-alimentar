// Camada de persistência (DAO) do RF-01: único ponto que conversa com a tabela `produtos`.
import { supabase } from '../config/supabaseClient.js';

export const produtosRepository = {
  async create(registro) {
    const { data, error } = await supabase.from('produtos').insert([registro]).select().single();
    if (error) throw error;
    return data;
  },

  async findAll() {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('data_validade', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** RF-03, regra 1: quantidade > 0 e validade entre hoje e o limite, por validade e nome. */
  async findVencendo(hoje, limite) {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .gt('quantidade', 0)
      .gte('data_validade', hoje)
      .lte('data_validade', limite)
      .order('data_validade', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** RF-03, regra 3: vencidos com quantidade > 0 ("Vencidos — retirar da venda"). */
  async findVencidos(hoje) {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .gt('quantidade', 0)
      .lt('data_validade', hoje)
      .order('data_validade', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async findById(id) {
    const { data, error } = await supabase.from('produtos').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id, mudancas) {
    const { data, error } = await supabase.from('produtos').update(mudancas).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  },

  /** @returns {Promise<boolean>} false quando nenhuma linha foi apagada (inexistente ou barrada pelo RLS) */
  async remove(id) {
    const { data, error } = await supabase.from('produtos').delete().eq('id', id).select('id');
    if (error) throw error;
    return Boolean(data && data.length > 0);
  },
};
