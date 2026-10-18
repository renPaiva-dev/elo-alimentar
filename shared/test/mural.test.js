// Testes do RF-05 no navegador (cenários BDD de sucesso, falha e alternativo). Fora de shared/utils
// porque o Nuxt importa automaticamente tudo o que está lá.
import { describe, it, expect } from 'vitest';
import {
  distanciaKm, formatarKm, muralPorGps, muralPorBairro, bairrosDoMural,
  precisaoAceita, mensagemWhatsApp, linkWhatsApp,
} from '../utils/mural.js';
import { reais, paraCentavos, quantidadeComUnidade, dataHoraCurta, localParaIso, rotuloValidade, diasParaVencer } from '../utils/formato.js';

// Entidade no Centro de Teresina (coordenadas fictícias, só para o teste).
const ENTIDADE = { latitude: -5.0892, longitude: -42.8019 };
// Pontos ao norte da entidade: 1° de latitude ≈ 111,2 km.
const aNorte = (km) => ({ latitude: ENTIDADE.latitude + km / 111.195, longitude: ENTIDADE.longitude });

const card = (id, km, prazo, extra = {}) => ({
  doacao_id: id, produto: 'Iogurte natural', unidade: 'un', quantidade: 6,
  prazo_retirada: prazo, estabelecimento: 'Mercadinho Exemplo', bairro: 'Centro',
  whatsapp_comercial: '5586999990001', ...(km === null ? { latitude: null, longitude: null } : aNorte(km)), ...extra,
});

describe('distância (RF-05, regra 2)', () => {
  it('Haversine bate com 1 grau de latitude ≈ 111,2 km', () => {
    expect(distanciaKm(ENTIDADE, { ...ENTIDADE, latitude: ENTIDADE.latitude + 1 })).toBeCloseTo(111.2, 1);
  });

  it('exibe em km com 1 casa decimal', () => {
    expect(formatarKm(2.3)).toBe('2,3 km');
    expect(formatarKm(2.349)).toBe('2,3 km');
    expect(formatarKm(5)).toBe('5,0 km');
  });
});

describe('mural por GPS', () => {
  it('sucesso BDD: anúncio ativo a 2,3 km aparece com "2,3 km"', () => {
    const r = muralPorGps([card('a', 2.3, '2026-10-01T21:00:00Z')], ENTIDADE);
    expect(r).toHaveLength(1);
    expect(formatarKm(r[0].distancia_km)).toBe('2,3 km');
  });

  it('falha BDD: o único anúncio a 7,8 km não aparece', () => {
    expect(muralPorGps([card('a', 7.8, '2026-10-01T21:00:00Z')], ENTIDADE)).toEqual([]);
  });

  it('5,0 km entra; 5,1 km não', () => {
    const r = muralPorGps([card('a', 5.0, '2026-10-01T21:00:00Z'), card('b', 5.1, '2026-10-01T21:00:00Z')], ENTIDADE);
    expect(r.map((c) => c.doacao_id)).toEqual(['a']);
  });

  it('ordena por distância e, no empate, pelo prazo mais próximo', () => {
    const r = muralPorGps([
      card('longe', 4, '2026-10-01T15:00:00Z'),
      card('perto-depois', 1, '2026-10-01T22:00:00Z'),
      card('perto-antes', 1, '2026-10-01T20:00:00Z'),
    ], ENTIDADE);
    expect(r.map((c) => c.doacao_id)).toEqual(['perto-antes', 'perto-depois', 'longe']);
  });

  it('estabelecimento sem coordenadas não entra no modo GPS', () => {
    expect(muralPorGps([card('a', null, '2026-10-01T21:00:00Z')], ENTIDADE)).toEqual([]);
  });

  it('aceita só leitura com precisão de até 1.000 m', () => {
    expect(precisaoAceita({ accuracy: 50 })).toBe(true);
    expect(precisaoAceita({ accuracy: 1000 })).toBe(true);
    expect(precisaoAceita({ accuracy: 1500 })).toBe(false);
    expect(precisaoAceita(undefined)).toBe(false);
  });
});

describe('mural por bairro (cenário alternativo)', () => {
  const cards = [
    card('c2', null, '2026-10-01T22:00:00Z'),
    card('f1', null, '2026-10-01T20:00:00Z', { bairro: 'Fátima' }),
    card('c1', null, '2026-10-01T19:00:00Z'),
  ];

  it('lista os bairros em ordem alfabética', () => {
    expect(bairrosDoMural(cards)).toEqual(['Centro', 'Fátima']);
  });

  it('mostra os anúncios do bairro, sem distância, pelo prazo mais próximo', () => {
    const r = muralPorBairro(cards, 'Centro');
    expect(r.map((c) => c.doacao_id)).toEqual(['c1', 'c2']);
    expect(r[0].distancia_km).toBeUndefined();
  });
});

describe('WhatsApp (RF-05, regra 5)', () => {
  const doacao = card('a', 2.3, '2026-10-01T21:00:00Z'); // 18:00 em Teresina

  it('mensagem pré-preenchida com entidade, quantidade, produto e prazo', () => {
    expect(mensagemWhatsApp(doacao, 'Banco de Alimentos Esperança')).toBe(
      'Olá! Somos da entidade Banco de Alimentos Esperança e vimos no Elo Alimentar a doação de 6 un de Iogurte natural. Podemos retirar até 01/10 às 18:00?',
    );
  });

  it('link wa.me com os 13 dígitos e o texto codificado', () => {
    const link = linkWhatsApp(doacao, 'Banco de Alimentos Esperança');
    expect(link.startsWith('https://wa.me/5586999990001?text=Ol%C3%A1!%20Somos')).toBe(true);
    expect(decodeURIComponent(link.split('?text=')[1])).toBe(mensagemWhatsApp(doacao, 'Banco de Alimentos Esperança'));
  });
});

describe('formatação das telas', () => {
  it('dinheiro em R$ e centavos inteiros', () => {
    expect(reais(350).replace(/\s/g, ' ')).toBe('R$ 3,50');
    expect(paraCentavos('3,50')).toBe(350);
    expect(paraCentavos('R$ 0,80')).toBe(80);
    expect(paraCentavos('9.999,99')).toBe(999999);
    expect(Number.isNaN(paraCentavos('abc'))).toBe(true);
  });

  it('quantidade com unidade', () => {
    expect(quantidadeComUnidade(6, 'un')).toBe('6 un');
    expect(quantidadeComUnidade(1.5, 'kg')).toBe('1,5 kg');
  });

  it('data e hora no fuso de Teresina', () => {
    expect(dataHoraCurta('2026-10-01T21:00:00Z')).toBe('01/10 às 18:00');
    expect(localParaIso('2026-10-01T18:00')).toBe('2026-10-01T18:00:00-03:00');
  });

  it('rótulos de validade do RF-03', () => {
    expect(rotuloValidade(diasParaVencer('2026-10-02', '2026-10-01'))).toBe('vence amanhã');
    expect(rotuloValidade(diasParaVencer('2026-10-04', '2026-10-01'))).toBe('vence em 3 dias');
    expect(rotuloValidade(diasParaVencer('2026-09-30', '2026-10-01'))).toBe('vencido');
  });
});
