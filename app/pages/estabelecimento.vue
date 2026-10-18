<script setup>
// "Meu estabelecimento" (spec v1.2): o comerciante corrige nome, bairro, endereço,
// WhatsApp e a localização da loja. A localização é da LOJA (não de pessoas) e é ela
// que o mural usa para calcular a distância até a entidade.
const api = useApi();
const { perfil } = useSessao();
const PRECISAO_BOA_M = 100;

const nome = ref('');
const bairro = ref('');
const endereco = ref('');
const whatsapp = ref('');
const localizacao = ref(null); // { latitude, longitude, precisao? }
const situacaoGps = ref('');
const erro = ref('');
const sucesso = ref('');
const enviando = ref(false);

function preencher(p) {
  nome.value = p.nome ?? '';
  bairro.value = p.bairro ?? '';
  endereco.value = p.endereco ?? '';
  whatsapp.value = formatarWhatsApp(p.whatsapp_comercial);
  localizacao.value = Number.isFinite(p.latitude) ? { latitude: p.latitude, longitude: p.longitude } : null;
}
onMounted(() => preencher(perfil.value));

const linkDaLoja = computed(() => (localizacao.value
  ? linkMapa({ latitude: localizacao.value.latitude, longitude: localizacao.value.longitude, retirada_na_loja: true })
  : null));

function usarLocalizacaoDoCelular() {
  erro.value = '';
  if (!('geolocation' in navigator)) {
    situacaoGps.value = 'Este aparelho não informa a localização.';
    return;
  }
  situacaoGps.value = 'Obtendo a localização da loja…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (coords.accuracy > PRECISAO_MAXIMA_M) {
        situacaoGps.value = `Localização imprecisa (cerca de ${Math.round(coords.accuracy)} m). Ligue o GPS do celular e tente perto da porta.`;
        return;
      }
      localizacao.value = { latitude: coords.latitude, longitude: coords.longitude, precisao: Math.round(coords.accuracy) };
      situacaoGps.value = coords.accuracy <= PRECISAO_BOA_M
        ? `Localização capturada (precisão de ${Math.round(coords.accuracy)} m). Toque em Salvar.`
        : `Localização capturada, mas com precisão de ${Math.round(coords.accuracy)} m. Confira em "Ver no mapa" e toque em Salvar.`;
    },
    (falha) => {
      situacaoGps.value = falha.code === 1
        ? 'Sem permissão de localização. Libere a localização para este site nas configurações do navegador.'
        : 'Não foi possível obter a localização. Tente de novo com o GPS ligado.';
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
}

function removerLocalizacao() {
  localizacao.value = null;
  situacaoGps.value = 'A localização será removida ao salvar. Sem ela, a loja só aparece no mural por bairro.';
}

async function salvar() {
  erro.value = '';
  sucesso.value = '';
  const atual = perfil.value;
  const mudancas = {};

  if (nome.value.trim() !== atual.nome) mudancas.nome = nome.value.trim();
  if (bairro.value.trim() !== atual.bairro) mudancas.bairro = bairro.value.trim();
  if (endereco.value.trim() && endereco.value.trim() !== (atual.endereco ?? '')) mudancas.endereco = endereco.value.trim();

  if (whatsapp.value.trim()) {
    const numero = normalizarWhatsApp(whatsapp.value);
    if (!numero) {
      erro.value = 'WhatsApp inválido. Digite DDD + número com 9 dígitos, por exemplo (86) 99999-0001.';
      return;
    }
    if (numero !== atual.whatsapp_comercial) mudancas.whatsapp_comercial = numero;
  }

  const tinha = Number.isFinite(atual.latitude);
  if (localizacao.value && (!tinha || localizacao.value.latitude !== atual.latitude || localizacao.value.longitude !== atual.longitude)) {
    mudancas.latitude = localizacao.value.latitude;
    mudancas.longitude = localizacao.value.longitude;
  } else if (!localizacao.value && tinha) {
    mudancas.latitude = null;
    mudancas.longitude = null;
  }

  if (Object.keys(mudancas).length === 0) {
    sucesso.value = 'Nada mudou.';
    return;
  }

  enviando.value = true;
  try {
    perfil.value = await api.patch('/perfil', mudancas);
    preencher(perfil.value);
    situacaoGps.value = '';
    sucesso.value = 'Dados da loja salvos.';
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
      <div>
        <h1>Meu estabelecimento</h1>
        <p class="subtitulo">É o que as entidades veem no mural para chamar e buscar as doações.</p>
      </div>
    </div>

    <form class="cartao formulario" @submit.prevent="salvar">
      <div class="campo">
        <label for="nome">Nome do estabelecimento</label>
        <input id="nome" v-model="nome" required minlength="2" maxlength="80">
      </div>

      <div class="campo">
        <label for="whatsapp">WhatsApp para as entidades chamarem</label>
        <input id="whatsapp" v-model="whatsapp" inputmode="tel" autocomplete="tel" placeholder="(86) 99999-0001">
        <span class="dica">Só o número comercial que você autoriza mostrar às entidades.</span>
      </div>

      <div class="campo">
        <label for="endereco">Endereço para retirada</label>
        <input id="endereco" v-model="endereco" maxlength="150" placeholder="Ex.: Rua Areolino de Abreu, 100 — porta lateral">
        <span class="dica">Rua, número e um ponto de referência. Aparece no card da doação.</span>
      </div>

      <div class="campo">
        <label for="bairro">Bairro</label>
        <input id="bairro" v-model="bairro" required minlength="2" maxlength="60">
        <span class="dica">Usado no mural quando a entidade busca por bairro.</span>
      </div>

      <div class="campo">
        <span style="font-weight: 700; font-size: .92rem">Localização da loja</span>
        <div class="item-linha" style="align-items: center">
          <span v-if="localizacao" class="pill">definida</span>
          <span v-else class="pill alerta">não definida</span>
          <a v-if="linkDaLoja" :href="linkDaLoja" target="_blank" rel="noopener" class="botao pequeno">Ver no mapa</a>
        </div>
        <span class="dica">
          Com ela, o mural mostra a distância até cada entidade. Use estando <strong>dentro da loja</strong>, com o GPS ligado.
        </span>
        <div class="botoes">
          <button class="botao pequeno" type="button" @click="usarLocalizacaoDoCelular">Usar a localização do celular</button>
          <button v-if="localizacao" class="botao pequeno perigo" type="button" @click="removerLocalizacao">Remover</button>
        </div>
        <p v-if="situacaoGps" class="aviso info" role="status">{{ situacaoGps }}</p>
      </div>

      <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
      <p v-if="sucesso" class="aviso sucesso" role="status">{{ sucesso }}</p>
      <button class="botao primario bloco" type="submit" :disabled="enviando">
        {{ enviando ? 'Salvando…' : 'Salvar' }}
      </button>
    </form>
  </div>
</template>
