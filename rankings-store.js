// Shared rankings source for index.html, edit.html, and compare.html.
//
// Rankings normally come from rankings.json (regenerated from the workbook by
// extract_rankings.py). If the user has edited anything on the Edit Rankings
// page, that edited copy lives in localStorage and takes over as the source
// of truth for all three pages until it's reset — so an edit made mid-draft
// shows up in the live tool immediately on next render/reload. New fields
// added to rankings.json after that snapshot was saved (e.g. a new data
// source merged in by extract_rankings.py) still reach the override via a
// backfill in load() — see there for why that matters.
const RankingsStore = (() => {
  const KEY = "dynastyRankings:v1";

  function hasOverride(){
    return localStorage.getItem(KEY) !== null;
  }

  async function loadBase(){
    const res = await fetch(`rankings.json?_=${Date.now()}`, {cache: "no-store"});
    return res.json();
  }

  async function load(){
    const raw = localStorage.getItem(KEY);
    if(!raw) return loadBase();
    let override;
    try{
      override = JSON.parse(raw);
      if(!Array.isArray(override)) return loadBase();
    }catch(e){
      return loadBase();
    }

    // An override is a full snapshot taken whenever edit.html last saved —
    // if rankings.json has since gained new fields (a new data source
    // merged in by extract_rankings.py, run after that snapshot), the
    // override doesn't know about them and would silently keep shadowing
    // them forever otherwise. Backfill anything the override is missing
    // from the current base file; never touch a field the override already
    // has, since edited values must stay authoritative.
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
    }catch(e){ /* base fetch failed — fall back to the override as-is */ }
    return override;
  }

  function save(players){
    localStorage.setItem(KEY, JSON.stringify(players));
  }

  function reset(){
    localStorage.removeItem(KEY);
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
