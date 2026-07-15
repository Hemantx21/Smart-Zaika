document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('searchForm');
  const gen = document.getElementById('generateBtn');
  const input = document.getElementById('ingredients');
  const resultsArea = document.getElementById('generatedArea');
  const resultsGrid = document.getElementById('generatedResults');

  if (!form || !gen || !input || !resultsArea || !resultsGrid) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) {
      alert('Please enter some ingredients.');
      return;
    }

    gen.disabled = true;
    gen.setAttribute('aria-busy', 'true');
    const originalText = gen.innerText;
    gen.innerText = 'Generating...';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: q }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText || 'Error');
        throw new Error(text || `Status ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));

      // if API returns a URL or id, redirect
      if (data?.url) {
        location.href = data.url;
        return;
      }
      if (data?.id) {
        location.href = `/recipes/${data.id}`;
        return;
      }

      // if API returns recipes array -> render on page
      const recipes = data?.recipes || [];
      if (Array.isArray(recipes) && recipes.length) {
        resultsGrid.innerHTML = ''; // clear
        recipes.forEach((r) => {
          const img = r.image || '/images/placeholder.jpg';
          const desc = r.description ? (r.description.length > 120 ? r.description.slice(0, 120) + '...' : r.description) : '';
          const id = r._id || r.id || '';
          const card = document.createElement('div');
          card.className = 'col-sm-6 col-md-4';
          card.innerHTML = `
            <div class="card card-recipe h-100">
              <img src="${img}" class="card-img-top" alt="${escapeHtml(r.title || 'Recipe')}">
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">${escapeHtml(r.title || 'Untitled')}</h5>
                <p class="card-text text-muted mb-3">${escapeHtml(desc)}</p>
                <div class="mt-auto d-flex justify-content-between align-items-center">
                  <small class="text-muted">Serves: ${escapeHtml(r.servings || '—')}</small>
                  ${ id ? `<a href="/recipes/${id}" class="btn btn-sm btn-primary">View</a>` : `<a href="/recipes" class="btn btn-sm btn-primary">View</a>` }
                </div>
              </div>
            </div>`;
          resultsGrid.appendChild(card);
        });
        resultsArea.classList.remove('d-none');
        window.scrollTo({ top: resultsArea.offsetTop - 80, behavior: 'smooth' });
      } else {
        // fallback: no recipes returned
        resultsArea.classList.remove('d-none');
        resultsGrid.innerHTML = '<div class="col-12"><div class="alert alert-info">No recipes were generated. Try different ingredients.</div></div>';
      }
    } catch (err) {
      console.error('Generate error:', err);
      if (err.name === 'AbortError') alert('Request timed out. Try again.');
      else alert('Unable to generate recipe right now.');
    } finally {
      gen.disabled = false;
      gen.removeAttribute('aria-busy');
      gen.innerText = originalText || 'Generate';
      clearTimeout(timeout);
    }
  });

  // small helper to avoid XSS when injecting strings
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;' }[m]));
  }
});