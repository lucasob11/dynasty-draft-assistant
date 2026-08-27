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
    apiKey: "AIzaSyB9DzCtAIMrFYHJiH5gM835CAiUqvOoS70",
    authDomain: "dynastyprep-1d501.firebaseapp.com",
    projectId: "dynastyprep-1d501",
    storageBucket: "dynastyprep-1d501.firebasestorage.app",
    messagingSenderId: "429634777575",
    appId: "1:429634777575:web:8ea1215c034a629c1f0d42",
  };
  const COLLECTION = "dynastyDraftAssistant";
  const SDK_VERSION = "10.14.1";

  const TIMEOUT_MS = 6000; // a slow/unprovisioned Firestore must never hang the app

  function isConfigured(){
    return CONFIG.apiKey !== "REPLACE_ME";
  }

  function withTimeout(promise, label){
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
    ]);
  }

  let readyPromise = null;
  function ready(){
    if(!isConfigured()) return Promise.resolve(null);
    if(readyPromise) return readyPromise;
    readyPromise = (async () => {
      try{
        const [{initializeApp}, firestore] = await withTimeout(Promise.all([
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
        ]), "Firebase SDK load");
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
      const snap = await withTimeout(fs.getDoc(fs.doc(fs.db, COLLECTION, docId)), `Firestore read (${docId})`);
      return snap.exists() ? snap.data().payload : null;
    }catch(e){
      console.warn(`Firestore read failed for "${docId}", continuing local-only:`, e);
      return null;
    }
  }

  // Fire-and-forget by design — callers save to localStorage first (instant,
  // always works) and treat this as a best-effort sync on top, not a thing
  // to block the UI on. The timeout still matters here even though nothing
  // awaits the result directly, so a hung write doesn't pile up forever.
  async function push(docId, payload){
    const fs = await ready();
    if(!fs) return false;
    try{
      await withTimeout(fs.setDoc(fs.doc(fs.db, COLLECTION, docId), {payload, updatedAt: Date.now()}), `Firestore write (${docId})`);
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
      await withTimeout(fs.deleteDoc(fs.doc(fs.db, COLLECTION, docId)), `Firestore delete (${docId})`);
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
