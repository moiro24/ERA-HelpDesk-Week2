require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { connectMongo, getMongo } = require("./mongo");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

// Root Route
app.get("/", (req, res) => {
  res.json({ message: "ERA Tech Solutions heldesk api is running" });
});

// Start Server - Waits for MongoDB before listening
async function startServer() {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// GET /departments - returns all departments
app.get("/departments", (req, res) => {
  const sql = "SELECT * FROM departments";
  db.query(sql, (error, results) => {
    if (error) {
      console.error("Error getting departments:", error);
      return res.status(500).json({ error: "Failed to get departments" });
    }
    res.json(results);
  });
});

// GET /users - returns all users, passwords excluded
app.get("/users", (req, res) => {
  const sql = "SELECT id, first_name, last_name, email, role, department_id FROM users";
  db.query(sql, (error, results) => {
    if (error) {
      console.error("Error getting users:", error);
      return res.status(500).json({ error: "Failed to get users" });
    }
    res.json(results);
  });
});

// GET /tickets - returns all tickets
app.get("/tickets", (req, res) => {
  const sql = "SELECT * FROM tickets";
  db.query(sql, (error, results) => {
    if (error) {
      console.error("Error getting tickets", error);
      return res.status(500).json({ error: "Failed to get tickets" });
    }
    res.json(results);
  });
});

// GET /tickets/open - returns ONLY open tickets
app.get("/tickets/open", (req, res) => {
  const sql = "SELECT * FROM tickets WHERE status = 'open'";
  db.query(sql, (error, results) => {
    if (error) {
      console.error("Error getting open tickets:", error);
      return (res.status(500), json({ error: "Failed to get open tickets" }));
    }
    res.json(results);
  });
});

// GET tickets/details - Returns all trickets with joined users in department name
app.get("/tickets/details", (req, res) => {
    const sql = "SELECT t.id AS ticket_id, t.title, t.description, t.priority, t.status, t.created_at, concat(u1.first_name, ' ', u1.last_name) AS submitted_by, concat(u2.first_name, ' ', u2.last_name) AS assigned_to, d.name AS department FROM tickets t join users u1 on t.submitted_by = u1.id left join users u2 on t.assigned_to = u2.id JOIN departments d ON t.department_id = d.id order by t.created_at DESC";
    db.query(sql, (error, results) => {
        if (error){
            console.error("Error getting ticket details:", error);
            return res.status(500).json({ error: "Failed to get ticket details"});
        }
        res.json(results);
    });
});

// GET /tickets/:id/details - Returns one ticket with joined names
app.get("/tickets/:id/details", (req, res) => {
    const ticketId = req.params.id;
    const sql = "SELECT t.id AS ticket_id, t.title, t.description, t.priority, t.status, t.created_at, concat(u1.first_name, ' ', u1.last_name) AS submitted_by, concat(u2.first_name, ' ', u2.last_name) AS assigned_to, d.name AS department FROM tickets t join users u1 on t.submitted_by = u1.id left join users u2 on t.assigned_to = u2.id JOIN departments d ON t.department_id = d.id WHERE t.id = ?";
    db.query(sql, [ticketId], (error, results) => {
        if (error) {
            console.error("Error getting ticket details:", error);
            return res.status(500).json({error: "Failed to get ticket details"});
        }
        if (results.length === 0) {
            return res.status(404).json({error: "Ticket not found"});
        }
        res.json(results[0]);
    });
});

//GET /tickets/:id - returns a single ticket by id
app.get("/tickets/:id", (req, res) => {
  const ticketId = req.params.id;
  const sql = "SELECT * FROM tickets WHERE id = ?";
  db.query(sql, [ticketId], (error, results) => {
    if (error) {
      console.error("Error getting ticket:", error);
      return res.status(500).json({ error: "Failed to get ticket" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.json(results[0]);
  });
});

// POST /users - creates a new user
app.post("/users", (req, res) => {
  const { first_name, last_name, email, password, role, department_id } = req.body;

  // Check required fields
  if (!first_name || !last_name || !email || !password) {
    return res
      .status(400)
      .json({ error: "First_name, last_name, email, and password are required" });
  }

  // Password rule 1: Minimun 8 characters
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }

  // Password rule 2: At least 1 special character
  const specialChar = /[!@#$%]/;
  if (!specialChar.test(password)) {
    return res
      .status(400)
      .json({ error: "Password must include at least 1 special character: ! @ # $ %" });
  }

  const sql =
    "INSERT INTO users(first_name, last_name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?, ?)";
  const userRole = role || "employee";
  const deptId = department_id || null;
  db.query(sql, [first_name, last_name, email, password, userRole, deptId], (error, results) => {
    if (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ error: "Failed to create user" });
    }
    res.status(201).json({ message: "User created successfully", userId: results.insertId });
  });
});

// POST /tickets - Creates a new ticket in MySQL and automatically logs the action in MongoDb
app.post("/tickets", async (req, res) => {
  const { title, description, priority, status, submitted_by, assigned_to, department_id } =
    req.body;

  // Validate required fields
  if (!title || !submitted_by) {
    return res.status(400).json({ error: "Title and submitted by are required" });
  }
  const ticketPriority = priority || "medium";
  const ticketStatus = status || "open";
  const assignedTo = assigned_to || null;
  const deptId = department_id || null;

  const sql =
    "INSERT INTO tickets(title, description, priority, status, submitted_by, assigned_to, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(
    sql,
    [title, description, ticketPriority, ticketStatus, submitted_by, assignedTo, deptId],
    async (error, results) => {
      if (error) {
        console.error("Error creating ticket:", error);
        return res.status(500).json({ error: "Failed to create ticket" });
      }
      const newTicketId = results.insertId;

      //Automatically log this action to MongoDb
      try {
        const mongoDb = getMongo();
        await mongoDb.collection("activity_logs").insertOne({
          action: "ticket_created",
          user_id: submitted_by,
          ticket_id: newTicketId,
          details: `Ticket created ${title}`,
          timestamp: new Date()
        });
      } catch (mongoError) {
        console.error("Failed to log activity:", mongoError);
        // Do not fail the request if login fails
      }
      res.status(201).json({ message: "Ticket created successfully", ticketId: newTicketId });
    }
  );
});

// POST /login - Validates credentials and returns user info will role
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Vailidate required fields
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  // Lookup user by email
  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (error, results) => {
    if (error) {
      console.error("Login query error:", error);
      return res.status(500).json({ error: "Something went wrong" });
    }
    // Check if user exists
    if (results.length === 0) {
      return res.status(401).json({ error: "Invaild email or password" });
    }
    const user = results[0];

    // Check password
    if (user.password !== password) {
      return res.status(401).json({ error: "Invaild email or password" });
    }

    // Automatically log the login action to MongoDB
    try {
      const mongoDb = getMongo();
      await mongoDb.collection("activity_logs").insertOne({
        action: "user_login",
        user_id: user.id,
        ticket_id: null,
        details: `${user.first_name} ${user.last_name} logged in as ${user.role}`,
        timestamp: new Date()
      });
    } catch (mongoError) {
      console.error("Failed to log login activity:", mongoError);
      // Do not fail the login if logging fails
    }

    // Return user info including role
    res.status(200).json({
      message: "login successful",
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      user_id: user.id
    });
  });
});

