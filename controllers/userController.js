// controllers/userController.js
import bcrypt from "bcryptjs";
import User from "../models/User.js"; 
import dotenv from "dotenv";

dotenv.config();

// POST /api/users/register
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).render("register", { message: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render("register", { message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    // After registration → redirect to login
    res.redirect("/login");
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).render("register", { message: "Server error during registration." });
  }
};

// POST /api/users/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).render("login", { message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).render("login", { message: "Invalid credentials" });

    // Store user info in session
    req.session.user = { id: user._id, name: user.name, email: user.email };

    // ✅ Redirect to home page after login
    res.redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).render("login", { message: "Server error during login." });
  }
};

// GET /api/users/logout
export const logoutUser = (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Logout error:", err);
    res.redirect("/login");
  });
};
