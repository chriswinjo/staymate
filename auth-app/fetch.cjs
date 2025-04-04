const { pool, cloudinary } = require("./connection.cjs"); // Database connection and Cloudinary setup
const bcrypt = require("bcrypt"); // Make sure it's properly imported

const streamifier = require("streamifier"); // For converting file buffer to readable stream
const multer = require("multer"); // For handling file uploads, to access req.file

async function roomlisting(req, res) {
  try {
    const { location, smoking, pets, lifestyle, age, budget } = req.query;

    let query = `SELECT * FROM rooms WHERE 1=1`;
    let queryParams = [];
    let paramIndex = 1;

    if (location) {
      query += ` AND LOWER(location) LIKE $${paramIndex}`;
      queryParams.push(`%${location.toLowerCase()}%`);
      paramIndex++;
    }
    if (smoking) {
      query += ` AND smoking = $${paramIndex}`;
      queryParams.push(smoking);
      paramIndex++;
    }
    if (pets) {
      query += ` AND pets = $${paramIndex}`;
      queryParams.push(pets);
      paramIndex++;
    }
    if (lifestyle) {
      query += ` AND lifestyle = $${paramIndex}`;
      queryParams.push(lifestyle);
      paramIndex++;
    }
    if (age) {
      query += ` AND age = $${paramIndex}`;
      queryParams.push(age);
      paramIndex++;
    }
    if (budget) {
      query += ` AND budget = $${paramIndex}`;
      queryParams.push(budget);
      paramIndex++;
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "Failed to fetch roommates" });
  }
}
async function GetUserData(req, res) {
  try {
    console.log("Fetching user data...");
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: No active session" });
    }

    const userId = req.session.user.id;
    console.log("User ID:", userId);

    // Query to fetch user data from both tables using a JOIN
    const result = await pool.query(
      `SELECT 
        p.first_name, p.last_name, p.email, p.phone, p.dob, p.gender, 
        p.profession, p.education, p.bio, p.image_url,
        c.address, c.city, c.state, c.pincode, 
        c.emergency_contact_name, c.emergency_contact_number 
      FROM personal_info p 
      LEFT JOIN contact_info c ON p.uid = c.uid
      WHERE p.uid = $1`,
      [userId]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]); // Send combined user data
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch user data", details: error.message });
  }
}

async function fetchlistings(req, res) {
  try {
    const query = "SELECT * FROM vacatedrooms ORDER BY created_at DESC;";
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching vacated rooms:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
async function managelistings(req, res) {
  //fetch vacated rooms with user ID
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const userId = req.session.user.id; // Get user ID from session
    console.log("User ID:", userId);
    // Fetch listings from database
    const query =
      "SELECT * FROM vacatedrooms WHERE uid = $1 ORDER BY created_at DESC";
    const { rows } = await pool.query(query, [userId]);

    res.json(rows); // Return the listings as JSON
  } catch (error) {
    console.error("Error fetching user listings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function manageroomlistings(req, res) {
  try {
    const uid = req.session.user.id; // Get UID from session

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const query = "SELECT * FROM rooms WHERE uid = $1";
    const result = await pool.query(query, [uid]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
async function getprofile(req, res) {
  try {
    console.log("Fetching user data...");
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: No active session" });
    }
    const { uid } = req.query;
    const userId = uid;

    console.log("User ID:", userId);

    // Query to fetch user data from both tables using a JOIN
    const result = await pool.query(
      `SELECT 
        p.first_name, p.last_name, p.email, p.phone, p.dob, p.gender, 
        p.profession, p.education, p.bio, p.image_url,
        c.address, c.city, c.state, c.pincode, 
        c.emergency_contact_name, c.emergency_contact_number 
      FROM personal_info p 
      LEFT JOIN contact_info c ON p.uid = c.uid
      WHERE p.uid = $1`,
      [userId]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]); // Send combined user data
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch user data", details: error.message });
  }
}

async function allusers(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, username, email FROM users ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Delete a user
async function deleteuser(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN"); // Start transaction

    // Delete from related tables first to maintain referential integrity
    await client.query("DELETE FROM contact_info WHERE uid = $1", [id]);
    await client.query("DELETE FROM personal_info WHERE uid = $1", [id]);
    await client.query("DELETE FROM rooms WHERE uid = $1", [id]);
    await client.query("DELETE FROM vacatedrooms WHERE uid = $1", [id]);
    // Finally, delete from users table
    const result = await client.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK"); // Revert changes if no user was deleted
      return res.status(404).json({ error: "User not found" });
    }

    await client.query("COMMIT"); // Apply changes if all queries were successful
    res.json({ message: "User and related data deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK"); // Revert changes if an error occurs
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release(); // Release the client back to the pool
  }
}

module.exports = {
  GetUserData,
  roomlisting,
  fetchlistings,
  managelistings,
  manageroomlistings,
  getprofile,
  deleteuser,
  allusers,
};
