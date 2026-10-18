// Testes de "Meu estabelecimento" e do "Ver no mapa" (spec v1.2).
import { describe, it, expect } from 'vitest';
import { normalizarWhatsApp, formatarWhatsApp, linkMapa, pendenciasDoEstabelecimento } from '../utils/estabelecimento.js';

describe('WhatsApp comercial', () => {
  it('aceita como o comerciante digita e guarda 55 + DDD + 9 dígitos', () => {
    expect(normalizarWhatsApp('(86) 99497-5451')).toBe('5586994975451');
    expect(normalizarWhatsApp('86994975451')).toBe('5586994975451');
    expect(normalizarWhatsApp('+55 86 99497-5451')).toBe('5586994975451');
  });

  it('recusa número sem o 9 do celular ou incompleto', () => {
    expect(normalizarWhatsApp('8632221234')).toBe('');
    expect(normalizarWhatsApp('99497-5451')).toBe('');
    expect(normalizarWhatsApp('')).toBe('');
  });

  it('formata para exibir', () => {
    expect(formatarWhatsApp('5586994975451')).toBe('(86) 99497-5451');
    expect(formatarWhatsApp(null)).toBe('');
  });
});

describe('Ver no mapa', () => {
  const card = {
    endereco_retirada: 'Rua Areolino de Abreu, 100', bairro: 'Centro', retirada_na_loja: true,
    latitude: -5.0892, longitude: -42.8019,
  };

  it('retirada na loja com coordenadas abre o ponto exato', () => {
    expect(linkMapa(card)).toBe('https://www.google.com/maps/search/?api=1&query=-5.0892,-42.8019');
  });

  it('outro local de retirada busca pelo endereço digitado, não pela loja', () => {
    const link = linkMapa({ ...card, retirada_na_loja: false, endereco_retirada: 'Feira do Dirceu, banca 12' });
    expect(decodeURIComponent(link.split('query=')[1])).toBe('Feira do Dirceu, banca 12, Centro, Teresina - PI');
  });

  it('loja sem coordenadas busca pelo endereço', () => {
    const link = linkMapa({ ...card, latitude: null, longitude: null });
    expect(decodeURIComponent(link.split('query=')[1])).toBe('Rua Areolino de Abreu, 100, Centro, Teresina - PI');
  });

  it('sem coordenadas e sem endereço não mostra o botão', () => {
    expect(linkMapa({ bairro: 'Centro', latitude: null, longitude: null })).toBeNull();
  });
});

describe('pendências do estabelecimento', () => {
  it('lista o que falta', () => {
    expect(pendenciasDoEstabelecimento({ whatsapp_comercial: '5586994975451', endereco: null, latitude: null }))
      .toEqual(['endereço', 'localização']);
    expect(pendenciasDoEstabelecimento({ whatsapp_comercial: '5586994975451', endereco: 'Rua A, 1', latitude: -5.08 }))
      .toEqual([]);
  });
});
