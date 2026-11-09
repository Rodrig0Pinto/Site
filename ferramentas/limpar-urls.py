#!/usr/bin/env python3
# Uso: python3 ferramentas/limpar-urls.py   (rodar na raiz do repositório após criar/gerar páginas)
"""Troca endereços internos *.html por endereços limpos (os que a Cloudflare Pages serve com HTTP 200).
Só mexe em: URLs absolutas do próprio domínio e hrefs relativos/raiz. Links externos ficam intactos."""
import re, subprocess, sys
DOM = r'https://(?:www\.)?rodrigopinto\.adv\.br'
def limpa_caminho(p):
    # p sem host; preserva ?query e #frag
    m = re.match(r'^([^?#]*?)((?:[?#].*)?)$', p); base, resto = m.group(1), m.group(2)
    if base.endswith('/index.html'): base = base[:-len('index.html')]
    elif base == 'index.html': base = './'
    elif base.endswith('.html') and base not in ('404.html',): base = base[:-5]
    return base + resto
abs_re = re.compile(DOM + r'(/[^"\'\s<>)]*?\.html(?:[?#][^"\'\s<>)]*)?)(?=["\'\s<>)])')
href_re = re.compile(r'href="(?![a-z][a-z0-9+.-]*:|//|#)([^"]*?\.html(?:[?#][^"]*)?)"', re.I)
arquivos = [f for f in subprocess.check_output(['git','ls-files'], text=True).split('\n')
            if f.endswith(('.html','.xml','.js','.txt','.webmanifest','.mjs')) and not f.startswith(('functions/','ferramentas/','.github/'))
            and f not in ('CLAUDE.md',)]
total = 0
for f in arquivos:
    s = open(f, encoding='utf-8').read(); o = s
    s = abs_re.sub(lambda m: m.group(0).split(m.group(1))[0] + limpa_caminho(m.group(1)), s)
    s = href_re.sub(lambda m: 'href="' + limpa_caminho(m.group(1)) + '"', s)
    if s != o:
        n = sum(1 for a, b in zip(o.splitlines(), s.splitlines()) if a != b); total += n
        open(f, 'w', encoding='utf-8').write(s); print(f'{f}: {n} linhas')
print('total de linhas alteradas:', total)
