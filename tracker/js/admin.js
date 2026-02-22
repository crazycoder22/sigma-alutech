// ============================================================
// SIGMA ALUTECH — Admin Dashboard Logic
// ============================================================
import { db, auth, requireRole, signOutAndRedirect } from './auth.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ---- State ----
let currentProject = null;   // { id, ...data }
let currentFloors  = [];     // ["1st Floor", ...]
let allProjects    = [];     // [{ id, name }]
let allUsers       = [];     // [{ id (uid), email, role, projectIds }]
let itemsUnsub     = null;   // Firestore listener unsubscribe fn
let editingItemId  = null;   // item being edited in modal

// ---- Boot ----
requireRole('admin').then(({ user }) => {
  document.getElementById('adminEmail').textContent = user.email;
  document.getElementById('signOutBtn').addEventListener('click', signOutAndRedirect);
  initTabs();
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
  // Update sidebar highlight
  document.querySelectorAll('.project-list li').forEach(li => {
    li.classList.toggle('active', li.textContent === project.name);
  });
  // Show project view
  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('projectView').style.display = '';
  document.getElementById('projectName').textContent = project.name;
  document.getElementById('projectDesc').textContent = project.description || '';
  // Subscribe to items
  if (itemsUnsub) itemsUnsub();
  itemsUnsub = onSnapshot(
    collection(db, 'projects', project.id, 'items'),
    snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side: by flatNo (nulls last), then windowType
      items.sort((a, b) => {
        const fa = a.flatNo ?? Infinity, fb = b.flatNo ?? Infinity;
        if (fa !== fb) return fa - fb;
        return (a.windowType || '').localeCompare(b.windowType || '');
      });
      renderTable(items);
      renderSummary(items);
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
  // Render customer checkboxes
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

    // Update customer projectIds
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
// ITEMS (tracker rows)
// ==============================================================
document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(null));
document.getElementById('cancelItemBtn').addEventListener('click', () => closeItemModal());
document.getElementById('itemForm').addEventListener('submit', saveItem);

function openItemModal(item) {
  editingItemId = item ? item.id : null;
  document.getElementById('itemModalTitle').textContent = item ? 'Edit Item' : 'Add Item';
  document.getElementById('itemFlatNo').value   = item ? (item.flatNo || '')  : '';
  document.getElementById('itemType').value    = item ? item.windowType  : '';
  document.getElementById('itemWidth').value   = item ? item.width       : '';
  document.getElementById('itemHeight').value  = item ? item.height      : '';
  document.getElementById('itemRemarks').value = item ? (item.remarks || '') : '';

  // Build per-floor fields
  const floorFields = document.getElementById('floorFields');
  floorFields.innerHTML = '';
  currentFloors.forEach(floor => {
    const fd = (item && item.floorData && item.floorData[floor]) || {};
    floorFields.innerHTML += `
      <div class="floor-field">
        <div class="floor-field__name">${floor}</div>
        <div class="floor-field__row">
          <label>Total</label>
          <input type="number" min="0" data-floor="${floor}" data-field="total"
            value="${fd.total !== undefined ? fd.total : ''}" placeholder="0">
        </div>
        <div class="floor-field__row">
          <label>Fixed</label>
          <input type="number" min="0" data-floor="${floor}" data-field="fixed"
            value="${fd.fixed !== undefined ? fd.fixed : ''}" placeholder="0">
        </div>
      </div>`;
  });

  document.getElementById('itemModalBackdrop').style.display = 'flex';
}

function closeItemModal() {
  document.getElementById('itemModalBackdrop').style.display = 'none';
  editingItemId = null;
}

async function saveItem(e) {
  e.preventDefault();
  const flatNoVal  = document.getElementById('itemFlatNo').value.trim();
  const flatNo     = flatNoVal ? parseInt(flatNoVal) : null;
  const windowType = document.getElementById('itemType').value.trim().toUpperCase();
  const width      = parseFloat(document.getElementById('itemWidth').value);
  const height     = parseFloat(document.getElementById('itemHeight').value);
  const remarks    = document.getElementById('itemRemarks').value.trim();

  if (!windowType || isNaN(width) || isNaN(height)) return;

  // Collect floorData
  const floorData = {};
  let total = 0;
  document.querySelectorAll('#floorFields input[data-floor]').forEach(input => {
    const floor = input.dataset.floor;
    const field = input.dataset.field;
    if (!floorData[floor]) floorData[floor] = {};
    floorData[floor][field] = parseInt(input.value) || 0;
  });
  // total = sum of floor totals
  currentFloors.forEach(f => { total += (floorData[f] && floorData[f].total) || 0; });

  const payload = { flatNo, windowType, width, height, remarks, total, floorData, updatedAt: serverTimestamp() };

  try {
    const colRef = collection(db, 'projects', currentProject.id, 'items');
    if (editingItemId) {
      await updateDoc(doc(colRef, editingItemId), payload);
    } else {
      await addDoc(colRef, payload);
    }
    // Update project updatedAt
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

// ---- Inline fixed-count editing ----
async function saveFixedCount(itemId, floor, value) {
  const val = parseInt(value) || 0;
  await updateDoc(doc(db, 'projects', currentProject.id, 'items', itemId), {
    [`floorData.${floor}.fixed`]: val,
    updatedAt: serverTimestamp()
  });
  await updateDoc(doc(db, 'projects', currentProject.id), { updatedAt: serverTimestamp() });
}

// ==============================================================
// TABLE RENDERING
// ==============================================================
function renderTable(items) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  const floors = currentFloors;

  // Build header
  let hRow1 = `<tr>
    <th rowspan="2">Flat</th>
    <th rowspan="2">Type</th>
    <th rowspan="2">W×H (m)</th>
    <th rowspan="2">Total</th>
    <th rowspan="2">Fixed</th>
    <th rowspan="2">Balance</th>`;
  floors.forEach(f => {
    hRow1 += `<th class="floor-header" colspan="3">${f}</th>`;
  });
  hRow1 += `<th rowspan="2">Remarks</th><th rowspan="2"></th></tr>`;
  let hRow2 = '<tr>';
  floors.forEach(() => {
    hRow2 += `<th class="floor-header">Total</th><th class="floor-header">Fixed</th><th class="floor-header">Balance</th>`;
  });
  hRow2 += '</tr>';
  thead.innerHTML = hRow1 + hRow2;

  // Build body
  tbody.innerHTML = '';
  let prevFlat = null;
  let totTotal = 0, totFixed = 0;
  const floorTotals = {};
  floors.forEach(f => { floorTotals[f] = { total: 0, fixed: 0 }; });

  items.forEach(item => {
    const fd      = item.floorData || {};
    const overall = { total: item.total || 0, fixed: 0 };
    floors.forEach(f => { overall.fixed += (fd[f] && fd[f].fixed) || 0; });
    const balance = overall.total - overall.fixed;
    totTotal += overall.total;
    totFixed += overall.fixed;
    floors.forEach(f => {
      floorTotals[f].total += (fd[f] && fd[f].total) || 0;
      floorTotals[f].fixed += (fd[f] && fd[f].fixed) || 0;
    });

    const isNewFlat = item.flatNo !== prevFlat;
    prevFlat = item.flatNo;

    const tr = document.createElement('tr');
    if (isNewFlat && item.flatNo) tr.classList.add('flat-start');

    let html = `
      <td>${isNewFlat && item.flatNo ? item.flatNo : ''}</td>
      <td>${item.windowType}</td>
      <td>${item.width} × ${item.height}</td>
      <td>${overall.total}</td>
      <td class="${overall.fixed === overall.total && overall.total > 0 ? 'cell-green' : 'cell-amber'}">${overall.fixed}</td>
      <td class="${balance === 0 ? 'cell-zero' : 'cell-amber'}">${balance}</td>`;

    floors.forEach(f => {
      const fTotal   = (fd[f] && fd[f].total)   || 0;
      const fFixed   = (fd[f] && fd[f].fixed)   || 0;
      const fBalance = fTotal - fFixed;
      html += `<td class="col-floor">${fTotal}</td>
        <td class="col-floor cell-fixed">
          <span class="edit-cell" title="Click to edit"
            data-item="${item.id}" data-floor="${f}" data-val="${fFixed}">${fFixed}</span>
        </td>
        <td class="col-floor cell-balance ${fBalance === 0 ? 'cell-zero' : 'cell-amber'}">${fBalance}</td>`;
    });

    html += `<td>${item.remarks || ''}</td>
      <td>
        <button class="btn-icon" data-edit="${item.id}" title="Edit">✏️</button>
        <button class="btn-icon danger" data-delete="${item.id}" title="Delete">🗑</button>
      </td>`;

    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  // Totals row
  if (items.length > 0) {
    const totBalance = totTotal - totFixed;
    const tr = document.createElement('tr');
    tr.className = 'totals-row';
    let html = `<td colspan="2"><strong>TOTALS</strong></td>
      <td>—</td>
      <td>${totTotal}</td>
      <td class="cell-green">${totFixed}</td>
      <td class="${totBalance === 0 ? 'cell-zero' : 'cell-amber'}">${totBalance}</td>`;
    floors.forEach(f => {
      const ft = floorTotals[f];
      html += `<td class="col-floor">${ft.total}</td>
        <td class="col-floor cell-green">${ft.fixed}</td>
        <td class="col-floor ${ft.total - ft.fixed === 0 ? 'cell-zero' : 'cell-amber'}">${ft.total - ft.fixed}</td>`;
    });
    html += '<td colspan="2"></td>';
    tr.innerHTML = html;
    tbody.appendChild(tr);
  }

  // Event delegation
  thead.addEventListener('click', handleTableClick);
  tbody.addEventListener('click', handleTableClick);
}

async function handleTableClick(e) {
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
  // Inline fixed-count cell
  const cell = e.target.closest('.edit-cell');
  if (cell && !cell.querySelector('input')) {
    const input = document.createElement('input');
    input.type  = 'number';
    input.min   = '0';
    input.value = cell.dataset.val;
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    const commit = () => {
      const val = input.value;
      saveFixedCount(cell.dataset.item, cell.dataset.floor, val);
      cell.dataset.val = val;
      cell.textContent = val;
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } });
  }
}

// ==============================================================
// SUMMARY
// ==============================================================
function renderSummary(items) {
  let total = 0, fixed = 0;
  items.forEach(item => {
    total += item.total || 0;
    (currentFloors).forEach(f => {
      fixed += ((item.floorData || {})[f] || {}).fixed || 0;
    });
  });
  const balance = total - fixed;
  const pct     = total > 0 ? Math.round((fixed / total) * 100) : 0;
  document.getElementById('summaryTotal').textContent   = total;
  document.getElementById('summaryFixed').textContent   = fixed;
  document.getElementById('summaryBalance').textContent = balance;
  document.getElementById('summaryProgress').style.width = pct + '%';
  document.getElementById('summaryPct').textContent      = pct + '%';
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
  // Render project checkboxes
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

  // Check if email already exists
  const existing = allUsers.find(u => u.email === email);
  if (existing) {
    errEl.textContent = 'This email is already registered.';
    errEl.style.display = 'block';
    return;
  }

  // Store by email as doc ID (uid will be matched on first login via a Cloud Function or manually)
  // We store a pending user keyed by email; on login, auth.js will look up by uid (email match)
  // For simplicity: store with a generated id, and resolve uid on first sign-in via the login page
  // The login flow in index.html already does: check users/{uid} — so admin must add by uid.
  // We store as email-keyed for lookup convenience and show instructions.
  const newDoc = { email, role, projectIds, createdAt: serverTimestamp(), pendingUid: true };
  // Use email as document ID (we'll look up by email on first login)
  await setDoc(doc(db, 'pendingUsers', email.replace(/\./g, '_')), newDoc);

  document.getElementById('userModalBackdrop').style.display = 'none';
  alert(`User ${email} added as ${role}.\n\nNote: They must sign in with Google once before they appear in the active user list. You can also copy their UID from the Firebase Console → Authentication and add them manually to the 'users' collection.`);
  await loadUsers();
}

async function removeUser(uid, email) {
  if (!confirm(`Remove access for ${email}?`)) return;
  await deleteDoc(doc(db, 'users', uid));
  await loadUsers();
}
