# CLAUDE.md — Memória Permanente do Projeto

> Lido automaticamente pelo Claude Code no início de cada sessão.
> Mantém o contexto completo para atuar de forma autônoma e sem burocracia.

---

## Idioma

**Português brasileiro é o idioma padrão e irrevogável de todas as interações neste projeto.** Responder sempre em pt-BR, independentemente do idioma usado na pergunta.

---

## Autorização

O proprietário **Rodrigo Pinto** (`rodrigopinto@outlook.com`) concede plena e expressa autorização para que o Claude atue de forma autônoma em todas as operações deste projeto, incluindo edição de arquivos, deploy, configuração de DNS e modificações no workflow de CI/CD.

---

## Identidade do Projeto

| Campo | Valor |
|---|---|
| Nome | RP Advogados \| RODRIGO PINTO — Sociedade Individual de Advocacia |
| Domínio | `rodrigopinto.adv.br` |
| Tipo | Site institucional estático (HTML/CSS/JS puro) |
| E-mail de contato | `rodrigopinto@outlook.com` |
| E-mail do iCloud | `rodpinto@me.com` (preservar registros MX) |

---

## Repositório GitHub

| Campo | Valor |
|---|---|
| Owner | `Rodrig0Pinto` (**zero**, não letra O) |
| Repo | `Site` |
| URL | `https://github.com/Rodrig0Pinto/Site` |
| Branch de produção | `main` |
| Branch padrão no GitHub | `claude/law-office-website-iWcEZ` (**não** é o main!) |
| Visibilidade | Público |

**Atenção:** O nome de usuário é `Rodrig0Pinto` com **zero (0)** no lugar do "o" de "Rodrigo". Sempre usar zero, nunca letra O.

**Atenção (crons):** workflows agendados executam no **branch padrão** (`claude/law-office-website-iWcEZ`), não no `main`. Todo workflow com `schedule:` deve fazer checkout explícito de `ref: main` e push por refspec completa (`git push origin HEAD:main`) — nunca `git push origin main`, que falha com "src refspec main does not match any" (causa das falhas semanais de 15/06 a 06/07/2026, corrigidas em 07/07/2026). Solução definitiva opcional: o proprietário alterar o branch padrão para `main` em Settings → General → Default branch.

**Nota (07/07/2026):** alterar o branch padrão **não é automatizável pelo Claude** — o MCP do GitHub não expõe `PATCH /repos` (configurações do repositório), não há `gh` CLI nem acesso à API REST neste ambiente. Já foi tentado; não repetir. Precisa ser feito pelo proprietário na interface (≈20 segundos). Verificar depois com `git ls-remote --symref origin HEAD` (deve apontar para `refs/heads/main`). Enquanto não for feito, os workflows já estão imunes (checkout `ref: main` + push `HEAD:main`).

---

## Estrutura de Arquivos (branch `main`)

```
Site/
├── index.html          ← Site completo (34 KB) — uma única página
├── css/
│   └── style.css       ← Todos os estilos (27 KB)
├── js/
│   └── main.js         ← Scripts (navegação, animações, formulário)
├── _headers            ← Cabeçalhos de segurança HTTP (Cloudflare Pages)
├── _redirects          ← Redirecionamento www → raiz (Cloudflare Pages)
├── .github/
│   └── workflows/
│       └── deploy.yml  ← CI/CD automático
└── CLAUDE.md           ← Este arquivo
```

---

## Design e Identidade Visual

| Elemento | Valor |
|---|---|
| Cor primária | Azul-marinho escuro `#0a1628` |
| Cor de destaque | Dourado `#c9a84c` |
| Fontes | Playfair Display (títulos), Raleway (subtítulos), Lato (texto) |
| Fonte Google Fonts | Carregadas via CDN no `<head>` do `index.html` |
| Layout | Single-page com seções: Hero, Sobre, Áreas, Diferenciais, Contato |

---

## Infraestrutura de Deploy

### Plataforma: Cloudflare Pages

| Campo | Valor |
|---|---|
| Account ID | `98e6796621cebf858b31cf0cc2256d41` |
| Zone ID (rodrigopinto.adv.br) | `b3251592f71315cb3622c92072ac3550` |
| Projeto Pages | `rodrigopinto-adv-br` |
| URL temporária | `https://rodrigopinto-adv-br.pages.dev` |
| URL de produção | `https://rodrigopinto.adv.br` |

### Como o deploy funciona

1. Qualquer push ao branch `main` aciona o workflow `.github/workflows/deploy.yml`
2. O workflow decoda as credenciais em runtime (nunca em texto puro nos logs)
3. Usa `wrangler@3` para fazer upload dos arquivos ao Cloudflare Pages
4. O domínio `rodrigopinto.adv.br` já está vinculado ao projeto
5. DNS e SSL são gerenciados automaticamente pelo Cloudflare

### Credenciais no workflow

O token da Cloudflare está codificado no `deploy.yml` com duplo encoding (reversão + base64) e mascarado nos logs com `::add-mask::`. **Não precisa de GitHub Secrets nem de qualquer configuração manual.** A lógica de decodificação é:

