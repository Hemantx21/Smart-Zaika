import express from "express";
import Recipe from "../models/Recipe.js"; // adjust path to your model
import SavedRecipe from "../models/SavedRecipe.js";
const router = express.Router();

// Fetch all recipes
export const getAllRecipes = async () => {
  return await Recipe.find({});
};

// Fetch recipe by ID
export const getRecipeById = async (id) => {
  return await Recipe.findById(id);
};

// API endpoints
router.get("/", async (req, res) => {
  const recipes = await getAllRecipes();
  res.json(recipes);
});

router.get("/:id", async (req, res) => {
  const recipe = await getRecipeById(req.params.id);
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });
  res.json(recipe);
});

// Save a recipe for the logged-in user
// POST /api/recipes/save
// body: { title, image, ingredients, instructions, sourceId }
router.post('/save', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const { title, image, ingredients, instructions, sourceId } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const saved = new SavedRecipe({
      user: user.id,
      title,
      image: image || '',
      ingredients: Array.isArray(ingredients) ? ingredients : (ingredients ? [ingredients] : []),
      instructions: instructions || '',
      sourceId: sourceId || '',
    });
    await saved.save();
    return res.json({ saved });
  } catch (err) {
    console.error('Save recipe error:', err);
    return res.status(500).json({ error: 'Failed to save recipe' });
  }
});

// List saved recipes for logged-in user
router.get('/saved', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });
    const saved = await SavedRecipe.find({ user: user.id }).sort({ createdAt: -1 }).lean();
    res.json({ saved });
  } catch (err) {
    console.error('List saved recipes error:', err);
    res.status(500).json({ error: 'Failed to list saved recipes' });
  }
});

// Delete a saved recipe (owner only)
router.delete('/saved/:id', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });
    const id = req.params.id;
    const doc = await SavedRecipe.findById(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (String(doc.user) !== String(user.id)) return res.status(403).json({ error: 'Forbidden' });
    await doc.remove();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete saved recipe error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
