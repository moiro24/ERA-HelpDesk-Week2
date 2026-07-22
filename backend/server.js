require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const {connectMongo, getMongo} = require("./mongo");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

// Root Route
app.get("/", (req, res) => {
    res.json({message: "ERA Tech Solutions heldesk api is running"});
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
            return res.status(500).json({ error: "Failed to get departments"});
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
            return res.status(500).json({ error: "Failed to get users"});
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
            return res.status(500).json({ error: "Failed to get tickets"});
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
            return res.status(500),json({ error: "Failed to get open tickets"});
        }
        res.json(results);
    });
});

//GET /tickets/:id - returns a single ticket by id
app.get("/tickets/:id", (req, res) => {
    const ticketId = req.params.id
    const sql = "SELECT * FROM tickets WHERE id = ?";
    db.query(sql, [ticketId], (error, results) => {
        if (error) {
            console.error("Error getting ticket:", error);
            return res.status(500).json({ error: "Failed to get ticket"});
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Ticket not found"});
        }
        res.json(results[0]);
    });
});

//GET /ticket-notes - Returns all ticket notes from MongoDB
app.get("/ticket-notes", async (req, res) => {
    try{
        const mongoDb = getMongo();
        const notes = await mongoDb.collection("ticket_notes").find({}).toArray();
        res.json(notes);
    } catch(error){
        console.error("Error getting ticket notes:", error);
        res.status(500).json({ error: "Failed to get ticket notes"});
    }
});

// GET /ticket-notes/:ticketId - returns notes for a specific ticket
app.get("/ticket-notes/:ticketId", async (req, res) => {
    try{
        const ticketId = parseInt(req.params.ticketId);
        const mongoDb = getMongo();
        const notes = await mongoDb.collection("ticket_notes").find({ticket_id: ticketId}).toArray();
        res.json(notes);
    } catch(error){
        console.error("Error getting notes for tickets:", error);
        res.status(500).json({ error: "Failed to get ticket"});
    }
});

// GET /activy-logs
app.get("/activity-logs", async (req, res) => {
    try{
        const mongoDb = getMongo();
        const logs = await mongoDb.collection("activity_logs").find({}).sort({timestamp: -1}).toArray();
        res.json(logs);
    } catch(error){
        console.error("Error getting activity logs:", error);
        res.status(500).json({ error: "Failed to get activity logs"});
    }
});

startServer();