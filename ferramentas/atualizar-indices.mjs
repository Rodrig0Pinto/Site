#!/usr/bin/env node
/* Atualiza /calculadoras/indices.json com as séries oficiais do Banco Central
 * (SGS — Sistema Gerenciador de Séries Temporais). Roda no GitHub Actions
 * (indices.yml) — o sandbox do Claude não alcança api.bcb.gov.br.
 *
 * Séries (código SGS → chave):
 *   433   IPCA     (variação % mensal)        — correção monetária geral
 *   188   INPC     (variação % mensal)        — tabelas de alguns TJs / trabalhista
 *   10764 IPCA-E   (variação % mensal)        — precatórios / Justiça Federal
 *   4390  SELIC    (% acumulada no mês)       — EC 113/2021 e Lei 14.905/2024
 *   226   TR       (% mensal)                 — poupança / FGTS (histórico)
 *   1619  Salário mínimo (R$, mensal)         — honorários art. 85 §3º do CPC
 *
 * Uso: node ferramentas/atualizar-indices.mjs   (grava calculadoras/indices.json)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'calculadoras', 'indices.json');
const SERIES = { ipca: 433, inpc: 188, ipcae: 10764, selic: 4390, tr: 226, salario_minimo: 1619 };
const INICIO = new Date(1994, 6, 1); // Plano Real

const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const chaveMes = s => { const [d, m, a] = s.split('/'); return `${a}-${m}`; };

async function serie(codigo) {
    const pontos = {};
    let ini = new Date(INICIO);
    const hoje = new Date();
    while (ini <= hoje) {
        const fim = new Date(ini.getFullYear() + 9, 11, 31);
        const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${fmt(ini)}&dataFinal=${fmt(fim > hoje ? hoje : fim)}`;
        const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) throw new Error(`SGS ${codigo}: HTTP ${r.status}`);
        for (const p of await r.json()) {
            const v = parseFloat(String(p.valor).replace(',', '.'));
            if (Number.isFinite(v)) pontos[chaveMes(p.data)] = v;
        }
        ini = new Date(fim.getFullYear() + 1, 0, 1);
    }
    return pontos;
}

const anterior = existsSync(DESTINO) ? JSON.parse(readFileSync(DESTINO, 'utf8')) : null;
const saida = { atualizado: new Date().toISOString().slice(0, 10), fonte: 'Banco Central do Brasil — SGS', series: {} };
for (const [chave, codigo] of Object.entries(SERIES)) {
    try {
        saida.series[chave] = await serie(codigo);
        const meses = Object.keys(saida.series[chave]).sort();
        console.log(`✓ ${chave.padEnd(15)} SGS ${String(codigo).padEnd(6)} ${meses.length} meses, último: ${meses.at(-1)} = ${saida.series[chave][meses.at(-1)]}`);
    } catch (e) {
        // Falha em uma série não pode apagar o histórico já publicado.
        if (anterior?.series?.[chave]) { saida.series[chave] = anterior.series[chave]; console.log(`! ${chave}: ${e.message} — mantido o valor anterior`); }
        else throw e;
    }
}
writeFileSync(DESTINO, JSON.stringify(saida));
console.log(`→ ${path.relative(RAIZ, DESTINO)} gravado (${(JSON.stringify(saida).length / 1024).toFixed(0)} KB)`);
