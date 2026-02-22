// ============================================================
// SIGMA ALUTECH — Customer View Logic
// ============================================================
import { db, requireRole, signOutAndRedirect } from './auth.js';
import {
  collection, doc, getDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let currentProject      = null;
let currentFloors       = [];
let allItems            = [];
let itemsUnsub          = null;
let currentFloorFilter  = 'all';
let currentStatusFilter = 'all';

// ---- Boot ----
requireRole('customer').then(async ({ user, userData }) => {
  document.getElementById('customerEmail').textContent = user.email;
  document.getElementById('signOutBtn').addEventListener('click', signOutAndRedirect);
  initFilters();
  await loadProjects(userData.projectIds || []);
});

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
  renderTable(filtered);
}

// ---- Projects ----
async function loadProjects(projectIds) {
  const ul = document.getElementById('projectList');
  ul.innerHTML = '';

  if (projectIds.length === 0) {
    ul.innerHTML = '<li style="color:var(--text-muted);font-size:0.75rem;padding:8px 10px;">No projects assigned yet.</li>';
    return;
  }

  const projects = [];
  for (const id of projectIds) {
    const snap = await getDoc(doc(db, 'projects', id));
    if (snap.exists()) projects.push({ id: snap.id, ...snap.data() });
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));

  projects.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    li.addEventListener('click', () => {
      document.querySelectorAll('.project-list li').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      openProject(p);
    });
    ul.appendChild(li);
  });

  if (projects.length > 0) {
    ul.firstChild.classList.add('active');
    openProject(projects[0]);
  }
}

function openProject(project) {
  currentProject = project;
  currentFloors  = project.floors || [];
  currentFloorFilter  = 'all';
  currentStatusFilter = 'all';
  document.getElementById('floorFilter').value  = 'all';
  document.getElementById('statusFilter').value = 'all';

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('projectView').style.display = '';
  document.getElementById('projectName').textContent = project.name;
  document.getElementById('projectDesc').textContent = project.description || '';

  const updatedAt = project.updatedAt
    ? new Date(project.updatedAt.seconds * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
  document.getElementById('lastUpdated').textContent = updatedAt;

  populateFloorFilter();

  if (itemsUnsub) itemsUnsub();
  itemsUnsub = onSnapshot(
    collection(db, 'projects', project.id, 'items'),
    snap => {
      allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
// TABLE (read-only)
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
  </tr>`;

  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:20px;">No items match the current filter</td></tr>';
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.flatNo || '—'}</td>
      <td>${item.floor}</td>
      <td><strong>${item.windowType}</strong></td>
      <td>${item.width} × ${item.height}</td>
      <td><span class="status-badge status-badge--${item.status}">${item.status}</span></td>
      <td>${item.remarks || ''}</td>`;
    tbody.appendChild(tr);
  });
}
