// ============================================================
// SIGMA ALUTECH — Admin Dashboard Logic
// ============================================================
import { db, auth, requireRole, signOutAndRedirect } from './auth.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ---- State ----
let currentProject     = null;   // { id, ...data }
let currentFloors      = [];     // ["1st Floor", ...]
let allProjects        = [];     // [{ id, name }]
let allUsers           = [];     // [{ id (uid), email, role, projectIds }]
let allItems           = [];     // cached items for filtering
let itemsUnsub         = null;   // Firestore listener unsubscribe fn
let editingItemId      = null;   // item being edited in modal
let currentFloorFilter  = 'all';
let currentStatusFilter = 'all';

// ---- Boot ----
requireRole('admin').then(({ user }) => {
  document.getElementById('adminEmail').textContent = user.email;
  document.getElementById('signOutBtn').addEventListener('click', signOutAndRedirect);
  initTabs();
  initFilters();
  loadProjects();
  loadUsers();
});

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll('.sidebar__tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar__tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tabProjects').style.display = tab === 'projects' ? '' : 'none';
      document.getElementById('tabUsers').style.display    = tab === 'users'    ? '' : 'none';
    });
  });
}

// ---- Filters ----
function initFilters() {
  document.getElementById('floorFilter').addEventListener('change', e => {
    currentFloorFilter = e.target.value;
    renderAll();
  });
  document.getElementById('statusFilter').addEventListener('change', e => {
    currentStatusFilter = e.target.value;
    renderAll();
  });
}

function populateFloorFilter() {
  const sel = document.getElementById('floorFilter');
  sel.innerHTML = '<option value="all">All Floors</option>';
  currentFloors.forEach(f => {
    sel.innerHTML += `<option value="${f}">${f}</option>`;
  });
}

function getFilteredItems() {
  let items = allItems;
  if (currentFloorFilter !== 'all') {
    items = items.filter(i => i.floor === currentFloorFilter);
  }
  if (currentStatusFilter !== 'all') {
    items = items.filter(i => i.status === currentStatusFilter);
  }
  return items;
}

function renderAll() {
  const filtered = getFilteredItems();
  renderSummary(filtered);
  renderTypeBreakdown(filtered);
  renderPendingSupply(allItems); // pending list always shows all (not status-filtered)
  renderTable(filtered);
}

// ==============================================================
// PROJECTS
// ==============================================================
async function loadProjects() {
  const snap = await getDocs(query(collection(db, 'projects'), orderBy('name')));
  allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderProjectList();
}

function renderProjectList() {
  const ul = document.getElementById('projectList');
  ul.innerHTML = '';
  if (allProjects.length === 0) {
    ul.innerHTML = '<li style="color:var(--text-muted);font-size:0.75rem;padding:8px 10px;">No projects yet.</li>';
    return;
  }
  allProjects.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (currentProject && currentProject.id === p.id) li.classList.add('active');
    li.addEventListener('click', () => openProject(p));
    ul.appendChild(li);
  });
}

function openProject(project) {
  currentProject = project;
  currentFloors  = project.floors || [];
  currentFloorFilter  = 'all';
  currentStatusFilter = 'all';
  document.getElementById('floorFilter').value  = 'all';
  document.getElementById('statusFilter').value = 'all';

  // Update sidebar highlight
  document.querySelectorAll('.project-list li').forEach(li => {
    li.classList.toggle('active', li.textContent === project.name);
  });
  // Show project view
  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('projectView').style.display = '';
  document.getElementById('projectName').textContent = project.name;
  document.getElementById('projectDesc').textContent = project.description || '';
  populateFloorFilter();

  // Subscribe to items
  if (itemsUnsub) itemsUnsub();
  itemsUnsub = onSnapshot(
    collection(db, 'projects', project.id, 'items'),
    snap => {
      allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort: by floor, then flatNo (nulls last), then windowType
      allItems.sort((a, b) => {
        const fi = currentFloors.indexOf(a.floor) - currentFloors.indexOf(b.floor);
        if (fi !== 0) return fi;
        const fa = a.flatNo ?? Infinity, fb = b.flatNo ?? Infinity;
        if (fa !== fb) return fa - fb;
        return (a.windowType || '').localeCompare(b.windowType || '');
      });
      renderAll();
    }
  );
}

