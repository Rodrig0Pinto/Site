/* =============================================================
   RP Advogados — Script Principal
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
                const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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
        '.area-card, .diferencial-item, .info-item, .numero-item, .sobre-content, .sobre-visual, .citacao-inner'
    );

    animTargets.forEach((el, i) => {
        el.classList.add('anim-fade');
        // Escalonamento suave por índice dentro do mesmo grupo pai
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

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const btn      = form.querySelector('.btn-gold');
        const svg      = btn.querySelector('svg');
        const original = btn.innerHTML;

        // Validação mínima
        const nome     = form.nome.value.trim();
        const email    = form.email.value.trim();
        const mensagem = form.mensagem.value.trim();

        if (!nome || !email || !mensagem) {
            shakeForm(btn);
            return;
        }

        // Estado de envio
        btn.disabled  = true;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Enviando…';
        btn.style.background = 'linear-gradient(135deg, #7a8fa6, #5a6f88)';

        // Simulação de envio (substituir pela integração real: fetch/mailto)
        setTimeout(() => {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Mensagem Enviada!';
            btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
            btn.style.boxShadow  = '0 4px 24px rgba(46,204,113,0.35)';

            setTimeout(() => {
                btn.innerHTML    = original;
                btn.style.background = '';
                btn.style.boxShadow  = '';
                btn.disabled         = false;
                form.reset();
            }, 4500);
        }, 1400);
    });

    function shakeForm(el) {
        el.style.animation = 'shake 0.4s ease';
        el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
    }

    // Keyframe de shake injetado dinamicamente
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

})();
