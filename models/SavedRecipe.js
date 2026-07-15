import mongoose from 'mongoose';

const SavedRecipeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  image: String,
  ingredients: [String],
  instructions: String,
  sourceId: String, // optional external id (spoonacular)
}, { timestamps: true });

const SavedRecipe = mongoose.models.SavedRecipe || mongoose.model('SavedRecipe', SavedRecipeSchema);
export default SavedRecipe;
