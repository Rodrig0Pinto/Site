/* Consulta processual didática — Rodrigo Pinto Advocacia
 *
 * Consulta a API PÚBLICA do DataJud (CNJ) por número de processo e
 * devolve os dados já traduzidos para linguagem acessível.
 * Toda a lógica de consulta/tradução vive em ./_datajud.js.
 *
 * - Nenhum dado do cliente é armazenado: a função recebe números de
 *   processo, consulta a fonte pública e responde. Ponto.
 * - Limite: 5 processos por chamada (evita abuso).
 */

import { consultarProcesso } from './_datajud.js';

const RESP = { 'Content-Type': 'application/json; charset=utf-8' };

export async function onRequestPost({ request }) {
    let corpo;
    try { corpo = await request.json(); }
    catch { return new Response(JSON.stringify({ ok: false }), { status: 400, headers: RESP }); }

    const brutos = Array.isArray(corpo.numeros) ? corpo.numeros : [];
    const numeros = [...new Set(
        brutos.map(n => String(n || '').replace(/\D/g, '')).filter(n => n.length === 20)
    )].slice(0, 5);

    if (!numeros.length) {
        return new Response(JSON.stringify({ ok: false, erro:
            'Informe ao menos um número de processo válido (20 dígitos, padrão CNJ).' }),
            { status: 400, headers: RESP });
    }

    const processos = await Promise.all(numeros.map(consultarProcesso));

    return new Response(JSON.stringify({
        ok: true,
        consultadoEm: new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Fortaleza'
        }).format(new Date()),
        processos
    }), { status: 200, headers: { ...RESP, 'Cache-Control': 'no-store' } });
}

export async function onRequest(ctx) {
    if (ctx.request.method === 'POST') return onRequestPost(ctx);
    return new Response('Método não permitido', { status: 405 });
}
