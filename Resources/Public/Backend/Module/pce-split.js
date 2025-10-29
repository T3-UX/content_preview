/*
 * This file is part of the TYPO3 CMS project.
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 *
 * The TYPO3 project - inspiring people to share!
 */
class PceSplitModule {
    constructor() {
        /** @private */
        this._initialized = false;
    }

    _bootLog(...args)  { try { console.debug("[PCE]", ...args); } catch {} }
    _bootWarn(...args) { try { console.warn("[PCE]", ...args); } catch {} }
    _bootError(...args){ try { console.error("[PCE]", ...args); } catch {} }

    /**
     * @param {any[]} rawArgs
     * @returns {{previewUrl:string,recordEditBase:string,returnUrlBase:string,pagesUrlBase:string,focusUid:number,debug:boolean,maxWaitMs:number,pollEveryMs:number}}
     * @private
     */
    _normalizeConfig(rawArgs) {
        if (rawArgs.length >= 2 && typeof rawArgs[0] === "string") {
            const [p0, p1, p2, p3, extra = {}] = rawArgs;
            return {
                previewUrl: p0 || "",
                recordEditBase: p1 || "",
                returnUrlBase: p2 || "",
                pagesUrlBase: p3 || "",
                focusUid: Number(extra.focusUid) || 0,
                debug: typeof extra.debug === "boolean" ? extra.debug : true,
                maxWaitMs: Number(extra.maxWaitMs) || 5000,
                pollEveryMs: Number(extra.pollEveryMs) || 150,
            };
        }

        const cfg = rawArgs[0] ?? {};
        const looksLikeArrayish =
            Array.isArray(cfg) ||
            (cfg && typeof cfg === "object" && ("0" in cfg || "1" in cfg || "2" in cfg || "3" in cfg));

        if (looksLikeArrayish) {
            return {
                previewUrl: cfg[0] || "",
                recordEditBase: cfg[1] || "",
                returnUrlBase: cfg[2] || "",
                pagesUrlBase: cfg[3] || "",
                focusUid: Number(cfg.focusUid || cfg[4]?.focusUid) || 0,
                debug: typeof cfg.debug === "boolean" ? cfg.debug : true,
                maxWaitMs: Number(cfg.maxWaitMs) || 5000,
                pollEveryMs: Number(cfg.pollEveryMs) || 150,
            };
        }

        return {
            previewUrl: cfg.previewUrl || "",
            recordEditBase: cfg.recordEditBase || "",
            returnUrlBase: cfg.returnUrlBase || "",
            pagesUrlBase: cfg.pagesUrlBase || "",
            focusUid: Number(cfg.focusUid) || 0,
            debug: typeof cfg.debug === "boolean" ? cfg.debug : true,
            maxWaitMs: Number(cfg.maxWaitMs) || 5000,
            pollEveryMs: Number(cfg.pollEveryMs) || 150,
        };
    }

    boot(...rawArgs) {
        if (this._initialized) { this._bootLog("boot: already initialized"); return; }
        this._initialized = true;

        const {
            previewUrl,
            recordEditBase,
            returnUrlBase,
            pagesUrlBase,
            focusUid,
            debug,
            maxWaitMs,
            pollEveryMs,
        } = this._normalizeConfig(rawArgs);

        if (!debug) {
            this._bootLog = () => {};
            this._bootWarn = () => {};
            this._bootError = () => {};
        }

        if (!previewUrl) {
            this._bootWarn("boot: missing previewUrl → abort");
            return;
        }

        const start = performance.now();
        const waitForForm = (resolve) => {
            const form = this._findForm();
            if (form) {
                this._bootLog("boot: form/container found:", form);
                resolve(form);
                return;
            }
            if (performance.now() - start > maxWaitMs) {
                this._bootWarn("boot: form not found within", maxWaitMs, "ms → giving up");
                resolve(null);
                return;
            }
            setTimeout(() => waitForForm(resolve), pollEveryMs);
        };

        new Promise(waitForForm).then((form) => {
            if (!form) return;
            try {
                this._attachSplit(previewUrl, focusUid, recordEditBase, returnUrlBase, pagesUrlBase);
            } catch (e) {
                this._bootError("attachSplit threw:", e);
            }
        });
    }

