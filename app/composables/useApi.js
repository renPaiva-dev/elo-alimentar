// Chamadas à API REST (/api/v1) com o JWT da sessão (Authorization: Bearer).
// Erros da API chegam como { erro: "mensagem" } e viram Error com a mesma mensagem.
export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

async function cabecalhos() {
  const { data } = await useSupabase().auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useApi() {
  async function chamar(metodo, caminho, corpo, opcoes = {}) {
    let resp;
    try {
      resp = await fetch(`/api/v1${caminho}`, {
        method: metodo,
        headers: await cabecalhos(),
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        ...opcoes,
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor. Verifique a internet e tente de novo.', 0);
    }

    if (resp.status === 401) {
      await navigateTo('/login');
      throw new ErroApi('Sua sessão expirou. Entre de novo.', 401);
    }
    const texto = await resp.text();
    const json = texto ? JSON.parse(texto) : null;
    if (!resp.ok) throw new ErroApi(json?.erro || 'Algo deu errado. Tente de novo.', resp.status);
    return json;
  }

  return {
    get: (caminho) => chamar('GET', caminho),
    post: (caminho, corpo, opcoes) => chamar('POST', caminho, corpo, opcoes),
    patch: (caminho, corpo) => chamar('PATCH', caminho, corpo),
    del: (caminho) => chamar('DELETE', caminho),
  };
}
