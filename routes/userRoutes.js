// routes/userRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import { loginUser, registerUser } from "../controllers/userController.js";
import User from "../models/User.js"; // ✅ make sure you have this model

const router = express.Router();

// Login & Register
router.post("/login", loginUser);
router.post("/register", registerUser);

// ✅ Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Redirect back to login with success message
    return res.redirect("/login?reset=success");
  } catch (err) {
    console.error("❌ Reset password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;