/* Consulta processual didática — Rodrigo Pinto Advocacia
 *
 * Consulta a API PÚBLICA do DataJud (CNJ) por número de processo e
 * devolve os dados já traduzidos para linguagem acessível.
 *
 * - Fonte oficial: https://datajud-wiki.cnj.jus.br/api-publica/
 * - A chave abaixo é a CHAVE PÚBLICA divulgada pelo próprio CNJ na
 *   documentação da API — não é um segredo.
 * - Nenhum dado do cliente é armazenado: a função recebe números de
 *   processo, consulta a fonte pública e responde. Ponto.
 * - Limite: 5 processos por chamada (evita abuso).
 */

const DATAJUD = 'https://api-publica.datajud.cnj.jus.br';
const CHAVE_PUBLICA_CNJ = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const RESP = { 'Content-Type': 'application/json; charset=utf-8' };

/* ── Roteamento: o próprio número CNJ diz qual tribunal consultar ──
   Formato: NNNNNNN-DD.AAAA.J.TR.OOOO  (J = ramo, TR = tribunal)   */
const UF_TJ = [null,'ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg',
               'pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'];
// atenção: ordem oficial CNJ para J=8 → 01=AC … 26=SP 25=SE? conferida abaixo
const TJ_ORDEM = {  1:'tjac', 2:'tjal', 3:'tjap', 4:'tjam', 5:'tjba', 6:'tjce',
                    7:'tjdft',8:'tjes', 9:'tjgo',10:'tjma',11:'tjmt',12:'tjms',
                   13:'tjmg',14:'tjpa',15:'tjpb',16:'tjpr',17:'tjpe',18:'tjpi',
                   19:'tjrj',20:'tjrn',21:'tjrs',22:'tjro',23:'tjrr',24:'tjsc',
                   25:'tjse',26:'tjsp',27:'tjto' };

function aliasDoNumero(digitos) {
    const j  = Number(digitos[13]);
    const tr = Number(digitos.slice(14, 16));
    if (j === 8) return TJ_ORDEM[tr] ? 'api_publica_' + TJ_ORDEM[tr] : null;
    if (j === 4 && tr >= 1 && tr <= 6) return 'api_publica_trf' + tr;
    if (j === 5) return tr === 0 ? 'api_publica_tst' : (tr >= 1 && tr <= 24 ? 'api_publica_trt' + tr : null);
    if (j === 3) return 'api_publica_stj';
    return null; // eleitoral, militar, STF: fora do DataJud público
}

