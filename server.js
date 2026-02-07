const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const MATCH_RATIO = 0.5;

// --- Setup SQLite ---
const db = new sqlite3.Database("community.db");

db.serialize(() => {
    // Members table
    db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY,
      name TEXT,
      credits INTEGER
    )
  `);

    // Tasks table
    db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      title TEXT,
      creatorId INTEGER,
      pledgedCredits INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completedBy INTEGER,
      approved INTEGER DEFAULT 0
    )
  `);

    // Preload members
    const members = [
        { id: 1, name: "Alice", credits: 100 },
        { id: 2, name: "Bob", credits: 100 },
        { id: 3, name: "Charlie", credits: 100 }
    ];

    members.forEach(m =>
        db.run(
            `INSERT OR IGNORE INTO members (id, name, credits) VALUES (?, ?, ?)`,
            [m.id, m.name, m.credits]
        )
    );
});

// --- Fetch state ---
app.get("/api/state", (req, res) => {
    db.all(`SELECT * FROM members`, (err, members) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(`SELECT * FROM tasks`, (err2, tasks) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ members, tasks });
        });
    });
});

// --- Create task ---
app.post("/api/tasks", (req, res) => {
    const { title, creatorId } = req.body;
    db.get(`SELECT * FROM members WHERE id=?`, [creatorId], (err, creator) => {
        if (err || !creator) return res.status(400).json({ error: "Creator not found" });
        db.run(
            `INSERT INTO tasks (title, creatorId) VALUES (?, ?)`,
            [title, creatorId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                db.get(`SELECT * FROM tasks WHERE id=?`, [this.lastID], (err2, task) => {
                    res.json(task);
                });
            }
        );
    });
});

// --- Pledge credits ---
app.post("/api/tasks/:id/pledge", (req, res) => {
    const { memberId, amount } = req.body;
    db.get(`SELECT * FROM members WHERE id=?`, [memberId], (err, member) => {
        if (err || !member || member.credits < amount)
            return res.status(400).json({ error: "Insufficient credits" });

        db.get(`SELECT * FROM tasks WHERE id=?`, [req.params.id], (err2, task) => {
            if (err2 || !task || task.completed) return res.status(400).json({ error: "Invalid task" });

            db.run(`UPDATE members SET credits=credits-? WHERE id=?`, [amount, memberId]);
            db.run(`UPDATE tasks SET pledgedCredits=pledgedCredits+? WHERE id=?`, [amount, req.params.id]);
            res.json({ taskId: task.id, memberId, pledged: amount });
        });
    });
});

// --- Approve task ---
app.post("/api/tasks/:id/approve", (req, res) => {
    const { approverId } = req.body;
    db.get(`SELECT * FROM tasks WHERE id=?`, [req.params.id], (err, task) => {
        if (err || !task || task.completed) return res.status(400).json({ error: "Invalid task" });
        if (task.creatorId !== approverId) return res.status(403).json({ error: "Only creator can approve" });

        db.run(`UPDATE tasks SET approved=1 WHERE id=?`, [req.params.id], err2 => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ taskId: task.id, approved: true });
        });
    });
});

// --- Complete task ---
app.post("/api/tasks/:id/complete", (req, res) => {
    const { memberId } = req.body;
    db.get(`SELECT * FROM tasks WHERE id=?`, [req.params.id], (err, task) => {
        if (err || !task || task.completed) return res.status(400).json({ error: "Invalid task" });
        if (!task.approved) return res.status(400).json({ error: "Task must be approved by creator" });

        db.get(`SELECT * FROM members WHERE id=?`, [memberId], (err2, member) => {
            if (err2 || !member) return res.status(400).json({ error: "Member not found" });

            const pledged = task.pledgedCredits;
            if (pledged <= 0) return res.status(400).json({ error: "No pledged credits" });

            const payoutFromPledge = Math.floor(pledged * MATCH_RATIO);
            const mintedMatch = payoutFromPledge;
            const totalPayout = payoutFromPledge + mintedMatch;

            db.serialize(() => {
                db.run(`UPDATE members SET credits=credits+? WHERE id=?`, [totalPayout, memberId]);
                db.run(`UPDATE tasks SET pledgedCredits=pledgedCredits-?, completed=1, completedBy=? WHERE id=?`,
                    [payoutFromPledge, memberId, task.id],
                    err3 => {
                        if (err3) return res.status(500).json({ error: err3.message });
                        res.json({
                            taskId: task.id,
                            payoutFromPledge,
                            mintedMatch,
                            totalPayout,
                            completedBy: member.name
                        });
                    });
            });
        });
    });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MVP running at http://localhost:${PORT}`));
