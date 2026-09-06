const waitlistForm = document.getElementById('waitlistForm');
const emailInput = document.getElementById('email');
const formStatus = document.getElementById('formStatus');
const storageKey = 'vaultlog-waitlist-entries';

function renderStatus(message, state) {
  formStatus.textContent = message;
  formStatus.classList.remove('success', 'error');

  if (state) {
    formStatus.classList.add(state);
  }
}

function loadEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveEntry(email) {
  const existing = loadEntries();
  const normalized = email.trim().toLowerCase();

  if (existing.some((item) => item.email === normalized)) {
    renderStatus('You are already on the vault-log list. We will send launch updates soon.', 'success');
    return;
  }

  existing.push({ email: normalized, joinedAt: new Date().toISOString() });
  localStorage.setItem(storageKey, JSON.stringify(existing));
  renderStatus('You are on the list. Welcome to the inner circle of private journaling.', 'success');
}

waitlistForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  if (!email) {
    renderStatus('Please enter your email address.', 'error');
    emailInput.focus();
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    renderStatus('That does not look like a valid email address.', 'error');
    emailInput.focus();
    return;
  }

  saveEntry(email);
  waitlistForm.reset();
});
