// Sessão e perfil da conta logada (comerciante ou entidade). As contas são criadas pela equipe.
export function useSessao() {
  const perfil = useState('perfil', () => null);
  const alertasValidade = useState('alertas-validade', () => 0);

  async function carregarPerfil() {
    const { data } = await useSupabase().auth.getSession();
    if (!data.session) {
      perfil.value = null;
      return null;
    }
    perfil.value = await useApi().get('/perfil');
    return perfil.value;
  }

  async function entrar(email, senha) {
    const { error } = await useSupabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      throw new Error(/invalid login/i.test(error.message)
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Verifique a internet e tente de novo.');
    }
    return carregarPerfil();
  }

  async function sair() {
    await useSupabase().auth.signOut();
    // Sai da tela antes de limpar o perfil, para nenhuma tela aberta renderizar sem ele.
    await navigateTo('/login');
    perfil.value = null;
    alertasValidade.value = 0;
  }

  /** Atualiza o contador "Vencem em até 3 dias" (RF-03, regra 5) mostrado no menu. */
  async function atualizarAlertas() {
    if (perfil.value?.tipo !== 'comerciante') return;
    try {
      alertasValidade.value = (await useApi().get('/produtos?vence_em_ate=3')).length;
    } catch {
      // o contador é só informativo; a tela Validade mostra o erro se houver
    }
  }

  return { perfil, alertasValidade, carregarPerfil, entrar, sair, atualizarAlertas };
}
