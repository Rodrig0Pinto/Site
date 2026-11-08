/* Gateway anti-abuso do formulário de contato.
 *
 * O formulário do site passa a enviar para cá (em vez de ir direto ao
 * FormSubmit). Esta função, executada no edge da Cloudflare:
 *
 *   1. Registra a origem de CADA tentativa de contato — IP, geolocalização,
 *      operadora/ASN, dispositivo, data/hora e página de origem;
 *   2. Aplica verificações anti-bot (honeypot e tempo mínimo de preenchimento);
 *   3. Calcula indicadores de risco (rede corporativa/VPN, e-mail descartável,
 *      incoerência geográfica, submissão automatizada);
 *   4. Encaminha ao e-mail do escritório com uma FICHA TÉCNICA anexada à
 *      mensagem, servindo como registro probatório do contato.
 *
 * Base legal (LGPD): art. 7º, IX (legítimo interesse — segurança e prevenção
 * a fraude) e art. 7º, VI (exercício regular de direitos). Os dados são
 * coletados apenas de quem efetivamente submete o formulário — não há
 * rastreamento de visitantes que apenas navegam pelo site.
 */

const DESTINO = 'contato@rodrigopinto.adv.br';            // destino principal (ativado no FormSubmit; também usado pela Resend)
const COPIA = 'rodrigopintoadv@gmail.com';                  // cópia (alias FormSubmit 91b801e4… ativado em 08/11/2026)
const FORMSUBMIT = 'https://formsubmit.co/ajax/' + DESTINO;

/* Domínios de e-mail temporário/descartável mais comuns */
const EMAIL_DESCARTAVEL = [
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com',
    'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'yopmail.com',
    'trashmail.com', 'sharklasers.com', 'getnada.com', 'maildrop.cc',
    'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'mytemp.email',
    'emailondeck.com', 'moakt.com', 'tempr.email', 'spam4.me'
];

/* Indícios de tráfego automatizado no User-Agent */
const UA_AUTOMATIZADO = /bot|crawler|spider|curl|wget|python|scrapy|headless|phantom|selenium|puppeteer|axios|okhttp|java\/|go-http/i;

