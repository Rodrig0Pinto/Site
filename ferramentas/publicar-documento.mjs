#!/usr/bin/env node
/* Publica um documento processual (PDF ORIGINAL baixado do sistema do
 * Tribunal) para acesso por link/QR Code em /documento.
 *
 * Uso:
 *   node ferramentas/publicar-documento.mjs arquivo.pdf --processo NNNNNNN-DD.AAAA.J.TR.OOOO \
 *        [--titulo "Decisão — majoração de multa"] [--codigo CODIGO_DE_VERIFICACAO] \
 *        [--conferencia https://projudi.tjam.jus.br/...] [--saida pasta-dos-qrcodes]
 *   node ferramentas/publicar-documento.mjs --remover ID
 *
 * Segurança (cifra de ponta a ponta):
 *   - Gera uma chave AES-256-GCM aleatória POR DOCUMENTO.
 *   - Grava em dados/docs/<ID>.bin apenas o conteúdo cifrado — pode viver
 *     no repositório público e no site sem expor nada.
 *   - A chave só existe no link: https://rodrigopinto.adv.br/documento#d=<ID>&k=<CHAVE>.
 *     O trecho após "#" nunca é enviado ao servidor; a decifração ocorre no
 *     navegador de quem abre o link (js/documento.js).
 *   - O QR Code contém a chave: NUNCA salvá-lo dentro do repositório.
 *   - Revogar o acesso = remover o .bin (opção --remover) e publicar.
 *
 * QR Code: requer o pacote "qrcode" (npm i qrcode, em qualquer pasta). Sem
 * ele, o link é impresso e o QR pode ser gerado depois.
 */

import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.join(RAIZ, 'dados', 'docs');
const SITE = 'https://rodrigopinto.adv.br/documento';
const MAGICO = Buffer.from('RPD1');
const LIMITE = 20 * 1024 * 1024;

const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sair = msg => { console.error('✗ ' + msg); process.exit(1); };

function validarCnj(n) {
    const m = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/.exec(String(n || '').trim());
    if (!m) sair('Número do processo fora do padrão CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO).');
    const [, seq, dv, ano, j, tr, orig] = m;
    const esperado = 98n - BigInt(seq + ano + j + tr + orig + '00') % 97n;
    if (BigInt(dv) !== esperado) sair(`Dígito verificador não confere (esperado ${String(esperado).padStart(2, '0')}).`);
    return m[0];
}

function opcoes(args) {
    const o = { _: [] };
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) o[args[i].slice(2)] = args[++i];
        else o._.push(args[i]);
    }
    return o;
}

const o = opcoes(process.argv.slice(2));

if ('remover' in o) {
    const id = String(o.remover || '');
    if (!/^[A-Za-z0-9_-]{22}$/.test(id)) sair('ID inválido.');
    const arq = path.join(PASTA, id + '.bin');
    if (!existsSync(arq)) sair('Documento não encontrado.');
    unlinkSync(arq);
    console.log('✓ removido. Faça commit e push no main para revogar o acesso on-line.');
    process.exit(0);
}

const arquivo = o._[0];
if (!arquivo) sair('Informe o PDF. Ex.: node ferramentas/publicar-documento.mjs decisao.pdf --processo ...');
const pdf = readFileSync(arquivo);
if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') sair('O arquivo não é PDF. Use o PDF original baixado do sistema do Tribunal.');
if (pdf.length > LIMITE) sair('PDF acima de 20 MB.');
const conferencia = o.conferencia || 'https://projudi.tjam.jus.br/';
if (!/^https:\/\//.test(conferencia)) sair('O endereço de conferência deve começar com https://');

const sha = Buffer.from(await crypto.subtle.digest('SHA-256', pdf)).toString('hex');
const cabecalho = Buffer.from(JSON.stringify({
    v: 1,
    processo: validarCnj(o.processo),
    titulo: String(o.titulo || 'Documento processual').slice(0, 160),
    codigo: String(o.codigo || '').slice(0, 120),
    conferencia,
    nome: path.basename(arquivo).replace(/[^\w.\-]/g, '_'),
    sha256: sha,
    publicado: new Date().toISOString().slice(0, 10),
}), 'utf8');

const tam = Buffer.alloc(4);
tam.writeUInt32BE(cabecalho.length);
const claro = Buffer.concat([tam, cabecalho, pdf]);

const id = b64url(crypto.getRandomValues(new Uint8Array(16)));
const chaveBruta = crypto.getRandomValues(new Uint8Array(32));
const iv = crypto.getRandomValues(new Uint8Array(12));
const chave = await crypto.subtle.importKey('raw', chaveBruta, 'AES-GCM', false, ['encrypt']);
const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, chave, claro);

mkdirSync(PASTA, { recursive: true });
writeFileSync(path.join(PASTA, id + '.bin'), Buffer.concat([MAGICO, Buffer.from(iv), Buffer.from(cifrado)]));

const link = `${SITE}#d=${id}&k=${b64url(chaveBruta)}`;
console.log('✓ documento cifrado em dados/docs/' + id + '.bin');
console.log('  SHA-256 do PDF original: ' + sha);
console.log('  ID (para revogar): ' + id);
console.log('\n  LINK DE ACESSO (guarde — a chave existe só aqui):\n  ' + link + '\n');

let QR = null;
try { QR = createRequire(path.join(process.cwd(), 'x.js'))('qrcode'); }
catch { try { QR = (await import('qrcode')).default; } catch { /* sem o pacote */ } }

if (!QR) {
    console.log('  QR Code não gerado: instale com  npm i qrcode  e gere a partir do link acima.');
} else {
    const saida = path.resolve(o.saida || path.join(os.homedir(), 'qrcodes-rpadv'));
    if (saida.startsWith(path.resolve(RAIZ) + path.sep)) sair('Por segurança, a pasta do QR Code não pode ficar dentro do repositório (o QR contém a chave).');
    mkdirSync(saida, { recursive: true });
    const base = path.join(saida, 'qrcode-' + validarCnj(o.processo).replace(/\./g, '_') + '-' + id.slice(0, 6));
    const cfg = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#0a1628', light: '#ffffff' } };
    writeFileSync(base + '.svg', await QR.toString(link, { ...cfg, type: 'svg' }));
    await QR.toFile(base + '.png', link, { ...cfg, width: 900 });
    console.log('  QR Code: ' + base + '.svg / .png');
}
console.log('\n  Próximo passo: commit de dados/docs/' + id + '.bin e push no main (deploy automático).');
