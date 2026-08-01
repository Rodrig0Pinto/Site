/* Painel privado de estatísticas — Rodrigo Pinto Advocacia
 *
 * Acesso: https://rodrigopinto.adv.br/painel?k=<CHAVE>
 *
 * A chave NÃO está neste arquivo: guarda-se apenas o SHA-256 dela.
 * Mesmo com o repositório público, o hash não revela a chave.
 * Sem a chave correta, a resposta é 404 — a página não se anuncia.
 */

const HASH_CHAVE = '9e332ef114ec1dbccecf27ae1a57f6cd10e242e5d37f80d8bbbcb31d7d8152f0';

async function sha256(texto) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Comparação em tempo constante, para não vazar informação por timing */
function iguais(a, b) {
    if (a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const naoEncontrado = () =>
    new Response('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>404</title></head><body><h1>404</h1></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

function hojeFortaleza() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
}

function diasAtras(n) {
    const d = new Date(Date.now() - n * 86400000);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
}

const num = n => (n ?? 0).toLocaleString('pt-BR');

function barras(linhas, campoRotulo, campoValor, limite = 12) {
    const dados = linhas.slice(0, limite);
    if (!dados.length) return '<p class="vazio">Nenhum acesso registrado ainda.</p>';
    const max = Math.max(...dados.map(l => l[campoValor] || 0), 1);
    return '<table class="tb">' + dados.map(l => {
        const v = l[campoValor] || 0;
        const pct = Math.max(2, Math.round((v / max) * 100));
        return `<tr>
            <td class="rot">${esc(l[campoRotulo])}</td>
            <td class="bar"><span style="width:${pct}%"></span></td>
            <td class="val">${num(v)}</td>
        </tr>`;
    }).join('') + '</table>';
}

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const chave = url.searchParams.get('k') || '';

    if (!chave || !iguais(await sha256(chave), HASH_CHAVE)) return naoEncontrado();

    if (!env.ESTATISTICAS) {
        return new Response(
            `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
             <meta name="robots" content="noindex,nofollow"><title>Painel</title></head>
             <body style="font-family:system-ui;background:#0a1628;color:#ecebe8;padding:40px">
             <h1 style="color:#c9a84c">Banco de estatísticas ainda não vinculado</h1>
             <p>O painel está no ar, mas o banco de dados D1 não foi vinculado ao projeto.
             Verifique a execução do workflow <strong>Infra — Banco de estatísticas (D1)</strong> no GitHub Actions.</p>
             </body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } }
        );
    }

    const db = env.ESTATISTICAS;
    const hoje = hojeFortaleza();
    const d7   = diasAtras(6);
    const d30  = diasAtras(29);

    const q = (sql, ...bind) => db.prepare(sql).bind(...bind).all();

    let totalGeral = 0, totalHoje = 0, total7 = 0, total30 = 0;
    let serie = [], paginas = [], regioes = [], paises = [], primeiroDia = null;

    try {
        const [rGeral, rHoje, r7, r30, rSerie, rPag, rReg, rPais, rIni] = await Promise.all([
            q('SELECT COALESCE(SUM(total),0) AS n FROM acessos'),
            q('SELECT COALESCE(SUM(total),0) AS n FROM acessos WHERE dia = ?', hoje),
            q('SELECT COALESCE(SUM(total),0) AS n FROM acessos WHERE dia >= ?', d7),
            q('SELECT COALESCE(SUM(total),0) AS n FROM acessos WHERE dia >= ?', d30),
            q('SELECT dia, SUM(total) AS n FROM acessos WHERE dia >= ? GROUP BY dia ORDER BY dia DESC', d30),
            q('SELECT pagina, SUM(total) AS n FROM acessos GROUP BY pagina ORDER BY n DESC LIMIT 15'),
            q(`SELECT (CASE WHEN cidade='--' THEN regiao ELSE cidade || ' — ' || regiao END) AS local,
                      SUM(total) AS n FROM acessos WHERE pais='BR' GROUP BY local ORDER BY n DESC LIMIT 15`),
            q('SELECT pais, SUM(total) AS n FROM acessos GROUP BY pais ORDER BY n DESC LIMIT 10'),
            q('SELECT MIN(dia) AS d FROM acessos')
        ]);
        totalGeral = rGeral.results[0]?.n || 0;
        totalHoje  = rHoje.results[0]?.n  || 0;
        total7     = r7.results[0]?.n     || 0;
        total30    = r30.results[0]?.n    || 0;
        serie      = rSerie.results || [];
        paginas    = rPag.results   || [];
        regioes    = rReg.results   || [];
        paises     = rPais.results  || [];
        primeiroDia = rIni.results[0]?.d || null;
    } catch (e) {
        return new Response(
            `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Painel</title></head>
             <body style="font-family:system-ui;background:#0a1628;color:#ecebe8;padding:40px">
             <h1 style="color:#c9a84c">Erro ao consultar o banco</h1><pre>${esc(String(e).slice(0, 400))}</pre>
             <p>Se o banco acabou de ser criado, aguarde o próximo deploy do site.</p></body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } }
        );
    }

    const agora = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Fortaleza'
    }).format(new Date());

    const serieAsc = [...serie].reverse();
    const maxSerie = Math.max(...serieAsc.map(l => l.n || 0), 1);
    const grafico = serieAsc.length
        ? `<div class="graf">${serieAsc.map(l => {
              const h = Math.max(3, Math.round(((l.n || 0) / maxSerie) * 100));
              const dm = l.dia.slice(8) + '/' + l.dia.slice(5, 7);
              return `<div class="col" title="${esc(dm)}: ${num(l.n)} acessos"><span style="height:${h}%"></span><i>${esc(l.dia.slice(8))}</i></div>`;
          }).join('')}</div>`
        : '<p class="vazio">Ainda sem dados no período.</p>';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Painel de Acessos — Rodrigo Pinto Advocacia</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 70'><path d='M30 2L56 14V38C56 52 44 64 30 68C16 64 4 52 4 38V14L30 2Z' fill='%230d1b2a' stroke='%23c9a84c' stroke-width='2'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-size='24' font-weight='700' fill='%23c9a84c'>RP</text></svg>">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:#0a1628;color:#ecebe8;padding:24px;line-height:1.5}
  .wrap{max-width:1080px;margin:0 auto}
  header{border-bottom:1px solid rgba(201,168,76,.3);padding-bottom:18px;margin-bottom:26px}
  h1{font-family:Georgia,serif;font-size:1.7rem;color:#c9a84c;font-weight:700;letter-spacing:.5px}
  .sub{font-size:.82rem;color:#8fa3bd;margin-top:6px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:30px}
  .card{background:rgba(255,255,255,.04);border:1px solid rgba(201,168,76,.22);border-radius:5px;padding:18px}
  .card b{display:block;font-size:2rem;color:#c9a84c;font-family:Georgia,serif;line-height:1.1}
  .card span{font-size:.72rem;text-transform:uppercase;letter-spacing:.09em;color:#8fa3bd;margin-top:6px;display:block}
  h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.11em;color:#c9a84c;
     margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(201,168,76,.18)}
  section{margin-bottom:32px}
  .graf{display:flex;align-items:flex-end;gap:3px;height:150px;padding:10px;
        background:rgba(255,255,255,.03);border:1px solid rgba(201,168,76,.15);border-radius:5px}
  .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:0}
  .col span{width:100%;background:linear-gradient(180deg,#e8d191,#9c7d33);border-radius:2px 2px 0 0;min-height:3px}
  .col i{font-size:.58rem;color:#6f8299;font-style:normal;margin-top:4px;white-space:nowrap}
  .tb{width:100%;border-collapse:collapse}
  .tb td{padding:6px 4px;vertical-align:middle;border-bottom:1px solid rgba(255,255,255,.05)}
  .rot{font-size:.83rem;color:#d5d9e0;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bar{width:45%}
  .bar span{display:block;height:8px;background:linear-gradient(90deg,#9c7d33,#e8d191);border-radius:4px}
  .val{text-align:right;font-size:.85rem;color:#c9a84c;font-weight:600;white-space:nowrap;width:70px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:26px}
  .vazio{color:#6f8299;font-size:.85rem;font-style:italic;padding:10px 0}
  footer{border-top:1px solid rgba(201,168,76,.2);padding-top:16px;margin-top:34px;
         font-size:.74rem;color:#6f8299;line-height:1.7}
  @media(max-width:760px){.grid2{grid-template-columns:1fr}.rot{max-width:180px}}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>Painel de Acessos</h1>
    <div class="sub">Rodrigo Pinto Advocacia &middot; atualizado em ${esc(agora)}${primeiroDia ? ' &middot; medindo desde ' + esc(primeiroDia.split('-').reverse().join('/')) : ''}</div>
  </header>

  <div class="cards">
    <div class="card"><b>${num(totalHoje)}</b><span>Hoje</span></div>
    <div class="card"><b>${num(total7)}</b><span>Últimos 7 dias</span></div>
    <div class="card"><b>${num(total30)}</b><span>Últimos 30 dias</span></div>
    <div class="card"><b>${num(totalGeral)}</b><span>Total acumulado</span></div>
  </div>

  <section>
    <h2>Acessos por dia (últimos 30 dias)</h2>
    ${grafico}
  </section>

  <div class="grid2">
    <section>
      <h2>Páginas mais acessadas</h2>
      ${barras(paginas, 'pagina', 'n', 15)}
    </section>
    <section>
      <h2>Origem no Brasil (cidade / estado)</h2>
      ${barras(regioes, 'local', 'n', 15)}
    </section>
  </div>

  <section>
    <h2>Por país</h2>
    ${barras(paises, 'pais', 'n', 10)}
  </section>

  <footer>
    Contagem agregada e anônima: são registrados apenas somatórios por dia, página e
    região. Nenhum endereço IP, cookie de identificação ou dado individual de visitante
    é armazenado — estatística anonimizada nos termos do art. 5º, III, e do art. 12 da LGPD.<br>
    Acessos de robôs e indexadores são descartados antes da contagem.
    Esta página não é indexada por buscadores e exige chave de acesso.
  </footer>

</div>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
            'Referrer-Policy': 'no-referrer'
        }
    });
}
