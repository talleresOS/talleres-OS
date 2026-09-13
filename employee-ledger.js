/*
 * Libro de mano de obra de TallerOS.
 *
 * Se guarda en una base auxiliar para no cambiar ni reiniciar la base de datos
 * existente de TallerOS. Los registros se relacionan con las claves reales de
 * empleados, órdenes, vehículos y piezas; no se duplican dentro de Finanzas.
 */
(() => {
  const MAIN_DATABASE = 'talleros2';
  const WORKSHOP_ID = 1;
  const BACKUP_ID = 'before-employee-ledger-v1';
  const PWA_BACKUP_ID = 'before-pwa-mobile-v1';
  const MAIN_STORES = ['settings', 'clients', 'vehicles', 'orders', 'parts', 'employees', 'payments', 'costs'];

  const request = result => new Promise((resolve, reject) => {
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error || new Error('No se pudo acceder al almacenamiento local.'));
  });

  const transactionDone = transaction => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudieron guardar los cambios.'));
    transaction.onabort = () => reject(transaction.error || new Error('La operación fue cancelada.'));
  });

  const newId = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const Ledger = {
    name: 'talleros2-ledger',
    version: 1,
    stores: ['snapshots', 'accounts', 'accruals', 'payments'],
    id: newId,

    open() {
      return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(this.name, this.version);
        openRequest.onupgradeneeded = () => {
          const database = openRequest.result;
          this.stores.forEach(store => {
            if (!database.objectStoreNames.contains(store)) {
              database.createObjectStore(store, { keyPath: 'id' });
            }
          });
        };
        openRequest.onsuccess = () => resolve(openRequest.result);
        openRequest.onerror = () => reject(openRequest.error || new Error('No se pudo iniciar el libro de mano de obra.'));
      });
    },

    openMain() {
      return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(MAIN_DATABASE);
        openRequest.onsuccess = () => resolve(openRequest.result);
        openRequest.onerror = () => reject(openRequest.error || new Error('No se pudo abrir la información actual de TallerOS.'));
      });
    },

    async get(store, id) {
      const database = await this.open();
      return request(database.transaction(store, 'readonly').objectStore(store).get(id));
    },

    async all(store) {
      const database = await this.open();
      return request(database.transaction(store, 'readonly').objectStore(store).getAll());
    },

    async put(store, value) {
      if (!value || value.id === undefined || value.id === null || value.id === '') {
        throw new Error('No se pudo guardar un registro de mano de obra sin una clave válida.');
      }
      const database = await this.open();
      return request(database.transaction(store, 'readwrite').objectStore(store).put(value));
    },

    async snapshotMainData(snapshotId = BACKUP_ID) {
      const existing = await this.get('snapshots', snapshotId);
      if (existing) return existing;

      const database = await this.openMain();
      const presentStores = MAIN_STORES.filter(store => database.objectStoreNames.contains(store));
      const transaction = database.transaction(presentStores, 'readonly');
      const completed = transactionDone(transaction);
      const collections = {};
      await Promise.all(presentStores.map(async store => {
        collections[store] = await request(transaction.objectStore(store).getAll());
      }));
      await completed;

      const snapshot = {
        id: snapshotId,
        workshopId: WORKSHOP_ID,
        createdAt: new Date().toISOString(),
        collections
      };
      await this.put('snapshots', snapshot);
      return snapshot;
    },

    async createPwaRecoverySnapshot() {
      const snapshot = await this.snapshotMainData(PWA_BACKUP_ID);
      if (snapshot.ledgerCollections) return snapshot;
      const ledgerCollections = {};
      for (const store of ['accounts', 'accruals', 'payments']) {
        ledgerCollections[store] = await this.all(store);
      }
      const recovered = { ...snapshot, ledgerCollections, completedAt: new Date().toISOString() };
      await this.put('snapshots', recovered);
      return recovered;
    },

    /* Crea una recuperación nueva antes de una importación, sin sobrescribir las anteriores. */
    async createRecoverySnapshot(snapshotId) {
      if (!snapshotId) throw new Error('No se pudo crear una copia de recuperación sin identificador.');
      const existing = await this.get('snapshots', snapshotId);
      if (existing?.ledgerCollections) return existing;
      const snapshot = await this.snapshotMainData(snapshotId);
      const ledgerCollections = {};
      for (const store of ['accounts', 'accruals', 'payments']) {
        ledgerCollections[store] = await this.all(store);
      }
      const recovered = {
        ...snapshot,
        ledgerCollections,
        completedAt: new Date().toISOString()
      };
      await this.put('snapshots', recovered);
      return recovered;
    },

    /* Reemplaza únicamente los registros del taller importado. Las snapshots quedan intactas. */
    async replaceWorkshopCollections(collections) {
      const database = await this.open();
      const targetStores = ['accounts', 'accruals', 'payments'];
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(targetStores, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('No se pudo importar el historial de empleados.'));
        transaction.onabort = () => reject(transaction.error || new Error('La importación del historial de empleados fue cancelada.'));
        targetStores.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const readRequest = store.getAll();
          readRequest.onerror = () => transaction.abort();
          readRequest.onsuccess = () => {
            readRequest.result
              .filter(item => Number(item?.workshopId) === Number(WORKSHOP_ID))
              .forEach(item => store.delete(item.id));
            (collections?.[storeName] || []).forEach(item => {
              store.put({ ...item, workshopId: WORKSHOP_ID });
            });
          };
        });
      });
    },

    /*
     * Las piezas ya terminadas quedan como historial, sin crear deudas hacia
     * atrás. Las que aún están en proceso pueden devengarse al terminarlas;
     * como su costo ya existía en la pieza anterior, se marca para no sumarlo
     * dos veces en Finanzas.
     */
    async prepareMigration() {
      const snapshot = await this.snapshotMainData();
      const database = await this.openMain();
      if (!database.objectStoreNames.contains('parts')) {
        return { snapshot, markedLegacyAssignments: 0 };
      }

      const readTransaction = database.transaction('parts', 'readonly');
      const readCompleted = transactionDone(readTransaction);
      const parts = await request(readTransaction.objectStore('parts').getAll());
      await readCompleted;
      const updates = [];

      parts.filter(part => part.workshopId === WORKSHOP_ID && Array.isArray(part.laborAssignments)).forEach(part => {
        let changed = false;
        const assignments = part.laborAssignments.map(assignment => {
          if (assignment.sourceAssignmentId) return assignment;
          changed = true;
          return {
            ...assignment,
            sourceAssignmentId: newId(),
            ledgerState: part.status === 'Terminada' ? 'legacy' : 'pending',
            ledgerCostAlreadyCounted: part.status !== 'Terminada'
          };
        });
        if (changed) {
          updates.push({
            ...part,
            laborAssignments: assignments,
            legacyLaborCost: Number(part.legacyLaborCost ?? part.laborCost ?? 0)
          });
        }
      });

      if (updates.length) {
        const writeTransaction = database.transaction('parts', 'readwrite');
        const writeCompleted = transactionDone(writeTransaction);
        const store = writeTransaction.objectStore('parts');
        updates.forEach(part => store.put(part));
        await writeCompleted;
      }

      return { snapshot, markedLegacyAssignments: updates.length };
    },

    async listForEmployee(store, employeeId) {
      const values = await this.all(store);
      return values.filter(item => item.workshopId === WORKSHOP_ID && Number(item.employeeId) === Number(employeeId));
    },

    async nextOpenAccount(employeeId) {
      const accounts = await this.listForEmployee('accounts', employeeId);
      const current = accounts
        .filter(account => account.status === 'ABIERTA')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (current) return current;

      const nextNumber = Math.max(0, ...accounts.map(account => Number(account.number) || 0)) + 1;
      const account = {
        id: newId(),
        workshopId: WORKSHOP_ID,
        employeeId: Number(employeeId),
        number: nextNumber,
        status: 'ABIERTA',
        generated: 0,
        paid: 0,
        balance: 0,
        createdAt: new Date().toISOString(),
        closedAt: null
      };
      await this.put('accounts', account);
      return account;
    },

    async refreshAccount(accountId) {
      const account = await this.get('accounts', accountId);
      if (!account) throw new Error('No se encontró la cuenta del empleado.');
      const [allAccruals, allPayments] = await Promise.all([this.all('accruals'), this.all('payments')]);
      const generated = allAccruals
        .filter(item => item.accountId === account.id)
        .reduce((sum, item) => sum + Number(item.total || 0), 0);
      const paid = allPayments
        .filter(item => item.accountId === account.id && item.voided !== true)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const balance = Math.max(0, generated - paid);
      const status = account.status === 'CERRADA' ? 'CERRADA' : (balance <= 0.005 && generated > 0 ? 'PAGADA' : 'ABIERTA');
      const refreshed = { ...account, generated, paid, balance, status };
      await this.put('accounts', refreshed);
      return refreshed;
    },

    async finalizePart(part, order) {
      if (part.status !== 'Terminada' || !Array.isArray(part.laborAssignments) || !part.laborAssignments.length) {
        return part;
      }

      let assignmentsChanged = false;
      const updatedAssignments = [];
      for (const original of part.laborAssignments) {
        const assignment = { ...original };
        if (assignment.ledgerState === 'legacy') {
          updatedAssignments.push(assignment);
          continue;
        }
        if (!assignment.sourceAssignmentId) {
          assignment.sourceAssignmentId = newId();
          assignment.ledgerState = 'legacy';
          assignmentsChanged = true;
          updatedAssignments.push(assignment);
          continue;
        }

        const existing = (await this.all('accruals')).find(item => item.sourceAssignmentId === assignment.sourceAssignmentId);
        if (existing) {
          if (assignment.accrualId !== existing.id || assignment.ledgerState !== 'generated') {
            assignment.accrualId = existing.id;
            assignment.ledgerState = 'generated';
            assignment.generatedAt = existing.generatedAt;
            assignmentsChanged = true;
          }
          updatedAssignments.push(assignment);
          continue;
        }

        const employeeId = Number(assignment.employeeId);
        const total = Number(assignment.total || 0);
        const quantity = Number(assignment.quantity || 0);
        if (!employeeId || !Number.isFinite(total) || total < 0 || !Number.isFinite(quantity) || quantity <= 0) {
          assignment.ledgerState = 'invalid';
          assignmentsChanged = true;
          updatedAssignments.push(assignment);
          continue;
        }

        const account = await this.nextOpenAccount(employeeId);
        const createdAt = new Date().toISOString();
        const accrual = {
          id: newId(),
          workshopId: WORKSHOP_ID,
          accountId: account.id,
          sourceAssignmentId: assignment.sourceAssignmentId,
          employeeId,
          orderId: Number(order.id),
          vehicleId: Number(order.vehicleId),
          partId: Number(part.id),
          role: assignment.role || '',
          work: assignment.work || part.description || 'Trabajo realizado',
          quantity,
          rate: Number(assignment.rate || 0),
          paymentMode: assignment.mode || 'Por pieza',
          total,
          date: assignment.date || createdAt.slice(0, 10),
          generatedAt: createdAt
        };
        await this.put('accruals', accrual);
        await this.refreshAccount(account.id);

        assignment.accrualId = accrual.id;
        assignment.ledgerState = 'generated';
        assignment.generatedAt = createdAt;
        assignmentsChanged = true;
        updatedAssignments.push(assignment);
      }

      const generatedLabor = updatedAssignments
        .filter(assignment => assignment.ledgerState === 'generated' && assignment.ledgerCostAlreadyCounted !== true)
        .reduce((sum, assignment) => sum + Number(assignment.total || 0), 0);
      const legacyLabor = Number(part.legacyLaborCost || 0);
      return {
        ...part,
        laborAssignments: updatedAssignments,
        laborCost: legacyLabor + generatedLabor,
        legacyLaborCost: legacyLabor,
        laborGeneratedAt: assignmentsChanged ? new Date().toISOString() : part.laborGeneratedAt
      };
    },

    async recordPayment(accountId, amount, note = '', date = new Date().toISOString().slice(0, 10)) {
      const account = await this.refreshAccount(accountId);
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Indica un monto de pago válido.');
      }
      if (account.status === 'CERRADA') {
        throw new Error('Esta cuenta ya está cerrada.');
      }
      if (numericAmount > account.balance + 0.005) {
        throw new Error('El pago no puede ser mayor que el saldo pendiente.');
      }
      const payment = {
        id: newId(),
        workshopId: WORKSHOP_ID,
        accountId: account.id,
        employeeId: account.employeeId,
        amount: numericAmount,
        note: String(note || '').trim(),
        date,
        createdAt: new Date().toISOString(),
        voided: false
      };
      await this.put('payments', payment);
      return this.refreshAccount(account.id);
    },

    async closePaidAccount(accountId) {
      const account = await this.refreshAccount(accountId);
      if (account.status !== 'PAGADA' || account.balance > 0.005) {
        throw new Error('Solo puedes cerrar una cuenta que esté completamente pagada.');
      }
      const closed = { ...account, status: 'CERRADA', closedAt: new Date().toISOString() };
      await this.put('accounts', closed);
      const next = await this.nextOpenAccount(account.employeeId);
      return { closed, next };
    }
  };

  window.TallerOSLedger = Ledger;
})();
