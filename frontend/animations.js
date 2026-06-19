/* ══════════════════════════════════════════════
   ZIPHAY  animations.js  — Genius-Level Animations
   ✅ Page load curtain with logo animation
   ✅ Floating particle system (canvas)
   ✅ Magnetic cursor follower
   ✅ Hero text split-character reveal
   ✅ Parallax scroll depth layers
   ✅ Magnetic hover on buttons/cards
   ✅ Staggered cascade entrance animations
   ✅ Smooth number morphing counters
   ✅ Tilt 3D effect on cards
   ✅ Section fade + slide transitions
   ✅ Typing effect on hero subtitle
══════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ─────────────────────────────────────
       1. PAGE LOAD CURTAIN
    ───────────────────────────────────── */
    const loader = document.getElementById('pageLoader');
    if (loader) {
        window.addEventListener('load', () => {
            // Fast loader — 300ms total for quick time-to-interactive
            setTimeout(() => {
                loader.classList.add('loaded');
                document.body.classList.add('page-ready');
                setTimeout(() => loader.remove(), 400);
            }, 150);
        });
    }

    /* ─────────────────────────────────────
       2. FLOATING PARTICLE SYSTEM
       Subtle dots floating up with parallax
    ───────────────────────────────────── */
    const canvas = document.getElementById('particleCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animId;
        let w, h;

        function resizeCanvas() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * w;
                this.y = h + Math.random() * 100;
                this.size = Math.random() * 2 + 0.5;
                this.speedY = -(Math.random() * 0.4 + 0.15);
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.4 + 0.1;
                this.hue = Math.random() > 0.6 ? 165 : 270; // teal or purple
                this.life = 0;
                this.maxLife = Math.random() * 600 + 400;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.life++;
                // Fade in/out
                const progress = this.life / this.maxLife;
                if (progress < 0.1) this.currentOpacity = this.opacity * (progress / 0.1);
                else if (progress > 0.8) this.currentOpacity = this.opacity * ((1 - progress) / 0.2);
                else this.currentOpacity = this.opacity;
                // Gentle wave
                this.x += Math.sin(this.life * 0.01) * 0.15;
                if (this.life >= this.maxLife || this.y < -20) this.reset();
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, 80%, 65%, ${this.currentOpacity})`;
                ctx.fill();
            }
        }

        function initParticles() {
            resizeCanvas();
            const count = Math.min(Math.floor(w * h / 18000), 80);
            particles = Array.from({ length: count }, () => {
                const p = new Particle();
                p.y = Math.random() * h; // Scatter initially
                p.life = Math.random() * p.maxLife;
                return p;
            });
        }

        function animateParticles() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach(p => { p.update(); p.draw(); });
            animId = requestAnimationFrame(animateParticles);
        }

        initParticles();
        animateParticles();
        window.addEventListener('resize', () => {
            cancelAnimationFrame(animId);
            initParticles();
            animateParticles();
        });
    }

    /* ─────────────────────────────────────
       3. MAGNETIC CURSOR FOLLOWER
       Smooth dot + ring that follows mouse
    ───────────────────────────────────── */
    const cursorDot = document.getElementById('cursorDot');
    const cursorRing = document.getElementById('cursorRing');

    if (cursorDot && cursorRing && window.matchMedia('(pointer: fine)').matches) {
        let mouseX = -100, mouseY = -100;
        let dotX = -100, dotY = -100;
        let ringX = -100, ringY = -100;
        let cursorDirty = true; // Only animate when mouse moves

        document.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            cursorDirty = true;
        });

        function updateCursor() {
            if (cursorDirty) {
                // Dot follows instantly (almost)
                dotX += (mouseX - dotX) * 0.35;
                dotY += (mouseY - dotY) * 0.35;
                cursorDot.style.transform = `translate(${dotX}px, ${dotY}px)`;

                // Ring follows with lag
                ringX += (mouseX - ringX) * 0.12;
                ringY += (mouseY - ringY) * 0.12;
                cursorRing.style.transform = `translate(${ringX}px, ${ringY}px)`;

                // Stop animating when cursor has settled
                const dx = mouseX - dotX, dy = mouseY - dotY;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) cursorDirty = false;
            }
            requestAnimationFrame(updateCursor);
        }
        updateCursor();

        // Scale up on interactive elements
        const interactiveSelector = 'a, button, .mode-tab, .goal-btn, .tool-card, .feat-card, .import-btn, .sp-review, .level-tag, .fmt-opt, .up-btn, input[type="range"]';
        document.addEventListener('mouseover', e => {
            if (e.target.closest(interactiveSelector)) {
                cursorDot.classList.add('cursor-hover');
                cursorRing.classList.add('cursor-hover');
            }
        });
        document.addEventListener('mouseout', e => {
            if (e.target.closest(interactiveSelector)) {
                cursorDot.classList.remove('cursor-hover');
                cursorRing.classList.remove('cursor-hover');
            }
        });

        // Hide on mouse leave
        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorRing.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorRing.style.opacity = '1';
        });

        // Click effect
        document.addEventListener('mousedown', () => {
            cursorDot.classList.add('cursor-click');
            cursorRing.classList.add('cursor-click');
        });
        document.addEventListener('mouseup', () => {
            cursorDot.classList.remove('cursor-click');
            cursorRing.classList.remove('cursor-click');
        });
    } else {
        // Hide cursor elements on touch devices
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorRing) cursorRing.style.display = 'none';
    }

    /* ─────────────────────────────────────
       4. HERO TEXT SPLIT-CHARACTER REVEAL
       Groups chars into word containers so
       words don't break mid-word. Handles
       HTML entities (&amp; etc.) as units.
    ───────────────────────────────────── */
    const heroH1 = document.querySelector('.hero h1');
    if (heroH1) {
        const src = heroH1.innerHTML;
        let charIndex = 0;
        let result = '';
        let wordBuf = '';          // buffered char-spans for current word

        function flushWord() {
            if (wordBuf) {
                result += `<span class="word-wrap">${wordBuf}</span>`;
                wordBuf = '';
            }
        }

        for (let i = 0; i < src.length; i++) {
            const c = src[i];

            // ── HTML tag: flush word, pass tag through ──
            if (c === '<') {
                flushWord();
                let tag = '<';
                i++;
                while (i < src.length && src[i] !== '>') { tag += src[i]; i++; }
                tag += '>';
                result += tag;
                continue;
            }

            // ── Whitespace = word boundary ──
            if (c === ' ' || c === '\n' || c === '\r') {
                flushWord();
                result += c;
                continue;
            }

            // ── HTML entity (e.g. &amp;) → single unit ──
            if (c === '&') {
                let entity = '&';
                let j = i + 1;
                while (j < src.length && src[j] !== ';' && src[j] !== '<' && src[j] !== ' ' && (j - i) < 10) {
                    entity += src[j]; j++;
                }
                if (j < src.length && src[j] === ';') {
                    entity += ';';
                    i = j;
                    const delay = charIndex * 30;
                    wordBuf += `<span class="char-reveal" style="animation-delay:${delay}ms">${entity}</span>`;
                    charIndex++;
                    continue;
                }
            }

            // ── Normal character ──
            const delay = charIndex * 30;
            wordBuf += `<span class="char-reveal" style="animation-delay:${delay}ms">${c}</span>`;
            charIndex++;
        }
        flushWord();
        heroH1.innerHTML = result;
        heroH1.classList.add('text-revealed');
    }

    /* ─────────────────────────────────────
       5. PARALLAX SCROLL DEPTH
       Moves ambient blobs + elements at
       different scroll speeds
    ───────────────────────────────────── */
    let ticking = false;
    const parallaxElements = [
        { sel: '.ab1', speed: 0.3 },
        { sel: '.ab2', speed: 0.2 },
        { sel: '.ab3', speed: 0.15 },
        // Removed hero h1 and pill-badge — parallax was clobbering their animations
    ];

    const pEls = parallaxElements.map(p => ({
        el: document.querySelector(p.sel),
        speed: p.speed
    })).filter(p => p.el);

    function onParallaxScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            pEls.forEach(p => {
                const offset = scrollY * p.speed;
                // Use CSS custom property to avoid clobbering other transforms
                p.el.style.setProperty('--parallax-y', `${offset}px`);
            });
            ticking = false;
        });
    }
    window.addEventListener('scroll', onParallaxScroll, { passive: true });

    /* ─────────────────────────────────────
       6. MAGNETIC HOVER ON BUTTONS
       Buttons slightly move toward cursor
    ───────────────────────────────────── */
    document.querySelectorAll('.nav-cta, .compress-btn, .plan-btn.plan-fill, .download-btn').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) scale(1.02)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
            btn.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
            setTimeout(() => { btn.style.transition = ''; }, 400);
        });
    });

    /* ─────────────────────────────────────
       7. 3D TILT EFFECT ON CARDS
       Pure CSS/JS tilt on feature cards,
       tool cards, pricing columns, reviews
    ───────────────────────────────────── */
    document.querySelectorAll('.feat-card, .tool-card, .sp-review, .pricing-col').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px) scale(1.01)`;
            // Dynamic shine
            card.style.backgroundImage = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(0,212,170,0.06), transparent 60%)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.backgroundImage = '';
            card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), background-image 0.5s';
            setTimeout(() => { card.style.transition = ''; }, 500);
        });
    });

    /* ─────────────────────────────────────
       8. STAGGERED SECTION ENTRANCE
       Enhanced scroll reveal with different
       animation styles per section
    ───────────────────────────────────── */
    const advancedRevealObs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('anim-in');
                advancedRevealObs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

    // Section titles — slide up + fade
    document.querySelectorAll('.section-tag, .section-title, .section-sub').forEach((el, i) => {
        el.classList.add('anim-slide-up');
        el.style.animationDelay = `${i * 80}ms`;
        advancedRevealObs.observe(el);
    });

    // Feature cards — stagger from left
    document.querySelectorAll('.feat-card').forEach((el, i) => {
        el.classList.add('anim-fade-scale');
        el.style.animationDelay = `${i * 100}ms`;
        advancedRevealObs.observe(el);
    });

    // Tool cards
    document.querySelectorAll('.tool-card').forEach((el, i) => {
        el.classList.add('anim-fade-scale');
        el.style.animationDelay = `${i * 80}ms`;
        advancedRevealObs.observe(el);
    });

    // Steps
    document.querySelectorAll('.step').forEach((el, i) => {
        el.classList.add('anim-slide-up');
        el.style.animationDelay = `${i * 150}ms`;
        advancedRevealObs.observe(el);
    });

    // Stats items
    document.querySelectorAll('.sb-item').forEach((el, i) => {
        el.classList.add('anim-count-pop');
        el.style.animationDelay = `${i * 100}ms`;
        advancedRevealObs.observe(el);
    });

    // Pricing columns
    document.querySelectorAll('.pricing-col').forEach((el, i) => {
        el.classList.add('anim-slide-up');
        el.style.animationDelay = `${i * 200}ms`;
        advancedRevealObs.observe(el);
    });

    // Reviews
    document.querySelectorAll('.sp-review').forEach((el, i) => {
        el.classList.add('anim-fade-scale');
        el.style.animationDelay = `${i * 120}ms`;
        advancedRevealObs.observe(el);
    });

    /* ─────────────────────────────────────
       9. TYPING EFFECT ON HERO SUBTITLE
       Simulates typing for the key value prop
    ───────────────────────────────────── */
    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) {
        heroSub.classList.add('hero-sub-typed');
    }

    /* ─────────────────────────────────────
       10. SMOOTH SECTION PARALLAX
       Sections have subtle depth on scroll
    ───────────────────────────────────── */
    const sections = document.querySelectorAll('#features, #tools, #how, #compare, #pricing');
    const sectionObs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('section-visible');
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
    sections.forEach(s => sectionObs.observe(s));

    /* ─────────────────────────────────────
       11. NAV SCROLL ANIMATION
       Nav gets compact + shadow on scroll
    ───────────────────────────────────── */
    const mainNav = document.getElementById('mainNav');
    if (mainNav) {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const sy = window.scrollY;
            mainNav.classList.toggle('nav-scrolled', sy > 50);
            mainNav.classList.toggle('nav-hidden', sy > lastScroll && sy > 200);
            lastScroll = sy;
        }, { passive: true });
    }

    /* ─────────────────────────────────────
       12. COUNTER MORPHING EFFECT
       Numbers change with digit-by-digit
       slot machine animation on scroll
    ───────────────────────────────────── */
    // Already handled by existing animateCounter in script.js — enhanced via CSS

    /* ─────────────────────────────────────
       13. MODE TAB SWITCH ANIMATION
       Smooth morph between tabs
    ───────────────────────────────────── */
    const modeTabContainer = document.querySelector('.mode-tabs');
    if (modeTabContainer) {
        const tabSlider = document.createElement('div');
        tabSlider.className = 'tab-slider-bg';
        modeTabContainer.style.position = 'relative';
        modeTabContainer.prepend(tabSlider);

        function updateTabSlider() {
            const active = modeTabContainer.querySelector('.mode-tab.active');
            if (active) {
                tabSlider.style.width = active.offsetWidth + 'px';
                tabSlider.style.height = active.offsetHeight + 'px';
                tabSlider.style.left = active.offsetLeft + 'px';
                tabSlider.style.top = active.offsetTop + 'px';
            }
        }

        updateTabSlider();
        // Update on tab click
        modeTabContainer.addEventListener('click', () => {
            requestAnimationFrame(() => setTimeout(updateTabSlider, 10));
        });
        window.addEventListener('resize', updateTabSlider);
    }

    /* ─────────────────────────────────────
       14. PROGRESS BAR GLOW PULSE
    ───────────────────────────────────── */
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        const progObs = new MutationObserver(() => {
            const w = parseFloat(progressFill.style.width) || 0;
            if (w > 0 && w < 100) {
                progressFill.classList.add('progress-active');
            } else {
                progressFill.classList.remove('progress-active');
            }
        });
        progObs.observe(progressFill, { attributes: true, attributeFilter: ['style'] });
    }

    /* ─────────────────────────────────────
       15. EASTER EGG: KONAMI CODE
    ───────────────────────────────────── */
    let konamiSeq = [];
    const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    document.addEventListener('keydown', e => {
        konamiSeq.push(e.keyCode);
        if (konamiSeq.length > konamiCode.length) konamiSeq.shift();
        if (konamiSeq.join(',') === konamiCode.join(',')) {
            document.body.classList.add('party-mode');
            if (typeof showToast === 'function') showToast('🎉 Party Mode Activated!', 'success', 4000);
            setTimeout(() => document.body.classList.remove('party-mode'), 8000);
        }
    });

})();


