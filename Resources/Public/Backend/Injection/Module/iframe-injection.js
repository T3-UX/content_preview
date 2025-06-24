//that is in PHP - it's code to inject
(() => {
    const PARENT = 'https://foo.bar';   // your TYPO3 backend origin
    const CLASS_TO_TRACK = '.t3-frame';

    const rectOf = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    };

    let observed = new Set(), visible = new Set(), needPush = false;

    const ENTER = ('onpointerenter' in window) ? 'pointerenter' : 'mouseenter';
    const LEAVE = ('onpointerleave' in window) ? 'pointerleave' : 'mouseleave';
    const listenerControllers = new WeakMap();
    const getId = (el) => el.id || el.getAttribute('data-id') || null;

    const sendHover = (state, el) => {
        const id = getId(el);
        if (!id) return;
        window.parent.postMessage({
            type: 'hover',
            state, // "enter" | "leave"
            id,
            rect: rectOf(el)
        }, PARENT);
    };

    const attachHoverListeners = (el) => {
        if (listenerControllers.has(el)) return;
        const ac = new AbortController();
        listenerControllers.set(el, ac);
        el.addEventListener(ENTER, () => sendHover('enter', el), { signal: ac.signal });
        el.addEventListener(LEAVE, () => sendHover('leave', el), { signal: ac.signal });
    };

    const detachHoverListeners = (el) => {
        const ac = listenerControllers.get(el);
        if (ac) { ac.abort(); listenerControllers.delete(el); }
    };
    // --------------------------------------------------------------------------

    const send = () => {
        if (!needPush) return;
        needPush = false;

        const items = [];
        visible.forEach((el) => {
            const id = getId(el);
            if (!id) return;
            items.push({ id, rect: rectOf(el) });
        });

        window.parent.postMessage({ type: 'hotspotUpdate', items }, PARENT);
    };

    const schedule = () => { needPush = true; requestAnimationFrame(send); };

    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                visible.add(e.target);
            } else {
                visible.delete(e.target);
            }
        });
        schedule();
    }, { root: null, threshold: 0, rootMargin: '100px' });

    const ro = new ResizeObserver(schedule);

    const mo = new MutationObserver(() => {
        document.querySelectorAll(CLASS_TO_TRACK).forEach((el) => {
            if (observed.has(el)) return;
            observed.add(el);
            io.observe(el);
            ro.observe(el);
            attachHoverListeners(el);
        });

        Array.from(observed).forEach((el) => {
            if (!el.isConnected || !el.matches(CLASS_TO_TRACK)) {
                io.unobserve(el);
                ro.unobserve(el);
                observed.delete(el);
                visible.delete(el);
                detachHoverListeners(el);
            }
        });

        schedule();
    });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (document.fonts?.ready) document.fonts.ready.then(schedule);

    mo.observe(document.documentElement, { subtree: true, childList: true });

    // initial scan
    document.querySelectorAll(CLASS_TO_TRACK).forEach((el) => {
        observed.add(el);
        io.observe(el);
        ro.observe(el);
        attachHoverListeners(el);
    });

    schedule();


    function detectTopObstructionHeight() {
        const vw = window.innerWidth;
        let maxBottom = 0;

        const all = document.body ? document.body.getElementsByTagName('*') : [];
        for (const el of all) {
            const st = getComputedStyle(el);
            if (
                (st.position === 'fixed' || st.position === 'sticky') &&
                st.visibility !== 'hidden' &&
                st.display !== 'none' &&
                parseFloat(st.opacity || '1') > 0
            ) {
                const r = el.getBoundingClientRect();
                if (r.top <= 0 && r.bottom > 0 && r.left < vw && r.right > 0) {
                    maxBottom = Math.max(maxBottom, r.bottom);
                }
            }
        }

        const vvTop = (window.visualViewport && window.visualViewport.offsetTop) || 0;

        return Math.max(0, Math.ceil(maxBottom - vvTop));
    }

    function scrollIntoViewSmart(target, opts = {}) {
        const {
            behavior = 'smooth',
            block = 'start',
            inline = 'nearest',
            extraOffset = 0,
            cleanup = true
        } = opts;

        const obstructionHeight = detectTopObstructionHeight() + (extraOffset || 0);
        const prevScrollMarginTop = target.style.scrollMarginTop;

        target.style.scrollMarginTop = `${obstructionHeight}px`;
        target.scrollIntoView({ behavior, block, inline });

        if (cleanup) {
            const restore = () => {
                target.style.scrollMarginTop = prevScrollMarginTop;
            };

            setTimeout(restore, behavior === 'smooth' ? 800 : 0);
        }
    }

    window.addEventListener('message', (ev) => {
        if (ev.origin !== PARENT) return;
        if (ev.data?.type !== 'pce-scroll-to-uid') return;

        const frame = document.querySelector(`#c${ev.data.uid}`)

        scrollIntoViewSmart(frame);
    });
})();