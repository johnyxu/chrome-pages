import { parseLinksFile, serializeLinksFile } from './linksFile.js';

const DB_NAME = 'tab-saver';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'linksFile';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function setStoredHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function verifyPermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

export async function connectFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'saved-tabs.json',
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  await setStoredHandle(handle);
  return handle;
}

export async function getConnectedFile() {
  const handle = await getStoredHandle();
  if (!handle) return null;
  const ok = await verifyPermission(handle, 'readwrite');
  return ok ? handle : null;
}

export async function readLinksFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  return parseLinksFile(text);
}

export async function writeLinksFile(handle, links) {
  const writable = await handle.createWritable();
  await writable.write(serializeLinksFile(links));
  await writable.close();
}
