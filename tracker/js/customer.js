// ============================================================
// SIGMA ALUTECH — Customer View Logic
// ============================================================
import { db, requireRole, signOutAndRedirect } from './auth.js';
import {
  collection, doc, getDoc, getDocs, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let currentProject = null;
let currentFloors  = [];
let itemsUnsub     = null;

// ---- Boot ----
requireRole('customer').then(async ({ user, userData }) => {
  document.getElementById('customerEmail').textContent = user.email;
  document.getElementById('signOutBtn').addEventListener('click', signOutAndRedirect);
  await loadProjects(userData.projectIds || []);
});

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

  // Auto-open first project
  if (projects.length > 0) {
    ul.firstChild.classList.add('active');
    openProject(projects[0]);
  }
}

function openProject(project) {
  currentProject = project;
  currentFloors  = project.floors || [];

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('projectView').style.display = '';
  document.getElementById('projectName').textContent = project.name;
  document.getElementById('projectDesc').textContent = project.description || '';

  const updatedAt = project.updatedAt
    ? new Date(project.updatedAt.seconds * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
  document.getElementById('lastUpdated').textContent = updatedAt;

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
      renderSummary(items);
      renderFloorCards(items);
      renderTable(items);
    }
  );
}

// ==============================================================
// SUMMARY
// ==============================================================
function renderSummary(items) {
  let total = 0, fixed = 0;
  items.forEach(item => {
    total += item.total || 0;
    currentFloors.forEach(f => {
      fixed += ((item.floorData || {})[f] || {}).fixed || 0;
    });
  });
  const balance = total - fixed;
  const pct     = total > 0 ? Math.round((fixed / total) * 100) : 0;
  document.getElementById('summaryTotal').textContent    = total;
  document.getElementById('summaryFixed').textContent    = fixed;
  document.getElementById('summaryBalance').textContent  = balance;
  document.getElementById('summaryProgress').style.width = pct + '%';
  document.getElementById('summaryPct').textContent      = pct + '%';
}

// ==============================================================
// FLOOR CARDS
// ==============================================================
function renderFloorCards(items) {
  const container = document.getElementById('floorCards');
  container.innerHTML = '';

  currentFloors.forEach(floor => {
    let fTotal = 0, fFixed = 0;
    items.forEach(item => {
      const fd = (item.floorData || {})[floor] || {};
      fTotal += fd.total || 0;
      fFixed += fd.fixed || 0;
    });
    const fBalance = fTotal - fFixed;
    const pct = fTotal > 0 ? Math.round((fFixed / fTotal) * 100) : 0;
    const statusClass = fTotal === 0 ? 'floor-card--none'
      : fFixed === fTotal ? 'floor-card--complete'
      : 'floor-card--partial';

    const card = document.createElement('div');
    card.className = `floor-card ${statusClass}`;
    card.innerHTML = `
      <div class="floor-card__name">${floor}</div>
      <div class="floor-card__stats">
        <div class="floor-card__stat green">
          <span>Installed</span>
          <span>${fFixed}</span>
        </div>
        <div class="floor-card__stat amber">
          <span>Pending</span>
          <span>${fBalance}</span>
        </div>
      </div>
      <div class="progress-bar" title="${pct}%">
        <div class="progress-bar__fill" style="width:${pct}%"></div>
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
  const floors = currentFloors;

  let hRow1 = `<tr>
    <th rowspan="2">Flat</th>
    <th rowspan="2">Type</th>
    <th rowspan="2">W×H (m)</th>
    <th rowspan="2">Total</th>
    <th rowspan="2">Installed</th>
    <th rowspan="2">Pending</th>`;
  floors.forEach(f => {
    hRow1 += `<th class="floor-header" colspan="3">${f}</th>`;
  });
  hRow1 += `<th rowspan="2">Remarks</th></tr>`;
  let hRow2 = '<tr>';
  floors.forEach(() => {
    hRow2 += `<th class="floor-header">Total</th><th class="floor-header">Fixed</th><th class="floor-header">Pending</th>`;
  });
  hRow2 += '</tr>';
  thead.innerHTML = hRow1 + hRow2;

  tbody.innerHTML = '';
  let prevFlat = null;
  let totTotal = 0, totFixed = 0;
  const floorTotals = {};
  floors.forEach(f => { floorTotals[f] = { total: 0, fixed: 0 }; });

  items.forEach(item => {
    const fd      = item.floorData || {};
    const overall = { total: item.total || 0, fixed: 0 };
    floors.forEach(f => { overall.fixed += (fd[f] || {}).fixed || 0; });
    const balance = overall.total - overall.fixed;
    totTotal += overall.total;
    totFixed += overall.fixed;
    floors.forEach(f => {
      floorTotals[f].total += (fd[f] || {}).total || 0;
      floorTotals[f].fixed += (fd[f] || {}).fixed || 0;
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
      const fTotal   = (fd[f] || {}).total   || 0;
      const fFixed   = (fd[f] || {}).fixed   || 0;
      const fBalance = fTotal - fFixed;
      html += `<td class="col-floor">${fTotal}</td>
        <td class="col-floor ${fFixed > 0 ? 'cell-green' : 'cell-zero'}">${fFixed}</td>
        <td class="col-floor ${fBalance === 0 ? 'cell-zero' : 'cell-amber'}">${fBalance}</td>`;
    });

    html += `<td>${item.remarks || ''}</td>`;
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
    html += '<td></td>';
    tr.innerHTML = html;
    tbody.appendChild(tr);
  }
}
