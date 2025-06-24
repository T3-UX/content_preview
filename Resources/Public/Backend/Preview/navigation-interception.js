(function () {
  function handleAppNavigation(uid) {
    window.pce_notifyParent('pce-open-page-uid', { uid });
  }

  function findAnchor(el) {
    while (el && el !== document && el.nodeType === 1) {
      if (el.tagName === 'A') return el;
      el = el.parentNode;
    }
    return null;
  }

  function interceptAnchorEvent(e) {
    const a = findAnchor(e.target);
    if (!a || !a.href) return;

    const isEditLink = a.classList.contains('pce-edit-link');
    if (isEditLink) return;

    e.preventDefault();
    e.stopPropagation();

    const uid = a.getAttribute('data-pce-page-uid');
    const navigationEnabled = document.body.getAttribute('data-pce-navigate-pages-in-typo3') === '1'

    if (navigationEnabled && uid) {
      handleAppNavigation(a.getAttribute('data-pce-page-uid'));
    } else {
      window.open(a.href, '_blank', 'noopener');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('click', interceptAnchorEvent, true);
    document.addEventListener('auxclick', interceptAnchorEvent, true);
  });
})();
