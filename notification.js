document.addEventListener('DOMContentLoaded', () => {
  const openButton = document.getElementById('open-reminder');
  const modal = document.getElementById('reminder-modal');
  const form = document.getElementById('reminder-form');
  if (!openButton || !modal || !form) return;

  const closeButtons = [...modal.querySelectorAll('[data-close-reminder]')];
  const zoneSelect = document.getElementById('reminder-zone-select');
  const consent = document.getElementById('reminder-consent');
  const enableButton = document.getElementById('enable-reminder');
  const disableButton = document.getElementById('disable-reminder');
  const testButton = document.getElementById('test-reminder');
  const installNote = document.getElementById('reminder-install-note');
  const status = document.getElementById('reminder-status');
  const storageKey = 'sedekahqr-subuh-reminder';
  const prayerZoneKey = 'sedekahqr-prayer-zone';
  const pushConfig = window.SEDEKAHQR_PUSH;
  const zones = Array.isArray(window.PRAYER_ZONES) ? window.PRAYER_ZONES : [];
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let serviceWorkerRegistration = null;
  let modalTrigger = null;

  const readSettings = () => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  };

  const writeSettings = (settings) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {}
  };

  const removeSettings = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  };

  const getPrayerZone = () => {
    try {
      return window.localStorage.getItem(prayerZoneKey) || 'WLY01';
    } catch {
      return 'WLY01';
    }
  };

  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = `reminder-status${type ? ` is-${type}` : ''}`;
  };

  const showToast = (message) => {
    const toast = document.getElementById('site-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2800);
  };

  const populateZones = () => {
    const fragment = document.createDocumentFragment();
    [...new Set(zones.map((item) => item.negeri))].forEach((state) => {
      const group = document.createElement('optgroup');
      group.label = state;
      zones.filter((item) => item.negeri === state).forEach((item) => {
        const option = document.createElement('option');
        option.value = item.jakimCode;
        option.textContent = `${item.jakimCode} - ${item.daerah}`;
        group.appendChild(option);
      });
      fragment.appendChild(group);
    });
    zoneSelect.appendChild(fragment);
  };

  const updateState = () => {
    const settings = readSettings();
    const permission = 'Notification' in window ? Notification.permission : 'default';
    const active = settings.enabled === true && permission === 'granted';
    openButton.classList.toggle('is-active', active);
    openButton.setAttribute('aria-pressed', String(active));
    enableButton.hidden = active;
    disableButton.hidden = !active;
    testButton.hidden = !active;
    consent.checked = active;
    if (settings.zone) zoneSelect.value = settings.zone;
    if (active) setStatus(`Aktif untuk zon ${settings.zone}.`, 'success');
    else setStatus('');
  };

  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Pelayar ini tidak menyokong notifikasi aplikasi web.');
    if (serviceWorkerRegistration) return serviceWorkerRegistration;
    serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js?v=20260811-2', { scope: './', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    return serviceWorkerRegistration;
  };

  const decodeVapidKey = (value) => {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  };

  const syncSubscription = async (action, subscription, zone) => {
    if (!pushConfig?.subscribeUrl) throw new Error('Perkhidmatan notifikasi sedang disediakan. Cuba sebentar lagi.');
    const response = await fetch(pushConfig.subscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, zone, subscription: subscription.toJSON() })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Pendaftaran notifikasi tidak dapat disimpan.');
  };

  const openModal = () => {
    modalTrigger = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('reminder-open');
    installNote.hidden = !(isIos && !isStandalone);
    const zone = readSettings().zone || getPrayerZone();
    if (zone) zoneSelect.value = zone;
    updateState();
    modal.querySelector('.reminder-close').focus();
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('reminder-open');
    if (modalTrigger) modalTrigger.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const zone = zoneSelect.value;
    if (!zone) {
      setStatus('Pilih zon waktu solat terlebih dahulu.', 'error');
      zoneSelect.focus();
      return;
    }
    if (!consent.checked) {
      setStatus('Tandakan kebenaran notifikasi untuk meneruskan.', 'error');
      consent.focus();
      return;
    }
    if (isIos && !isStandalone) {
      installNote.hidden = false;
      setStatus('Buka SedekahQR daripada Skrin Utama selepas dipasang.', 'error');
      return;
    }
    if (!('Notification' in window) || !('PushManager' in window)) {
      setStatus('Notifikasi tidak disokong oleh pelayar ini.', 'error');
      return;
    }
    if (!pushConfig?.vapidPublicKey || !pushConfig?.subscribeUrl) {
      setStatus('Perkhidmatan notifikasi sedang disediakan. Cuba sebentar lagi.', 'error');
      return;
    }

    enableButton.disabled = true;
    setStatus('Mengaktifkan notifikasi...');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Kebenaran notifikasi tidak diberikan.');
      const registration = await registerServiceWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(pushConfig.vapidPublicKey)
        });
      }
      await syncSubscription('subscribe', subscription, zone);
      writeSettings({ enabled: true, zone });
      updateState();
      showToast('Peringatan Sedekah Subuh telah diaktifkan.');
    } catch (error) {
      setStatus(error.message || 'Notifikasi tidak dapat diaktifkan.', 'error');
    } finally {
      enableButton.disabled = false;
    }
  });

  disableButton.addEventListener('click', async () => {
    disableButton.disabled = true;
    setStatus('Mematikan peringatan...');
    try {
      const registration = await registerServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await syncSubscription('unsubscribe', subscription, readSettings().zone || '');
        await subscription.unsubscribe();
      }
      removeSettings();
      updateState();
      showToast('Peringatan telah dimatikan.');
    } catch (error) {
      setStatus(error.message || 'Peringatan tidak dapat dimatikan.', 'error');
    } finally {
      disableButton.disabled = false;
    }
  });

  testButton.addEventListener('click', async () => {
    try {
      const registration = await registerServiceWorker();
      const worker = registration.active || registration.waiting || registration.installing;
      worker?.postMessage({ type: 'SHOW_TEST_NOTIFICATION' });
      setStatus('Notifikasi ujian telah dihantar.', 'success');
    } catch {
      setStatus('Notifikasi ujian tidak dapat dihantar.', 'error');
    }
  });

  openButton.addEventListener('click', openModal);
  closeButtons.forEach((button) => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  populateZones();
  registerServiceWorker().catch(() => {});
  updateState();
});
