// Camada de persistência da sessão (Aula 11): valida o JWT no Supabase Auth e
// descobre o perfil da conta (comerciante ou entidade). As contas são criadas pela equipe.
import { supabase, db } from '../config/supabaseClient.js';

export const sessaoRepository = {
  /** @returns {Promise<{id:string}|null>} usuário dono do token, ou null se o token for inválido/expirado */
  async obterUsuario(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id };
  },

  /**
   * Roda no contexto do usuário: o RLS só deixa cada conta ler o próprio perfil.
   * @returns {Promise<{tipo:'comerciante'|'entidade', id:string, nome:string, bairro:string,
   *   endereco?:string|null, whatsapp_comercial?:string|null, latitude?:number|null, longitude?:number|null}|null>}
   */
  async obterPerfil() {
    const estab = await db()
      .from('estabelecimentos')
      .select('id, nome_fantasia, bairro, endereco, whatsapp_comercial, latitude, longitude')
      .maybeSingle();
    if (estab.error) throw estab.error;
    if (estab.data) {
      const { id, nome_fantasia: nome, bairro, endereco, whatsapp_comercial, latitude, longitude } = estab.data;
      const numero = (v) => (v === null ? null : Number(v));
      return {
        tipo: 'comerciante', id, nome, bairro, endereco, whatsapp_comercial,
        latitude: numero(latitude), longitude: numero(longitude),
      };
    }

    const entidade = await db().from('entidades').select('id, nome, bairro').maybeSingle();
    if (entidade.error) throw entidade.error;
    if (entidade.data) return { tipo: 'entidade', ...entidade.data };
    return null;
  },
};
