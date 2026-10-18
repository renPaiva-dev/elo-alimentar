// Formatação para as telas (ESPECIFICACAO-MVP.md, seção 0): dinheiro em R$, datas no
// fuso America/Fortaleza e rótulos de validade do RF-03. Funções puras, testadas no Vitest.
export const FUSO = 'America/Fortaleza';

/** 350 → "R$ 3,50" */
export function reais(centavos) {
  return (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "R$ 3,50" | "3,5" | "3.50" → 350 (centavos inteiros) ou NaN */
export function paraCentavos(texto) {
  const limpo = String(texto ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return NaN;
  return Math.round(Number(limpo) * 100);
}

/** (6, "un") → "6 un"; (1.5, "kg") → "1,5 kg" */
export function quantidadeComUnidade(quantidade, unidade) {
  const n = Number(quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${n} ${unidade}`;
}

/** Data de hoje (AAAA-MM-DD) em America/Fortaleza. */
export function hojeFortaleza(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** "2026-10-02" → "02/10/2026" */
export function dataBR(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Instante → "01/10 às 18:00" no fuso de Teresina. */
export function dataHoraCurta(instante) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month} às ${partes.hour}:${partes.minute}`;
}

/** Valor de <input type="datetime-local"> ("2026-10-01T18:00") → ISO com o fuso de Teresina. */
export function localParaIso(valorLocal) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valorLocal) ? `${valorLocal}:00-03:00` : '';
}

/** Instante → valor para <input type="datetime-local"> no fuso de Teresina. */
export function isoParaLocal(instante) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** dias = data_validade − hoje, em dias corridos (negativo = vencido). */
export function diasParaVencer(dataValidade, hoje = hojeFortaleza()) {
  return Math.round((Date.parse(`${dataValidade}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
}

/** RF-03, regra 2. Vencido devolve "vencido". */
export function rotuloValidade(dias) {
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}
