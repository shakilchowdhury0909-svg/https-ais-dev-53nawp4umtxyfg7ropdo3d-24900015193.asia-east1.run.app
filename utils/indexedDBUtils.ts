const DB_NAME = 'AIVirtualTryOnDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface SavedSession {
  id: string;
  name?: string;
  timestamp: number;
  mode: string;
  modelImageUrl?: string | null;
  garmentImageUrl?: string | null;
  generatedImageUrl?: string | null;
  prompt?: string;
  options?: any;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSessionToIndexedDB(id: string, sessionData: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const dataWithId = {
        ...sessionData,
        id,
        timestamp: sessionData.timestamp || Date.now()
      };
      const req = store.put(dataWithId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save session to IndexedDB:', err);
  }
}

export async function loadSessionFromIndexedDB(id: string): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load session from IndexedDB:', err);
    return null;
  }
}

export async function clearSessionFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to clear session from IndexedDB:', err);
  }
}

export async function getAllSessionsFromIndexedDB(): Promise<SavedSession[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || []).sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get all sessions:', err);
    return [];
  }
}
