/* Contador de visitas — registro AGREGADO e ANÔNIMO.
 *
 * Recebe um sinal do navegador a cada página vista e incrementa um
 * contador do tipo:
 *
 *     (dia, página, país, região, cidade)  →  total
 *
 * Nenhum endereço IP, cookie de identificação, identificador de
 * usuário ou impressão digital de dispositivo é gravado. O IP é usado
 * apenas em memória, pela própria Cloudflare, para derivar a região —
 * e descartado em seguida. O resultado é estatística anonimizada
 * (LGPD, art. 5º, III e art. 12), não dado pessoal.
 */

const UA_ROBO = /bot|crawler|spider|curl|wget|python|scrapy|headless|phantom|selenium|puppeteer|axios|okhttp|java\/|go-http|lighthouse|pingdom|uptime|monitor|preview|facebookexternalhit|slurp|bingpreview/i;

const RESP = { 'Content-Type': 'application/json; charset=utf-8' };

/* Aceita apenas caminhos do próprio site, já normalizados */
function normalizarPagina(p) {
    if (typeof p !== 'string' || !p.startsWith('/')) return null;
    let caminho = p.split('?')[0].split('#')[0].slice(0, 160);
    if (caminho.length > 1 && caminho.endsWith('/index.html')) {
        caminho = caminho.slice(0, -'index.html'.length);
    }
    if (!/^[\w\-./]*$/.test(caminho)) return null;
    return caminho || '/';
}

export async function onRequestPost({ request, env }) {
    /* Sem o banco vinculado, o contador simplesmente não registra —
       o site continua funcionando normalmente. */
    if (!env.ESTATISTICAS) {
        return new Response(JSON.stringify({ ok: false, motivo: 'sem banco' }), { status: 200, headers: RESP });
    }

    const ua = request.headers.get('User-Agent') || '';
    if (!ua || UA_ROBO.test(ua)) {
        return new Response(JSON.stringify({ ok: true, ignorado: 'robo' }), { status: 200, headers: RESP });
    }

    let corpo;
    try {
        corpo = await request.json();
    } catch {
        return new Response(JSON.stringify({ ok: false }), { status: 400, headers: RESP });
    }

    const pagina = normalizarPagina(corpo.p);
    if (!pagina) {
        return new Response(JSON.stringify({ ok: false }), { status: 400, headers: RESP });
    }

    const cf = request.cf || {};
    const pais   = (cf.country || '--').toString().slice(0, 8);
    const regiao = (cf.region  || '--').toString().slice(0, 64);
    const cidade = (cf.city    || '--').toString().slice(0, 64);

    /* Data no fuso de João Pessoa, para que "hoje" faça sentido */
    const dia = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    try {
        await env.ESTATISTICAS.prepare(
            `INSERT INTO acessos (dia, pagina, pais, regiao, cidade, total)
             VALUES (?, ?, ?, ?, ?, 1)
             ON CONFLICT(dia, pagina, pais, regiao, cidade)
             DO UPDATE SET total = total + 1`
        ).bind(dia, pagina, pais, regiao, cidade).run();
    } catch {
        /* Falha de contador nunca pode afetar a experiência do visitante */
        return new Response(JSON.stringify({ ok: false }), { status: 200, headers: RESP });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: RESP });
}

export async function onRequest({ request, env }) {
    if (request.method === 'POST') return onRequestPost({ request, env });
    return new Response('Método não permitido', { status: 405 });
}
