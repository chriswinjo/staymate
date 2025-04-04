const { pool, cloudinary } = require("./connection.cjs"); // Database connection and Cloudinary setup
const bcrypt = require("bcrypt"); // Make sure it's properly imported

const streamifier = require("streamifier"); // For converting file buffer to readable stream
async function uploadImageToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "profile_images" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          return reject(new Error("Failed to upload image to Cloudinary"));
        }
        resolve(result.secure_url); // Ensure we return a valid URL
      }
    );

    stream.end(fileBuffer); // Pass the buffer to the stream
  });
}

async function updatePersonalinfo(req, res) {
  console.log("Received request body:", req.body);
  console.log(
    "Received file:",
    req.file
      ? { originalname: req.file.originalname, mimetype: req.file.mimetype }
      : "No file uploaded"
  );

  const uid = req.session?.user?.id;
  if (!uid) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  let imageUrl = null;

  if (req.file) {
    try {
      console.log("Uploading image to Cloudinary...");
      imageUrl = await uploadImageToCloudinary(req.file.buffer);
      console.log("Uploaded image URL:", imageUrl);
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      return res
        .status(500)
        .json({ error: "Failed to upload image to Cloudinary" });
    }
  }

  try {
    // Log query parameters before execution
    console.log("Executing database query with values:", {
      firstName: req.body.firstName || null,
      lastName: req.body.lastName || null,
      email: req.body.email || null,
      phone: req.body.phone || null,
      dateOfBirth: req.body.dateOfBirth || null,
      gender: req.body.gender || null,
      profession: req.body.profession || null,
      education: req.body.education || null,
      bio: req.body.bio || null,
      imageUrl: imageUrl || null,
      uid: uid,
    });

    const query = `
      INSERT INTO personal_info (first_name, last_name, email, phone, dob, gender, profession, education, bio, image_url, uid)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (uid) 
      DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, personal_info.first_name),
        last_name = COALESCE(EXCLUDED.last_name, personal_info.last_name),
        phone = COALESCE(EXCLUDED.phone, personal_info.phone),
        dob = COALESCE(EXCLUDED.dob, personal_info.dob),
        gender = COALESCE(EXCLUDED.gender, personal_info.gender),
        profession = COALESCE(EXCLUDED.profession, personal_info.profession),
        education = COALESCE(EXCLUDED.education, personal_info.education),
        bio = COALESCE(EXCLUDED.bio, personal_info.bio),
        image_url = COALESCE(EXCLUDED.image_url, personal_info.image_url);
    `;

    const values = [
      req.body.firstName || null,
      req.body.lastName || null,
      req.body.email || null,
      req.body.phone || null,
      req.body.dateOfBirth || null,
      req.body.gender || null,
      req.body.profession || null,
      req.body.education || null,
      req.body.bio || null,
      imageUrl || null,
      uid,
    ];

    await pool.query(query, values);

    res.json({ message: "Personal info updated successfully" });
  } catch (error) {
    console.error("Database error:", error);

    // Convert the error to a string before sending the response
    res.status(500).json({
      error: "Failed to update personal info",
      details: error.toString(),
    });
  }
}

