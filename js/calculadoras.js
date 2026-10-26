/* Calculadoras jurídicas — rodrigopinto.adv.br
 * Tudo roda no navegador. Os índices vêm de /calculadoras/indices.json,
 * gerado automaticamente a partir do SGS do Banco Central (ver
 * ferramentas/atualizar-indices.mjs). Nenhum dado digitado sai do seu aparelho.
 */
(function () {
    'use strict';

    /* ===================== utilidades ===================== */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtBRL = n => BRL.format(Math.round(n * 100) / 100);
    const fmtPct = (n, d) => (n).toLocaleString('pt-BR', { minimumFractionDigits: d ?? 2, maximumFractionDigits: d ?? 2 }) + '%';
    const fmtNum = (n, d) => n.toLocaleString('pt-BR', { minimumFractionDigits: d ?? 2, maximumFractionDigits: d ?? 2 });
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

    function parseNum(txt) {
        if (txt == null) return NaN;
        let s = String(txt).trim().replace(/[R$\s]/g, '');
        if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
        else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
        return parseFloat(s);
    }
    function parseData(v) { // "AAAA-MM-DD" (input type=date) → Date local
        if (!v) return null;
        const [a, m, d] = v.split('-').map(Number);
        if (!a || !m || !d) return null;
        return new Date(a, m - 1, d);
    }
    const fmtData = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const fmtDataLonga = d => `${DIAS[d.getDay()]}, ${fmtData(d)}`;
    const chaveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mesLegivel = ch => { const [a, m] = ch.split('-'); return `${MESES[+m - 1].slice(0, 3)}/${a}`; };
    function proxMes(ch) { let [a, m] = ch.split('-').map(Number); m++; if (m > 12) { m = 1; a++; } return `${a}-${String(m).padStart(2, '0')}`; }
    const isoHoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

    function mostrar(container, htmlResultado, htmlMemoria) {
        container.innerHTML = htmlResultado + (htmlMemoria || '') +
            '<p class="calc-print-rodape">Cálculo gerado em rodrigopinto.adv.br/calculadoras em ' + fmtData(new Date()) + '. Ferramenta informativa — confira a memória de cálculo e as convenções adotadas.</p>';
        container.classList.add('visivel');
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function erro(container, msg) {
        container.innerHTML = '<div class="calc-erro">' + msg + '</div>';
        container.classList.add('visivel');
    }
    function kpi(label, valor, sub, destaque) {
        return `<div class="calc-kpi${destaque ? ' destaque' : ''}"><span>${label}</span><strong>${valor}</strong>${sub ? `<em>${sub}</em>` : ''}</div>`;
    }

    /* ===================== índices (BCB) ===================== */
    let INDICES = null;
    async function carregarIndices() {
        if (INDICES) return INDICES;
        const r = await fetch('/calculadoras/indices.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error('indices');
        INDICES = await r.json();
        return INDICES;
    }
    function ultimoMes(serie) { const ks = Object.keys(serie).sort(); return ks[ks.length - 1]; }
    function infoIndices(el) {
        carregarIndices().then(ix => {
            const u = ultimoMes(ix.series.ipca);
            el.textContent = `Índices oficiais do Banco Central (SGS), atualizados em ${ix.atualizado.split('-').reverse().join('/')}. Último mês disponível: ${mesLegivel(u)}.`;
        }).catch(() => { el.textContent = 'Os índices ainda não foram carregados. Tente novamente em instantes.'; });
    }

    /* ===================== 1. atualização monetária ===================== */
    const AVISO_ANATOCISMO = 'ATENÇÃO — juros compostos (anatocismo): a capitalização mensal só é admitida (a) nas operações de instituições financeiras celebradas a partir de 31/03/2000, se expressamente pactuada — a taxa anual superior ao duodécuplo da mensal basta (MP 2.170-36/2001, art. 5º; Súmulas 539 e 541/STJ); (b) nas cédulas de crédito rural, comercial e industrial (Súmula 93/STJ) e nas cédulas de crédito bancário (Lei 10.931/2004, art. 28, § 1º, I); (c) no FGTS (Lei 8.036/90, art. 13). Fora dessas hipóteses, a capitalização com periodicidade inferior a um ano é vedada (Decreto 22.626/33, art. 4º; Súmula 121/STF) e os juros de mora de débitos judiciais, da Fazenda Pública, de alimentos e de indenizações são SIMPLES.';
    const NOMES_INDICE = { ipcae: 'IPCA-E (IBGE)', ipca: 'IPCA (IBGE)', inpc: 'INPC (IBGE)', igpm: 'IGP-M (FGV)', tr: 'TR (Banco Central)', selic: 'SELIC acumulada (EC 113/2021)' };

    async function calcAtualizacao(form, out) {
        const valor = parseNum(form.valor.value);
        const dIni = parseData(form.dataInicial.value), dFim = parseData(form.dataFinal.value);
        if (!(valor > 0)) return erro(out, 'Informe o valor original (ex.: 10.000,00).');
        if (!dIni || !dFim) return erro(out, 'Informe as datas inicial e final.');
        if (dFim < dIni) return erro(out, 'A data final deve ser posterior à data inicial.');
        let ix; try { ix = await carregarIndices(); } catch { return erro(out, 'Não foi possível carregar os índices do Banco Central. Tente novamente.'); }
        if (form.modo && form.modo.value === 'auto') return calcRegime(form, out, ix, valor, dIni, dFim);

        const indice = form.indice.value;
        const serie = ix.series[indice];
        if (!serie || !Object.keys(serie).length) return erro(out, `A série ${NOMES_INDICE[indice]} ainda não está disponível nesta atualização dos índices. Tente outro índice ou volte mais tarde.`);
        const incluirIni = form.incluirMesInicial.checked;
        const mesIni = incluirIni ? chaveMes(dIni) : proxMes(chaveMes(dIni));
        const mesFim = chaveMes(dFim);
        const ultDisp = ultimoMes(serie);

        // meses de correção
        const meses = [];
        let truncado = null;
        for (let m = mesIni; m <= mesFim; m = proxMes(m)) {
            if (serie[m] == null) { truncado = m; break; }
            meses.push(m);
        }
        let fator = 1, somaSelic = 0;
        const linhas = [];
        for (const m of meses) {
            const i = serie[m];
            if (indice === 'selic') { somaSelic += i; linhas.push({ m, i, acum: 1 + somaSelic / 100 }); }
            else { fator *= (1 + i / 100); linhas.push({ m, i, acum: fator }); }
        }
        if (indice === 'selic') fator = 1 + somaSelic / 100;
        const corrigido = valor * fator;

        // juros
        const tipoJuros = indice === 'selic' ? 'nenhum' : form.juros.value;
        let juros = 0, nMesesJuros = 0, taxaAcum = 0, descJuros = 'Sem juros.';
        const avisosJuros = [];
        const linhasJuros = {};
        if (tipoJuros === 'legal' && !(ix.series.selic && ix.series.ipca)) return erro(out, 'As séries SELIC e IPCA são necessárias para a taxa legal e ainda não estão disponíveis.');
        if (tipoJuros !== 'nenhum') {
            const dJ = parseData(form.jurosInicio.value) || dIni;
            const mJIni = incluirIni ? chaveMes(dJ) : proxMes(chaveMes(dJ));
            const mesesJ = [];
            for (let m = mJIni; m <= (truncado ? meses[meses.length - 1] || mesFim : mesFim); m = proxMes(m)) mesesJ.push(m);
            if (tipoJuros === 'legal') {
                for (const m of mesesJ) {
                    const s = ix.series.selic[m], p = ix.series.ipca[m];
                    if (s == null || p == null) break;
                    const t = Math.max(s - p, 0); taxaAcum += t; linhasJuros[m] = t; nMesesJuros++;
                }
                descJuros = `Taxa legal (Lei 14.905/2024, art. 406 do CC): SELIC mensal menos IPCA mensal, nunca negativa, somada mês a mês — ${nMesesJuros} meses, ${fmtPct(taxaAcum, 4)} acumulados.`;
            } else {
                const taxa = ['personalizado', 'compostoM', 'anual'].includes(tipoJuros) ? parseNum(form.jurosTaxa.value) : parseFloat(tipoJuros);
                if (!(taxa >= 0)) return erro(out, 'Informe a taxa de juros mensal.');
                nMesesJuros = mesesJ.length;
                for (const m of mesesJ) linhasJuros[m] = taxa;
                if (tipoJuros === 'compostoM') {
                    taxaAcum = (Math.pow(1 + taxa / 100, nMesesJuros) - 1) * 100;
                    descJuros = `Juros COMPOSTOS de ${fmtPct(taxa, 2)} ao mês (capitalização mensal) sobre o valor corrigido, por ${nMesesJuros} meses: (1 + i)ⁿ − 1 = ${fmtPct(taxaAcum, 2)}.`;
                    avisosJuros.push(AVISO_ANATOCISMO);
                } else if (tipoJuros === 'anual') {
                    let fat = 1, resto = nMesesJuros;
                    while (resto > 0) { const n = Math.min(12, resto); fat *= 1 + taxa * n / 100; resto -= n; }
                    taxaAcum = (fat - 1) * 100;
                    descJuros = `Juros de ${fmtPct(taxa, 2)} ao mês, simples dentro de cada ano e capitalizados a cada 12 meses (capitalização anual — Decreto 22.626/33, art. 4º), por ${nMesesJuros} meses: ${fmtPct(taxaAcum, 2)} acumulados.`;
                    avisosJuros.push('A capitalização anual é a única admitida nas obrigações civis em geral (Decreto 22.626/33, art. 4º; Súmula 121/STF). Em débitos judiciais, alimentos, Fazenda Pública e responsabilidade civil prevalecem os juros simples.');
                } else {
                    taxaAcum = taxa * nMesesJuros;
                    descJuros = `Juros simples de ${fmtPct(taxa, 2)} ao mês sobre o valor corrigido, por ${nMesesJuros} meses (${fmtPct(taxaAcum, 2)} acumulados).`;
                }
            }
            juros = corrigido * taxaAcum / 100;
        }
        const multa = form.multa523.checked ? corrigido * 0.10 : 0;
        const honor = form.honor523.checked ? corrigido * 0.10 : 0;
        const pctMora = form.multaMora ? (parseNum(form.multaMora.value) || 0) : 0;
        const multaMora = pctMora > 0 ? corrigido * pctMora / 100 : 0;
        const total = corrigido + juros + multa + honor + multaMora;

        const avisos = [...avisosJuros];
        if (truncado) avisos.push(`O índice de ${mesLegivel(truncado)} ainda não foi divulgado (último disponível: ${mesLegivel(ultDisp)}). A correção foi aplicada até ${mesLegivel(meses[meses.length - 1] || mesIni)}.`);
        if (!meses.length) avisos.push('Nenhum mês inteiro de correção entre as datas informadas — o valor não foi corrigido.');
        if (indice === 'selic') avisos.push('A SELIC acumulada já engloba correção monetária e juros (EC 113/2021, art. 3º; STF, Tema 810/ADI 4.357) — por isso o campo de juros é desconsiderado.');

        const html = `<div class="calc-result-box"><h2>Resultado</h2><div class="calc-kpis">
            ${kpi('Valor original', fmtBRL(valor), fmtData(dIni))}
            ${kpi('Valor corrigido', fmtBRL(corrigido), `${NOMES_INDICE[indice]} · fator ${fmtNum(fator, 6)}`)}
            ${juros ? kpi('Juros', fmtBRL(juros), `${nMesesJuros} meses · ${fmtPct(taxaAcum, 2)}`) : ''}
            ${multa ? kpi('Multa (art. 523, § 1º)', fmtBRL(multa), '10% do valor corrigido') : ''}
            ${honor ? kpi('Honorários (art. 523, § 1º)', fmtBRL(honor), '10% do valor corrigido') : ''}
            ${multaMora ? kpi('Multa moratória', fmtBRL(multaMora), `${fmtPct(pctMora, 2)} do valor corrigido`) : ''}
            ${kpi('Total em ' + fmtData(dFim), fmtBRL(total), '', true)}
        </div>${avisos.map(a => `<div class="calc-aviso">${a}</div>`).join('')}</div>`;

        const tabela = `<div class="calc-memoria"><h3>Memória de cálculo</h3>
            <p><strong>Convenção:</strong> ${incluirIni ? 'o índice do mês do termo inicial foi incluído' : 'a correção começa no mês seguinte ao termo inicial'} e vai até o mês do termo final (${mesLegivel(mesFim)}), inclusive. ${indice === 'selic' ? 'SELIC somada mês a mês (acumulação simples).' : 'Fatores mensais multiplicados (1 + i/100).'} ${descJuros}</p>
            <div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Mês</th><th>${NOMES_INDICE[indice].split(' ')[0]} (%)</th><th>Fator acumulado</th><th>Valor corrigido</th>${tipoJuros !== 'nenhum' ? '<th>Juros no mês (%)</th>' : ''}</tr></thead><tbody>
            ${linhas.map(l => `<tr><td>${mesLegivel(l.m)}</td><td>${fmtNum(l.i, 4)}</td><td>${fmtNum(l.acum, 6)}</td><td>${fmtBRL(valor * l.acum)}</td>${tipoJuros !== 'nenhum' ? `<td>${linhasJuros[l.m] != null ? fmtNum(linhasJuros[l.m], 4) : '—'}</td>` : ''}</tr>`).join('')}
            </tbody><tfoot><tr><td>Total</td><td></td><td>${fmtNum(fator, 6)}</td><td>${fmtBRL(corrigido)}</td>${tipoJuros !== 'nenhum' ? `<td>${fmtNum(taxaAcum, 4)}</td>` : ''}</tr></tfoot></table></div>
            <p class="calc-fonte">Fonte dos índices: Banco Central do Brasil — SGS (séries 433, 188, 10764, 4390 e 226), atualizados em ${ix.atualizado.split('-').reverse().join('/')}.</p></div>`;
        mostrar(out, html, tabela);
    }

    /* ===================== 1b. regimes legais por natureza do crédito =====================
     * Cada faixa vale até o mês indicado (inclusive; null = até hoje).
     *   corr: série de correção monetária do período
     *   juros: número (% a.m., simples) | 'legal' (SELIC − IPCA) | 'poupanca' (art. 1º-F, Lei 9.494/97) | 'tr' | null
     *   selicUnica: a SELIC acumulada substitui correção e juros (acumulação simples)
     * Fronteiras tratadas por mês inteiro (sem pro rata de dias) — ver nota na página.
     */
    const REGIMES = {
        civel: { nome: 'Obrigação civil — responsabilidade contratual (dívidas, contratos)', minimo: '1994-08', dica: 'Juros desde o vencimento (art. 397 do CC) ou da citação (art. 405); correção desde o vencimento/prejuízo (Súmula 43/STJ).', faixas: [
            { ate: '2002-12', corr: 'inpc', juros: 0.5, base: 'Correção pela tabela do tribunal (INPC); juros de 0,5% a.m. — art. 1.062 do CC/1916' },
            { ate: '2024-08', corr: 'inpc', juros: 1, base: 'INPC (tabela do tribunal); juros de 1% a.m. — art. 406 do CC/2002 c/c art. 161, § 1º, do CTN (STJ, EREsp 727.842)' },
            { ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA — art. 389, parágrafo único, do CC; juros pela taxa legal (SELIC − IPCA) — art. 406, §§ 1º a 3º, do CC, na redação da Lei 14.905/2024 (desde 30/08/2024)' } ] },
        fazenda_geral: { nome: 'Fazenda Pública — condenação administrativa em geral', minimo: '2001-01', faixas: [
            { ate: '2002-12', corr: 'ipcae', juros: 0.5, base: 'IPCA-E (Manual de Cálculos da Justiça Federal) + juros de 0,5% a.m. — STJ, Tema 905, item 3.1.a' },
            { ate: '2009-06', selicUnica: true, base: 'SELIC, vedada a cumulação com outro índice — art. 406 do CC/2002; STJ, Tema 905, item 3.1.b' },
            { ate: '2021-11', corr: 'ipcae', juros: 'poupanca', base: 'IPCA-E (STF, Tema 810 — TR afastada) + juros da caderneta de poupança — art. 1º-F da Lei 9.494/97 (Lei 11.960/2009); STJ, Tema 905, item 3.1.c' },
            { ate: null, selicUnica: true, base: 'SELIC acumulada mensalmente, uma única vez, englobando correção e juros — art. 3º da EC 113/2021 (desde 09/12/2021)' } ] },
        fazenda_servidor: { nome: 'Fazenda Pública — verbas de servidores públicos', minimo: '2001-01', faixas: [
            { ate: '2001-07', corr: 'ipcae', juros: 1, base: 'IPCA-E + juros de 1% a.m. — STJ, Tema 905, item 3.1.1.a' },
            { ate: '2009-06', corr: 'ipcae', juros: 0.5, base: 'IPCA-E + juros de 0,5% a.m. — art. 1º-F da Lei 9.494/97 (MP 2.180-35/2001); STJ, Tema 905, item 3.1.1.b' },
            { ate: '2021-11', corr: 'ipcae', juros: 'poupanca', base: 'IPCA-E (STF, Tema 810) + juros da poupança — Lei 11.960/2009; STJ, Tema 905, item 3.1.1.c' },
            { ate: null, selicUnica: true, base: 'SELIC acumulada única — art. 3º da EC 113/2021' } ] },
        previdenciario: { nome: 'Benefício previdenciário (INSS)', minimo: '2006-09', faixas: [
            { ate: '2009-06', corr: 'inpc', juros: 1, base: 'INPC — art. 41-A da Lei 8.213/91 (Lei 11.430/2006); juros de 1% a.m. — STJ, Tema 905, item 3.2' },
            { ate: '2021-11', corr: 'inpc', juros: 'poupanca', base: 'INPC + juros da poupança — art. 1º-F da Lei 9.494/97; STJ, Tema 905, item 3.2; STF, Tema 810' },
            { ate: null, selicUnica: true, base: 'SELIC acumulada única — art. 3º da EC 113/2021' } ] },
        tributario: { nome: 'Tributário federal (repetição de indébito / crédito tributário)', minimo: '1996-01', faixas: [
            { ate: null, selicUnica: true, base: 'SELIC acumulada a partir do mês seguinte ao do pagamento indevido, sem cumulação com juros — art. 39, § 4º, da Lei 9.250/95; STJ, Súmula 523 e Tema 905, item 3.3' } ] },
        trabalhista: { nome: 'Crédito trabalhista (STF, ADC 58 e 59)', minimo: '1994-08', precisaAjuizamento: true, faixas: [] },
        civel_extracontratual: { nome: 'Obrigação civil — responsabilidade extracontratual (ato ilícito)', minimo: '1994-08', dica: 'Juros desde o evento danoso (Súmula 54/STJ); dano moral: correção desde o arbitramento (Súmula 362/STJ) — informe como data inicial a data da sentença que fixou o valor.', faixas: [
            { ate: '2002-12', corr: 'inpc', juros: 0.5, base: 'Correção pela tabela do tribunal (INPC); juros de 0,5% a.m. — art. 1.062 do CC/1916' },
            { ate: '2024-08', corr: 'inpc', juros: 1, base: 'INPC (tabela do tribunal); juros de 1% a.m. — art. 406 do CC/2002 c/c art. 161, § 1º, do CTN (STJ, EREsp 727.842)' },
            { ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA — art. 389, parágrafo único, do CC; juros pela taxa legal (SELIC − IPCA) — art. 406, §§ 1º a 3º, do CC, na redação da Lei 14.905/2024 (desde 30/08/2024)' } ] },
        consumidor_bancario: { nome: 'Consumidor / contrato bancário (revisão, repetição de indébito)', minimo: '1994-08', dica: 'Regime legal supletivo. Se o contrato prevê juros remuneratórios com capitalização pactuada, o valor devido segue a taxa contratual — use o modo manual com juros compostos.', alerta: 'Em contratos de instituições financeiras celebrados após 31/03/2000, a capitalização mensal de juros é válida se expressamente pactuada (MP 2.170-36/2001, art. 5º; Súmulas 539 e 541/STJ). Este cálculo aplica apenas os juros moratórios legais; para encargos contratuais, use o modo manual.', faixas: [
            { ate: '2002-12', corr: 'inpc', juros: 0.5, base: 'Correção pela tabela do tribunal (INPC); juros de 0,5% a.m. — art. 1.062 do CC/1916' },
            { ate: '2024-08', corr: 'inpc', juros: 1, base: 'INPC (tabela do tribunal); juros de 1% a.m. — art. 406 do CC/2002 c/c art. 161, § 1º, do CTN (STJ, EREsp 727.842)' },
            { ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA — art. 389, parágrafo único, do CC; juros pela taxa legal (SELIC − IPCA) — art. 406, §§ 1º a 3º, do CC, na redação da Lei 14.905/2024 (desde 30/08/2024)' } ] },
        alimentos: { nome: 'Família — pensão alimentícia em atraso', minimo: '1994-08', dica: 'Cada parcela vence na data fixada no título; para várias parcelas, calcule uma a uma ou use a parcela mais antiga como referência. Prisão civil só para as 3 últimas parcelas (Súmula 309/STJ); as demais seguem a execução por penhora.', faixas: [
            { ate: '2002-12', corr: 'inpc', juros: 0.5, base: 'Correção pela tabela do tribunal (INPC); juros de 0,5% a.m. — art. 1.062 do CC/1916' },
            { ate: '2024-08', corr: 'inpc', juros: 1, base: 'INPC (tabela do tribunal); juros de 1% a.m. — art. 406 do CC/2002 c/c art. 161, § 1º, do CTN (STJ, EREsp 727.842)' },
            { ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA — art. 389, parágrafo único, do CC; juros pela taxa legal (SELIC − IPCA) — art. 406, §§ 1º a 3º, do CC, na redação da Lei 14.905/2024 (desde 30/08/2024)' } ] },
        honorarios: { nome: 'Honorários sucumbenciais e contratuais', minimo: '1994-08', dica: 'Sucumbenciais: correção desde o arbitramento (Súmula 14/STJ) e juros desde o trânsito em julgado. Contratuais: desde o vencimento previsto no contrato (art. 24 da Lei 8.906/94).', faixas: [
            { ate: '2002-12', corr: 'inpc', juros: 0.5, base: 'Correção pela tabela do tribunal (INPC); juros de 0,5% a.m. — art. 1.062 do CC/1916' },
            { ate: '2024-08', corr: 'inpc', juros: 1, base: 'INPC (tabela do tribunal); juros de 1% a.m. — art. 406 do CC/2002 c/c art. 161, § 1º, do CTN (STJ, EREsp 727.842)' },
            { ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA — art. 389, parágrafo único, do CC; juros pela taxa legal (SELIC − IPCA) — art. 406, §§ 1º a 3º, do CC, na redação da Lei 14.905/2024 (desde 30/08/2024)' } ] },
        condominio: { nome: 'Condomínio — cotas condominiais', minimo: '1994-08', dica: 'Correção pelo índice da convenção (na falta, INPC), juros de 1% a.m. salvo previsão diversa e multa de até 2% — art. 1.336, § 1º, do CC. Informe a multa no campo "multa moratória".', faixas: [
            { ate: '2002-12', corr: 'inpc', juros: 0.5, base: 'Correção pela tabela do tribunal (INPC); juros de 0,5% a.m. — art. 1.062 do CC/1916' },
            { ate: '2024-08', corr: 'inpc', juros: 1, base: 'INPC (tabela do tribunal); juros de 1% a.m. — art. 406 do CC/2002 c/c art. 161, § 1º, do CTN (STJ, EREsp 727.842)' },
            { ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA — art. 389, parágrafo único, do CC; juros pela taxa legal (SELIC − IPCA) — art. 406, §§ 1º a 3º, do CC, na redação da Lei 14.905/2024 (desde 30/08/2024)' } ] },
        penal_multa: { nome: 'Penal — pena de multa (art. 49 do CP)', minimo: '2001-01', dica: 'A multa é atualizada pelos índices de correção monetária desde a data do fato (STJ) e não sofre juros; cobrada pelo MP na execução penal (ADI 3.150/STF).', faixas: [
            { ate: null, corr: 'ipcae', juros: null, base: 'Correção monetária pelo IPCA-E (Manual de Cálculos da Justiça Federal), sem juros — art. 49, § 2º, do CP; STJ, REsp 1.519.777' } ] },
        fgts: { nome: 'FGTS — saldo da conta vinculada (estimativa)', minimo: '1994-08', dica: 'Remuneração legal: TR + 3% a.a., capitalizados mensalmente (art. 13 da Lei 8.036/90). Desde o julgamento da ADI 5.090 (jun/2024), o rendimento não pode ficar abaixo do IPCA. Não inclui a distribuição de resultados do FGTS.', alerta: 'Estimativa: a conta real do FGTS inclui a distribuição anual de resultados e arredondamentos da Caixa. Serve para conferência e para pedidos de recomposição.', faixas: [
            { ate: '2024-06', corr: 'tr', juros: 0.2466, composto: true, base: 'TR + juros de 3% a.a. (0,2466% a.m.), capitalizados mensalmente — art. 13 da Lei 8.036/90' },
            { ate: null, corr: 'tr', juros: 0.2466, composto: true, piso: 'ipca', base: 'TR + 3% a.a. capitalizados, garantido no mínimo o IPCA do mês — STF, ADI 5.090 (jun/2024)' } ] },
    };
    function faixasTrabalhista(mesAjuiz) {
        const anterior = mesAnterior(mesAjuiz);
        const f = [{ ate: anterior, corr: 'ipcae', juros: 'tr', base: 'Fase pré-judicial: IPCA-E + juros do art. 39, caput, da Lei 8.177/91 (TR) — STF, ADC 58 e 59' }];
        if (mesAjuiz <= '2024-08') f.push({ ate: '2024-08', selicUnica: true, base: 'A partir do ajuizamento: SELIC acumulada, englobando correção e juros — STF, ADC 58 e 59' });
        f.push({ ate: null, corr: 'ipca', juros: 'legal', base: 'IPCA + taxa legal (SELIC − IPCA) — arts. 389 e 406 do CC, na redação da Lei 14.905/2024 (orientação do TST para o período posterior a 30/08/2024; confira a decisão do seu caso)' });
        return f;
    }
    function mesAnterior(ch) { let [a, m] = ch.split('-').map(Number); m--; if (m < 1) { m = 12; a--; } return `${a}-${String(m).padStart(2, '0')}`; }
    function faixaDoMes(faixas, m) { return faixas.find(f => f.ate == null || m <= f.ate); }
    function jurosPoupanca(ix, m) { // juros da poupança (sem a TR): 0,5% a.m. ou 70% da meta SELIC mensalizada quando a meta ≤ 8,5% a.a. (Lei 12.703/2012, desde 05/2012)
        if (m < '2012-05') return 0.5;
        const meta = ix.series.selic_meta && ix.series.selic_meta[m];
        if (meta == null) return null;
        return meta > 8.5 ? 0.5 : (Math.pow(1 + meta / 100, 1 / 12) - 1) * 100 * 0.7;
    }
    const NOME_SERIE = { ipcae: 'IPCA-E', ipca: 'IPCA', inpc: 'INPC', tr: 'TR', selic: 'SELIC' };
    function descJurosFaixa(f) {
        if (f.selicUnica) return 'SELIC (correção + juros)';
        if (f.juros === 'legal') return 'pela taxa legal (SELIC − IPCA)';
        if (f.juros === 'poupanca') return 'da caderneta de poupança (art. 1º-F)';
        if (f.juros === 'tr') return 'pela TR (art. 39 da Lei 8.177/91)';
        return f.juros ? 'de ' + fmtPct(f.juros, 1) + ' a.m.' : 'sem juros';
    }

    function calcRegime(form, out, ix, valor, dIni, dFim) {
        const nat = form.natureza.value, R = REGIMES[nat];
        let faixas = R.faixas;
        const incluirIni = form.incluirMesInicial.checked;
        const mesIni = incluirIni ? chaveMes(dIni) : proxMes(chaveMes(dIni));
        const mesFim = chaveMes(dFim);
        if (R.precisaAjuizamento) {
            const dA = parseData(form.ajuizamento.value);
            if (!dA) return erro(out, 'Informe a data do ajuizamento da reclamação trabalhista (a SELIC passa a incidir a partir dela — ADC 58).');
            faixas = faixasTrabalhista(chaveMes(dA));
        }
        if (mesIni < R.minimo) return erro(out, `Para este regime a calculadora cobre datas a partir de ${mesLegivel(R.minimo)} (antes disso os índices legais variam caso a caso). Use o modo manual para períodos anteriores.`);

        let principal = valor, jurosBucket = 0, somaSelic = 0, baseSelic = null;
        let faixaAtual = null; const periodos = []; const linhas = []; let truncado = null;
        const fechaPeriodo = (m) => { if (faixaAtual) { const p = periodos[periodos.length - 1]; p.ate = m; p.totalFim = total(); } };
        const total = () => faixaAtual && faixaAtual.selicUnica ? baseSelic * (1 + somaSelic / 100) : principal + jurosBucket;
        for (let m = mesIni; m <= mesFim; m = proxMes(m)) {
            const f = faixaDoMes(faixas, m);
            if (f !== faixaAtual) {
                // transição de regime: consolida o que foi apurado até aqui
                if (faixaAtual) {
                    const t = total(); fechaPeriodo(mesAnterior(m));
                    if (faixaAtual.selicUnica) { principal = t; jurosBucket = 0; }
                }
                faixaAtual = f; somaSelic = 0;
                if (f.selicUnica) { baseSelic = principal + jurosBucket; principal = baseSelic; jurosBucket = 0; }
                periodos.push({ de: m, ate: null, faixa: f, totalIni: principal + jurosBucket, idx: periodos.length + 1 });
            }
            let iCorr = null, tJuros = null;
            if (f.selicUnica) {
                const s = ix.series.selic[m]; if (s == null) { truncado = { m, serie: 'SELIC' }; break; }
                somaSelic += s; iCorr = s;
            } else {
                const i = ix.series[f.corr][m]; if (i == null) { truncado = { m, serie: NOME_SERIE[f.corr] }; break; }
                if (f.composto) { // juros capitalizados mensalmente (FGTS): incorporam-se ao principal
                    let fat = (1 + i / 100) * (1 + (f.juros || 0) / 100);
                    if (f.piso) { const pi = ix.series[f.piso][m]; if (pi == null) { truncado = { m, serie: NOME_SERIE[f.piso] + ' (piso)' }; break; } fat = Math.max(fat, 1 + pi / 100); }
                    principal *= fat; iCorr = (fat - 1) * 100; tJuros = f.juros || 0;
                    linhas.push({ m, idx: periodos.length, iCorr, tJuros, principal, juros: 0, total: total() });
                    continue;
                }
                principal *= (1 + i / 100); jurosBucket *= (1 + i / 100); iCorr = i;
                if (f.juros === 'legal') { const s = ix.series.selic[m], p = ix.series.ipca[m]; if (s == null || p == null) { truncado = { m, serie: 'SELIC/IPCA (taxa legal)' }; break; } tJuros = Math.max(s - p, 0); }
                else if (f.juros === 'poupanca') { tJuros = jurosPoupanca(ix, m); if (tJuros == null) { truncado = { m, serie: 'meta SELIC (juros da poupança)' }; break; } }
                else if (f.juros === 'tr') { const t = ix.series.tr[m]; if (t == null) { truncado = { m, serie: 'TR' }; break; } tJuros = t; }
                else tJuros = f.juros || 0;
                jurosBucket += principal * tJuros / 100;
            }
            linhas.push({ m, idx: periodos.length, iCorr, tJuros, principal: f.selicUnica ? baseSelic : principal, juros: f.selicUnica ? baseSelic * somaSelic / 100 : jurosBucket, total: total() });
        }
        if (!linhas.length) return erro(out, 'Nenhum mês inteiro entre as datas informadas' + (truncado ? ` — o índice ${truncado.serie} de ${mesLegivel(truncado.m)} ainda não foi divulgado.` : '.'));
        fechaPeriodo(linhas[linhas.length - 1].m);
        const totalFinal = linhas[linhas.length - 1].total;
        const jurosFinal = linhas[linhas.length - 1].juros, principalFinal = linhas[linhas.length - 1].principal;
        const multa = form.multa523.checked ? totalFinal * 0.10 : 0;
        const honor = form.honor523.checked ? totalFinal * 0.10 : 0;
        const pctMora = form.multaMora ? (parseNum(form.multaMora.value) || 0) : 0;
        const multaMora = pctMora > 0 ? principalFinal * pctMora / 100 : 0;
        const avisos = [];
        if (truncado) avisos.push(`O índice ${truncado.serie} de ${mesLegivel(truncado.m)} ainda não foi divulgado — o cálculo vai até ${mesLegivel(linhas[linhas.length - 1].m)}.`);
        if (R.alerta) avisos.push(R.alerta);
        avisos.push('As mudanças de regime são aplicadas por mês inteiro (sem pro rata de dias) e, quando a SELIC passa a incidir de forma única, ela recai sobre o total apurado até então (principal corrigido + juros), conforme o art. 3º da EC 113/2021. Confira o título judicial: se a decisão fixou índices diferentes, use o modo manual.');

        const html = `<div class="calc-result-box"><h2>Resultado — ${e(R.nome)}</h2><div class="calc-kpis">
            ${kpi('Valor original', fmtBRL(valor), fmtData(dIni))}
            ${kpi('Correção + juros', fmtBRL(totalFinal - valor), `${fmtPct((totalFinal / valor - 1) * 100, 2)} em ${linhas.length} meses · ${periodos.length} regime(s)`)}
            ${multa ? kpi('Multa (art. 523, § 1º)', fmtBRL(multa), '10%') : ''}
            ${honor ? kpi('Honorários (art. 523, § 1º)', fmtBRL(honor), '10%') : ''}
            ${multaMora ? kpi('Multa moratória', fmtBRL(multaMora), `${fmtPct(pctMora, 2)} sobre a base corrigida`) : ''}
            ${kpi('Total em ' + fmtData(dFim), fmtBRL(totalFinal + multa + honor + multaMora), '', true)}
        </div>${avisos.map(a => `<div class="calc-aviso">${a}</div>`).join('')}</div>`;

        const periodosHtml = periodos.map(p => `<li><strong>Período ${p.idx} — ${mesLegivel(p.de)} a ${mesLegivel(p.ate)}:</strong> ${p.faixa.selicUnica ? 'SELIC acumulada (correção + juros)' : `correção ${NOME_SERIE[p.faixa.corr]} + juros ${descJurosFaixa(p.faixa)}`}. De ${fmtBRL(p.totalIni)} para ${fmtBRL(p.totalFim)}. <em>Base legal:</em> ${p.faixa.base}.</li>`).join('') + (R.dica ? `<li><strong>Observação sobre este regime:</strong> ${R.dica}</li>` : '');
        const tabela = `<div class="calc-memoria"><h3>Demonstrativo analítico</h3>
            <p><strong>Convenção:</strong> ${incluirIni ? 'o índice do mês da data inicial foi incluído' : 'a correção começa no mês seguinte à data inicial'}; juros simples calculados mês a mês sobre o principal corrigido e atualizados pelo mesmo índice.</p>
            <ol>${periodosHtml}</ol>
            <div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Mês</th><th>Per.</th><th>Correção (%)</th><th>Juros (%)</th><th>Base corrigida</th><th>Juros do regime</th><th>Total</th></tr></thead><tbody>
            ${linhas.map(l => `<tr><td>${mesLegivel(l.m)}</td><td>${l.idx}</td><td>${fmtNum(l.iCorr, 4)}</td><td>${l.tJuros == null ? '—' : fmtNum(l.tJuros, 4)}</td><td>${fmtBRL(l.principal)}</td><td>${fmtBRL(l.juros)}</td><td>${fmtBRL(l.total)}</td></tr>`).join('')}
            </tbody><tfoot><tr><td>Total</td><td></td><td></td><td></td><td>${fmtBRL(principalFinal)}</td><td>${fmtBRL(jurosFinal)}</td><td>${fmtBRL(totalFinal)}</td></tr></tfoot></table></div>
            <p class="calc-fonte">"Base corrigida" é o principal corrigido no regime em curso (nos períodos de SELIC única, a base consolidada — principal + juros — no início do período); "Juros do regime" são os juros acumulados dentro do regime em curso. Fonte dos índices: Banco Central — SGS (433, 188, 10764, 4390, 7811, 432), atualizados em ${ix.atualizado.split('-').reverse().join('/')}.</p></div>`;
        mostrar(out, html, tabela);
    }
    const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    /* ===================== 2. prazos processuais ===================== */
    function pascoa(ano) { // Meeus/Jones/Butcher
        const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        return new Date(ano, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
    }
    const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const chaveDia = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    function feriadosNacionais(ano) {
        const f = { '01/01': 'Confraternização Universal', '21/04': 'Tiradentes', '01/05': 'Dia do Trabalho', '07/09': 'Independência', '12/10': 'N. Sra. Aparecida', '02/11': 'Finados', '15/11': 'Proclamação da República', '20/11': 'Consciência Negra (Lei 14.759/2023)', '25/12': 'Natal' };
        const p = pascoa(ano);
        f[chaveDia(addDias(p, -48))] = 'Carnaval (segunda)';
        f[chaveDia(addDias(p, -47))] = 'Carnaval (terça)';
        f[chaveDia(addDias(p, -46))] = 'Quarta-feira de Cinzas (expediente forense suspenso)';
        f[chaveDia(addDias(p, -2))] = 'Sexta-feira Santa';
        f[chaveDia(addDias(p, 60))] = 'Corpus Christi';
        return f;
    }
    function feriadosExtras(txt) {
        const out = {};
        for (const linha of String(txt || '').split(/\n|;/)) {
            const m = linha.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:[-–:]\s*(.*))?$/);
            if (!m) continue;
            const ch = `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`;
            out[m[3] ? ch + '/' + m[3] : ch] = m[4] || 'feriado informado';
        }
        return out;
    }
    function motivoNaoUtil(d, extras, recesso) {
        if (d.getDay() === 0 || d.getDay() === 6) return d.getDay() === 0 ? 'domingo' : 'sábado';
        const ch = chaveDia(d), nac = feriadosNacionais(d.getFullYear());
        if (nac[ch]) return nac[ch];
        if (extras[ch + '/' + d.getFullYear()]) return extras[ch + '/' + d.getFullYear()];
        if (extras[ch]) return extras[ch];
        if (recesso && ((d.getMonth() === 11 && d.getDate() >= 20) || (d.getMonth() === 0 && d.getDate() <= 20))) return 'suspensão de 20/12 a 20/01 (art. 220 do CPC)';
        return null;
    }

    function calcPrazos(form, out) {
        const dEvento = parseData(form.dataEvento.value);
        let prazo = parseInt(form.prazo.value, 10);
        if (!dEvento) return erro(out, 'Informe a data do evento (publicação, intimação ou disponibilização).');
        if (!(prazo > 0)) return erro(out, 'Informe o prazo em dias.');
        const uteis = form.contagem.value === 'uteis';
        const recesso = form.recesso.checked;
        const extras = feriadosExtras(form.feriadosExtras.value);
        const dobro = form.dobro.checked;
        if (dobro) prazo *= 2;

        const passos = [];
        let publicacao = dEvento;
        if (form.evento.value === 'disponibilizacao') {
            // art. 224, § 2º: considera-se publicação o 1º dia útil seguinte à disponibilização
            publicacao = addDias(dEvento, 1);
            while (motivoNaoUtil(publicacao, extras, false)) publicacao = addDias(publicacao, 1);
            passos.push(`Disponibilização em ${fmtDataLonga(dEvento)} → publicação considerada em ${fmtDataLonga(publicacao)} (art. 224, § 2º).`);
        } else passos.push(`Publicação/intimação em ${fmtDataLonga(publicacao)}.`);
        // art. 224, § 3º / art. 231: o prazo começa a correr no 1º dia útil seguinte
        let inicio = addDias(publicacao, 1);
        while (motivoNaoUtil(inicio, extras, recesso)) inicio = addDias(inicio, 1);
        passos.push(`Termo inicial (1º dia útil seguinte, art. 224, § 3º): ${fmtDataLonga(inicio)}.`);

        const dias = []; let contados = 0, d = inicio, fim = null;
        while (contados < prazo) {
            const motivo = motivoNaoUtil(d, extras, recesso);
            if (uteis) {
                if (motivo) dias.push({ d, motivo, n: null }); else { contados++; dias.push({ d, motivo: null, n: contados }); }
            } else {
                // dias corridos: só a suspensão do art. 220 interrompe a contagem (se marcada)
                const susp = recesso && motivo && motivo.startsWith('suspensão');
                if (susp) dias.push({ d, motivo, n: null }); else { contados++; dias.push({ d, motivo: motivo ? motivo + ' (conta)' : null, n: contados }); }
            }
            if (contados === prazo) fim = d;
            d = addDias(d, 1);
            if (dias.length > 2000) break;
        }
        let fimAjust = fim, prorrogado = false;
        while (motivoNaoUtil(fimAjust, extras, recesso)) { fimAjust = addDias(fimAjust, 1); prorrogado = true; }
        if (prorrogado) passos.push(`O último dia (${fmtData(fim)}) não é dia útil → prorrogado para ${fmtDataLonga(fimAjust)} (art. 224, § 1º).`);

        const html = `<div class="calc-result-box"><h2>Resultado</h2><div class="calc-kpis">
            ${kpi('Termo inicial', fmtData(inicio), DIAS[inicio.getDay()])}
            ${kpi('Prazo', `${prazo} dias ${uteis ? 'úteis' : 'corridos'}`, dobro ? 'em dobro' : '')}
            ${kpi('Termo final', fmtData(fimAjust), DIAS[fimAjust.getDay()], true)}
        </div><div class="calc-aviso">Protocole até as 23h59 do termo final no horário do juízo (art. 213, parágrafo único). Confira o calendário de feriados e suspensões do tribunal: feriados locais e portarias não constam automaticamente.</div></div>`;
        const tabela = `<div class="calc-memoria"><h3>Memória de contagem</h3><ul>${passos.map(p => `<li>${p}</li>`).join('')}</ul>
            <div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Data</th><th>Dia</th><th>Contagem</th></tr></thead><tbody>
            ${dias.map(x => `<tr class="${x.n ? '' : 'nao-conta'}"><td>${fmtData(x.d)}</td><td style="text-align:left">${DIAS[x.d.getDay()]}</td><td style="text-align:left">${x.n ? `${x.n}º dia` : 'não conta — ' + x.motivo}${x.motivo && x.n ? ' · ' + x.motivo : ''}</td></tr>`).join('')}
            </tbody></table></div>
            <p class="calc-fonte">Base: CPC, arts. 212–235 (dias úteis: art. 219; termo inicial: arts. 224 e 231; prorrogação: art. 224, § 1º; suspensão de 20/12 a 20/01: art. 220). Feriados nacionais: Leis 662/49, 6.802/80, 9.093/95, 10.607/02 e 14.759/23; feriados móveis pela data da Páscoa.</p></div>`;
        mostrar(out, html, tabela);
    }

    /* ===================== 3. juros do contrato ===================== */
    function taxaPMT(pv, pmt, n, carencia) {
        // resolve i em pv = pmt * (1 - (1+i)^-n) / i * (1+i)^-carencia  (bisseção)
        const f = i => pmt * (1 - Math.pow(1 + i, -n)) / i * Math.pow(1 + i, -carencia) - pv;
        let lo = 1e-7, hi = 1.0;
        if (f(lo) < 0) return null; // parcelas não cobrem nem o principal
        for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
        return (lo + hi) / 2;
    }
    function calcJuros(form, out) {
        const pv = parseNum(form.valorFinanciado.value), pmt = parseNum(form.parcela.value), n = parseInt(form.parcelas.value, 10);
        const carencia = Math.max(parseInt(form.carencia.value || '0', 10), 0);
        const tarifas = parseNum(form.tarifas.value) || 0;
        const media = parseNum(form.taxaMedia.value);
        if (!(pv > 0) || !(pmt > 0) || !(n > 0)) return erro(out, 'Informe o valor financiado, o número de parcelas e o valor da parcela.');
        const i = taxaPMT(pv, pmt, n, carencia);
        if (i == null) return erro(out, 'As parcelas informadas não cobrem sequer o valor financiado — confira os dados.');
        const iAno = Math.pow(1 + i, 12) - 1;
        const totalPago = pmt * n, jurosTotal = totalPago - pv;
        let cet = null, cetAno = null;
        if (tarifas > 0 && tarifas < pv) { cet = taxaPMT(pv - tarifas, pmt, n, carencia); cetAno = cet ? Math.pow(1 + cet, 12) - 1 : null; }
        let comp = '';
        if (media > 0) {
            const razao = (i * 100) / media;
            comp = `<div class="calc-aviso"><strong>Comparação com a taxa média de mercado:</strong> a taxa do contrato (${fmtPct(i * 100, 2)} a.m.) equivale a <strong>${fmtNum(razao, 2)}×</strong> a média informada (${fmtPct(media, 2)} a.m.). ${razao >= 1.5 ? 'Taxa muito acima da média — indício relevante de abusividade segundo o critério do STJ (REsp 1.061.530/RS: taxa "substancialmente" superior à média de mercado), que exige análise do caso concreto.' : razao > 1.2 ? 'Taxa acima da média, mas não necessariamente abusiva: o STJ não fixa percentual; a jurisprudência costuma exigir discrepância substancial (muitos julgados usam 1,5× como referência).' : 'Taxa dentro ou próxima da média de mercado — por si só, não caracteriza abusividade.'}</div>`;
        }
        const html = `<div class="calc-result-box"><h2>Resultado</h2><div class="calc-kpis">
            ${kpi('Taxa efetiva mensal', fmtPct(i * 100, 2) + ' a.m.', 'juros compostos (Tabela Price)', true)}
            ${kpi('Taxa efetiva anual', fmtPct(iAno * 100, 2) + ' a.a.', '(1 + i)¹² − 1')}
            ${kpi('Total a pagar', fmtBRL(totalPago), `${n} × ${fmtBRL(pmt)}`)}
            ${kpi('Juros totais', fmtBRL(jurosTotal), `${fmtPct(jurosTotal / pv * 100, 1)} sobre o valor financiado`)}
            ${cet ? kpi('CET aproximado', fmtPct(cet * 100, 2) + ' a.m.', `${fmtPct(cetAno * 100, 2)} a.a., com ${fmtBRL(tarifas)} de tarifas/IOF`) : ''}
        </div>${comp}</div>`;
        const mem = `<div class="calc-memoria"><h3>Como foi calculado</h3>
            <p>A taxa mensal <em>i</em> é a que iguala o valor financiado (${fmtBRL(pv)}) ao valor presente das ${n} parcelas de ${fmtBRL(pmt)}${carencia ? `, com a 1ª parcela ${carencia + 1} mês(es) após a liberação` : ''}: <code>PV = PMT × [1 − (1+i)⁻ⁿ] / i${carencia ? ' × (1+i)⁻ᶜ' : ''}</code>. Resolvida numericamente (bisseção, precisão de 10⁻⁷).</p>
            ${cet ? `<p>O CET aproximado considera que você recebeu líquido ${fmtBRL(pv - tarifas)} (valor financiado menos tarifas/IOF) e pagou as mesmas parcelas. O CET oficial pode diferir por seguros, tributos e datas exatas.</p>` : ''}
            <p>Onde encontrar a taxa média: Banco Central → Estatísticas → <a href="https://www.bcb.gov.br/estatisticas/txjuros" target="_blank" rel="noopener">Taxas de juros por modalidade</a> (escolha a modalidade e o mês da contratação; use a coluna "% a.m.").</p>
            <p class="calc-fonte">Referências: CDC, arts. 6º, V, e 51, IV; STJ, REsp 1.061.530/RS (recurso repetitivo), Súmulas 382, 539 e 541; Lei 14.181/2021.</p></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== 4. honorários — Fazenda Pública ===================== */
    const FAIXAS = [
        { ate: 200, min: 10, max: 20, rotulo: 'até 200 SM' },
        { ate: 2000, min: 8, max: 10, rotulo: '200 a 2.000 SM' },
        { ate: 20000, min: 5, max: 8, rotulo: '2.000 a 20.000 SM' },
        { ate: 100000, min: 3, max: 5, rotulo: '20.000 a 100.000 SM' },
        { ate: Infinity, min: 1, max: 3, rotulo: 'acima de 100.000 SM' },
    ];
    function calcHonorarios(form, out) {
        const base = parseNum(form.base.value), sm = parseNum(form.salarioMinimo.value);
        if (!(base > 0)) return erro(out, 'Informe a base de cálculo (valor da condenação, do proveito econômico ou da causa).');
        if (!(sm > 0)) return erro(out, 'Informe o salário mínimo vigente.');
        const criterio = form.criterio.value;
        const pers = [1, 2, 3, 4, 5].map(k => parseNum(form['p' + k].value));
        let anterior = 0, total = 0; const linhas = [];
        FAIXAS.forEach((f, idx) => {
            const limite = f.ate === Infinity ? Infinity : f.ate * sm;
            const parcela = Math.max(Math.min(base, limite) - anterior, 0);
            if (parcela <= 0) return;
            let pct = criterio === 'min' ? f.min : criterio === 'max' ? f.max : criterio === 'medio' ? (f.min + f.max) / 2 : pers[idx];
            if (!(pct >= f.min && pct <= f.max)) pct = Math.min(Math.max(pct || f.min, f.min), f.max);
            const h = parcela * pct / 100; total += h;
            linhas.push({ f, parcela, pct, h });
            anterior = limite;
        });
        const cumular = form.cumular.checked;
        const html = `<div class="calc-result-box"><h2>Resultado</h2><div class="calc-kpis">
            ${kpi('Base de cálculo', fmtBRL(base), `${fmtNum(base / sm, 1)} salários mínimos`)}
            ${kpi('Honorários (art. 85, § 3º)', fmtBRL(total), `percentual efetivo ${fmtPct(total / base * 100, 3)}`, !cumular)}
            ${cumular ? kpi('Execução + embargos', fmtBRL(total * 2), 'duas verbas autônomas (art. 85, § 1º)', true) : ''}
        </div><div class="calc-aviso">Escalonamento aplicado faixa a faixa sobre a parte da base que recai em cada uma (art. 85, § 5º). O percentual dentro de cada faixa é fixado pelo juiz conforme o § 2º (grau de zelo, lugar, natureza e importância da causa, trabalho e tempo exigidos). Quando o valor é elevado, não cabe fixação por equidade (STJ, Tema 1.076).</div></div>`;
        const mem = `<div class="calc-memoria"><h3>Memória de cálculo</h3>
            <div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Faixa (art. 85, § 3º)</th><th>Limites em R$</th><th>Parcela da base</th><th>%</th><th>Honorários</th></tr></thead><tbody>
            ${linhas.map(l => `<tr><td>${l.f.rotulo} (${l.f.min}–${l.f.max}%)</td><td>${l.f.ate === Infinity ? 'acima de ' + fmtBRL(100000 * sm) : 'até ' + fmtBRL(l.f.ate * sm)}</td><td>${fmtBRL(l.parcela)}</td><td>${fmtNum(l.pct, 2)}</td><td>${fmtBRL(l.h)}</td></tr>`).join('')}
            </tbody><tfoot><tr><td>Total</td><td></td><td>${fmtBRL(base)}</td><td>${fmtNum(total / base * 100, 3)}</td><td>${fmtBRL(total)}</td></tr></tfoot></table></div>
            <p class="calc-fonte">Salário mínimo considerado: ${fmtBRL(sm)} (o § 4º, IV, manda usar o valor vigente na data da decisão). Fonte: CPC, art. 85, §§ 1º a 5º, 17 e 19; STJ, Temas 1.076 e 1.255.</p></div>`;
        mostrar(out, html, mem);
    }


    /* ===================== 5. prescrição e decadência ===================== */
    const PRAZOS = {
        geral:      { nome: 'Regra geral (pretensões sem prazo específico)', anos: 10, tipo: 'prescrição', base: 'art. 205 do Código Civil' },
        civil:      { nome: 'Reparação civil (danos materiais e morais)', anos: 3, tipo: 'prescrição', base: 'art. 206, § 3º, V, do CC — termo inicial: ciência inequívoca da lesão (Súmula 278/STJ; teoria da actio nata)' },
        enriq:      { nome: 'Ressarcimento de enriquecimento sem causa', anos: 3, tipo: 'prescrição', base: 'art. 206, § 3º, IV, do CC' },
        alugueis:   { nome: 'Aluguéis de prédios urbanos ou rústicos', anos: 3, tipo: 'prescrição', base: 'art. 206, § 3º, I, do CC' },
        divida:     { nome: 'Cobrança de dívida líquida em instrumento público ou particular', anos: 5, tipo: 'prescrição', base: 'art. 206, § 5º, I, do CC' },
        honorarios: { nome: 'Honorários de profissionais liberais (inclusive advogados)', anos: 5, tipo: 'prescrição', base: 'art. 206, § 5º, II, do CC; art. 25 da Lei 8.906/94' },
        seguro:     { nome: 'Segurado contra seguradora', anos: 1, tipo: 'prescrição', base: 'art. 206, § 1º, II, do CC — conta-se da ciência do fato gerador, suspensa entre o aviso do sinistro e a resposta (Súmulas 229 e 278/STJ)' },
        alimentos:  { nome: 'Prestações alimentares vencidas', anos: 2, tipo: 'prescrição', base: 'art. 206, § 2º, do CC — não corre contra absolutamente incapazes (art. 198, I)' },
        anulacao:   { nome: 'Anulação de negócio jurídico (erro, dolo, coação, lesão)', anos: 4, tipo: 'decadência', base: 'art. 178 do CC — da cessação da coação ou da celebração do negócio' },
        cdc_fato:   { nome: 'Consumidor — reparação por fato do produto ou serviço', anos: 5, tipo: 'prescrição', base: 'art. 27 do CDC — do conhecimento do dano e de sua autoria' },
        cdc_vicio_d:{ nome: 'Consumidor — vício aparente em produto/serviço durável', dias: 90, tipo: 'decadência', base: 'art. 26, II, do CDC — da entrega; vício oculto: do momento em que ficar evidenciado (§ 3º)' },
        cdc_vicio_n:{ nome: 'Consumidor — vício aparente em produto/serviço não durável', dias: 30, tipo: 'decadência', base: 'art. 26, I, do CDC' },
        rescisoria: { nome: 'Ação rescisória', anos: 2, tipo: 'decadência', base: 'art. 975 do CPC — do trânsito em julgado da última decisão do processo' },
        trab:       { nome: 'Trabalhista — créditos da relação de emprego', anos: 2, tipo: 'prescrição', base: 'art. 7º, XXIX, da CF e art. 11 da CLT — 2 anos da extinção do contrato para ajuizar, alcançando as parcelas dos 5 anos anteriores ao ajuizamento', trab: true },
        fgts:       { nome: 'FGTS — depósitos não efetuados', anos: 5, tipo: 'prescrição', base: 'STF, ARE 709.212 (Tema 608): 5 anos, observado o limite de 2 anos após a extinção do contrato' },
        prev_rev:   { nome: 'Previdenciário — revisão do ato de concessão do benefício', anos: 10, tipo: 'decadência', base: 'art. 103 da Lei 8.213/91 — do 1º dia do mês seguinte ao primeiro pagamento' },
        prev_parc:  { nome: 'Previdenciário — parcelas vencidas', anos: 5, tipo: 'prescrição', base: 'art. 103, parágrafo único, da Lei 8.213/91' },
        trib_lanc:  { nome: 'Tributário — constituição do crédito (lançamento)', anos: 5, tipo: 'decadência', base: 'art. 173, I, do CTN — do 1º dia do exercício seguinte ao que o lançamento poderia ter sido efetuado; tributos com pagamento antecipado: art. 150, § 4º (do fato gerador)', trib: true },
        trib_cob:   { nome: 'Tributário — cobrança do crédito (execução fiscal)', anos: 5, tipo: 'prescrição', base: 'art. 174 do CTN — da constituição definitiva do crédito' },
        fazenda:    { nome: 'Pretensões contra a Fazenda Pública', anos: 5, tipo: 'prescrição', base: 'art. 1º do Decreto 20.910/32 — inclusive para reparação civil (STJ, Tema 553)' },
        improb:     { nome: 'Improbidade administrativa', anos: 8, tipo: 'prescrição', base: 'art. 23 da Lei 8.429/92, na redação da Lei 14.230/2021 — da ocorrência do fato ou do último ato' },
        personalizado: { nome: 'Outro prazo (informar)', tipo: 'prescrição', base: 'prazo informado pelo usuário' },
    };
    const addAnos = (d, n) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); if (x.getDate() !== d.getDate()) x.setDate(0); return x; };
    const addMeses = (d, n) => { const x = new Date(d); const dia = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(dia, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
    const diasEntre = (a, b) => Math.round((b - a) / 86400000);
    function calcPrescricao(form, out) {
        const P = PRAZOS[form.pretensao.value];
        const dIni = parseData(form.dataInicial.value);
        if (!dIni) return erro(out, 'Informe a data do termo inicial (violação do direito, ciência da lesão, vencimento etc.).');
        let anos = P.anos || 0, meses = 0, dias = P.dias || 0;
        if (form.pretensao.value === 'personalizado') { anos = parseInt(form.pAnos.value || 0, 10); meses = parseInt(form.pMeses.value || 0, 10); dias = parseInt(form.pDias.value || 0, 10); if (!(anos + meses + dias > 0)) return erro(out, 'Informe o prazo (anos, meses e/ou dias).'); }
        const passos = [];
        let inicio = dIni;
        passos.push(`Termo inicial: ${fmtDataLonga(dIni)} — ${P.base}.`);
        if (P.trib && form.pretensao.value === 'trib_lanc') { inicio = new Date(dIni.getFullYear() + 1, 0, 1); passos.push(`Regra do art. 173, I, do CTN: a contagem começa em 1º de janeiro do exercício seguinte — ${fmtDataLonga(inicio)}.`); }
        // interrupção (uma única vez — art. 202 do CC)
        const dInt = parseData(form.interrupcao.value);
        if (dInt && dInt > inicio) { inicio = dInt; passos.push(`Interrupção em ${fmtDataLonga(dInt)} (art. 202 do CC — só uma vez; pela citação, retroage à data da propositura da ação, art. 240, § 1º, do CPC): o prazo recomeça por inteiro.`); }
        const fim0 = addAnos(addMeses(inicio, meses), anos); fim0.setDate(fim0.getDate() + dias);
        // suspensão
        let fim = fim0; const sIni = parseData(form.suspIni.value), sFim = parseData(form.suspFim.value);
        if (sIni && sFim && sFim > sIni && sIni < fim0) { const n = diasEntre(sIni, sFim); fim = new Date(fim0); fim.setDate(fim.getDate() + n); passos.push(`Suspensão de ${fmtData(sIni)} a ${fmtData(sFim)} (${n} dias — arts. 197 a 201 do CC; o prazo retoma de onde parou): termo final deslocado para ${fmtData(fim)}.`); }
        // prorrogação para dia útil (art. 132, § 1º, do CC)
        let fimUtil = fim, prorrog = false; while (motivoNaoUtil(fimUtil, {}, false)) { fimUtil = addDias(fimUtil, 1); prorrog = true; }
        if (prorrog) passos.push(`O último dia (${fmtData(fim)}) não é útil — prorrogado para ${fmtDataLonga(fimUtil)} (art. 132, § 1º, do CC).`);
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const restam = diasEntre(hoje, fimUtil);
        let situacao, cor;
        if (restam < 0) { situacao = `${P.tipo === 'decadência' ? 'Decaído' : 'Prescrito'} há ${Math.abs(restam)} dias`; cor = '#d95c5c'; }
        else if (restam <= 90) { situacao = `Vence em ${restam} dias — URGENTE`; cor = '#e0c46a'; }
        else situacao = `Faltam ${restam} dias (${fmtNum(restam / 365.25, 1)} anos)`;
        let extra = '';
        if (P.trab) { const dAj = parseData(form.ajuizamento.value); if (dAj) { const lim5 = addAnos(dAj, -5); extra = `<div class="calc-aviso">Prescrição quinquenal: ajuizando em ${fmtData(dAj)}, são exigíveis apenas as parcelas vencidas a partir de ${fmtDataLonga(lim5)} (art. 7º, XXIX, da CF).</div>`; } }
        const html = `<div class="calc-result-box"><h2>Resultado — ${P.tipo}</h2><div class="calc-kpis">
            ${kpi('Prazo', `${anos ? anos + ' ano(s)' : ''}${meses ? ' ' + meses + ' mês(es)' : ''}${dias ? ' ' + dias + ' dia(s)' : ''}`, P.tipo)}
            ${kpi('Termo inicial considerado', fmtData(inicio), DIAS[inicio.getDay()])}
            ${kpi('Termo final', fmtData(fimUtil), DIAS[fimUtil.getDay()], true)}
            <div class="calc-kpi"><span>Situação hoje</span><strong style="color:${cor || 'var(--off-white)'}">${situacao}</strong></div>
        </div>${extra}<div class="calc-aviso">${P.tipo === 'decadência' ? 'Prazo decadencial: em regra não se suspende nem se interrompe (art. 207 do CC), salvo disposição legal — o campo de interrupção deve ser usado com cautela.' : 'Prescrição: pode ser interrompida uma única vez (art. 202) e suspensa nas hipóteses dos arts. 197 a 201 do CC; não corre contra absolutamente incapazes. Confira a data da ciência inequívoca da lesão (actio nata).'}</div></div>`;
        const mem = `<div class="calc-memoria"><h3>Memória de contagem</h3><ul>${passos.map(p => `<li>${p}</li>`).join('')}</ul>
            <p class="calc-fonte">Contagem em anos/meses pelo dia de igual número (art. 132, § 3º, do CC); dias corridos. Fundamentos: ${P.base}. Esta ferramenta não substitui a análise do caso: marcos interruptivos, suspensões e teses sobre o termo inicial variam conforme a matéria.</p></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== 6. reajuste de aluguel ===================== */
    async function calcAluguel(form, out) {
        const aluguel = parseNum(form.aluguel.value); const dBase = parseData(form.dataBase.value);
        if (!(aluguel > 0) || !dBase) return erro(out, 'Informe o aluguel atual e a data-base (início do contrato ou último reajuste).');
        let ix; try { ix = await carregarIndices(); } catch { return erro(out, 'Não foi possível carregar os índices.'); }
        const chave = form.indice.value, serie = ix.series[chave];
        if (!serie) return erro(out, `A série ${chave.toUpperCase()} ainda não está disponível.`);
        const periodicidade = parseInt(form.periodicidade.value, 10) || 12;
        // convenção de mercado: acumulado dos 12 meses anteriores ao mês do reajuste (mês da data-base até o mês anterior ao aniversário)
        const mIni = chaveMes(dBase); const linhas = []; let fator = 1, m = mIni, faltando = null;
        for (let k = 0; k < periodicidade; k++) { const v = serie[m]; if (v == null) { faltando = m; break; } fator *= (1 + v / 100); linhas.push({ m, v, fator }); m = proxMes(m); }
        const dReaj = addMeses(dBase, periodicidade);
        const novo = aluguel * fator; const var_ = (fator - 1) * 100;
        const negativo = form.semReducao.checked && fator < 1;
        const html = `<div class="calc-result-box"><h2>Resultado</h2><div class="calc-kpis">
            ${kpi('Aluguel atual', fmtBRL(aluguel), `data-base ${fmtData(dBase)}`)}
            ${kpi(`${chave.toUpperCase().replace('IGPM', 'IGP-M')} acumulado`, fmtPct(var_, 2), `${linhas.length} de ${periodicidade} meses`)}
            ${kpi('Novo aluguel a partir de ' + fmtData(dReaj), fmtBRL(negativo ? aluguel : novo), negativo ? 'mantido (cláusula de não redução)' : '', true)}
        </div>${faltando ? `<div class="calc-aviso">O índice de ${mesLegivel(faltando)} ainda não foi divulgado — o acumulado está parcial. Refaça o cálculo após a divulgação (IGP-M: fim do mês; IPCA/INPC: por volta do dia 10 do mês seguinte).</div>` : ''}
            ${fator < 1 ? '<div class="calc-aviso">Índice acumulado negativo: salvo cláusula expressa em contrário, o reajuste pode reduzir o aluguel; muitos contratos preveem a manutenção do valor.</div>' : ''}</div>`;
        const mem = `<div class="calc-memoria"><h3>Memória de cálculo</h3><p>Convenção: índice acumulado dos ${periodicidade} meses anteriores ao mês do reajuste (de ${mesLegivel(mIni)} a ${mesLegivel(linhas.length ? linhas[linhas.length - 1].m : mIni)}), aplicado ao aluguel vigente. Fator = produto de (1 + variação mensal).</p>
            <div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Mês</th><th>Variação (%)</th><th>Fator acumulado</th></tr></thead><tbody>${linhas.map(l => `<tr><td>${mesLegivel(l.m)}</td><td>${fmtNum(l.v, 2)}</td><td>${fmtNum(l.fator, 6)}</td></tr>`).join('')}</tbody></table></div>
            <p class="calc-fonte">Base: Lei 8.245/91, arts. 17 e 18 (livre convenção do aluguel e do índice); Lei 10.192/2001, art. 2º, § 1º (periodicidade mínima anual); Lei 9.069/95, art. 28. Fonte dos índices: Banco Central — SGS.</p></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== 7. RPV ou precatório ===================== */
    const TETO_RGPS_2026 = 8475.00; // piso da RPV estadual/municipal (art. 100, § 4º, CF) — atualize anualmente
    async function calcRPV(form, out) {
        const valor = parseNum(form.valor.value); const credores = Math.max(parseInt(form.credores.value || '1', 10), 1);
        if (!(valor > 0)) return erro(out, 'Informe o valor atualizado do crédito.');
        let sm = parseNum(form.salarioMinimo.value);
        if (!(sm > 0)) { try { const ix = await carregarIndices(); const s = ix.series.salario_minimo; sm = s[ultimoMes(s)]; } catch { } }
        if (!(sm > 0)) return erro(out, 'Informe o salário mínimo vigente.');
        const ente = form.ente.value;
        let limiteSM = ente === 'uniao' ? 60 : ente === 'estado' ? 40 : 30, base = ente === 'uniao' ? 'art. 17, § 1º, da Lei 10.259/2001 (60 salários mínimos)' : ente === 'estado' ? 'art. 87, I, do ADCT (40 salários mínimos, na falta de lei estadual própria)' : 'art. 87, II, do ADCT (30 salários mínimos, na falta de lei municipal própria)';
        const prop = parseNum(form.limiteProprio.value);
        if (ente !== 'uniao' && prop > 0) { limiteSM = prop; base = `limite fixado em lei própria do ente: ${fmtNum(prop, 2)} salários mínimos (art. 100, § 4º, da CF — não pode ser inferior ao maior benefício do RGPS)`; }
        let limite = limiteSM * sm;
        let avisoPiso = '';
        if (ente !== 'uniao' && limite < TETO_RGPS_2026) { avisoPiso = `<div class="calc-aviso">O limite informado (${fmtBRL(limite)}) é inferior ao maior benefício do RGPS (${fmtBRL(TETO_RGPS_2026)}, referência 2026) — o piso constitucional prevalece (art. 100, § 4º, da CF).</div>`; limite = TETO_RGPS_2026; }
        const porCredor = valor / credores;
        const alimentar = form.alimentar.checked, prioridade = form.prioridade.checked;
        const rpv = porCredor <= limite;
        const superpref = alimentar && prioridade ? Math.min(porCredor, 3 * limite) : 0;
        const html = `<div class="calc-result-box"><h2>Resultado</h2><div class="calc-kpis">
            ${kpi('Valor por credor', fmtBRL(porCredor), credores > 1 ? `${credores} credores (cada um é considerado individualmente — art. 100, § 8º, CF)` : '')}
            ${kpi('Limite da RPV', fmtBRL(limite), `${fmtNum(limiteSM, 0)} SM × ${fmtBRL(sm)}`)}
            ${kpi('Forma de pagamento', rpv ? 'RPV' : 'Precatório', rpv ? 'requisição de pequeno valor' : 'ordem cronológica', true)}
        </div>${avisoPiso}
        <div class="calc-aviso">${rpv ? 'RPV: pagamento em até 60 dias da entrega da requisição (art. 535, § 3º, II, do CPC; art. 17 da Lei 10.259/2001). O credor pode renunciar ao excedente para receber por RPV (art. 87, parágrafo único, do ADCT; art. 100, § 3º).' : 'Precatório: apresentado até 2 de abril, entra no orçamento do exercício seguinte, com pagamento até o seu final (art. 100, § 5º, da CF, EC 114/2021). Não cabe fracionar o crédito para receber parte por RPV (art. 100, § 8º).'}
        ${!rpv && alimentar ? `<br><br>Crédito <strong>alimentar</strong>: preferência sobre os comuns (art. 100, § 1º).${prioridade ? ` Credor idoso (60+), pessoa com deficiência ou portador de doença grave: <strong>superpreferência</strong> até ${fmtBRL(3 * limite)} (3 × RPV — art. 100, § 2º), isto é, ${fmtBRL(superpref)} deste crédito; o restante segue a ordem alimentar.` : ' Marque a opção de prioridade se o credor tiver 60 anos ou mais, deficiência ou doença grave (art. 100, § 2º).'}` : ''}
        ${!rpv && !alimentar ? '<br><br>Crédito comum: ordem cronológica geral. Honorários sucumbenciais e contratuais destacados são créditos alimentares autônomos do advogado (SV 47; art. 85, § 14, do CPC) e podem ser requisitados separadamente.' : ''}</div></div>`;
        const mem = `<div class="calc-memoria"><h3>Fundamentos</h3><ul><li>Limite aplicado: ${base}.</li><li>Salário mínimo considerado: ${fmtBRL(sm)}.</li><li>Litisconsortes: o limite é verificado por credor (art. 100, § 8º, da CF; STF, Tema 148).</li><li>União: 60 SM (Lei 10.259/2001). Estados, DF e Municípios: valor de lei própria, nunca inferior ao maior benefício do RGPS (art. 100, § 4º); na falta de lei, 40 e 30 SM (art. 87 do ADCT). <strong>Confira a lei do ente</strong> — vários Estados e Municípios fixam limites menores.</li></ul></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== 8. execução: parcelamento (art. 916) e purgação da mora ===================== */
    function calcExecucao(form, out) {
        const sub = form.subtipo.value;
        if (sub === 'parcelamento') {
            const divida = parseNum(form.divida.value); if (!(divida > 0)) return erro(out, 'Informe o valor da execução (principal atualizado).');
            const custas = parseNum(form.custas.value) || 0; const honor = parseNum(form.honorarios.value) || 0;
            const total = divida + custas + honor; const entrada = total * 0.30; const saldo = total - entrada;
            const parcelaBase = saldo / 6; const linhas = [];
            for (let k = 1; k <= 6; k++) { const juros = parcelaBase * 0.01 * k; linhas.push({ k, base: parcelaBase, juros, total: parcelaBase + juros }); }
            const somaJuros = linhas.reduce((a, l) => a + l.juros, 0);
            const html = `<div class="calc-result-box"><h2>Resultado — parcelamento do art. 916 do CPC</h2><div class="calc-kpis">
                ${kpi('Base (dívida + custas + honorários)', fmtBRL(total), '')}
                ${kpi('Depósito inicial (30%)', fmtBRL(entrada), 'no prazo de 15 dias para embargos', true)}
                ${kpi('6 parcelas mensais', `${fmtBRL(linhas[0].total)} a ${fmtBRL(linhas[5].total)}`, `+ correção monetária; juros de 1% a.m. (${fmtBRL(somaJuros)} no total)`)}
            </div><div class="calc-aviso">Requisitos: reconhecer o crédito e depositar 30% (incluindo custas e honorários) no prazo dos embargos; o juiz ouve o exequente em 5 dias; enquanto não decidir, o executado deve depositar as parcelas vencidas (art. 916, §§ 1º e 2º). O pedido implica renúncia aos embargos (§ 6º) e não cabe no cumprimento de sentença (§ 7º). O não pagamento de qualquer parcela gera vencimento antecipado e multa de 10% sobre as restantes (§ 5º).</div></div>`;
            const mem = `<div class="calc-memoria"><h3>Parcelas</h3><div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Parcela</th><th>Valor-base</th><th>Juros 1% a.m. (acumulado)</th><th>Total (antes da correção)</th></tr></thead><tbody>${linhas.map(l => `<tr><td>${l.k}ª</td><td>${fmtBRL(l.base)}</td><td>${fmtBRL(l.juros)}</td><td>${fmtBRL(l.total)}</td></tr>`).join('')}</tbody></table></div>
                <p class="calc-fonte">Juros simples de 1% a.m. sobre cada parcela, contados do depósito inicial. A correção monetária incide pelo índice adotado pelo juízo (use a calculadora de correção monetária no vencimento de cada parcela). Base: art. 916 do CPC.</p></div>`;
            return mostrar(out, html, mem);
        }
        // purgação da mora — busca e apreensão (DL 911/69)
        const nV = parseInt(form.nVencidas.value || '0', 10), vV = parseNum(form.vVencidas.value) || 0;
        const nF = parseInt(form.nVincendas.value || '0', 10), vF = parseNum(form.vVincendas.value) || 0;
        const encargos = parseNum(form.encargos.value) || 0;
        if (!(nV > 0 && vV > 0)) return erro(out, 'Informe as parcelas vencidas (quantidade e valor).');
        const vencidas = nV * vV, vincendas = nF * vF, total = vencidas + vincendas + encargos;
        const html = `<div class="calc-result-box"><h2>Resultado — purgação da mora (DL 911/69)</h2><div class="calc-kpis">
            ${kpi('Parcelas vencidas', fmtBRL(vencidas), `${nV} × ${fmtBRL(vV)}`)}
            ${kpi('Parcelas vincendas', fmtBRL(vincendas), `${nF} × ${fmtBRL(vF)}`)}
            ${kpi('Encargos e custas', fmtBRL(encargos), '')}
            ${kpi('Total a pagar em 5 dias', fmtBRL(total), 'integralidade da dívida', true)}
        </div><div class="calc-aviso">Após a execução da liminar, o devedor tem 5 dias para pagar a <strong>integralidade da dívida pendente</strong> — vencidas e vincendas — segundo os valores do contrato (art. 3º, § 2º, do DL 911/69, na redação da Lei 10.931/2004; STJ, Tema 722). Pagar só as parcelas vencidas não restitui o bem. Os encargos contratuais podem ser discutidos em ação própria (revisional), sem obstar a consolidação da propriedade.</div></div>`;
        const mem = `<div class="calc-memoria"><h3>Fundamentos</h3><ul><li>DL 911/69, art. 3º, §§ 1º a 3º: consolidação da propriedade em 5 dias; pagamento integral restitui o bem livre de ônus.</li><li>STJ, REsp 1.418.593/MS (Tema 722): exige-se a quitação de todas as parcelas, vencidas e vincendas.</li><li>Notificação prévia válida é requisito da ação (Súmula 72/STJ; STJ, Tema 1.132: basta o envio ao endereço do contrato).</li><li>Veja também o artigo sobre <a href="/artigos/busca-e-apreensao-veiculo-defesa.html">defesa em busca e apreensão</a>.</li></ul></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== 9. partilha e meação ===================== */
    function calcPartilha(form, out) {
        const regime = form.regime.value, comuns = parseNum(form.bensComuns.value) || 0, partic = parseNum(form.bensParticulares.value) || 0;
        const conjuge = form.conjuge.checked; const nDesc = parseInt(form.descendentes.value || '0', 10); const comunsTodos = form.descComuns.checked;
        const asc = form.ascendentes.value; // nenhum | dois | um
        const disp = parseNum(form.testamento.value) || 0; // % da parte disponível destinada a terceiros
        if (!(comuns + partic > 0)) return erro(out, 'Informe o valor dos bens (comuns e/ou particulares).');
        const passos = []; let meacao = 0;
        // meação
        if (conjuge) {
            if (regime === 'parcial') { meacao = comuns / 2; passos.push(`Comunhão parcial: o cônjuge/companheiro sobrevivente tem meação de metade dos bens comuns (adquiridos onerosamente na constância) — ${fmtBRL(meacao)} (arts. 1.658 a 1.660 do CC). Bens particulares não entram na meação.`); }
            else if (regime === 'universal') { meacao = (comuns + partic) / 2; passos.push(`Comunhão universal: meação de metade de todo o patrimônio — ${fmtBRL(meacao)} (art. 1.667 do CC).`); }
            else passos.push(`Separação de bens (${regime === 'obrigatoria' ? 'obrigatória — art. 1.641' : 'convencional — art. 1.687'}): não há meação. Na separação obrigatória, bens adquiridos onerosamente na constância comunicam-se (Súmula 377/STF; STJ: exige prova do esforço comum).`);
        }
        const heranca = comuns + partic - meacao;
        passos.push(`Herança (patrimônio do falecido após a meação): ${fmtBRL(heranca)}.`);
        let legitima = heranca, legado = 0;
        if (disp > 0) { legado = Math.min(heranca / 2, heranca * disp / 100); legitima = heranca - legado; passos.push(`Testamento: ${fmtBRL(legado)} destinados a terceiros (limite de metade — parte disponível, art. 1.846); legítima dos herdeiros necessários: ${fmtBRL(legitima)}.`); }
        const quotas = [];
        if (nDesc > 0) {
            // concorrência do cônjuge com descendentes — art. 1.829, I
            let concorre = false, baseConc = 0;
            if (conjuge) {
                if (regime === 'parcial') { concorre = partic > 0; baseConc = partic * (legitima / heranca); if (concorre) passos.push('Comunhão parcial: o cônjuge concorre com os descendentes apenas sobre os bens particulares do falecido (art. 1.829, I; STJ, REsp 1.368.123).'); else passos.push('Comunhão parcial sem bens particulares: o cônjuge fica só com a meação e não concorre com os descendentes (art. 1.829, I).'); }
                else if (regime === 'convencional') { concorre = true; baseConc = legitima; passos.push('Separação convencional: o cônjuge concorre com os descendentes sobre toda a herança (STJ, REsp 1.382.170).'); }
                else passos.push(regime === 'universal' ? 'Comunhão universal: o cônjuge não concorre com os descendentes (fica com a meação) — art. 1.829, I.' : 'Separação obrigatória: o cônjuge não concorre com os descendentes — art. 1.829, I.');
            }
            let quotaConj = 0;
            if (concorre) {
                const n = nDesc + 1; let q = baseConc / n;
                if (comunsTodos && q < baseConc / 4) { q = baseConc / 4; passos.push('Reserva da quarta parte: sendo o cônjuge ascendente de todos os descendentes, sua quota não pode ser inferior a 1/4 da parte em que concorre (art. 1.832).'); }
                quotaConj = q;
            }
            const restoDesc = legitima - quotaConj; const porDesc = restoDesc / nDesc;
            if (conjuge) quotas.push({ quem: 'Cônjuge/companheiro', valor: meacao + quotaConj, det: `meação ${fmtBRL(meacao)} + quota hereditária ${fmtBRL(quotaConj)}` });
            for (let i = 1; i <= nDesc; i++) quotas.push({ quem: `Descendente ${i}`, valor: porDesc, det: 'quota igual (art. 1.834/1.835 — por cabeça; representação por estirpe se houver)' });
        } else if (asc !== 'nenhum') {
            let quotaConj = 0;
            if (conjuge) { quotaConj = asc === 'dois' ? legitima / 3 : legitima / 2; passos.push(`Sem descendentes, o cônjuge concorre com os ascendentes em qualquer regime: ${asc === 'dois' ? '1/3 (pai e mãe vivos)' : '1/2 (um só ascendente ou grau maior)'} — art. 1.837.`); }
            const restoAsc = legitima - quotaConj;
            if (conjuge) quotas.push({ quem: 'Cônjuge/companheiro', valor: meacao + quotaConj, det: `meação ${fmtBRL(meacao)} + quota ${fmtBRL(quotaConj)}` });
            if (asc === 'dois') { quotas.push({ quem: 'Pai', valor: restoAsc / 2, det: 'linha paterna' }); quotas.push({ quem: 'Mãe', valor: restoAsc / 2, det: 'linha materna' }); }
            else quotas.push({ quem: 'Ascendente', valor: restoAsc, det: 'art. 1.836' });
        } else if (conjuge) { quotas.push({ quem: 'Cônjuge/companheiro', valor: meacao + legitima, det: `meação ${fmtBRL(meacao)} + herança integral (art. 1.838)` }); passos.push('Sem descendentes nem ascendentes, a herança é toda do cônjuge/companheiro (art. 1.838; STF, Tema 809 — união estável equiparada).'); }
        else { quotas.push({ quem: 'Colaterais até 4º grau (ou Município)', valor: legitima, det: 'arts. 1.839 a 1.844' }); passos.push('Sem cônjuge, descendentes ou ascendentes: herdam os colaterais até o 4º grau; na falta, herança jacente/vacante.'); }
        if (legado > 0) quotas.push({ quem: 'Legatários/herdeiros testamentários', valor: legado, det: 'parte disponível (art. 1.846)' });
        const html = `<div class="calc-result-box"><h2>Resultado — divisão legal</h2><div class="calc-kpis">
            ${kpi('Patrimônio total', fmtBRL(comuns + partic), `comuns ${fmtBRL(comuns)} · particulares ${fmtBRL(partic)}`)}
            ${kpi('Meação', fmtBRL(meacao), 'não é herança — não paga ITCMD')}
            ${kpi('Herança', fmtBRL(heranca), 'base do inventário', true)}
        </div><div class="calc-aviso">Simulação da sucessão legítima pelo Código Civil (arts. 1.829 a 1.847), sem dívidas do espólio, colação de doações, direito real de habitação (art. 1.831) ou cláusulas testamentárias específicas. Companheiro em união estável tem os mesmos direitos (STF, Tema 809). Confira o regime no registro do casamento/escritura.</div></div>`;
        const mem = `<div class="calc-memoria"><h3>Quinhões</h3><div class="calc-table-wrap"><table class="calc-table"><thead><tr><th>Beneficiário</th><th>Valor</th><th>%</th><th style="text-align:left">Composição</th></tr></thead><tbody>${quotas.map(q => `<tr><td style="text-align:left">${q.quem}</td><td>${fmtBRL(q.valor)}</td><td>${fmtNum(q.valor / (comuns + partic) * 100, 2)}</td><td style="text-align:left;white-space:normal">${q.det}</td></tr>`).join('')}</tbody></table></div>
            <h3 style="margin-top:18px">Memória</h3><ul>${passos.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== 10. cartão de crédito e superendividamento ===================== */
    function calcCartao(form, out) {
        const sub = form.subtipo.value;
        if (sub === 'teto') {
            const original = parseNum(form.original.value), cobrado = parseNum(form.cobrado.value);
            if (!(original > 0) || !(cobrado > 0)) return erro(out, 'Informe o valor original da dívida e o valor cobrado hoje.');
            const teto = original * 2; const excesso = Math.max(cobrado - teto, 0);
            const html = `<div class="calc-result-box"><h2>Resultado — teto de encargos do cartão</h2><div class="calc-kpis">
                ${kpi('Dívida original', fmtBRL(original), 'valor que entrou no rotativo/parcelamento')}
                ${kpi('Teto legal (100% de encargos)', fmtBRL(teto), 'original + juros e encargos limitados ao próprio valor')}
                ${kpi('Valor cobrado', fmtBRL(cobrado), '')}
                ${kpi(excesso > 0 ? 'Excesso cobrado' : 'Dentro do teto', excesso > 0 ? fmtBRL(excesso) : 'sim', '', true)}
            </div><div class="calc-aviso">Lei 14.690/2023, art. 28: para dívidas de cartão e instrumentos pós-pagos, o total de juros e encargos cobrados não pode exceder o valor original da dívida (regra aplicável às dívidas contraídas a partir de 03/01/2024, conforme regulamentação do CMN — Resolução 5.112/2023). Dívidas anteriores seguem o regime antigo; verifique a data em que o saldo entrou no rotativo.</div></div>`;
            return mostrar(out, html, '');
        }
        const renda = parseNum(form.renda.value), dividas = parseNum(form.dividas.value), parcelas = parseNum(form.parcelasAtuais.value) || 0;
        const minimo = parseNum(form.minimoExistencial.value) || 600;
        if (!(renda > 0) || !(dividas > 0)) return erro(out, 'Informe a renda mensal líquida e o total das dívidas de consumo.');
        const capacidade = Math.max(renda - minimo, 0); const comprometimento = parcelas / renda * 100;
        const prazo = capacidade > 0 ? Math.ceil(dividas / capacidade) : Infinity;
        const cabe60 = prazo <= 60;
        const html = `<div class="calc-result-box"><h2>Resultado — superendividamento (Lei 14.181/2021)</h2><div class="calc-kpis">
            ${kpi('Renda líquida', fmtBRL(renda), `parcelas atuais comprometem ${fmtPct(comprometimento, 1)}`)}
            ${kpi('Mínimo existencial preservado', fmtBRL(minimo), 'Decreto 11.150/2022, art. 3º')}
            ${kpi('Capacidade mensal de pagamento', fmtBRL(capacidade), 'renda − mínimo existencial')}
            ${kpi('Prazo para quitar', prazo === Infinity ? 'inviável' : `${prazo} meses`, cabe60 ? 'cabe no plano de até 5 anos' : 'excede 5 anos — exige redução/renegociação', true)}
        </div><div class="calc-aviso">${comprometimento > 30 || !cabe60 ? 'Indícios de superendividamento (art. 54-A, § 1º, do CDC): o consumidor pode requerer a <strong>repactuação global</strong> com audiência conciliatória com todos os credores (art. 104-A), plano de pagamento de até 5 anos preservando o mínimo existencial; recusa injustificada do credor permite o plano compulsório (art. 104-B).' : 'Pelos dados, o endividamento parece administrável; ainda assim, o CDC garante o direito ao crédito responsável e à revisão de contratos com encargos abusivos.'} Dívidas com garantia real, financiamentos imobiliários e crédito rural ficam fora do procedimento (art. 104-A, § 1º).</div></div>`;
        const mem = `<div class="calc-memoria"><h3>Fundamentos</h3><ul><li>Lei 14.181/2021 (CDC, arts. 54-A a 54-G e 104-A a 104-C): prevenção e tratamento do superendividamento.</li><li>Decreto 11.150/2022: mínimo existencial de R$ 600,00 (valor que o plano não pode comprometer); o percentual de 25% da renda citado no Decreto refere-se à vedação de novas contratações.</li><li>Plano de pagamento: até 5 anos (art. 104-A, § 4º, II), com a primeira parcela em até 180 dias.</li><li>Veja a página de <a href="/direito-bancario.html">Direito Bancário</a>.</li></ul></div>`;
        mostrar(out, html, mem);
    }

    /* ===================== inicialização ===================== */
    document.addEventListener('DOMContentLoaded', () => {
        const form = $('form[data-calc]'); if (!form) return;
        const tipo = form.dataset.calc, out = $('#resultado');
        const info = $('#info-indices'); if (info) infoIndices(info);
        // datas padrão
        form.querySelectorAll('input[type="date"][data-hoje]').forEach(i => { if (!i.value) i.value = isoHoje(); });
        // salário mínimo pré-preenchido
        const smEl = form.elements.salarioMinimo;
        if (smEl) {
            smEl.placeholder = 'ex.: 1.621,00';
            carregarIndices().then(ix => {
                const s = ix.series.salario_minimo; const h = $('#sm-hint');
                if (!s || !Object.keys(s).length) { if (h) h.textContent = 'Informe o salário mínimo vigente na data da decisão (art. 85, § 4º, IV).'; return; }
                const u = ultimoMes(s); if (!smEl.value) smEl.value = fmtNum(s[u], 2);
                if (h) h.textContent = `Valor vigente segundo o Banco Central (${mesLegivel(u)}): ${fmtBRL(s[u])}. Edite se a decisão usar outro.`;
            }).catch(() => {});
        }
        // campos condicionais
        const liga = (sel, fn) => { const el = form.querySelector(sel); if (el) { el.addEventListener('change', fn); fn(); } };
        liga('[name="juros"]', () => { const v = form.juros.value; const t = $('#grupo-juros-taxa'); if (t) t.style.display = ['personalizado', 'compostoM', 'anual'].includes(v) ? '' : 'none'; const ini = $('#grupo-juros-inicio'); if (ini) ini.style.display = v === 'nenhum' ? 'none' : ''; });
        const ajustaJuros = () => { const g = $('#grupo-juros'); if (!g) return; const auto = form.modo && form.modo.value === 'auto'; g.style.display = (auto || form.indice.value === 'selic') ? 'none' : ''; };
        liga('[name="indice"]', ajustaJuros);
        liga('[name="modo"]', () => { const auto = form.modo.value === 'auto'; const ga = $('#grupo-auto'), gm = $('#grupo-manual'); if (ga) ga.style.display = auto ? '' : 'none'; if (gm) gm.style.display = auto ? 'none' : ''; ajustaJuros(); });
        liga('[name="natureza"]', () => {
            const R = REGIMES[form.natureza.value]; if (!R) return;
            const ga = $('#grupo-ajuizamento'); if (ga) ga.style.display = R.precisaAjuizamento ? '' : 'none';
            const h = $('#natureza-hint'); if (h) h.innerHTML = (R.dica ? R.dica + '<br>' : '') + (R.precisaAjuizamento
                ? 'Fase pré-judicial: IPCA-E + TR; do ajuizamento até ago/2024: SELIC; depois: IPCA + taxa legal.'
                : R.faixas.map((f, i) => `${i ? ' → ' : ''}${f.ate ? 'até ' + mesLegivel(f.ate) : 'desde então'}: ${f.selicUnica ? 'SELIC única' : NOME_SERIE[f.corr] + (f.juros == null ? ', sem juros' : ' + juros ' + descJurosFaixa(f) + (f.composto ? ' (capitalizados)' : ''))}`).join(''));
        });
        liga('[name="pretensao"]', () => { const v = form.pretensao.value; const P = PRAZOS[v]; const gp = $('#grupo-personalizado'); if (gp) gp.style.display = v === 'personalizado' ? '' : 'none'; const ga = $('#grupo-ajuizamento'); if (ga) ga.style.display = P && P.trab ? '' : 'none'; const h = $('#pretensao-hint'); if (h && P) h.textContent = `${P.tipo}: ${P.anos ? P.anos + ' ano(s)' : P.dias ? P.dias + ' dias' : 'prazo informado'} — ${P.base}`; });
        liga('[name="subtipo"]', () => { const v = form.subtipo.value; form.querySelectorAll('[data-sub]').forEach(el => { el.style.display = el.dataset.sub === v ? '' : 'none'; }); });
        liga('[name="criterio"]', () => { const g = $('#grupo-personalizado'); if (g) g.style.display = form.criterio.value === 'personalizado' ? '' : 'none'; });

        form.addEventListener('submit', ev => {
            ev.preventDefault();
            ({ atualizacao: calcAtualizacao, prazos: calcPrazos, juros: calcJuros, honorarios: calcHonorarios, prescricao: calcPrescricao, aluguel: calcAluguel, rpv: calcRPV, execucao: calcExecucao, partilha: calcPartilha, cartao: calcCartao })[tipo](form, out);
        });
        const imprimir = $('#btn-imprimir'); if (imprimir) imprimir.addEventListener('click', () => window.print());
        const limpar = $('#btn-limpar'); if (limpar) limpar.addEventListener('click', () => { form.reset(); out.classList.remove('visivel'); out.innerHTML = ''; form.querySelectorAll('input[type="date"][data-hoje]').forEach(i => i.value = isoHoje()); form.dispatchEvent(new Event('change')); });
    });
})();
