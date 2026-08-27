// Cross-device sync via Firebase Firestore's free tier — the piece that
// makes rankings edits and Compare progress follow you from phone to
// computer, since localStorage alone never leaves one browser/device.
//
// This is a single-user tool with no login: every device reads and writes
// the same two fixed documents (see FIRESTORE_RULES.txt for the security
// rules that scope access to exactly those two documents, nothing else).
//
// Until CONFIG below is filled in with a real Firebase project's values,
// isConfigured() stays false and every call below is a harmless no-op —
// the app keeps working exactly as it did with localStorage alone.
const FirebaseSync = (() => {
  const CONFIG = {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME.firebaseapp.com",
    projectId: "REPLACE_ME",
    storageBucket: "REPLACE_ME.appspot.com",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME",
  };
  const COLLECTION = "dynastyDraftAssistant";
  const SDK_VERSION = "10.14.1";

  function isConfigured(){
    return CONFIG.apiKey !== "REPLACE_ME";
  }

  let readyPromise = null;
  function ready(){
    if(!isConfigured()) return Promise.resolve(null);
    if(readyPromise) return readyPromise;
    readyPromise = (async () => {
      try{
        const [{initializeApp}, firestore] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
        ]);
        const app = initializeApp(CONFIG);
        const db = firestore.getFirestore(app);
        return {db, ...firestore};
      }catch(e){
        console.warn("Firebase sync unavailable, staying local-only:", e);
        return null;
      }
    })();
    return readyPromise;
  }

  async function pull(docId){
    const fs = await ready();
    if(!fs) return null;
    try{
      const snap = await fs.getDoc(fs.doc(fs.db, COLLECTION, docId));
      return snap.exists() ? snap.data().payload : null;
    }catch(e){
      console.warn(`Firestore read failed for "${docId}":`, e);
      return null;
    }
  }

  // Fire-and-forget by design — callers save to localStorage first (instant,
  // always works) and treat this as a best-effort sync on top, not a thing
  // to block the UI on.
  async function push(docId, payload){
    const fs = await ready();
    if(!fs) return false;
    try{
      await fs.setDoc(fs.doc(fs.db, COLLECTION, docId), {payload, updatedAt: Date.now()});
      return true;
    }catch(e){
      console.warn(`Firestore write failed for "${docId}":`, e);
      return false;
    }
  }

  async function remove(docId){
    const fs = await ready();
    if(!fs) return false;
    try{
      await fs.deleteDoc(fs.doc(fs.db, COLLECTION, docId));
      return true;
    }catch(e){
      console.warn(`Firestore delete failed for "${docId}":`, e);
      return false;
    }
  }

  // Calls callback(payload) whenever the remote document changes, including
  // from another device — lets a page pick up an edit made on your phone
  // without you having to manually reload on your computer. Returns an
  // unsubscribe function; a no-op one if Firebase isn't configured.
  async function watch(docId, callback){
    const fs = await ready();
    if(!fs) return () => {};
    return fs.onSnapshot(fs.doc(fs.db, COLLECTION, docId), (snap) => {
      if(snap.exists()) callback(snap.data().payload);
    });
  }

  return {isConfigured, pull, push, remove, watch};
})();
