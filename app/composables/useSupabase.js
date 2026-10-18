// Cliente do Supabase no navegador: só para login/logout e para ler o JWT da sessão.
// Os dados passam sempre pela API (/api/v1), nunca direto do navegador para as tabelas.
import { createClient } from '@supabase/supabase-js';

let cliente;

export function useSupabase() {
  if (!cliente) {
    const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig().public;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local (ou NUXT_PUBLIC_* no Vercel).');
    }
    cliente = createClient(supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey);
  }
  return cliente;
}
