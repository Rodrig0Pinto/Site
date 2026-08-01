/* Painel privado de estatísticas — Rodrigo Pinto Advocacia
 *
 * Acesso: https://rodrigopinto.adv.br/painel?k=<CHAVE>
 *
 * A chave NÃO está neste arquivo: guarda-se apenas o SHA-256 dela.
 * Mesmo com o repositório público, o hash não revela a chave.
 * Sem a chave correta, a resposta é 404 — a página não se anuncia.
 *
 * Os números vêm de contadores agregados (ver functions/api/hit.js).
 * Nenhum dado individual de visitante existe para ser consultado.
 */

const HASH_CHAVE = '9e332ef114ec1dbccecf27ae1a57f6cd10e242e5d37f80d8bbbcb31d7d8152f0';

const NS  = 'rpadvbr-a8f3c1';
const GET = 'https://abacus.jasoncameron.dev/get';

/* Unidades federativas — usadas para consultar as chaves de origem */
const UFS = ['acre','alagoas','amapa','amazonas','bahia','ceara','distrito-federal','espirito-santo',
    'goias','maranhao','mato-grosso','mato-grosso-do-sul','minas-gerais','para','paraiba','parana',
    'pernambuco','piaui','rio-de-janeiro','rio-grande-do-norte','rio-grande-do-sul','rondonia',
    'roraima','santa-catarina','sao-paulo','sergipe','tocantins'];

const PAISES = ['br','pt','us','ar','es','fr','de','gb','it','cl','co','mx','uy','py','ca','jp','na'];

const NOME_UF = {
    'acre':'Acre','alagoas':'Alagoas','amapa':'Amapá','amazonas':'Amazonas','bahia':'Bahia',
    'ceara':'Ceará','distrito-federal':'Distrito Federal','espirito-santo':'Espírito Santo',
    'goias':'Goiás','maranhao':'Maranhão','mato-grosso':'Mato Grosso','mato-grosso-do-sul':'Mato Grosso do Sul',
    'minas-gerais':'Minas Gerais','para':'Pará','paraiba':'Paraíba','parana':'Paraná',
    'pernambuco':'Pernambuco','piaui':'Piauí','rio-de-janeiro':'Rio de Janeiro',
    'rio-grande-do-norte':'Rio Grande do Norte','rio-grande-do-sul':'Rio Grande do Sul',
    'rondonia':'Rondônia','roraima':'Roraima','santa-catarina':'Santa Catarina',
    'sao-paulo':'São Paulo','sergipe':'Sergipe','tocantins':'Tocantins'
};

const NOME_PAIS = {
    'br':'Brasil','pt':'Portugal','us':'Estados Unidos','ar':'Argentina','es':'Espanha',
    'fr':'França','de':'Alemanha','gb':'Reino Unido','it':'Itália','cl':'Chile',
    'co':'Colômbia','mx':'México','uy':'Uruguai','py':'Paraguai','ca':'Canadá',
    'jp':'Japão','na':'Não identificado'
};

