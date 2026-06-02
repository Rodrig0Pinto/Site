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
echo "▶ [1/3] Ativando GitHub Pages..."

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

# ── 2. Configurar identidade git ───────────────────────────
echo "▶ [2/3] Configurando git..."
git config user.email "rodpinto@me.com"
git config user.name  "Rodrig0Pinto"

# ── 3. Acionar o workflow de deploy ───────────────────────
echo "▶ [3/3] Acionando deploy..."
git commit --allow-empty -m "chore: deploy automático via Codespace"
git push origin main

echo ""
echo "╔══════════════════════════════════════╗"
echo "║          Processo concluído!          ║"
echo "╠══════════════════════════════════════╣"
echo "║  Acompanhe em:                        ║"
echo "║  github.com/Rodrig0Pinto/Site/actions ║"
echo "║                                       ║"
echo "║  Site ficará disponível em:           ║"
echo "║  rodrig0pinto.github.io/Site          ║"
echo "╚══════════════════════════════════════╝"
echo ""
