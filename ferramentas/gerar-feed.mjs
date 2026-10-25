#!/usr/bin/env node
/* Gera /feed.xml (RSS 2.0) a partir dos artigos publicados.
 *
 * Fonte da verdade: o próprio HTML de cada artigo — o JSON-LD "Article"
 * (headline, datePublished, dateModified) e a <meta name="description">.
 * Assim, qualquer artigo novo entra no feed sozinho: a ferramenta roda no
 * cron semanal (seo-manutencao.yml) e em qualquer deploy que a chame.
 *
 * Uso: node ferramentas/gerar-feed.mjs        (grava feed.xml na raiz)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ   = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE   = 'https://rodrigopinto.adv.br';
const TITULO = 'Rodrigo Pinto Advocacia — Artigos Jurídicos';
const DESC   = 'Análises jurídicas em linguagem clara sobre Direito Civil, Família, Empresarial, Bancário, Penal e Tributário, escritas por Rodrigo Pinto, advogado em João Pessoa/PB (OAB/PB 12.371).';

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function extrair(arquivo) {
    const html = readFileSync(arquivo, 'utf8');
    let artigo = null;
    for (const m of html.matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
        let d; try { d = JSON.parse(m[1]); } catch { continue; }
        const nos = Array.isArray(d) ? d : (d['@graph'] || [d]);
        const a = nos.find(n => n && n['@type'] === 'Article');
        if (a) { artigo = a; break; }
    }
    if (!artigo) return null;
    /* Rascunhos em pré-visualização (noindex) ficam fora do feed até a aprovação. */
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) return null;
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const slug = path.basename(arquivo);
    return {
        url: `${SITE}/artigos/${slug}`,
        titulo: artigo.headline,
        descricao: desc.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
        publicado: artigo.datePublished,
        modificado: artigo.dateModified || artigo.datePublished,
    };
}

const dir = path.join(RAIZ, 'artigos');
const itens = readdirSync(dir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => extrair(path.join(dir, f)))
    .filter(Boolean)
    .sort((a, b) => b.publicado.localeCompare(a.publicado) || a.titulo.localeCompare(b.titulo));

const rfc822 = iso => new Date(iso + (iso.length === 10 ? 'T12:00:00-03:00' : '')).toUTCString();
const ultimo = itens.length ? rfc822(itens[0].modificado) : new Date().toUTCString();

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(TITULO)}</title>
    <link>${SITE}/artigos/</link>
    <description>${esc(DESC)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${ultimo}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE}/img/icone-192.png</url>
      <title>${esc(TITULO)}</title>
      <link>${SITE}/</link>
    </image>
${itens.map(i => `    <item>
      <title>${esc(i.titulo)}</title>
      <link>${i.url}</link>
      <guid isPermaLink="true">${i.url}</guid>
      <pubDate>${rfc822(i.publicado)}</pubDate>
      <description>${esc(i.descricao)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;

writeFileSync(path.join(RAIZ, 'feed.xml'), xml);
console.log(`✓ feed.xml gerado com ${itens.length} artigo(s); mais recente: ${itens[0]?.publicado ?? '-'}`);
