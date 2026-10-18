<script setup>
// Login com e-mail e senha. Não há autocadastro na v1: as contas são criadas pela equipe.
definePageMeta({ layout: false });

const { entrar } = useSessao();
const rota = useRoute();
const email = ref('');
const senha = ref('');
const enviando = ref(false);
const erro = ref(rota.query.aviso === 'sem-perfil'
  ? 'Sua conta ainda não está ligada a um estabelecimento ou entidade. Fale com a equipe Elo Alimentar.'
  : '');

async function enviar() {
  erro.value = '';
  enviando.value = true;
  try {
    const perfil = await entrar(email.value, senha.value);
    await navigateTo(perfil?.tipo === 'entidade' ? '/mural' : '/');
  } catch (e) {
    erro.value = e.status === 403
      ? 'Sua conta ainda não está ligada a um estabelecimento ou entidade. Fale com a equipe Elo Alimentar.'
      : e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="app">
    <header class="topo"><span class="marca">Elo Alimentar</span></header>
    <main class="conteudo sem-nav">
      <div>
        <h1>Entrar</h1>
        <p class="subtitulo">Caixa simples, alerta de validade e mural de doação.</p>
      </div>

      <form class="cartao formulario" @submit.prevent="enviar">
        <div class="campo">
          <label for="email">E-mail</label>
          <input id="email" v-model="email" type="email" autocomplete="username" inputmode="email" required>
        </div>
        <div class="campo">
          <label for="senha">Senha</label>
          <input id="senha" v-model="senha" type="password" autocomplete="current-password" required>
        </div>
        <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
        <button class="botao primario bloco" type="submit" :disabled="enviando">
          {{ enviando ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>

      <p class="rodape-nota">
        Ainda não tem acesso? As contas de estabelecimentos e entidades são criadas pela equipe Elo Alimentar
        (IFPI Campus Teresina Central).
      </p>
    </main>
  </div>
</template>
