<script setup>
// Início do comerciante: contador "Vencem em até 3 dias" (RF-03, regra 5) e estoque (RF-01).
const api = useApi();
const { alertasValidade } = useSessao();
const produtos = ref([]);
const carregando = ref(true);
const erro = ref('');
const filtro = ref('');
const route = useRoute();

const hoje = hojeFortaleza();
const lista = computed(() => {
  const termo = filtro.value.trim().toLocaleLowerCase('pt-BR');
  return produtos.value
    .map((p) => ({ ...p, dias: diasParaVencer(p.data_validade, hoje) }))
    .filter((p) => !termo || p.nome.toLocaleLowerCase('pt-BR').includes(termo));
});

function classeValidade(dias) {
  if (dias < 0) return 'perigo';
  if (dias <= 3) return 'alerta';
  return 'neutro';
}

onMounted(async () => {
  try {
    const [todos, vencendo] = await Promise.all([api.get('/produtos'), api.get('/produtos?vence_em_ate=3')]);
    produtos.value = todos;
    alertasValidade.value = vencendo.length;
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
});
</script>

<template>
  <div class="tela">
    <h1>Início</h1>
    <p v-if="route.query.cadastrado" class="aviso sucesso" role="status">Produto cadastrado.</p>

    <NuxtLink to="/validade" class="cartao item" style="text-decoration: none; color: inherit">
      <div class="item-linha">
        <div>
          <div class="secao-titulo" style="margin: 0">Vencem em até 3 dias</div>
          <p class="subtitulo">Escolha entre promoção e doação</p>
        </div>
        <span class="numero-grande" :style="{ color: alertasValidade > 0 ? 'var(--ambar-700)' : 'var(--verde-800)' }">
          {{ alertasValidade }}
        </span>
      </div>
    </NuxtLink>

    <NuxtLink to="/produtos/novo" class="botao primario bloco">+ Cadastrar produto</NuxtLink>

    <div class="secao-titulo">Estoque</div>
    <input v-if="produtos.length > 5" v-model="filtro" class="busca" type="search" placeholder="Buscar produto pelo nome…" aria-label="Buscar produto">

    <p v-if="carregando" class="carregando">Carregando…</p>
    <p v-else-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
    <p v-else-if="produtos.length === 0" class="cartao vazio">
      Nenhum produto cadastrado ainda.<br>Cadastre o primeiro para usar o caixa e o alerta de validade.
    </p>
    <ul v-else class="lista">
      <li v-for="p in lista" :key="p.id">
        <NuxtLink :to="`/produtos/${p.id}`" class="cartao item" style="text-decoration: none; color: inherit">
          <div class="item-linha">
            <span class="item-nome">{{ p.nome }}</span>
            <span class="pill" :class="classeValidade(p.dias)">{{ rotuloValidade(p.dias) }}</span>
          </div>
          <div class="item-detalhe">
            {{ quantidadeComUnidade(p.quantidade, p.unidade) }} · {{ reais(p.preco_centavos) }} · validade {{ dataBR(p.data_validade) }}
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
