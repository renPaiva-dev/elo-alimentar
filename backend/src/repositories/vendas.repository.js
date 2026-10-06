// Camada de persistência do RF-02. A baixa de estoque é atômica dentro da função
// registrar_venda no banco (AGENTS.md, Regra 7): uma única chamada, tudo ou nada.
import { supabase } from '../config/supabaseClient.js';

export const vendasRepository = {
  /** @returns {Promise<{venda_id:string, total_centavos:number, itens:Object[]}>} */
  async registrar(itens) {
    const { data, error } = await supabase.rpc('registrar_venda', { itens });
    if (error) throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('vendas')
      .select('id, created_at, total_centavos, itens_venda (produto_id, quantidade, preco_centavos, subtotal_centavos)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
