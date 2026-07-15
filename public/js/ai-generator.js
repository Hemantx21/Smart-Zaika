document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('aiForm');
  const genBtn = document.getElementById('generateBtn');
  const input = document.getElementById('ingredients');
  const resultsArea = document.getElementById('generatedArea');
  const resultsGrid = document.getElementById('generatedResults');
  const selectedArea = document.getElementById('selectedRecipe');
  const selTitle = document.getElementById('selectedTitle');
  const selImage = document.getElementById('selectedImage');
  const selIngredients = document.getElementById('selectedIngredients');
  const selInstructions = document.getElementById('selectedInstructions');
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-sm btn-success mt-3';
  saveBtn.innerText = 'Save Recipe';

  if (!form || !genBtn || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return alert('Please enter some ingredients.');

    genBtn.disabled = true;
    const orig = genBtn.innerText;
    genBtn.innerText = 'Generating...';

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: q }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || 'Error');
        throw new Error(txt || `Status ${res.status}`);
      }

      const data = await res.json();
      const recipes = data?.recipes || [];

      resultsGrid.innerHTML = '';
      selectedArea.classList.add('d-none');

      if (recipes.length === 0) {
        resultsGrid.innerHTML = '<div class="col-12"><div class="alert alert-info">No suggestions found. Try different ingredients.</div></div>';
        resultsArea.classList.remove('d-none');
        return;
      }

      recipes.forEach((r) => {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-md-4';
        const img = r.image || '/images/placeholder.jpg';
        const card = document.createElement('div');
        card.className = 'card h-100';
        card.innerHTML = `
          <img src="${escapeHtml(img)}" class="card-img-top" alt="${escapeHtml(r.title)}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${escapeHtml(r.title)}</h5>
            <p class="card-text text-muted mb-2">Uses: ${escapeHtml((r.usedIngredients || []).join(', '))}</p>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <small class="text-muted">Missing: ${r.missedIngredientCount || 0}</small>
              <button class="btn btn-sm btn-outline-primary selectBtn" data-id="${r.id}">Select</button>
            </div>
          </div>
        `;
        col.appendChild(card);
        resultsGrid.appendChild(col);
      });

      resultsArea.classList.remove('d-none');
      window.scrollTo({ top: resultsArea.offsetTop - 80, behavior: 'smooth' });

      // attach handlers
      resultsGrid.querySelectorAll('.selectBtn').forEach((btn) => {
        btn.addEventListener('click', async (ev) => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          btn.disabled = true;
          btn.innerText = 'Loading...';

          try {
            const rres = await fetch('/api/ai/recipe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id }),
            });
            if (!rres.ok) {
              const t = await rres.text().catch(() => rres.statusText || 'Error');
              throw new Error(t || `Status ${rres.status}`);
            }
            const detail = await rres.json();
            const recipe = detail.recipe;
            if (!recipe) throw new Error('No recipe returned');

            selTitle.innerText = recipe.title || 'Recipe';
            selImage.src = recipe.image || '/images/placeholder.jpg';
            selImage.alt = recipe.title || 'Recipe Image';
            selIngredients.innerHTML = '';
            (recipe.ingredients || []).forEach((ing) => {
              const li = document.createElement('li');
              li.innerText = ing;
              selIngredients.appendChild(li);
            });
            selInstructions.innerHTML = recipe.instructions || '';
            // attach save button
            // remove existing if present
            const existing = document.getElementById('saveGeneratedBtn');
            if (existing) existing.remove();
            saveBtn.id = 'saveGeneratedBtn';
            saveBtn.onclick = async () => {
              saveBtn.disabled = true;
              const original = saveBtn.innerText;
              saveBtn.innerText = 'Saving...';
              try {
                const sres = await fetch('/api/recipes/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: recipe.title,
                    image: recipe.image,
                    ingredients: recipe.ingredients,
                    instructions: recipe.instructions,
                    sourceId: recipe.id || ''
                  })
                });
                if (sres.status === 401) {
                  // not logged in
                  alert('Please log in to save recipes.');
                  window.location.href = '/login';
                  return;
                }
                if (!sres.ok) {
                  const txt = await sres.text().catch(() => sres.statusText || 'Error');
                  throw new Error(txt || `Status ${sres.status}`);
                }
                const saved = await sres.json();
                alert('Recipe saved to your collection.');
              } catch (err) {
                console.error('Save error:', err);
                alert('Failed to save recipe.');
              } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = original;
              }
            };
            selInstructions.appendChild(saveBtn);
            selectedArea.classList.remove('d-none');
            window.scrollTo({ top: selectedArea.offsetTop - 80, behavior: 'smooth' });
          } catch (err) {
            console.error('Select error:', err);
            alert('Failed to load recipe details.');
          } finally {
            btn.disabled = false;
            btn.innerText = 'Select';
          }
        });
      });
    } catch (err) {
      console.error('Generate error:', err);
      alert('Unable to generate suggestions right now.');
    } finally {
      genBtn.disabled = false;
      genBtn.innerText = orig;
    }
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;' }[m]));
  }
});