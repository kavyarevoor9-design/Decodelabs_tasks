// ===================================================================
// Project 4 - Backend (Stage 2: Process / "Cognitive Vault")
// Node.js + Express REST API that stores interns in a JSON file.
// ===================================================================
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data', 'interns.json');

// ---------- Middleware ----------
// CORS: lets the frontend (different origin, e.g. http://127.0.0.1:5500)
// call this backend (http://localhost:3000). Without it the browser blocks
// the request. In production, restrict it: cors({ origin: 'https://your-site.com' })
app.use(cors());
app.use(express.json()); // parses JSON request bodies

// ---------- Tiny "database" helpers ----------
async function readDB() {
  const raw = await fs.readFile(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}
async function writeDB(interns) {
  await fs.writeFile(DB_FILE, JSON.stringify(interns, null, 2));
}

// ---------- Validation ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateIntern(body, { partial = false } = {}) {
  const errors = [];
  const fields = ['name', 'email', 'role', 'contact'];

  for (const f of fields) {
    const present = body[f] !== undefined;
    if (!partial && (!present || String(body[f]).trim() === '')) {
      errors.push(`"${f}" is required`);
    }
    if (present && typeof body[f] !== 'string') {
      errors.push(`"${f}" must be a string`);
    }
  }
  if (typeof body.email === 'string' && !EMAIL_RE.test(body.email)) {
    errors.push('"email" is not a valid email address');
  }
  if (typeof body.contact === 'string' && !/^\d{10}$/.test(body.contact)) {
    errors.push('"contact" must be exactly 10 digits');
  }
  return errors;
}

// ---------- Routes (nouns, not verbs: /interns not /getInterns) ----------

// GET /api/interns  -> list (optional ?search=text)
app.get('/api/interns', async (req, res, next) => {
  try {
    let interns = await readDB();
    const { search } = req.query;
    if (search) {
      const q = String(search).toLowerCase();
      interns = interns.filter(
        (i) => i.name.toLowerCase().includes(q) || i.role.toLowerCase().includes(q)
      );
    }
    res.status(200).json(interns);
  } catch (err) { next(err); }
});

// GET /api/interns/:id -> single
app.get('/api/interns/:id', async (req, res, next) => {
  try {
    const interns = await readDB();
    const intern = interns.find((i) => i.id === Number(req.params.id));
    if (!intern) return res.status(404).json({ message: 'Intern not found' });
    res.status(200).json(intern);
  } catch (err) { next(err); }
});

// POST /api/interns -> create (201 Created)
app.post('/api/interns', async (req, res, next) => {
  try {
    const errors = validateIntern(req.body);
    if (errors.length) return res.status(422).json({ message: errors.join('; ') });

    const interns = await readDB();
    const newIntern = {
      id: interns.length ? Math.max(...interns.map((i) => i.id)) + 1 : 1,
      name: req.body.name.trim(),
      email: req.body.email.trim(),
      role: req.body.role.trim(),
      contact: req.body.contact.trim(),
    };
    interns.push(newIntern);
    await writeDB(interns);
    res.status(201).json(newIntern);
  } catch (err) { next(err); }
});

// PUT /api/interns/:id -> replace the whole profile
app.put('/api/interns/:id', async (req, res, next) => {
  try {
    const errors = validateIntern(req.body);
    if (errors.length) return res.status(422).json({ message: errors.join('; ') });

    const interns = await readDB();
    const idx = interns.findIndex((i) => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'Intern not found' });

    interns[idx] = { id: interns[idx].id, ...req.body };
    await writeDB(interns);
    res.status(200).json(interns[idx]);
  } catch (err) { next(err); }
});

// PATCH /api/interns/:id -> partial update (e.g. only the contact number)
app.patch('/api/interns/:id', async (req, res, next) => {
  try {
    const errors = validateIntern(req.body, { partial: true });
    if (errors.length) return res.status(422).json({ message: errors.join('; ') });

    const interns = await readDB();
    const idx = interns.findIndex((i) => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'Intern not found' });

    interns[idx] = { ...interns[idx], ...req.body, id: interns[idx].id };
    await writeDB(interns);
    res.status(200).json(interns[idx]);
  } catch (err) { next(err); }
});

// DELETE /api/interns/:id -> remove (204 No Content)
app.delete('/api/interns/:id', async (req, res, next) => {
  try {
    const interns = await readDB();
    const idx = interns.findIndex((i) => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'Intern not found' });

    interns.splice(idx, 1);
    await writeDB(interns);
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/stats -> second endpoint, used to demo Promise.all() on the frontend
app.get('/api/stats', async (req, res, next) => {
  try {
    const interns = await readDB();
    const byRole = {};
    interns.forEach((i) => { byRole[i.role] = (byRole[i.role] || 0) + 1; });
    res.status(200).json({ total: interns.length, byRole });
  } catch (err) { next(err); }
});

// GET /api/broken -> always fails with 500, to test the frontend error handling
app.get('/api/broken', (req, res) => {
  res.status(500).json({ message: 'Simulated internal server error' });
});

// ---------- 404 + error handlers (always reply in JSON) ----------
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  // express.json() throws this when the body is not valid JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
  console.log(`   Try: http://localhost:${PORT}/api/interns`);
});