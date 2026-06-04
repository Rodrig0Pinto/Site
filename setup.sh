#!/bin/bash
# ============================================================
#  Deploy Automático — RP Advogados
#  Executado automaticamente ao criar o Codespace
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Deploy Automático — RP Advogados   ║"
echo "╚══════════════════════════════════════╝"
echo ""

cd /workspaces/Site 2>/dev/null || true

# ── 1. Ativar GitHub Pages ──────────────────────────────────
echo "▶ [1/5] Ativando GitHub Pages..."

HTTP=$(curl -s -o /tmp/pages.json -w "%{http_code}" \
  -X POST "https://api.github.com/repos/Rodrig0Pinto/Site/pages" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  --data '{"build_type":"workflow"}')

if   [ "$HTTP" = "201" ]; then echo "   ✅ GitHub Pages ativado!"
elif [ "$HTTP" = "409" ]; then echo "   ✅ GitHub Pages já estava ativo."
else
  echo "   ⚠️  Resposta $HTTP:"
  cat /tmp/pages.json && echo ""
fi

# ── 2. Aguardar inicialização (5s) ─────────────────────────
echo "▶ [2/5] Aguardando inicialização..."
sleep 5

# ── 3. Configurar domínio personalizado ───────────────────
echo "▶ [3/5] Configurando domínio rodrigopinto.adv.br..."

HTTP2=$(curl -s -o /tmp/domain.json -w "%{http_code}" \
  -X PUT "https://api.github.com/repos/Rodrig0Pinto/Site/pages" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  --data '{"cname":"rodrigopinto.adv.br","https_enforced":true}')

if [ "$HTTP2" = "204" ]; then
  echo "   ✅ Domínio personalizado configurado!"
else
  echo "   ℹ️  Resposta $HTTP2 ao configurar domínio (normal na primeira vez)"
fi

# ── 4. Configurar DNS no Cloudflare (opcional) ─────────────
echo "▶ [4/5] Cloudflare DNS..."

if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  echo "   Token Cloudflare encontrado — configurando DNS..."

  ZONE_JSON=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=rodrigopinto.adv.br" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

  ZONE_ID=$(echo "$ZONE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('result', [])
print(results[0]['id'] if results else '')
" 2>/dev/null)

  if [ -n "$ZONE_ID" ]; then
    echo "   Zone ID: $ZONE_ID"

    # Remover CNAME existente se houver
    EXISTING=$(curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=CNAME&name=rodrigopinto.adv.br" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
      python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null)

    if [ -n "$EXISTING" ]; then
      curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$EXISTING" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" > /dev/null
      echo "   🗑️  CNAME anterior removido."
    fi

    # Adicionar novo CNAME
    DNS_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"type":"CNAME","name":"rodrigopinto.adv.br","content":"rodrig0pinto.github.io","proxied":false,"ttl":1}')

    SUCCESS=$(echo "$DNS_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)

    if [ "$SUCCESS" = "True" ]; then
      echo "   ✅ CNAME adicionado: rodrigopinto.adv.br → rodrig0pinto.github.io"
    else
      echo "   ⚠️  Falha ao adicionar CNAME:"
      echo "$DNS_RESULT"
    fi
  else
    echo "   ⚠️  Zone ID não encontrado para rodrigopinto.adv.br"
  fi
else
  echo "   ℹ️  Token Cloudflare não configurado — DNS deverá ser feito manualmente."
  echo "   👉 Adicione: CNAME  rodrigopinto.adv.br  →  rodrig0pinto.github.io (sem proxy)"
fi

# ── 5. Configurar git e acionar o deploy ──────────────────
echo "▶ [5/5] Acionando deploy..."
git config user.email "rodpinto@me.com"
git config user.name  "Rodrig0Pinto"
git commit --allow-empty -m "chore: deploy automático via Codespace"
git push origin main

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅ Processo concluído!                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  🔍 Acompanhe o deploy em:                           ║"
echo "║  github.com/Rodrig0Pinto/Site/actions                ║"
echo "║                                                       ║"
echo "║  🌐 Site ficará disponível em:                       ║"
echo "║  rodrigopinto.adv.br  (após DNS propagar ~5 min)     ║"
echo "║                                                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