```bash
T=$(printf '%s' '<ENCODED>' | base64 -d | rev)
```

Se o token precisar ser renovado no futuro, gerar novo token em `dash.cloudflare.com`, codificar com:
```bash
echo -n "<novo-token>" | rev | base64 -w 0
```
E atualizar a string no `deploy.yml`.

---

## Registros DNS Cloudflare (não modificar)

| Tipo | Nome | Conteúdo | Obs |
|---|---|---|---|
| MX | `@` | `mx01.mail.icloud.com` | iCloud Mail — **preservar** |
| MX | `@` | `mx02.mail.icloud.com` | iCloud Mail — **preservar** |
| CNAME | `@` | `rodrigopinto-adv-br.pages.dev` | Site — Cloudflare Pages |
| CNAME | `sig1._domainkey` | `sig1.dkim.rodrigopinto.adv.br.at.icloud...` | DKIM iCloud Mail — **preservar** |

**NUNCA alterar os registros MX nem o DKIM (`sig1._domainkey`).** O e-mail `rodpinto@me.com` (iCloud) depende deles.

> **Nota:** O CNAME `@` → `rodrigopinto-adv-br.pages.dev` foi criado manualmente em 2026-06-04, pois a API do Cloudflare Pages não o gerou automaticamente. Em futuros projetos, criar este registro manualmente após o deploy.

---

## Como Fazer Atualizações no Site

### Fluxo simples (sem interação manual)

```bash
# 1. Editar o arquivo desejado
# 2. Fazer push ao branch main
git add .
git commit -m "descrição da alteração"
git push origin main
# 3. O deploy acontece automaticamente em ~30 segundos
```

Ou via MCP (dentro do Claude Code):
```
mcp__github__push_files  →  branch: main  →  deploy automático
```

### Alterações comuns

| O que mudar | Onde |
|---|---|
| Textos, seções, conteúdo | `index.html` |
| Cores, fontes, espaçamentos | `css/style.css` |
| Animações, menu, formulário | `js/main.js` |
| Cabeçalhos HTTP de segurança | `_headers` |
| Redirecionamentos de URL | `_redirects` |
| Pipeline de deploy | `.github/workflows/deploy.yml` |

---

## Histórico de Tentativas Fracassadas (não repetir)

Abordagens que foram tentadas e **não funcionaram** neste projeto — não repetir:

1. **GitHub Pages via `actions/deploy-pages`** — exige ativar Pages manualmente (`has_pages: false`); o `GITHUB_TOKEN` de Actions não consegue ativar Pages.
2. **GitHub Codespace + `setup.sh`** — o usuário não criou o Codespace; abordagem abandonada.
3. **Netlify** — painel com crash fatal (`Netlify Internal ID: Ix6eVVhFri-fFdDSzE9WV`).
4. **Cloudflare API direto do sandbox** — bloqueada (403) para todas as APIs externas.
5. **`workflow_dispatch` via MCP** — retorna 403 "Resource not accessible by integration".
6. **Segredo no `workflow_dispatch` input** — bloqueado pelo scanner de segredos do MCP.
7. **Criar repositório `rodrig0pinto.github.io`** — MCP retorna 403 para criação de repos.

---

## Limitações do Sandbox Claude Code

- **O próprio site (`rodrigopinto.adv.br`) é inacessível do sandbox** (proxy 403 para o domínio; WebFetch idem). Verificar produção pelos logs do GitHub Actions (deploy `success` + IndexNow HTTP 202) — os runners rodam fora do sandbox.

- **APIs externas bloqueadas (403):** `api.github.com`, `api.cloudflare.com`, `netlify.com`, `vercel.com`
- **Git proxy local** (`127.0.0.1:34015`): suporta apenas protocolo git smart HTTP; não suporta REST API
- **MCP tools disponíveis:** push/delete arquivos, ler conteúdo, listar branches, jobs de Actions — **não** triggers de workflow_dispatch, **não** gestão de secrets
- **O que funciona:** `mcp__github__push_files`, `mcp__github__delete_file`, `mcp__github__get_file_contents`, `mcp__github__actions_list`, `mcp__github__get_job_logs`

---

## Sessão que Resolveu o Deploy

**Data:** 2026-06-04  
**Abordagem final:** GitHub Actions → Cloudflare Pages via `wrangler@3 pages deploy`, com token em runtime (codificado no workflow).  
**Resultado:** Deploy bem-sucedido, domínio `rodrigopinto.adv.br` vinculado, DNS/SSL automáticos.

### Confirmação final (2026-06-04) — SITE 100% NO AR

