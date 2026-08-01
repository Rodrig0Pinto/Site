-- Estatísticas de acesso — Rodrigo Pinto Advocacia
--
-- IMPORTANTE: esta tabela guarda apenas CONTADORES AGREGADOS.
-- Não há endereço IP, identificador de usuário, cookie ou qualquer
-- dado que permita individualizar um visitante. Cada linha diz apenas
-- "no dia X, a página Y foi acessada N vezes a partir da região Z".
-- Dado estatístico anonimizado — fora do conceito de dado pessoal
-- (LGPD, art. 5º, III e art. 12).

CREATE TABLE IF NOT EXISTS acessos (
    dia     TEXT    NOT NULL,              -- AAAA-MM-DD
    pagina  TEXT    NOT NULL,              -- caminho, ex.: /artigos/usucapiao-joao-pessoa.html
    pais    TEXT    NOT NULL DEFAULT '--', -- BR
    regiao  TEXT    NOT NULL DEFAULT '--', -- Paraiba
    cidade  TEXT    NOT NULL DEFAULT '--', -- Joao Pessoa
    total   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (dia, pagina, pais, regiao, cidade)
);

CREATE INDEX IF NOT EXISTS idx_acessos_dia    ON acessos(dia);
CREATE INDEX IF NOT EXISTS idx_acessos_regiao ON acessos(pais, regiao, cidade);
CREATE INDEX IF NOT EXISTS idx_acessos_pagina ON acessos(pagina);