// POST /ticket-notes - adds a note to tickets mongodb
app.post("/ticket-notes", async (req, res) => {
  const { ticket_id, note, added_by } = req.body;
  if (!ticket_id || !note || !added_by) {
    return res.status(400).json({ error: "Ticket id, note, and added by are required" });
  }
  try {
    const mongoDb = getMongo();
    const result = await mongoDb.collection("ticket_notes").insertOne({
      ticket_id: parseInt(ticket_id),
      note: note,
      added_by: added_by,
      created_at: new Date()
    });
    res.status(201).json({ message: "Note added successfully", noteId: result.insertedId });
  } catch (error) {
    console.error("error adding note:", error);
    res.status(500).json({ error: "failed to add note" });
  }
});

// POST /activity-logs - Manually creates an activity log in MongoDB
app.post("/activity-logs", async (req, res) => {
  const { action, user_id, ticket_id, details } = req.body;
  if (!action || !details) {
    return res.status(400).json({ error: "Action and details are required" });
  }
  try {
    const mongoDb = getMongo();
    const result = await mongoDb.collection("activity_logs").insertOne({
      action: action,
      user_id: user_id || null,
      ticket_id: ticket_id || null,
      details: details,
      timestamp: new Date()
    });
    res.status(201).json({ message: "Activity log created", logId: result.insertedId });
  } catch (error) {
    console.error("Error creating activity log:", error);
    res.status(500).json({ error: "Failed to create activity log" });
  }
});

// MongoDB Routes

//GET /ticket-notes - Returns all ticket notes from MongoDB
app.get("/ticket-notes", async (req, res) => {
  try {
    const mongoDb = getMongo();
    const notes = await mongoDb.collection("ticket_notes").find({}).toArray();
    res.json(notes);
  } catch (error) {
    console.error("Error getting ticket notes:", error);
    res.status(500).json({ error: "Failed to get ticket notes" });
  }
});

// GET /ticket-notes/:ticketId - returns notes for a specific ticket
app.get("/ticket-notes/:ticketId", async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const mongoDb = getMongo();
    const notes = await mongoDb.collection("ticket_notes").find({ ticket_id: ticketId }).toArray();
    res.json(notes);
  } catch (error) {
    console.error("Error getting notes for tickets:", error);
    res.status(500).json({ error: "Failed to get ticket" });
  }
});

// GET /activy-logs
app.get("/activity-logs", async (req, res) => {
  try {
    const mongoDb = getMongo();
    const logs = await mongoDb
      .collection("activity_logs")
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    res.json(logs);
  } catch (error) {
    console.error("Error getting activity logs:", error);
    res.status(500).json({ error: "Failed to get activity logs" });
  }
});

startServer();
