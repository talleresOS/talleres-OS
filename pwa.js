/* TallerOS móvil/PWA y administración segura de registros.
   Esta capa reutiliza los mismos stores IndexedDB del MVP. */
(() => {
  const pwaLedger = window.TallerOSLedger;
  const pwaActions = new Map();
  let pwaDeferredInstall = null;

  const pwaNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const pwaToday = () => new Date().toISOString().slice(0, 10);
  const pwaMonth = () => new Date().toISOString().slice(0, 7);
  const pwaDate = value => value ? String(value).slice(0, 10) : 'Sin fecha';
  const pwaDateTime = value => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? pwaDate(value) : new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  };
  const pwaId = () => pwaLedger?.id?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pwaIsCancelled = order => order?.status === 'Cancelada';
  /* Una orden en papelera conserva todos sus datos, pero no participa en la operación. */
  const pwaOrderTrashed = order => order?.deleted === true || Boolean(order?.deletedAt);
  const pwaOrderVisible = order => order && order.archived !== true && !pwaOrderTrashed(order);
  const pwaFinancialOrder = order => pwaOrderVisible(order) && !pwaIsCancelled(order);
  const pwaOrderSequenceFrom = orders => (orders || []).reduce((highest, order) => {
    const match = String(order?.number || '').match(/(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(value) ? Math.max(highest, value) : highest;
  }, 0);

  /* También protege números de órdenes que existan en copias de recuperación antiguas. */
  async function pwaProtectHistoricalOrderSequence() {
    if (typeof api.raiseOrderNumberSequence !== 'function') return;
    const snapshots = await pwaLedger.all('snapshots');
    const historical = snapshots
      .filter(snapshot => Number(snapshot?.workshopId) === Number(WID))
      .reduce((highest, snapshot) => Math.max(highest, pwaOrderSequenceFrom(snapshot?.collections?.orders)), 0);
    await api.raiseOrderNumberSequence(historical);
  }

  const pwaRecoveryPromise = (async () => {
    try {
      await api.all('settings');
      await pwaLedger.createPwaRecoverySnapshot();
      /* Nueva recuperación única antes de esta validación final y sus migraciones seguras. */
      await pwaLedger.createRecoverySnapshot('before-final-pwa-integrity-v1');
      await pwaProtectHistoricalOrderSequence();
      window.__pwaRecoveryReady = true;
    } catch (error) {
      window.__pwaRecoveryError = error?.message || 'No se pudo crear la copia de recuperación local.';
      console.error('TallerOS: copia de recuperación PWA', error);
    }
  })();

  async function pwaEnsureRecovery() {
    await pwaRecoveryPromise;
    if (window.__pwaRecoveryError) throw new Error(window.__pwaRecoveryError);
  }

  async function pwaData() {
    const d = await data();
    const [ledgerAccounts, ledgerAccruals, ledgerPayments] = await Promise.all([
      pwaLedger.all('accounts'),
      pwaLedger.all('accruals'),
      pwaLedger.all('payments')
    ]);
    d.ledgerAccounts = ledgerAccounts.filter(item => item.workshopId === WID);
    d.ledgerAccruals = ledgerAccruals.filter(item => item.workshopId === WID);
    d.ledgerPayments = ledgerPayments.filter(item => item.workshopId === WID);
    return d;
  }

  /* Copias de seguridad: exportan los mismos registros que usa la aplicación. */
  const pwaBackupFormat = 'TallerOS-backup';
  const pwaBackupVersion = 1;
  const pwaBackupMainStores = ['settings', 'clients', 'vehicles', 'orders', 'parts', 'employees', 'payments', 'costs'];
  const pwaBackupLedgerStores = ['accounts', 'accruals', 'payments'];
  let pwaPendingBackup = null;

  const pwaBackupFileName = () => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `TallerOS-copia-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
  };

  function pwaAssertBackup(payload) {
    if (!payload || payload.format !== pwaBackupFormat || Number(payload.version) !== pwaBackupVersion) {
      throw new Error('El archivo no parece ser una copia compatible de TallerOS.');
    }
    if (!payload.main || !payload.ledger) throw new Error('La copia no contiene la estructura completa de TallerOS.');
    const checked = {
      ...payload,
      main: {},
      ledger: {}
    };
    pwaBackupMainStores.forEach(store => {
      const records = payload.main[store];
      if (!Array.isArray(records)) throw new Error(`La copia no incluye “${store}” correctamente.`);
      const seen = new Set();
      checked.main[store] = records.map(record => {
        const id = Number(record?.id);
        if (!record || !Number.isSafeInteger(id) || id <= 0) throw new Error(`La copia contiene un registro inválido en ${store}.`);
        if (Number(record.workshopId) !== Number(WID)) throw new Error('Esta copia pertenece a otro taller o está dañada.');
        if (seen.has(id)) throw new Error(`La copia tiene claves repetidas en ${store}.`);
        seen.add(id);
        return { ...record, id, workshopId: WID };
      });
    });
    pwaBackupLedgerStores.forEach(store => {
      const records = payload.ledger[store];
      if (!Array.isArray(records)) throw new Error(`La copia no incluye el historial de ${store}.`);
      const seen = new Set();
      checked.ledger[store] = records.map(record => {
        const id = String(record?.id || '').trim();
        if (!record || !id) throw new Error(`La copia contiene un registro de empleados inválido en ${store}.`);
        if (Number(record.workshopId) !== Number(WID)) throw new Error('Esta copia pertenece a otro taller o está dañada.');
        if (seen.has(id)) throw new Error(`La copia tiene claves repetidas en el historial de ${store}.`);
        seen.add(id);
        return { ...record, id, workshopId: WID };
      });
    });
    return checked;
  }

  async function pwaReplaceMainWorkshopData(collections) {
    const database = await db;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(pwaBackupMainStores, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo importar la información principal.'));
      transaction.onabort = () => reject(transaction.error || new Error('La importación de los datos principales fue cancelada.'));
      pwaBackupMainStores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const readRequest = store.getAll();
        readRequest.onerror = () => transaction.abort();
        readRequest.onsuccess = () => {
          readRequest.result
            .filter(record => Number(record?.workshopId) === Number(WID))
            .forEach(record => store.delete(record.id));
          (collections?.[storeName] || [])
            .filter(record => Number(record?.workshopId) === Number(WID))
            .forEach(record => store.put({ ...record, workshopId: WID }));
        };
      });
    });
  }

  async function pwaApplyBackup(backup) {
    const snapshotId = `before-import-${Date.now()}`;
    const recovery = await pwaLedger.createRecoverySnapshot(snapshotId);
    const recoverySetting = (recovery.collections?.settings || []).find(setting => Number(setting?.workshopId) === Number(WID));
    const recoveryCounter = Number.isSafeInteger(Number(recoverySetting?.orderSequence)) ? Number(recoverySetting.orderSequence) : 0;
    const protectedSequence = Math.max(recoveryCounter, pwaOrderSequenceFrom(recovery.collections?.orders));
    try {
      await pwaReplaceMainWorkshopData(backup.main);
      await pwaLedger.replaceWorkshopCollections(backup.ledger);
      /* Si es una copia anterior a esta mejora, se inicializa una sola vez. */
      await api.ensureOrderNumberSequence();
      /* Importar una copia anterior nunca puede bajar ni reutilizar el contador. */
      await api.raiseOrderNumberSequence(protectedSequence);
    } catch (error) {
      try {
        await pwaReplaceMainWorkshopData(recovery.collections);
        await pwaLedger.replaceWorkshopCollections(recovery.ledgerCollections || {});
      } catch (recoveryError) {
        console.error('TallerOS: no se pudo restaurar automáticamente la copia previa a importar', recoveryError);
        throw new Error(`La importación falló y requiere recuperación manual: ${error.message}`);
      }
      throw new Error(`La importación no se aplicó. Se restauró la copia anterior: ${error.message}`);
    }
  }

  window.pwaExportBackup = async function () {
    try {
      await pwaEnsureRecovery();
      const beforeExport = await pwaData();
      const setting = beforeExport.settings[0] || { id: 1, workshopId: WID, name: 'RevivAuto' };
      const exportedAt = new Date().toISOString();
      await api.put('settings', { ...setting, id: Number(setting.id || 1), workshopId: WID, lastBackupExportedAt: exportedAt });
      const d = await pwaData();
      const backup = {
        format: pwaBackupFormat,
        version: pwaBackupVersion,
        exportedAt,
        workshopId: WID,
        main: Object.fromEntries(pwaBackupMainStores.map(store => [store, d[store] || []])),
        ledger: {
          accounts: d.ledgerAccounts || [],
          accruals: d.ledgerAccruals || [],
          payments: d.ledgerPayments || []
        }
      };
      const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = pwaBackupFileName();
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 1000);
      await render();
      pwaNotify('Copia de seguridad exportada. Guarda el archivo JSON en un lugar seguro.');
    } catch (error) {
      alert(`No se pudo exportar la copia: ${error.message || 'Inténtalo de nuevo.'}`);
    }
  };

  window.pwaChooseBackupFile = function () {
    document.getElementById('pwaBackupInput')?.click();
  };

  window.pwaSelectBackupFile = async function (input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('La copia supera el tamaño máximo de 25 MB.');
      const raw = await file.text();
      const backup = pwaAssertBackup(JSON.parse(raw));
      pwaPendingBackup = backup;
      const total = pwaBackupMainStores.reduce((sum, store) => sum + backup.main[store].length, 0);
      pwaDialog('Importar copia de seguridad', `<p>Se encontraron ${total} registro(s) principales y ${backup.ledger.accruals.length} movimiento(s) de mano de obra.</p><p class="pwa-help">La información actual se reemplazará solamente después de crear una recuperación local automática. Esta acción conserva las copias anteriores.</p><div class="actions"><button type="button" class="btn" onclick="pwaCloseAction()">CANCELAR</button><button type="button" class="btn danger" onclick="pwaConfirmImportBackup()">CONTINUAR</button></div>`);
    } catch (error) {
      pwaPendingBackup = null;
      alert(`No se pudo leer la copia: ${error.message || 'Selecciona un archivo JSON válido de TallerOS.'}`);
    } finally {
      input.value = '';
    }
  };

  window.pwaConfirmImportBackup = function () {
    if (!pwaPendingBackup) return pwaNotify('Selecciona nuevamente la copia que deseas importar.');
    pwaConfirmAction({
      title: 'Confirmar importación',
      message: 'Reemplazarás los datos actuales de este taller por la copia seleccionada. Antes se guardará una recuperación local automática.',
      actionLabel: 'IMPORTAR Y REEMPLAZAR',
      action: async () => {
        const backup = pwaPendingBackup;
        pwaPendingBackup = null;
        await pwaApplyBackup(backup);
      },
      successMessage: 'Copia importada correctamente. Tus datos y relaciones fueron restaurados.'
    });
  };

  const pwaPaid = (d, orderId) => d.payments
    .filter(item => item.orderId === Number(orderId) && item.voided !== true)
    .reduce((sum, item) => sum + pwaNumber(item.amount), 0);

  const pwaCost = (d, orderId) => d.costs
    .filter(item => item.orderId === Number(orderId) && item.voided !== true)
    .reduce((sum, item) => sum + pwaNumber(item.amount), 0) + d.parts
    .filter(item => item.orderId === Number(orderId))
    .reduce((sum, item) => sum + pwaNumber(item.materialCost) + pwaNumber(item.laborCost) + pwaNumber(item.otherCost), 0);

  const pwaBalance = (d, order) => Math.max(0, pwaNumber(order.total) - pwaPaid(d, order.id));
  const pwaProfit = (d, order) => pwaNumber(order.total) - pwaCost(d, order.id);
  const pwaClient = (d, id) => d.clients.find(item => item.id === Number(id));
  const pwaVehicle = (d, id) => d.vehicles.find(item => item.id === Number(id));
  const pwaEmployee = (d, id) => d.employees.find(item => item.id === Number(id));
  const pwaOrder = (d, id) => d.orders.find(item => item.id === Number(id));
  const pwaOrderLabel = (d, order) => `${order?.number || 'Orden'} · ${vn(d, order?.vehicleId)}`;

  function pwaClose() {
    if (typeof window.tallerCerrarModal === 'function') window.tallerCerrarModal();
    else document.querySelector('#modal')?.remove();
  }

  function pwaNotify(message) {
    document.querySelector('#pwaToast')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="pwa-toast" id="pwaToast" role="status">${esc(message)}</div>`);
    window.setTimeout(() => document.querySelector('#pwaToast')?.remove(), 3600);
  }

  function pwaDialog(title, body) {
    document.querySelector('#modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modalbg" id="modal"><div class="modal"><h2>${esc(title)}</h2>${body}</div></div>`);
  }

  /* Safari puede cubrir el campo activo con el teclado; lo mantiene a la vista. */
  document.addEventListener('focusin', event => {
    const control = event.target;
    if (!(control instanceof HTMLElement) || !control.matches('#modal input, #modal select, #modal textarea')) return;
    window.setTimeout(() => control.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 180);
  });

  window.pwaConfirmAction = function ({ title, message, actionLabel = 'ELIMINAR', action, successMessage }) {
    const token = pwaId();
    pwaActions.set(token, { action, successMessage });
    pwaDialog(title, `<p>${esc(message)}</p><p class="pwa-help">Esta acción no se puede deshacer.</p><div class="actions"><button type="button" class="btn" onclick="pwaCloseAction()">CANCELAR</button><button type="button" class="btn danger" onclick="pwaRunAction('${token}')">${esc(actionLabel)}</button></div>`);
  };

  window.pwaCloseAction = function () {
    pwaClose();
  };

  window.pwaRunAction = async function (token) {
    const current = pwaActions.get(token);
    if (!current) return;
    try {
      await pwaEnsureRecovery();
      await current.action();
      pwaActions.delete(token);
      pwaClose();
      await render();
      pwaNotify(current.successMessage || 'Cambios guardados correctamente.');
    } catch (error) {
      alert(`No se pudo completar la acción: ${error.message}`);
    }
  };

  window.pwaSearchCards = function (input, selector) {
    const term = String(input.value || '').trim().toLowerCase();
    document.querySelectorAll(selector).forEach(card => {
      card.hidden = !String(card.dataset.search || '').toLowerCase().includes(term);
    });
  };

  window.pwaFinanceTab = function (next) {
    tab = next;
    render();
  };

  window.pwaOpenMore = function () {
    pwaDialog('Más opciones', `<div class="pwa-more-grid"><button class="btn" onclick="pwaGoAndClose('finance')">Finanzas</button><button class="btn" onclick="pwaGoAndClose('settings')">Configuración</button><button class="btn" onclick="pwaInstallApp()">Instalar TallerOS</button><button class="btn" onclick="pwaCloseAction()">Cerrar</button></div>`);
  };

  window.pwaGoAndClose = function (nextView) {
    pwaClose();
    go(nextView);
  };

  window.pwaInstallApp = async function () {
    if (pwaDeferredInstall) {
      pwaDeferredInstall.prompt();
      await pwaDeferredInstall.userChoice;
      pwaDeferredInstall = null;
      return;
    }
    pwaDialog('Instalar TallerOS', `<div class="pwa-help"><b>En iPhone:</b><br>En Safari, toca Compartir, luego “Añadir a pantalla de inicio” y confirma “Añadir”.<br><br><b>En Android:</b><br>Abre el menú del navegador y selecciona “Instalar aplicación” o “Añadir a pantalla de inicio”.</div><div class="actions"><button type="button" class="btn primary" onclick="pwaCloseAction()">Entendido</button></div>`);
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pwaDeferredInstall = event;
  });

  try { settingsPainted = true; } catch (_) {}

  shell = function (title, body, action = '') {
    const desktopNav = [['home', 'Inicio'], ['orders', 'Órdenes'], ['clients', 'Clientes'], ['production', 'Producción'], ['finance', 'Finanzas'], ['settings', 'Configuración']];
    const mobileNav = [['home', 'Inicio'], ['orders', 'Órdenes'], ['clients', 'Clientes'], ['production', 'Producción']];
    const moreActive = view === 'finance' || view === 'settings';
    return `<div class="shell"><aside class="side"><div class="brand"><b>TallerOS</b><small>Todo tu taller en un solo lugar</small></div><nav class="nav desktop-nav">${desktopNav.map(item => `<button class="${view === item[0] ? 'on' : ''}" onclick="go('${item[0]}')">${item[1]}</button>`).join('')}</nav><nav class="mobile-nav">${mobileNav.map(item => `<button class="${view === item[0] ? 'on' : ''}" onclick="go('${item[0]}')">${item[1]}</button>`).join('')}<button class="${moreActive ? 'on' : ''}" onclick="pwaOpenMore()">Más</button></nav></aside><main class="main"><header class="top"><div><div class="eyebrow">RevivAuto · Taller de desabolladura y pintura</div><h1>${esc(title)}</h1></div>${action}</header>${body}</main></div>`;
  };
  window.shell = shell;

  go = function (nextView) {
    view = nextView;
    render();
  };
  window.go = go;

  function pwaOrderCard(d, order) {
    const client = pwaClient(d, order.clientId);
    const vehicle = pwaVehicle(d, order.vehicleId);
    const isCancelled = pwaIsCancelled(order);
    const search = `${order.number || ''} ${client?.name || ''} ${client?.phone || ''} ${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.plate || ''}`;
    return `<article class="pwa-card ${order.archived ? 'pwa-archive' : ''}" data-search="${esc(search)}"><div class="pwa-meta"><span class="badge">${esc(order.status || 'Pendiente')}</span>${order.archived ? '<span class="badge">Archivada</span>' : ''}</div><h3>${esc(order.number || 'Orden sin número')}</h3><p><b>${esc(client?.name || 'Cliente sin registro')}</b></p><p class="muted">${esc(vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate || 'Sin placa'}` : 'Vehículo sin registro')}</p><div class="pwa-line"><span>Balance pendiente</span><b class="pwa-money">${money(isCancelled ? 0 : pwaBalance(d, order))}</b></div><div class="pwa-card-actions"><button class="btn primary" onclick="orderModal(${order.id})">Abrir orden</button></div></article>`;
  }

  function pwaRenderHome(d) {
    const financialOrders = d.orders.filter(pwaFinancialOrder);
    const active = financialOrders.filter(order => !['Entregada', 'Cotización'].includes(order.status));
    const ready = financialOrders.filter(order => order.status === 'Lista para entregar');
    const paidThisMonth = d.payments.filter(payment => payment.voided !== true && String(payment.date || '').slice(0, 7) === pwaMonth() && pwaFinancialOrder(pwaOrder(d, payment.orderId))).reduce((sum, payment) => sum + pwaNumber(payment.amount), 0);
    const orderCostsThisMonth = financialOrders.filter(order => String(order.entryDate || '').slice(0, 7) === pwaMonth()).reduce((sum, order) => sum + pwaCost(d, order.id), 0);
    const pending = financialOrders.reduce((sum, order) => sum + pwaBalance(d, order), 0);
    const profit = financialOrders.filter(order => String(order.entryDate || '').slice(0, 7) === pwaMonth()).reduce((sum, order) => sum + pwaProfit(d, order), 0);
    const recent = [...d.orders].filter(pwaOrderVisible).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6);
    A.innerHTML = shell('Inicio', `<div class="stats"><div class="stat"><span>Vehículos en taller</span><b>${active.length}</b></div><div class="stat"><span>Trabajos activos</span><b>${active.length}</b></div><div class="stat"><span>Listos para entregar</span><b>${ready.length}</b></div><div class="stat"><span>Por cobrar</span><b>${money(pending)}</b></div><div class="stat"><span>Ingresos del mes</span><b>${money(paidThisMonth)}</b></div><div class="stat"><span>Gastos del mes</span><b>${money(orderCostsThisMonth)}</b></div><div class="stat"><span>Ganancia estimada</span><b>${money(profit)}</b></div></div><section class="panel"><div class="pwa-section-title"><h2>Órdenes recientes</h2><button class="link" onclick="go('orders')">Ver todas</button></div><div class="pwa-grid compact">${recent.length ? recent.map(order => pwaOrderCard(d, order)).join('') : '<p class="pwa-empty">Aún no hay órdenes registradas.</p>'}</div></section>`, `<button class="btn primary" onclick="orderModal()">+ Nueva orden</button>`);
  }

  function pwaRenderOrders(d) {
    const visible = d.orders.filter(pwaOrderVisible).sort((a, b) => Number(b.id) - Number(a.id));
    const trashed = d.orders.filter(pwaOrderTrashed).sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
    const trashCards = trashed.map(order => {
      const client = pwaClient(d, order.clientId);
      const vehicle = pwaVehicle(d, order.vehicleId);
      return `<article class="pwa-card pwa-archive"><div class="pwa-meta"><span class="badge">Eliminada</span><span>Anterior: ${esc(order.deletedPreviousStatus || order.status || 'Sin estado')}</span></div><h3>${esc(order.number || 'Orden sin número')}</h3><p><b>${esc(client?.name || 'Cliente sin registro')}</b></p><p class="muted">${esc(vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''} · ${vehicle.plate || 'Sin placa'}` : 'Vehículo sin registro')}</p><p class="muted">Movida a papelera: ${esc(pwaDateTime(order.deletedAt))}</p><div class="pwa-card-actions"><button class="btn" onclick="pwaOpenTrashedOrder(${order.id})">Ver detalle</button><button class="btn primary" onclick="pwaRestoreOrder(${order.id})">Restaurar</button><button class="btn danger" onclick="pwaPermanentDeleteOrder(${order.id})">Eliminar definitivamente</button></div></article>`;
    }).join('');
    A.innerHTML = shell('Órdenes', `<section class="panel"><div class="toolbar"><input class="search" placeholder="Buscar por número, cliente, vehículo o placa" oninput="pwaSearchCards(this,'.pwa-order-card')"><button class="btn primary" onclick="orderModal()">+ Nueva orden</button></div><div class="pwa-grid">${visible.length ? visible.map(order => pwaOrderCard(d, order).replace('pwa-card ', 'pwa-card pwa-order-card ')).join('') : '<p class="pwa-empty">No hay órdenes activas para mostrar.</p>'}</div></section>${trashed.length ? `<section class="panel pwa-trash"><div class="pwa-section-title"><h2>Papelera</h2><span class="muted">${trashed.length} orden(es) eliminada(s)</span></div><p class="pwa-help">Las órdenes en papelera no afectan dashboard, producción ni finanzas. Puedes restaurarlas o eliminarlas definitivamente.</p><div class="pwa-grid">${trashCards}</div></section>` : ''}`);
  }

  function pwaRenderClients(d) {
    const visible = d.clients.filter(client => client.archived !== true).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
    const archived = d.clients.filter(client => client.archived === true);
    const card = client => {
      const vehicles = d.vehicles.filter(vehicle => vehicle.clientId === client.id && vehicle.archived !== true).length;
      const clientOrders = d.orders.filter(order => order.clientId === client.id && pwaFinancialOrder(order));
      const balance = clientOrders.reduce((sum, order) => sum + pwaBalance(d, order), 0);
      const search = `${client.name || ''} ${client.phone || ''} ${client.whatsapp || ''}`;
      return `<article class="pwa-card pwa-client-card ${client.archived ? 'pwa-archive' : ''}" data-search="${esc(search)}"><h3>${esc(client.name || 'Cliente sin nombre')}</h3><p class="muted">${esc(client.phone || 'Sin teléfono')}${client.whatsapp ? ` · WhatsApp: ${esc(client.whatsapp)}` : ''}</p><div class="pwa-meta"><span>${vehicles} vehículo(s)</span><span>Balance: ${money(balance)}</span></div><div class="pwa-card-actions"><button class="btn primary" onclick="clientModal(${client.id})">Abrir cliente</button></div></article>`;
    };
    A.innerHTML = shell('Clientes', `<section class="panel"><div class="toolbar"><input class="search" placeholder="Buscar por nombre o teléfono" oninput="pwaSearchCards(this,'.pwa-client-card')"><button class="btn primary" onclick="clientModal()">+ Nuevo cliente</button></div><div class="pwa-grid">${visible.length ? visible.map(card).join('') : '<p class="pwa-empty">Aún no hay clientes activos.</p>'}</div>${archived.length ? `<details><summary class="muted">Ver ${archived.length} cliente(s) archivado(s)</summary><div class="pwa-grid">${archived.map(card).join('')}</div></details>` : ''}</section>`);
  }

  function pwaProductionStage(status) {
    return ({ 'En reparación': 'Desabolladura', 'En preparación': 'Preparación', 'En pintura': 'Pintura', 'En acabado': 'Brillado', 'Lista para entregar': 'Terminada', 'Entregada': 'Terminada' }[status] || 'Pendiente');
  }

  function pwaRenderProduction(d) {
    const stages = ['Pendiente', 'Desabolladura', 'Preparación', 'Pintura', 'Brillado', 'Terminada'];
    const orders = d.orders.filter(pwaFinancialOrder);
    A.innerHTML = shell('Producción', `<div class="board">${stages.map(stage => `<section class="col"><b>${stage}</b>${orders.filter(order => pwaProductionStage(order.status) === stage).map(order => { const client = pwaClient(d, order.clientId); const vehicle = pwaVehicle(d, order.vehicleId); const parts = d.parts.filter(part => part.orderId === order.id && part.archived !== true); return `<button class="card" onclick="orderStageModal(${order.id})"><b>${esc(order.number)}</b><br>${esc(client?.name || 'Cliente sin registro')}<br><small>${esc(vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Vehículo sin registro')}</small><br><span class="badge">${esc(order.status)}</span><br><small>Entrega: ${esc(pwaDate(order.dueDate))}</small>${parts.length ? `<br><small>${parts.length} pieza(s)</small>` : ''}</button>`; }).join('') || '<p class="muted">Sin órdenes</p>'}</section>`).join('')}</div>`);
  }

  function pwaFinanceOrderCard(d, order) {
    const paidAmount = pwaPaid(d, order.id);
    const totalCost = pwaCost(d, order.id);
    const profit = pwaProfit(d, order);
    const margin = pwaNumber(order.total) ? (profit / pwaNumber(order.total)) * 100 : 0;
    return `<article class="pwa-card"><h3>${esc(pwaOrderLabel(d, order))}</h3><div class="pwa-line"><span>Vendido</span><b>${money(order.total)}</b></div><div class="pwa-line"><span>Cobrado / Balance</span><b>${money(paidAmount)} / ${money(pwaBalance(d, order))}</b></div><div class="pwa-line"><span>Costo / Ganancia</span><b>${money(totalCost)} / ${money(profit)} (${margin.toFixed(1)}%)</b></div><div class="pwa-card-actions"><button class="btn" onclick="paymentModal(${order.id})">Registrar abono</button><button class="btn" onclick="rentabilityModal(${order.id})">Costos</button></div></article>`;
  }

  function pwaRenderFinance(d) {
    const orders = d.orders.filter(pwaFinancialOrder);
    const income = d.payments.filter(payment => payment.voided !== true && pwaFinancialOrder(pwaOrder(d, payment.orderId))).reduce((sum, payment) => sum + pwaNumber(payment.amount), 0);
    const pending = orders.reduce((sum, order) => sum + pwaBalance(d, order), 0);
    const directCosts = d.costs.filter(costItem => costItem.voided !== true && pwaFinancialOrder(pwaOrder(d, costItem.orderId)));
    const materials = directCosts.filter(item => item.type === 'Materiales').reduce((sum, item) => sum + pwaNumber(item.amount), 0) + d.parts.filter(part => pwaFinancialOrder(pwaOrder(d, part.orderId))).reduce((sum, part) => sum + pwaNumber(part.materialCost), 0);
    const labor = directCosts.filter(item => item.type === 'Mano de obra').reduce((sum, item) => sum + pwaNumber(item.amount), 0) + d.parts.filter(part => pwaFinancialOrder(pwaOrder(d, part.orderId))).reduce((sum, part) => sum + pwaNumber(part.laborCost), 0);
    const otherCosts = directCosts.filter(item => item.type === 'Otros costos').reduce((sum, item) => sum + pwaNumber(item.amount), 0) + d.parts.filter(part => pwaFinancialOrder(pwaOrder(d, part.orderId))).reduce((sum, part) => sum + pwaNumber(part.otherCost), 0);
    const profit = orders.reduce((sum, order) => sum + pwaProfit(d, order), 0);
    const tabs = `<div class="tabs"><button class="${tab === 'summary' ? 'on' : ''}" onclick="pwaFinanceTab('summary')">Resumen</button><button class="${tab === 'payments' ? 'on' : ''}" onclick="pwaFinanceTab('payments')">Pagos</button><button class="${tab === 'costs' ? 'on' : ''}" onclick="pwaFinanceTab('costs')">Costos</button><button class="${tab === 'profits' ? 'on' : ''}" onclick="pwaFinanceTab('profits')">Ganancias</button></div>`;
    let body = '';
    if (tab === 'payments') {
      const payments = d.payments.filter(payment => pwaOrderVisible(pwaOrder(d, payment.orderId))).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      body = `<div class="pwa-list">${payments.length ? payments.map(payment => { const order = pwaOrder(d, payment.orderId); return `<article class="pwa-card ${payment.voided ? 'pwa-archive' : ''}"><h3>${esc(order?.number || 'Orden eliminada')} · ${money(payment.amount)}</h3><p class="muted">${esc(pwaDate(payment.date))} · ${esc(payment.method || 'Sin método')} · ${esc(payment.note || 'Sin nota')}</p><div class="pwa-card-actions">${payment.voided ? `<button class="btn" onclick="pwaRestorePayment(${payment.id})">Restaurar</button>` : `<button class="btn" onclick="paymentModal(${payment.orderId},${payment.id})">Editar</button><button class="btn danger" onclick="pwaVoidPayment(${payment.id})">Anular</button>`}</div></article>`; }).join('') : '<p class="pwa-empty">Aún no hay pagos registrados.</p>'}</div>`;
    } else if (tab === 'costs') {
      const costs = d.costs.filter(costItem => pwaOrderVisible(pwaOrder(d, costItem.orderId))).sort((a, b) => Number(b.id) - Number(a.id));
      body = `<div class="pwa-list">${costs.length ? costs.map(costItem => { const order = pwaOrder(d, costItem.orderId); return `<article class="pwa-card ${costItem.voided ? 'pwa-archive' : ''}"><h3>${esc(costItem.type || 'Costo')} · ${money(costItem.amount)}</h3><p class="muted">${esc(order?.number || 'Orden eliminada')} · ${esc(costItem.description || 'Sin descripción')}</p><div class="pwa-card-actions">${costItem.voided ? `<button class="btn" onclick="pwaRestoreCost(${costItem.id})">Restaurar</button>` : `<button class="btn" onclick="costModal(${costItem.orderId},${costItem.id})">Editar</button><button class="btn danger" onclick="pwaVoidCost(${costItem.id})">Anular</button>`}</div></article>`; }).join('') : '<p class="pwa-empty">No hay costos directos registrados.</p>'}<p class="pwa-help">La mano de obra generada desde piezas se consulta dentro de cada orden y no se duplica al pagar empleados.</p></div>`;
    } else if (tab === 'profits') {
      body = `<div class="pwa-grid">${orders.length ? orders.map(order => pwaFinanceOrderCard(d, order)).join('') : '<p class="pwa-empty">No hay órdenes activas para calcular ganancias.</p>'}</div>`;
    } else {
      body = `<div class="stats"><div class="stat"><span>Ingresos cobrados</span><b>${money(income)}</b></div><div class="stat"><span>Pendiente por cobrar</span><b>${money(pending)}</b></div><div class="stat"><span>Materiales</span><b>${money(materials)}</b></div><div class="stat"><span>Mano de obra</span><b>${money(labor)}</b></div><div class="stat"><span>Otros costos</span><b>${money(otherCosts)}</b></div><div class="stat"><span>Ganancia estimada</span><b>${money(profit)}</b></div></div><div class="pwa-grid">${orders.length ? orders.map(order => pwaFinanceOrderCard(d, order)).join('') : '<p class="pwa-empty">Aún no hay datos financieros.</p>'}</div>`;
    }
    A.innerHTML = shell('Finanzas', `${tabs}<section class="panel">${body}</section>`);
  }

  function pwaRenderSettings(d) {
    const setting = d.settings[0] || { id: 1, name: 'RevivAuto' };
    const customRoles = setting.customRoles || [];
    const lastBackup = setting.lastBackupExportedAt ? pwaDateTime(setting.lastBackupExportedAt) : 'Aún no has exportado una copia.';
    const employeeCards = d.employees.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es')).map(employee => `<article class="pwa-card ${employee.active === false ? 'pwa-archive' : ''}"><h3>${esc(employee.name || 'Empleado sin nombre')}</h3><p class="muted">${esc(employee.role || 'Sin puesto')} · ${employee.active === false ? 'Inactivo' : 'Activo'} · ${money(employee.pieceRate || 0)} por pieza</p><div class="pwa-card-actions"><button class="btn" onclick="employeeLedgerProfile(${employee.id})">Ver cuenta</button><button class="btn" onclick="employeeModal(${employee.id})">Editar</button><button class="btn" onclick="pwaToggleEmployee(${employee.id})">${employee.active === false ? 'Activar' : 'Desactivar'}</button><button class="btn danger" onclick="pwaDeleteEmployee(${employee.id})">Eliminar</button></div></article>`).join('') || '<p class="pwa-empty">Aún no hay empleados.</p>';
    A.innerHTML = shell('Configuración', `<section class="panel"><h2>Datos del taller</h2><form class="form" data-employees="1" onsubmit="saveWorkshop(event,${setting.id || 1})">${field('Nombre del taller', 'name', setting.name)}${field('Teléfono', 'phone', setting.phone)}${field('WhatsApp', 'whatsapp', setting.whatsapp)}${field('Correo electrónico', 'email', setting.email)}${field('Dirección', 'address', setting.address, 'text', 'full')}${field('RNC/Cédula', 'document', setting.document)}${field('Prefijo de órdenes', 'prefix', setting.prefix || 'REV')}${field('Tarifa del pintor por pieza (RD$)', 'painterRate', setting.painterRate || 350, 'number')}<div class="field full"><label>Logo del taller</label><div id="logoPreview">${setting.logoData ? `<img class="workshop-logo" src="${setting.logoData}" alt="Logo del taller">` : '<span class="muted">Aún no hay logo cargado.</span>'}</div><input id="logoInput" type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadLogo(this,${setting.id || 1})"><span class="muted">PNG, JPG, JPEG o WEBP · máximo 2 MB.</span><div class="actions"><button type="button" class="btn" onclick="document.getElementById('logoInput').click()">${setting.logoData ? 'Cambiar logo' : 'Subir logo'}</button>${setting.logoData ? `<button type="button" class="btn danger" onclick="removeLogo(${setting.id || 1})">Eliminar logo</button>` : ''}</div></div><div class="field full"><hr><div class="pwa-section-title"><h2>Empleados y puestos</h2><div><button type="button" class="btn" onclick="employeeModal()">+ Agregar empleado</button> <button type="button" class="btn" onclick="roleModal()">+ Agregar puesto</button></div></div><div class="pwa-grid">${employeeCards}</div><div><b>Puestos personalizados</b><br>${customRoles.length ? customRoles.map(role => `<span class="pwa-tag">${esc(role)} <button type="button" class="link" data-role="${esc(role)}" onclick="pwaDeleteRole(this.dataset.role)">×</button></span>`).join('') : '<span class="muted">No hay puestos personalizados.</span>'}</div></div><div class="field full"><hr><h2>Copias de seguridad</h2><p class="muted">Exporta una copia antes de usar TallerOS en otro teléfono o de hacer cambios importantes. Última exportación: ${esc(lastBackup)}.</p><input id="pwaBackupInput" type="file" accept="application/json,.json" hidden onchange="pwaSelectBackupFile(this)"><div class="actions"><button type="button" class="btn primary" onclick="pwaExportBackup()">Exportar todos los datos</button><button type="button" class="btn" onclick="pwaChooseBackupFile()">Importar copia</button></div></div><div class="field full"><hr><h2>Aplicación móvil</h2><p class="muted">TallerOS puede instalarse desde Safari o Android sin crear una cuenta en línea.</p><button type="button" class="btn primary" onclick="pwaInstallApp()">Instalar TallerOS</button></div><div class="field full"><button class="btn primary">Guardar datos del taller</button></div></form></section>`);
  }

  render = async function () {
    try {
      const d = await pwaData();
      if (view === 'home') pwaRenderHome(d);
      else if (view === 'orders') pwaRenderOrders(d);
      else if (view === 'clients') pwaRenderClients(d);
      else if (view === 'production') pwaRenderProduction(d);
      else if (view === 'finance') pwaRenderFinance(d);
      else pwaRenderSettings(d);
    } catch (error) {
      A.innerHTML = `<main class="loading"><div class="error">No se pudo cargar TallerOS: ${esc(error.message || 'Error desconocido')}</div><button class="btn" onclick="render()">Reintentar</button></main>`;
    }
  };
  window.render = render;

  /*
   * Eliminación segura
   * ------------------
   * Los datos que explican el historial de una orden nunca se eliminan a
   * ciegas. Cuando existe una relación, se conserva el registro mediante
   * archivo, desactivación o anulación. Así no quedan referencias rotas.
   */
  const pwaHasEmployeeHistory = (d, employeeId) => (
    d.parts.some(part => Number(part.employeeId) === Number(employeeId) || (part.laborAssignments || []).some(item => Number(item.employeeId) === Number(employeeId))) ||
    d.costs.some(item => Number(item.employeeId) === Number(employeeId)) ||
    d.ledgerAccounts.some(item => Number(item.employeeId) === Number(employeeId)) ||
    d.ledgerAccruals.some(item => Number(item.employeeId) === Number(employeeId)) ||
    d.ledgerPayments.some(item => Number(item.employeeId) === Number(employeeId))
  );

  window.pwaToggleEmployee = async function (employeeId) {
    const employee = await api.get('employees', Number(employeeId));
    if (!employee) return pwaNotify('No se encontró el empleado.');
    const nextActive = employee.active === false;
    pwaConfirmAction({
      title: nextActive ? 'Activar empleado' : 'Desactivar empleado',
      message: nextActive
        ? `${employee.name} volverá a estar disponible para nuevas asignaciones.`
        : `${employee.name} dejará de aparecer al asignar nuevas piezas, pero su historial se conservará.`,
      actionLabel: nextActive ? 'ACTIVAR' : 'DESACTIVAR',
      action: () => api.put('employees', { ...employee, active: nextActive }),
      successMessage: nextActive ? 'Empleado activado.' : 'Empleado desactivado.'
    });
  };

  window.pwaDeleteEmployee = async function (employeeId) {
    const d = await pwaData();
    const employee = pwaEmployee(d, employeeId);
    if (!employee) return pwaNotify('No se encontró el empleado.');
    if (pwaHasEmployeeHistory(d, employee.id)) {
      pwaConfirmAction({
        title: 'No se puede eliminar este empleado',
        message: `${employee.name} tiene trabajos, cuentas o pagos relacionados. Para conservar las órdenes antiguas, puedes desactivarlo.`,
        actionLabel: 'DESACTIVAR EMPLEADO',
        action: () => api.put('employees', { ...employee, active: false }),
        successMessage: 'Empleado desactivado. Su historial se mantiene disponible.'
      });
      return;
    }
    pwaConfirmAction({
      title: 'Eliminar empleado',
      message: `Eliminarás definitivamente a ${employee.name}. Esta acción no se puede deshacer.`,
      action: () => api.del('employees', employee.id),
      successMessage: 'Empleado eliminado definitivamente.'
    });
  };

  window.pwaDeleteRole = async function (roleValue) {
    const role = String(roleValue || '');
    const d = await pwaData();
    if (d.employees.some(employee => String(employee.role || '') === role)) {
      pwaNotify(`No puedes eliminar “${role}” porque hay empleados con ese puesto. Primero cambia su puesto.`);
      return;
    }
    const setting = d.settings[0];
    if (!setting) return pwaNotify('No se encontró la configuración del taller.');
    pwaConfirmAction({
      title: 'Eliminar puesto',
      message: `Eliminarás el puesto personalizado “${role}”. Esta acción no se puede deshacer.`,
      action: () => api.put('settings', { ...setting, customRoles: (setting.customRoles || []).filter(item => item !== role) }),
      successMessage: 'Puesto eliminado.'
    });
  };

  window.pwaArchiveClient = async function (clientId, archived = true) {
    const client = await api.get('clients', Number(clientId));
    if (!client) return pwaNotify('No se encontró el cliente.');
    pwaConfirmAction({
      title: archived ? 'Archivar cliente' : 'Restaurar cliente',
      message: archived
        ? `${client.name} dejará de aparecer al crear nuevas órdenes, pero conservará sus vehículos y órdenes anteriores.`
        : `${client.name} volverá a aparecer en los selectores de nuevas órdenes.`,
      actionLabel: archived ? 'ARCHIVAR' : 'RESTAURAR',
      action: () => api.put('clients', { ...client, archived }),
      successMessage: archived ? 'Cliente archivado.' : 'Cliente restaurado.'
    });
  };

  window.pwaDeleteClient = async function (clientId) {
    const d = await pwaData();
    const client = pwaClient(d, clientId);
    if (!client) return pwaNotify('No se encontró el cliente.');
    const clientOrders = d.orders.filter(order => Number(order.clientId) === Number(client.id));
    if (clientOrders.length) {
      return pwaArchiveClient(client.id, true);
    }
    const clientVehicles = d.vehicles.filter(vehicle => Number(vehicle.clientId) === Number(client.id));
    pwaConfirmAction({
      title: 'Eliminar cliente',
      message: `${client.name} no tiene órdenes registradas. Se eliminará también ${clientVehicles.length ? `su(s) ${clientVehicles.length} vehículo(s) sin historial` : 'su ficha'}. Esta acción no se puede deshacer.`,
      action: async () => {
        for (const vehicle of clientVehicles) await api.del('vehicles', vehicle.id);
        await api.del('clients', client.id);
      },
      successMessage: 'Cliente y vehículos sin historial eliminados definitivamente.'
    });
  };

  window.pwaArchiveVehicle = async function (vehicleId, archived = true) {
    const vehicle = await api.get('vehicles', Number(vehicleId));
    if (!vehicle) return pwaNotify('No se encontró el vehículo.');
    pwaConfirmAction({
      title: archived ? 'Archivar vehículo' : 'Restaurar vehículo',
      message: archived
        ? `${vehicle.brand || ''} ${vehicle.model || ''} dejará de aparecer en nuevas órdenes, pero seguirá visible en su historial.`
        : `${vehicle.brand || ''} ${vehicle.model || ''} volverá a aparecer al crear órdenes.`,
      actionLabel: archived ? 'ARCHIVAR' : 'RESTAURAR',
      action: () => api.put('vehicles', { ...vehicle, archived }),
      successMessage: archived ? 'Vehículo archivado.' : 'Vehículo restaurado.'
    });
  };

  window.pwaDeleteVehicle = async function (vehicleId) {
    const d = await pwaData();
    const vehicle = pwaVehicle(d, vehicleId);
    if (!vehicle) return pwaNotify('No se encontró el vehículo.');
    if (d.orders.some(order => Number(order.vehicleId) === Number(vehicle.id))) {
      return pwaArchiveVehicle(vehicle.id, true);
    }
    pwaConfirmAction({
      title: 'Eliminar vehículo',
      message: `Eliminarás definitivamente ${vehicle.brand || ''} ${vehicle.model || ''}. Esta acción no se puede deshacer.`,
      action: () => api.del('vehicles', vehicle.id),
      successMessage: 'Vehículo eliminado definitivamente.'
    });
  };

  window.pwaDeleteOrder = async function (orderId) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    if (!order) return pwaNotify('No se encontró la orden.');
    if (pwaOrderTrashed(order)) return pwaNotify('Esta orden ya está en la Papelera.');
    pwaConfirmAction({
      title: 'Mover orden a Papelera',
      message: `${order.number} dejará de aparecer en dashboard, producción, finanzas y órdenes activas. Sus datos se conservarán para que puedas restaurarla cuando quieras.`,
      actionLabel: 'MOVER A PAPELERA',
      action: () => api.put('orders', {
        ...order,
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedPreviousStatus: order.status || 'Aprobada'
      }),
      successMessage: 'Orden movida a Papelera. Ya no participa en los indicadores.'
    });
  };

  window.pwaCancelOrder = async function (orderId) {
    const order = await api.get('orders', Number(orderId));
    if (!order) return pwaNotify('No se encontró la orden.');
    if (pwaOrderTrashed(order)) return pwaNotify('Primero restaura la orden desde Papelera para poder cancelarla.');
    if (pwaIsCancelled(order)) return pwaNotify('Esta orden ya está cancelada.');
    pwaConfirmAction({
      title: 'Cancelar orden',
      message: `${order.number} se conservará en el historial con estado “Cancelada”, pero dejará de contar como trabajo activo o movimiento financiero.`,
      actionLabel: 'CANCELAR ORDEN',
      action: () => api.put('orders', { ...order, status: 'Cancelada', cancelledAt: new Date().toISOString() }),
      successMessage: 'Orden cancelada. Sigue disponible en el historial.'
    });
  };

  window.pwaRestoreOrder = async function (orderId) {
    const order = await api.get('orders', Number(orderId));
    if (!order || !pwaOrderTrashed(order)) return pwaNotify('No se encontró una orden eliminada para restaurar.');
    pwaConfirmAction({
      title: 'Restaurar orden',
      message: `${order.number} volverá con su estado anterior: ${order.deletedPreviousStatus || order.status || 'Aprobada'}. Sus datos volverán a participar en las métricas correspondientes.`,
      actionLabel: 'RESTAURAR',
      action: () => api.put('orders', {
        ...order,
        deleted: false,
        deletedAt: null,
        deletedPreviousStatus: null,
        restoredAt: new Date().toISOString(),
        status: order.deletedPreviousStatus || order.status || 'Aprobada'
      }),
      successMessage: 'Orden restaurada y métricas actualizadas.'
    });
  };

  window.pwaOpenTrashedOrder = async function (orderId) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    if (!order || !pwaOrderTrashed(order)) return pwaNotify('No se encontró la orden en Papelera.');
    const client = pwaClient(d, order.clientId);
    const vehicle = pwaVehicle(d, order.vehicleId);
    const parts = d.parts.filter(part => Number(part.orderId) === Number(order.id));
    const payments = d.payments.filter(payment => Number(payment.orderId) === Number(order.id));
    const costs = d.costs.filter(costItem => Number(costItem.orderId) === Number(order.id));
    pwaDialog(`Papelera · ${order.number}`, `<div class="pwa-list"><div class="pwa-inline-row"><span>Cliente</span><b>${esc(client?.name || 'Cliente sin registro')}</b></div><div class="pwa-inline-row"><span>Vehículo</span><b>${esc(vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''} · ${vehicle.plate || 'Sin placa'}` : 'Vehículo sin registro')}</b></div><div class="pwa-inline-row"><span>Estado anterior</span><b>${esc(order.deletedPreviousStatus || order.status || 'Sin estado')}</b></div><div class="pwa-inline-row"><span>Fecha de eliminación</span><b>${esc(pwaDateTime(order.deletedAt))}</b></div><div class="pwa-inline-row"><span>Entrada / entrega</span><b>${esc(pwaDate(order.entryDate))} / ${esc(pwaDate(order.dueDate))}</b></div><div class="pwa-inline-row"><span>Total original</span><b>${money(order.total)}</b></div></div><section class="panel"><h2>Trabajos conservados</h2>${parts.length ? `<div class="pwa-list">${parts.map(part => `<div class="pwa-inline-row"><span>${esc(part.description || 'Trabajo')}<br><small>${esc(part.status || 'Pendiente')}</small></span><b>${money(part.price)}</b></div>`).join('')}</div>` : '<p class="muted">Sin piezas registradas.</p>'}</section><section class="panel"><h2>Pagos y costos conservados</h2><p class="muted">Estos movimientos se mantienen guardados, pero no afectan los cálculos mientras la orden está en Papelera.</p>${payments.length ? `<h3>Pagos</h3><div class="pwa-list">${payments.map(payment => `<div class="pwa-inline-row"><span>${esc(pwaDate(payment.date))} · ${esc(payment.method || 'Sin método')}<br><small>${esc(payment.note || 'Sin nota')}${payment.voided ? ' · Anulado' : ''}</small></span><b>${money(payment.amount)}</b></div>`).join('')}</div>` : ''}${costs.length ? `<h3>Costos</h3><div class="pwa-list">${costs.map(costItem => `<div class="pwa-inline-row"><span>${esc(costItem.type || 'Costo')} · ${esc(costItem.description || 'Sin descripción')}<br><small>${costItem.voided ? 'Anulado' : 'Activo al momento de eliminar'}</small></span><b>${money(costItem.amount)}</b></div>`).join('')}</div>` : ''}${!payments.length && !costs.length ? '<p class="muted">No hay movimientos financieros registrados.</p>' : ''}</section>${order.notes ? `<section class="panel"><h2>Notas</h2><p>${esc(order.notes)}</p></section>` : ''}<div class="actions"><button type="button" class="btn primary" onclick="pwaRestoreOrder(${order.id})">Restaurar</button><button type="button" class="btn danger" onclick="pwaPermanentDeleteOrder(${order.id})">Eliminar definitivamente</button><button type="button" class="btn" onclick="pwaCloseAction()">Cerrar</button></div>`);
  };

  window.pwaPermanentDeleteOrder = async function (orderId) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    if (!order || !pwaOrderTrashed(order)) return pwaNotify('Solo puedes eliminar definitivamente una orden que esté en Papelera.');
    if (d.ledgerAccruals.some(accrual => Number(accrual.orderId) === Number(order.id))) {
      return pwaNotify('Esta orden tiene mano de obra devengada. Para no alterar las cuentas de empleados, debe conservarse en Papelera.');
    }
    pwaDialog('Eliminar definitivamente', `<p>Vas a borrar para siempre ${esc(order.number)} y sus piezas, pagos y costos directos relacionados.</p><p class="pwa-help">Esta es la primera advertencia. En el siguiente paso tendrás una segunda confirmación irreversible.</p><div class="actions"><button type="button" class="btn" onclick="pwaCloseAction()">CANCELAR</button><button type="button" class="btn danger" onclick="pwaConfirmPermanentDeleteOrder(${order.id})">CONTINUAR</button></div>`);
  };

  window.pwaConfirmPermanentDeleteOrder = async function (orderId) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    if (!order || !pwaOrderTrashed(order)) return pwaNotify('No se encontró la orden en Papelera.');
    if (d.ledgerAccruals.some(accrual => Number(accrual.orderId) === Number(order.id))) {
      return pwaNotify('No se puede borrar esta orden porque tiene historial de mano de obra.');
    }
    pwaConfirmAction({
      title: 'Confirmación final',
      message: `Eliminarás definitivamente ${order.number}, sus piezas, pagos y costos directos. No podrás restaurarla.`,
      actionLabel: 'ELIMINAR DEFINITIVAMENTE',
      action: async () => {
        for (const part of d.parts.filter(item => Number(item.orderId) === Number(order.id))) await api.del('parts', part.id);
        for (const payment of d.payments.filter(item => Number(item.orderId) === Number(order.id))) await api.del('payments', payment.id);
        for (const costItem of d.costs.filter(item => Number(item.orderId) === Number(order.id))) await api.del('costs', costItem.id);
        await api.del('orders', order.id);
      },
      successMessage: 'Orden eliminada definitivamente.'
    });
  };

  window.pwaDeletePart = async function (partId) {
    const d = await pwaData();
    const part = d.parts.find(item => Number(item.id) === Number(partId));
    if (!part) return pwaNotify('No se encontró la pieza.');
    const relatedHistory = (part.laborAssignments || []).length > 0 ||
      pwaNumber(part.materialCost) > 0 || pwaNumber(part.laborCost) > 0 || pwaNumber(part.otherCost) > 0 ||
      d.ledgerAccruals.some(accrual => Number(accrual.partId) === Number(part.id));
    if (relatedHistory) {
      pwaConfirmAction({
        title: 'Archivar pieza o trabajo',
        message: `“${part.description || 'Este trabajo'}” tiene costos o mano de obra relacionados. Se archivará para conservar la rentabilidad y el historial de empleados.`,
        actionLabel: 'ARCHIVAR',
        action: () => api.put('parts', { ...part, archived: true }),
        successMessage: 'Pieza archivada. Sus costos e historial se mantienen.'
      });
      return;
    }
    pwaConfirmAction({
      title: 'Eliminar pieza o trabajo',
      message: `Eliminarás definitivamente “${part.description || 'este trabajo'}”. Esta acción no se puede deshacer.`,
      action: () => api.del('parts', part.id),
      successMessage: 'Pieza eliminada definitivamente.'
    });
  };

  window.pwaRestorePart = async function (partId) {
    const part = await api.get('parts', Number(partId));
    if (!part) return pwaNotify('No se encontró la pieza.');
    await pwaEnsureRecovery();
    await api.put('parts', { ...part, archived: false });
    await render();
    pwaNotify('Pieza restaurada.');
  };

  window.pwaVoidPayment = async function (paymentId) {
    const payment = await api.get('payments', Number(paymentId));
    if (!payment) return pwaNotify('No se encontró el pago.');
    pwaConfirmAction({
      title: 'Anular pago',
      message: `Anularás el abono de ${money(payment.amount)}. Dejará de reducir el balance, pero quedará en el historial para trazabilidad.`,
      actionLabel: 'ANULAR PAGO',
      action: () => api.put('payments', { ...payment, voided: true, voidedAt: new Date().toISOString() }),
      successMessage: 'Pago anulado. El balance fue recalculado.'
    });
  };

  window.pwaRestorePayment = async function (paymentId) {
    const payment = await api.get('payments', Number(paymentId));
    if (!payment) return pwaNotify('No se encontró el pago.');
    await pwaEnsureRecovery();
    await api.put('payments', { ...payment, voided: false, restoredAt: new Date().toISOString() });
    await render();
    pwaNotify('Pago restaurado.');
  };

  window.pwaVoidCost = async function (costId) {
    const costItem = await api.get('costs', Number(costId));
    if (!costItem) return pwaNotify('No se encontró el costo.');
    pwaConfirmAction({
      title: 'Anular costo',
      message: `Anularás ${costItem.description || costItem.type || 'este costo'} por ${money(costItem.amount)}. Dejará de afectar la rentabilidad, pero seguirá visible en el historial.`,
      actionLabel: 'ANULAR COSTO',
      action: () => api.put('costs', { ...costItem, voided: true, voidedAt: new Date().toISOString() }),
      successMessage: 'Costo anulado. La ganancia fue recalculada.'
    });
  };

  window.pwaRestoreCost = async function (costId) {
    const costItem = await api.get('costs', Number(costId));
    if (!costItem) return pwaNotify('No se encontró el costo.');
    await pwaEnsureRecovery();
    await api.put('costs', { ...costItem, voided: false, restoredAt: new Date().toISOString() });
    await render();
    pwaNotify('Costo restaurado.');
  };

  /* Pagos y costos: se editan o anulan sobre el mismo registro de la orden. */
  window.paymentModal = async function (orderId, paymentId = null) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    const payment = paymentId ? d.payments.find(item => Number(item.id) === Number(paymentId)) : {};
    if (!order) return pwaNotify('No se encontró la orden para este pago.');
    if (pwaIsCancelled(order)) return pwaNotify('No puedes registrar pagos en una orden anulada.');
    pwaDialog(paymentId ? 'Editar abono' : `Registrar abono · ${order.number}`, `<form class="form" onsubmit="pwaSaveClientPayment(event,${Number(orderId)},${paymentId ? Number(paymentId) : 'null'})">${field('Fecha *', 'date', payment.date || pwaToday(), 'date')}${field('Monto *', 'amount', payment.amount || '', 'number')}<div class="field"><label>Método de pago</label><select name="method">${['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(method => `<option ${method === payment.method ? 'selected' : ''}>${method}</option>`).join('')}</select></div><div class="field full"><label>Nota</label><textarea name="note">${esc(payment.note || '')}</textarea></div><div class="actions field full"><button type="button" class="btn" onclick="pwaCloseAction()">Cancelar</button><button class="btn primary">Guardar abono</button></div></form>`);
  };

  window.pwaSaveClientPayment = async function (event, orderId, paymentId = null) {
    event.preventDefault();
    try {
      await pwaEnsureRecovery();
      const values = Object.fromEntries(new FormData(event.target));
      const amount = pwaNumber(values.amount);
      if (!values.date) throw new Error('Selecciona la fecha del pago.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Indica un monto de pago válido.');
      const d = await pwaData();
      const order = pwaOrder(d, orderId);
      if (!order || pwaIsCancelled(order)) throw new Error('No se puede registrar un pago en esta orden.');
      const current = paymentId ? d.payments.find(item => Number(item.id) === Number(paymentId)) : null;
      const otherPayments = d.payments.filter(item => Number(item.orderId) === Number(orderId) && item.voided !== true && Number(item.id) !== Number(paymentId));
      const alreadyPaid = otherPayments.reduce((sum, item) => sum + pwaNumber(item.amount), 0);
      if (alreadyPaid + amount > pwaNumber(order.total) + 0.005) throw new Error('El total de abonos no puede ser mayor que el precio de la orden.');
      const record = { ...(current || {}), workshopId: WID, orderId: Number(orderId), date: values.date, amount, method: values.method || 'Efectivo', note: String(values.note || '').trim(), voided: false };
      if (current) await api.put('payments', { ...record, id: current.id });
      else await api.create('payments', record);
      pwaClose();
      await render();
      pwaNotify(current ? 'Abono actualizado y balance recalculado.' : 'Abono registrado y balance recalculado.');
    } catch (error) {
      alert(`No se pudo guardar el abono: ${error.message}`);
    }
  };

  window.costModal = async function (orderId, costId = null) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    const costItem = costId ? d.costs.find(item => Number(item.id) === Number(costId)) : {};
    if (!order) return pwaNotify('No se encontró la orden para este costo.');
    if (pwaIsCancelled(order)) return pwaNotify('No puedes registrar costos en una orden anulada.');
    const existingLabor = costItem.type === 'Mano de obra';
    const types = existingLabor ? ['Mano de obra', 'Materiales', 'Otros costos'] : ['Materiales', 'Otros costos'];
    pwaDialog(costId ? 'Editar costo' : `Agregar costo · ${order.number}`, `<form class="form" onsubmit="pwaSaveCost(event,${Number(orderId)},${costId ? Number(costId) : 'null'})"><div class="field"><label>Tipo</label><select name="type">${types.map(type => `<option ${type === (costItem.type || 'Materiales') ? 'selected' : ''}>${type}</option>`).join('')}</select></div>${field('Concepto o material *', 'description', costItem.description || costItem.concept || '')}${field('Cantidad', 'quantity', costItem.quantity || 1, 'number')}${field('Costo total *', 'amount', costItem.amount || '', 'number')}<div class="field full"><p class="pwa-help">La mano de obra nueva se genera desde las piezas terminadas. No la registres aquí para evitar duplicarla.</p></div><div class="actions field full"><button type="button" class="btn" onclick="pwaCloseAction()">Cancelar</button><button class="btn primary">Guardar costo</button></div></form>`);
  };

  window.pwaSaveCost = async function (event, orderId, costId = null) {
    event.preventDefault();
    try {
      await pwaEnsureRecovery();
      const values = Object.fromEntries(new FormData(event.target));
      const amount = pwaNumber(values.amount);
      if (!values.description?.trim()) throw new Error('Describe el material o concepto.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Indica un costo válido.');
      const d = await pwaData();
      const order = pwaOrder(d, orderId);
      if (!order || pwaIsCancelled(order)) throw new Error('No se puede registrar un costo en esta orden.');
      const current = costId ? d.costs.find(item => Number(item.id) === Number(costId)) : null;
      if (!current && values.type === 'Mano de obra') throw new Error('La mano de obra se crea al terminar una pieza asignada a un empleado.');
      const record = { ...(current || {}), workshopId: WID, orderId: Number(orderId), type: values.type || 'Materiales', description: values.description.trim(), quantity: Math.max(1, pwaNumber(values.quantity) || 1), amount, voided: false };
      if (current) await api.put('costs', { ...record, id: current.id });
      else await api.create('costs', record);
      pwaClose();
      await render();
      pwaNotify(current ? 'Costo actualizado y rentabilidad recalculada.' : 'Costo registrado y rentabilidad recalculada.');
    } catch (error) {
      alert(`No se pudo guardar el costo: ${error.message}`);
    }
  };

  window.rentabilityModal = async function (orderId) {
    const d = await pwaData();
    const order = pwaOrder(d, orderId);
    if (!order) return pwaNotify('No se encontró la orden.');
    const direct = d.costs.filter(item => Number(item.orderId) === Number(order.id));
    const parts = d.parts.filter(item => Number(item.orderId) === Number(order.id));
    const activeDirect = direct.filter(item => item.voided !== true);
    const materials = activeDirect.filter(item => item.type === 'Materiales').reduce((sum, item) => sum + pwaNumber(item.amount), 0) + parts.reduce((sum, item) => sum + pwaNumber(item.materialCost), 0);
    const labor = activeDirect.filter(item => item.type === 'Mano de obra').reduce((sum, item) => sum + pwaNumber(item.amount), 0) + parts.reduce((sum, item) => sum + pwaNumber(item.laborCost), 0);
    const other = activeDirect.filter(item => item.type === 'Otros costos').reduce((sum, item) => sum + pwaNumber(item.amount), 0) + parts.reduce((sum, item) => sum + pwaNumber(item.otherCost), 0);
    const totalCost = materials + labor + other;
    const profit = pwaNumber(order.total) - totalCost;
    const margin = pwaNumber(order.total) ? (profit / pwaNumber(order.total)) * 100 : 0;
    pwaDialog(`Rentabilidad · ${order.number}`, `<div class="stats"><div class="stat"><span>Precio del trabajo</span><b>${money(order.total)}</b></div><div class="stat"><span>Materiales</span><b>${money(materials)}</b></div><div class="stat"><span>Mano de obra</span><b>${money(labor)}</b></div><div class="stat"><span>Otros costos</span><b>${money(other)}</b></div><div class="stat"><span>Ganancia estimada</span><b>${money(profit)}</b></div><div class="stat"><span>Margen</span><b>${margin.toFixed(1)}%</b></div><div class="stat"><span>Cobrado / Balance</span><b>${money(pwaPaid(d, order.id))} / ${money(pwaBalance(d, order))}</b></div></div><div class="actions"><button type="button" class="btn" onclick="costModal(${order.id})">+ Material u otro costo</button><button type="button" class="btn" onclick="paymentModal(${order.id})">Registrar abono</button></div><section class="panel"><h2>Costos directos</h2>${direct.length ? `<div class="pwa-list">${direct.map(item => `<div class="pwa-cost-row ${item.voided ? 'pwa-archive' : ''}"><span><b>${esc(item.type || 'Costo')}</b><br><small>${esc(item.description || 'Sin descripción')}</small></span><b>${money(item.amount)}</b>${item.voided ? '<small>Anulado</small>' : `<span><button class="link" onclick="costModal(${order.id},${item.id})">Editar</button> · <button class="link danger-text" onclick="pwaVoidCost(${item.id})">Anular</button></span>`}</div>`).join('')}</div>` : '<p class="muted">Aún no hay costos directos.</p>'}<p class="pwa-help">Los pagos al empleado solo reducen su saldo pendiente: no crean un segundo costo laboral.</p></section><div class="actions"><button type="button" class="btn" onclick="pwaCloseAction()">Cerrar</button></div>`);
  };

  /* Fichas de clientes y vehículos, con acciones seguras junto a la información. */
  const pwaClientModalBefore = clientModal;
  clientModal = async function (clientId = null) {
    await pwaClientModalBefore(clientId);
    if (!clientId) return;
    const form = document.querySelector('#modal form');
    if (!form || form.dataset.pwaClientDetails) return;
    const d = await pwaData();
    const client = pwaClient(d, clientId);
    if (!client) return;
    form.dataset.pwaClientDetails = '1';
    const vehicles = d.vehicles.filter(vehicle => Number(vehicle.clientId) === Number(client.id));
    const orders = d.orders.filter(order => Number(order.clientId) === Number(client.id) && pwaOrderVisible(order));
    const balance = orders.filter(pwaFinancialOrder).reduce((sum, order) => sum + pwaBalance(d, order), 0);
    form.querySelector('.form')?.insertAdjacentHTML('beforeend', `<div class="field full pwa-detail-section"><hr><h2>Vehículos del cliente</h2>${vehicles.length ? `<div class="pwa-list">${vehicles.map(vehicle => `<div class="pwa-inline-row ${vehicle.archived ? 'pwa-archive' : ''}"><span><b>${esc(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Vehículo')}</b><br><small>${esc(vehicle.plate || 'Sin placa')} ${vehicle.archived ? '· Archivado' : ''}</small></span><span><button type="button" class="btn" onclick="vehicleModal(${vehicle.id})">Editar</button><button type="button" class="link danger-text" onclick="pwaDeleteVehicle(${vehicle.id})">${vehicle.archived ? 'Gestionar' : 'Eliminar / archivar'}</button></span></div>`).join('')}</div>` : '<p class="muted">Aún no hay vehículos registrados.</p>'}<button type="button" class="btn" onclick="vehicleModal(null,${client.id})">+ Agregar vehículo</button><h2>Órdenes anteriores</h2>${orders.length ? `<div class="pwa-list">${orders.map(order => `<div class="pwa-inline-row"><span><b>${esc(order.number || 'Orden')}</b><br><small>${esc(order.status || 'Sin estado')}</small></span><span>${money(pwaBalance(d, order))}<button type="button" class="link" onclick="orderModal(${order.id})">Abrir</button></span></div>`).join('')}</div>` : '<p class="muted">Este cliente todavía no tiene órdenes.</p>'}<p><b>Balance pendiente:</b> ${money(balance)}</p></div>`);
    form.querySelector('.actions')?.insertAdjacentHTML('afterbegin', `<button type="button" class="btn" onclick="pwaArchiveClient(${client.id},${client.archived === true ? 'false' : 'true'})">${client.archived ? 'Restaurar cliente' : 'Archivar cliente'}</button><button type="button" class="btn danger" onclick="pwaDeleteClient(${client.id})">Eliminar</button>`);
  };
  window.clientModal = clientModal;

  window.vehicleModal = async function (vehicleId = null, presetClientId = null) {
    const d = await pwaData();
    const vehicle = vehicleId ? pwaVehicle(d, vehicleId) : {};
    if (vehicleId && !vehicle) return pwaNotify('No se encontró el vehículo.');
    const activeClients = d.clients.filter(client => client.archived !== true || Number(client.id) === Number(vehicle.clientId));
    const selectedClient = Number(presetClientId || vehicle.clientId || 0);
    pwaDialog(vehicleId ? 'Editar vehículo' : 'Agregar vehículo', `<form class="form" onsubmit="pwaSaveVehicle(event,${vehicleId ? Number(vehicleId) : 'null'})"><div class="field full"><label>Cliente propietario *</label><select name="clientId"><option value="">Selecciona un cliente</option>${activeClients.map(client => `<option value="${client.id}" ${Number(client.id) === selectedClient ? 'selected' : ''}>${esc(client.name || 'Cliente')}</option>`).join('')}</select></div>${field('Marca *', 'brand', vehicle.brand || '')}${field('Modelo *', 'model', vehicle.model || '')}${field('Año', 'year', vehicle.year || '', 'number')}${field('Placa', 'plate', vehicle.plate || '')}${field('Color', 'color', vehicle.color || '')}${field('VIN', 'vin', vehicle.vin || '')}<div class="field full"><label>Notas</label><textarea name="notes">${esc(vehicle.notes || '')}</textarea></div><div class="actions field full"><button type="button" class="btn" onclick="pwaCloseAction()">Cancelar</button><button class="btn primary">Guardar vehículo</button></div></form>`);
  };

  window.pwaSaveVehicle = async function (event, vehicleId = null) {
    event.preventDefault();
    try {
      await pwaEnsureRecovery();
      const values = Object.fromEntries(new FormData(event.target));
      if (!values.clientId) throw new Error('Selecciona el cliente propietario.');
      if (!values.brand?.trim() || !values.model?.trim()) throw new Error('Marca y modelo son obligatorios.');
      const old = vehicleId ? await api.get('vehicles', Number(vehicleId)) : null;
      const record = { ...(old || {}), workshopId: WID, clientId: Number(values.clientId), brand: values.brand.trim(), model: values.model.trim(), year: values.year || '', plate: values.plate.trim(), color: values.color.trim(), vin: values.vin.trim(), notes: String(values.notes || '').trim(), archived: old?.archived === true };
      if (old) await api.put('vehicles', { ...record, id: old.id });
      else await api.create('vehicles', record);
      pwaClose();
      await render();
      pwaNotify(old ? 'Vehículo actualizado.' : 'Vehículo creado y asociado al cliente.');
    } catch (error) {
      alert(`No se pudo guardar el vehículo: ${error.message}`);
    }
  };

  /* Los selectores de órdenes solo ofrecen clientes y vehículos activos. */
  filterVehicles = async function (select) {
    const d = await pwaData();
    const target = document.querySelector('#modal select[name="vehicleId"]');
    if (!target) return;
    const current = Number(target.value || 0);
    const vehicles = d.vehicles.filter(vehicle => Number(vehicle.clientId) === Number(select.value) && vehicle.archived !== true);
    target.innerHTML = vehicles.length ? `<option value="">Selecciona un vehículo</option>${vehicles.map(vehicle => `<option value="${vehicle.id}" ${Number(vehicle.id) === current ? 'selected' : ''}>${esc(vn(d, vehicle.id))}</option>`).join('')}` : '<option value="">Este cliente no tiene vehículos activos</option>';
  };
  window.filterVehicles = filterVehicles;

  const pwaOrderModalBefore = orderModal;
  orderModal = async function (orderId = null) {
    await pwaOrderModalBefore(orderId);
    const form = document.querySelector('#modal form input[name="kind"][value="order"]')?.closest('form');
    if (!form) return;
    const d = await pwaData();
    const order = orderId ? pwaOrder(d, orderId) : null;
    const clientSelect = form.querySelector('select[name="clientId"]');
    if (clientSelect) {
      [...clientSelect.options].forEach(option => {
        const client = pwaClient(d, option.value);
        if (client?.archived === true && Number(option.value) !== Number(order?.clientId)) option.remove();
      });
    }
    const vehicleSelect = form.querySelector('select[name="vehicleId"]');
    if (vehicleSelect) {
      [...vehicleSelect.options].forEach(option => {
        const vehicle = pwaVehicle(d, option.value);
        if (vehicle?.archived === true && Number(option.value) !== Number(order?.vehicleId)) option.remove();
      });
    }
    if (!order || form.dataset.pwaOrderActions) return;
    form.dataset.pwaOrderActions = '1';
    form.querySelector('.actions')?.insertAdjacentHTML('afterbegin', `<button type="button" class="btn" onclick="paymentModal(${order.id})">Registrar abono</button><button type="button" class="btn" onclick="rentabilityModal(${order.id})">Rentabilidad</button><button type="button" class="btn" onclick="pwaCancelOrder(${order.id})">Cancelar orden</button><button type="button" class="btn danger" onclick="pwaDeleteOrder(${order.id})">Eliminar</button>`);
  };
  window.orderModal = orderModal;

  const pwaPartModalBefore = window.partModal;
  window.partModal = async function (partId = null, orderId = null) {
    await pwaPartModalBefore(partId, orderId);
    if (!partId) return;
    const form = document.querySelector('#modal form input[name="kind"][value="part"]')?.closest('form');
    if (!form || form.dataset.pwaPartActions) return;
    const d = await pwaData();
    const part = d.parts.find(item => Number(item.id) === Number(partId));
    if (!part) return;
    const employeeSelect = form.querySelector('select[name="employeeId"]');
    if (employeeSelect) {
      [...employeeSelect.options].forEach(option => {
        const employee = pwaEmployee(d, option.value);
        if (employee?.active === false && Number(option.value) !== Number(part.employeeId)) option.remove();
      });
    }
    form.dataset.pwaPartActions = '1';
    form.querySelector('.actions')?.insertAdjacentHTML('afterbegin', part.archived
      ? `<button type="button" class="btn" onclick="pwaRestorePart(${part.id})">Restaurar pieza</button>`
      : `<button type="button" class="btn danger" onclick="pwaDeletePart(${part.id})">Eliminar / archivar</button>`);
  };

  /* Cuentas de empleados: editar o anular pagos nunca vuelve a crear costos. */
  async function pwaEmployeeLedgerData(employeeId) {
    const [accounts, accruals, payments] = await Promise.all([
      pwaLedger.listForEmployee('accounts', employeeId),
      pwaLedger.listForEmployee('accruals', employeeId),
      pwaLedger.listForEmployee('payments', employeeId)
    ]);
    const refreshed = [];
    for (const account of accounts) refreshed.push(await pwaLedger.refreshAccount(account.id));
    return {
      accounts: refreshed.sort((a, b) => Number(b.number || 0) - Number(a.number || 0)),
      accruals: accruals.sort((a, b) => new Date(b.generatedAt || b.date || 0) - new Date(a.generatedAt || a.date || 0)),
      payments: payments.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
    };
  }

  employeeLedgerProfile = async function (employeeId) {
    try {
      await pwaEnsureRecovery();
      const d = await pwaData();
      const employee = pwaEmployee(d, employeeId);
      if (!employee) throw new Error('No se encontró el empleado.');
      const ledgerData = await pwaEmployeeLedgerData(employee.id);
      const validPayments = ledgerData.payments.filter(item => item.voided !== true);
      const totalGenerated = ledgerData.accruals.reduce((sum, item) => sum + pwaNumber(item.total), 0);
      const totalPaid = validPayments.reduce((sum, item) => sum + pwaNumber(item.amount), 0);
      const totalPieces = ledgerData.accruals.reduce((sum, item) => sum + pwaNumber(item.quantity), 0);
      const piecesThisMonth = ledgerData.accruals.filter(item => String(item.date || '').slice(0, 7) === pwaMonth()).reduce((sum, item) => sum + pwaNumber(item.quantity), 0);
      const pending = Math.max(0, totalGenerated - totalPaid);
      const accountCards = ledgerData.accounts.length ? ledgerData.accounts.map(account => `<article class="pwa-card"><h3>Cuenta #${String(account.number || 0).padStart(3, '0')} · ${esc(account.status || 'ABIERTA')}</h3><div class="pwa-line"><span>Generado</span><b>${money(account.generated)}</b></div><div class="pwa-line"><span>Pagado / Pendiente</span><b>${money(account.paid)} / ${money(account.balance)}</b></div>${account.closedAt ? `<small class="muted">Cerrada: ${esc(pwaDate(account.closedAt))}</small>` : ''}<div class="pwa-card-actions">${account.status === 'ABIERTA' && pwaNumber(account.balance) > 0.005 ? `<button class="btn primary" onclick="employeeLedgerPaymentModal('${account.id}')">Registrar pago</button>` : ''}${account.status === 'PAGADA' ? `<button class="btn primary" onclick="employeeLedgerCloseAccount('${account.id}',${employee.id})">Cerrar cuenta</button>` : ''}</div></article>`).join('') : '<p class="muted">La primera cuenta se crea cuando termina una pieza asignada a este empleado.</p>';
      const workHistory = ledgerData.accruals.length ? `<div class="pwa-list">${ledgerData.accruals.map(item => { const order = pwaOrder(d, item.orderId); const vehicle = pwaVehicle(d, item.vehicleId); return `<article class="pwa-inline-row"><span><b>${esc(pwaDate(item.date))} · ${esc(order?.number || 'Orden conservada')}</b><br><small>${esc(vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}` : 'Vehículo sin registro')} · ${esc(item.work || 'Trabajo')} · ${pwaNumber(item.quantity)} pieza(s)</small></span><b>${money(item.total)}</b></article>`; }).join('')}</div>` : '<p class="muted">Aún no hay trabajos terminados.</p>';
      const paymentHistory = ledgerData.payments.length ? `<div class="pwa-list">${ledgerData.payments.map(item => { const account = ledgerData.accounts.find(accountItem => accountItem.id === item.accountId); const locked = account?.status === 'CERRADA'; return `<article class="pwa-inline-row ${item.voided ? 'pwa-archive' : ''}"><span><b>${esc(pwaDate(item.date))} · ${money(item.amount)}</b><br><small>${esc(item.note || 'Sin nota')}${item.voided ? ' · Anulado' : ''}</small></span>${item.voided ? '<small>Anulado</small>' : `<span>${locked ? '<small>Cuenta cerrada</small>' : `<button class="link" onclick="pwaEditEmployeePayment('${item.id}')">Editar</button> · <button class="link danger-text" onclick="pwaVoidEmployeePayment('${item.id}')">Anular</button>`}</span>`}</article>`; }).join('')}</div>` : '<p class="muted">Aún no hay pagos registrados.</p>';
      pwaDialog(`${employee.name} · Cuenta de mano de obra`, `<p class="muted">${esc(employee.role || 'Sin puesto')} · ${employee.active === false ? 'Inactivo' : 'Activo'} · Tarifa predeterminada: ${money(employee.pieceRate || 0)} por pieza</p><div class="stats"><div class="stat"><span>Piezas realizadas</span><b>${totalPieces}</b><small>Este mes: ${piecesThisMonth}</small></div><div class="stat"><span>Mano de obra generada</span><b>${money(totalGenerated)}</b></div><div class="stat"><span>Total pagado</span><b>${money(totalPaid)}</b></div><div class="stat"><span>Saldo pendiente</span><b>${money(pending)}</b></div></div><section class="panel"><h2>Cuentas y períodos</h2><div class="pwa-grid">${accountCards}</div></section><section class="panel"><h2>Historial de trabajos</h2>${workHistory}</section><section class="panel"><h2>Historial de pagos</h2>${paymentHistory}</section><div class="actions"><button type="button" class="btn" onclick="employeeModal(${employee.id})">Editar empleado</button><button type="button" class="btn" onclick="pwaCloseAction()">Cerrar</button></div>`);
    } catch (error) {
      alert(`No se pudo abrir la cuenta del empleado: ${error.message}`);
    }
  };
  window.employeeLedgerProfile = employeeLedgerProfile;

  employeeLedgerPaymentModal = async function (accountId) {
    try {
      await pwaEnsureRecovery();
      const account = await pwaLedger.refreshAccount(accountId);
      if (account.status === 'CERRADA') throw new Error('Esta cuenta ya está cerrada. Su historial se conserva y no puede modificarse.');
      if (pwaNumber(account.balance) <= 0.005) throw new Error('Esta cuenta ya está completamente pagada. Puedes cerrarla desde el perfil.');
      pwaDialog('Registrar pago de empleado', `<p class="muted">Cuenta #${String(account.number || 0).padStart(3, '0')} · Saldo pendiente: ${money(account.balance)}</p><form class="form" onsubmit="employeeLedgerSavePayment(event,'${account.id}')">${field('Fecha *', 'date', pwaToday(), 'date')}${field('Monto a pagar *', 'amount', '', 'number')}<div class="field full"><label>Nota</label><textarea name="note"></textarea></div><div class="actions field full"><button type="button" class="btn" onclick="employeeLedgerProfile(${account.employeeId})">Cancelar</button><button class="btn primary">Guardar pago</button></div></form>`);
    } catch (error) {
      alert(error.message);
    }
  };
  window.employeeLedgerPaymentModal = employeeLedgerPaymentModal;

  employeeLedgerSavePayment = async function (event, accountId) {
    event.preventDefault();
    try {
      await pwaEnsureRecovery();
      const values = Object.fromEntries(new FormData(event.target));
      const account = await pwaLedger.recordPayment(accountId, values.amount, values.note, values.date || pwaToday());
      await render();
      await employeeLedgerProfile(account.employeeId);
      pwaNotify('Pago de empleado registrado. El costo de la orden no se duplicó.');
    } catch (error) {
      alert(`No se pudo registrar el pago: ${error.message}`);
    }
  };
  window.employeeLedgerSavePayment = employeeLedgerSavePayment;

  window.pwaEditEmployeePayment = async function (paymentId) {
    const payment = await pwaLedger.get('payments', paymentId);
    if (!payment || payment.voided === true) return pwaNotify('No se encontró un pago activo para editar.');
    const account = await pwaLedger.refreshAccount(payment.accountId);
    if (account.status === 'CERRADA') return pwaNotify('La cuenta ya está cerrada. Su historial no se puede alterar.');
    pwaDialog('Editar pago de empleado', `<form class="form" onsubmit="pwaSaveEmployeePayment(event,'${payment.id}')">${field('Fecha *', 'date', payment.date || pwaToday(), 'date')}${field('Monto a pagar *', 'amount', payment.amount || '', 'number')}<div class="field full"><label>Nota</label><textarea name="note">${esc(payment.note || '')}</textarea></div><div class="actions field full"><button type="button" class="btn" onclick="employeeLedgerProfile(${payment.employeeId})">Cancelar</button><button class="btn primary">Guardar cambios</button></div></form>`);
  };

  window.pwaSaveEmployeePayment = async function (event, paymentId) {
    event.preventDefault();
    try {
      await pwaEnsureRecovery();
      const values = Object.fromEntries(new FormData(event.target));
      const payment = await pwaLedger.get('payments', paymentId);
      if (!payment || payment.voided === true) throw new Error('No se encontró un pago activo.');
      const account = await pwaLedger.refreshAccount(payment.accountId);
      if (account.status === 'CERRADA') throw new Error('La cuenta ya está cerrada.');
      const amount = pwaNumber(values.amount);
      const allPayments = await pwaLedger.all('payments');
      const otherPaid = allPayments.filter(item => item.accountId === account.id && item.id !== payment.id && item.voided !== true).reduce((sum, item) => sum + pwaNumber(item.amount), 0);
      if (!values.date) throw new Error('Selecciona la fecha del pago.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Indica un monto válido.');
      if (otherPaid + amount > pwaNumber(account.generated) + 0.005) throw new Error('El pago no puede ser mayor que la mano de obra generada en la cuenta.');
      await pwaLedger.put('payments', { ...payment, date: values.date, amount, note: String(values.note || '').trim(), updatedAt: new Date().toISOString() });
      await pwaLedger.refreshAccount(account.id);
      await render();
      await employeeLedgerProfile(payment.employeeId);
      pwaNotify('Pago de empleado actualizado.');
    } catch (error) {
      alert(`No se pudo actualizar el pago: ${error.message}`);
    }
  };

  window.pwaVoidEmployeePayment = async function (paymentId) {
    const payment = await pwaLedger.get('payments', paymentId);
    if (!payment || payment.voided === true) return pwaNotify('No se encontró un pago activo.');
    const account = await pwaLedger.refreshAccount(payment.accountId);
    if (account.status === 'CERRADA') return pwaNotify('La cuenta ya está cerrada. Su historial no se puede alterar.');
    pwaConfirmAction({
      title: 'Anular pago de empleado',
      message: `Anularás el pago de ${money(payment.amount)}. El saldo pendiente de ${pwaEmployee((await pwaData()), payment.employeeId)?.name || 'este empleado'} se recalculará; la mano de obra de la orden no cambia.`,
      actionLabel: 'ANULAR PAGO',
      action: async () => {
        await pwaLedger.put('payments', { ...payment, voided: true, voidedAt: new Date().toISOString() });
        await pwaLedger.refreshAccount(account.id);
      },
      successMessage: 'Pago de empleado anulado. Su saldo pendiente fue recalculado.'
    });
  };

  employeeLedgerCloseAccount = async function (accountId, employeeId) {
    const account = await pwaLedger.refreshAccount(accountId);
    if (account.status !== 'PAGADA' || pwaNumber(account.balance) > 0.005) {
      return pwaNotify('Solo puedes cerrar una cuenta que esté completamente pagada.');
    }
    pwaConfirmAction({
      title: 'Cerrar cuenta pagada',
      message: `Cerrarás la cuenta #${String(account.number || 0).padStart(3, '0')}. TallerOS abrirá un nuevo período con saldo RD$0 y conservará este historial.`,
      actionLabel: 'CERRAR CUENTA',
      action: () => pwaLedger.closePaidAccount(accountId),
      successMessage: 'Cuenta cerrada y nuevo período creado con saldo RD$0.'
    });
  };
  window.employeeLedgerCloseAccount = employeeLedgerCloseAccount;

  Promise.resolve().then(() => render());
})();
