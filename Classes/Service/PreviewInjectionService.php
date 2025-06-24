<?php

declare(strict_types=1);

namespace T3UX\ContentPreview\Service;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use TYPO3\CMS\Backend\Routing\UriBuilder as BackendUriBuilder;
use TYPO3\CMS\Core\Utility\PathUtility;
use TYPO3\CMS\Extbase\Utility\LocalizationUtility;
use T3UX\ContentPreview\Utility\PreviewHelper;

final class PreviewInjectionService
{
    public function __construct(
        private readonly BackendUriBuilder $backendUriBuilder,
        private readonly PreviewHelper $previewHelper
    ) {}

    public function applyInjection(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $html = (string)$response->getBody();

        if ($this->previewHelper->isPostMessagesEnabled()) {
            $html = $this->injectEditButtons($html);
            $html = $this->injectClientJsAndCssFull($html);
            $html = $this->injectGlobalElements($html);
        } else {
            $html = $this->injectClientJsAndCssLite($html);
            $html = $this->injectHotspotTracker($html, $request);
        }

        $body = $response->getBody();
        $body->rewind();
        $body->write($html);

        return $response;
    }

    private function injectEditButtons(string $html): string
    {
        $pattern = '#<(?P<tag>div|section|article|aside|figure)\b(?P<attrs>[^>]*)\bid="c(?P<uid>\d+)"(?P<tail>[^>]*)>#i';

        $currentPid = (int)($GLOBALS['TSFE']->id ?? 0);

        $labelEditRaw = LocalizationUtility::translate('LLL:EXT:content_preview/Resources/Private/Language/locallang_mod.xlf:pce.button.edit') ?? 'Edit';
        $labelEditingRaw = LocalizationUtility::translate('LLL:EXT:content_preview/Resources/Private/Language/locallang_mod.xlf:pce.button.editing') ?? 'You are editing this element';
        $labelEdit = htmlspecialchars($labelEditRaw, ENT_QUOTES);
        $labelEditing = htmlspecialchars($labelEditingRaw, ENT_QUOTES);

        return preg_replace_callback($pattern, function (array $m) use ($currentPid, $labelEdit, $labelEditing): string {
            $tag = $m['tag'];
            $uid = (int)$m['uid'];
            $attrs = $m['attrs'] . $m['tail'];

            if (preg_match('/\bclass\s*=\s*([\'"])(.*?)\1/i', $attrs)) {
                $attrs = preg_replace('/\bclass\s*=\s*([\'"])(.*?)\1/i', 'class="$2 pce-target"', $attrs, 1);
            } else {
                $attrs .= ' class="pce-target"';
            }
            $attrs .= ' data-pce-uid="' . $uid . '"';

            $returnUri = $this->backendUriBuilder->buildUriFromRoute('web_layout', ['id' => $currentPid > 0 ? $currentPid : 0]);
            $returnUrl = (string)$returnUri . '#element-tt_content-' . $uid;

            $editUri = $this->backendUriBuilder->buildUriFromRoute('record_edit', [
                'edit' => ['tt_content' => [$uid => 'edit']],
                'returnUrl' => $returnUrl,
            ]);
            $editUrl = (string)$editUri . '#element-tt_content-' . $uid;

            $opening = '<' . $tag . $attrs . '>';
            $buttonText = '✎ ' . $labelEdit;
            $button = '<a href="' . htmlspecialchars($editUrl, ENT_QUOTES) . '" class="pce-edit-link" aria-label="' . $labelEdit . '" data-label-edit="' . $buttonText . '" data-label-editing="✎ ' . $labelEditing . '">' . $buttonText . '</a>';

            return $opening . $button;
        }, $html) ?: $html;
    }

