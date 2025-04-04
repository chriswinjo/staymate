const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt"); // For hashing passwords during signup and login
const streamifier = require("streamifier"); // For converting file buffer to readable stream
const multer = require("multer"); // For handling file uploads, to access req.file
const morgan = require("morgan");
const session = require("express-session");

const storage = multer.memoryStorage(); // Store file in memory as a Buffer
const upload = multer({ storage });

// Use morgan to log requests in the 'dev' format (includes method, route, status code)

const app = express();
const PORT = 3000;
const {
  uploadImage,
  updatePersonalinfo,
  updateContactinfo,
  registerRoom,
  roomfilter,
  ContactRoomate,
  signup,
  login,
  deletelisting,
  RegisterRoom,
  RegisterVacatedrooms,
} = require("./insert.cjs"); // CommonJS import
const {
  GetUserData,
  roomlisting,
  fetchlistings,
  managelistings,
  manageroomlistings,
  getprofile,
  deleteuser,
  allusers,
} = require("./fetch.cjs");
// Middleware
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));
app.use(morgan("dev"));

// Middleware to initialize session
app.use(
  session({
    secret: "your-secret-key", // Change this to a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set secure: true if using HTTPS
  })
);
// Routes for HTML files
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "land.html"))
);
app.get("/home", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "home.html"))
);
app.get("/home4", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "home4.html"))
);
app.get("/listings", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "listings.html"))
);
app.get("/listings4", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "listings4.html"))
);
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/profilepage", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "profilepage.html"))
);
app.get("/roommatefinder", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "roommatefinder.html"))
);
app.get("/roommatefinder-copy", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "roommatefinder copy.html"))
);
app.get("/signup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "signup.html"))
);
app.get("/tests", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "tests.html"))
);
app.get("/rote", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "rote.html"))
);
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);
app.get("/profileview", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "profileview.html"))
);
// Define routes using the imported functions
app.post("/upload", uploadImage);
app.post("/signup", signup);
app.post("/login", login);
app.post(
  "/api/update-personal-info",
  upload.single("profilePicture"),
  updatePersonalinfo
);
app.post("/api/update-contact-info", updateContactinfo);
app.post("/api/rooms", registerRoom);
app.get("/api/rooms", roomfilter);
app.post("/api/contact/:roommateId", ContactRoomate);
app.get("/api/getUserData", GetUserData);
app.get("/api/get-user-profile", getprofile);
app.post("/api/register-room", upload.single("image"), RegisterRoom);
app.get("/api/get-roommates", roomlisting);
app.delete("/api/delete-listing/:table/:id", deletelisting);
app.get("/api/your-listings", managelistings);
app.post(
  "/api/register-vacated-room",
  upload.array("images", 5),
  RegisterVacatedrooms
);
app.get("/api/get-vacated-rooms", fetchlistings);
app.get("/api/roomlistings", manageroomlistings);
app.get("/session-info", (req, res) => {
  if (req.session.user) {
    res.json({
      sessionID: req.sessionID,
      user: req.session.user,
    });
  } else {
    res.status(401).json({ message: "No active session" });
  }
});
app.get("/api/get-users", allusers);
app.delete("/api/delete-user/:id", deleteuser);
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });

    res.clearCookie("connect.sid"); // Clear session cookie
    res.json({ message: "Logout successful", redirect: "/land.html" });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
