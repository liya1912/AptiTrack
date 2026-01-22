const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

/* ================= REGISTER ================= */

/* Show Register Page */
router.get("/register", (req, res) => {
  res.render("auth/register");
});

/* Handle Register */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await user.save();
    res.send("User registered successfully ✅");
  } catch (err) {
    console.error(err);
    res.status(500).send("Registration failed");
  }
});

/* ================= LOGIN ================= */

/* Show Login Page */
router.get("/login", (req, res) => {
  res.render("auth/login");
});

/* Handle Login */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.send("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send("Invalid password");
    }


    // Save session
req.session.user = {
  _id: user._id,      // Add this
  id: user._id,       // Keep this
  name: user.name,
  email: user.email,  // Add this
  role: user.role,
};

console.log('User logged in:', req.session.user); // Add this debug line
/*
   // Save session
req.session.user = {
  id: user._id,
  name: user.name,
  role: user.role,
};
*/

// Role-based redirect
if (user.role === "admin") {
  res.redirect("/admin/dashboard");
} else if (user.role === "advisor") {
  res.redirect("/advisor/dashboard");
} else {
  res.redirect("/student/dashboard");
}

  } catch (err) {
    console.error(err);
    res.status(500).send("Login failed");
  }
});

/* ================= LOGOUT ================= */
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Logout failed");
    }
    res.redirect("/auth/login");
  });
});
module.exports = router;
