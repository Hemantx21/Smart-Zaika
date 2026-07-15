// ===========================
// Smart Zaika — Server Setup
// ===========================
import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import session from "express-session";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

// Import routes & models
import userRoutes from "./routes/userRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import Recipe from "./models/Recipe.js";
import SavedRecipe from "./models/SavedRecipe.js";

dotenv.config();
const app = express();

// ---------------------------
// Fix __dirname in ES modules
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------
// MongoDB Connection
// ---------------------------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => console.error(" MongoDB connection error:", err));


// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "smartzaika_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true if HTTPS
  })
);

// Expose session info to views
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated || false;
  res.locals.user = req.session.user || null; // Assuming `req.session.user` contains logged-in user data
  next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// View engine setup (EJS)
// ---------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------------------------
// API routes
// ---------------------------
app.use("/api/users", userRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/ai", aiRoutes);

// ---------------------------
// Frontend routes (EJS pages)
// ---------------------------
app.get("/", (req, res) => {
  const user = req.session.user || null;
  res.render("home", { user });
});
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => {
  const user = req.session.user || null;
  res.render("contact", { user });
});
app.get("/login", (req, res) => res.render("login", { message: null }));
app.get("/register", (req, res) => res.render("register", { message: null }));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/forgot-password", (req, res) => res.render("forgot-password"));

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(" Logout error:", err);
    res.redirect("/login");
  });
});

// ---------------------------
// Saved recipes page
// ---------------------------
app.get('/saved-recipes', async (req, res) => {
  try {
    const user = req.session.user || null;
    if (!user || !user.id) return res.redirect('/login');
    const saved = await SavedRecipe.find({ user: user.id }).sort({ createdAt: -1 }).lean();
    res.render('saved-recipes', { saved, user, title: 'Saved Recipes' });
  } catch (err) {
    console.error('Saved recipes error:', err);
    res.status(500).render('saved-recipes', { saved: [], user: null, title: 'Saved Recipes' });
  }
});

// Note: AI generation is handled by `routes/aiRoutes.js` (Spoonacular).
// The OpenAI-based generator was removed to rely on Spoonacular only.

// ---------------------------
// Recipes page
// ---------------------------
app.get("/recipes", async (req, res) => {
  try {
    let recipes = await Recipe.find().sort({ createdAt: -1 }).lean();

    if (recipes.length) {
      return res.render("recipes", { recipes, title: "Recipes" });
    }

    // fallback to TheMealDB
    const filterRes = await fetch("https://www.themealdb.com/api/json/v1/1/filter.php?c=Chicken");
    const filterJson = await filterRes.json();
    const meals = filterJson.meals || [];

    const details = await Promise.all(
      meals.slice(0, 25).map(async (meal) => {
        try {
          const resMeal = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`
          );
          const json = await resMeal.json();
          const m = json.meals?.[0];
          if (!m) return null;

          const ingredients = [];
          for (let i = 1; i <= 20; i++) {
            const ing = m[`strIngredient${i}`];
            const measure = m[`strMeasure${i}`] || "";
            if (ing?.trim()) ingredients.push(`${measure.trim()} ${ing.trim()}`.trim());
          }

          return {
            _id: m.idMeal,
            title: m.strMeal,
            description: (m.strInstructions || "").slice(0, 220),
            image: m.strMealThumb,
            ingredients,
            instructions: m.strInstructions,
            servings: "",
            time: "",
          };
        } catch (err) {
          console.error("❌ MealDB fetch error:", err);
          return null;
        }
      })
    );

    recipes = details.filter(Boolean);
    return res.render("recipes", { recipes, title: "Recipes" });
  } catch (err) {
    console.error("❌ Recipes fetch error:", err);
    return res.render("recipes", { recipes: [], title: "Recipes" });
  }
});

// ---------------------------
// Single recipe page
// ---------------------------
app.get("/recipes/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let recipe = null;

    // 1. Try MongoDB first
    if (mongoose.Types.ObjectId.isValid(id)) {
      recipe = await Recipe.findById(id).lean();
    }

    // 2. If not found in Mongo, try TheMealDB
    if (!recipe) {
      const apiRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
      const json = await apiRes.json();
      const m = json.meals?.[0];
      if (m) {
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
          const ing = m[`strIngredient${i}`];
          const measure = m[`strMeasure${i}`] || "";
          if (ing?.trim()) ingredients.push(`${measure.trim()} ${ing.trim()}`.trim());
        }

        recipe = {
          _id: m.idMeal,
          title: m.strMeal,
          image: m.strMealThumb,
          description: m.strInstructions?.slice(0, 200),
          ingredients,
          instructions: m.strInstructions,
          servings: "",
          time: "",
        };
      }
    }

    if (recipe) {
      return res.render("single-recipe", { recipe, title: recipe.title });
    }

    return res.status(404).render("404", { url: req.originalUrl, title: "Not Found" });
  } catch (err) {
    console.error("❌ Recipe fetch error:", err);
    res.status(500).send("Server Error");
  }
});

// ---------------------------
// 404 fallback
// ---------------------------
app.use((req, res) => res.status(404).render("404", { url: req.originalUrl }));

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Smart Zaika server running on port ${PORT}`));