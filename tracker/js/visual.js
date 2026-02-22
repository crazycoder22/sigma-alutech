// ============================================================
// SIGMA ALUTECH — Building Visualization Logic
// ============================================================
import { db, auth, requireRole, signOutAndRedirect } from './auth.js';
import {
  collection, doc, getDocs, getDoc, updateDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ---- State ----
let currentProject = null;
let currentFloors  = [];
let allProjects    = [];
let allItems       = [];
let itemsUnsub     = null;
let selectedFloor  = null;   // null = overview mode

// ---- Boot ----
requireRole('admin').then(({ user }) => {
  document.getElementById('adminEmail').textContent = user.email;
  document.getElementById('signOutBtn').addEventListener('click', signOutAndRedirect);
  loadProjects();
});

// ==============================================================
// PROJECTS
// ==============================================================
async function loadProjects() {
  const snap = await getDocs(query(collection(db, 'projects'), orderBy('name')));
  allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderProjectList();

  // Auto-open from URL param ?project=xxx
  const params = new URLSearchParams(window.location.search);
  const projectParam = params.get('project');
  if (projectParam) {
    const p = allProjects.find(p => p.id === projectParam);
    if (p) openProject(p);
  }
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
  selectedFloor  = null;

  // Update sidebar highlight
  document.querySelectorAll('.project-list li').forEach(li => {
    li.classList.toggle('active', li.textContent === project.name);
  });

  // Show visual view
  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('visualView').style.display   = '';
  document.getElementById('projectName').textContent    = project.name;
  document.getElementById('projectDesc').textContent    = project.description || '';

  // Subscribe to items
  if (itemsUnsub) itemsUnsub();
  itemsUnsub = onSnapshot(
    collection(db, 'projects', project.id, 'items'),
    snap => {
      allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort: by floor order, then flatNo (nulls last), then windowType
      allItems.sort((a, b) => {
        const fi = currentFloors.indexOf(a.floor) - currentFloors.indexOf(b.floor);
        if (fi !== 0) return fi;
        const fa = a.flatNo ?? Infinity, fb = b.flatNo ?? Infinity;
        if (fa !== fb) return fa - fb;
        return (a.windowType || '').localeCompare(b.windowType || '');
      });
      renderBuilding();
      renderDetail();
    }
  );
}

// ==============================================================
// BUILDING GRAPHIC
// ==============================================================
function getFloorStats() {
  const stats = {};
  currentFloors.forEach(f => {
    stats[f] = { total: 0, installed: 0, supplied: 0, pending: 0 };
  });
  allItems.forEach(item => {
    const s = stats[item.floor];
    if (!s) return;
    s.total++;
    if (item.status === 'installed') s.installed++;
    else if (item.status === 'supplied') s.supplied++;
    else s.pending++;
  });
  return stats;
}

function renderBuilding() {
  const container = document.getElementById('buildingFloors');
  container.innerHTML = '';
  const floorStats = getFloorStats();

  currentFloors.forEach(floorName => {
    const stats = floorStats[floorName];
    const pct = stats.total > 0 ? Math.round((stats.installed / stats.total) * 100) : 0;
    const statusClass = pct >= 80 ? 'high' : pct >= 30 ? 'mid' : 'low';
    const barClass = pct >= 80 ? 'status-high' : pct >= 30 ? 'status-mid' : 'status-low';

    const div = document.createElement('div');
    div.className = 'floor-block' + (selectedFloor === floorName ? ' active' : '');
    div.innerHTML = `
      <span class="floor-block__name">${floorName}</span>
      <div class="floor-block__bar">
        <div class="floor-block__bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>
      <span class="floor-block__count">${stats.installed}/${stats.total}</span>
      <span class="floor-block__pct ${statusClass}">${pct}%</span>
    `;
    div.addEventListener('click', () => {
      selectedFloor = selectedFloor === floorName ? null : floorName;
      renderBuilding();
      renderDetail();
    });
    container.appendChild(div);
  });
}

// ==============================================================
// DETAIL PANEL
// ==============================================================
function renderDetail() {
  const container = document.getElementById('detailContent');
  container.innerHTML = '';

  if (selectedFloor === null) {
    renderOverview(container);
  } else {
    renderFloorDetail(container, selectedFloor);
  }
}

// ---- Overview mode ----
function renderOverview(container) {
  const total     = allItems.length;
  const installed = allItems.filter(i => i.status === 'installed').length;
  const supplied  = allItems.filter(i => i.status === 'supplied').length;
  const pending   = allItems.filter(i => i.status === 'pending').length;
  const pct       = total > 0 ? Math.round((installed / total) * 100) : 0;

  container.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-header__floor">Building Overview</div>
        <div class="detail-header__subtitle">Click a floor on the left to see details</div>
      </div>
    </div>
    <div class="detail-summary">
      <div class="detail-stat">
        <div class="detail-stat__label">Total Units</div>
        <div class="detail-stat__value">${total}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat__label">Installed</div>
        <div class="detail-stat__value" style="color:var(--green)">${installed}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat__label">Supplied</div>
        <div class="detail-stat__value" style="color:var(--amber)">${supplied}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat__label">Pending</div>
        <div class="detail-stat__value" style="color:var(--red)">${pending}</div>
      </div>
    </div>
    <div class="progress-bar" style="margin-bottom:24px;">
      <div class="progress-bar__fill" style="width:${pct}%"></div>
    </div>
    <h3 class="section-heading">Floor-by-Floor Progress</h3>
    <div class="table-wrap">
      <table class="tracker-table">
        <thead>
          <tr>
            <th>Floor</th>
            <th>Total</th>
            <th>Installed</th>
            <th>Supplied</th>
            <th>Pending</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody id="overviewBody"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#overviewBody');
  const floorStats = getFloorStats();

  currentFloors.forEach(floorName => {
    const s  = floorStats[floorName];
    const fp = s.total > 0 ? Math.round((s.installed / s.total) * 100) : 0;

    const tr = document.createElement('tr');
    tr.className = 'overview-row';
    tr.innerHTML = `
      <td style="color:var(--gold);font-weight:500">${floorName}</td>
      <td>${s.total}</td>
      <td style="color:var(--green)">${s.installed}</td>
      <td style="color:var(--amber)">${s.supplied}</td>
      <td style="color:var(--red)">${s.pending}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="progress-bar" style="flex:1;height:6px;">
            <div class="progress-bar__fill" style="width:${fp}%"></div>
          </div>
          <span style="font-size:0.75rem;color:var(--text-muted);min-width:30px;">${fp}%</span>
        </div>
      </td>
    `;
    tr.addEventListener('click', () => {
      selectedFloor = floorName;
      renderBuilding();
      renderDetail();
    });
    tbody.appendChild(tr);
  });
}

// ---- Floor detail mode ----
function renderFloorDetail(container, floorName) {
  const items     = allItems.filter(i => i.floor === floorName);
  const total     = items.length;
  const installed = items.filter(i => i.status === 'installed').length;
  const supplied  = items.filter(i => i.status === 'supplied').length;
  const pending   = items.filter(i => i.status === 'pending').length;
  const pct       = total > 0 ? Math.round((installed / total) * 100) : 0;

  container.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-header__floor">${floorName}</div>
        <div class="detail-header__subtitle">${total} units on this floor</div>
      </div>
      <button class="btn-outline btn-sm" id="backToOverview">&larr; All Floors</button>
    </div>
    <div class="detail-summary">
      <div class="detail-stat">
        <div class="detail-stat__label">Total</div>
        <div class="detail-stat__value">${total}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat__label">Installed</div>
        <div class="detail-stat__value" style="color:var(--green)">${installed}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat__label">Supplied</div>
        <div class="detail-stat__value" style="color:var(--amber)">${supplied}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat__label">Pending</div>
        <div class="detail-stat__value" style="color:var(--red)">${pending}</div>
      </div>
    </div>
    <div class="progress-bar" style="margin-bottom:20px;">
      <div class="progress-bar__fill" style="width:${pct}%"></div>
    </div>
    <h3 class="section-heading">Items</h3>
    <div class="table-wrap">
      <table class="tracker-table">
        <thead>
          <tr>
            <th>Flat</th>
            <th>Type</th>
            <th>W×H (m)</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody id="floorItemsBody"></tbody>
      </table>
    </div>
  `;

  // Back button
  container.querySelector('#backToOverview').addEventListener('click', () => {
    selectedFloor = null;
    renderBuilding();
    renderDetail();
  });

  // Render items
  const tbody = container.querySelector('#floorItemsBody');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:20px;">No items on this floor</td></tr>';
    return;
  }

  // Sort by flatNo then windowType
  items.sort((a, b) => {
    const fa = a.flatNo ?? Infinity, fb = b.flatNo ?? Infinity;
    if (fa !== fb) return fa - fb;
    return (a.windowType || '').localeCompare(b.windowType || '');
  });

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.flatNo || '—'}</td>
      <td><strong>${item.windowType}</strong></td>
      <td>${item.width} × ${item.height}</td>
      <td>
        <span class="status-badge status-badge--${item.status} clickable"
          data-item-id="${item.id}" data-status="${item.status}"
          title="Click to cycle status">${item.status}</span>
      </td>
      <td>${item.remarks || ''}</td>
    `;
    tbody.appendChild(tr);
  });

  // Status badge click delegation
  tbody.addEventListener('click', async (e) => {
    const badge = e.target.closest('[data-item-id]');
    if (!badge) return;
    await cycleStatus(badge.dataset.itemId, badge.dataset.status);
  });
}

// ==============================================================
// STATUS CYCLING
// ==============================================================
const STATUS_CYCLE = ['pending', 'supplied', 'installed'];

async function cycleStatus(itemId, currentStatus) {
  const idx  = STATUS_CYCLE.indexOf(currentStatus);
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
