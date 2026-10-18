<script setup>
// RF-02 — Registrar venda (caixa mínimo). Nenhum dado do comprador é pedido (regra 4).
const api = useApi();
const { atualizarAlertas } = useSessao();
const hoje = hojeFortaleza();

const produtos = ref([]);
const busca = ref('');
const itens = ref([]); // { produto, quantidade }
const erro = ref('');
const sucesso = ref('');
const enviando = ref(false);
const carregando = ref(true);

// Regra 1: vencidos e sem estoque não aparecem na busca.
const vendaveis = computed(() => produtos.value.filter(
  (p) => diasParaVencer(p.data_validade, hoje) >= 0 && Number(p.quantidade) > 0,
));
const resultados = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR');
  if (!termo) return [];
  return vendaveis.value.filter((p) => p.nome.toLocaleLowerCase('pt-BR').includes(termo)).slice(0, 8);
});

// Regra 2: subtotal arredondado ao centavo por item (meio para cima), como a função do banco.
const subtotal = (i) => Math.round(i.quantidade * i.produto.preco_centavos);
const total = computed(() => itens.value.reduce((s, i) => s + subtotal(i), 0));
const passo = (p) => (p.unidade === 'un' ? 1 : 0.1);

async function carregar() {
  try {
    produtos.value = await api.get('/produtos');
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);

function adicionar(p) {
  sucesso.value = '';
  const existente = itens.value.find((i) => i.produto.id === p.id);
  if (existente) mudar(existente, passo(p));
  else if (itens.value.length >= 30) erro.value = 'Uma venda pode ter no máximo 30 itens.';
  else itens.value.push({ produto: p, quantidade: passo(p) === 1 ? 1 : Math.min(1, Number(p.quantidade)) });
  busca.value = '';
}

function mudar(item, delta) {
  const nova = Math.round((item.quantidade + delta) * 10) / 10;
  if (nova <= 0) remover(item);
  else item.quantidade = Math.min(nova, Number(item.produto.quantidade));
}

function digitar(item, valor) {
  const n = Number(String(valor).replace(',', '.'));
  if (Number.isFinite(n) && n > 0) item.quantidade = item.produto.unidade === 'un' ? Math.round(n) : Math.round(n * 10) / 10;
}

function remover(item) {
  itens.value = itens.value.filter((i) => i !== item);
}

async function finalizar() {
  erro.value = '';
  sucesso.value = '';
  enviando.value = true;
  try {
    const venda = await api.post('/vendas', {
      itens: itens.value.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
    });
    sucesso.value = `Venda registrada · ${reais(venda.total_centavos)}`;
    itens.value = [];
    await carregar();
    atualizarAlertas();
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="tela">
    <h1>Caixa</h1>
    <p class="aviso-fixo">Controle interno de vendas — não é documento fiscal.</p>

    <input
      v-model="busca" class="busca" type="search" autocomplete="off"
      placeholder="Buscar produto pelo nome…" aria-label="Buscar produto pelo nome"
    >
    <ul v-if="resultados.length" class="lista resultados-busca" aria-label="Produtos encontrados">
      <li v-for="p in resultados" :key="p.id">
        <button class="resultado" type="button" @click="adicionar(p)">
          <span><strong>{{ p.nome }}</strong><br><small class="item-detalhe">estoque {{ quantidadeComUnidade(p.quantidade, p.unidade) }}</small></span>
          <span>{{ reais(p.preco_centavos) }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="busca.trim() && !carregando" class="item-detalhe">Nenhum produto à venda com esse nome.</p>

    <p v-if="sucesso" class="aviso sucesso" role="status">{{ sucesso }}</p>
    <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>

    <section class="cartao" aria-label="Itens desta venda" style="display: flex; flex-direction: column; gap: 12px">
      <div class="secao-titulo" style="margin: 0">Itens desta venda</div>
      <p v-if="itens.length === 0" class="vazio" style="padding: 8px">Busque um produto acima para começar.</p>
      <ul v-else class="lista">
        <li v-for="i in itens" :key="i.produto.id" class="item">
          <div class="item-linha">
            <span class="item-nome">{{ i.produto.nome }}</span>
            <strong>{{ reais(subtotal(i)) }}</strong>
          </div>
          <div class="item-linha" style="align-items: center">
            <div class="quantidade-controle">
              <button type="button" :aria-label="`Diminuir ${i.produto.nome}`" @click="mudar(i, -passo(i.produto))">−</button>
              <input
                :value="String(i.quantidade).replace('.', ',')" inputmode="decimal"
                :aria-label="`Quantidade de ${i.produto.nome}`" @change="digitar(i, $event.target.value)"
              >
              <button type="button" :aria-label="`Aumentar ${i.produto.nome}`" @click="mudar(i, passo(i.produto))">+</button>
              <span class="item-detalhe">{{ i.produto.unidade }} × {{ reais(i.produto.preco_centavos) }}</span>
            </div>
            <button class="botao pequeno perigo" type="button" @click="remover(i)">Remover</button>
          </div>
        </li>
      </ul>
      <div class="total"><span>Total</span><span>{{ reais(total) }}</span></div>
      <button class="botao primario bloco" type="button" :disabled="itens.length === 0 || enviando" @click="finalizar">
        {{ enviando ? 'Registrando…' : 'Finalizar venda' }}
      </button>
    </section>
  </div>
</template>
