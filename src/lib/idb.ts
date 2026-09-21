'use client';

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'de-flashcards';

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress');
      }
      if (!db.objectStoreNames.contains('dictation')) {
        db.createObjectStore('dictation');
      }
      if (!db.objectStoreNames.contains('grammar-quiz')) {
        db.createObjectStore('grammar-quiz');
      }
      if (!db.objectStoreNames.contains('mistakes')) {
        const store = db.createObjectStore('mistakes', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('source', 'source');
      }
    },
    // Without this, a stale tab on the old version blocks the upgrade
    // forever and getDB() hangs everywhere, including flashcards.
    blocking(_current, _blocked, event) {
      (event.target as unknown as { close(): void }).close();
    },
    blocked() {
      // Stale tab didn't close in time; getDB() just stays pending.
    },
  });
}
