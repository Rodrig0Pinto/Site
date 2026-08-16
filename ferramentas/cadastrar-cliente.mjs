#!/usr/bin/env node
/* Cadastra (ou atualiza) um cliente na Área do Cliente.
 *
 * Uso:
 *   node ferramentas/cadastrar-cliente.mjs "Nome Completo" CPF num1 [num2 ...]
 *   node ferramentas/cadastrar-cliente.mjs --remover CPF
 *
 * Grava em dados/clientes.enc.json um registro CIFRADO (AES-256-GCM),
 * com chave derivada do CPF + primeiro nome (PBKDF2, 310 mil iterações)
 * — os MESMOS parâmetros de functions/api/acesso.js. O arquivo pode
 * viver em repositório público: sem o CPF e o nome do titular, o
 * conteúdo é indecifrável.
 */

import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ARQ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dados', 'clientes.enc.json');
const SAL_ID    = 'rpadv-id-2026';
const SAL_CHAVE = 'rpadv-chave-2026';
const ITERACOES = 310000;

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

function cpfValido(d) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    for (const t of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
        if ((soma * 10) % 11 % 10 !== Number(d[t])) return false;
    }
    return true;
}

async function sha256hex(txt) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Buffer.from(h).toString('hex');
}

async function chaveDe(cpf, primeiroNome, usos) {
    const material = await crypto.subtle.importKey('raw',
        new TextEncoder().encode(cpf + '|' + primeiroNome), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new TextEncoder().encode(SAL_CHAVE), iterations: ITERACOES, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, usos);
}

const args = process.argv.slice(2);
const base = JSON.parse(readFileSync(ARQ, 'utf8'));

if (args[0] === '--remover') {
    const cpf = String(args[1] || '').replace(/\D/g, '');
    const id  = await sha256hex(cpf + '|' + SAL_ID);
    const antes = base.clientes.length;
    base.clientes = base.clientes.filter(c => c.id !== id);
    writeFileSync(ARQ, JSON.stringify(base, null, 2) + '\n');
    console.log(antes === base.clientes.length ? 'CPF não estava cadastrado.' : '✓ registro removido.');
    process.exit(0);
}

const [nome, cpfBruto, ...nums] = args;
const cpf = String(cpfBruto || '').replace(/\D/g, '');
const processos = nums.map(n => String(n).replace(/\D/g, '')).filter(n => n.length === 20);

if (!nome || !cpfValido(cpf) || !processos.length) {
    console.error('Uso: node ferramentas/cadastrar-cliente.mjs "Nome Completo" CPF num1 [num2 ...]');
    console.error('     (CPF válido e ao menos 1 número CNJ de 20 dígitos)');
    process.exit(1);
}
if (norm(nome).split(' ').filter(t => t.length >= 2).length < 2) {
    console.error('Informe o nome COMPLETO (nome e ao menos um sobrenome).');
    process.exit(1);
}

const id    = await sha256hex(cpf + '|' + SAL_ID);
const chave = await chaveDe(cpf, norm(nome).split(' ')[0], ['encrypt']);
const iv    = crypto.getRandomValues(new Uint8Array(12));
const claro = new TextEncoder().encode(JSON.stringify({ nome: nome.trim(), processos }));
const blob  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, claro);

base.clientes = base.clientes.filter(c => c.id !== id); // substitui se já existir
base.clientes.push({
    id,
    iv:   Buffer.from(iv).toString('base64'),
    blob: Buffer.from(blob).toString('base64')
});
writeFileSync(ARQ, JSON.stringify(base, null, 2) + '\n');
console.log(`✓ cliente cadastrado (${processos.length} processo(s)). Total: ${base.clientes.length} registro(s).`);
