/* =============================================================
   Rodrigo Pinto Advocacia — Script Principal
   ============================================================= */

(function () {
    'use strict';

    /* ===== HEADER: transparente → sólido no scroll ===== */
    const header = document.getElementById('header');

    function updateHeader() {
        if (window.scrollY > 70) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();

    /* ===== NAVEGAÇÃO ATIVA ===== */
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id], div[id]');

    function updateActiveNav() {
        let current = '';
        sections.forEach(section => {
            if (window.scrollY >= section.offsetTop - 140) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }
    window.addEventListener('scroll', updateActiveNav, { passive: true });

    /* ===== MENU MOBILE ===== */
    const navToggle  = document.querySelector('.nav-toggle');
    const navMenu    = document.querySelector('.nav-links');

    function toggleMenu(force) {
        const open = force !== undefined ? force : !navMenu.classList.contains('open');
        navMenu.classList.toggle('open', open);
        navToggle.classList.toggle('open', open);
        navToggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
    }

    navToggle.addEventListener('click', () => toggleMenu());

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && navMenu.classList.contains('open')) {
            toggleMenu(false);
        }
    });

    /* ===== CONTADOR ANIMADO ===== */
    const counters   = document.querySelectorAll('.numero-value');
    const numerosEl  = document.querySelector('.numeros');
    let counted      = false;

    function animateCounters() {
        counters.forEach(counter => {
            const target   = parseInt(counter.dataset.target, 10);
            const duration = 1800;
            const start    = performance.now();

            function tick(now) {
                const elapsed  = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased    = 1 - Math.pow(1 - progress, 3);
                counter.textContent = Math.floor(eased * target);
                if (progress < 1) requestAnimationFrame(tick);
                else counter.textContent = target;
            }
            requestAnimationFrame(tick);
        });
    }

    if (numerosEl) {
        new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !counted) {
                counted = true;
                animateCounters();
            }
        }, { threshold: 0.4 }).observe(numerosEl);
    }

    /* ===== ANIMAÇÕES DE ENTRADA (scroll reveal) ===== */
    const animTargets = document.querySelectorAll(
        '.area-card, .diferencial-item, .info-item, .numero-item, .sobre-content, .sobre-visual, .citacao-inner, .noticias-tribunal'
    );

    animTargets.forEach(el => {
        el.classList.add('anim-fade');
        const siblings = el.parentElement.querySelectorAll('.anim-fade');
        const idx = Array.from(siblings).indexOf(el);
        el.style.transitionDelay = (idx * 0.09) + 's';
    });

    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    animTargets.forEach(el => revealObserver.observe(el));

    /* ===== FORMULÁRIO DE CONTATO ===== */
    const form = document.getElementById('contactForm');

    if (form) {
        let formTimer = null;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const btn      = form.querySelector('.btn-gold');
            const original = btn.innerHTML;
            clearTimeout(formTimer);

            const nome     = form.nome.value.trim();
            const email    = form.email.value.trim();
            const mensagem = form.mensagem.value.trim();

            if (!nome || !email || !mensagem) {
                shakeForm(btn);
                return;
            }

            btn.disabled  = true;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Enviando…';
            btn.style.background = 'linear-gradient(135deg, #7a8fa6, #5a6f88)';

            try {
                const res = await fetch('https://formsubmit.co/ajax/contato@rodrigopinto.adv.br', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        nome, email, mensagem,
                        telefone:  form.telefone?.value?.trim() || '',
                        area:      form.area?.value || '',
                        _subject:  'Novo contato via site — ' + nome,
                        _template: 'table',
                        _captcha:  'false',
                        _replyto:  email
                    })
                });

                if (res.ok) {
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Mensagem Enviada!';
                    btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
                    btn.style.boxShadow  = '0 4px 24px rgba(46,204,113,0.35)';
                    formTimer = setTimeout(() => {
                        btn.innerHTML        = original;
                        btn.style.background = '';
                        btn.style.boxShadow  = '';
                        btn.disabled         = false;
                        form.reset();
                    }, 4500);
                } else {
                    throw new Error('falha');
                }
            } catch {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Erro — tente novamente';
                btn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                formTimer = setTimeout(() => {
                    btn.innerHTML        = original;
                    btn.style.background = '';
                    btn.disabled         = false;
                }, 3500);
            }
        });

        function shakeForm(el) {
            el.style.animation = 'shake 0.4s ease';
            el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
        }

        const style = document.createElement('style');
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20%       { transform: translateX(-8px); }
                40%       { transform: translateX(8px); }
                60%       { transform: translateX(-5px); }
                80%       { transform: translateX(5px); }
            }
        `;
        document.head.appendChild(style);
    } /* fim if (form) */

    /* ===== SCROLL SUAVE para âncoras internas ===== */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            const offset = header.offsetHeight + 8;
            const top    = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        });
    });

    /* ===== ATUALIZAÇÕES JURÍDICAS ===== */
    async function carregarNoticias() {
        const listStf = document.getElementById('list-stf');
        const listStj = document.getElementById('list-stj');
        if (!listStf || !listStj) return;

        function formatDate(str) {
            if (!str) return '';
            const d = new Date(str);
            return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        const PORTAIS = {
            stf: 'https://portal.stf.jus.br/noticias/',
            stj: 'https://agencia.stj.jus.br/'
        };

        function fallback(el, tribunal) {
            el.innerHTML = `<li class="noticia-erro">
                Não foi possível carregar automaticamente.
                <a href="${PORTAIS[tribunal]}" class="noticia-link" target="_blank" rel="noopener noreferrer" style="margin-top:6px;display:inline-block;">
                    Ver notícias no portal oficial →
                </a>
            </li>`;
        }

        function renderList(el, items, tribunal) {
            if (!items?.length) { fallback(el, tribunal); return; }
            el.innerHTML = items.map(item => {
                const date  = formatDate(item.pubDate);
                /* Notícias via Google News trazem " - Veículo" no fim do título */
                const title = item.link.includes('news.google.com')
                    ? item.title.replace(/\s+-\s+[^-]+$/, '')
                    : item.title;
                return `<li>
                    <a href="${item.link}" class="noticia-link" target="_blank" rel="noopener noreferrer">${title}</a>
                    ${date ? `<span class="noticia-data">${date}</span>` : ''}
                </li>`;
            }).join('');
        }

        try {
            const res  = await fetch('/noticias');
            const data = await res.json();
            renderList(listStf, data.stf, 'stf');
            renderList(listStj, data.stj, 'stj');
        } catch {
            fallback(listStf, 'stf');
            fallback(listStj, 'stj');
        }
    }

    carregarNoticias();

})();
