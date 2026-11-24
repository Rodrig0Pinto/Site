/* Redireciona www → domínio raiz (301 permanente), preservando caminho e query.
 *
 * O arquivo _redirects da Cloudflare Pages não suporta redirecionamento entre
 * domínios (só entre caminhos), por isso a regra fica aqui, na borda.
 * Para todos os demais hosts, segue o fluxo normal (estáticos e funções).
 *
 * Nota (24/11/2026): um nonce de CSP por resposta foi testado aqui e removido.
 * Com ele, o script de detecção de robôs da Cloudflare passava a rodar e usava
 * uma API obsoleta, piorando a nota de "boas práticas" (93 → 79–82). O Web
 * Analytics é liberado diretamente pelo endereço na CSP do _headers.
 */

const HOST_WWW  = 'www.rodrigopinto.adv.br';
const HOST_RAIZ = 'rodrigopinto.adv.br';

export async function onRequest(ctx) {
    const url = new URL(ctx.request.url);
    if (url.hostname === HOST_WWW) {
        url.hostname = HOST_RAIZ;
        url.protocol = 'https:';
        return Response.redirect(url.toString(), 301);
    }
    return ctx.next();
}
