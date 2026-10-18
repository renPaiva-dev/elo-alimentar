// "Meu estabelecimento" e local de retirada (spec v1.2). Funções puras, testadas no Vitest.

/** "(86) 99497-5451", "86994975451" ou "5586994975451" → "5586994975451"; inválido → "". */
export function normalizarWhatsApp(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  if (/^\d{2}9\d{8}$/.test(digitos)) return `55${digitos}`;
  if (/^55\d{2}9\d{8}$/.test(digitos)) return digitos;
  return '';
}

/** "5586994975451" → "(86) 99497-5451" */
export function formatarWhatsApp(w) {
  const d = String(w ?? '');
  return d.length === 13 ? `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}` : '';
}

/**
 * Link do Google Maps para "Ver no mapa" no card do mural.
 * Retirada na loja com coordenadas → ponto exato; outro local (ou sem coordenadas) → busca pelo endereço.
 */
export function linkMapa(card) {
  const temCoordenadas = Number.isFinite(card.latitude) && Number.isFinite(card.longitude);
  if (card.retirada_na_loja !== false && temCoordenadas) {
    return `https://www.google.com/maps/search/?api=1&query=${card.latitude},${card.longitude}`;
  }
  if (!card.endereco_retirada) return null;
  const busca = [card.endereco_retirada, card.bairro, 'Teresina - PI'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`;
}

/** O que falta para o estabelecimento aparecer bem no mural. */
export function pendenciasDoEstabelecimento(perfil) {
  const faltam = [];
  if (!perfil?.whatsapp_comercial) faltam.push('WhatsApp');
  if (!perfil?.endereco) faltam.push('endereço');
  if (!Number.isFinite(perfil?.latitude)) faltam.push('localização');
  return faltam;
}
