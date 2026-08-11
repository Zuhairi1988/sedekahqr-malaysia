(() => {
  const config = globalThis.SEDEKAHQR_BLOG;
  const modal = document.querySelector('#emergency-campaign-modal');
  if (!modal || !config?.supabaseUrl || !config?.publishableKey) return;

  const title = modal.querySelector('#emergency-campaign-title');
  const message = modal.querySelector('#emergency-campaign-message');
  const qrName = modal.querySelector('#emergency-campaign-qr-name');
  const qrImage = modal.querySelector('#emergency-campaign-image');
  const viewQr = modal.querySelector('#emergency-campaign-view-qr');
  const closeButtons = modal.querySelectorAll('[data-close-emergency-campaign]');
  let activeItem = null;

  const close = () => {
    modal.hidden = true;
    if (document.querySelector('#qr-modal')?.hidden !== false) document.body.classList.remove('modal-open');
  };

  const show = (campaign) => {
    activeItem = (globalThis.QR_CATALOG || []).find((item) => item.id === campaign.qr_id);
    if (!activeItem) return;
    title.textContent = campaign.title;
    message.textContent = campaign.message;
    qrName.textContent = activeItem.name;
    qrImage.src = campaign.image_path
      ? `${config.supabaseUrl}/storage/v1/object/public/campaign-images/${encodeURIComponent(campaign.image_path)}`
      : activeItem.image;
    qrImage.alt = `Kod QR sumbangan ${activeItem.name}`;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modal.querySelector('.emergency-campaign-close').focus();
  };

  const load = async () => {
    if (new URLSearchParams(window.location.search).has('qr')) return;
    try {
      const now = new Date().toISOString();
      const response = await fetch(`${config.supabaseUrl}/rest/v1/emergency_campaign?select=title,message,qr_id,delay_seconds,is_active,starts_at,ends_at&is_active=eq.true&starts_at=lte.${encodeURIComponent(now)}&ends_at=gt.${encodeURIComponent(now)}&limit=1`, {
        headers: { apikey: config.publishableKey }
      });
      if (!response.ok) return;
      const campaign = (await response.json())[0];
      if (!campaign) return;
      window.setTimeout(() => show(campaign), Math.max(0, Number(campaign.delay_seconds) || 5) * 1000);
    } catch {
      // A campaign must never prevent the directory from loading.
    }
  };

  closeButtons.forEach((button) => button.addEventListener('click', close));
  viewQr.addEventListener('click', () => {
    if (!activeItem) return;
    close();
    const url = new URL(window.location.href);
    url.searchParams.set('qr', activeItem.id);
    window.location.assign(url);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
  load();
})();
