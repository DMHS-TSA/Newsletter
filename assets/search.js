// Simple client-side search over search-index.json
(function(){
  let index = [];
  function normalize(s){ return (s||'').toString().toLowerCase(); }

  async function load() {
    try {
      const res = await fetch('/search-index.json');
      index = await res.json();
    } catch(e){ console.warn('Failed to load search index', e); }
  }

  function parseQuery(q){
    // support key:value tokens and free text
    const tokens = q.match(/\S+/g) || [];
    const clauses = [];
    for (const t of tokens) {
      const m = t.match(/^(\w+):(.+)$/);
      if (m) clauses.push({k:m[1].toLowerCase(), v:m[2].toLowerCase()});
      else clauses.push({k:'any', v:t.toLowerCase()});
    }
    return clauses;
  }

  function matchItem(item, clauses){
    for (const c of clauses) {
      if (c.k === 'any') {
        if (!(normalize(item.title).includes(c.v) || normalize(item.excerpt).includes(c.v) || normalize(item.tags.join(' ')).includes(c.v) || normalize(item.content).includes(c.v))) return false;
      } else if (c.k === 'tag' || c.k === 'tags') {
        if (!item.tags.map(t=>t.toLowerCase()).includes(c.v)) return false;
      } else if (c.k === 'title') {
        if (!normalize(item.title).includes(c.v)) return false;
      } else if (c.k === 'date') {
        if (!normalize(item.date).includes(c.v)) return false;
      } else if (c.k === 'content') {
        if (!normalize(item.content).includes(c.v)) return false;
      } else {
        // fallback to scanning
        if (!(normalize(item.title).includes(c.v) || normalize(item.excerpt).includes(c.v) || normalize(item.content).includes(c.v))) return false;
      }
    }
    return true;
  }

  function renderResults(results, container){
    container.innerHTML = '';
    if (!results.length) { container.innerHTML = '<div class="search-none">No results</div>'; return; }
    const ul = document.createElement('div');
    ul.className = 'search-results';
    for (const r of results.slice(0,20)) {
      const el = document.createElement('a');
      el.className = 'search-item';
      el.href = '/posts/' + r.slug + '.html';
      el.innerHTML = `<div class="sr-title">${r.title}</div><div class="sr-meta">${r.date} • ${r.tags.join(', ')}</div><div class="sr-excerpt">${r.excerpt}</div>`;
      ul.appendChild(el);
    }
    container.appendChild(ul);
  }

  function wire() {
    const input = document.getElementById('search-input');
    const container = document.getElementById('search-results');
    if (!input || !container) return;
    input.addEventListener('input', ()=>{
      const q = input.value.trim();
      if (!q) { container.innerHTML=''; return; }
      const clauses = parseQuery(q);
      const results = index.filter(item => matchItem(item, clauses));
      renderResults(results, container);
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{ await load(); wire(); });
})();
