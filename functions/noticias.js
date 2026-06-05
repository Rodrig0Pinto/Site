/* Usa api.rss2json.com como proxy — resolve CORS e headers de browser */
const RSS2JSON = 'https://api.rss2json.com/v1/api.json';

const SOURCES = {
    stf: [
        'https://portal.stf.jus.br/noticias/rss.asp'
    ],
    stj: [
        'https://agencia.stj.jus.br/noticias/rss',
        'https://agencia.stj.jus.br/feed',
        'https://agencia.stj.jus.br/rss',
        /* Google News como último fallback — sempre funciona */
        'https://news.google.com/rss/search?q=%22Superior+Tribunal+de+Justi%C3%A7a%22&hl=pt-BR&gl=BR&ceid=BR:pt-419'
    ]
};

async function via2JSON(rssUrl) {
    try {
        const r = await fetch(`${RSS2JSON}?count=6&rss_url=${encodeURIComponent(rssUrl)}`);
        if (!r.ok) return null;
        const d = await r.json();
        if (d.status !== 'ok' || !d.items?.length) return null;
        return d.items.map(i => ({ title: i.title, link: i.link, pubDate: i.pubDate }));
    } catch { return null; }
}

async function tryAll(urls) {
    for (const url of urls) {
        const items = await via2JSON(url);
        if (items?.length) return items;
    }
    return [];
}

export async function onRequest() {
    const [stf, stj] = await Promise.all([tryAll(SOURCES.stf), tryAll(SOURCES.stj)]);

    return new Response(JSON.stringify({ stf, stj }), {
        headers: {
            'Content-Type':  'application/json; charset=utf-8',
            'Cache-Control': 'public, s-maxage=1800'
        }
    });
}
