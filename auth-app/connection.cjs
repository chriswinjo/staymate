const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
require("dotenv").config(); // Load environment variables from .env file

// PostgreSQL Connection
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "auth_app",
  password: process.env.DB_PASSWORD || "staymate",
  port: process.env.DB_PORT || 5432,
});

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "your-cloud-name",
  api_key: process.env.CLOUDINARY_API_KEY || "your-api-key",
  api_secret: process.env.CLOUDINARY_API_SECRET || "your-api-secret",
});
module.exports = { pool, cloudinary };
