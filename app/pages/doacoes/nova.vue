<script setup>
// RF-04 — Publicar doação no mural (RF-CORE). Aberta pelo botão "Doar" com o produto escolhido.
const api = useApi();
const rota = useRoute();
const { perfil } = useSessao();
const MINUTO = 60_000;

const produto = ref(null);
const quantidade = ref('');
const prazoLocal = ref('');
const observacao = ref('');
const erro = ref('');
const enviando = ref(false);
const agora = ref(Date.now());

const temWhatsApp = computed(() => /^55\d{11}$/.test(perfil.value?.whatsapp_comercial || ''));
const whatsappFormatado = computed(() => formatarWhatsApp(perfil.value?.whatsapp_comercial));

// Spec v1.2: a entidade precisa saber onde buscar. Padrão: endereço da loja.
const enderecoDaLoja = computed(() => perfil.value?.endereco || '');
const outroLocal = ref(false);
const localRetirada = ref('');
const precisaDeLocal = computed(() => !enderecoDaLoja.value || outroLocal.value);

// Janela do prazo: de agora + 30 min a agora + 72 h, nunca depois de 23:59 do dia da validade.
const fimDaValidade = computed(() => (produto.value ? Date.parse(`${produto.value.data_validade}T23:59:00-03:00`) : 0));
const prazoMinimo = computed(() => agora.value + 31 * MINUTO);
const prazoMaximo = computed(() => Math.min(agora.value + 72 * 60 * MINUTO, fimDaValidade.value));
const semJanela = computed(() => produto.value && prazoMaximo.value < prazoMinimo.value);

function prazoSugerido() {
  const meiaHora = 30 * MINUTO;
  const daquiDuasHoras = Math.ceil((agora.value + 2 * 60 * MINUTO) / meiaHora) * meiaHora;
  return Math.max(prazoMinimo.value, Math.min(daquiDuasHoras, prazoMaximo.value));
}

onMounted(async () => {
  try {
    const p = await api.get(`/produtos/${rota.query.produto}`);
    produto.value = p;
    quantidade.value = String(Number(p.quantidade)).replace('.', ',');
    prazoLocal.value = isoParaLocal(prazoSugerido());
  } catch (e) {
    erro.value = e.status === 404 ? 'Produto não encontrado.' : e.message;
  }
});

async function publicar() {
  erro.value = '';
  enviando.value = true;
  try {
    await api.post('/doacoes', {
      produto_id: produto.value.id,
      quantidade: Number(String(quantidade.value).replace(',', '.')),
      prazo_retirada: localParaIso(prazoLocal.value),
      observacao: observacao.value.trim() || null,
      local_retirada: precisaDeLocal.value ? localRetirada.value.trim() || null : null,
    });
    await navigateTo({ path: '/doacoes', query: { publicada: '1' } });
  } catch (e) {
    erro.value = e.message;
    agora.value = Date.now();
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="tela">
    <div class="cabecalho-tela">
      <NuxtLink to="/validade" class="voltar" aria-label="Voltar">←</NuxtLink>
      <div>
        <h1>Publicar doação</h1>
        <p class="subtitulo">Entidades próximas veem no mural e chamam no seu WhatsApp.</p>
      </div>
    </div>

    <p v-if="!produto && !erro" class="carregando">Carregando…</p>
    <p v-if="!produto && erro" class="aviso erro" role="alert">{{ erro }}</p>

    <form v-if="produto" class="cartao formulario" @submit.prevent="publicar">
      <div class="campo">
        <span style="font-weight: 700; font-size: .92rem">Produto</span>
        <div class="item-linha">
          <span class="item-nome">{{ produto.nome }}</span>
          <span class="pill alerta">vence {{ dataBR(produto.data_validade) }}</span>
        </div>
      </div>

      <div class="campo">
        <label for="quantidade">Quantidade a doar ({{ produto.unidade }})</label>
        <input id="quantidade" v-model="quantidade" required inputmode="decimal">
        <span class="dica">Máximo {{ quantidadeComUnidade(produto.quantidade, produto.unidade) }}. Sai do estoque à venda na hora.</span>
      </div>

      <div class="campo">
        <label for="prazo">Retirar até</label>
        <input
          id="prazo" v-model="prazoLocal" type="datetime-local" required
          :min="isoParaLocal(prazoMinimo)" :max="isoParaLocal(prazoMaximo)"
        >
        <span class="dica">Entre 30 min e 72 h a partir de agora, sem passar da validade. Depois disso a doação expira.</span>
      </div>

      <div class="campo">
        <span style="font-weight: 700; font-size: .92rem">Local de retirada</span>
        <template v-if="enderecoDaLoja">
          <span>{{ enderecoDaLoja }}</span>
          <label style="display: flex; gap: 8px; align-items: center; font-weight: 400">
            <input v-model="outroLocal" type="checkbox" style="width: 20px; height: 20px; min-height: 0">
            Retirar em outro local
          </label>
        </template>
        <p v-else class="aviso alerta" style="margin: 0">
          A loja ainda não tem endereço. Digite onde buscar abaixo ou cadastre em
          <NuxtLink to="/estabelecimento">Meu estabelecimento</NuxtLink>.
        </p>
        <input
          v-if="precisaDeLocal" id="local" v-model="localRetirada" required minlength="5" maxlength="150"
          aria-label="Endereço de retirada" placeholder="Rua, número e ponto de referência"
        >
      </div>

      <div class="campo">
        <label for="obs">Observação (opcional)</label>
        <textarea id="obs" v-model="observacao" maxlength="200" placeholder="Ex.: retirar na porta lateral" />
        <span class="dica">{{ observacao.length }}/200</span>
      </div>

      <p v-if="temWhatsApp" class="aviso info">As entidades vão chamar no WhatsApp <strong>{{ whatsappFormatado }}</strong>.</p>
      <p v-else class="aviso alerta">
        Cadastre o WhatsApp da loja em <NuxtLink to="/estabelecimento">Meu estabelecimento</NuxtLink> para publicar doações.
      </p>
      <p v-if="semJanela" class="aviso alerta">
        Não dá mais tempo de retirada antes do fim da validade (prazo mínimo de 30 min).
      </p>
      <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>

      <button class="botao primario bloco" type="submit" :disabled="enviando || !temWhatsApp || semJanela">
        {{ enviando ? 'Publicando…' : 'Publicar doação' }}
      </button>
    </form>

    <p class="rodape-nota">
      Só alimentos dentro da validade. A Lei nº 14.016/2020 trata da doação de excedentes por quem doa de boa-fé
      (texto informativo, não é orientação jurídica).
    </p>
  </div>
</template>
