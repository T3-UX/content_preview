export class Dimmer {
    constructor({
                    color = 'rgba(0,0,0,.55)',
                    padding = 0,
                    zIndex = 2147483647,
                    position = 'absolute',
                    container = document.body,
                    active = true,
                    fallbackTarget = null
                } = {}) {
        this.color = color;
        this.padding = +padding || 0;
        this.zIndex = zIndex;
        this.position = position;
        this.container = container;
        this._active = !!active;
        this.fallbackTarget = fallbackTarget;

        this._build();
        this._bind();
        this._applyActive();
        this._schedule();
    }


    highlight(el) {
        if (this._target && this._target !== el) this._ro.unobserve(this._target);
        this._target = (el instanceof HTMLElement && el.isConnected) ? el : null;
        if (this._target) this._ro.observe(this._target);

        this._toggleTicker(!!this._target);
        this._schedule();
    }

    clear(fallback = this.fallbackTarget) {
        this.highlight(fallback);
    }

    setActive(on) {
        this._active = !!on;
        this._applyActive();
        this._toggleTicker(this._active && !!this._target);
        this._schedule();
    }

    setPadding(px) {
        this.padding = +px || 0;
        this._schedule();
    }

    setColor(c) {
        this.color = c;
        for (const b of this._bands) b.style.background = this.color;
    }

    destroy() {
        this._toggleTicker(false);
        this._ro.disconnect();
        window.removeEventListener('resize', this._schedule);
        document.removeEventListener('scroll', this._schedule, { capture: true });
        this.el.remove();
    }


    _build() {
        const el = document.createElement('div');
        el.className = 'dimmer';
        el.style.cssText = `
      position:${this.position};
      top:0;left:0;width:100%;height:100%;
      pointer-events:none;
      z-index:${this.zIndex};
    `;

        const mk = () => {
            const d = document.createElement('div');
            d.style.cssText = `
        position:absolute;
        background:${this.color};
        pointer-events:none;
      `;
            return d;
        };

        this._top = mk();
        this._left = mk();
        this._right = mk();
        this._bottom = mk();
        this._bands = [this._top, this._left, this._right, this._bottom];

        el.append(this._top, this._left, this._right, this._bottom);
        this.container.appendChild(el);
        this.el = el;
    }

    _bind() {
        this._schedule = () => {
            if (!this._active) return;
            if (this._rafOnce) return;
            this._rafOnce = requestAnimationFrame(() => {
                this._rafOnce = null;
                this._update();
            });
        };

        window.addEventListener('resize', this._schedule);
        document.addEventListener('scroll', this._schedule, { capture: true, passive: true });

        this._ro = new ResizeObserver(this._schedule);
    }

    _applyActive() {
        this.el.style.display = this._active ? '' : 'none';
    }

    _toggleTicker(on) {
        if (on) {
            if (this._ticker) return;
            const tick = () => {
                if (!this._ticker) return; // stopped
                const changed = this._computeRects(true);
                if (changed) this._layoutBands();
                this._ticker = requestAnimationFrame(tick);
            };
            this._ticker = requestAnimationFrame(tick);
        } else {
            if (this._ticker) cancelAnimationFrame(this._ticker);
            this._ticker = null;
        }
    }

    _update() {
        if (!this._computeRects(false)) return;
        this._layoutBands();
    }

    _computeRects(dryRun) {
        const ov = this.el.getBoundingClientRect();
        const ox = ov.left, oy = ov.top;
        const ow = Math.round(ov.width), oh = Math.round(ov.height);

        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

        if (this._target && this._target.isConnected) {
            const r = this._target.getBoundingClientRect();
            const pad = this.padding;

            x1 = Math.max(0, Math.min(ow, Math.round(r.left  - pad - ox)));
            y1 = Math.max(0, Math.min(oh, Math.round(r.top   - pad - oy)));
            x2 = Math.max(0, Math.min(ow, Math.round(r.right + pad - ox)));
            y2 = Math.max(0, Math.min(oh, Math.round(r.bottom+ pad - oy)));

            if (x2 <= x1 || y2 <= y1) x1 = y1 = x2 = y2 = 0;
        } else {
            x1 = y1 = x2 = y2 = 0;
        }

        const key =
            ow + ',' + oh + '|' +
            x1 + ',' + y1 + ',' + x2 + ',' + y2;

        if (key === this._lastKey) return false;
        if (!dryRun) this._lastKey = key;

        this._ow = ow; this._oh = oh;
        this._x1 = x1; this._y1 = y1; this._x2 = x2; this._y2 = y2;
        return true;
    }

    _layoutBands() {
        const { _ow: ow, _oh: oh, _x1: x1, _y1: y1, _x2: x2, _y2: y2 } = this;

        // top
        this._top.style.left = '0px';
        this._top.style.top = '0px';
        this._top.style.width = ow + 'px';
        this._top.style.height = y1 + 'px';

        const holeW = Math.max(0, x2 - x1);
        const holeH = Math.max(0, y2 - y1);

        // left
        this._left.style.left = '0px';
        this._left.style.top = y1 + 'px';
        this._left.style.width = x1 + 'px';
        this._left.style.height = holeH + 'px';

        // right
        this._right.style.left = x2 + 'px';
        this._right.style.top = y1 + 'px';
        this._right.style.width = Math.max(0, ow - x2) + 'px';
        this._right.style.height = holeH + 'px';

        // bottom
        this._bottom.style.left = '0px';
        this._bottom.style.top = y2 + 'px';
        this._bottom.style.width = ow + 'px';
        this._bottom.style.height = Math.max(0, oh - y2) + 'px';
    }
}