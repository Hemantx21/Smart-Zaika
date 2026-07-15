import express from 'express';
import tempStore from '../models/tempStore.js';
const router = express.Router();

// NOTE: Using the Spoonacular API. The API key is read from environment variable
// SPOONACULAR_API_KEY. For local testing you can set it in your .env file.
const SPOON_API_KEY = process.env.SPOONACULAR_API_KEY || process.env.SPOON_API_KEY || '';
if (!SPOON_API_KEY) {
  console.warn('Warning: SPOONACULAR_API_KEY is not set. /api/ai endpoints will fail without it.');
}

// Helper: call spoonacular endpoint with query params
async function spoonGet(path, params = {}) {
  const url = new URL(`https://api.spoonacular.com${path}`);
  url.searchParams.set('apiKey', SPOON_API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const err = new Error(`Spoonacular error: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// POST /api/ai/generate
// body: { ingredients: "egg, tomato" }
// Returns: { recipes: [ { id, title, image, usedIngredients, missedIngredients } ] }
router.post('/generate', async (req, res) => {
  try {
    // Ensure API key available
    if (!SPOON_API_KEY) {
      return res.status(500).json({ error: 'Spoonacular API key not configured. Set SPOONACULAR_API_KEY in environment.' });
    }
    const { ingredients, dishId } = req.body || {};

    // If a dishId is provided, return a textual recipe (backwards-compatible for home.ejs)
    if (dishId) {
      const info = await spoonGet(`/recipes/${encodeURIComponent(dishId)}/information`, { includeNutrition: false });
      const ingredientsText = (info.extendedIngredients || []).map(i => `- ${i.original}`).join('\n');
      const instructionsText = info.instructions || info.summary || '';
      const text = `${info.title}\n\nIngredients:\n${ingredientsText}\n\nInstructions:\n${instructionsText}`;
      // store for later viewing
      tempStore.set(String(info.id), {
        _id: info.id,
        title: info.title,
        image: info.image,
        ingredients: (info.extendedIngredients || []).map(i => i.original),
        instructions: instructionsText,
      });
      return res.json({ recipe: text });
    }

    if (!ingredients || !ingredients.trim()) return res.status(400).json({ error: 'Missing ingredients' });

    // Use the 'findByIngredients' endpoint to get recipe suggestions
    const json = await spoonGet('/recipes/findByIngredients', {
      ingredients: ingredients,
      number: 10,
      ranking: 1, // maximize used ingredients
      ignorePantry: true,
    });

    // Debug: log summary of Spoonacular response to help diagnose empty results
    try {
      const count = Array.isArray(json) ? json.length : (json?.results ? json.results.length : 0);
      console.debug(`Spoonacular /findByIngredients returned count=${count}`);
      if (count > 0) console.debug('First item sample:', (Array.isArray(json) ? json[0] : json.results?.[0]));
    } catch (dbgErr) {
      console.debug('Debug log error for spoonacular response:', dbgErr);
    }

    const recipes = (json || []).map((r) => ({
      id: r.id,
      title: r.title,
      image: r.image ? `https://spoonacular.com/recipeImages/${r.image}` : null,
      usedIngredientCount: r.usedIngredientCount,
      missedIngredientCount: r.missedIngredientCount,
      usedIngredients: (r.usedIngredients || []).map(u => u.originalString || u.original || u.name),
      missedIngredients: (r.missedIngredients || []).map(m => m.originalString || m.original || m.name),
    }));

    // store lightweight entries in tempStore so UI can open /recipes/:id later if desired
    recipes.forEach((r) => tempStore.set(String(r.id), r));

    return res.json({ recipes });
  } catch (err) {
    console.error('AI generate (spoonacular) error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/ai/suggest
// body: { ingredients: "egg,tomato" }
// Returns: { suggestions: [ { id, title } ] }
router.post('/suggest', async (req, res) => {
  try {
    if (!SPOON_API_KEY) return res.status(500).json({ error: 'Spoonacular API key not configured.' });
    const { ingredients } = req.body || {};
    if (!ingredients || !ingredients.trim()) return res.status(400).json({ error: 'Missing ingredients' });
    const json = await spoonGet('/recipes/findByIngredients', { ingredients, number: 8, ranking: 1, ignorePantry: true });
    const suggestions = (json || []).map(r => ({ id: r.id, title: r.title }));
    return res.json({ suggestions });
  } catch (err) {
    console.error('AI suggest error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
});


// POST /api/ai/recipe
// body: { id: <recipeId> }
// Returns: full recipe details (title, ingredients, instructions, image)
router.post('/recipe', async (req, res) => {
  try {
    if (!SPOON_API_KEY) {
      return res.status(500).json({ error: 'Spoonacular API key not configured. Set SPOONACULAR_API_KEY in environment.' });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing recipe id' });

    // Try to fetch bulk info for the recipe from spoonacular
    const info = await spoonGet(`/recipes/${encodeURIComponent(id)}/information`, {
      includeNutrition: false,
    });

    const ingredients = (info.extendedIngredients || []).map((ing) => `${ing.original}`);
    const recipe = {
      id: info.id,
      title: info.title,
      image: info.image || null,
      ingredients,
      instructions: info.instructions || info.summary || '',
      servings: info.servings || '',
      time: info.readyInMinutes || '',
    };

    tempStore.set(String(recipe.id), recipe);
    return res.json({ recipe });
  } catch (err) {
    console.error('AI recipe (spoonacular) error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/ai/testKey
// Quick endpoint to verify Spoonacular API key and connectivity.
router.get('/testKey', async (req, res) => {
  try {
    if (!SPOON_API_KEY) return res.status(500).json({ ok: false, error: 'Spoonacular API key not configured.' });

    // perform a small harmless request (complexSearch) to validate the key
    const sample = await spoonGet('/recipes/complexSearch', { query: 'chicken', number: 1 });
    return res.json({ ok: true, message: 'Spoonacular key seems valid', sampleCount: sample?.results?.length ?? (Array.isArray(sample) ? sample.length : 0) });
  } catch (err) {
    console.error('Spoonacular key test error:', err);
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'Spoonacular request failed' });
  }
});

export default router;
