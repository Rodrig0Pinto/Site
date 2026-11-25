/* /briefing — leitura reservada da análise do assistente virtual.
 *
 * O e-mail do escritório traz um link /briefing?d=<análise cifrada> quando o
 * envio precisou passar pelo navegador do visitante. A análise só é decifrada
 * aqui, para quem informar a chave do painel (a mesma de /painel). Depois da
 * primeira vez, um cookie do próprio site dispensa digitar a chave de novo.
 * Sem JavaScript: formulário HTML simples (a CSP proíbe scripts inline).
 */
import { decifrar, fichaDeAcesso } from './api/_cifra-briefing.js';

const HASH_CHAVE = '4555eb321ec55b06dda909215b1eb7fd971eabeddd3eb7e8a2e2aeb6d922f753';   // mesma chave do /painel
const COOKIE = 'rpadv_briefing';

async function sha256(t) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function iguais(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina(corpo, extras = {}) {
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Briefing reservado</title>
<style>
body{margin:0;background:#0a1628;color:#d6dde8;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}
h1{color:#e0c46a;font-size:22px;margin:0 0 16px}
pre{white-space:pre-wrap;word-wrap:break-word;background:#0f1f38;border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:16px;font:14.5px/1.6 ui-monospace,Menlo,monospace;color:#f4f1ea}
label{display:block;margin:0 0 8px}
input[type=password]{width:100%;max-width:420px;box-sizing:border-box;padding:12px;border-radius:6px;border:1px solid #c9a84c;background:#0f1f38;color:#f4f1ea;font-size:16px}
button{margin-top:12px;padding:12px 20px;border:0;border-radius:6px;background:#c9a84c;color:#0a1628;font-weight:700;font-size:15px;cursor:pointer}
.erro{color:#ff9d8a}
</style></head><body><main>${corpo}</main></body></html>`;
    return new Response(html, {
        status: extras.status || 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
            'Referrer-Policy': 'no-referrer',
            ...(extras.cookie ? { 'Set-Cookie': extras.cookie } : {}),
        },
    });
}

function formulario(d, erro) {
    return pagina(`<h1>Briefing reservado</h1>
${erro ? '<p class="erro">Chave incorreta.</p>' : ''}
<form method="post" action="/briefing">
<label for="k">Chave do painel</label>
<input type="password" id="k" name="k" autocomplete="current-password" required autofocus>
<input type="hidden" name="d" value="${esc(d)}">
<br><button type="submit">Abrir</button>
</form>`, { status: erro ? 403 : 200 });
}

async function mostrar(d, segredo, cookie) {
    try {
        const texto = await decifrar(d, segredo);
        return pagina(`<h1>Briefing reservado</h1><pre>${esc(texto)}</pre>`, { cookie });
    } catch {
        return pagina('<h1>Briefing reservado</h1><p class="erro">Link incompleto ou inválido.</p>', { status: 400, cookie });
    }
}

function lerCookie(request) {
    const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
    return m ? m[1] : '';
}

export async function onRequestGet({ request, env }) {
    if (!env.BRIEFING_CHAVE) return new Response('Não configurado', { status: 404 });
    const d = new URL(request.url).searchParams.get('d') || '';
    if (!d) return new Response('Não encontrado', { status: 404 });
    if (iguais(lerCookie(request), await fichaDeAcesso(env.BRIEFING_CHAVE))) return mostrar(d, env.BRIEFING_CHAVE);
    return formulario(d, false);
}

export async function onRequestPost({ request, env }) {
    if (!env.BRIEFING_CHAVE) return new Response('Não configurado', { status: 404 });
    const form = await request.formData().catch(() => null);
    const k = form ? String(form.get('k') || '') : '';
    const d = form ? String(form.get('d') || '') : '';
    if (!iguais(await sha256(k), HASH_CHAVE)) return formulario(d, true);
    const ficha = await fichaDeAcesso(env.BRIEFING_CHAVE);
    const cookie = `${COOKIE}=${ficha}; Path=/briefing; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`;
    return mostrar(d, env.BRIEFING_CHAVE, cookie);
}
