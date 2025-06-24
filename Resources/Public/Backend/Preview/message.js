(function() {
  const subscribers = [];
  function subscribe(type, callback) {
    subscribers.push([type, callback])
  }

  window.addEventListener("message", function (event) {
    for (const [type, callback] of subscribers) {
      if (event.data?.type !== type) continue;
      callback(event.data || {});
    }
  });

  function notifyParent(type, payload) {
    window.parent.postMessage({
      type,
      ...payload
    }, '*');
  }

  window.pce_subscribe = subscribe
  window.pce_notifyParent = notifyParent
})()
