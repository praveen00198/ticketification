/**
 * Native IndexedDB Offline Scan Queue Service
 * 
 * Supports Requirement R4: Conditional client-side offline scan queuing
 * when the backend verification service is unreachable due to network
 * disconnection, timeouts, or HTTP 5xx server errors.
 * 
 * Invariants:
 * 1. Standard window.indexedDB only (no external dependencies).
 * 2. Database: ticketification_offline_db, version 1, store: offline_scans.
 * 3. 4xx validation errors (INVALID, ALREADY_USED, WRONG_EVENT) must NEVER trigger offline queuing.
 * 4. Queued records are deleted only after verified server acknowledgement.
 */

export interface OfflineScanRecord {
  id: string; // Unique scan event UUID / Idempotency key
  token: string; // Sanitized QR verification token
  eventId: string; // Target event identifier
  clientTimestamp: string; // ISO-8601 string of exact scan time
  deviceId: string; // Persistent scanner hardware/browser ID
  gate?: string; // Optional gate identifier
  workerName?: string; // Optional staff name if worker pass
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number; // Number of sync attempts
  lastError?: string; // Last error message if sync failed
  createdAt: number; // Unix ms timestamp for sorting
}

const DB_NAME = 'ticketification_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_scans';
const DEVICE_ID_KEY = 'ticketification_scanner_device_id';

/**
 * Generates or retrieves a persistent scanner device UUID from localStorage.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'node-scanner-env';
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        deviceId = crypto.randomUUID();
      } else {
        deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
      }
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (_e) {
    return 'ephemeral-device-' + Math.random().toString(36).substring(2, 9);
  }
}

/**
 * Strict Error Classifier:
 * Returns true strictly on network disconnection, request timeout, or server 5xx errors.
 * Returns false for HTTP 400, 401, 403, 404, 422 and normal validation rejections.
 */
export function isOfflineOrServerError(error: any): boolean {
  if (!error) return false;

  // 1. Explicit offline network condition
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  // 2. Axios / Fetch network error codes
  const code = error?.code || error?.name;
  if (
    code === 'ERR_NETWORK' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT'
  ) {
    return true;
  }

  // 3. Message inspection for network drops & timeouts
  const msg = (error?.message || '').toLowerCase();
  if (
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout of') ||
    msg.includes('timed out') ||
    msg.includes('connection refused')
  ) {
    return true;
  }

  // 4. HTTP Status Code Boundary
  const status = error?.response?.status ?? error?.status;
  if (typeof status === 'number') {
    // 5xx Server Errors (500, 502, 503, 504) -> Queue to IndexedDB
    if (status >= 500 && status < 600) {
      return true;
    }
    // 4xx Validation / Auth Errors (400, 401, 403, 404, 422) -> DO NOT QUEUE
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  return false;
}

/**
 * Opens and initializes the native IndexedDB database.
 */
export function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_eventId', 'eventId', { unique: false });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_timestamp', 'clientTimestamp', { unique: false });
        store.createIndex('by_event_token', ['eventId', 'token'], { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Enqueue a scan into the offline IndexedDB store.
 * Prevents duplicate pending queue entries for the same token and event.
 */
export async function enqueueOfflineScan(params: {
  token: string;
  eventId: string;
  gate?: string;
  workerName?: string;
}): Promise<OfflineScanRecord> {
  // Request durable storage to avoid browser cache eviction under disk pressure
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      await navigator.storage.persist();
    } catch (_e) {}
  }

  const db = await openOfflineDatabase();
  const deviceId = getOrCreateDeviceId();
  const now = Date.now();
  const clientTimestamp = new Date(now).toISOString();

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `scan_${now}_${Math.random().toString(36).substring(2, 9)}`;

  const record: OfflineScanRecord = {
    id,
    token: params.token.trim(),
    eventId: params.eventId,
    clientTimestamp,
    deviceId,
    gate: params.gate || 'Turnstile Gate',
    workerName: params.workerName?.trim() || undefined,
    status: 'PENDING',
    retryCount: 0,
    createdAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Check compound index to see if an identical token is already PENDING for this event
    const eventTokenIndex = store.index('by_event_token');
    const existingReq = eventTokenIndex.getAll([record.eventId, record.token]);

    existingReq.onsuccess = () => {
      const existing = (existingReq.result as OfflineScanRecord[]) || [];
      const alreadyPending = existing.find((item) => item.status === 'PENDING' || item.status === 'SYNCING');
      if (alreadyPending) {
        // Return existing record so we do not flood the queue with identical offline scans
        return resolve(alreadyPending);
      }

      const addReq = store.add(record);
      addReq.onsuccess = () => resolve(record);
      addReq.onerror = () => reject(addReq.error || new Error('Failed to enqueue offline scan.'));
    };

    existingReq.onerror = () => {
      // Fallback: direct insert if index read fails
      const addReq = store.add(record);
      addReq.onsuccess = () => resolve(record);
      addReq.onerror = () => reject(addReq.error || new Error('Failed to enqueue offline scan.'));
    };

    tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
  });
}

/**
 * Retrieve pending scans for an event (or all events), sorted oldest first.
 */
export async function getPendingScans(eventId?: string, limit = 50): Promise<OfflineScanRecord[]> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const statusIndex = store.index('by_status');
    const request = statusIndex.getAll('PENDING');

    request.onsuccess = () => {
      let records = (request.result as OfflineScanRecord[]) || [];
      if (eventId) {
        records = records.filter((r) => r.eventId === eventId);
      }
      records.sort((a, b) => a.createdAt - b.createdAt);
      if (limit > 0 && records.length > limit) {
        records = records.slice(0, limit);
      }
      resolve(records);
    };

    request.onerror = () => reject(request.error || new Error('Failed to fetch pending scans.'));
  });
}

/**
 * Fast count of pending scans for a given event or overall.
 */
export async function getPendingCount(eventId?: string): Promise<number> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const statusIndex = store.index('by_status');

    if (!eventId) {
      const countReq = statusIndex.count('PENDING');
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    } else {
      const getReq = statusIndex.getAll('PENDING');
      getReq.onsuccess = () => {
        const records = (getReq.result as OfflineScanRecord[]) || [];
        const count = records.filter((r) => r.eventId === eventId).length;
        resolve(count);
      };
      getReq.onerror = () => reject(getReq.error);
    }
  });
}

/**
 * Deletes an offline scan by primary key ID upon confirmed server receipt.
 */
export async function deleteOfflineScan(id: string): Promise<void> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete offline scan.'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
  });
}

/**
 * Mark specified scan records as SYNCING during active batch dispatch.
 */
export async function markSyncing(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    ids.forEach((id) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as OfflineScanRecord;
        if (record) {
          record.status = 'SYNCING';
          store.put(record);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to mark scans as syncing.'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
  });
}

/**
 * Reset scan records back to PENDING if a sync attempt encounters a network failure.
 */
export async function markPending(ids: string[], errorMessage?: string): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    ids.forEach((id) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as OfflineScanRecord;
        if (record) {
          record.status = 'PENDING';
          record.retryCount = (record.retryCount || 0) + 1;
          if (errorMessage) {
            record.lastError = errorMessage;
          }
          store.put(record);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to reset scans to pending.'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
  });
}
