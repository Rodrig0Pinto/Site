#!/usr/bin/env node
/* Importa VÁRIOS clientes de uma vez para a Área do Cliente.
 *
 * Uso:
 *   node ferramentas/importar-clientes.mjs <arquivo.csv|arquivo.txt>
 *
 * Formato do arquivo (uma linha por cliente). Aceita separador ; | ou TAB
 * entre os três campos; a 1ª linha pode ser um cabeçalho (é ignorada se
 * não contiver um CPF). Dentro do campo de processos, separe os números
 * por vírgula ou espaço.
 *
 *   Nome Completo ; CPF ; num1, num2, num3
 *
 * Exemplos de linha válidos:
 *   Maria Souza Lima ; 111.444.777-35 ; 0801234-55.2024.8.15.2001, 0709876-11.2023.8.15.0001
 *   João Pereira | 52998224725 | 08012345520248152003
 *
 * Grava em dados/clientes.enc.json cada registro CIFRADO (AES-256-GCM),
 * com os MESMOS parâmetros de functions/api/acesso.js. Substitui o
 * cadastro anterior de um CPF já existente (atualização). Nada é gravado
 * em texto claro; o arquivo pode viver em repositório público.
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

async function chaveDe(cpf, primeiroNome) {
    const material = await crypto.subtle.importKey('raw',
        new TextEncoder().encode(cpf + '|' + primeiroNome), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new TextEncoder().encode(SAL_CHAVE), iterations: ITERACOES, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
}

const arquivo = process.argv[2];
if (!arquivo) {
    console.error('Uso: node ferramentas/importar-clientes.mjs <arquivo.csv|arquivo.txt>');
    process.exit(1);
}

const linhas = readFileSync(arquivo, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const base = JSON.parse(readFileSync(ARQ, 'utf8'));

let ok = 0, ignoradas = 0;
const erros = [];

for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const campos = linha.split(/\s*[;|\t]\s*/);
    // cabeçalho: primeira linha cujo campo de CPF não contém dígito algum
    if (i === 0 && (campos.length < 2 || !/\d/.test(campos[1]))) { continue; }
    if (campos.length < 3) {
        erros.push(`linha ${i + 1}: esperados 3 campos (nome ; cpf ; processos)`);
        ignoradas++; continue;
    }
    const nome = campos[0].trim();
    const cpf  = campos[1].replace(/\D/g, '');
    const processos = [...new Set(
        campos.slice(2).join(' ').split(/[,\s]+/).map(n => n.replace(/\D/g, '')).filter(n => n.length === 20)
    )];

    if (norm(nome).split(' ').filter(t => t.length >= 2).length < 2) {
        erros.push(`linha ${i + 1}: nome incompleto ("${nome}")`); ignoradas++; continue;
    }
    if (!cpfValido(cpf)) {
        erros.push(`linha ${i + 1}: CPF inválido ("${campos[1]}")`); ignoradas++; continue;
    }
    if (!processos.length) {
        erros.push(`linha ${i + 1}: nenhum número CNJ de 20 dígitos válido`); ignoradas++; continue;
    }

    const id    = await sha256hex(cpf + '|' + SAL_ID);
    const chave = await chaveDe(cpf, norm(nome).split(' ')[0]);
    const iv    = crypto.getRandomValues(new Uint8Array(12));
    const claro = new TextEncoder().encode(JSON.stringify({ nome, processos }));
    const blob  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, claro);

    base.clientes = base.clientes.filter(c => c.id !== id); // substitui se já existir
    base.clientes.push({
        id,
        iv:   Buffer.from(iv).toString('base64'),
        blob: Buffer.from(blob).toString('base64')
    });
    ok++;
}

writeFileSync(ARQ, JSON.stringify(base, null, 2) + '\n');

console.log(`✓ importados/atualizados: ${ok} | ignorados: ${ignoradas} | total no cadastro: ${base.clientes.length}`);
if (erros.length) {
    console.log('\nLinhas ignoradas:');
    for (const e of erros) console.log('  - ' + e);
}
