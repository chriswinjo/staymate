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

app.post("/api/update-personal-info", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    gender,
    profession,
    education,
    bio,
  } = req.body;
  console.log(
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    gender,
    profession,
    education,
    bio
  );
  try {
    const query = `
      INSERT INTO personal_info (first_name, last_name, email, phone, dob, gender, profession, education, bio)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email) 
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        dob = EXCLUDED.dob,
        gender = EXCLUDED.gender,
        profession = EXCLUDED.profession,
        education = EXCLUDED.education,
        bio = EXCLUDED.bio;
    `;

    await pool.query(query, [
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      profession,
      education,
      bio,
    ]);

    res.json({ message: "Personal info updated successfully" });
  } catch (error) {
    // handleError(res, error);
    console.log(error);
  }
});

// 🔥 Route: Update Contact Info
app.post("/api/update-contact-info", async (req, res) => {
  const {
    address,
    city,
    state,
    pincode,
    emergencyContactName,
    emergencyContactNumber,
  } = req.body;

  try {
    const query = `
      INSERT INTO contact_info (address, city, state, pincode, emergency_contact_name, emergency_contact_number)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (address)
      DO UPDATE SET
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        pincode = EXCLUDED.pincode,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_number = EXCLUDED.emergency_contact_number;
    `;

    await pool.query(query, [
      address,
      city,
      state,
      pincode,
      emergencyContactName,
      emergencyContactNumber,
    ]);

    res.json({ message: "Contact info updated successfully" });
  } catch (error) {
    handleError(res, error);
  }
});

// // 🔥 Route: Upload Profile Image
// const upload = multer({ storage: multer.memoryStorage() });

// app.post("/api/upload-profile-image", upload.single("profileImage"), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ error: "No file uploaded" });
//   }

//   const imageBuffer = req.file.buffer;
//   const email = req.body.email; // Assuming you pass the email along with the image

//   try {
//     const query = `
//       INSERT INTO profile_images (email, image_data)
//       VALUES ($1, $2)
//       ON CONFLICT (email)
//       DO UPDATE SET image_data = EXCLUDED.image_data;
//     `;

//     await pool.query(query, [email, imageBuffer]);

//     res.json({ message: "Profile image uploaded successfully" });
//   } catch (error) {
//     handleError(res, error);
//   }
// });

// // Serve uploaded images statically
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // Multer setup for image uploads
// const storage = multer.diskStorage({
//   destination: "./uploads",
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });
// const upload = multer({ storage });

// 🛠️ Route to register a room
app.post("/api/rooms", upload.single("image"), async (req, res) => {
  try {
    const { location, smoking, pets, lifestyle, age, budget } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO rooms (location, smoking, pets, lifestyle, age, budget, image) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [location, smoking, pets, lifestyle, age, budget, imagePath]
    );

    res.status(201).json({
      message: "Room registered successfully!",
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Error registering room:", error);
    res.status(500).send("Failed to register room");
  }
});

// 🛠️ Route to get room listings with filtering
app.get("/api/rooms", async (req, res) => {
  try {
    const { location, smoking, pets, lifestyle, age, budget } = req.query;

    const filters = [];
    const values = [];

    if (location) {
      filters.push(`LOWER(location) LIKE LOWER($${filters.length + 1})`);
      values.push(`%${location}%`);
    }
    if (smoking) {
      filters.push(`smoking = $${filters.length + 1}`);
      values.push(smoking);
    }
    if (pets) {
      filters.push(`pets = $${filters.length + 1}`);
      values.push(pets);
    }
    if (lifestyle) {
      filters.push(`lifestyle = $${filters.length + 1}`);
      values.push(lifestyle);
    }
    if (age) {
      filters.push(`age = $${filters.length + 1}`);
      values.push(age);
    }
    if (budget) {
      filters.push(`budget = $${filters.length + 1}`);
      values.push(budget);
    }

    const query = `
      SELECT * FROM rooms
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, values);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).send("Failed to fetch rooms");
  }
});

// 🛠️ Route to contact roommate
app.post("/api/contact/:roommateId", async (req, res) => {
  const { roommateId } = req.params;
  const { name, email, message } = req.body;

  try {
    // Simulate a contact action (store message in DB or send notification)
    console.log(`Contact request sent to ${roommateId}`);
    console.log(`From: ${name} <${email}>`);
    console.log(`Message: ${message}`);

    res.status(200).json({
      message: `Contact request sent to roommate ${roommateId}.`,
    });
  } catch (error) {
    console.error("Error contacting roommate:", error);
    res.status(500).send("Failed to contact roommate");
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
