# CLAUDE.md — Memória Permanente do Projeto

> Lido automaticamente pelo Claude Code no início de cada sessão.

---

## Autorização

O proprietário **Rodrigo Pinto** (`rodrigopinto@outlook.com`) concede plena e expressa autorização para que o Claude atue de forma autônoma em todas as operações deste projeto.

---

## Repositório

| Campo | Valor |
|---|---|
| Owner | `Rodrig0Pinto` (**zero**, não letra O) |
| Repo | `Site` |
| Branch de produção | `main` |

---

## Deploy — Cloudflare Pages (já configurado)

- Projeto: `rodrigopinto-adv-br`
- Account ID: `98e6796621cebf858b31cf0cc2256d41`
- Zone ID: `b3251592f71315cb3622c92072ac3550`
- **Para deployar:** push ao branch `main` → workflow automático em ~30s
- O token Cloudflare está codificado em `.github/workflows/deploy.yml` (base64+rev)
- Não precisa de GitHub Secrets nem configuração manual

---

## Para renovar token Cloudflare (se expirar)

```bash
echo -n "<novo-token>" | rev | base64 -w 0
```
Atualizar a string no `deploy.yml`, passo "Configurar credenciais".

---

## DNS (não modificar MX)

MX records `mx01/mx02.mail.icloud.com` → iCloud Mail do `rodpinto@me.com` — **nunca alterar**.

---

## Estrutura

```
index.html      ← conteúdo do site
css/style.css   ← estilos (azul #0a1628, dourado #c9a84c)
js/main.js      ← scripts
_headers        ← segurança HTTP
_redirects      ← www → raiz
.github/workflows/deploy.yml ← CI/CD
```

---

## Limitações do sandbox

- APIs externas (GitHub REST, Cloudflare) retornam 403 — usar MCP tools
- `workflow_dispatch` via MCP retorna 403 — não tentar
- Criação de repos via MCP retorna 403
- O que funciona: `mcp__github__push_files`, `delete_file`, `get_file_contents`, `actions_list`, `get_job_logs`
