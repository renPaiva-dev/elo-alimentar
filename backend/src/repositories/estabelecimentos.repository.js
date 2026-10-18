// Camada de persistência de "Meu estabelecimento" (spec v1.2). A função do banco só
// altera a linha do comerciante logado e só os campos permitidos.
import { db } from '../config/supabaseClient.js';

export const estabelecimentosRepository = {
  async atualizarMeu(m) {
    const { data, error } = await db().rpc('atualizar_meu_estabelecimento', {
      p_nome_fantasia: m.nome ?? null,
      p_bairro: m.bairro ?? null,
      p_endereco: m.endereco ?? null,
      p_whatsapp_comercial: m.whatsapp_comercial ?? null,
      p_latitude: m.latitude ?? null,
      p_longitude: m.longitude ?? null,
      p_limpar_localizacao: m.limpar_localizacao ?? false,
    });
    if (error) throw error;
    return data;
  },
};
