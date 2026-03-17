import type { BanditState } from './types'

const DB_NAME = 'navbandit'
const STORE_NAME = 'state'
const STATE_KEY = 'bandit'
const STATE_VERSION = 1

interface StoredBanditState {
  version: number
  savedAt: number
  state: BanditState
}

let cachedDB: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (cachedDB) return Promise.resolve(cachedDB)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => {
      cachedDB = req.result
      cachedDB.onclose = () => { cachedDB = null }
      cachedDB.onversionchange = () => {
        cachedDB?.close()
        cachedDB = null
      }
      resolve(cachedDB)
    }
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

function isArmState(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const arm = value as any
  return (
    Array.isArray(arm.aInv) &&
    Array.isArray(arm.b) &&
    typeof arm.pulls === 'number' &&
    typeof arm.lastSeen === 'number'
  )
}

function isBanditState(value: unknown): value is BanditState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as any
  if (typeof state.totalPulls !== 'number' || typeof state.sessionId !== 'string') return false
  if (typeof state.arms !== 'object' || state.arms === null) return false
  return Object.values(state.arms).every(isArmState)
}

function isStoredBanditState(value: unknown): value is StoredBanditState {
  if (typeof value !== 'object' || value === null) return false
  const stored = value as any
  return (
    typeof stored.version === 'number' &&
    typeof stored.savedAt === 'number' &&
    isBanditState(stored.state)
  )
}

async function deleteState(db: IDBDatabase): Promise<void> {
  await tx(db, 'readwrite', (s) => s.delete(STATE_KEY))
}

export async function saveState(
  state: BanditState,
  savedAt: number = Date.now()
): Promise<void> {
  const db = await openDB()
  const stored: StoredBanditState = {
    version: STATE_VERSION,
    savedAt,
    state,
  }
  await tx(db, 'readwrite', (s) => s.put(stored, STATE_KEY))
}

export async function loadState(maxAgeMs: number = Number.POSITIVE_INFINITY): Promise<BanditState | null> {
  const db = await openDB()
  const result = await tx<unknown>(db, 'readonly', (s) => s.get(STATE_KEY))
  if (result == null) return null

  if (isStoredBanditState(result)) {
    if (Number.isFinite(maxAgeMs) && Date.now() - result.savedAt > maxAgeMs) {
      await deleteState(db)
      return null
    }
    return result.state
  }

  if (isBanditState(result)) {
    return result
  }

  await deleteState(db)
  return null
}

export async function clearState(): Promise<void> {
  const db = await openDB()
  await tx(db, 'readwrite', (s) => s.delete(STATE_KEY))
}