async function sha256(t) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function iguais(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const num = n => (n ?? 0).toLocaleString('pt-BR');

const naoEncontrado = () => new Response(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>404</title></head><body><h1>404</h1></body></html>',
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

/* Lê uma chave; ausente ou indisponível vira 0 */
async function ler(chave) {
    try {
        const r = await fetch(`${GET}/${NS}/${chave}`, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) return 0;
        const j = await r.json();
        return Number(j.value) || 0;
    } catch { return 0; }
}

/* Lê em lotes, para não saturar o serviço */
async function lerLote(chaves, tamanho = 12) {
    const saida = [];
    for (let i = 0; i < chaves.length; i += tamanho) {
        saida.push(...await Promise.all(chaves.slice(i, i + tamanho).map(ler)));
    }
    return saida;
}

function dia(offset) {
    const d = new Date(Date.now() - offset * 86400000);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
}

function limpar(txt, max = 60) {
    return String(txt || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, max) || 'na';
}

/* Descobre as páginas do site a partir do próprio sitemap */
async function paginasDoSite(origem) {
    const padrao = [
        { rotulo: 'Página inicial', chave: 'p-home' },
        { rotulo: '/artigos/',      chave: 'p-artigos' }
    ];
    try {
        const r = await fetch(`${origem}/sitemap.xml`);
        if (!r.ok) return padrao;
        const xml = await r.text();
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
        const lista = [];
        for (const u of locs) {
            let caminho;
            try { caminho = new URL(u).pathname; } catch { continue; }
            if (caminho === '/' || caminho === '') {
                lista.push({ rotulo: 'Página inicial', chave: 'p-home' });
            } else {
                const limpo = caminho.replace(/\/index\.html$/, '/');
                lista.push({
                    rotulo: limpo,
                    chave: 'p-' + limpar(limpo.replace(/\.html$/, ''), 60)
                });
            }
        }
        return lista.length ? lista : padrao;
    } catch { return padrao; }
}

function barras(itens, limite = 15) {
    const vis = itens.filter(i => i.n > 0).sort((a, b) => b.n - a.n).slice(0, limite);
    if (!vis.length) return '<p class="vazio">Nenhum acesso registrado ainda.</p>';
    const max = Math.max(...vis.map(i => i.n), 1);
    return '<table class="tb">' + vis.map(i => `<tr>
        <td class="rot">${esc(i.rotulo)}</td>
        <td class="bar"><span style="width:${Math.max(2, Math.round((i.n / max) * 100))}%"></span></td>
        <td class="val">${num(i.n)}</td></tr>`).join('') + '</table>';
}

export async function onRequest({ request }) {
    const url = new URL(request.url);
    const chave = url.searchParams.get('k') || '';
    if (!chave || !iguais(await sha256(chave), HASH_CHAVE)) return naoEncontrado();

    const origem = url.origin;

    /* Dias (30), páginas (do sitemap), UFs e países */
    const dias = Array.from({ length: 30 }, (_, i) => dia(29 - i));
    const paginas = await paginasDoSite(origem);

    const [total, vDias, vPaginas, vUFs, vPaises] = await Promise.all([
        ler('total'),
        lerLote(dias.map(d => 'd-' + d.replace(/-/g, ''))),
        lerLote(paginas.map(p => p.chave)),
        lerLote(UFS.map(u => `g-br-${u}`)),
        lerLote(PAISES.map(p => `c-${p}`))
    ]);

    const hoje   = vDias[vDias.length - 1] || 0;
    const ult7   = vDias.slice(-7).reduce((a, b) => a + b, 0);
    const ult30  = vDias.reduce((a, b) => a + b, 0);

    const serie = dias.map((d, i) => ({ dia: d, n: vDias[i] }));
    const maxS  = Math.max(...serie.map(s => s.n), 1);
    const grafico = `<div class="graf">${serie.map(s => {
        const h = s.n > 0 ? Math.max(4, Math.round((s.n / maxS) * 100)) : 2;
        return `<div class="col" title="${esc(s.dia.split('-').reverse().join('/'))}: ${num(s.n)}"><span style="height:${h}%"></span><i>${esc(s.dia.slice(8))}</i></div>`;
    }).join('')}</div>`;

    const itensPag  = paginas.map((p, i) => ({ rotulo: p.rotulo, n: vPaginas[i] }));
    const itensUF   = UFS.map((u, i) => ({ rotulo: NOME_UF[u] || u, n: vUFs[i] }));
    const itensPais = PAISES.map((p, i) => ({ rotulo: NOME_PAIS[p] || p.toUpperCase(), n: vPaises[i] }));

    const agora = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Fortaleza'
    }).format(new Date());

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Painel de Acessos — Rodrigo Pinto Advocacia</title>
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png?v=3">
<style>
 *{box-sizing:border-box;margin:0;padding:0}
 body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a1628;color:#ecebe8;padding:22px;line-height:1.5}
 .wrap{max-width:1080px;margin:0 auto}
 header{border-bottom:1px solid rgba(201,168,76,.3);padding-bottom:16px;margin-bottom:24px}
 h1{font-family:Georgia,serif;font-size:1.65rem;color:#c9a84c;letter-spacing:.5px}
 .sub{font-size:.8rem;color:#8fa3bd;margin-top:5px}
 .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
 .card{background:rgba(255,255,255,.04);border:1px solid rgba(201,168,76,.22);border-radius:5px;padding:16px}
 .card b{display:block;font-size:1.9rem;color:#c9a84c;font-family:Georgia,serif;line-height:1.1}
 .card span{font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:#8fa3bd;margin-top:5px;display:block}
 h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.11em;color:#c9a84c;margin:0 0 11px;padding-bottom:7px;border-bottom:1px solid rgba(201,168,76,.18)}
 section{margin-bottom:30px}
 .graf{display:flex;align-items:flex-end;gap:3px;height:145px;padding:10px;background:rgba(255,255,255,.03);border:1px solid rgba(201,168,76,.15);border-radius:5px}
 .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:0}
 .col span{width:100%;background:linear-gradient(180deg,#e8d191,#9c7d33);border-radius:2px 2px 0 0;min-height:2px}
 .col i{font-size:.56rem;color:#6f8299;font-style:normal;margin-top:4px}
 .tb{width:100%;border-collapse:collapse}
 .tb td{padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.05)}
 .rot{font-size:.82rem;color:#d5d9e0;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .bar{width:45%}
 .bar span{display:block;height:8px;background:linear-gradient(90deg,#9c7d33,#e8d191);border-radius:4px}
 .val{text-align:right;font-size:.84rem;color:#c9a84c;font-weight:600;width:70px}
 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
 .vazio{color:#6f8299;font-size:.84rem;font-style:italic;padding:10px 0}
 footer{border-top:1px solid rgba(201,168,76,.2);padding-top:15px;margin-top:32px;font-size:.73rem;color:#6f8299;line-height:1.7}
 @media(max-width:760px){.grid2{grid-template-columns:1fr}.rot{max-width:170px}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Painel de Acessos</h1>
    <div class="sub">Rodrigo Pinto Advocacia &middot; atualizado em ${esc(agora)}</div>
  </header>

  <div class="cards">
    <div class="card"><b>${num(hoje)}</b><span>Hoje</span></div>
    <div class="card"><b>${num(ult7)}</b><span>Últimos 7 dias</span></div>
    <div class="card"><b>${num(ult30)}</b><span>Últimos 30 dias</span></div>
    <div class="card"><b>${num(total)}</b><span>Total acumulado</span></div>
  </div>

  <section>
    <h2>Acessos por dia (últimos 30 dias)</h2>
    ${grafico}
  </section>

  <div class="grid2">
    <section><h2>Páginas mais acessadas</h2>${barras(itensPag, 20)}</section>
    <section><h2>Origem no Brasil (estado)</h2>${barras(itensUF, 15)}</section>
  </div>

  <section><h2>Por país</h2>${barras(itensPais, 12)}</section>

  <footer>
    Contagem agregada e anônima: apenas somatórios por dia, página e região.
    Nenhum endereço IP, cookie de identificação ou dado individual de visitante é
    armazenado — estatística anonimizada (LGPD, art. 5º, III, e art. 12).<br>
    O navegador do visitante não se comunica com serviços externos: a contagem parte
    do nosso próprio servidor, com chaves anônimas. Robôs e indexadores são descartados.<br>
    Esta página não é indexada e exige chave de acesso.
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
