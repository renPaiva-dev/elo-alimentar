<script setup>
// RF-04 — "Minhas doações": status (ativo → retirado | cancelado | expirado) e contatos recebidos.
// Métrica do pitch: doações marcadas como retiradas nos primeiros 30 dias de uso.
const api = useApi();
const rota = useRoute();
const { atualizarAlertas } = useSessao();
const doacoes = ref([]);
const carregando = ref(true);
const erro = ref('');
const aviso = ref(rota.query.publicada ? 'Doação publicada. Ela já aparece no mural das entidades.' : '');
const ocupada = ref(null);

const ROTULOS = {
  ativo: { texto: 'ativo', classe: '' },
  retirado: { texto: 'retirado', classe: 'info' },
  cancelado: { texto: 'cancelado', classe: 'neutro' },
  expirado: { texto: 'expirado', classe: 'perigo' },
};

const ativas = computed(() => doacoes.value.filter((d) => d.status === 'ativo'));
const historico = computed(() => doacoes.value.filter((d) => d.status !== 'ativo'));
const retiradas = computed(() => doacoes.value.filter((d) => d.status === 'retirado').length);

async function carregar() {
  try {
    doacoes.value = await api.get('/doacoes');
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);

async function alterar(doacao, status) {
  const pergunta = status === 'retirado'
    ? `Confirmar que a entidade buscou ${quantidadeComUnidade(doacao.quantidade, doacao.produto.unidade)} de ${doacao.produto.nome}?`
    : `Cancelar a doação de ${doacao.produto.nome}? A quantidade volta para o estoque se ainda estiver na validade.`;
  if (!window.confirm(pergunta)) return;

  erro.value = '';
  aviso.value = '';
  ocupada.value = doacao.id;
  try {
    await api.patch(`/doacoes/${doacao.id}`, { status });
    aviso.value = status === 'retirado' ? 'Doação marcada como retirada. Obrigado!' : 'Doação cancelada.';
    await carregar();
    atualizarAlertas();
  } catch (e) {
    erro.value = e.message;
    await carregar();
  } finally {
    ocupada.value = null;
  }
}
</script>

<template>
  <div class="tela">
    <div class="item-linha" style="align-items: center">
      <h1>Minhas doações</h1>
      <span class="pill info" :title="'Doações retiradas por entidades'">{{ retiradas }} retirada{{ retiradas === 1 ? '' : 's' }}</span>
    </div>

    <p v-if="aviso" class="aviso sucesso" role="status">{{ aviso }}</p>
    <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>

    <NuxtLink to="/validade" class="botao bloco">+ Doar produto que vence em breve</NuxtLink>

    <p v-if="carregando" class="carregando">Carregando…</p>
    <template v-else>
      <div class="secao-titulo">No mural agora ({{ ativas.length }}/20)</div>
      <p v-if="ativas.length === 0" class="cartao vazio">Nenhuma doação ativa.</p>
      <ul v-else class="lista">
        <li v-for="d in ativas" :key="d.id" class="cartao item">
          <div class="item-linha">
            <span class="item-nome">{{ d.produto.nome }} · {{ quantidadeComUnidade(d.quantidade, d.produto.unidade) }}</span>
            <span class="pill">ativo</span>
          </div>
          <div class="item-detalhe">Retirar até {{ dataHoraCurta(d.prazo_retirada) }}</div>
          <div v-if="d.local_retirada" class="item-detalhe">Local: {{ d.local_retirada }}</div>
          <div v-if="d.observacao" class="item-detalhe">“{{ d.observacao }}”</div>
          <div class="item-detalhe">
            {{ d.contatos === 0 ? 'Nenhuma entidade chamou ainda' : `${d.contatos} ${d.contatos === 1 ? 'entidade chamou' : 'entidades chamaram'} no WhatsApp` }}
          </div>
          <div class="botoes">
            <button class="botao primario pequeno" type="button" :disabled="ocupada === d.id" @click="alterar(d, 'retirado')">
              Marcar como retirado
            </button>
            <button class="botao pequeno" type="button" :disabled="ocupada === d.id" @click="alterar(d, 'cancelado')">
              Cancelar
            </button>
          </div>
        </li>
      </ul>

      <template v-if="historico.length">
        <div class="secao-titulo">Histórico</div>
        <ul class="lista">
          <li v-for="d in historico" :key="d.id" class="cartao item">
            <div class="item-linha">
              <span class="item-nome">{{ d.produto.nome }} · {{ quantidadeComUnidade(d.quantidade, d.produto.unidade) }}</span>
              <span class="pill" :class="ROTULOS[d.status].classe">{{ ROTULOS[d.status].texto }}</span>
            </div>
            <div class="item-detalhe">
              <template v-if="d.status === 'retirado'">Retirado em {{ dataHoraCurta(d.retirado_em) }}</template>
              <template v-else>Prazo era {{ dataHoraCurta(d.prazo_retirada) }}</template>
              · {{ d.contatos }} contato{{ d.contatos === 1 ? '' : 's' }}
            </div>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
