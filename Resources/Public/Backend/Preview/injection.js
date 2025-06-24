(function () {
  let obstructionHeight = 0;

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

    obstructionHeight = detectTopObstructionHeight() + (extraOffset || 0);
    document.documentElement.style.setProperty('--pce-obstruction-height', `${obstructionHeight}px`)
    const prevScrollMarginTop = target.style.scrollMarginTop;

    target.style.scrollMarginTop = `${obstructionHeight}px`;
    target.scrollIntoView({ behavior, block, inline });
    target.classList.add('pce-target-highlight');

    if (cleanup) {
      const restore = () => {
        target.style.scrollMarginTop = prevScrollMarginTop;
        target.classList.remove('pce-target-highlight');
      };

      setTimeout(restore, behavior === 'smooth' ? 800 : 0);
    }
  }

  function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const viewHeight = (window.innerHeight || document.documentElement.clientHeight);
    const viewWidth = (window.innerWidth || document.documentElement.clientWidth);

    return {
      isVisible: (
        rect.top < viewHeight &&
        rect.bottom - obstructionHeight * 2 > 0 &&
        rect.left < viewWidth &&
        rect.right > 0
      ),
      rect,
    }
  }

  let contentElement = null

  window.addEventListener('scroll', () => {
    if (!contentElement) return;

    const { isVisible, rect } = isElementInViewport(contentElement)
    if (isVisible) {
      document.body.removeAttribute('data-pce-focused-above');
      document.body.removeAttribute('data-pce-focused-below');
      return;
    }

    const isElementAbove = rect.top < 0;

    if (isElementAbove) {
      document.body.setAttribute('data-pce-focused-above', '1');
    } else {
      document.body.setAttribute('data-pce-focused-below', '1');
    }
  })

  window.pce_subscribe(
    'pce-scroll-to-uid',
    ({ uid }) => {
      contentElement = document.querySelector(`[data-pce-uid="${uid}"]`)
      if (!contentElement) return;

      const indicators = document.querySelectorAll('.pce-indicator');
      indicators.forEach((indicator) => {
        indicator.addEventListener('click', () => {
          scrollIntoViewSmart(contentElement);
        })
      })

      contentElement.setAttribute('data-pce-focused', '');
      const editLink = contentElement.querySelector('.pce-edit-link');
      editLink.innerHTML = editLink.getAttribute('data-label-editing');
      scrollIntoViewSmart(contentElement)
    }
  )

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a.pce-edit-link');
    if (!link) return;
    e.preventDefault();

    var host = e.target.closest('.pce-target, .pce-wrapper');
    var uid = host ? parseInt(host.getAttribute('data-pce-uid') || '0', 10) : 0;

    try { if (uid && window.top && window.top.sessionStorage) { window.top.sessionStorage.setItem('pceFocusUid', String(uid)); } } catch (err) { }
    try { window.pce_notifyParent('pce-open-edit-uid', { uid: uid }); } catch (err) { }
  }, false);
})();
