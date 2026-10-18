<script setup>
// RF-03 — Listar produtos perto do vencimento. Só leitura (regra 6).
const api = useApi();
const { alertasValidade } = useSessao();
const vencendo = ref([]);
const vencidos = ref([]);
const carregando = ref(true);
const erro = ref('');

onMounted(async () => {
  try {
    const [lista, velhos] = await Promise.all([api.get('/produtos?vence_em_ate=3'), api.get('/produtos?vencidos=true')]);
    vencendo.value = lista;
    vencidos.value = velhos;
    alertasValidade.value = lista.length;
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
});
</script>

<template>
  <div class="tela">
    <div>
      <h1>Validade</h1>
      <p class="subtitulo">O que vence primeiro aparece em cima.</p>
    </div>

    <p v-if="carregando" class="carregando">Carregando…</p>
    <p v-else-if="erro" class="aviso erro" role="alert">{{ erro }}</p>

    <template v-else>
      <div class="secao-titulo">Vencem em até 3 dias ({{ vencendo.length }})</div>
      <p v-if="vencendo.length === 0" class="cartao vazio">Nenhum produto vence nos próximos 3 dias.</p>
      <ul v-else class="lista">
        <li v-for="p in vencendo" :key="p.id" class="cartao item">
          <div class="item-linha">
            <span class="item-nome">{{ p.nome }}</span>
            <span class="pill alerta">{{ p.rotulo_validade }}</span>
          </div>
          <div class="item-detalhe">{{ quantidadeComUnidade(p.quantidade, p.unidade) }} · {{ reais(p.preco_centavos) }}</div>
          <div class="botoes">
            <NuxtLink :to="`/produtos/${p.id}?promocao=1`" class="botao pequeno">Promoção</NuxtLink>
            <NuxtLink :to="`/doacoes/nova?produto=${p.id}`" class="botao primario pequeno">Doar</NuxtLink>
          </div>
        </li>
      </ul>

      <template v-if="vencidos.length > 0">
        <div class="secao-titulo">Vencidos — retirar da venda</div>
        <ul class="lista">
          <li v-for="p in vencidos" :key="p.id" class="cartao item" style="opacity: .75">
            <div class="item-linha">
              <span class="item-nome">{{ p.nome }}</span>
              <span class="pill perigo">venceu {{ dataBR(p.data_validade).slice(0, 5) }}</span>
            </div>
            <div class="item-detalhe">
              {{ quantidadeComUnidade(p.quantidade, p.unidade) }} · não pode ser vendido, promovido nem doado
            </div>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
