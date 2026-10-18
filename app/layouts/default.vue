<script setup>
const { perfil, alertasValidade, sair, atualizarAlertas } = useSessao();
const comerciante = computed(() => perfil.value?.tipo === 'comerciante');
const rota = useRoute();

onMounted(atualizarAlertas);
</script>

<template>
  <div class="app">
    <header class="topo">
      <span class="marca">Elo Alimentar</span>
      <NuxtLink
        v-if="comerciante" to="/estabelecimento" class="quem" style="color: inherit; text-decoration: none"
        aria-label="Meu estabelecimento"
      >{{ perfil.nome }}<br><small>Meu estabelecimento ›</small></NuxtLink>
      <span v-else-if="perfil" class="quem">{{ perfil.nome }}<br><small>Entidade</small></span>
      <button v-if="perfil" class="sair" type="button" @click="sair">Sair</button>
    </header>

    <main class="conteudo">
      <slot />
    </main>

    <nav v-if="comerciante" class="nav" aria-label="Menu principal">
      <div class="nav-itens">
        <NuxtLink to="/" :class="{ ativo: rota.path === '/' || rota.path.startsWith('/produtos') }" exact-active-class="">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
          Início
        </NuxtLink>
        <NuxtLink to="/caixa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h4M7 16h4M15 12h2M15 16h2" /></svg>
          Caixa
        </NuxtLink>
        <NuxtLink to="/validade">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>
          Validade
          <span v-if="alertasValidade > 0" class="contador" :aria-label="`${alertasValidade} produtos vencem em até 3 dias`">{{ alertasValidade }}</span>
        </NuxtLink>
        <NuxtLink to="/doacoes" :class="{ ativo: rota.path.startsWith('/doacoes') }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.4-9.2-8.6C1.2 9.3 3 5.5 6.6 5.5c2 0 3.3 1.1 4.1 2.3h2.6c.8-1.2 2.1-2.3 4.1-2.3 3.6 0 5.4 3.8 3.8 6.9C19 16.6 12 21 12 21z" /></svg>
          Doações
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