// ---- Project modal ----
document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));
document.getElementById('editProjectBtn').addEventListener('click', () => openProjectModal(currentProject));
document.getElementById('cancelProjectBtn').addEventListener('click', () => closeProjectModal());
document.getElementById('projectForm').addEventListener('submit', saveProject);

function openProjectModal(project) {
  document.getElementById('projectModalTitle').textContent = project ? 'Edit Project' : 'New Project';
  document.getElementById('projName').value   = project ? project.name        : '';
  document.getElementById('projDesc').value   = project ? (project.description || '') : '';
  document.getElementById('projFloors').value = project ? (project.floors || []).join(', ') : '1st Floor, 2nd Floor, 3rd Floor, 4th Floor, 5th Floor, 6th Floor';
  const box = document.getElementById('customerCheckboxes');
  box.innerHTML = '';
  allUsers.filter(u => u.role === 'customer').forEach(u => {
    const checked = project && (u.projectIds || []).includes(project.id) ? 'checked' : '';
    box.innerHTML += `<label><input type="checkbox" value="${u.id}" ${checked}> ${u.email}</label>`;
  });
  document.getElementById('projectModalBackdrop').style.display = 'flex';
}

function closeProjectModal() {
  document.getElementById('projectModalBackdrop').style.display = 'none';
}

async function saveProject(e) {
  e.preventDefault();
  const name   = document.getElementById('projName').value.trim();
  const desc   = document.getElementById('projDesc').value.trim();
  const floors = document.getElementById('projFloors').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!name || floors.length === 0) return;

  let projectId = currentProject && document.getElementById('projectModalTitle').textContent === 'Edit Project'
    ? currentProject.id : null;

  try {
    const payload = { name, description: desc, floors, updatedAt: serverTimestamp() };
    if (projectId) {
      await updateDoc(doc(db, 'projects', projectId), payload);
    } else {
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, 'projects'), payload);
      projectId = ref.id;
    }

    const checkedUids = [...document.querySelectorAll('#customerCheckboxes input:checked')].map(i => i.value);
    for (const u of allUsers.filter(u => u.role === 'customer')) {
      const has  = (u.projectIds || []).includes(projectId);
      const want = checkedUids.includes(u.id);
      if (has !== want) {
        const newIds = want
          ? [...(u.projectIds || []), projectId]
          : (u.projectIds || []).filter(id => id !== projectId);
        await updateDoc(doc(db, 'users', u.id), { projectIds: newIds });
      }
    }

    closeProjectModal();
    await loadProjects();
    await loadUsers();
    if (projectId) {
      const p = allProjects.find(p => p.id === projectId);
      if (p) openProject(p);
    }
  } catch (err) {
    console.error('Save project failed:', err);
    alert('Failed to save project: ' + err.message + '\n\nMake sure Firestore security rules are published in the Firebase Console.');
  }
}

// ==============================================================
// ITEMS (per-unit with status)
// ==============================================================
document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(null));
document.getElementById('cancelItemBtn').addEventListener('click', () => closeItemModal());
document.getElementById('itemForm').addEventListener('submit', saveItem);

