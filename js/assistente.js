/* Assistente virtual de triagem — janela de conversa do site.
 *
 * Os links de WhatsApp do escritório passam a abrir esta conversa. O
 * assistente (IA, identificado como tal) colhe as informações iniciais e, ao
 * final, abre o WhatsApp do escritório com uma saudação neutra. A análise da
 * conversa vai só ao advogado: nada de resumo, referência ou conclusão aparece
 * para o cliente (decisão do proprietário, 25/11/2026).
 * Se a IA estiver indisponível, os links continuam levando direto ao WhatsApp.
 * Links com o atributo data-direto nunca são interceptados.
 */
(function () {
    'use strict';

    var API = '/api/assistente';
    var NUMERO = '5583999050505';
    var CHAVE = 'rpadv-assistente-v2';
    var SAUDACAO = 'Olá! Sou o assistente virtual do escritório do Dr. Rodrigo Pinto. ' +
        'Vou fazer algumas perguntas iniciais sobre o seu caso para agilizar o atendimento. ' +
        'Por favor, não envie CPF, documentos nem senhas por aqui. ' +
        'Para começar, conte em poucas palavras o que aconteceu.';

    var disponivel = null;          // null = ainda não verificado
    var estado = carregar();        // { mensagens: [], fase: 'conversa'|'concluido', nome }
    var painel = null, lista = null, campo = null, botaoEnviar = null, botaoAgora = null, aguardando = false;

    function carregar() {
        try {
            var s = JSON.parse(sessionStorage.getItem(CHAVE));
            if (s && Array.isArray(s.mensagens)) return s;
        } catch (e) { /* sem armazenamento: começa do zero */ }
        return { mensagens: [], fase: 'conversa' };
    }
    function salvar() {
        try { sessionStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* ignora */ }
    }

    function linkWhatsApp(texto) {
        return 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(texto);
    }

    /* Verifica se a IA está configurada, sem bloquear a página. */
    function verificar() {
        fetch(API, { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : { disponivel: false }; })
            .then(function (j) { disponivel = Boolean(j && j.disponivel); })
            .catch(function () { disponivel = false; });
    }

    /* ---------- Montagem da janela ---------- */
    function montar() {
        if (painel) return;
        painel = document.createElement('div');
        painel.className = 'assist-painel';
        painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-modal', 'false');
        painel.setAttribute('aria-labelledby', 'assist-titulo');
        painel.innerHTML =
            '<div class="assist-topo">' +
                '<div>' +
                    '<p class="assist-titulo" id="assist-titulo">Assistente virtual</p>' +
                    '<p class="assist-sub">Escritório Rodrigo Pinto · atendimento automatizado</p>' +
                '</div>' +
                '<button type="button" class="assist-fechar" aria-label="Fechar conversa">×</button>' +
            '</div>' +
            '<div class="assist-lista" aria-live="polite"></div>' +
            '<form class="assist-form" autocomplete="off">' +
                '<input type="text" name="website" class="assist-hp" tabindex="-1" aria-hidden="true">' +
                '<label class="assist-rotulo" for="assist-campo">Sua mensagem</label>' +
                '<textarea id="assist-campo" class="assist-campo" rows="2" maxlength="2000" placeholder="Escreva aqui…"></textarea>' +
                '<button type="submit" class="assist-enviar" aria-label="Enviar mensagem">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
                '</button>' +
            '</form>' +
            '<div class="assist-rodape">' +
                '<button type="button" class="assist-agora" hidden>Já contei o principal — falar com o Dr. Rodrigo</button>' +
                '<p>Conversa com inteligência artificial, encaminhada ao escritório. ' +
                '<a href="/privacidade#assistente">Privacidade</a> · ' +
                '<a href="' + linkWhatsApp('Olá, Dr. Rodrigo. Gostaria de agendar uma consulta.') + '" data-direto target="_blank" rel="noopener noreferrer">Prefiro ir direto ao WhatsApp</a></p>' +
            '</div>';
        document.body.appendChild(painel);

        lista = painel.querySelector('.assist-lista');
        campo = painel.querySelector('.assist-campo');
        botaoEnviar = painel.querySelector('.assist-enviar');
        botaoAgora = painel.querySelector('.assist-agora');

        painel.querySelector('.assist-fechar').addEventListener('click', fechar);
        painel.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
        painel.querySelector('.assist-form').addEventListener('submit', function (e) {
            e.preventDefault();
            if (painel.querySelector('.assist-hp').value) return;
            enviar();
        });
        campo.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
        });
        botaoAgora.addEventListener('click', concluir);

        renderizar();
    }

    function bolha(texto, autor) {
        var p = document.createElement('p');
        p.className = 'assist-msg assist-msg-' + autor;
        p.textContent = texto;
        lista.appendChild(p);
        lista.scrollTop = lista.scrollHeight;
        return p;
    }

    function renderizar() {
        lista.textContent = '';
        bolha(SAUDACAO, 'assistente');
        estado.mensagens.forEach(function (m) { bolha(m.content, m.role === 'user' ? 'cliente' : 'assistente'); });
        if (estado.fase === 'concluido') mostrarFinal();
        atualizarControles();
    }

    function atualizarControles() {
        var concluido = estado.fase === 'concluido';
        campo.disabled = aguardando || concluido;
        botaoEnviar.disabled = aguardando || concluido;
        var turnos = estado.mensagens.filter(function (m) { return m.role === 'user'; }).length;
        botaoAgora.hidden = concluido || turnos < 2;
        botaoAgora.disabled = aguardando;
    }

    function digitando(ativo) {
        var atual = lista.querySelector('.assist-digitando');
        if (ativo && !atual) {
            var d = bolha('', 'assistente');
            d.className += ' assist-digitando';
            d.setAttribute('aria-label', 'O assistente está escrevendo');
            d.innerHTML = '<span></span><span></span><span></span>';
        } else if (!ativo && atual) {
            atual.remove();
        }
    }

    /* ---------- Conversa ---------- */
    function postar(acao) {
        return fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ acao: acao, mensagens: estado.mensagens }),
        }).then(function (r) { return r.json(); });
    }

    function enviar() {
        var texto = campo.value.trim();
        if (!texto || aguardando || estado.fase === 'concluido') return;
        campo.value = '';
        estado.mensagens.push({ role: 'user', content: texto });
        salvar();
        bolha(texto, 'cliente');
        aguardando = true; atualizarControles(); digitando(true);

        postar('conversar').then(function (j) {
            digitando(false);
            if (!j || !j.ok) return falhar();
            estado.mensagens.push({ role: 'assistant', content: j.resposta });
            salvar();
            bolha(j.resposta, 'assistente');
            aguardando = false; atualizarControles();
            if (j.concluir) concluir();
            else campo.focus();
        }).catch(function () { digitando(false); falhar(); });
    }

    function concluir() {
        if (estado.fase === 'concluido' || estado.mensagens.length === 0) return;
        /* O histórico precisa terminar com uma fala do cliente. */
        if (estado.mensagens[estado.mensagens.length - 1].role === 'assistant') {
            estado.mensagens.push({ role: 'user', content: 'Pode encaminhar ao Dr. Rodrigo.' });
            salvar();
        }
        aguardando = true; atualizarControles(); digitando(true);
        var aviso = bolha('Só um instante…', 'sistema');

        postar('concluir').then(function (j) {
            digitando(false); aviso.remove();
            if (!j || !j.ok) return falhar();
            var envio = j.envio_navegador ? fetch(j.envio_navegador.destino, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(j.envio_navegador.corpo),
            }).catch(function () { /* o atendimento segue pelo WhatsApp mesmo assim */ }) : Promise.resolve();
            return envio.then(function () {
                estado.fase = 'concluido';
                estado.nome = j.nome || '';
                salvar();
                aguardando = false;
                mostrarFinal();
                atualizarControles();
            });
        }).catch(function () { digitando(false); aviso.remove(); falhar(); });
    }

    function mostrarFinal() {
        if (lista.querySelector('.assist-final')) return;
        var texto = 'Olá, Dr. Rodrigo! ' + (estado.nome ? 'Meu nome é ' + estado.nome + '. ' : '') +
            'Gostaria de conversar sobre o meu caso.';
        var box = document.createElement('div');
        box.className = 'assist-final';
        box.innerHTML =
            '<p>Obrigado! Toque abaixo para continuar o atendimento com o Dr. Rodrigo pelo WhatsApp.</p>' +
            '<a class="assist-wa" data-direto target="_blank" rel="noopener noreferrer">Continuar no WhatsApp com o Dr. Rodrigo</a>' +
            '<button type="button" class="assist-nova">Começar outra conversa</button>';
        box.querySelector('.assist-wa').href = linkWhatsApp(texto);
        box.querySelector('.assist-nova').addEventListener('click', function () {
            estado = { mensagens: [], fase: 'conversa' };
            salvar();
            renderizar();
            campo.focus();
        });
        lista.appendChild(box);
        lista.scrollTop = lista.scrollHeight;
    }

    /* Qualquer falha: o contato não se perde — WhatsApp com o que já foi escrito. */
    function falhar() {
        aguardando = false;
        disponivel = false;
        var relato = estado.mensagens.filter(function (m) { return m.role === 'user'; })
            .map(function (m) { return m.content; }).join('\n');
        var box = document.createElement('div');
        box.className = 'assist-final';
        box.innerHTML =
            '<p>O assistente está indisponível no momento. Sua mensagem não se perdeu: toque abaixo para enviá-la direto ao Dr. Rodrigo pelo WhatsApp.</p>' +
            '<a class="assist-wa" data-direto target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>';
        box.querySelector('.assist-wa').href = linkWhatsApp('Olá, Dr. Rodrigo.' + (relato ? '\n\n' + relato : ''));
        lista.appendChild(box);
        lista.scrollTop = lista.scrollHeight;
        atualizarControles();
    }

    /* ---------- Abrir / fechar ---------- */
    function abrir() {
        montar();
        painel.classList.add('aberto');
        document.documentElement.classList.add('assist-ativo');
        setTimeout(function () { if (!campo.disabled) campo.focus(); }, 60);
    }
    function fechar() {
        if (!painel) return;
        painel.classList.remove('aberto');
        document.documentElement.classList.remove('assist-ativo');
        var flutuante = document.querySelector('.whatsapp-float');
        if (flutuante) flutuante.focus();
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href*="wa.me/' + NUMERO + '"]');
        if (!a || a.hasAttribute('data-direto') || a.closest('.form-fallback')) return;
        if (disponivel === false) return;        // IA indisponível: segue direto ao WhatsApp
        e.preventDefault();
        abrir();
    }, true);

    if ('requestIdleCallback' in window) requestIdleCallback(verificar, { timeout: 3000 });
    else setTimeout(verificar, 1500);
})();
