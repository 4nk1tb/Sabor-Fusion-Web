/* ==========================================================================
   Sabor Fusión: interacciones (sin dependencias, sin APIs externas).
   El "creador de rolls" y los mensajes de reserva funcionan en el propio navegador.
   ========================================================================== */
(() => {
    'use strict';

    // WhatsApp que recibe las reservas y los pedidos de roll. En esta demo es el de Yanki Tellez.
    // Para un restaurante real: número con prefijo de país, sin "+" ni espacios (ej. 5351234567).
    const WHATSAPP = '447495484687';

    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
    const money = (n) => `$${n.toFixed(2)}`;

    /* ------------------------------------------------------------------
       Cabecera, menú móvil y enlace activo
       ------------------------------------------------------------------ */
    const header = $('#site-header');
    const menuBtn = $('#menu-toggle');
    const mobileMenu = $('#mobile-menu');
    let menuOpen = false;

    (function headerState() {
        const sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none;';
        document.body.prepend(sentinel);
        new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
    })();

    function setMenu(open, restoreFocus) {
        menuOpen = open;
        mobileMenu.classList.toggle('is-open', open);
        mobileMenu.setAttribute('aria-hidden', String(!open));
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
        $$('main, footer, #actionbar').forEach((el) => (open ? el.setAttribute('inert', '') : el.removeAttribute('inert')));
        document.documentElement.style.overflow = open ? 'hidden' : '';
        if (open) { const first = $('[data-menu-link]', mobileMenu); if (first) first.focus({ preventScroll: true }); }
        else if (restoreFocus) menuBtn.focus();
    }
    menuBtn.addEventListener('click', () => setMenu(!menuOpen, false));
    $$('[data-menu-link]').forEach((a) => a.addEventListener('click', () => setMenu(false, false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false, true); });
    window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false, false); });

    (function activeLinks() {
        const links = $$('[data-nav]');
        const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                const link = map.get(en.target.id);
                if (!link) return;
                if (en.isIntersecting) { links.forEach((l) => l.removeAttribute('aria-current')); link.setAttribute('aria-current', 'true'); }
                else link.removeAttribute('aria-current');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    })();

    /* ------------------------------------------------------------------
       Revelado al hacer scroll
       ------------------------------------------------------------------ */
    (function reveal() {
        const items = $$('.reveal');
        if (reduce || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
        $$('.dishes, .menulist, .pillars, .bento').forEach((group) => {
            $$('.reveal', group).forEach((el, i) => el.style.setProperty('--d', `${(i % 3) * 0.09}s`));
        });
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        items.forEach((el) => io.observe(el));
    })();

    /* ------------------------------------------------------------------
       Barra de acción móvil (aparece al salir del hero, se esconde en reservas y pie)
       ------------------------------------------------------------------ */
    (function actionBar() {
        const bar = $('#actionbar');
        const hide = new Set(['top']);
        const sync = () => {
            const show = hide.size === 0 && !menuOpen;
            bar.classList.toggle('is-visible', show);
            bar.setAttribute('aria-hidden', String(!show));
            $$('a', bar).forEach((a) => (show ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
        };
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) hide.add(e.target.id); else hide.delete(e.target.id); });
            sync();
        }, { threshold: 0.05 });
        ['top', 'roll-creator', 'reservations', 'contact'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    })();

    /* ------------------------------------------------------------------
       Menú por pestañas (WAI-ARIA tabs)
       ------------------------------------------------------------------ */
    (function tabs() {
        const tabEls = $$('[role="tab"]');
        const select = (tab, focus) => {
            tabEls.forEach((t) => {
                const on = t === tab;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                $('#' + t.getAttribute('aria-controls')).hidden = !on;
            });
            if (focus) tab.focus();
        };
        tabEls.forEach((t, i) => {
            t.addEventListener('click', () => select(t, false));
            t.addEventListener('keydown', (e) => {
                const k = e.key;
                let n = null;
                if (k === 'ArrowRight') n = tabEls[(i + 1) % tabEls.length];
                else if (k === 'ArrowLeft') n = tabEls[(i - 1 + tabEls.length) % tabEls.length];
                else if (k === 'Home') n = tabEls[0];
                else if (k === 'End') n = tabEls[tabEls.length - 1];
                if (n) { e.preventDefault(); select(n, true); }
            });
        });
        select(tabEls[0], false);
    })();

    /* ------------------------------------------------------------------
       Crea tu propio roll
       ------------------------------------------------------------------ */
    const rollNote = { name: '', desc: '', price: 0, active: false };
    (function builder() {
        const OPT = {
            base: [
                { id: 'blanco', label: 'Arroz blanco', color: '#f4efe6' },
                { id: 'negro', label: 'Arroz negro', color: '#2d2624' },
                { id: 'coco', label: 'Arroz de coco', color: '#efe0bd' },
            ],
            protein: [
                { id: 'atun', label: 'Atún', color: '#c4423f', add: 3, nm: 'atún' },
                { id: 'salmon', label: 'Salmón', color: '#f08a5d', add: 3, nm: 'salmón' },
                { id: 'langosta', label: 'Langosta', color: '#eab9a1', add: 8, nm: 'langosta' },
                { id: 'camaron', label: 'Camarón tempura', color: '#f3c79b', add: 4, nm: 'camarón tempura' },
                { id: 'cerdo', label: 'Cerdo asado', color: '#a8683a', add: 3, nm: 'cerdo asado' },
                { id: 'vegetal', label: 'Solo vegetal', color: '#9fc467', add: 0, nm: 'aguacate y pepino' },
            ],
            tropical: [
                { id: 'mango', label: 'Mango', color: '#f4b73c', nm: 'mango' },
                { id: 'pina', label: 'Piña asada', color: '#f0d35a', nm: 'piña asada' },
                { id: 'platano', label: 'Plátano maduro', color: '#d9a63b', nm: 'plátano maduro' },
                { id: 'guayaba', label: 'Guayaba', color: '#e46b7a', nm: 'guayaba' },
            ],
            sauce: [
                { id: 'mojo', label: 'Mojo de cítricos', color: '#e9a23b', nm: 'mojo de cítricos' },
                { id: 'teriyaki', label: 'Teriyaki criollo', color: '#5a2c1b', nm: 'teriyaki criollo' },
                { id: 'cachucha', label: 'Ají cachucha', color: '#d1423a', nm: 'ají cachucha' },
                { id: 'ron', label: 'Glaseado de ron añejo', color: '#8a4b1f', nm: 'glaseado de ron añejo' },
            ],
            crunch: [
                { id: 'coco', label: 'Coco tostado', color: '#fff7e6', r: 2.6, nm: 'coco tostado' },
                { id: 'mani', label: 'Maní', color: '#c4955a', r: 3.2, nm: 'maní' },
                { id: 'chicharron', label: 'Chicharrón de plátano', color: '#e0b04c', r: 3.6, nm: 'chicharrón de plátano' },
                { id: 'tempura', label: 'Tempura crujiente', color: '#e8c27a', r: 3, nm: 'tempura crujiente' },
                { id: 'sesamo', label: 'Sésamo negro', color: '#17120f', r: 2.2, nm: 'sésamo negro' },
            ],
        };
        const BARRIOS = ['Vedado', 'Malecón', 'Habana Vieja', 'Miramar', 'Varadero', 'Cayo Hueso', 'Trinidad', 'Viñales', 'Playa del Este', 'Centro Habana'];
        const state = { base: 'blanco', protein: 'salmon', tropical: 'mango', sauce: 'cachucha', crunch: 'coco' };
        const get = (g) => OPT[g].find((o) => o.id === state[g]);

        // Opciones (radios agrupados: teclado y lectores de pantalla)
        Object.keys(OPT).forEach((g) => {
            const wrap = $('#opts-' + g);
            OPT[g].forEach((o) => {
                const label = document.createElement('label');
                label.className = 'chip';
                label.innerHTML = `<input type="radio" name="${g}" value="${o.id}"${state[g] === o.id ? ' checked' : ''}><span></span>`;
                $('span', label).textContent = o.label;
                wrap.appendChild(label);
            });
        });

        // Puntos crujientes en posiciones fijas (PRNG con semilla para que no salten)
        const crunchG = $('#roll-crunch');
        const dots = [];
        let seed = 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        for (let i = 0; i < 30; i++) {
            const a = rnd() * Math.PI * 2;
            const r = 74 + rnd() * 26;
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', (160 + Math.cos(a) * r).toFixed(1));
            c.setAttribute('cy', (160 + Math.sin(a) * r).toFixed(1));
            crunchG.appendChild(c);
            dots.push(c);
        }

        const svg = $('#roll-svg');
        const el = { rice: $('#roll-rice'), protein: $('#roll-protein'), tropical: $('#roll-tropical'), sauce: $('#roll-sauce'), name: $('#roll-name'), desc: $('#roll-desc'), price: $('#roll-price'), wa: $('#roll-wa'), add: $('#roll-add') };

        function compose() {
            const key = Object.values(state).join('|');
            let h = 0;
            for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
            const name = `Roll ${BARRIOS[h % BARRIOS.length]}`;
            const b = get('base'), p = get('protein'), t = get('tropical'), s = get('sauce'), c = get('crunch');
            const cap = p.nm.charAt(0).toUpperCase() + p.nm.slice(1);
            const desc = `${cap} y ${t.nm} sobre ${b.label.toLowerCase()}, con ${s.nm} y ${c.nm}.`;
            const price = 12 + (p.add || 0) + 1 + 1;
            return { name, desc, price };
        }

        function update(animate) {
            const b = get('base'), p = get('protein'), t = get('tropical'), s = get('sauce'), c = get('crunch');
            el.rice.setAttribute('fill', b.color);
            el.protein.setAttribute('fill', p.color);
            el.tropical.setAttribute('fill', t.color);
            el.sauce.setAttribute('stroke', s.color);
            dots.forEach((d, i) => {
                d.setAttribute('fill', c.id === 'sesamo' && i % 2 ? '#f3e9d7' : c.color);
                d.setAttribute('r', c.r + (i % 3 === 0 ? 0.5 : 0));
            });
            const r = compose();
            el.name.textContent = r.name;
            el.desc.textContent = r.desc;
            el.price.textContent = money(r.price);
            el.wa.href = waLink(`Hola Sabor Fusión, me gustaría probar mi roll personalizado: ${r.name}. ${r.desc} (precio orientativo ${money(r.price)}).`);
            Object.assign(rollNote, { name: r.name, desc: r.desc, price: r.price });
            if (rollNote.active) setRollNote(true);
            if (animate && !reduce) { svg.classList.remove('is-pop'); void svg.getBoundingClientRect(); svg.classList.add('is-pop'); }
        }

        $('#roll-form').addEventListener('change', (e) => {
            if (e.target.name in state) { state[e.target.name] = e.target.value; update(true); }
        });
        el.add.addEventListener('click', () => {
            setRollNote(true);
            const target = $('#reservations');
            target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            setTimeout(() => $('#f-name').focus({ preventScroll: true }), reduce ? 0 : 700);
        });
        update(false);
    })();

    /* ------------------------------------------------------------------
       Galería con visor
       ------------------------------------------------------------------ */
    (function lightbox() {
        const dlg = $('#lightbox');
        const img = $('#lightbox-img');
        const cap = $('#lightbox-cap');
        const items = $$('[data-lightbox]');
        let idx = 0;
        const show = (i) => {
            idx = (i + items.length) % items.length;
            const it = items[idx];
            img.src = it.dataset.full;
            img.alt = $('img', it).alt;
            cap.textContent = it.dataset.caption;
        };
        items.forEach((it, i) => it.addEventListener('click', () => { show(i); dlg.showModal(); }));
        $('#lb-close').addEventListener('click', () => dlg.close());
        $('#lb-prev').addEventListener('click', () => show(idx - 1));
        $('#lb-next').addEventListener('click', () => show(idx + 1));
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') show(idx - 1);
            if (e.key === 'ArrowRight') show(idx + 1);
        });
    })();

    /* ------------------------------------------------------------------
       Reservas por WhatsApp
       ------------------------------------------------------------------ */
    const form = $('#reservation-form');
    const summary = $('#summary');
    const noteBox = $('#roll-note');

    function setRollNote(on) {
        rollNote.active = on;
        noteBox.hidden = !on;
        if (on) $('#roll-note-text').textContent = `${rollNote.name}. ${rollNote.desc}`;
        const add = $('#roll-add');
        add.textContent = on ? 'Añadido a tu reserva' : 'Añadir a mi reserva';
    }
    $('#roll-note-remove').addEventListener('click', () => setRollNote(false));

    (function reservation() {
        const f = form.elements;
        // Horas cada 30 min: 12:00 a 22:30
        const timeSel = $('#f-time');
        for (let h = 12; h <= 22; h++) for (const m of ['00', '30']) {
            const v = `${String(h).padStart(2, '0')}:${m}`;
            const o = document.createElement('option');
            o.value = v; o.textContent = v;
            timeSel.appendChild(o);
        }
        // Fecha mínima: hoy, en hora local
        const d = new Date();
        f.date.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const parseDate = (v) => { const [y, m, dd] = v.split('-').map(Number); return new Date(y, m - 1, dd); };
        const fmtDate = (v) => parseDate(v).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const rules = {
            name: (v) => (v.trim().length < 2 ? 'Escribe tu nombre.' : ''),
            date: (v) => {
                if (!v) return 'Elige una fecha.';
                if (v < f.date.min) return 'Elige una fecha de hoy en adelante.';
                if (parseDate(v).getDay() === 1) return 'Los lunes estamos cerrados. Elige de martes a domingo.';
                return '';
            },
            time: (v) => (v ? '' : 'Elige una hora entre las 12:00 y las 22:30.'),
            guests: (v) => {
                const n = Number(v);
                if (!v) return 'Indica cuántas personas.';
                if (!Number.isInteger(n) || n < 1) return 'Indica al menos 1 persona.';
                if (n > 12) return 'Para más de 12 personas, escríbenos por WhatsApp.';
                return '';
            },
        };
        const validate = (name) => {
            const msg = rules[name](f[name].value);
            $('#e-' + name).textContent = msg;
            f[name].closest('.field').classList.toggle('is-invalid', !!msg);
            f[name].setAttribute('aria-invalid', msg ? 'true' : 'false');
            return !msg;
        };
        Object.keys(rules).forEach((n) => {
            f[n].addEventListener('blur', () => validate(n));
            f[n].addEventListener('input', () => { if (f[n].closest('.field').classList.contains('is-invalid')) validate(n); });
        });

        const SUGGEST = {
            '': 'Nos encantaría probar sus rolls fusión. Si es posible, una mesa cómoda y tranquila.',
            'Cumpleaños': 'Celebramos un cumpleaños. Si es posible, nos encantaría una mesa tranquila y un pequeño detalle de postre. Gracias.',
            'Aniversario': 'Es nuestro aniversario y queremos que la noche sea especial. Agradeceríamos una mesa con ambiente íntimo.',
            'Cena romántica': 'Buscamos una cena romántica. Una mesa tranquila, cerca de la terraza si es posible, sería perfecta.',
            'Reunión de amigos': 'Somos un grupo de amigos y queremos compartir varios rolls al centro. ¿Podrían sentarnos en una mesa amplia?',
            'Cena de negocios': 'Es una cena de trabajo. Preferimos una mesa tranquila donde podamos conversar con comodidad.',
            'Otra celebración': 'Celebramos una ocasión especial y agradeceríamos una mesa con buen ambiente.',
        };
        $('#suggest-btn').addEventListener('click', () => { f.notes.value = SUGGEST[f.occasion.value] || SUGGEST['']; f.notes.focus(); });

        const buildMessage = () => {
            const n = Number(f.guests.value);
            const lines = [
                'Hola Sabor Fusión, quiero reservar una mesa.',
                `Nombre: ${f.name.value.trim()}`,
                `Fecha: ${fmtDate(f.date.value)}`,
                `Hora: ${f.time.value}`,
                `Personas: ${n}`,
            ];
            if (f.occasion.value) lines.push(`Ocasión: ${f.occasion.value}`);
            if (rollNote.active) lines.push(`Roll personalizado: ${rollNote.name}. ${rollNote.desc}`);
            if (f.notes.value.trim()) lines.push(`Notas: ${f.notes.value.trim()}`);
            return lines.join('\n');
        };

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const names = Object.keys(rules);
            const ok = names.map(validate);
            if (ok.includes(false)) { f[names[ok.indexOf(false)]].focus(); return; }
            const n = Number(f.guests.value);
            const rows = [
                ['Nombre', f.name.value.trim()],
                ['Fecha', fmtDate(f.date.value)],
                ['Hora', f.time.value],
                ['Personas', String(n)],
            ];
            if (f.occasion.value) rows.push(['Ocasión', f.occasion.value]);
            if (rollNote.active) rows.push(['Tu roll', `${rollNote.name} (${money(rollNote.price)} orientativo)`]);
            if (f.notes.value.trim()) rows.push(['Notas', f.notes.value.trim()]);
            const dl = $('#summary-list');
            dl.textContent = '';
            rows.forEach(([k, v]) => {
                const row = document.createElement('div');
                const dt = document.createElement('dt'); dt.textContent = k;
                const dd = document.createElement('dd'); dd.textContent = v;
                row.append(dt, dd);
                dl.appendChild(row);
            });
            $('#summary-wa').href = waLink(buildMessage());
            form.hidden = true;
            noteBox.hidden = true;
            summary.hidden = false;
            $('h3', summary).setAttribute('tabindex', '-1');
            $('h3', summary).focus({ preventScroll: true });
            summary.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        });
        $('#summary-edit').addEventListener('click', () => {
            summary.hidden = true;
            form.hidden = false;
            noteBox.hidden = !rollNote.active;
            f.name.focus();
        });
    })();

    /* ------------------------------------------------------------------
       Pétalos de cerezo en el hero (canvas, pausado fuera de pantalla)
       ------------------------------------------------------------------ */
    (function petals() {
        const cv = $('#petals');
        if (!cv || reduce) return;
        const ctx = cv.getContext('2d');
        const hero = $('#top');
        const rand = (a, b) => a + Math.random() * (b - a);
        const TONES = ['243,191,203', '248,208,217', '236,164,182', '252,226,231'];
        let W = 0, H = 0, petals = [], raf = 0, last = 0, onScreen = true;
        const small = () => window.innerWidth < 768;

        function spawn(initial) {
            const m = small();
            return {
                x: m ? rand(-0.05, 0.6) * W : rand(0.5, 1.05) * W,
                y: initial ? rand(-0.1, 1) * H : rand(-0.14, 0.02) * H,
                s: rand(5, 11) * (m ? 0.85 : 1),
                vx: m ? rand(8, 30) : rand(-58, -16),
                vy: rand(22, 50),
                rot: rand(0, 6.28), vr: rand(-1.3, 1.3),
                sw: rand(0, 6.28), swA: rand(10, 32), swS: rand(0.6, 1.3),
                fl: rand(0, 6.28), flS: rand(1.5, 3.2),
                a: rand(0.5, 0.92), tone: TONES[(Math.random() * TONES.length) | 0],
            };
        }
        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const r = cv.getBoundingClientRect();
            W = r.width; H = r.height;
            cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = small() ? 14 : 30;
            while (petals.length < count) petals.push(spawn(true));
            petals.length = count;
        }
        function frame(t) {
            raf = requestAnimationFrame(frame);
            const dt = Math.min((t - last) / 1000 || 0.016, 0.05);
            last = t;
            ctx.clearRect(0, 0, W, H);
            for (let i = 0; i < petals.length; i++) {
                const p = petals[i];
                p.sw += p.swS * dt; p.rot += p.vr * dt; p.fl += p.flS * dt;
                p.x += (p.vx + Math.sin(p.sw) * p.swA) * dt;
                p.y += p.vy * dt;
                if (p.y > H + 24 || p.x < -40 || p.x > W + 40) { petals[i] = spawn(false); continue; }
                const s = p.s;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.scale(1, 0.35 + Math.abs(Math.cos(p.fl)) * 0.65);
                ctx.fillStyle = `rgba(${p.tone},${p.a})`;
                ctx.beginPath();
                ctx.moveTo(0, -s);
                ctx.bezierCurveTo(s * 0.95, -s * 0.7, s * 0.8, s * 0.65, 0, s);
                ctx.bezierCurveTo(-s * 0.8, s * 0.65, -s * 0.95, -s * 0.7, 0, -s);
                ctx.fill();
                ctx.restore();
            }
        }
        const run = () => { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
        const stop = () => { cancelAnimationFrame(raf); raf = 0; };
        resize();
        run();
        new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? run() : stop(); }).observe(hero);
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : run()));
        let t;
        window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 150); });
    })();
})();
