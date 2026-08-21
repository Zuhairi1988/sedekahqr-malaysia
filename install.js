document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('install-modal');
  const installButton = document.getElementById('install-app');
  const laterButton = document.getElementById('install-later');
  const iosSteps = document.getElementById('install-ios-steps');
  if (!modal || !installButton || !laterButton || !iosSteps) return;

  const storageKey = 'sedekahqr-install-prompt-dismissed-until';
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferredPrompt = null;
  let modalTrigger = null;
  const t = (text) => window.SedekahQRLanguage?.t?.(text) || text;
  const track = (name, parameters = {}) => window.gtag?.('event', name, parameters);

  const isDismissed = () => {
    try {
      return Number(window.localStorage.getItem(storageKey)) > Date.now();
    } catch {
      return false;
    }
  };

  const dismissForTwoWeeks = () => {
    try {
      window.localStorage.setItem(storageKey, String(Date.now() + (14 * 24 * 60 * 60 * 1000)));
    } catch {}
  };

  const closeModal = (remember = true) => {
    modal.hidden = true;
    document.body.classList.remove('install-open');
    if (remember) dismissForTwoWeeks();
    if (modalTrigger) modalTrigger.focus();
  };

  const openModal = () => {
    if (isStandalone || isDismissed() || !modal.hidden) return;
    modalTrigger = document.activeElement;
    iosSteps.hidden = !isIos;
    installButton.hidden = isIos;
    laterButton.textContent = isIos ? t('Faham') : t('Nanti');
    modal.hidden = false;
    document.body.classList.add('install-open');
    modal.querySelector('.reminder-close').focus();
    track('pwa_install_prompt_shown', { device: isIos ? 'ios' : 'android' });
  };

  const schedulePrompt = () => {
    window.setTimeout(openModal, 6000);
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    schedulePrompt();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    track('pwa_install_completed', { device: isIos ? 'ios' : 'android' });
    closeModal(false);
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installButton.disabled = true;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      track(choice.outcome === 'accepted' ? 'pwa_install_accepted' : 'pwa_install_dismissed', { device: 'android' });
      if (choice.outcome !== 'accepted') dismissForTwoWeeks();
      closeModal(false);
    } finally {
      deferredPrompt = null;
      installButton.disabled = false;
    }
  });

  laterButton.addEventListener('click', () => { track('pwa_install_later', { device: isIos ? 'ios' : 'android' }); closeModal(); });
  modal.querySelectorAll('[data-close-install]').forEach((button) => {
    button.addEventListener('click', () => closeModal());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  if (isIos && !isStandalone) schedulePrompt();
});
