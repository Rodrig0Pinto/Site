/* Contador de visitas — registro AGREGADO e ANÔNIMO.
 *
 * Arquitetura (importante para a privacidade):
 *
 *   navegador → /api/hit (nossa função no edge da Cloudflare) → contador
 *
 * O navegador do visitante NUNCA se comunica com o serviço externo de
 * contagem. Quem faz a chamada é a nossa própria função, e ela envia
 * apenas CHAVES ANÔNIMAS do tipo "d-20260801" ou "g-br-paraiba".
 * Nenhum endereço IP, cookie, identificador de usuário ou impressão
 * digital de dispositivo é transmitido ou armazenado em lugar algum.
 *
 * O IP é usado somente em memória, pela própria Cloudflare, para derivar
 * o estado/país — e descartado em seguida. O que resta são somatórios:
 * estatística anonimizada (LGPD, art. 5º, III e art. 12).
 *
 * Backend: Abacus (https://github.com/JasonLovesDoggo/abacus), serviço
 * de contadores de código aberto e sem cadastro. Reserva: CounterAPI.
 */

const NS   = 'rpadvbr-a8f3c1';
const PRIM = 'https://abacus.jasoncameron.dev/hit';
const RESV = 'https://api.counterapi.dev/v1';

const UA_ROBO = /bot|crawler|spider|curl|wget|python|scrapy|headless|phantom|selenium|puppeteer|axios|okhttp|java\/|go-http|lighthouse|pingdom|uptime|monitor|preview|facebookexternalhit|slurp|bingpreview|semrush|ahrefs|mj12|dotbot|petalbot/i;

const RESP = { 'Content-Type': 'application/json; charset=utf-8' };

/* Reduz qualquer texto a [a-z0-9-], sem acentos */
function limpar(txt, max = 40) {
    return String(txt || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max) || 'na';
}

/* Caminho da página → identificador curto e estável */
function chavePagina(p) {
    if (typeof p !== 'string' || !p.startsWith('/')) return null;
    let c = p.split('?')[0].split('#')[0];
    if (c.length > 1 && c.endsWith('/index.html')) c = c.slice(0, -'index.html'.length);
    if (!/^[\w\-./]*$/.test(c)) return null;
    if (c === '/' || c === '') return 'p-home';
    return 'p-' + limpar(c.replace(/\.html$/, ''), 60);
}

function diaFortaleza() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
}

/* Incrementa uma chave; nunca lança */
async function bater(chave) {
    try {
        const r = await fetch(`${PRIM}/${NS}/${chave}`, {
            headers: { 'Accept': 'application/json' },
            cf: { cacheTtl: 0, cacheEverything: false }
        });
        if (r.ok) return true;
    } catch { /* cai para a reserva */ }

    try {
        await fetch(`${RESV}/${NS}/${chave}/up`, { headers: { 'Accept': 'application/json' } });
        return true;
    } catch {
        return false;
    }
}

export async function onRequestPost(context) {
    const { request } = context;

    const ua = request.headers.get('User-Agent') || '';
    if (!ua || UA_ROBO.test(ua)) {
        return new Response(JSON.stringify({ ok: true, ignorado: 'robo' }), { status: 200, headers: RESP });
    }

    let corpo;
    try { corpo = await request.json(); }
    catch { return new Response(JSON.stringify({ ok: false }), { status: 400, headers: RESP }); }

    const kPagina = chavePagina(corpo.p);
    if (!kPagina) return new Response(JSON.stringify({ ok: false }), { status: 400, headers: RESP });

    const cf     = request.cf || {};
    const pais   = limpar(cf.country || 'na', 8);
    const regiao = limpar(cf.region  || 'na', 40);
    const dia    = diaFortaleza().replace(/-/g, '');

    const chaves = [
        'total',
        `d-${dia}`,
        kPagina,
        `c-${pais}`,
        `g-${pais}-${regiao}`
    ];

    /* Não faz o visitante esperar pelas contagens */
    const trabalho = Promise.all(chaves.map(bater));
    if (typeof context.waitUntil === 'function') context.waitUntil(trabalho);
    else await trabalho;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: RESP });
}

export async function onRequest(context) {
    if (context.request.method === 'POST') return onRequestPost(context);
    return new Response('Método não permitido', { status: 405 });
}