// 🔥 Route: Update Contact Info
async function updateContactinfo(req, res) {
  const { address, city, state, pincode, emergencyContact, emergencyPhone } =
    req.body;
  console.log(address, city, state, pincode, emergencyContact, emergencyPhone);
  const uid = req.session.user.id;
  try {
    const query = `
     INSERT INTO contact_info ( address, city, state, pincode, emergency_contact_name, emergency_contact_number,uid)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (uid)  -- Ensure user_id is unique
DO UPDATE SET
  address = EXCLUDED.address,
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
      emergencyContact,
      emergencyPhone,
      uid,
    ]);

    res.json({ message: "Contact info updated successfully" });
  } catch (error) {
    console.error("Error updating contact info:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// 🛠️ Route to register a room
async function registerRoom(req, res) {
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
}
async function roomfilter(req, res) {
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
}

// 🛠️ Route to contact roommate
function ContactRoomate(req, res) {
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
}

// Function to upload image to Cloudinary
async function uploadToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "staymate_uploads" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

// Route Handlers
async function uploadImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const uploadResult = await uploadToCloudinary(req.file.buffer);
    res.json({
      message: "Image uploaded successfully",
      imageUrl: uploadResult.secure_url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Image upload failed" });
  }
}

async function signup(req, res) {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [username, email, hashedPassword]
    );

    // Extract user ID from the result
    const userId = result.rows[0].id;

    await pool.query(
      "INSERT INTO personal_info (first_name, last_name, email, uid) VALUES ($1, $2, $3, $4) RETURNING *",
      [username, "", email, userId]
    );

    res
      .status(201)
      .json({ message: "User created successfully!", user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error creating user. Please try again." });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    if (email === "admin@gmail.com" && password === "admin") {
      return res.status(200).json({
        message: "Admin login successful",

        role: "admin",
      });
    }
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (isMatch) {
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };
      res.json({
        message: "Login successful!",
        user: req.session.user,
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during login." });
  }
}

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized access" });
  }
}

// Multer setup to handle file upload

async function RegisterRoom(req, res) {
  console.log("Received request body:", req.body);

  try {
    const { location, smoking, pets, lifestyle, age, budget } = req.body;
    const uid = req.session.user.id;

    // Ensure that an image is uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Upload image to Cloudinary
    cloudinary.uploader
      .upload_stream({ folder: "room_images" }, async (error, result) => {
        if (error) {
          console.error("Cloudinary upload failed:", error);
          return res.status(500).json({ error: "Image upload failed" });
        }

        // Get the uploaded image URL
        const imageUrl = result.secure_url;

        // Insert room details into the database
        const query = `
        INSERT INTO rooms (location, smoking, pets, lifestyle, age, budget, image_url, uid)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
      `;
        const values = [
          location,
          smoking,
          pets,
          lifestyle,
          age,
          budget,
          imageUrl,
          uid,
        ];

        try {
          const dbResponse = await pool.query(query, values);
          return res.status(201).json({
            success: true,
            message: "Room registered successfully",
            room: dbResponse.rows[0],
          });
        } catch (dbError) {
          console.error("Database error:", dbError);
          return res.status(500).json({ error: "Database error" });
        }
      })
      .end(req.file.buffer); // Upload the image buffer
  } catch (error) {
    console.error("Error registering room:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Make sure to use the multer middleware in the route
async function RegisterVacatedrooms(req, res) {
  console.log("Received request body:", req.body);

  try {
    const {
      location,
      address,
      rent,
      size,
      furnishing,
      availability,
      description,
    } = req.body;
    const uid = req.session.user.id;
    const imageUrls = [];

    // Check if images were uploaded
    if (req.files && req.files.length > 0) {
      // Loop through each uploaded image and upload to Cloudinary
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        // Upload the image to Cloudinary
        const result = await cloudinary.uploader.upload_stream(
          { folder: "vacated_room_images" }, // Folder in Cloudinary
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload failed:", error);
              return res.status(500).json({ error: "Image upload failed" });
            }

            // Collect the secure URL for the uploaded image
            imageUrls.push(result.secure_url);

            // After all images are uploaded, save the room data into the database
            if (imageUrls.length === req.files.length) {
              const query = `
                INSERT INTO vacatedrooms (location, address, rent, size, furnishing, availability, description, images, uid)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
              `;
              const values = [
                location,
                address,
                rent,
                size,
                furnishing,
                availability,
                description,
                imageUrls, // Save the array of image URLs
                uid,
              ];

              pool.query(query, values, (dbError, dbResponse) => {
                if (dbError) {
                  console.error("Database error:", dbError);
                  return res.status(500).json({ error: "Database error" });
                }

                return res.status(201).json({
                  success: true,
                  message: "Vacated room registered successfully",
                  room: dbResponse.rows[0],
                });
              });
            }
          }
        );

        result.end(file.buffer); // Upload the current image file
      }
    } else {
      return res.status(400).json({ error: "No images uploaded" });
    }
  } catch (error) {
    console.error("Error registering vacated room:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function deletelisting(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const listingId = req.params.id;
    const table = req.params.table;
    const userId = req.session.user.id; // Get user ID from session

    // Delete the listing only if it belongs to the logged-in user
    const query = `
    DELETE FROM ${table} 
    WHERE id = $1 AND uid = $2 
    RETURNING *;
  `;
    const { rowCount } = await pool.query(query, [listingId, userId]);

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Listing not found or unauthorized to delete." });
    }

    res.json({ success: true, message: "Listing deleted successfully." });
  } catch (error) {
    console.error("Error deleting listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  deletelisting,
  uploadImage,
  updatePersonalinfo,
  updateContactinfo,
  registerRoom,
  roomfilter,
  ContactRoomate,
  uploadToCloudinary,
  signup,
  login,
  RegisterRoom,
  RegisterVacatedrooms,
};
