// Shared rankings source for index.html, edit.html, and compare.html.
//
// Rankings normally come from rankings.json (regenerated from the workbook by
// extract_rankings.py). If the user has edited anything on the Edit Rankings
// page, that edited copy takes over as the source of truth for all three
// pages until it's reset — so an edit made mid-draft shows up in the live
// tool immediately on next render/reload.
//
// That override is saved to both localStorage (instant, always works) and
// Firebase Firestore (best-effort, requires firebase-sync.js to be
// configured — see FIRESTORE_RULES.txt) so it follows you across devices,
// not just across reloads of the same browser. load() prefers the Firestore
// copy when reachable, since it's the one that could have just been edited
// on a different device.
const RankingsStore = (() => {
  const KEY = "dynastyRankings:v1";
  const DOC_ID = "rankings";

  function hasOverride(){
    return localStorage.getItem(KEY) !== null;
  }

  async function loadBase(){
    const res = await fetch(`rankings.json?_=${Date.now()}`, {cache: "no-store"});
    return res.json();
  }

  // New fields added to rankings.json after an override was saved (a new
  // data source merged in by extract_rankings.py) don't exist on that old
  // snapshot — backfill them from the current base file rather than letting
  // them stay silently missing forever. Never touches a field the override
  // already has, since edited values must stay authoritative.
  async function backfillFromBase(override){
    try{
      const base = await loadBase();
      const baseByKey = new Map(base.map(p => [`${p.pos}|${p.name.toLowerCase()}`, p]));
      for(const p of override){
        const b = baseByKey.get(`${p.pos}|${(p.name || "").toLowerCase()}`);
        if(!b) continue;
        for(const k of Object.keys(b)){
          if(!(k in p)) p[k] = b[k];
        }
      }
    }catch(e){ /* base fetch failed — use the override as-is */ }
    return override;
  }

  async function load(){
    let override = null;

    if(typeof FirebaseSync !== "undefined" && FirebaseSync.isConfigured()){
      const remote = await FirebaseSync.pull(DOC_ID);
      if(Array.isArray(remote)) override = remote;
    }

    if(!override){
      const raw = localStorage.getItem(KEY);
      if(raw){
        try{
          const parsed = JSON.parse(raw);
          if(Array.isArray(parsed)) override = parsed;
        }catch(e){ /* fall through to base file */ }
      }
    }

    if(!override) return loadBase();

    override = await backfillFromBase(override);
    localStorage.setItem(KEY, JSON.stringify(override)); // keep the local cache fresh
    return override;
  }

  function save(players){
    localStorage.setItem(KEY, JSON.stringify(players));
    if(typeof FirebaseSync !== "undefined") FirebaseSync.push(DOC_ID, players); // fire-and-forget
  }

  function reset(){
    localStorage.removeItem(KEY);
    if(typeof FirebaseSync !== "undefined") FirebaseSync.remove(DOC_ID);
  }

  function exportJson(players){
    const blob = new Blob([JSON.stringify(players, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rankings.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return {load, loadBase, save, reset, hasOverride, exportJson};
})();