    private function injectClientJsAndCssFull(string $html): string
    {
        $injection = <<<'HTML'
<link rel="stylesheet" href="%s"/>
<link rel="stylesheet" href="%s"/>
<script src="%s"></script>
<script src="%s"></script>
<script src="%s"></script>
<script src="%s"></script>
HTML;

        $output = sprintf(
            $injection,
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/pce-config-panel.css'),
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/injection.css'),
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/message.js'),
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/navigation-interception.js'),
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/injection.js'),
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/pce-config-panel.js')
        );

        return preg_replace('{</head>}i', $output . "\n</head>", $html, 1) ?: $html;
    }

    private function injectGlobalElements(string $html): string
    {
        $injection = <<<'HTML'
<pce-config-panel></pce-config-panel>

<div class="pce-indicator pce-indicator-above">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Material Design Icons by Pictogrammers - https://github.com/Templarian/MaterialDesign/blob/master/LICENSE --><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z"/></svg>
</div>

<div class="pce-indicator pce-indicator-below">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Material Design Icons by Pictogrammers - https://github.com/Templarian/MaterialDesign/blob/master/LICENSE --><path fill="currentColor" d="M7.41 8.58L12 13.17l4.59-4.59L18 10l-6 6l-6-6z"/></svg>
</div>
HTML;

        return preg_replace('{</body>}i', $injection . "\n</body>", $html, 1) ?: $html;
    }

    private function injectClientJsAndCssLite(string $html): string
    {
        $injection = <<<'HTML'
<link rel="stylesheet" href="%s"/>
<link rel="stylesheet" href="%s"/>
HTML;

        $output = sprintf(
            $injection,
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/injection.css'),
            PathUtility::getPublicResourceWebPath('EXT:content_preview/Resources/Public/Backend/Preview/pce-config-panel.css'),
        );

        return preg_replace('{</head>}i', $output . "\n</head>", $html, 1) ?: $html;
    }

    private function injectHotspotTracker(string $html, ServerRequestInterface $request): string
    {
        $parent = $this->getRequestBase($request);
        $classToTrack = '.frame';

        $script = <<<JS
(() => {
  const PARENT = '{$parent}';
  const CLASS_TO_TRACK = '{$classToTrack}';

  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  let observed = new Set(), visible = new Set(), needPush = false;

  const ENTER = ('onpointerenter' in window) ? 'pointerenter' : 'mouseenter';
  const LEAVE = ('onpointerleave' in window) ? 'pointerleave' : 'mouseleave';
  const listenerControllers = new WeakMap(); // el -> AbortController
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
    // subscribe new matches
    document.querySelectorAll(CLASS_TO_TRACK).forEach((el) => {
      if (observed.has(el)) return;
      observed.add(el);
      io.observe(el);
      ro.observe(el);
      attachHoverListeners(el); // <-- NEW
    });

    // cleanup removed / no longer matching
    Array.from(observed).forEach((el) => {
      if (!el.isConnected || !el.matches(CLASS_TO_TRACK)) {
        io.unobserve(el);
        ro.unobserve(el);
        observed.delete(el);
        visible.delete(el);
        detachHoverListeners(el); // <-- NEW
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
    attachHoverListeners(el); // <-- NEW
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

  /**
   * Allows to scroll element into view considering the obstructing elements (such as fixed header)
   */
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

    target.style.scrollMarginTop = `\${obstructionHeight}px`;
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

    const frame = document.querySelector(`#c\${ev.data.uid}`)

    scrollIntoViewSmart(frame);
  });
})();
JS;


        $injection = "<script>{$script}</script>";
        $withBody = preg_replace('{</body>}i', $injection . "\n</body>", $html, 1);
        if ($withBody !== null && $withBody !== $html) {
            return $withBody;
        }
        return preg_replace('{</head>}i', $injection . "\n</head>", $html, 1) ?: $html;
    }

    private function getRequestBase(ServerRequestInterface $request): string
    {
        $site = $request->getAttribute('site');
        if ($site) {
            return rtrim((string)$site->getBase(), '/');
        }
        $uri = $request->getUri();
        $authority = $uri->getAuthority();
        return $uri->getScheme() . '://' . $authority;
    }
}
