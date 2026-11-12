/**
 * Secure Notes - Frontend Application Logic
 * Vanilla JavaScript (No frameworks, no external libraries)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');

  // Theme Toggles
  const authThemeToggle = document.getElementById('auth-theme-toggle');
  const dashThemeToggle = document.getElementById('dash-theme-toggle');

  // Auth Form & Tabs
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const registerPasswordInput = document.getElementById('register-password');
  const passwordStrengthBox = document.getElementById('password-strength');
  const strengthBar = document.getElementById('strength-bar');
  const strengthLabel = document.getElementById('strength-label');
  const authMessage = document.getElementById('auth-message');

  // Dashboard Controls
  const userDisplayName = document.getElementById('user-display-name');
  const logoutBtn = document.getElementById('logout-btn');
  const dashboardMessage = document.getElementById('dashboard-message');
  const addNoteForm = document.getElementById('add-note-form');
  const noteTitleInput = document.getElementById('note-title');
  const noteContentInput = document.getElementById('note-content');
  const charCount = document.getElementById('char-count');
  const notesList = document.getElementById('notes-list');
  const notesSkeleton = document.getElementById('notes-skeleton');
  const notesEmpty = document.getElementById('notes-empty');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  const notesCounter = document.getElementById('notes-counter');
  const searchInput = document.getElementById('search-notes');
  const sortSelect = document.getElementById('sort-notes');

  // Modal Elements
  const noteModal = document.getElementById('note-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalNoteTitle = document.getElementById('modal-note-title');
  const modalNoteContent = document.getElementById('modal-note-content');
  const modalNoteDate = document.getElementById('modal-note-date');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // --- Client State ---
  let allNotes = [];
  let activeModalNoteId = null;
  const pendingDeletes = new Map(); // noteId -> { timeoutId, note }

  // --- Storage Helpers ---
  const getToken = () => localStorage.getItem('token');
  const setToken = (token) => localStorage.setItem('token', token);
  const getUserName = () => localStorage.getItem('userName') || 'User';
  const setUserName = (name) => localStorage.setItem('userName', name);
  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
  };

  // --- Theme Management (Dark / Light Glass) ---
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    document.querySelectorAll('.icon-sun').forEach((el) => el.classList.toggle('hidden', theme !== 'light'));
    document.querySelectorAll('.icon-moon').forEach((el) => el.classList.toggle('hidden', theme === 'light'));
  }

  function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const nextTheme = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  }

  applyTheme(localStorage.getItem('theme') || 'dark');
  authThemeToggle.addEventListener('click', toggleTheme);
  dashThemeToggle.addEventListener('click', toggleTheme);

  // --- Password Visibility Toggle ---
  document.querySelectorAll('.toggle-password-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.querySelector('.eye-open').classList.toggle('hidden', isPassword);
      btn.querySelector('.eye-closed').classList.toggle('hidden', !isPassword);
    });
  });

  // --- Password Strength Meter (Register Form) ---
  registerPasswordInput.addEventListener('input', () => {
    const val = registerPasswordInput.value;
    if (!val) {
      passwordStrengthBox.classList.add('hidden');
      return;
    }

    passwordStrengthBox.classList.remove('hidden');
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val) || /[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { width: '25%', color: '#f43f5e', text: 'Weak' },
      { width: '50%', color: '#f59e0b', text: 'Fair' },
      { width: '75%', color: '#38bdf8', text: 'Good' },
      { width: '100%', color: '#22c55e', text: 'Strong' },
    ];
    const level = levels[Math.max(0, score - 1)];
    strengthBar.style.width = level.width;
    strengthBar.style.backgroundColor = level.color;
    strengthLabel.textContent = level.text;
    strengthLabel.style.color = level.color;
  });

  // --- Message Banner Helpers ---
  function showMessage(element, message, type = 'error') {
    element.textContent = message;
    element.className = `message-banner ${type}`;
    element.classList.remove('hidden');
  }

  function hideMessage(element) {
    element.textContent = '';
    element.classList.add('hidden');
  }

  // --- Toast Notification Helper ---
  function showToast(message, options = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    if (options.onUndo) {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', () => {
        options.onUndo();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    toastContainer.appendChild(toast);
    const duration = options.duration || 4000;
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, duration);

    return toast;
  }

  // --- View Switcher ---
  function showAuthView() {
    dashboardView.classList.add('hidden');
    authView.classList.remove('hidden');
    hideMessage(authMessage);
  }

  function showDashboardView() {
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    userDisplayName.textContent = getUserName();
    hideMessage(dashboardMessage);
    loadNotes();
  }

  // --- Authentication Expiration / Error Handler ---
  function clearPendingDeletes() {
    for (const pending of pendingDeletes.values()) {
      clearTimeout(pending.timeoutId);
    }
    pendingDeletes.clear();
  }

  function handleUnauthorized() {
    clearPendingDeletes();
    clearAuth();
    allNotes = [];
    closeNoteModal();
    showAuthView();
    switchTab('login');
    showMessage(authMessage, 'Session expired or unauthorized. Please log in again.', 'error');
  }

  // --- Tab Switcher (Login / Register) ---
  function switchTab(mode) {
    hideMessage(authMessage);
    if (mode === 'login') {
      tabLoginBtn.classList.add('active');
      tabLoginBtn.setAttribute('aria-selected', 'true');
      tabRegisterBtn.classList.remove('active');
      tabRegisterBtn.setAttribute('aria-selected', 'false');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      tabRegisterBtn.classList.add('active');
      tabRegisterBtn.setAttribute('aria-selected', 'true');
      tabLoginBtn.classList.remove('active');
      tabLoginBtn.setAttribute('aria-selected', 'false');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
  }

  tabLoginBtn.addEventListener('click', () => switchTab('login'));
  tabRegisterBtn.addEventListener('click', () => switchTab('register'));

  // --- Authentication Submissions ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(authMessage);

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showMessage(authMessage, 'Please provide both email and password.', 'error');
      return;
    }

    const submitBtn = document.getElementById('login-submit-btn');
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(authMessage, data.message || 'Login failed.', 'error');
        return;
      }

      setToken(data.token);
      setUserName(data.user && data.user.name ? data.user.name : 'User');
      loginForm.reset();

      showDashboardView();
      showMessage(dashboardMessage, 'Logged in successfully!', 'success');
      setTimeout(() => hideMessage(dashboardMessage), 3500);
    } catch (error) {
      showMessage(authMessage, 'Unable to connect to the server. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(authMessage);

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = registerPasswordInput.value;

    if (!name || !email || !password) {
      showMessage(authMessage, 'Please fill in all required fields.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage(authMessage, 'Password must be at least 6 characters long.', 'error');
      return;
    }

    const submitBtn = document.getElementById('register-submit-btn');
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(authMessage, data.message || 'Registration failed.', 'error');
        return;
      }

      registerForm.reset();
      passwordStrengthBox.classList.add('hidden');
      switchTab('login');
      showMessage(authMessage, 'Registration successful! You may now log in.', 'success');
    } catch (error) {
      showMessage(authMessage, 'Unable to connect to the server. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Logout Action ---
  logoutBtn.addEventListener('click', async () => {
    await flushPendingDeletes();
    clearAuth();
    allNotes = [];
    searchInput.value = '';
    sortSelect.value = 'newest';
    addNoteForm.reset();
    noteContentInput.style.height = 'auto';
    charCount.textContent = '0 characters';
    closeNoteModal();
    showAuthView();
    switchTab('login');
    showMessage(authMessage, 'You have been logged out successfully.', 'success');
  });

  // --- Auto-Growing Textarea & Character Count ---
  noteContentInput.addEventListener('input', () => {
    noteContentInput.style.height = 'auto';
    noteContentInput.style.height = `${noteContentInput.scrollHeight}px`;
    const len = noteContentInput.value.length;
    charCount.textContent = `${len} ${len === 1 ? 'character' : 'characters'}`;
  });

  // Quick Save Shortcut: Ctrl/Cmd + Enter inside note form
  addNoteForm.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      addNoteForm.requestSubmit();
    }
  });

  // Global Keyboard Shortcuts: '/' to focus search, 'Esc' to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !noteModal.classList.contains('hidden')) {
      closeNoteModal();
      return;
    }

    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
    if (e.key === '/' && !isTyping && !dashboardView.classList.contains('hidden')) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // --- Notes Management ---
  function formatNoteDate(dateStr) {
    const createdDate = new Date(dateStr);
    if (isNaN(createdDate)) return 'Just now';
    return createdDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function loadNotes() {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    // Show skeleton shimmer while loading
    notesList.innerHTML = '';
    notesEmpty.classList.add('hidden');
    notesSkeleton.classList.remove('hidden');

    try {
      const response = await fetch('/api/notes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      notesSkeleton.classList.add('hidden');

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        showMessage(dashboardMessage, errorData.message || 'Failed to fetch notes.', 'error');
        return;
      }

      allNotes = await response.json();
      applyFilterAndRender();
    } catch (error) {
      notesSkeleton.classList.add('hidden');
      showMessage(dashboardMessage, 'Network error while loading notes.', 'error');
    }
  }

  function applyFilterAndRender() {
    const query = searchInput.value.trim().toLowerCase();
    const sortBy = sortSelect.value;

    let filtered = allNotes.filter((note) => {
      if (!query) return true;
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    });

    if (sortBy === 'oldest') {
      filtered = [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'az') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      filtered = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    renderNotes(filtered, query);
  }

  searchInput.addEventListener('input', applyFilterAndRender);
  sortSelect.addEventListener('change', applyFilterAndRender);

  // Render Notes with Strict XSS Prevention using textContent
  function renderNotes(notes, activeQuery = '') {
    notesList.innerHTML = '';
    const count = Array.isArray(notes) ? notes.length : 0;
    notesCounter.textContent = `${count} ${count === 1 ? 'note' : 'notes'}`;

    if (count === 0) {
      if (activeQuery) {
        emptyTitle.textContent = 'No matching notes';
        emptyDesc.textContent = `No notes matched "${activeQuery}". Try a different search term.`;
      } else {
        emptyTitle.textContent = 'No notes yet';
        emptyDesc.textContent = 'Create your first private note using the form above.';
      }
      notesEmpty.classList.remove('hidden');
      return;
    }

    notesEmpty.classList.add('hidden');

    notes.forEach((note, index) => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.style.animationDelay = `${Math.min(index * 40, 280)}ms`;
      card.setAttribute('data-id', note._id);

      const clickableArea = document.createElement('div');
      clickableArea.className = 'note-clickable';
      clickableArea.setAttribute('title', 'Click to read full note');
      clickableArea.addEventListener('click', () => openNoteModal(note));

      const header = document.createElement('div');
      header.className = 'note-header';

      const title = document.createElement('h3');
      title.className = 'note-title';
      // XSS Protection: Use textContent exclusively for user-supplied title
      title.textContent = note.title;
      header.appendChild(title);

      const content = document.createElement('p');
      content.className = 'note-content';
      // XSS Protection: Use textContent exclusively for user-supplied content
      content.textContent = note.content;

      clickableArea.appendChild(header);
      clickableArea.appendChild(content);

      const footer = document.createElement('div');
      footer.className = 'note-footer';

      const date = document.createElement('span');
      date.className = 'note-date';
      date.textContent = formatNoteDate(note.createdAt);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger-outline';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete note: ${note.title}`);
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        scheduleDeleteNote(note._id);
      });

      footer.appendChild(date);
      footer.appendChild(deleteBtn);

      card.appendChild(clickableArea);
      card.appendChild(footer);
      notesList.appendChild(card);
    });
  }

  // --- Note Reader Modal ---
  function openNoteModal(note) {
    activeModalNoteId = note._id;
    modalNoteTitle.textContent = note.title;
    modalNoteContent.textContent = note.content;
    modalNoteContent.scrollTop = 0;
    modalNoteDate.textContent = formatNoteDate(note.createdAt);
    noteModal.classList.remove('hidden');
  }

  function closeNoteModal() {
    activeModalNoteId = null;
    noteModal.classList.add('hidden');
  }

  modalCloseBtn.addEventListener('click', closeNoteModal);
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) closeNoteModal();
  });
  modalDeleteBtn.addEventListener('click', () => {
    if (!activeModalNoteId) return;
    const idToDelete = activeModalNoteId;
    closeNoteModal();
    scheduleDeleteNote(idToDelete);
  });

  // --- Add Note Form Submission ---
  addNoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(dashboardMessage);

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();

    if (!title || !content) {
      showMessage(dashboardMessage, 'Note title and content cannot be empty.', 'error');
      return;
    }

    const createBtn = document.getElementById('create-note-btn');
    createBtn.disabled = true;

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        showMessage(dashboardMessage, data.message || 'Failed to create note.', 'error');
        return;
      }

      addNoteForm.reset();
      noteContentInput.style.height = 'auto';
      charCount.textContent = '0 characters';

      allNotes.unshift(data);
      applyFilterAndRender();
      showToast('Note created!');
    } catch (error) {
      showMessage(dashboardMessage, 'Network error while adding note.', 'error');
    } finally {
      createBtn.disabled = false;
    }
  });

  // --- Delete Note with 4.5s Undo Window ---
  function scheduleDeleteNote(noteId) {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    const index = allNotes.findIndex((n) => n._id === noteId);
    if (index === -1) return;

    const [removedNote] = allNotes.splice(index, 1);
    applyFilterAndRender();

    const timeoutId = setTimeout(async () => {
      pendingDeletes.delete(noteId);
      await executeDeleteApi(noteId, removedNote, index);
    }, 4500);

    pendingDeletes.set(noteId, { timeoutId, note: removedNote, index });

    showToast('Note deleted', {
      duration: 4500,
      onUndo: () => {
        const pending = pendingDeletes.get(noteId);
        if (!pending) return;
        clearTimeout(pending.timeoutId);
        pendingDeletes.delete(noteId);
        allNotes.splice(Math.min(pending.index, allNotes.length), 0, pending.note);
        applyFilterAndRender();
      },
    });
  }

  async function executeDeleteApi(noteId, fallbackNote, fallbackIndex) {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        // Restore note on server failure
        allNotes.splice(Math.min(fallbackIndex, allNotes.length), 0, fallbackNote);
        applyFilterAndRender();
        const data = await response.json();
        showMessage(dashboardMessage, data.message || 'Failed to delete note.', 'error');
      }
    } catch (error) {
      allNotes.splice(Math.min(fallbackIndex, allNotes.length), 0, fallbackNote);
      applyFilterAndRender();
      showMessage(dashboardMessage, 'Network error while deleting note.', 'error');
    }
  }

  async function flushPendingDeletes() {
    const tasks = [];
    for (const [noteId, pending] of pendingDeletes.entries()) {
      clearTimeout(pending.timeoutId);
      pendingDeletes.delete(noteId);
      tasks.push(executeDeleteApi(noteId, pending.note, pending.index));
    }
    await Promise.all(tasks);
  }

  // Ensure pending undo-window deletes are committed if user closes or refreshes tab
  window.addEventListener('beforeunload', () => {
    const token = getToken();
    if (!token || pendingDeletes.size === 0) return;
    for (const [noteId, pending] of pendingDeletes.entries()) {
      clearTimeout(pending.timeoutId);
      fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
    pendingDeletes.clear();
  });

  // --- Soothing Background Canvas Animation (Aurora Waves + Drifting Nodes) ---
  function initBackgroundCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const nodes = [];
    const NODE_COUNT = 42;
    const MAX_DIST = 155;
    let phase = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createNodes() {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.42,
          vy: (Math.random() - 0.5) * 0.42,
          r: Math.random() * 1.8 + 1.1,
        });
      }
    }

    function drawWave(yRatio, amp, freq, speed, fillStyle) {
      ctx.beginPath();
      const baseY = height * yRatio;
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 24) {
        const y = baseY + Math.sin(x * freq + phase * speed) * amp + Math.cos(x * freq * 0.5 - phase * speed * 0.7) * (amp * 0.5);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      phase += 0.014;

      // 1. Gentle layered aurora waves at the bottom
      drawWave(0.68, 42, 0.0028, 1.0, isLight ? 'rgba(37, 99, 235, 0.055)' : 'rgba(37, 99, 235, 0.11)');
      drawWave(0.76, 36, 0.0034, -0.85, isLight ? 'rgba(13, 148, 136, 0.05)' : 'rgba(13, 148, 136, 0.10)');
      drawWave(0.84, 28, 0.004, 0.65, isLight ? 'rgba(2, 132, 199, 0.045)' : 'rgba(56, 189, 248, 0.08)');

      // 2. Smooth drifting constellation nodes & subtle connecting lines
      const nodeColor = isLight ? 'rgba(30, 64, 175, 0.35)' : 'rgba(125, 211, 252, 0.55)';
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * (isLight ? 0.16 : 0.24);
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.strokeStyle = isLight ? `rgba(37, 99, 235, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    }

    resize();
    createNodes();
    window.addEventListener('resize', () => {
      resize();
      createNodes();
    });
    requestAnimationFrame(animate);
  }

  initBackgroundCanvas();

  // --- Initial Page Load Navigation ---
  if (getToken()) {
    showDashboardView();
  } else {
    showAuthView();
    switchTab('login');
  }
});
