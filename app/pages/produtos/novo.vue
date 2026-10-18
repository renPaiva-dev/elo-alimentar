<script setup>
// RF-01 — Cadastrar produto com validade. A API e o banco repetem estas regras.
const api = useApi();
const hoje = hojeFortaleza();
const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) + 730 * 86_400_000).toISOString().slice(0, 10);

const nome = ref('');
const unidade = ref('un');
const quantidade = ref('');
const preco = ref('');
const validade = ref('');
const erro = ref('');
const enviando = ref(false);

async function salvar() {
  erro.value = '';
  const q = Number(String(quantidade.value).replace(',', '.'));
  const precoCentavos = paraCentavos(preco.value);
  if (Number.isNaN(precoCentavos)) {
    erro.value = 'Informe o preço em reais, por exemplo 3,50.';
    return;
  }
  enviando.value = true;
  try {
    await api.post('/produtos', {
      nome: nome.value.trim(),
      unidade: unidade.value,
      quantidade: q,
      preco_centavos: precoCentavos,
      data_validade: validade.value,
    });
    await navigateTo({ path: '/', query: { cadastrado: '1' } });
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="tela">
    <div class="cabecalho-tela">
      <NuxtLink to="/" class="voltar" aria-label="Voltar">←</NuxtLink>
      <h1>Cadastrar produto</h1>
    </div>

    <form class="cartao formulario" @submit.prevent="salvar">
      <div class="campo">
        <label for="nome">Nome do produto</label>
        <input id="nome" v-model="nome" required minlength="2" maxlength="60" autocomplete="off" placeholder="Ex.: Iogurte natural">
      </div>

      <div class="linha-campos">
        <div class="campo">
          <label for="unidade">Unidade</label>
          <select id="unidade" v-model="unidade">
            <option value="un">un (unidade)</option>
            <option value="kg">kg</option>
            <option value="L">L (litro)</option>
          </select>
        </div>
        <div class="campo">
          <label for="quantidade">Quantidade</label>
          <input
            id="quantidade" v-model="quantidade" required inputmode="decimal"
            :placeholder="unidade === 'un' ? 'Ex.: 6' : 'Ex.: 2,5'"
          >
        </div>
      </div>
      <p class="dica" style="margin: -8px 0 0; color: var(--texto-suave); font-size: .82rem">
        {{ unidade === 'un' ? 'Número inteiro de 1 a 9.999.' : 'De 0,1 a 999,9, com até 1 casa decimal.' }}
      </p>

      <div class="linha-campos">
        <div class="campo">
          <label for="preco">Preço (R$)</label>
          <input id="preco" v-model="preco" required inputmode="decimal" placeholder="Ex.: 3,50">
          <span class="dica">por {{ unidade }}</span>
        </div>
        <div class="campo">
          <label for="validade">Validade</label>
          <input id="validade" v-model="validade" type="date" required :min="hoje" :max="limite">
        </div>
      </div>

      <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
      <p class="dica" style="margin: 0; color: var(--texto-suave); font-size: .82rem">
        Cada lote com validade diferente é um produto separado. Produto vencido não pode ser cadastrado.
      </p>
      <button class="botao primario bloco" type="submit" :disabled="enviando">
        {{ enviando ? 'Salvando…' : 'Salvar produto' }}
      </button>
    </form>
  </div>
</template>