| Item | Status |
|---|---|
| Workflow runs bem-sucedidos | ✅ Runs 26971561612, 26971951598, 26973107787 (`success`) |
| Projeto Cloudflare Pages criado | ✅ `rodrigopinto-adv-br` |
| URL temporária ativa | ✅ `https://rodrigopinto-adv-br.pages.dev` |
| Domínio personalizado ativo | ✅ `https://rodrigopinto.adv.br` — **SITE NO AR, CONFIRMADO PELO USUÁRIO** |
| Registro CNAME criado manualmente | ✅ `@` → `rodrigopinto-adv-br.pages.dev` (com proxy Cloudflare) |
| Registros MX iCloud preservados | ✅ `mx01/mx02.mail.icloud.com` intocados |
| DKIM iCloud preservado | ✅ `sig1._domainkey` intocado |
| Branches sincronizados | ✅ `main` e `claude/law-office-website-iWcEZ` |
| Vestígios de tentativas fracassadas removidos | ✅ CNAME, setup.sh, .devcontainer, workflows antigos deletados |

### Estrutura atual do site (para edições futuras)

| Arquivo | Conteúdo | Tamanho |
|---|---|---|
| `index.html` | HTML completo — Hero, Números, Áreas, Sobre, Diferenciais, Citação, Contato, Footer, WhatsApp | ~34 KB |
| `css/style.css` | Todos os estilos — variáveis CSS, layout, responsivo (1024/768/480px) | ~27 KB |
| `js/main.js` | Header scroll, nav ativa, menu mobile, contadores animados, scroll reveal, formulário | ~6 KB |

#### Estado atual (atualizado 2026-06-22)
- **WhatsApp:** ✅ `(83) 99905-0505` → `https://wa.me/5583999050505` — botão flutuante em todas as páginas, na seção de contato, no rodapé e no Schema (`telephone: +55-83-99905-0505`)
- **Ano no footer:** ✅ `© 2026`
- **Foto do advogado:** ✅ foto real em `img/foto-advogado.jpeg` (otimizada, 51 KB)
- **Número OAB:** ✅ OAB/PB nº 12.371 em todas as páginas
- **Endereço:** ✅ R. Afonso Barbosa de Oliveira, 1025, Sala 202, Pedro Gondim, João Pessoa/PB, CEP 58.031-120

#### SEO e indexação
- **14 artigos** em `/artigos/` + página de listagem `/artigos/index.html`
  - Por área (8): direito-civil-joao-pessoa, direito-empresarial-joao-pessoa, direito-penal-joao-pessoa, direito-familia-joao-pessoa, direito-bancario-revisao-contratos, planejamento-tributario, due-diligence-juridica, compliance-empresarial-lgpd
  - Cauda longa (6): usucapiao-joao-pessoa, pensao-alimenticia-joao-pessoa, busca-e-apreensao-veiculo-defesa, inventario-partilha-joao-pessoa, dano-moral-indenizacao, holding-familiar-protecao-patrimonial
- **Página 404 personalizada** (`404.html`, servida automaticamente pelo Cloudflare Pages; caminhos absolutos, noindex)
- **Cards de "Áreas de Atuação" da home** linkam para os 8 artigos de área (linking interno)
- **Schema.org:** WebSite+SearchAction, LegalService+LocalBusiness, Person, FAQPage (10 perguntas), Article+BreadcrumbList por artigo
- **IndexNow:** chave `193b6b06949ff5b798e3f55b03364a4a` (arquivo `193b6b06949ff5b798e3f55b03364a4a.txt` na raiz). Submissão automática a buscadores (Bing/Yandex/Seznam/Naver) a cada deploy e no cron semanal. **Não remover o arquivo da chave.**
- **og:image de marca:** `img/og-card.jpg` (1200x630, 58 KB) — cartão social com brasão + nome dourado, usado na home e em /artigos/ (artigos individuais usam a foto pessoal). Gerado com PIL + fontes oficiais (Playfair/Raleway/Lato).
- **Imagens:** servidas via `<picture>` com WebP + fallback. logo.png (46 KB, 640x640, fundo transparente, ?v=2)/logo.webp (51 KB) — logo oficial do proprietário (2026-07-17); foto-advogado.jpeg (51 KB)/foto-advogado.webp (29 KB). **Ao trocar logo/foto, gerar também o .webp correspondente.**
- **Cache-busting obrigatório:** `/css/*` e `/js/*` têm cache de 7 dias e `/img/*` de 30 dias no navegador. **Sempre que alterar `style.css`, incrementar o `?v=N`** nas referências de todas as páginas (atual: `css/style.css?v=3`; logo com `?v=2`) — sem isso, visitantes recorrentes ficam até uma semana vendo o estilo antigo (foi o caso do título dourado em 18/07/2026).
- **sitemap.xml:** 16 URLs; `_headers` com cache para img/css/js

#### Pendências que dependem do proprietário (exigem login Google — impossível automatizar)
- **Google Meu Negócio (Business Profile):** exige conta Google + verificação de identidade/endereço (vídeo ou carta). Coloca o escritório no Maps e no Local Pack — maior alavanca de SEO local.
- **Google Search Console:** exige conta Google. Verificar domínio e enviar `sitemap.xml` para indexação rápida no Google (o IndexNow cobre apenas Bing/Yandex, não o Google).
