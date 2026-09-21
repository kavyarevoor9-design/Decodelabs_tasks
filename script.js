// ===================================================================
// Project 4 - Frontend (Stage 1: Input  &  Stage 3: Output)
// Sends requests to the backend, shows dynamic data, handles errors.
// ===================================================================

const API_BASE = 'http://localhost:3000/api';

// ---------- DOM references ----------
const internList   = document.getElementById('internList');
const spinner      = document.getElementById('spinner');
const messageBox   = document.getElementById('message');
const messageText  = document.getElementById('messageText');
const retryBtn     = document.getElementById('retryBtn');
const statsBox     = document.getElementById('stats');
const loadBtn      = document.getElementById('loadBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const brokenBtn    = document.getElementById('brokenBtn');
const searchInput  = document.getElementById('searchInput');
const internForm   = document.getElementById('internForm');

let lastAction = null; // remembered so "Retry" can repeat it

// ===================================================================
// 1. Central request helper  (fetch + response.ok + JSON parsing)
// ===================================================================
async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkError) {
    // fetch() only rejects on network failure / CORS block, NOT on 404/500
    throw new Error('Cannot reach the server. Is the backend running on port 3000?');
  }

  // fetch does NOT throw on 4xx/5xx – we must check response.ok ourselves
  if (!response.ok) {
    let serverMessage = '';
    try {
      const errBody = await response.json();
      serverMessage = errBody.message;
    } catch { /* body was not JSON */ }
    throw new Error(serverMessage || `HTTP Error! Status: ${response.status}`);
  }

  if (response.status === 204) return null; // No Content
  return response.json();                   // Deserialization: text -> JS object
}

// ===================================================================
// 2. UI helpers (loading / messages)
// ===================================================================
function setLoading(isLoading) {
  spinner.classList.toggle('hidden', !isLoading);
  [loadBtn, dashboardBtn, brokenBtn].forEach((b) => (b.disabled = isLoading));
}

function showMessage(text, type = 'error', allowRetry = false) {
  messageText.textContent = text;                       // textContent = XSS safe
  messageBox.className = `message ${type}`;
  retryBtn.classList.toggle('hidden', !allowRetry);
}
function hideMessage() {
  messageBox.className = 'message hidden';
}

// ===================================================================
// 3. Rendering – DOM injection using textContent (never innerHTML)
// ===================================================================
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderInterns(interns) {
  internList.replaceChildren(); // clear old cards

  if (interns.length === 0) {
    internList.appendChild(el('div', 'empty', 'No interns found.'));
    return;
  }

  interns.forEach((intern) => {
    const card = el('div', 'intern');
    card.appendChild(el('h3', '', intern.name));
    card.appendChild(el('div', 'role', intern.role));
    card.appendChild(el('p', '', `📧 ${intern.email}`));
    card.appendChild(el('p', '', `📞 ${intern.contact}`));

    const actions = el('div', 'actions');

    const editBtn = el('button', 'secondary', 'Edit contact');
    editBtn.addEventListener('click', () => updateContact(intern));

    const delBtn = el('button', 'danger', 'Delete');
    delBtn.addEventListener('click', () => deleteIntern(intern));

    actions.append(editBtn, delBtn);
    card.appendChild(actions);
    internList.appendChild(card);
  });
}

function renderStats(stats) {
  statsBox.replaceChildren();

  const total = el('div', 'stat');
  total.append(el('strong', '', String(stats.total)), el('span', '', 'Total interns'));
  statsBox.appendChild(total);

  Object.entries(stats.byRole).forEach(([role, count]) => {
    const box = el('div', 'stat');
    box.append(el('strong', '', String(count)), el('span', '', role));
    statsBox.appendChild(box);
  });
  statsBox.classList.remove('hidden');
}

// ===================================================================
// 4. Actions  (each one follows: try -> await -> render, catch, finally)
// ===================================================================

// GET /api/interns
async function loadInterns() {
  lastAction = loadInterns;
  hideMessage();
  setLoading(true);
  try {
    const search = searchInput.value.trim();
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const interns = await apiRequest(`/interns${query}`);
    renderInterns(interns);
  } catch (error) {
    showMessage(error.message, 'error', true);
    internList.replaceChildren();
  } finally {
    setLoading(false); // runs on success AND failure
  }
}

// GET /api/interns + GET /api/stats fired IN PARALLEL with Promise.all()
async function loadDashboard() {
  lastAction = loadDashboard;
  hideMessage();
  setLoading(true);
  try {
    const [interns, stats] = await Promise.all([
      apiRequest('/interns'),
      apiRequest('/stats'),
    ]);
    renderInterns(interns);
    renderStats(stats);
  } catch (error) {
    showMessage(error.message, 'error', true);
  } finally {
    setLoading(false);
  }
}

// POST /api/interns
async function addIntern(event) {
  event.preventDefault();
  hideMessage();

  const data = Object.fromEntries(new FormData(internForm)); // form -> JS object
  setLoading(true);
  try {
    await apiRequest('/interns', {
      method: 'POST',
      body: JSON.stringify(data),        // Serialization: JS object -> text
    });
    internForm.reset();
    showMessage('Intern added successfully ✅', 'success');
    await refreshList();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

// PATCH /api/interns/:id  (only the contact number)
async function updateContact(intern) {
  const newContact = prompt(`New contact number for ${intern.name}:`, intern.contact);
  if (newContact === null) return; // user cancelled

  hideMessage();
  setLoading(true);
  try {
    await apiRequest(`/interns/${intern.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ contact: newContact.trim() }),
    });
    showMessage('Contact updated ✅', 'success');
    await refreshList();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

// DELETE /api/interns/:id
async function deleteIntern(intern) {
  if (!confirm(`Delete ${intern.name}?`)) return;

  hideMessage();
  setLoading(true);
  try {
    await apiRequest(`/interns/${intern.id}`, { method: 'DELETE' });
    showMessage(`${intern.name} deleted ✅`, 'success');
    await refreshList();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

// Deliberately hits the /broken route to show 500 handling
async function simulateError() {
  lastAction = simulateError;
  hideMessage();
  setLoading(true);
  try {
    await apiRequest('/broken');
  } catch (error) {
    showMessage(`Server said: ${error.message}`, 'error', true);
  } finally {
    setLoading(false);
  }
}

// Re-fetch the list quietly after a change (no spinner flicker)
async function refreshList() {
  const search = searchInput.value.trim();
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const interns = await apiRequest(`/interns${query}`);
  renderInterns(interns);
}

// ===================================================================
// 5. Event listeners  (User click = the "Input" stage)
// ===================================================================
loadBtn.addEventListener('click', loadInterns);
dashboardBtn.addEventListener('click', loadDashboard);
brokenBtn.addEventListener('click', simulateError);
internForm.addEventListener('submit', addIntern);
retryBtn.addEventListener('click', () => lastAction && lastAction());

// Search with a small debounce so we don't spam the server on every keystroke
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadInterns, 350);
});

// Load data when the page opens
loadInterns();