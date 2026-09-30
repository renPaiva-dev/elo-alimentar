import { supabase } from './supabaseClient.js';
import { validarProduto } from './validarProduto.js';

/**
 * RF-01 — Cadastra um produto com validade na tabela `produtos`.
 * @param {Object} dadosFormulario campos coletados na interface (ver validarProduto)
 * @returns {Promise<{ sucesso: boolean, dados?: Object, erro?: string }>}
 */
export async function cadastrarProduto(dadosFormulario) {
  try {
    // 1. Validação prévia no cliente (fail fast)
    const validacao = validarProduto(dadosFormulario);
    if (!validacao.ok) return { sucesso: false, erro: validacao.erro };

    // 2. Chamada ao Supabase via SDK oficial
    const { data, error } = await supabase
      .from('produtos')
      .insert([validacao.registro])
      .select();

    // 3. Erro devolvido pela API, por uma CHECK constraint ou pelo RLS
    if (error) {
      console.error('[Supabase Error]:', error.code, error.message, error.details);
      // Mensagens de regra de negócio vindas do gatilho do banco são repassadas ao usuário
      if (error.code === '23514' && !/violates check constraint/.test(error.message)) {
        return { sucesso: false, erro: error.message };
      }
      if (/fetch failed|Failed to fetch/i.test(error.message)) {
        return { sucesso: false, erro: 'Não foi possível conectar ao servidor. Verifique sua conexão de internet.' };
      }
      return { sucesso: false, erro: `Falha na persistência: ${error.message}` };
    }

    // 4. Sucesso: registro salvo, com UUID e created_at gerados pelo PostgreSQL
    return { sucesso: true, dados: data[0] };
  } catch (err) {
    // 5. Falha de rede ou exceção inesperada
    console.error('[Exceção Inesperada]:', err);
    return { sucesso: false, erro: 'Não foi possível conectar ao servidor. Verifique sua conexão de internet.' };
  }
}
