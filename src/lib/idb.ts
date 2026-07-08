'use client';

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'de-flashcards';

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 2, {
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
    },
  });
}
