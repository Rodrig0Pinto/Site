/* Busca os feeds RSS diretamente no edge do Cloudflare e parseia o XML
   aqui mesmo — sem depender de serviços intermediários (rss2json etc.).
   Cada tribunal tem múltiplas fontes em cascata; Google News e Bing News
   são os fallbacks finais. */

const HEADERS_BROWSER = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9'
};

const SOURCES = {
    stf: [
        'https://noticias.stf.jus.br/feed/',
        'https://noticias.stf.jus.br/feed',
        'https://portal.stf.jus.br/noticias/rss.asp',
        'https://news.google.com/rss/search?q=%22Supremo%20Tribunal%20Federal%22%20when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419',
        'https://www.bing.com/news/search?q=%22Supremo+Tribunal+Federal%22&format=rss&setlang=pt-BR'
    ],
    stj: [
        'https://agencia.stj.jus.br/feed/',
        'https://news.google.com/rss/search?q=%22Superior%20Tribunal%20de%20Justi%C3%A7a%22%20when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419',
        'https://www.bing.com/news/search?q=%22Superior+Tribunal+de+Justi%C3%A7a%22&format=rss&setlang=pt-BR'
    ]
};

function decodeEntities(s) {
    return s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .trim();
}

function tag(block, name) {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return m ? decodeEntities(m[1]) : '';
}

function parseRSS(xml, max = 6) {
    const items = [];
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const block of blocks.slice(0, max)) {
        const title   = tag(block, 'title');
        let   link    = tag(block, 'link');
        const pubDate = tag(block, 'pubDate') || tag(block, 'dc:date');
        if (!link) {
            const g = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
            if (g) link = decodeEntities(g[1]);
        }
        if (title && link && /^https?:\/\//.test(link)) {
            items.push({ title, link, pubDate });
        }
    }
    return items;
}

async function fetchFeed(url, diag) {
    try {
        const r = await fetch(url, { headers: HEADERS_BROWSER, redirect: 'follow' });
        if (!r.ok) {
            if (diag) diag.push({ url, status: r.status, items: 0 });
            return [];
        }
        const items = parseRSS(await r.text());
        if (diag) diag.push({ url, status: r.status, items: items.length });
        return items;
    } catch (e) {
        if (diag) diag.push({ url, error: String(e) });
        return [];
    }
}

async function tryAll(urls, diag) {
    for (const url of urls) {
        const items = await fetchFeed(url, diag);
        if (items.length) return items;
    }
    return [];
}

export async function onRequest({ request }) {
    const reqUrl = new URL(request.url);
    const debug  = reqUrl.searchParams.has('debug');

    const cache    = caches.default;
    /* v2 no cache key: invalida o cache antigo que congelou STF vazio */
    const cacheKey = new Request(new URL('/noticias?v=2', request.url).toString());

    if (!debug) {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
    }

    const diag = debug ? [] : null;
    const [stf, stj] = await Promise.all([
        tryAll(SOURCES.stf, diag),
        tryAll(SOURCES.stj, diag)
    ]);

    const body = debug ? { stf, stj, diag } : { stf, stj };
    const response = new Response(JSON.stringify(body), {
        headers: {
            'Content-Type':  'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=900, s-maxage=1800',
            'Access-Control-Allow-Origin': '*'
        }
    });

    /* Só cacheia quando AMBOS os tribunais retornaram notícias —
       evita congelar um painel vazio por 30 minutos */
    if (!debug && stf.length && stj.length) {
        await cache.put(cacheKey, response.clone());
    }
    return response;
}
