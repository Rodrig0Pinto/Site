/* Acesso do cliente por NOME + CPF — Rodrigo Pinto Advocacia
 *
 * O cadastro de clientes fica em /dados/clientes.enc.json, com cada
 * registro CIFRADO (AES-256-GCM). A chave de decifragem é derivada do
 * próprio CPF + primeiro nome do cliente (PBKDF2, 310 mil iterações):
 * sem os dados corretos, o conteúdo é indecifrável — por isso o arquivo
 * pode viver num repositório público sem expor ninguém.
 *
 * Nada é armazenado por esta função: o CPF chega, deriva a chave,
 * decifra o registro e morre com a requisição. Os processos são então
 * consultados em tempo real na base pública do DataJud/CNJ.
 */

import { consultarProcesso } from './_datajud.js';

const RESP = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const SAL_ID    = 'rpadv-id-2026';
const SAL_CHAVE = 'rpadv-chave-2026';
const ITERACOES = 310000;
const MAX_PROCESSOS = 10;

const FALHA = JSON.stringify({ ok: false, erro:
    'Não encontramos cadastro com esses dados. Confira se digitou o nome e o CPF exatamente ' +
    'como constam nos seus documentos — ou fale com o escritório pelo WhatsApp (83) 99905-0505.' });

/* normaliza: minúsculas, sem acentos, espaços únicos */
function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cpfValido(d) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    for (const t of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
        const dv = (soma * 10) % 11 % 10;
        if (dv !== Number(d[t])) return false;
    }
    return true;
}

async function sha256hex(txt) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function derivarChave(cpf, primeiroNome) {
    const material = await crypto.subtle.importKey('raw',
        new TextEncoder().encode(cpf + '|' + primeiroNome), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new TextEncoder().encode(SAL_CHAVE), iterations: ITERACOES, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function onRequestPost({ request, env }) {
    let corpo;
    try { corpo = await request.json(); }
    catch { return new Response(FALHA, { status: 200, headers: RESP }); }

    const cpf    = String(corpo.cpf || '').replace(/\D/g, '');
    const tokens = norm(corpo.nome).split(' ').filter(t => t.length >= 2);

    if (!cpfValido(cpf) || tokens.length < 2) {
        return new Response(JSON.stringify({ ok: false, erro:
            'Informe o nome completo (nome e ao menos um sobrenome) e um CPF válido.' }),
            { status: 200, headers: RESP });
    }

    /* carrega o cadastro cifrado publicado junto com o site */
    let registro;
    try {
        const r = await env.ASSETS.fetch(new URL('/dados/clientes.enc.json', request.url));
        registro = await r.json();
    } catch {
        return new Response(FALHA, { status: 200, headers: RESP });
    }

    const id  = await sha256hex(cpf + '|' + SAL_ID);
    const ent = (registro.clientes || []).find(c => c.id === id);
    if (!ent) return new Response(FALHA, { status: 200, headers: RESP });

    /* decifra com CPF + primeiro nome; erro de autenticação = dados errados */
    let dados;
    try {
        const chave = await derivarChave(cpf, tokens[0]);
        const claro = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: deB64(ent.iv) }, chave, deB64(ent.blob));
        dados = JSON.parse(new TextDecoder().decode(claro));
    } catch {
        return new Response(FALHA, { status: 200, headers: RESP });
    }

    /* todos os nomes digitados precisam constar no nome cadastrado */
    const cadastrados = new Set(norm(dados.nome).split(' '));
    if (!tokens.every(t => cadastrados.has(t))) {
        return new Response(FALHA, { status: 200, headers: RESP });
    }

    const numeros = [...new Set((dados.processos || [])
        .map(n => String(n).replace(/\D/g, '')).filter(n => n.length === 20))]
        .slice(0, MAX_PROCESSOS);

    const processos = await Promise.all(numeros.map(consultarProcesso));

    return new Response(JSON.stringify({
        ok: true,
        cliente: dados.nome,
        consultadoEm: new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Fortaleza'
        }).format(new Date()),
        processos
    }), { status: 200, headers: RESP });
}

export async function onRequest(ctx) {
    if (ctx.request.method === 'POST') return onRequestPost(ctx);
    return new Response('Método não permitido', { status: 405 });
}
