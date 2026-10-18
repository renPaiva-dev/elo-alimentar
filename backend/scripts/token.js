// Faz login no Supabase Auth e imprime o JWT (access_token) para testar a API com curl.
// Uso: npm run -s token -- email@exemplo.com senha
// O token vale por 1 hora. Não salve o token nem a senha em arquivos versionados.
import { supabase } from '../../src/services/supabaseClient.js';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: npm run -s token -- email senha');
  process.exit(1);
}

const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  console.error('Falha no login:', error.message);
  process.exit(1);
}
console.log(data.session.access_token);
