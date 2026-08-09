document.addEventListener('DOMContentLoaded', () => {
  const amountButtons = document.querySelectorAll('.amount-button');
  const customAmount = document.getElementById('custom-amount');
  const selectedAmount = document.getElementById('selected-amount');

  if (amountButtons.length && customAmount && selectedAmount) {
    amountButtons.forEach((button) => {
      button.addEventListener('click', () => {
        amountButtons.forEach((item) => item.classList.toggle('active', item === button));
        selectedAmount.textContent = 'RM' + button.dataset.amount;
        customAmount.value = button.dataset.amount;
      });
    });

    customAmount.addEventListener('input', () => {
      const value = Number(customAmount.value || 0);
      if (value > 0) {
        selectedAmount.textContent = 'RM' + value;
        amountButtons.forEach((button) => button.classList.toggle('active', false));
      }
    });
  }

  const checkoutAmountField = document.getElementById('checkout-amount');
  const checkoutTotal = document.getElementById('checkout-total');
  const checkoutButtons = document.querySelectorAll('[data-amount].amount-button-select');

  if (checkoutAmountField && checkoutTotal && checkoutButtons.length) {
    checkoutButtons.forEach((button) => {
      button.addEventListener('click', () => {
        checkoutButtons.forEach((item) => item.classList.toggle('active', item === button));
        const value = Number(button.dataset.amount);
        checkoutAmountField.value = value;
        checkoutTotal.textContent = 'RM' + value;
      });
    });

    checkoutAmountField.addEventListener('input', () => {
      const value = Number(checkoutAmountField.value || 0);
      if (value > 0) {
        checkoutTotal.textContent = 'RM' + value;
        checkoutButtons.forEach((button) => button.classList.toggle('active', false));
      }
    });
  }

  const checkoutForm = document.getElementById('checkout-form');
  const checkoutStatus = document.getElementById('checkout-status');

  if (checkoutForm && checkoutStatus) {
    checkoutForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const donorName = document.getElementById('donor-name').value.trim();
      const donorPhone = document.getElementById('donor-phone').value.trim();
      const terms = checkoutForm.querySelector('input[type="checkbox"]');

      if (!donorName || !donorPhone || !terms.checked) {
        checkoutStatus.className = 'form-status error';
        checkoutStatus.textContent = 'Sila lengkapkan nama, no WhatsApp dan persetujuan sebelum sahkan sedekah.';
        return;
      }

      const program = document.getElementById('program').value || 'tabung-surau';
      const amount = Number(checkoutAmountField.value || 0);

      const summary = {
        program,
        amount,
        donorName,
        donorPhone
      };

      checkoutStatus.className = 'form-status success';
      checkoutStatus.textContent = 'Sedekah anda diterima. No rujukan: SED-' + Date.now().toString().slice(-8) + '.';

      const toast = document.getElementById('site-toast');
      if (toast) {
        toast.innerHTML = 'Sedekah ' + donorName + ' RM' + amount + ' diterima untuk program ' + program + '.';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }

      const qrStatusText = document.getElementById('qr-status-text');
      const paymentStatusCard = document.getElementById('payment-status-card');

      if (qrStatusText) {
        qrStatusText.textContent = 'Bayaran QR disahkan (demo)';
      }

      if (paymentStatusCard) {
        paymentStatusCard.classList.add('paid');
      }

      if (window.location.pathname.endsWith('checkout.html')) {
        window.setTimeout(() => {
          window.location.href = 'receipt.html';
        }, 600);
      }

      console.log('donation-submitted', summary);
    });
  }

  const mockPayButton = document.getElementById('mock-pay-button');
  if (mockPayButton) {
    mockPayButton.addEventListener('click', () => {
      const qrStatusText = document.getElementById('qr-status-text');
      const paymentStatusCard = document.getElementById('payment-status-card');

      if (qrStatusText) {
        qrStatusText.textContent = 'Bayaran QR disahkan (demo)';
      }

      if (paymentStatusCard) {
        paymentStatusCard.classList.add('paid');
      }

      const toast = document.getElementById('site-toast');
      if (toast) {
        toast.innerHTML = 'Status QR bayaran: disahkan (demo).';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
      }
    });
  }

  const filterButtons = document.querySelectorAll('[data-filter]');
  const activityRows = document.querySelectorAll('[data-status]');

  if (filterButtons.length && activityRows.length) {
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.filter;

        filterButtons.forEach((item) => item.classList.toggle('active', item === button));

        activityRows.forEach((row) => {
          const visible = target === 'all' || row.dataset.status === target;
          row.style.display = visible ? '' : 'none';
        });
      });
    });
  }

  const optinForm = document.getElementById('optin-form');
  const optinStatus = document.getElementById('optin-status');

  if (optinForm && optinStatus) {
    optinForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const name = document.getElementById('name').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const consent = optinForm.querySelector('input[type="checkbox"]');

      if (!name || !phone || !consent.checked) {
        optinStatus.className = 'form-status error';
        optinStatus.textContent = 'Sila masukkan nama, no WhatsApp dan bersetuju menerima reminder.';
        return;
      }

      const program = document.getElementById('program').value || 'sedekah-subuh';
      const reminderTime = document.getElementById('time').value || 'sunrise';

      optinStatus.className = 'form-status success';
      optinStatus.textContent = 'Tahniah! Anda telah mendaftar reminder WhatsApp untuk ' + program + ' pada ' + reminderTime + '.';

      const toast = document.getElementById('site-toast');
      if (toast) {
        toast.innerHTML = 'Reminder WhatsApp didaftarkan untuk ' + name + '.';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const slider = document.querySelector('.donation-slider');
  if (!slider) return;

  const slides = [...slider.querySelectorAll('.donation-slide')];
  const dots = [...slider.querySelectorAll('.slider-dot')];
  const previousButton = slider.querySelector('.slider-prev');
  const nextButton = slider.querySelector('.slider-next');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentSlide = 0;
  let autoSlideTimer = null;
  let touchStartX = 0;

  const showSlide = (index) => {
    currentSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === currentSlide;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === currentSlide;
      dot.classList.toggle('is-active', isActive);
      if (isActive) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const stopAutoSlide = () => {
    window.clearInterval(autoSlideTimer);
    autoSlideTimer = null;
  };

  const startAutoSlide = () => {
    stopAutoSlide();
    if (!reduceMotion && !document.hidden) {
      autoSlideTimer = window.setInterval(() => showSlide(currentSlide + 1), 6500);
    }
  };

  const selectSlide = (index) => {
    showSlide(index);
    startAutoSlide();
  };

  previousButton.addEventListener('click', () => selectSlide(currentSlide - 1));
  nextButton.addEventListener('click', () => selectSlide(currentSlide + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => selectSlide(index)));

  slider.addEventListener('mouseenter', stopAutoSlide);
  slider.addEventListener('mouseleave', startAutoSlide);
  slider.addEventListener('focusin', stopAutoSlide);
  slider.addEventListener('focusout', (event) => {
    if (!slider.contains(event.relatedTarget)) startAutoSlide();
  });

  slider.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') selectSlide(currentSlide - 1);
    if (event.key === 'ArrowRight') selectSlide(currentSlide + 1);
  });

  slider.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
    stopAutoSlide();
  }, { passive: true });

  slider.addEventListener('touchend', (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 50) showSlide(currentSlide + (distance < 0 ? 1 : -1));
    startAutoSlide();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoSlide();
    else startAutoSlide();
  });

  showSlide(0);
  startAutoSlide();
});

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  const catalog = Array.isArray(window.QR_CATALOG) ? window.QR_CATALOG : [];
  const searchForm = document.getElementById('catalog-search');
  const searchInput = document.getElementById('search-input');
  const stateFilter = document.getElementById('state-filter');
  const typeFilter = document.getElementById('type-filter');
  const clearFilters = document.getElementById('clear-filters');
  const emptyClear = document.getElementById('empty-clear');
  const emptyState = document.getElementById('empty-state');
  const pagination = document.getElementById('pagination');
  const resultSummary = document.getElementById('result-summary');
  const totalQr = document.getElementById('total-qr');
  const totalStates = document.getElementById('total-states');
  const modal = document.getElementById('qr-modal');
  const modalName = document.getElementById('modal-name');
  const modalMeta = document.getElementById('modal-meta');
  const modalAddress = document.getElementById('modal-address');
  const modalMapLink = document.getElementById('modal-map-link');
  const modalPhoneRow = document.getElementById('modal-phone-row');
  const modalPhone = document.getElementById('modal-phone');
  const modalImage = document.getElementById('modal-image');
  const modalLoading = document.getElementById('modal-loading');
  const modalQrFrame = modal.querySelector('.modal-qr-frame');
  const qrTab = document.getElementById('qr-tab');
  const mapTab = document.getElementById('map-tab');
  const qrPanel = document.getElementById('qr-panel');
  const mapPanel = document.getElementById('map-panel');
  const modalMapFrame = document.getElementById('modal-map-frame');
  const modalMapName = document.getElementById('modal-map-name');
  const modalMapAddress = document.getElementById('modal-map-address');
  const mapLoading = document.getElementById('map-loading');
  const modalMapExternal = document.getElementById('modal-map-external');
  const downloadQr = document.getElementById('download-qr');
  const shareQr = document.getElementById('share-qr');
  const toast = document.getElementById('site-toast');
  const pageSize = 12;
  let currentPage = 1;
  let activeItem = null;
  let activeMapEmbedUrl = '';
  let mapLoadingTimer = null;
  let modalTrigger = null;
  let toastTimer = null;

  const verifiedLocations = {
    'johor-001-surau-ehsan-johor': {
      address: 'Jalan Perubatan 22, Taman Universiti, 81300 Skudai, Johor, Malaysia',
      latitude: 1.5340876,
      longitude: 103.6110264
    },
    'kelantan-001-masjid-an-naim-kota-bharu': {
      address: 'Jalan Tok Guru, Kampung Cina, 15586 Kota Bharu, Kelantan, Malaysia',
      latitude: 6.1276501,
      longitude: 102.2469829
    }
  };

  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ms');

  const states = [...new Set(catalog.map((item) => item.state))]
    .sort((a, b) => a.localeCompare(b, 'ms'));

  states.forEach((state) => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateFilter.appendChild(option);
  });

  const roundRobinCatalog = () => {
    const groups = states.map((state) => catalog.filter((item) => item.state === state));
    const result = [];
    let row = 0;
    let hasItems = true;

    while (hasItems) {
      hasItems = false;
      groups.forEach((group) => {
        if (group[row]) {
          result.push(group[row]);
          hasItems = true;
        }
      });
      row += 1;
    }

    return result;
  };

  const orderedCatalog = roundRobinCatalog();

  if (totalQr) totalQr.textContent = catalog.length.toLocaleString('ms-MY');
  if (totalStates) totalStates.textContent = states.length.toLocaleString('ms-MY');

  const showToast = (message) => {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  };

  const getFilteredItems = () => {
    const query = normalizeText(searchInput.value.trim());
    const state = stateFilter.value;
    const type = typeFilter.value;

    return orderedCatalog.filter((item) => {
      const matchesQuery = !query || normalizeText(`${item.name} ${item.state} ${item.type}`).includes(query);
      const matchesState = !state || item.state === state;
      const matchesType = !type || item.type === type;
      return matchesQuery && matchesState && matchesType;
    });
  };

  const getItemDetails = (item) => {
    const verifiedLocation = verifiedLocations[item.id];
    const nameParts = item.name.split(',').map((part) => part.trim()).filter(Boolean);
    const locality = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const localityMatchesState = normalizeText(locality) === normalizeText(item.state);
    const address = verifiedLocation?.address || item.address || [
      locality && !localityMatchesState ? locality : '',
      item.state,
      'Malaysia'
    ].filter(Boolean).join(', ');
    const phone = String(item.phone || '').trim();
    const mapQuery = verifiedLocation?.address || item.address || `${item.name}, ${item.state}, Malaysia`;
    const streetViewUrl = verifiedLocation
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${verifiedLocation.latitude},${verifiedLocation.longitude}`)}`
      : '';

    return {
      address,
      phone,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
      mapsEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`,
      streetViewUrl
    };
  };

  const selectMediaTab = (target) => {
    const showMap = target === 'map';
    qrTab.classList.toggle('is-active', !showMap);
    mapTab.classList.toggle('is-active', showMap);
    qrTab.setAttribute('aria-selected', String(!showMap));
    mapTab.setAttribute('aria-selected', String(showMap));
    qrPanel.hidden = showMap;
    mapPanel.hidden = !showMap;

    if (showMap && activeMapEmbedUrl && !modalMapFrame.getAttribute('src')) {
      mapLoading.hidden = false;
      modalMapFrame.src = activeMapEmbedUrl;
      window.clearTimeout(mapLoadingTimer);
      mapLoadingTimer = window.setTimeout(() => {
        mapLoading.hidden = true;
      }, 1200);
    }
  };

  const createCard = (item) => {
    const details = getItemDetails(item);
    const article = document.createElement('article');
    article.className = 'catalog-card';

    const imageButton = document.createElement('button');
    imageButton.className = 'card-image-button';
    imageButton.type = 'button';
    imageButton.setAttribute('aria-label', `Lihat QR ${item.name}`);

    const image = document.createElement('img');
    image.src = item.image;
    image.alt = `Pratonton QR ${item.name}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.alt = 'Imej QR tidak dapat dimuatkan';
      imageButton.classList.add('image-error');
    });
    imageButton.appendChild(image);

    const body = document.createElement('div');
    body.className = 'catalog-card-body';

    const tags = document.createElement('div');
    tags.className = 'card-tags';

    const type = document.createElement('span');
    type.className = 'card-type';
    type.textContent = item.type;

    const state = document.createElement('span');
    state.className = 'card-state';
    state.textContent = item.state;
    tags.append(type, state);

    const heading = document.createElement('h3');
    heading.textContent = item.name;

    const contact = document.createElement('div');
    contact.className = 'card-contact';

    const addressLabel = document.createElement('span');
    addressLabel.className = 'card-contact-label';
    addressLabel.textContent = 'Lokasi';

    const address = document.createElement('p');
    address.className = 'card-address';
    address.textContent = details.address;

    const locationActions = document.createElement('div');
    locationActions.className = 'card-location-actions';

    const mapLink = document.createElement('button');
    mapLink.className = 'card-map-link';
    mapLink.type = 'button';
    mapLink.textContent = 'Maps';
    mapLink.setAttribute('aria-label', `Lihat ${item.name} dalam tab Maps`);
    mapLink.addEventListener('click', (event) => openModal(item, event.currentTarget, 'map'));

    locationActions.appendChild(mapLink);

    if (details.streetViewUrl) {
      const streetViewLink = document.createElement('a');
      streetViewLink.className = 'card-street-view-link';
      streetViewLink.href = details.streetViewUrl;
      streetViewLink.target = '_blank';
      streetViewLink.rel = 'noopener noreferrer';
      streetViewLink.textContent = 'Street View';
      streetViewLink.setAttribute('aria-label', `Buka Street View ${item.name} dalam Google Maps`);
      locationActions.appendChild(streetViewLink);
    }

    contact.append(addressLabel, address, locationActions);

    if (details.phone) {
      const phone = document.createElement('a');
      phone.className = 'card-phone';
      phone.href = `tel:${details.phone.replace(/[^+\d]/g, '')}`;
      phone.textContent = details.phone;
      contact.appendChild(phone);
    }

    const button = document.createElement('button');
    button.className = 'view-qr-button';
    button.type = 'button';
    button.textContent = 'Lihat QR';

    const open = (event) => openModal(item, event.currentTarget, 'qr');
    imageButton.addEventListener('click', open);
    button.addEventListener('click', open);

    body.append(tags, heading, contact, button);
    article.append(imageButton, body);
    return article;
  };

  const makePageButton = (label, page, options = {}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    if (options.current) button.setAttribute('aria-current', 'page');
    if (options.label) button.setAttribute('aria-label', options.label);
    button.addEventListener('click', () => {
      currentPage = page;
      renderCatalog();
      document.getElementById('direktori').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return button;
  };

  const renderPagination = (pageCount) => {
    pagination.replaceChildren();
    if (pageCount <= 1) return;

    pagination.appendChild(makePageButton('Sebelum', currentPage - 1, {
      disabled: currentPage === 1,
      label: 'Halaman sebelumnya'
    }));

    const pageNumbers = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
    const visiblePages = [...pageNumbers]
      .filter((page) => page >= 1 && page <= pageCount)
      .sort((a, b) => a - b);

    visiblePages.forEach((page, index) => {
      if (index && page - visiblePages[index - 1] > 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        pagination.appendChild(ellipsis);
      }
      pagination.appendChild(makePageButton(String(page), page, {
        current: page === currentPage,
        label: `Halaman ${page}`
      }));
    });

    pagination.appendChild(makePageButton('Seterus', currentPage + 1, {
      disabled: currentPage === pageCount,
      label: 'Halaman seterusnya'
    }));
  };

  function renderCatalog() {
    const filteredItems = getFilteredItems();
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * pageSize;
    const pageItems = filteredItems.slice(start, start + pageSize);

    grid.replaceChildren(...pageItems.map(createCard));
    grid.hidden = pageItems.length === 0;
    emptyState.hidden = pageItems.length !== 0;

    if (filteredItems.length) {
      const end = Math.min(start + pageSize, filteredItems.length);
      resultSummary.textContent = `Menunjukkan ${start + 1}-${end} daripada ${filteredItems.length.toLocaleString('ms-MY')} lokasi`;
    } else {
      resultSummary.textContent = 'Tiada lokasi sepadan dengan carian anda';
    }

    renderPagination(filteredItems.length ? pageCount : 0);
  }

  const resetFilters = () => {
    searchInput.value = '';
    stateFilter.value = '';
    typeFilter.value = '';
    currentPage = 1;
    renderCatalog();
    searchInput.focus();
  };

  function openModal(item, trigger, initialTab = 'qr') {
    const details = getItemDetails(item);
    activeItem = item;
    modalTrigger = trigger || document.activeElement;
    modalName.textContent = item.name;
    modalMeta.textContent = `${item.type} · ${item.state}`;
    modalAddress.textContent = details.address;
    modalMapLink.href = details.mapsUrl;
    modalMapLink.setAttribute('aria-label', `Buka ${item.name} dalam Google Maps`);
    modalMapExternal.href = details.mapsUrl;
    modalMapExternal.setAttribute('aria-label', `Buka ${item.name} dalam Google Maps`);
    modalMapName.textContent = item.name;
    modalMapAddress.textContent = details.address;
    modalMapFrame.title = `Peta lokasi ${item.name}`;
    modalMapFrame.removeAttribute('src');
    activeMapEmbedUrl = details.mapsEmbedUrl;
    selectMediaTab(initialTab === 'map' ? 'map' : 'qr');
    modalPhoneRow.hidden = !details.phone;
    modalPhone.textContent = details.phone;
    modalPhone.href = details.phone ? `tel:${details.phone.replace(/[^+\d]/g, '')}` : '';
    modalLoading.textContent = 'Memuatkan kod QR...';
    modalQrFrame.classList.add('loading');
    modalImage.src = item.image;
    modalImage.alt = `Kod QR sumbangan ${item.name}`;
    downloadQr.href = item.image;
    downloadQr.download = `${item.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'sedekah-qr'}.jpg`;
    modal.hidden = false;
    document.body.classList.add('modal-open');

    const url = new URL(window.location.href);
    url.searchParams.set('qr', item.id);
    if (initialTab === 'map') url.searchParams.set('view', 'map');
    else url.searchParams.delete('view');
    window.history.replaceState({}, '', url);
    modal.querySelector('.modal-close').focus();
  }

  const closeModal = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    activeItem = null;
    activeMapEmbedUrl = '';
    window.clearTimeout(mapLoadingTimer);
    modalMapFrame.removeAttribute('src');

    const url = new URL(window.location.href);
    url.searchParams.delete('qr');
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url);
    if (modalTrigger) modalTrigger.focus();
  };

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    currentPage = 1;
    renderCatalog();
    document.getElementById('direktori').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderCatalog();
  });

  stateFilter.addEventListener('change', () => {
    currentPage = 1;
    renderCatalog();
  });

  typeFilter.addEventListener('change', () => {
    currentPage = 1;
    renderCatalog();
  });

  clearFilters.addEventListener('click', resetFilters);
  emptyClear.addEventListener('click', resetFilters);
  modal.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', closeModal));
  qrTab.addEventListener('click', () => selectMediaTab('qr'));
  mapTab.addEventListener('click', () => selectMediaTab('map'));

  [qrTab, mapTab].forEach((tab) => {
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const target = tab === qrTab ? 'map' : 'qr';
      selectMediaTab(target);
      (target === 'map' ? mapTab : qrTab).focus();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  shareQr.addEventListener('click', async () => {
    if (!activeItem) return;
    const shareData = {
      title: `QR Sedekah - ${activeItem.name}`,
      text: `Kod QR sumbangan untuk ${activeItem.name}, ${activeItem.state}. Semak nama penerima sebelum membuat bayaran.`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        showToast('Pautan QR telah disalin.');
      } else {
        const field = document.createElement('textarea');
        field.value = shareData.url;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
        showToast('Pautan QR telah disalin.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') showToast('Pautan tidak dapat dikongsi. Cuba lagi.');
    }
  });

  modalImage.addEventListener('error', () => {
    modalLoading.textContent = 'Imej QR tidak dapat dimuatkan. Cuba muat turun atau semak laman sumber.';
    modalQrFrame.classList.add('loading');
    showToast('Imej QR ini tidak dapat dimuatkan.');
  });

  modalImage.addEventListener('load', () => {
    modalQrFrame.classList.remove('loading');
  });

  modalMapFrame.addEventListener('load', () => {
    window.clearTimeout(mapLoadingTimer);
    mapLoading.hidden = true;
  });

  renderCatalog();

  const requestedId = new URL(window.location.href).searchParams.get('qr');
  if (requestedId) {
    const requestedItem = catalog.find((item) => item.id === requestedId);
    const requestedView = new URL(window.location.href).searchParams.get('view');
    if (requestedItem) openModal(requestedItem, null, requestedView === 'map' ? 'map' : 'qr');
  }
});
