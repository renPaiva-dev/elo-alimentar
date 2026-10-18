// Guarda das telas: sem sessão vai para /login; cada perfil só abre as próprias telas.
// O mural não é público (RF-05, regra 7) e o caixa é só do comerciante.
const TELAS_ENTIDADE = ['/mural'];

export default defineNuxtRouteMiddleware(async (to) => {
  const { perfil, carregarPerfil } = useSessao();

  if (to.path === '/login') return;

  if (!perfil.value) {
    try {
      await carregarPerfil();
    } catch (erro) {
      if (erro?.status === 403) {
        await useSupabase().auth.signOut();
        return navigateTo({ path: '/login', query: { aviso: 'sem-perfil' } });
      }
      return navigateTo('/login');
    }
  }
  if (!perfil.value) return navigateTo('/login');

  const ehTelaDeEntidade = TELAS_ENTIDADE.includes(to.path);
  if (perfil.value.tipo === 'entidade' && !ehTelaDeEntidade) return navigateTo('/mural');
  if (perfil.value.tipo === 'comerciante' && ehTelaDeEntidade) return navigateTo('/');
});
