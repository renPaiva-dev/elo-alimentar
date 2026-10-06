// Cálculos de validade da ESPECIFICACAO-MVP.md, seção 0 e RF-03, regra 2.
// Datas em AAAA-MM-DD; "hoje" vem sempre do fuso America/Fortaleza.

export function somarDias(isoData, dias) {
  const d = new Date(`${isoData}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** dias = data_validade − hoje, em dias corridos (negativo = vencido). */
export function diasParaVencer(dataValidade, hoje) {
  return Math.round((Date.parse(`${dataValidade}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
}

/** Rótulo do RF-03, regra 2. Vencidos (dias < 0) não têm rótulo de prazo. */
export function rotuloValidade(dias) {
  if (dias < 0) return null;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}
