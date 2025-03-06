const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const streamifier = require("streamifier"); // To handle file buffer

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration to store file in memory (NO local storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Convert file buffer to a readable stream and upload to Cloudinary
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "staymate_uploads" },
          (error, result) => {
            if (error) {
              return reject(error);
            }
            resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    // Wait for Cloudinary upload to complete
    const uploadResult = await uploadToCloudinary();

    // Insert into PostgreSQL database
    const dbResult = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      ["demo", uploadResult.secure_url, "sdssds"]
    );

    res.json({
      message: "Image uploaded successfully",
      imageUrl: uploadResult.secure_url,
      user: dbResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Image upload failed" });
  }
});

// PostgreSQL Connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "auth_app",
  password: "staymate",
  port: 5432,
});

//db create function

// API Routes (Signup & Login as before)
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [username, email, hashedPassword]
    );
    //new function for db creation
    res
      .status(201)
      .json({ message: "User created successfully!", user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error creating user. Please try again." });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (isMatch) {
      res.json({
        message: "Login successful!",
        user: { id: user.id, username: user.username, email: user.email },
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during login." });
  }
});

// Default Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "land.html"));
});

// Start the Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