    _findForm() {
        const candidates = [
            "#PageLayoutController",
            "#EditDocumentController",
            'form[name="editform"]',
            ".module-body form",
            ".module-body",
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    _attachSplit(previewUrl, focusUid, recordEditBase, returnUrlBase, pageUrlBase) {

        const form = this._findForm();
        if (!form) { this._bootWarn("_attachSplit: no form/container found → abort"); return; }

        const root = form.parentElement || form;
        if (!root) { this._bootWarn("_attachSplit: no root parent → abort"); return; }
        if (root.querySelector(".pce-split")) { this._bootLog("_attachSplit: already present"); return; }

        const split = document.createElement("div");
        split.className = "pce-split";
        const left = document.createElement("div");
        left.className = "pce-left";
        const right = document.createElement("div");
        right.className = "pce-right";
        root.appendChild(split);
        split.appendChild(left);
        split.appendChild(right);

        const moved = [];
        Array.from(root.childNodes)
            .filter((n) => n !== split)
            .forEach((n) => { left.appendChild(n); moved.push(n); });

        const moduleBody = root.closest(".module-body") || document.body;
        const rect = moduleBody?.getBoundingClientRect?.();
        const moduleBodyHeight = rect ? rect.height : window.innerHeight;
        const paddedModuleBodyHeight = Math.max(0, moduleBodyHeight - 48);
        document.documentElement.style.setProperty("--pce-module-body-height", `${paddedModuleBodyHeight}px`);

        const iframe = document.createElement("iframe");
        iframe.id = "pcePreview";
        iframe.setAttribute("loading", "lazy");
        iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");

        const url = new URL(previewUrl, location.href);
        url.searchParams.set("pce", "1");
        iframe.src = url.toString();
        right.appendChild(iframe);

        setTimeout(() => {
            right.style.setProperty("height", paddedModuleBodyHeight + "px");
            this._bootLog("_attachSplit: right.height =", paddedModuleBodyHeight);
        }, 0);

        let focusedUid = focusUid;

        if (!focusedUid) {
          try {
            const sessionUid = sessionStorage.getItem('pceFocusUid')
            focusedUid = parseInt(sessionUid || '0', 10)
          } catch {
            focusedUid = focusUid
          }
        }
        try { sessionStorage.removeItem("pceFocusUid"); } catch {}

        const notifyFocusedIframe = () => {
            if (focusedUid) {
                try {
                    iframe.contentWindow?.postMessage({ type: "pce-scroll-to-uid", uid: focusedUid }, "*");
                    this._bootLog("iframe: postMessage scroll to uid", focusedUid);
                } catch (e) {
                    this._bootWarn("iframe: postMessage failed", e);
                }
            }
        }

        iframe.addEventListener("load", () => {
            this._bootLog("iframe: load", iframe.src);
            notifyFocusedIframe();
        });

        window.addEventListener("message", (e) => {
            const msg = e?.data || {};
            if (!msg?.type) return;
            this._bootLog("window.message:", msg);
            switch (msg.type) {
                case "pce-open-edit-uid":
                    this._navigateToContentElement(msg.uid, recordEditBase, returnUrlBase);
                    break;
                case "pce-open-page-uid":
                    this._navigateToPage(msg.uid, pageUrlBase);
                    break;
                case "pce-preview-ready":
                    notifyFocusedIframe();
                    break;
                default:
                    break;
            }
        });

        left.addEventListener("click", (e) => {
            const a = e.target?.closest?.("a");
            if (!a) return;
            const href = a.getAttribute("href") || "";
            if (!href) return;

            const isRecordEdit =
                /\/typo3\/record\/edit\b/.test(href) ||
                /[?&]route=record_edit\b/.test(href);
            if (!isRecordEdit) return;

            const uid = this._extractUidFromHref(href);
            if (!uid) return;

            try { sessionStorage.setItem("pceFocusUid", String(uid)); } catch {}

            const topWin = window.top || window;
            const ContentContainer = topWin?.TYPO3?.Backend?.ContentContainer;
            if (ContentContainer && typeof ContentContainer.setUrl === "function") {
                e.preventDefault();
                this._bootLog("intercept edit → setUrl()", { uid, href });
                ContentContainer.setUrl(href);
            } else {
                this._bootLog("no ContentContainer → let the browser navigate");
            }
        });
    }

    _navigateToContentElement(uid, recordEditBase, returnUrlBase) {
        const parsed = parseInt(uid || "0", 10);
        if (!parsed || !recordEditBase || !returnUrlBase) return;

        const anchor = "#element-tt_content-" + parsed;
        const href =
            recordEditBase +
            "&edit[tt_content][" + parsed + "]=edit" +
            "&returnUrl=" + encodeURIComponent(returnUrlBase + anchor) +
            anchor;

        try { sessionStorage.setItem("pceFocusUid", String(parsed)); } catch {}
        this._setTypo3Url(href);
    }

    _navigateToPage(uid, pageUrlBase) {
        const parsed = parseInt(uid || "0", 10);
        if (!parsed || !pageUrlBase) return;

        const u = new URL(pageUrlBase, window.location?.origin || location.origin);
        u.searchParams.set("id", String(parsed));
        const href = u.pathname + u.search + u.hash;
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

    _extractUidFromHref(href) {
        try {
            const url = new URL(href, window.top?.location?.origin || location.origin);
            const decoded = decodeURIComponent(url.search || "");
            let m = decoded.match(/edit\[tt_content\]\[(\d+)\]=edit/);
            if (m) return parseInt(m[1], 10);
            m = (url.hash || "").match(/element-tt_content-(\d+)/);
            if (m) return parseInt(m[1], 10);
        } catch (_e) {
            const s = String(href || "")
                .replace(/%5B/gi, "[")
                .replace(/%5D/gi, "]");
            let m = s.match(/edit\[tt_content\]\[(\d+)\]=edit/);
            if (m) return parseInt(m[1], 10);
            m = s.match(/element-tt_content-(\d+)/);
            if (m) return parseInt(m[1], 10);
        }
        return 0;
    }
}

export default new PceSplitModule();
