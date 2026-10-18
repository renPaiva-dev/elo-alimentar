// Camada config: clientes do Supabase usados pelos repositories.
// Só a chave anon/publishable entra aqui; quem limita o acesso é o RLS (AGENTS.md, Regra 4).
//
// Cada requisição autenticada ganha um cliente com o JWT do usuário (stateless, Aula 11),
// guardado no contexto assíncrono da requisição. Assim o banco aplica auth.uid() e as
// políticas de dono, e os repositories continuam chamando só db().
import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../../src/services/supabaseClient.js';

const contexto = new AsyncLocalStorage();

/** Cliente anônimo: usado só para validar o token no Supabase Auth. */
export { supabase };

/** Cliente que fala com o banco em nome do usuário dono do token. */
export function clienteDoUsuario(token) {
  return createClient(supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Executa fn com o cliente da requisição disponível em db(). */
export function comCliente(cliente, fn) {
  return contexto.run(cliente, fn);
}

/** Cliente do usuário da requisição atual (ou o anônimo, fora de uma requisição autenticada). */
export function db() {
  return contexto.getStore() ?? supabase;
}