function formatarNumero(d) {
    return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d[13]}.${d.slice(14,16)}.${d.slice(16)}`;
}

/* ── Tradução didática das movimentações mais comuns do PJe ── */
const TRADUCOES = [
    [/arquivamento definitivo|baixa definitiva/i,
        'O processo foi encerrado e arquivado definitivamente.'],
    [/tr[aâ]nsito em julgado/i,
        'A decisão tornou-se definitiva — não cabe mais recurso.'],
    [/arquivamento provis[oó]rio|sobrestamento|suspens[aã]o/i,
        'O processo está temporariamente suspenso, aguardando algo externo (outro julgamento, prazo ou providência).'],
    [/senten[cç]a|julgamento procedente|julgamento improcedente|homologa[cç][aã]o de acordo/i,
        'O juiz proferiu a decisão principal do caso. A partir dela, as partes podem recorrer no prazo legal.'],
    [/ac[oó]rd[aã]o/i,
        'O tribunal julgou o recurso e publicou a decisão colegiada.'],
    [/conclus[aã]o|concluso/i,
        'O processo está na mesa do juiz, aguardando análise ou decisão.'],
    [/audi[eê]ncia.*designad|designa[cç][aã]o de audi[eê]ncia/i,
        'Foi marcada uma audiência. Se a sua presença for necessária, o escritório entrará em contato com antecedência.'],
    [/audi[eê]ncia.*realizada/i,
        'A audiência foi realizada.'],
    [/cita[cç][aã]o/i,
        'A outra parte está sendo formalmente chamada ao processo.'],
    [/intima[cç][aã]o/i,
        'Uma comunicação oficial foi expedida às partes ou aos advogados.'],
    [/juntada.*peti[cç]/i,
        'Um novo documento ou manifestação foi apresentado no processo.'],
    [/juntada.*(laudo|per[ií]cia)/i,
        'O laudo pericial foi anexado ao processo.'],
    [/juntada/i,
        'Um documento foi anexado aos autos.'],
    [/distribui[cç][aã]o|autua[cç][aã]o/i,
        'O processo foi registrado e encaminhado à vara responsável — é o início da tramitação.'],
    [/remessa|remetidos/i,
        'Os autos foram enviados a outro órgão (tribunal, instância superior ou setor).'],
    [/recurso|apela[cç][aã]o|agravo|embargos/i,
        'Uma das partes recorreu — o caso será reavaliado.'],
    [/penhora|bloqueio|arresto|sisbajud|bacenjud/i,
        'Foi determinada medida de constrição de valores ou bens para garantir o pagamento.'],
    [/pagamento|dep[oó]sito|alvar[aá]|levantamento/i,
        'Há movimentação financeira no processo (depósito, pagamento ou liberação de valores).'],
    [/despacho|decis[aã]o/i,
        'O juiz emitiu um comando processual — um andamento intermediário do caso.'],
    [/publica[cç][aã]o/i,
        'Um ato do processo foi publicado oficialmente.'],
    [/vista|carga/i,
        'Os autos estão temporariamente com uma das partes ou órgão para manifestação.'],
    [/redistribui[cç][aã]o/i,
        'O processo mudou de vara ou de relator.'],
];

function traduzir(nome) {
    for (const [re, texto] of TRADUCOES) if (re.test(nome)) return texto;
    return 'Andamento processual registrado nos autos.';
}

/* Fase amigável a partir da última movimentação relevante */
function classificarFase(movs) {
    const nomes = movs.map(m => (m.nome || '').toLowerCase()).join(' | ');
    const ultimo = (movs[0]?.nome || '').toLowerCase();
    if (/baixa definitiva|arquivamento definitivo/.test(ultimo) ||
        /tr[aâ]nsito em julgado/.test(nomes.split('|')[0] || ''))
        return { fase: 'Encerrado', cor: 'cinza',
                 resumo: 'Este processo já foi concluído e arquivado.' };
    if (/tr[aâ]nsito em julgado/.test(ultimo))
        return { fase: 'Decisão definitiva', cor: 'verde',
                 resumo: 'A decisão tornou-se definitiva. Restam apenas providências finais, se houver.' };
    if (/senten[cç]a|ac[oó]rd[aã]o|julgamento/.test(ultimo))
        return { fase: 'Julgado — prazo de recurso', cor: 'verde',
                 resumo: 'Houve decisão. O escritório avalia os desdobramentos e eventuais recursos.' };
    if (/conclus/.test(ultimo))
        return { fase: 'Aguardando decisão', cor: 'ouro',
                 resumo: 'O processo está com o juiz. Essa espera é normal e o tempo varia conforme a vara.' };
    if (/audi[eê]ncia/.test(ultimo))
        return { fase: 'Fase de audiência', cor: 'ouro',
                 resumo: 'Há audiência marcada ou recém-realizada.' };
    if (/recurso|apela[cç]|agravo|embargos|remessa/.test(ultimo))
        return { fase: 'Em grau de recurso', cor: 'ouro',
                 resumo: 'O caso está sendo reavaliado em instância superior.' };
    if (/penhora|bloqueio|pagamento|alvar[aá]|levantamento|cumprimento/.test(ultimo))
        return { fase: 'Execução / pagamento', cor: 'verde',
                 resumo: 'Fase de efetivação prática da decisão — cobrança, bloqueios ou liberação de valores.' };
    return { fase: 'Em andamento', cor: 'azul',
             resumo: 'O processo tramita normalmente, com atos e prazos em curso.' };
}

function dataBr(iso) {
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Fortaleza' })
            .format(new Date(iso));
    } catch { return iso || ''; }
}

async function consultarProcesso(numeroLimpo) {
    const alias = aliasDoNumero(numeroLimpo);
    if (!alias) {
        return { numero: formatarNumero(numeroLimpo), erro:
            'Este número pertence a um ramo da Justiça ainda não coberto pela consulta pública do CNJ (ex.: Eleitoral, Militar ou STF).' };
    }
    let dados;
    try {
        const r = await fetch(`${DATAJUD}/${alias}/_search`, {
            method: 'POST',
            headers: {
                'Authorization': 'APIKey ' + CHAVE_PUBLICA_CNJ,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: { match: { numeroProcesso: numeroLimpo } }, size: 10 })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        dados = await r.json();
    } catch (e) {
        return { numero: formatarNumero(numeroLimpo), erro:
            'A base pública do CNJ está momentaneamente indisponível. Tente novamente em alguns minutos.' };
    }

    const hits = (dados.hits && dados.hits.hits) || [];
    if (!hits.length) {
        return { numero: formatarNumero(numeroLimpo), erro:
            'Processo não localizado na base pública do CNJ. Processos em segredo de justiça, muito recentes ou físicos podem não aparecer — fale com o escritório para detalhes.' };
    }

    /* pode haver um registro por grau; usa o de movimentação mais recente
       e informa os graus existentes */
    const fontes = hits.map(h => h._source).filter(Boolean);
    fontes.sort((a, b) => {
        const ua = a.movimentos?.length ? a.movimentos[a.movimentos.length-1].dataHora : a.dataAjuizamento;
        const ub = b.movimentos?.length ? b.movimentos[b.movimentos.length-1].dataHora : b.dataAjuizamento;
        return String(ub || '').localeCompare(String(ua || ''));
    });
    const p = fontes[0];

    const movs = (p.movimentos || [])
        .slice()
        .sort((a, b) => String(b.dataHora || '').localeCompare(String(a.dataHora || '')))
        .slice(0, 10)
        .map(m => ({
            data: dataBr(m.dataHora),
            nome: m.nome || 'Movimentação',
            explicacao: traduzir(m.nome || '')
        }));

    const fase = classificarFase(movs.length ? movs.map(m => ({ nome: m.nome })) : []);

    return {
        numero: formatarNumero(numeroLimpo),
        tribunal: p.tribunal || alias.replace('api_publica_', '').toUpperCase(),
        classe: p.classe?.nome || '',
        assuntos: (p.assuntos || []).map(a => a?.nome).filter(Boolean).slice(0, 4),
        orgao: p.orgaoJulgador?.nome || '',
        grau: p.grau || '',
        graus: [...new Set(fontes.map(f => f.grau).filter(Boolean))],
        ajuizado: p.dataAjuizamento ? dataBr(p.dataAjuizamento) : '',
        ultimaAtualizacao: movs[0]?.data || '',
        fase,
        movimentos: movs
    };
}

export async function onRequestPost({ request }) {
    let corpo;
    try { corpo = await request.json(); }
    catch { return new Response(JSON.stringify({ ok: false }), { status: 400, headers: RESP }); }

    const brutos = Array.isArray(corpo.numeros) ? corpo.numeros : [];
    const numeros = [...new Set(
        brutos.map(n => String(n || '').replace(/\D/g, '')).filter(n => n.length === 20)
    )].slice(0, 5);

    if (!numeros.length) {
        return new Response(JSON.stringify({ ok: false, erro:
            'Informe ao menos um número de processo válido (20 dígitos, padrão CNJ).' }),
            { status: 400, headers: RESP });
    }

    const processos = await Promise.all(numeros.map(consultarProcesso));

    return new Response(JSON.stringify({
        ok: true,
        consultadoEm: new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Fortaleza'
        }).format(new Date()),
        processos
    }), { status: 200, headers: { ...RESP, 'Cache-Control': 'no-store' } });
}

export async function onRequest(ctx) {
    if (ctx.request.method === 'POST') return onRequestPost(ctx);
    return new Response('Método não permitido', { status: 405 });
}
