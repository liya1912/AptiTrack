/*const express = require("express");
const router = express.Router();

router.get("/dashboard", (req, res) => {
  res.render("advisor/dashboard");
});

module.exports = router;*/

const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdvisor } = require('../middleware/auth');

// Protect all advisor routes
router.use(isAuthenticated);
router.use(isAdvisor);

router.get("/dashboard", (req, res) => {
  res.render("advisor/dashboard", {
    user: req.session.user
  });
});

module.exports = router;

