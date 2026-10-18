// Validação do PATCH /perfil do comerciante ("Meu estabelecimento", spec v1.2).
// O banco repete as regras em atualizar_meu_estabelecimento (Princípio do Oráculo).
const CAMPOS = ['nome', 'bairro', 'endereco', 'whatsapp_comercial', 'latitude', 'longitude'];

const textoEntre = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

/**
 * Corpo: qualquer combinação de { nome, bairro, endereco, whatsapp_comercial, latitude, longitude }.
 * latitude e longitude vão juntas; as duas null apagam a localização.
 * @returns {{ok:true, mudancas:Object} | {ok:false, erro:string}}
 */
export function validarEstabelecimento(corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo) || Object.keys(corpo).length === 0) {
    return { ok: false, erro: 'Informe ao menos um campo: nome, bairro, endereco, whatsapp_comercial ou localização.' };
  }
  if (Object.keys(corpo).some((c) => !CAMPOS.includes(c))) {
    return { ok: false, erro: 'Só é possível editar nome, bairro, endereço, WhatsApp e localização.' };
  }

  const m = {};
  if ('nome' in corpo) {
    if (!textoEntre(corpo.nome, 2, 80)) return { ok: false, erro: 'O nome do estabelecimento deve ter de 2 a 80 caracteres.' };
    m.nome = corpo.nome.trim();
  }
  if ('bairro' in corpo) {
    if (!textoEntre(corpo.bairro, 2, 60)) return { ok: false, erro: 'O bairro deve ter de 2 a 60 caracteres.' };
    m.bairro = corpo.bairro.trim();
  }
  if ('endereco' in corpo) {
    if (!textoEntre(corpo.endereco, 5, 150)) return { ok: false, erro: 'O endereço deve ter de 5 a 150 caracteres.' };
    m.endereco = corpo.endereco.trim();
  }
  if ('whatsapp_comercial' in corpo) {
    if (!/^55\d{11}$/.test(String(corpo.whatsapp_comercial ?? ''))) {
      return { ok: false, erro: 'WhatsApp inválido. Use DDD + número com 9 dígitos, por exemplo (86) 99999-0001.' };
    }
    m.whatsapp_comercial = corpo.whatsapp_comercial;
  }
  if ('latitude' in corpo || 'longitude' in corpo) {
    const { latitude: lat, longitude: lon } = corpo;
    if (lat === null && lon === null) {
      m.limpar_localizacao = true;
    } else if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      m.latitude = lat;
      m.longitude = lon;
    } else {
      return { ok: false, erro: 'Informe latitude e longitude juntas.' };
    }
  }
  return { ok: true, mudancas: m };
}
