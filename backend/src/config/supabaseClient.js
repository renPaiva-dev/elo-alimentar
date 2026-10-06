// Camada config: reaproveita o cliente único da Aula 09 (só a chave anon/publishable,
// limitada pelo RLS). As variáveis vêm do .env.local, que nunca é versionado.
export { supabase } from '../../../src/services/supabaseClient.js';
