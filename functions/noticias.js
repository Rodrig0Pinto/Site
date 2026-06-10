/* Busca os feeds RSS diretamente no edge do Cloudflare e parseia o XML
   aqui mesmo — sem depender de serviços intermediários (rss2json etc.).
   Google News é o fallback garantido: nunca bloqueia datacenters. */

const HEADERS_BROWSER = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
};

const SOURCES = {
    stf: [
        'https://portal.stf.jus.br/noticias/rss.asp',
        'https://news.google.com/rss/search?q=%22Supremo%20Tribunal%20Federal%22%20when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419'
    ],
    stj: [
        'https://agencia.stj.jus.br/feed/',
        'https://news.google.com/rss/search?q=%22Superior%20Tribunal%20de%20Justi%C3%A7a%22%20when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419'
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
        const pubDate = tag(block, 'pubDate');
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

async function fetchFeed(url) {
    try {
        const r = await fetch(url, {
            headers: HEADERS_BROWSER,
            cf: { cacheTtl: 1800, cacheEverything: true }
        });
        if (!r.ok) return [];
        return parseRSS(await r.text());
    } catch {
        return [];
    }
}

async function tryAll(urls) {
    for (const url of urls) {
        const items = await fetchFeed(url);
        if (items.length) return items;
    }
    return [];
}

export async function onRequest({ request }) {
    const cache    = caches.default;
    const cacheKey = new Request(new URL('/noticias', request.url).toString());

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const [stf, stj] = await Promise.all([tryAll(SOURCES.stf), tryAll(SOURCES.stj)]);

    const response = new Response(JSON.stringify({ stf, stj }), {
        headers: {
            'Content-Type':  'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=900, s-maxage=1800',
            'Access-Control-Allow-Origin': '*'
        }
    });

    /* Só guarda no cache se ao menos um tribunal retornou notícias */
    if (stf.length || stj.length) {
        await cache.put(cacheKey, response.clone());
    }
    return response;
}
