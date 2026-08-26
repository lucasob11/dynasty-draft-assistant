// Shared rankings source for index.html and edit.html.
//
// Rankings normally come from rankings.json (regenerated from the workbook by
// extract_rankings.py). If the user has edited anything on the Edit Rankings
// page, that edited copy lives in localStorage and takes over as the source
// of truth for both pages until it's reset — so an edit made mid-draft shows
// up in the live tool immediately on next render/reload.
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
    if(raw){
      try{
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed)) return parsed;
      }catch(e){ /* fall through to base file */ }
    }
    return loadBase();
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
