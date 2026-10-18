<script setup>
// RF-01, regras 3 e 5: editar preço, quantidade e validade; excluir produto cadastrado por engano.
// Aberta pelo botão "Promoção" da tela Validade (RF-03, regra 4) com o foco no preço.
const api = useApi();
const rota = useRoute();
const promocao = computed(() => rota.query.promocao === '1');
const hoje = hojeFortaleza();

const produto = ref(null);
const preco = ref('');
const quantidade = ref('');
const validade = ref('');
const erro = ref('');
const sucesso = ref('');
const enviando = ref(false);
const campoPreco = ref(null);

const dias = computed(() => (produto.value ? diasParaVencer(produto.value.data_validade, hoje) : 0));

function preencher(p) {
  produto.value = p;
  preco.value = (p.preco_centavos / 100).toFixed(2).replace('.', ',');
  quantidade.value = String(Number(p.quantidade)).replace('.', ',');
  validade.value = p.data_validade;
}

onMounted(async () => {
  try {
    preencher(await api.get(`/produtos/${rota.params.id}`));
    if (promocao.value) {
      await nextTick();
      campoPreco.value?.focus();
      campoPreco.value?.select();
    }
  } catch (e) {
    erro.value = e.message;
  }
});

async function salvar() {
  erro.value = '';
  sucesso.value = '';
  const mudancas = {};
  const centavos = paraCentavos(preco.value);
  if (Number.isNaN(centavos)) {
    erro.value = 'Informe o preço em reais, por exemplo 3,50.';
    return;
  }
  const q = Number(String(quantidade.value).replace(',', '.'));
  if (centavos !== produto.value.preco_centavos) mudancas.preco_centavos = centavos;
  if (q !== Number(produto.value.quantidade)) mudancas.quantidade = q;
  if (validade.value !== produto.value.data_validade) mudancas.data_validade = validade.value;
  if (Object.keys(mudancas).length === 0) {
    sucesso.value = 'Nada mudou.';
    return;
  }

  enviando.value = true;
  try {
    preencher(await api.patch(`/produtos/${produto.value.id}`, mudancas));
    sucesso.value = promocao.value && mudancas.preco_centavos ? 'Preço de promoção salvo.' : 'Alterações salvas.';
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}

async function excluir() {
  if (!window.confirm(`Excluir "${produto.value.nome}"? Use só para produto cadastrado por engano.`)) return;
  erro.value = '';
  try {
    await api.del(`/produtos/${produto.value.id}`);
    await navigateTo('/');
  } catch (e) {
    erro.value = e.message;
  }
}
</script>

<template>
  <div class="tela">
    <div class="cabecalho-tela">
      <NuxtLink :to="promocao ? '/validade' : '/'" class="voltar" aria-label="Voltar">←</NuxtLink>
      <div>
        <h1>{{ promocao ? 'Promoção' : 'Editar produto' }}</h1>
        <p v-if="produto" class="subtitulo">{{ produto.nome }} · {{ rotuloValidade(dias) }}</p>
      </div>
    </div>

    <p v-if="!produto && !erro" class="carregando">Carregando…</p>
    <p v-if="promocao && produto" class="aviso info">Baixe o preço para vender antes de vencer. Se não vender, você ainda pode doar.</p>

    <form v-if="produto" class="cartao formulario" @submit.prevent="salvar">
      <div class="linha-campos">
        <div class="campo">
          <label for="preco">Preço (R$)</label>
          <input id="preco" ref="campoPreco" v-model="preco" required inputmode="decimal">
          <span class="dica">por {{ produto.unidade }}</span>
        </div>
        <div class="campo">
          <label for="quantidade">Quantidade ({{ produto.unidade }})</label>
          <input id="quantidade" v-model="quantidade" required inputmode="decimal">
        </div>
      </div>
      <div class="campo">
        <label for="validade">Validade</label>
        <input id="validade" v-model="validade" type="date" required>
        <span class="dica">Só pode ser corrigida para hoje ou uma data futura.</span>
      </div>

      <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
      <p v-if="sucesso" class="aviso sucesso" role="status">{{ sucesso }}</p>
      <button class="botao primario bloco" type="submit" :disabled="enviando">
        {{ enviando ? 'Salvando…' : 'Salvar' }}
      </button>
    </form>
    <p v-else-if="erro" class="aviso erro" role="alert">{{ erro }}</p>

    <div v-if="produto" class="botoes">
      <NuxtLink
        v-if="dias >= 0 && Number(produto.quantidade) > 0"
        :to="`/doacoes/nova?produto=${produto.id}`" class="botao"
      >Doar</NuxtLink>
      <button class="botao perigo" type="button" @click="excluir">Excluir</button>
    </div>
  </div>
</template>
