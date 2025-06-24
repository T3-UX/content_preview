import { Frame } from './frame.js';
import { Dimmer } from './dimmer.js';

export class IframePreview {
    #overlay   = null;
    #element   = null;
    iframeElement    = null;
    #frames    = [];
    focusedUid = null;

    options = {
        'always-show-links': {
            checked: false,
            label: 'Always show links',
        },
        'dim-inactive': {
            checked: true,
            label: 'Dim inactive targets',
        },
        'show-outline-on-link-hover': {
            checked: true,
            label: 'Show outline on link hover',
        },
        'show-outline-on-target-hover': {
            checked: false,
            label: 'Show outline on target hover',
        },
        'always-show-outline': {
            checked: false,
            label: 'Always show outlines',
        },
        'show-location-indicators': {
            checked: true,
            label: 'Show location indicators',
        },
        'navigate-pages-in-typo3': {
            checked: false,
            label: 'Navigate pages in TYPO3',
        }
    }

    constructor(previewUrl, recordEditBase, returnUrlBase) {
        this.previewUrl = previewUrl;
        this.recordEditBase = recordEditBase;
        this.returnUrlBase = returnUrlBase;
    }

    get iframeBody() {
        return this.iframeElement.contentWindow.document.body;
    }

    createOverlay() {
        if (this.#overlay) {
            return this.#overlay;
        }

        const overlay = document.createElement('div');
        overlay.style = `
      position: absolute;
      overflow: hidden;
      pointer-events: none;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
    `;
        this.#overlay = overlay;

        return this.#overlay;
    }

    getFrame(id) {
        return this.#frames.find((frame) => frame.id === id);
    }

    updateFrame(id, x, y, width, height) {
        const existing = this.getFrame(id);
        if (existing) {
            existing.x = x;
            existing.y = y;
            existing.width = width;
            existing.height = height;
            existing.update();
            return
        }

        const frame = new Frame(id, x, y, width, height, this.options, this.dimmer);
        frame.onClick = this.navigateToContentElement.bind(this);
        this.#overlay.appendChild(frame.element);

        this.#frames.push(frame);
    }

    onMouseMove(e) {
        if (!this.#overlay || this.#frames.length === 0) return;

        if (this._hoverRaf) return;
        this._hoverRaf = requestAnimationFrame(() => {
            this._hoverRaf = null;

            const rect = this.#overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let hovered = null;
            for (let i = this.#frames.length - 1; i >= 0; i--) {
                const f = this.#frames[i];
                if (x >= f.x && x <= f.x + f.width &&
                    y >= f.y && y <= f.y + f.height) {
                    hovered = f;
                    break;
                }
            }

            for (const f of this.#frames) {
                const isHover = f === hovered;
                if (f.hover !== isHover) {
                    f.hover = isHover;
                    if (typeof f.update === 'function') f.update();
                }
            }
        });
    }

    attachMessageListener() {
        window.addEventListener('message', (e) => {
            const msg = e?.data || {};
            if (msg?.type === 'hotspotUpdate') {
                e.stopPropagation();
                e.stopImmediatePropagation();

                for (const frame of msg.items) {
                    this.updateFrame(frame.id, frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h);
                }

                const isHovering = this.#frames.some((frame) => frame.hover);
                if (!isHovering) {
                    const focusedFrame = this.getFrame(`c${this.focusedUid}`);
                    this.dimmer.fallbackTarget = focusedFrame?.element || null;
                    this.dimmer.highlight(focusedFrame?.element || null);
                }
            }

            if (msg?.type === 'hover') {
                e.stopPropagation();
                e.stopImmediatePropagation();

                const frame = this.getFrame(msg.id);
                if (!frame) return;

                if (msg.state === 'enter') {
                    this.dimmer.highlight(frame.element);
                    frame.hover = true;
                } else if (!frame.controlsHover) {
                    this.dimmer.clear();
                    frame.hover = false;
                }
            }
        })
    }

    createElement() {
        if (this.#element) {
            return this.#element;
        }

        const wrapper = document.createElement('div');
        wrapper.id = "pcePreviewWrapper";
        wrapper.style = `
      position: relative;
    `;

        const iframe = document.createElement('iframe');
        iframe.id = "pcePreview";
        iframe.setAttribute("loading", "lazy");
        iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
        this.iframeElement = iframe;

        const overlay = this.createOverlay();

        wrapper.appendChild(overlay);
        wrapper.appendChild(iframe);

        this.dimmer = new Dimmer({ container: wrapper });

        const url = new URL(this.previewUrl, window.location.href);
        url.searchParams.set("pce", "1");
        iframe.src = url.toString();
        this.#element = wrapper;

        this.attachMessageListener();
        this.#element.addEventListener('mousemove', this.onMouseMove.bind(this));

        return this.#element;
    }

    navigateToContentElement(uid) {
        const parsed = parseInt(uid.slice(1) || "0", 10);
        if (!parsed || !this.recordEditBase || !this.returnUrlBase) return;

        const anchor = "#element-tt_content-" + parsed;
        const href =
            this.recordEditBase +
            "&edit[tt_content][" + parsed + "]=edit" +
            "&returnUrl=" + encodeURIComponent(this.returnUrlBase + anchor) +
            anchor;

        try { sessionStorage.setItem("pceFocusUid", String(parsed)); } catch {}
        this._setTypo3Url(href);
    }

    _setTypo3Url(href) {
        const topWin = window.top || window;
        const Backend = topWin?.TYPO3?.Backend;
        const ContentContainer = Backend?.ContentContainer;
        if (ContentContainer && typeof ContentContainer.setUrl === "function") {
            ContentContainer.setUrl(href);
        } else {
            topWin.location.href = href;
        }
    }
}