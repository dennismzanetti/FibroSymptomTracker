import { initFirebase } from './firebase-init.js';

const { db } = initFirebase();

export function dayDocRef(uid, dateStr) {
  return db.collection('users').doc(uid).collection('days').doc(dateStr);
}

export async function saveDay(uid, dateStr, data) {
  await dayDocRef(uid, dateStr).set(data, { merge: true });
}

export async function loadDay(uid, dateStr) {
  const snap = await dayDocRef(uid, dateStr).get();
  return snap.exists ? snap.data() : null;
}

export async function loadRange(uid, from, to) {
  const snap = await db
    .collection('users').doc(uid)
    .collection('days')
    .where('__name__', '>=', from)
    .where('__name__', '<=', to)
    .orderBy('__name__')
    .get();
  return snap.docs.map(d => ({ date: d.id, ...d.data() }));
}