function openItemModal(item) {
  editingItemId = item ? item.id : null;
  document.getElementById('itemModalTitle').textContent = item ? 'Edit Item' : 'Add Item';

  // Populate floor dropdown
  const floorSel = document.getElementById('itemFloor');
  floorSel.innerHTML = '<option value="">Select floor</option>';
  currentFloors.forEach(f => {
    floorSel.innerHTML += `<option value="${f}">${f}</option>`;
  });

  document.getElementById('itemFloor').value   = item ? item.floor         : '';
  document.getElementById('itemFlatNo').value  = item ? (item.flatNo || '') : '';
  document.getElementById('itemType').value    = item ? item.windowType    : '';
  document.getElementById('itemWidth').value   = item ? item.width         : '';
  document.getElementById('itemHeight').value  = item ? item.height        : '';
  document.getElementById('itemStatus').value  = item ? item.status        : 'pending';
  document.getElementById('itemRemarks').value = item ? (item.remarks || '') : '';

  // Quantity field: show only when adding, hide when editing
  const qtyGroup = document.getElementById('qtyGroup');
  if (item) {
    qtyGroup.style.display = 'none';
  } else {
    qtyGroup.style.display = '';
    document.getElementById('itemQty').value = 1;
  }

  document.getElementById('itemModalBackdrop').style.display = 'flex';
}

function closeItemModal() {
  document.getElementById('itemModalBackdrop').style.display = 'none';
  editingItemId = null;
}

async function saveItem(e) {
  e.preventDefault();
  const floor      = document.getElementById('itemFloor').value;
  const flatNoVal  = document.getElementById('itemFlatNo').value.trim();
  const flatNo     = flatNoVal ? parseInt(flatNoVal) : null;
  const windowType = document.getElementById('itemType').value.trim().toUpperCase();
  const width      = parseFloat(document.getElementById('itemWidth').value);
  const height     = parseFloat(document.getElementById('itemHeight').value);
  const status     = document.getElementById('itemStatus').value;
  const remarks    = document.getElementById('itemRemarks').value.trim();

  if (!floor || !windowType || isNaN(width) || isNaN(height)) return;

  const payload = { floor, flatNo, windowType, width, height, status, remarks, updatedAt: serverTimestamp() };

  try {
    const colRef = collection(db, 'projects', currentProject.id, 'items');
    if (editingItemId) {
      await updateDoc(doc(colRef, editingItemId), payload);
    } else {
      const qty = Math.max(1, parseInt(document.getElementById('itemQty').value) || 1);
      for (let i = 0; i < qty; i++) {
        await addDoc(colRef, { ...payload, createdAt: serverTimestamp() });
      }
    }
    await updateDoc(doc(db, 'projects', currentProject.id), { updatedAt: serverTimestamp() });
    closeItemModal();
  } catch (err) {
    console.error('Save failed:', err);
    alert('Failed to save item: ' + err.message + '\n\nMake sure Firestore security rules are published in the Firebase Console.');
  }
}

async function deleteItem(itemId) {
  if (!confirm('Delete this item?')) return;
  await deleteDoc(doc(db, 'projects', currentProject.id, 'items', itemId));
  await updateDoc(doc(db, 'projects', currentProject.id), { updatedAt: serverTimestamp() });
}

// ---- Inline status cycling ----
const STATUS_CYCLE = ['pending', 'supplied', 'installed'];

