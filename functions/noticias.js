export async function onRequest() {
    const FEEDS = {
        stf: 'https://portal.stf.jus.br/noticias/rss.asp',
        stj: 'https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias.aspx?PagingLevel=&PageIndex=0&IsAggregation=True'
    };

    function parseRSS(xml, max = 6) {
        const out = [];
        const re  = /<item>([\s\S]*?)<\/item>/g;
        let m;
        while ((m = re.exec(xml)) !== null && out.length < max) {
            const b = m[1];
            const t = b.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim();
            const l = b.match(/<link[^>]*>(https?:\/\/[^\s<]+)<\/link>/s)?.[1]?.trim()
                   || b.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/s)?.[1]?.trim()
                   || '#';
            const d = b.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1]?.trim() || '';
            if (t && t.length > 3) out.push({ title: t, link: l, pubDate: d });
        }
        return out;
    }

    async function getFeed(url) {
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)' }
            });
            return r.ok ? parseRSS(await r.text()) : [];
        } catch { return []; }
    }

    const [stf, stj] = await Promise.all([getFeed(FEEDS.stf), getFeed(FEEDS.stj)]);

    return new Response(JSON.stringify({ stf, stj }), {
        headers: {
            'Content-Type':  'application/json; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
