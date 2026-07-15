document.addEventListener('DOMContentLoaded', function () {
  const modalEl = document.getElementById('savedRecipeModal');
  const modalTitle = document.getElementById('savedModalTitle');
  const modalImage = document.getElementById('savedModalImage');
  const modalIngr = document.getElementById('savedModalIngredients');
  const modalInstr = document.getElementById('savedModalInstructions');
  const modalDeleteBtn = document.getElementById('modalDeleteBtn');

  let currentModalId = null;

  // helper delete
  async function deleteSavedById(id, cardEl) {
    if (!confirm('Delete this saved recipe?')) return false;
    try {
      const res = await fetch(`/api/recipes/saved/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || 'Error');
        throw new Error(txt || `Status ${res.status}`);
      }
      if (cardEl) cardEl.remove();
      return true;
    } catch (err) {
      console.error('Delete saved error:', err);
      alert('Failed to delete saved recipe.');
      return false;
    }
  }

  // card delete buttons
  document.querySelectorAll('.deleteSaved').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const cardCol = btn.closest('.col-sm-6, .col-md-4');
      await deleteSavedById(id, cardCol);
    });
  });

  // view buttons -> open modal
  document.querySelectorAll('.viewSaved').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.saved-card');
      if (!card) return;
      const recipeData = card.getAttribute('data-recipe');
      if (!recipeData) return;
      const recipe = JSON.parse(recipeData);
      currentModalId = recipe._id;
      modalTitle.innerText = recipe.title || 'Recipe';
      modalImage.src = recipe.image || '/images/placeholder.jpg';
      modalIngr.innerHTML = '';
      (recipe.ingredients || []).forEach(i => {
        const li = document.createElement('li'); li.innerText = i; modalIngr.appendChild(li);
      });
      modalInstr.innerHTML = recipe.instructions || '';
      // show bootstrap modal
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    });
  });

  modalDeleteBtn?.addEventListener('click', async () => {
    if (!currentModalId) return;
    // find card by data-id
    const cardBtn = document.querySelector(`.deleteSaved[data-id="${currentModalId}"]`);
    const cardCol = cardBtn ? cardBtn.closest('.col-sm-6, .col-md-4') : null;
    const ok = await deleteSavedById(currentModalId, cardCol);
    if (ok) {
      // hide modal
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();
    }
  });

  // Search / filter
  const searchInput = document.getElementById('savedSearch');
  const clearBtn = document.getElementById('clearFilters');
  const cards = Array.from(document.querySelectorAll('#savedGrid .saved-card')).map(c => c.closest('.col'));

  function filterCards(q) {
    const term = (q || '').trim().toLowerCase();
    cards.forEach(col => {
      const card = col.querySelector('.saved-card');
      const data = card?.getAttribute('data-recipe');
      if (!data) { col.style.display = ''; return; }
      const obj = JSON.parse(data);
      const title = (obj.title || '').toLowerCase();
      const ingredients = (obj.ingredients || []).join(' ').toLowerCase();
      const match = !term || title.includes(term) || ingredients.includes(term);
      col.style.display = match ? '' : 'none';
    });
  }

  searchInput?.addEventListener('input', (e) => filterCards(e.target.value));
  clearBtn?.addEventListener('click', () => { if (searchInput) { searchInput.value=''; filterCards(''); } });
});