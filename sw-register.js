(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js?v=20260821-15', {
      scope: './',
      updateViaCache: 'none'
    }).catch(() => {
      // The site remains fully usable when service workers are unavailable.
    });
  });
})();
