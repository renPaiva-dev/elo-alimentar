#!/usr/bin/env bash
# Roteiro do Checkpoint #2 (Aula 10): exercita a API real (Express → Supabase) com os
# valores dos cenários BDD e imprime uma tabela com o status esperado e o obtido.
# Pré-requisito: API no ar em outro terminal (npm run api). Não lê nenhuma chave.
# Uso: bash backend/scripts/checkpoint.sh   (ou API=https://... bash backend/scripts/checkpoint.sh)
set -u
BASE="${API:-http://localhost:3000/api/v1}"
HOJE=$(TZ=America/Fortaleza date +%F)
D() { TZ=America/Fortaleza date -d "$HOJE $1 day" +%F; }
TMP=$(mktemp -d)
FALHAS=0
LINHAS=()

req() { # método caminho [corpo] → define ST, BODY, LOC
  local args=(-s -o "$TMP/b" -D "$TMP/h" -X "$1" -H "Content-Type: application/json")
  [ -n "${3:-}" ] && args+=(--data "$3")
  curl "${args[@]}" "$BASE$2"
  ST=$(awk 'NR==1{print $2}' "$TMP/h")
  BODY=$(cat "$TMP/b")
  LOC=$(grep -i '^location:' "$TMP/h" | tr -d '\r' | cut -d' ' -f2)
}

reg() { # cenário esperado detalhe
  local ok="✅"; [ "$ST" = "$2" ] || { ok="❌"; FALHAS=$((FALHAS + 1)); }
  LINHAS+=("| $1 | $2 | $ST | $3 | $ok |")
}

pao() { echo "{\"nome\":\"Pão francês\",\"unidade\":\"un\",\"quantidade\":10,\"preco_centavos\":80,\"data_validade\":\"$(D +2)\"}"; }

req POST /produtos "$(pao)";                   P1=$(echo "$BODY" | jq -r .id); reg "RF-01 POST /produtos (Pão francês, 10 un, R\$ 0,80)" 201 "Location: $LOC"
req POST /produtos "{\"nome\":\"Leite\",\"unidade\":\"un\",\"quantidade\":1,\"preco_centavos\":500,\"data_validade\":\"$(D -1)\"}"
reg "RF-01 POST /produtos vencido (ontem)" 400 "$(echo "$BODY" | jq -r .erro)"
req POST /produtos '{}';                       reg "RF-01 POST /produtos corpo vazio" 400 "$(echo "$BODY" | jq -r .erro)"
req POST /produtos '{"nome": ';                reg "RF-01 POST /produtos JSON malformado" 400 "$(echo "$BODY" | jq -r .erro)"
req GET  "/produtos/$P1";                      reg "RF-01 GET /produtos/:id" 200 "quantidade $(echo "$BODY" | jq -r .quantidade)"
req PATCH "/produtos/$P1" '{"preco_centavos":70}'; reg "RF-01 PATCH /produtos/:id (preço 70)" 200 "preco_centavos $(echo "$BODY" | jq -r .preco_centavos)"
req PATCH "/produtos/$P1" '{"preco_centavos":80}'
req PATCH /produtos/00000000-0000-0000-0000-000000000000 '{"preco_centavos":70}'; reg "RF-01 PATCH id inexistente" 404 "$(echo "$BODY" | jq -r .erro)"
req POST /vendas "{\"itens\":[{\"produto_id\":\"$P1\",\"quantidade\":4}]}"
V1=$(echo "$BODY" | jq -r .venda_id);          reg "RF-02 POST /vendas (4 un do pão)" 201 "total_centavos $(echo "$BODY" | jq -r .total_centavos) · Location: $LOC"
req GET  "/produtos/$P1";                      reg "RF-02 estoque após a venda" 200 "quantidade $(echo "$BODY" | jq -r .quantidade) (esperado 6)"
req GET  "/vendas/$V1";                        reg "RF-02 GET /vendas/:id" 200 "$(echo "$BODY" | jq -c '{total_centavos, itens: (.itens_venda | length)}')"
req POST /produtos "$(pao)";                   P2=$(echo "$BODY" | jq -r .id)
req POST /vendas "{\"itens\":[{\"produto_id\":\"$P2\",\"quantidade\":12}]}"
reg "RF-02 POST /vendas 12 un com estoque 10" 400 "$(echo "$BODY" | jq -r .erro)"
req GET  "/produtos/$P2";                      reg "RF-02 estoque após a falha" 200 "quantidade $(echo "$BODY" | jq -r .quantidade) (esperado 10)"
req POST /vendas '{"itens":[]}';               reg "RF-02 POST /vendas sem itens" 400 "$(echo "$BODY" | jq -r .erro)"
req GET  "/produtos";                          reg "RF-01 GET /produtos" 200 "$(echo "$BODY" | jq length) produtos"
req DELETE "/produtos/$P2";                    reg "RF-01 DELETE /produtos/:id" 204 "corpo: '${BODY}'"
req DELETE "/produtos/$P2";                    reg "RF-01 DELETE de novo (idempotente)" 404 "$(echo "$BODY" | jq -r .erro)"
req DELETE "/produtos/$P1";                    reg "RF-01 DELETE produto com venda" 409 "$(echo "$BODY" | jq -r .erro)"

echo "Data de referência (America/Fortaleza): $HOJE · API: $BASE"
echo
echo "| Cenário | Esperado | Obtido | Detalhe | OK |"
echo "|---|---|---|---|---|"
printf '%s\n' "${LINHAS[@]}"
echo
echo "Ficaram no banco: produto $P1 (com a venda $V1). Falhas: $FALHAS"
rm -rf "$TMP"
exit $(( FALHAS > 0 ))
