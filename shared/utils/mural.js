// Regras do mural (RF-05) que rodam só no navegador: a localização da entidade nunca
// sai do aparelho (regra 4 e AGENTS.md, Regra 6). Funções puras, testadas no Vitest.
import { dataHoraCurta, quantidadeComUnidade } from './formato.js';

export const RAIO_MURAL_KM = 5;
export const PRECISAO_MAXIMA_M = 1000;

/** Leitura do GPS aceita só com precisão de até 1.000 m (RF-05, entradas). */
export function precisaoAceita(coords) {
  return Number.isFinite(coords?.accuracy) && coords.accuracy <= PRECISAO_MAXIMA_M;
}

/** Distância em km pela fórmula de Haversine (RF-05, regra 2). */
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** 2.345 → "2,3 km" (1 casa decimal). */
export function formatarKm(km) {
  return `${(Math.round(km * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

const porPrazo = (a, b) => Date.parse(a.prazo_retirada) - Date.parse(b.prazo_retirada);

/**
 * Modo GPS (regra 2): só anúncios a até 5,0 km, por distância e, no empate, pelo prazo.
 * Estabelecimento sem coordenadas cadastradas fica só no modo por bairro.
 */
export function muralPorGps(cards, posicao) {
  return cards
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    .map((c) => ({ ...c, distancia_km: Math.round(distanciaKm(posicao, c) * 10) / 10 }))
    .filter((c) => c.distancia_km <= RAIO_MURAL_KM)
    .sort((a, b) => a.distancia_km - b.distancia_km || porPrazo(a, b));
}

/** Modo bairro (regra 3): anúncios do bairro, sem distância, pelo prazo mais próximo. */
export function muralPorBairro(cards, bairro) {
  return cards.filter((c) => c.bairro === bairro).sort(porPrazo);
}

/** Bairros com anúncios ativos, em ordem alfabética. */
export function bairrosDoMural(cards) {
  return [...new Set(cards.map((c) => c.bairro))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Texto pré-preenchido da regra 5. */
export function mensagemWhatsApp(card, nomeEntidade) {
  const doacao = `${quantidadeComUnidade(card.quantidade, card.unidade)} de ${card.produto}`;
  return `Olá! Somos da entidade ${nomeEntidade} e vimos no Elo Alimentar a doação de ${doacao}. `
    + `Podemos retirar até ${dataHoraCurta(card.prazo_retirada)}?`;
}

/** https://wa.me/<13 dígitos>?text=<mensagem> (regra 5). */
export function linkWhatsApp(card, nomeEntidade) {
  return `https://wa.me/${card.whatsapp_comercial}?text=${encodeURIComponent(mensagemWhatsApp(card, nomeEntidade))}`;
}
