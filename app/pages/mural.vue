<script setup>
// RF-05 — Ver doações próximas e contatar pelo WhatsApp (só entidades, regra 7).
// A posição do GPS fica só nesta tela, na memória do navegador: nunca é enviada,
// salva ou registrada (regra 4 e AGENTS.md, Regra 6).
const api = useApi();
const { perfil } = useSessao();

const cards = ref([]);
const carregando = ref(true);
const erro = ref('');
const modo = ref('bairro'); // 'gps' | 'bairro'
const posicao = ref(null); // { latitude, longitude } — só em memória
const situacaoGps = ref('pedindo'); // pedindo | ok | negado | impreciso | indisponivel
const bairro = ref('');

const bairros = computed(() => bairrosDoMural(cards.value));
const visiveis = computed(() => {
  if (modo.value === 'gps' && posicao.value) return muralPorGps(cards.value, posicao.value);
  return bairro.value ? muralPorBairro(cards.value, bairro.value) : [];
});

const MENSAGEM_GPS = {
  negado: 'Sem permissão de localização. Escolha o bairro.',
  impreciso: 'A localização do celular está imprecisa (mais de 1 km). Escolha o bairro.',
  indisponivel: 'Não foi possível obter a localização. Escolha o bairro.',
};

async function carregar() {
  erro.value = '';
  carregando.value = true;
  try {
    cards.value = await api.get('/doacoes?status=ativo');
    if (!bairro.value || !bairros.value.includes(bairro.value)) {
      bairro.value = bairros.value.includes(perfil.value?.bairro) ? perfil.value.bairro : bairros.value[0] || '';
    }
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}

function pedirLocalizacao() {
  if (!('geolocation' in navigator)) {
    situacaoGps.value = 'indisponivel';
    modo.value = 'bairro';
    return;
  }
  situacaoGps.value = 'pedindo';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (!precisaoAceita(coords)) {
        situacaoGps.value = 'impreciso';
        modo.value = 'bairro';
        return;
      }
      posicao.value = { latitude: coords.latitude, longitude: coords.longitude };
      situacaoGps.value = 'ok';
      modo.value = 'gps';
    },
    (falha) => {
      situacaoGps.value = falha.code === 1 ? 'negado' : 'indisponivel';
      modo.value = 'bairro';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

function escolherGps() {
  if (situacaoGps.value === 'ok') modo.value = 'gps';
  else pedirLocalizacao();
}

// Regra 6: cada toque registra 1 contato. keepalive garante o envio mesmo abrindo o WhatsApp.
function registrarContato(card) {
  api.post('/contatos', { doacao_id: card.doacao_id }, { keepalive: true }).catch(() => {});
}

onMounted(() => {
  carregar();
  pedirLocalizacao();
});
</script>

<template>
  <div class="tela">
    <div class="item-linha" style="align-items: center">
      <h1>Doações perto de você</h1>
      <button class="botao pequeno" type="button" :disabled="carregando" @click="carregar">Atualizar</button>
    </div>

    <div class="abas" role="group" aria-label="Como buscar">
      <button type="button" :aria-pressed="modo === 'gps'" @click="escolherGps">Perto de mim (até 5 km)</button>
      <button type="button" :aria-pressed="modo === 'bairro'" @click="modo = 'bairro'">Por bairro</button>
    </div>

    <p v-if="modo === 'gps' && situacaoGps === 'pedindo'" class="carregando">Obtendo sua localização…</p>
    <p v-if="MENSAGEM_GPS[situacaoGps] && modo === 'bairro'" class="aviso info">{{ MENSAGEM_GPS[situacaoGps] }}</p>

    <div v-if="modo === 'bairro'" class="campo">
      <label for="bairro">Bairro</label>
      <select id="bairro" v-model="bairro" :disabled="bairros.length === 0">
        <option v-if="bairros.length === 0" value="">Nenhum bairro com doação ativa</option>
        <option v-for="b in bairros" :key="b" :value="b">{{ b }}</option>
      </select>
    </div>

    <p v-if="carregando" class="carregando">Carregando doações…</p>
    <p v-else-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
    <template v-else>
      <p v-if="modo === 'gps' && situacaoGps === 'ok' && visiveis.length === 0" class="cartao vazio">
        Nenhuma doação ativa a até 5 km. Tente buscar por bairro.
      </p>
      <p v-else-if="modo === 'bairro' && visiveis.length === 0" class="cartao vazio">
        Nenhuma doação ativa no momento.
      </p>

      <ul class="lista">
        <li v-for="c in visiveis" :key="c.doacao_id" class="cartao item">
          <div class="item-linha">
            <span class="item-nome">{{ c.produto }} · {{ quantidadeComUnidade(c.quantidade, c.unidade) }}</span>
            <span v-if="c.distancia_km !== undefined" class="pill">{{ formatarKm(c.distancia_km) }}</span>
          </div>
          <div class="item-detalhe">{{ c.estabelecimento }} · {{ c.bairro }}</div>
          <div v-if="c.endereco_retirada" class="item-detalhe">
            <strong style="color: var(--texto)">Buscar em:</strong> {{ c.endereco_retirada }}
            <span v-if="!c.retirada_na_loja" class="pill info" style="margin-left: 4px">fora da loja</span>
          </div>
          <div class="item-detalhe">Retirar até {{ dataHoraCurta(c.prazo_retirada) }}</div>
          <div v-if="c.observacao" class="item-detalhe">“{{ c.observacao }}”</div>
          <div class="botoes">
            <a v-if="linkMapa(c)" class="botao" :href="linkMapa(c)" target="_blank" rel="noopener" style="flex: 0 0 auto">Ver no mapa</a>
            <a
              class="botao whatsapp" :href="linkWhatsApp(c, perfil?.nome ?? '')" target="_blank" rel="noopener"
              @click="registrarContato(c)"
            >Conversar no WhatsApp</a>
          </div>
        </li>
      </ul>
    </template>

    <p class="rodape-nota">Sua localização fica só no seu celular e não é enviada ao Elo Alimentar.</p>
  </div>
</template>
