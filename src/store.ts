import type { BanditState } from './types'

const DB_NAME = 'precog'
const STORE_NAME = 'state'
const STATE_KEY = 'bandit'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode)
    const store = t.objectStore(STORE_NAME)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveState(state: BanditState): Promise<void> {
  const db = await openDB()
  await tx(db, 'readwrite', (s) => s.put(state, STATE_KEY))
  db.close()
}

export async function loadState(): Promise<BanditState | null> {
  const db = await openDB()
  const result = await tx<BanditState | undefined>(db, 'readonly', (s) => s.get(STATE_KEY))
  db.close()
  return result ?? null
}

export async function clearState(): Promise<void> {
  const db = await openDB()
  await tx(db, 'readwrite', (s) => s.delete(STATE_KEY))
  db.close()
}
