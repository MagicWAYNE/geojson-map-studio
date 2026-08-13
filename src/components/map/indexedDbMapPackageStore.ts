import type { MapPackageStore } from './activeMapSource'
import type { PersistedMapPackage } from './mapDocument'

export const MAP_SOURCE_DATABASE_NAME = 'cqbigscreen-map-source'
const DATABASE_VERSION = 1
const STORE_NAME = 'packages'
const ACTIVE_KEY = 'active'

export interface IndexedDbMapPackageStoreOptions {
  databaseName?: string
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

async function runWriteTransaction(
  database: IDBDatabase,
  signal: AbortSignal | undefined,
  mutate: (store: IDBObjectStore) => void
): Promise<void> {
  signal?.throwIfAborted()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const completion = transactionCompletion(transaction)
  const abortTransaction = () => {
    try {
      transaction.abort()
    } catch {
      // The transaction already completed, so the caller continuation owns the final check.
    }
  }
  signal?.addEventListener('abort', abortTransaction, { once: true })
  try {
    signal?.throwIfAborted()
    mutate(transaction.objectStore(STORE_NAME))
    await completion
    signal?.throwIfAborted()
  } catch (cause) {
    try {
      transaction.abort()
    } catch {
      // The mutation already failed or the transaction has already settled.
    }
    void completion.catch(() => undefined)
    throw cause
  } finally {
    signal?.removeEventListener('abort', abortTransaction)
  }
}

class IndexedDbMapPackageStore implements MapPackageStore {
  private databasePromise: Promise<IDBDatabase> | null = null

  constructor(private readonly databaseName: string) {}

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => {
          database.close()
          this.databasePromise = null
        }
        resolve(database)
      }
      request.onerror = () => {
        this.databasePromise = null
        reject(request.error ?? new Error('IndexedDB open failed'))
      }
      request.onblocked = () => {
        this.databasePromise = null
        reject(new Error('IndexedDB open blocked'))
      }
    })
    return this.databasePromise
  }

  async readActive(): Promise<unknown> {
    const database = await this.database()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY)
    const [result] = await Promise.all([
      requestResult(request),
      transactionCompletion(transaction)
    ])
    return result ?? null
  }

  async writeActive(value: PersistedMapPackage, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const database = await this.database()
    await runWriteTransaction(database, signal, (store) => store.put(value, ACTIVE_KEY))
  }

  async deleteActive(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const database = await this.database()
    await runWriteTransaction(database, signal, (store) => store.delete(ACTIVE_KEY))
  }
}

export function createIndexedDbMapPackageStore(
  options: IndexedDbMapPackageStoreOptions = {}
): MapPackageStore {
  return new IndexedDbMapPackageStore(options.databaseName ?? MAP_SOURCE_DATABASE_NAME)
}
