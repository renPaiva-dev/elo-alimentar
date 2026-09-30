import { createClient } from '@supabase/supabase-js';

// Lê uma variável de ambiente no navegador (Vite: import.meta.env)
// ou no terminal (Node: process.env), sem quebrar com "process is not defined".
function lerEnv(...nomes) {
  for (const nome of nomes) {
    const doVite = typeof import.meta !== 'undefined' ? import.meta.env?.[nome] : undefined;
    const doNode = typeof process !== 'undefined' ? process.env?.[nome] : undefined;
    if (doVite || doNode) return doVite || doNode;
  }
  return undefined;
}

// 1. Carregamento defensivo (Vite, Next.js, Nuxt e Node)
const supabaseUrl = lerEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NUXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
const supabaseAnonKey = lerEnv('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NUXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

// 2. Validação precoce: falha com mensagem clara em vez de erro silencioso
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[ERRO CRÍTICO] Variáveis do Supabase não configuradas no .env.local!');
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de iniciar o app.');
}

// 3. Instância única (singleton) do cliente, usando apenas a chave anon (pública, limitada pelo RLS)
export const supabase = createClient(supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey);
