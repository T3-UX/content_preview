(function(){
  const overlay = document.getElementById('pce-dim');
  const defaultTarget = document.getElementById('highlightMe');
  let currentTarget = defaultTarget;

  function setHole(top, right, bottom, left){
    overlay.style.setProperty('--hole-top', top + 'px');
    overlay.style.setProperty('--hole-right', right + 'px');
    overlay.style.setProperty('--hole-bottom', bottom + 'px');
    overlay.style.setProperty('--hole-left', left + 'px');
  }

  function updateHole(el, pad=8){
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top    = Math.max(0, r.top    - pad);
    const left   = Math.max(0, r.left   - pad);
    const right  = Math.max(0, window.innerWidth  - (r.right  + pad));
    const bottom = Math.max(0, window.innerHeight - (r.bottom + pad));
    setHole(top, right, bottom, left);
  }

  function highlight(el){
    currentTarget = el || defaultTarget;
    updateHole(currentTarget);
  }

  window.addEventListener('scroll', ()=>updateHole(currentTarget), { passive: true });
  window.addEventListener('resize', ()=>updateHole(currentTarget));

  document.querySelectorAll('.pce-target').forEach(cand=>{
    cand.addEventListener('mouseenter', ()=>highlight(cand));
    cand.addEventListener('mouseleave', ()=>highlight(defaultTarget));
  });

  overlay.style.display = 'block';
  highlight(defaultTarget);
})();
