/* =============================================================
   Rodrigo Pinto Advocacia — Script das Páginas do Blog
   ============================================================= */

(function () {
    'use strict';

    /* ===== HEADER: transparente → sólido no scroll ===== */
    const header = document.getElementById('header');

    function updateHeader() {
        if (!header) return;
        if (window.scrollY > 70) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();

    /* ===== MENU MOBILE ===== */
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu   = document.querySelector('.nav-links');

    function toggleMenu(force) {
        if (!navToggle || !navMenu) return;
        const open = force !== undefined ? force : !navMenu.classList.contains('open');
        navMenu.classList.toggle('open', open);
        navToggle.classList.toggle('open', open);
        navToggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
    }

    if (navToggle) {
        navToggle.addEventListener('click', () => toggleMenu());
    }

    if (navMenu) {
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => toggleMenu(false));
        });
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('open')) {
            toggleMenu(false);
        }
    });

    /* ===== SCROLL SUAVE para âncoras internas ===== */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            const offset = (header ? header.offsetHeight : 80) + 8;
            const top    = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        });
    });

    /* ===== ANIMAÇÕES DE ENTRADA (scroll reveal) ===== */
    const animTargets = document.querySelectorAll('.blog-card, .artigo-cta, .artigo-autor-card');

    animTargets.forEach(el => {
        el.classList.add('anim-fade');
        const siblings = el.parentElement.querySelectorAll('.anim-fade');
        const idx = Array.from(siblings).indexOf(el);
        el.style.transitionDelay = (idx * 0.1) + 's';
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

})();
