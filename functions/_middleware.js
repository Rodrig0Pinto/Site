/* Middleware de borda (todas as requisições).
 *
 * 1) Redireciona www → domínio raiz (301 permanente), preservando caminho e query.
 *    O arquivo _redirects da Cloudflare Pages não suporta redirecionamento entre
 *    domínios (só entre caminhos), por isso a regra fica aqui.
 *
 * 2) Nonce de CSP nas páginas HTML (24/11/2026). A Cloudflare injeta nas páginas um
 *    script inline de detecção de robôs ("JavaScript detections"). Com a nossa CSP
 *    (script-src 'self') o navegador o bloqueava e registrava erro no console.
 *    Pela documentação da Cloudflare, quando a CSP traz um nonce, ela mesma aplica
 *    esse nonce aos scripts que injeta. Assim o script de segurança funciona sem
 *    abrir 'unsafe-inline' para qualquer código. O nonce é novo a cada resposta.
 *    O beacon do Web Analytics (static.cloudflareinsights.com) continua bloqueado
 *    de propósito: a Política de Privacidade declara monitoramento mínimo.
 */

const HOST_WWW  = 'www.rodrigopinto.adv.br';
const HOST_RAIZ = 'rodrigopinto.adv.br';

function gerarNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return btoa(String.fromCharCode(...bytes));
}

export async function onRequest(ctx) {
    const url = new URL(ctx.request.url);
    if (url.hostname === HOST_WWW) {
        url.hostname = HOST_RAIZ;
        url.protocol = 'https:';
        return Response.redirect(url.toString(), 301);
    }

    const res = await ctx.next();
    const tipo = res.headers.get('content-type') || '';
    const csp  = res.headers.get('content-security-policy');
    if (res.status !== 200 || !tipo.includes('text/html') || !csp || !csp.includes("script-src 'self'")) {
        return res;
    }
    const nonce = gerarNonce();
    const cabecalhos = new Headers(res.headers);
    cabecalhos.set('content-security-policy', csp.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`));
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: cabecalhos });
}
