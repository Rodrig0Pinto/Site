/* Área do Cliente — consulta processual didática.
   Suporta link pré-preenchido: /area-cliente.html?n=Maria&p=num1,num2
   (o escritório envia esse link a cada cliente; ao abrir, consulta sozinho). */

(function () {
    'use strict';

    const form      = document.getElementById('formProcessos');
    const resultado = document.getElementById('acResultado');
    const saudacao  = document.getElementById('saudacao');
    if (!form || !resultado) return;

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

    function fase(f) {
        return '<span class="ac-fase ac-fase-' + esc(f.cor) + '">' + esc(f.fase) + '</span>';
    }

    function cartao(p) {
        if (p.erro) {
            return '<article class="ac-processo"><header class="ac-proc-head">' +
                '<h2 class="ac-proc-num">' + esc(p.numero) + '</h2></header>' +
                '<p class="ac-erro">' + esc(p.erro) + '</p></article>';
        }
        const assuntos = (p.assuntos || []).join(' · ');
        const movs = (p.movimentos || []).map(m =>
            '<li><time>' + esc(m.data) + '</time>' +
            '<strong>' + esc(m.nome) + '</strong>' +
            '<p>' + esc(m.explicacao) + '</p></li>'
        ).join('');
        return (
            '<article class="ac-processo">' +
              '<header class="ac-proc-head">' +
                '<div><h2 class="ac-proc-num">' + esc(p.numero) + '</h2>' +
                '<p class="ac-proc-meta">' + esc(p.classe) +
                    (p.orgao ? ' · ' + esc(p.orgao) : '') +
                    (p.tribunal ? ' · ' + esc(p.tribunal) : '') + '</p>' +
                (assuntos ? '<p class="ac-proc-assuntos">' + esc(assuntos) + '</p>' : '') +
                '</div>' + fase(p.fase) +
              '</header>' +
              '<div class="ac-resumo"><h3>Em resumo</h3><p>' + esc(p.fase.resumo) + '</p>' +
                (p.ultimaAtualizacao ? '<p class="ac-atualizado">Última movimentação: ' + esc(p.ultimaAtualizacao) + '</p>' : '') +
              '</div>' +
              (movs ? '<div class="ac-timeline"><h3>Últimos andamentos, traduzidos</h3><ol>' + movs + '</ol></div>' : '') +
            '</article>'
        );
    }

    async function consultar(numeros, nome) {
        resultado.innerHTML = '<p class="ac-carregando">Consultando a base pública do CNJ…</p>';
        try {
            const r = await fetch('/api/processo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numeros: numeros })
            });
            const j = await r.json();
            if (!j.ok) throw new Error(j.erro || 'falha');
            const ola = nome ? 'Olá, ' + esc(nome) + '! ' : '';
            resultado.innerHTML =
                '<p class="ac-cabecalho">' + ola + 'Consulta realizada em ' + esc(j.consultadoEm) +
                ', direto da base oficial do CNJ.</p>' +
                j.processos.map(cartao).join('') +
                '<div class="ac-duvida"><p>Alguma dúvida sobre esses andamentos? ' +
                '<a href="https://wa.me/5583999050505?text=' +
                encodeURIComponent('Olá, Dr. Rodrigo. Vi a Área do Cliente e tenho uma dúvida sobre meu processo.') +
                '" target="_blank" rel="noopener noreferrer">Fale com o escritório no WhatsApp</a> — ' +
                'explicamos cada detalhe pessoalmente.</p></div>';
        } catch (e) {
            resultado.innerHTML = '<p class="ac-erro">' + esc(e.message === 'falha'
                ? 'Não foi possível concluir a consulta agora. Tente novamente em instantes.'
                : e.message) + '</p>';
        }
    }

    function extrairNumeros(texto) {
        return String(texto || '')
            .split(/[,;\n ]+/)
            .map(t => t.replace(/\D/g, ''))
            .filter(t => t.length === 20)
            .slice(0, 5);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const numeros = extrairNumeros(form.numeros.value);
        if (!numeros.length) {
            resultado.innerHTML = '<p class="ac-erro">Confira o número: o padrão tem 20 dígitos ' +
                '(ex.: 0000000-00.0000.8.15.0000). Copie exatamente como está nos seus documentos.</p>';
            return;
        }
        consultar(numeros, form.nome.value.trim());
    });

    /* Link personalizado enviado pelo escritório */
    const params  = new URLSearchParams(location.search);
    const nomeUrl = (params.get('n') || '').slice(0, 40);
    const procUrl = extrairNumeros(params.get('p'));
    if (nomeUrl && saudacao) {
        saudacao.textContent = 'Olá, ' + nomeUrl + '! Aqui está a situação atualizada dos seus processos.';
    }
    if (procUrl.length) {
        form.numeros.value = procUrl.join(', ');
        if (nomeUrl) form.nome.value = nomeUrl;
        consultar(procUrl, nomeUrl);
    }
})();
