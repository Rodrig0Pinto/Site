const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache'
};

/* Tribunais com múltiplas URLs de fallback */
const FEEDS = {
    stf: [
        'https://portal.stf.jus.br/noticias/rss.asp',
        'https://www.stf.jus.br/portal/cms/verNoticiaDetalhe.asp?idConteudo=',
    ],
    stj: [
        'https://agencia.stj.jus.br/noticias/rss',
        'https://agencia.stj.jus.br/feed/',
        'https://www.stj.jus.br/portal_stj/publicacao/engine.wsp?tmp.area=398',
    ]
};

function parseRSS(xml, max = 6) {
    const out = [];
    /* Tenta <item> (RSS 2.0) e <entry> (Atom) */
    const re = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
    let m;
    while ((m = re.exec(xml)) !== null && out.length < max) {
        const b = m[1];

        const t = (
            b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ||
            b.match(/<title[^>]*>\s*([\s\S]*?)\s*<\/title>/)?.[1] || ''
        ).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

        const l = (
            b.match(/<link[^>]*href="([^"]+)"/)?.[1] ||
            b.match(/<link>(https?:\/\/[^\s<]+)<\/link>/s)?.[1] ||
            b.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/s)?.[1] || '#'
        ).trim();

        const d = (
            b.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1] ||
            b.match(/<updated>(.*?)<\/updated>/s)?.[1] ||
            b.match(/<published>(.*?)<\/published>/s)?.[1] || ''
        ).trim();

        if (t && t.length > 4) out.push({ title: t, link: l, pubDate: d });
    }
    return out;
}

async function tryFeed(urls) {
    for (const url of urls) {
        try {
            const r = await fetch(url, { headers: BROWSER_HEADERS });
            if (!r.ok) continue;
            const text = await r.text();
            /* Verifica se é realmente XML/RSS e não uma página de erro HTML */
            if (!text.includes('<item') && !text.includes('<entry')) continue;
            const items = parseRSS(text);
            if (items.length > 0) return { items, source: url };
        } catch { /* continua para próxima URL */ }
    }
    return { items: [], source: null };
}

export async function onRequest() {
    const [stfResult, stjResult] = await Promise.all([
        tryFeed(FEEDS.stf),
        tryFeed(FEEDS.stj)
    ]);

    return new Response(
        JSON.stringify({
            stf: stfResult.items,
            stj: stjResult.items,
            _meta: {
                stf_source: stfResult.source,
                stj_source: stjResult.source,
                ts: new Date().toISOString()
            }
        }),
        {
            headers: {
                'Content-Type':  'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=1800',
            }
        }
    );
}
