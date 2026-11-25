/* Cifra do briefing do assistente virtual (AES-256-GCM).
 *
 * Quando o e-mail precisa ser concluído pelo navegador do visitante (a borda
 * da Cloudflare toma 429 do FormSubmit), a análise da IA NÃO pode passar pelo
 * navegador em texto claro: o visitante veria o resumo e as teses nas
 * ferramentas do navegador. Por isso a análise vai cifrada, dentro de um link
 * /briefing?d=…, e só é decifrada no servidor, para quem tem a chave do painel.
 *
 * Segredo: variável BRIEFING_CHAVE no projeto Pages (nunca no repositório).
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deB64url(texto) {
    const s = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function chaveAes(segredo) {
    const bruto = await crypto.subtle.digest('SHA-256', enc.encode('rpadv-briefing-v1:' + segredo));
    return crypto.subtle.importKey('raw', bruto, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function transformar(bytes, fluxo) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(fluxo)).arrayBuffer());
}

export async function cifrar(texto, segredo) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const compacto = await transformar(enc.encode(texto), new CompressionStream('deflate-raw'));
    const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveAes(segredo), compacto));
    const saida = new Uint8Array(12 + cifrado.length);
    saida.set(iv); saida.set(cifrado, 12);
    return b64url(saida);
}

export async function decifrar(token, segredo) {
    const bytes = deB64url(token);
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, await chaveAes(segredo), bytes.subarray(12));
    return dec.decode(await transformar(new Uint8Array(claro), new DecompressionStream('deflate-raw')));
}

/* Ficha de acesso guardada em cookie depois que o proprietário digita a chave do
   painel uma vez: HMAC do segredo, que não revela a chave nem o segredo. */
export async function fichaDeAcesso(segredo) {
    const k = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode('acesso-briefing-v1'))));
}
