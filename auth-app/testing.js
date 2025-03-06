require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const cors = require("cors");
const streamifier = require("streamifier"); // To handle file buffer
const path = require("path");
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

// Route to upload an image directly to Cloudinary
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Convert file buffer to a readable stream
    const stream = cloudinary.uploader.upload_stream(
      { folder: "staymate_uploads" },
      (error, result) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: "Image upload failed" });
        }
        res.json({
          message: "Image uploaded successfully",
          imageUrl: result.secure_url,
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Image upload failed" });
  }
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home-img.html"));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
