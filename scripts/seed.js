import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Recipe from '../models/Recipe.js';

dotenv.config();

const seed = async () => {
  try {
    await connectDB();
    // remove existing sample docs (optional)
    // await Recipe.deleteMany({});

    const items = Array.from({ length: 30 }).map((_, i) => {
      const n = i + 1;
      return {
        title: `Sample Recipe ${n}`,
        description: `Tasty sample recipe number ${n}.`,
        image: `https://images.unsplash.com/photo-15${n}000000000?auto=format&fit=crop&w=800&q=60`,
        ingredients: ['ingredient A', 'ingredient B', 'ingredient C'],
        instructions: 'Mix ingredients and cook until ready.',
        servings: `${1 + (i % 4)}`,
        time: `${10 + (i % 50)} min`
      };
    });

    const res = await Recipe.insertMany(items, { ordered: false });
    console.log(`Inserted ${res.length} sample recipes`);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();