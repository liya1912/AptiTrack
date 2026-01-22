/*const express = require("express");
const router = express.Router();

router.get("/dashboard", (req, res) => {
  res.render("admin/dashboard");
});

module.exports = router;*/

const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(isAuthenticated);
router.use(isAdmin);

router.get("/dashboard", (req, res) => {
  res.render("admin/dashboard", {
    user: req.session.user
  });
});

module.exports = router;