function analisarDispositivo(ua) {
    if (!ua) return { dispositivo: 'não informado', sistema: 'não informado', navegador: 'não informado' };

    let dispositivo = 'Computador';
    if (/iPad|Tablet/i.test(ua)) dispositivo = 'Tablet';
    else if (/Mobile|Android|iPhone/i.test(ua)) dispositivo = 'Celular';

    let sistema = 'não identificado';
    if (/Windows NT 10/i.test(ua)) sistema = 'Windows 10/11';
    else if (/Windows NT/i.test(ua)) sistema = 'Windows (versão anterior)';
    else if (/iPhone|iPad|iPod/i.test(ua)) sistema = 'iOS (Apple)';
    else if (/Mac OS X/i.test(ua)) sistema = 'macOS (Apple)';
    else if (/Android ([\d.]+)/i.test(ua)) sistema = 'Android ' + (ua.match(/Android ([\d.]+)/i)[1] || '');
    else if (/Linux/i.test(ua)) sistema = 'Linux';

    let navegador = 'não identificado';
    if (/Edg\//i.test(ua)) navegador = 'Microsoft Edge';
    else if (/OPR\/|Opera/i.test(ua)) navegador = 'Opera';
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) navegador = 'Google Chrome';
    else if (/Firefox\//i.test(ua)) navegador = 'Mozilla Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) navegador = 'Safari';

    return { dispositivo, sistema, navegador };
}

function avaliarRisco({ cf, ua, email, tempoPreenchimento, honeypot }) {
    const alertas = [];
    let pontos = 0;

    if (honeypot) {
        alertas.push('CAMPO-ARMADILHA PREENCHIDO — envio automatizado (bot)');
        pontos += 100;
    }
    if (typeof tempoPreenchimento === 'number' && tempoPreenchimento >= 0 && tempoPreenchimento < 3) {
        alertas.push(`Formulário preenchido em ${tempoPreenchimento}s — velocidade incompatível com digitação humana`);
        pontos += 40;
    }
    if (UA_AUTOMATIZADO.test(ua || '')) {
        alertas.push('Assinatura de robô/script no navegador declarado');
        pontos += 50;
    }
    if (!ua) {
        alertas.push('Navegador não declarado — típico de requisição programática');
        pontos += 25;
    }

    const dominio = (email || '').split('@')[1]?.toLowerCase() || '';
    if (EMAIL_DESCARTAVEL.some(d => dominio === d || dominio.endsWith('.' + d))) {
        alertas.push(`E-mail descartável/temporário (${dominio})`);
        pontos += 45;
    }

    const org = (cf?.asOrganization || '').toLowerCase();
    if (/vpn|proxy|hosting|datacenter|data center|cloud|server|colo|ovh|digitalocean|linode|vultr|amazon|google llc|microsoft corp/i.test(org)) {
        alertas.push(`Conexão de rede de servidores/VPN (${cf.asOrganization}) — origem possivelmente mascarada`);
        pontos += 30;
    }

    if (cf?.country && cf.country !== 'BR') {
        alertas.push(`Acesso originado fora do Brasil (${cf.country})`);
        pontos += 15;
    }

    let nivel = 'BAIXO';
    if (pontos >= 80) nivel = 'CRÍTICO';
    else if (pontos >= 45) nivel = 'ALTO';
    else if (pontos >= 20) nivel = 'MODERADO';

    return { nivel, pontos, alertas };
}

function montarFicha({ ip, cf, ua, disp, risco, recebidoEm, origem, tempoPreenchimento }) {
    const linhas = [
        '',
        '──────────────────────────────────────────',
        'FICHA TÉCNICA DO CONTATO (registro automático)',
        '──────────────────────────────────────────',
        `Data/hora......: ${recebidoEm}`,
        `Endereço IP....: ${ip || 'não disponível'}`,
        `País...........: ${cf?.country || '—'}${cf?.continent ? ' (' + cf.continent + ')' : ''}`,
        `Estado/Região..: ${cf?.region || '—'}`,
        `Cidade.........: ${cf?.city || '—'}${cf?.postalCode ? ' — CEP ' + cf.postalCode : ''}`,
        `Coordenadas....: ${cf?.latitude && cf?.longitude ? cf.latitude + ', ' + cf.longitude + ' (aproximadas)' : '—'}`,
        `Fuso horário...: ${cf?.timezone || '—'}`,
        `Operadora/ASN..: ${cf?.asOrganization || '—'}${cf?.asn ? ' (AS' + cf.asn + ')' : ''}`,
        `Dispositivo....: ${disp.dispositivo}`,
        `Sistema........: ${disp.sistema}`,
        `Navegador......: ${disp.navegador}`,
        `Origem do envio: ${origem || '—'}`,
        `Tempo de preenchimento: ${typeof tempoPreenchimento === 'number' && tempoPreenchimento >= 0 ? tempoPreenchimento + 's' : '—'}`,
        `Identificador do acesso: ${cf?.colo || '—'}`,
        '',
        `NÍVEL DE RISCO: ${risco.nivel} (pontuação ${risco.pontos})`
    ];

    if (risco.alertas.length) {
        linhas.push('Indicadores detectados:');
        risco.alertas.forEach(a => linhas.push('  • ' + a));
    } else {
        linhas.push('Nenhum indicador de irregularidade detectado.');
    }

    linhas.push(
        '',
        'User-Agent completo:',
        ua || '(não informado)',
        '──────────────────────────────────────────',
        'Registro gerado automaticamente para fins de segurança e',
        'prevenção a fraude (LGPD, art. 7º, VI e IX). Conservar este',
        'e-mail preserva a cadeia probatória do contato.',
        '──────────────────────────────────────────'
    );

    return linhas.join('\n');
}

export async function onRequestPost({ request, env }) {
    const cors = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': 'https://rodrigopinto.adv.br'
    };

    let dados;
    try {
        dados = await request.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, erro: 'requisição inválida' }), { status: 400, headers: cors });
    }

    const nome     = (dados.nome || '').toString().trim().slice(0, 200);
    const email    = (dados.email || '').toString().trim().slice(0, 200);
    const mensagem = (dados.mensagem || '').toString().trim().slice(0, 5000);
    const telefone = (dados.telefone || '').toString().trim().slice(0, 50);
    const area     = (dados.area || '').toString().trim().slice(0, 100);
    const honeypot = (dados.website || '').toString().trim();   // campo invisível
    const tempoPreenchimento = Number.isFinite(dados.t) ? Math.round(dados.t) : null;

    if (!nome || !email || !mensagem) {
        return new Response(JSON.stringify({ ok: false, erro: 'campos obrigatórios ausentes' }), { status: 400, headers: cors });
    }

    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
    const ua = request.headers.get('User-Agent') || '';
    const origem = dados.origem || request.headers.get('Referer') || '';

    const disp  = analisarDispositivo(ua);
    const risco = avaliarRisco({ cf, ua, email, tempoPreenchimento, honeypot });

    const recebidoEm = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full', timeStyle: 'long', timeZone: 'America/Fortaleza'
    }).format(new Date());

    /* Bot evidente: responde como sucesso (não entrega pistas ao atacante),
       mas não consome o envio nem incomoda o escritório. */
    if (honeypot) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    }

    const ficha = montarFicha({ ip, cf, ua, disp, risco, recebidoEm, origem, tempoPreenchimento });

    const prefixo = risco.nivel === 'CRÍTICO' || risco.nivel === 'ALTO'
        ? `[RISCO ${risco.nivel}] `
        : '';

    const assunto = `${prefixo}Contato via site — ${nome}`;
    const corpo = {
        nome, email, telefone, area,
        mensagem: mensagem + '\n' + ficha,
        _subject: assunto,
        _template: 'box',
        _captcha: 'false',
        _replyto: email,
        _cc: COPIA                        // cópia no Gmail do proprietário (permite verificação pelo Claude)
    };

    /* Via principal: Resend (API transacional, sem limite por IP compartilhado).
       Ativa automaticamente quando a variável RESEND_API_KEY existir no projeto Pages
       (Settings → Variables and Secrets). RESEND_FROM é opcional: sem domínio
       verificado na Resend, o remetente precisa ser onboarding@resend.dev. */
    if (env && env.RESEND_API_KEY) {
        try {
            const texto = [
                `Nome: ${nome}`, `E-mail: ${email}`, `Telefone: ${telefone || '—'}`, `Área: ${area || '—'}`, '',
                'Mensagem:', mensagem, ficha
            ].join('\n');
            const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: env.RESEND_FROM || 'Site RP Advogados <onboarding@resend.dev>',
                    to: [DESTINO],
                    reply_to: email,
                    subject: assunto,
                    text: texto
                })
            });
            if (r.ok) return new Response(JSON.stringify({ ok: true, risco: risco.nivel, via: 'resend' }), { status: 200, headers: cors });
            /* falhou na Resend: segue para o FormSubmit como reserva */
        } catch { /* idem */ }
    }

    try {
        const res = await fetch(FORMSUBMIT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://rodrigopinto.adv.br',
                'Referer': 'https://rodrigopinto.adv.br/',
                'User-Agent': ua || 'Mozilla/5.0'
            },
            body: JSON.stringify(corpo)
        });
        const texto = await res.text();
        let json = null; try { json = JSON.parse(texto); } catch { /* resposta não-JSON */ }
        const sucesso = res.ok && (!json || String(json.success) !== 'false');
        if (!sucesso) {
            /* O FormSubmit limita por IP e os IPs do edge da Cloudflare são compartilhados
               (HTTP 429 frequente). Devolve o payload pronto — com a ficha técnica — para o
               navegador do visitante concluir o envio a partir do próprio IP. HTTP 200 de
               propósito: respostas 5xx podem ser substituídas por páginas de erro genéricas. */
            return new Response(JSON.stringify({ ok: false, fallback: 'navegador', destino: FORMSUBMIT, corpo, detalhe: { status: res.status, resposta: texto.slice(0, 200) } }), { status: 200, headers: cors });
        }
        return new Response(JSON.stringify({ ok: true, risco: risco.nivel }), { status: 200, headers: cors });
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, fallback: 'navegador', destino: FORMSUBMIT, corpo, detalhe: { excecao: String(e && e.message || e).slice(0, 200) } }), { status: 200, headers: cors });
    }
}

/* Requisições que não sejam POST não são atendidas */
export async function onRequest({ request }) {
    if (request.method === 'POST') return onRequestPost({ request });
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': 'https://rodrigopinto.adv.br',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }
    return new Response('Método não permitido', { status: 405 });
}