async function cycleStatus(itemId, currentStatus) {
  const idx = STATUS_CYCLE.indexOf(currentStatus);
  const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  try {
    await updateDoc(doc(db, 'projects', currentProject.id, 'items', itemId), {
      status: next,
      updatedAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'projects', currentProject.id), { updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Status update failed:', err);
    alert('Failed to update status: ' + err.message);
  }
}

// ==============================================================
// SUMMARY
// ==============================================================
function renderSummary(items) {
  const total     = items.length;
  const installed = items.filter(i => i.status === 'installed').length;
  const supplied  = items.filter(i => i.status === 'supplied').length;
  const pending   = items.filter(i => i.status === 'pending').length;
  const pct       = total > 0 ? Math.round((installed / total) * 100) : 0;

  document.getElementById('summaryTotal').textContent     = total;
  document.getElementById('summaryInstalled').textContent = installed;
  document.getElementById('summarySupplied').textContent  = supplied;
  document.getElementById('summaryPending').textContent   = pending;
  document.getElementById('summaryProgress').style.width  = pct + '%';
  document.getElementById('summaryPct').textContent       = pct + '%';
}

// ==============================================================
// TYPE BREAKDOWN CARDS
// ==============================================================
function renderTypeBreakdown(items) {
  const container = document.getElementById('typeCards');
  container.innerHTML = '';

  // Group by windowType
  const byType = {};
  items.forEach(item => {
    const key = item.windowType;
    if (!byType[key]) byType[key] = { items: [], dims: `${item.width} × ${item.height}` };
    byType[key].items.push(item);
  });

  const types = Object.keys(byType).sort();
  if (types.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No items yet.</p>';
    return;
  }

  types.forEach(type => {
    const group     = byType[type];
    const total     = group.items.length;
    const installed = group.items.filter(i => i.status === 'installed').length;
    const supplied  = group.items.filter(i => i.status === 'supplied').length;
    const pending   = group.items.filter(i => i.status === 'pending').length;
    const pct       = total > 0 ? Math.round((installed / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'type-card';
    card.innerHTML = `
      <div class="type-card__name">${type}</div>
      <div class="type-card__dims">${group.dims} m &middot; ${total} units</div>
      <div class="type-card__stats">
        <div class="type-card__stat">
          <span class="type-card__stat-label">Installed</span>
          <span class="type-card__stat-val green">${installed}</span>
        </div>
        <div class="type-card__stat">
          <span class="type-card__stat-label">Supplied</span>
          <span class="type-card__stat-val amber">${supplied}</span>
        </div>
        <div class="type-card__stat">
          <span class="type-card__stat-label">Pending</span>
          <span class="type-card__stat-val red">${pending}</span>
        </div>
      </div>
      <div class="type-card__bar">
        <div class="type-card__bar-fill" style="width:${pct}%"></div>
      </div>`;
    container.appendChild(card);
  });
}

// ==============================================================
// PENDING SUPPLY LIST
// ==============================================================
function renderPendingSupply(items) {
  // Filter by floor if a floor filter is active, but always show pending status
  let pendingItems = items.filter(i => i.status === 'pending');
  if (currentFloorFilter !== 'all') {
    pendingItems = pendingItems.filter(i => i.floor === currentFloorFilter);
  }

  const section = document.getElementById('pendingSection');
  const countEl = document.getElementById('pendingCount');
  const tbody   = document.getElementById('pendingBody');

  if (pendingItems.length === 0) {
    countEl.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:16px;">No pending items</td></tr>';
    return;
  }

  countEl.innerHTML = `<span class="pending-count__dot"></span>${pendingItems.length} items`;
  tbody.innerHTML = '';

  pendingItems.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.floor}</td>
      <td>${item.flatNo || '—'}</td>
      <td>${item.windowType}</td>
      <td>${item.width} × ${item.height}</td>
      <td>${item.remarks || ''}</td>`;
    tbody.appendChild(tr);
  });
}

// ==============================================================
// TABLE RENDERING
// ==============================================================
function renderTable(items) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');

  thead.innerHTML = `<tr>
    <th>Flat</th>
    <th>Floor</th>
    <th>Type</th>
    <th>W×H (m)</th>
    <th>Status</th>
    <th>Remarks</th>
    <th></th>
  </tr>`;

  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:20px;">No items match the current filter</td></tr>';
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.flatNo || '—'}</td>
      <td>${item.floor}</td>
      <td><strong>${item.windowType}</strong></td>
      <td>${item.width} × ${item.height}</td>
      <td>
        <span class="status-badge status-badge--${item.status} clickable"
          data-status-item="${item.id}" data-status="${item.status}"
          title="Click to change status">${item.status}</span>
      </td>
      <td>${item.remarks || ''}</td>
      <td>
        <button class="btn-icon" data-edit="${item.id}" title="Edit">✏️</button>
        <button class="btn-icon danger" data-delete="${item.id}" title="Delete">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // Event delegation (remove old listeners by re-cloning — or just use single handler)
  tbody.onclick = handleTableClick;
}

async function handleTableClick(e) {
  // Status badge click
  const badge = e.target.closest('[data-status-item]');
  if (badge) {
    cycleStatus(badge.dataset.statusItem, badge.dataset.status);
    return;
  }
  // Edit-item button
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    const id   = editBtn.dataset.edit;
    const snap = await getDoc(doc(db, 'projects', currentProject.id, 'items', id));
    if (snap.exists()) openItemModal({ id: snap.id, ...snap.data() });
    return;
  }
  // Delete button
  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) { deleteItem(delBtn.dataset.delete); return; }
}

// ==============================================================
// USERS
// ==============================================================
async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'));
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUserList();
}

function renderUserList() {
  const ul = document.getElementById('userList');
  ul.innerHTML = '';
  if (allUsers.length === 0) {
    ul.innerHTML = '<li style="color:var(--text-muted);font-size:0.75rem;padding:8px 10px;">No users yet.</li>';
    return;
  }
  allUsers.forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>
          <div style="font-weight:500;color:var(--text-primary)">${u.email}</div>
          <div style="font-size:0.65rem;color:${u.role === 'admin' ? 'var(--gold)' : 'var(--text-muted)'};text-transform:uppercase;letter-spacing:.06em">${u.role}</div>
        </div>
        <button class="btn-icon danger" data-uid="${u.id}" title="Remove user" style="font-size:0.85rem">🗑</button>
      </div>`;
    li.querySelector('[data-uid]').addEventListener('click', e => {
      e.stopPropagation();
      removeUser(u.id, u.email);
    });
    ul.appendChild(li);
  });
}

document.getElementById('addUserBtn').addEventListener('click', openUserModal);
document.getElementById('cancelUserBtn').addEventListener('click', () => {
  document.getElementById('userModalBackdrop').style.display = 'none';
});
document.getElementById('userForm').addEventListener('submit', addUser);
document.getElementById('userRole').addEventListener('change', function() {
  document.getElementById('userProjectsGroup').style.display = this.value === 'customer' ? '' : 'none';
});

function openUserModal() {
  document.getElementById('userEmail').value = '';
  document.getElementById('userRole').value  = 'customer';
  document.getElementById('userError').style.display = 'none';
  document.getElementById('userProjectsGroup').style.display = '';
  const box = document.getElementById('projectCheckboxes');
  box.innerHTML = '';
  allProjects.forEach(p => {
    box.innerHTML += `<label><input type="checkbox" value="${p.id}"> ${p.name}</label>`;
  });
  document.getElementById('userModalBackdrop').style.display = 'flex';
}

async function addUser(e) {
  e.preventDefault();
  const email      = document.getElementById('userEmail').value.trim().toLowerCase();
  const role       = document.getElementById('userRole').value;
  const projectIds = role === 'customer'
    ? [...document.querySelectorAll('#projectCheckboxes input:checked')].map(i => i.value)
    : [];
  const errEl = document.getElementById('userError');
  errEl.style.display = 'none';

  if (!email) return;

  const existing = allUsers.find(u => u.email === email);
  if (existing) {
    errEl.textContent = 'This email is already registered.';
    errEl.style.display = 'block';
    return;
  }

  const newDoc = { email, role, projectIds, createdAt: serverTimestamp(), pendingUid: true };
  await setDoc(doc(db, 'pendingUsers', email.replace(/\./g, '_')), newDoc);

  document.getElementById('userModalBackdrop').style.display = 'none';
  alert(`User ${email} added as ${role}.\n\nNote: They must sign in with Google once before they appear in the active user list.`);
  await loadUsers();
}

async function removeUser(uid, email) {
  if (!confirm(`Remove access for ${email}?`)) return;
  await deleteDoc(doc(db, 'users', uid));
  await loadUsers();
}
