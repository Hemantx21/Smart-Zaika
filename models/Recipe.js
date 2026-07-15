import mongoose from 'mongoose';

const RecipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  image: String,
  ingredients: [String],
  instructions: String,
  servings: String,
  time: String,
}, { timestamps: true });

// export existing model if compiled, otherwise create it
const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', RecipeSchema);
export default Recipe;