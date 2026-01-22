/*console.log("Server file loaded");

// server.js

// 1. Import required packages
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");

// 2. Load environment variables
dotenv.config();

// 3. Initialize app
const app = express();

// 4. Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session configuration
app.use(
  session({
    secret: "aptitrack_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

// 5. Set view engine (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 6. Static files
app.use(express.static(path.join(__dirname, "public")));

// 7. MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// 8. Test route
app.get("/", (req, res) => {
  res.send("AptiTrack server is running successfully 🚀");
});

// 9. Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
*/

console.log("Server file loaded");

// 1. Import required packages
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");

// 2. Load environment variables
dotenv.config();

// 3. Initialize app
const app = express();

// 4. Middleware (body parsing)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 5. Session configuration
app.use(
  session({
    secret: "aptitrack_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

// Make session available in all EJS files
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});


// 6. View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 7. Static files
app.use(express.static(path.join(__dirname, "public")));

// 8. MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

connectDB();

// 9. Routes
const authRoutes = require("./routes/authRoutes");
app.use("/auth", authRoutes);

const adminRoutes = require("./routes/adminRoutes");
const staffRoutes = require("./routes/advisorRoutes");
const studentRoutes = require("./routes/studentRoutes");
const testRoutes = require("./routes/testRoutes");

app.use("/admin", adminRoutes);
app.use("/advisor", staffRoutes);
app.use("/student", studentRoutes);
app.use("/tests", testRoutes);


// 10. Test route
// 10. Home/Landing page route

app.get("/", (req, res) => {
  res.render("home");
});

/*app.get("/", (req, res) => {
  res.send("AptiTrack server is running successfully 🚀");
});*/

// 11. Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
