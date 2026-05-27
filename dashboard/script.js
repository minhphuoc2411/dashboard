/* ============================================
   CONSTANTS & UTILITIES
   ============================================ */

const GRADE_MAP = { A: 4.0, B: 3.0, C: 2.0, D: 1.0 };
const GRADE_COLOR = { A: 'grade-A', B: 'grade-B', C: 'grade-C', D: 'grade-D' };

function gradeToPoint(g) {
  return GRADE_MAP[g] ?? 0;
}

function gpaColor(g) {
  if (g >= 3.6) return '#3fb950';
  if (g >= 3.2) return '#39c5cf';
  if (g >= 2.5) return '#58a6ff';
  if (g >= 2.0) return '#e3b341';
  return '#f85149';
}

function classifyGPA(gpa) {
  if (gpa >= 3.6) return { label: 'Xuất sắc', color: '#3fb950' };
  if (gpa >= 3.2) return { label: 'Giỏi', color: '#39c5cf' };
  if (gpa >= 2.5) return { label: 'Khá', color: '#58a6ff' };
  return { label: 'Trung bình', color: '#e3b341' };
}

/* ============================================
   CSV PARSER
   ============================================ */

function parseCSV(txt) {
  const lines = txt.trim().split('\n');
  const hdrs = lines[0].split(',').map(h => h.trim());

  return {
    headers: hdrs,
    rows: lines.slice(1).map(l => {
      const v = l.split(',');
      const o = {};
      hdrs.forEach((h, i) => {
        const s = (v[i] || '').trim();
        o[h] = (!isNaN(s) && s !== '') ? parseFloat(s) : s;
      });
      return o;
    }).filter(s => s.ho_ten)
  };
}

function detectSubjects(headers) {
  const fixed = new Set(['ho_ten', 'mssv', 'lop', 'hoc_ky']);
  const subjects = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (fixed.has(h) || h.startsWith('tc_')) continue;

    const next = headers[i + 1];
    const tcKey = (next && next.startsWith('tc_')) ? next : null;
    subjects.push({ key: h, tc: tcKey });
  }

  return subjects;
}

function prettyLabel(key) {
  const map = {
    lap_trinh_c: 'LT C/C++',
    ctdl_gt: 'CTDL & GT',
    toan_roi_rac: 'Toán RR',
    mang_may_tinh: 'Mạng MT',
    co_so_du_lieu: 'CSDL',
    lap_trinh_web: 'LT Web',
    ktpm: 'KTPM',
    giai_tich: 'Giải tích',
    dai_so: 'Đại số',
    vat_ly: 'Vật lý',
    tieng_anh: 'Tiếng Anh',
    ltoop: 'LT OOP',
    he_dieu_hanh: 'Hệ ĐH',
    do_hoa_mt: 'Đồ họa MT',
    ai: 'Trí tuệ NT',
  };

  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function calcGPA(s, subjects) {
  let sumPts = 0, sumTC = 0;

  subjects.forEach(m => {
    const grade = (s[m.key] || '').toString().trim().toUpperCase();
    const pts = gradeToPoint(grade);
    const tc = m.tc ? (parseFloat(s[m.tc]) || 0) : 1;

    sumPts += pts * tc;
    sumTC += tc;
  });

  return sumTC > 0 ? parseFloat((sumPts / sumTC).toFixed(2)) : 0;
}

function calcTotalTC(s, subjects) {
  return subjects.reduce((a, m) => a + (m.tc ? (parseFloat(s[m.tc]) || 0) : 1), 0);
}

/* ============================================
   GLOBAL STATE
   ============================================ */

let allSV = [];
let filteredSV = [];
let charts = {};
let activeClass = 'all';
let page = 1;
let SUBJECTS = [];

const PER = 10;

/* ============================================
   BOOTSTRAP
   ============================================ */

function boot(txt) {
  const { headers, rows } = parseCSV(txt);
  if (!rows.length) return;

  SUBJECTS = detectSubjects(headers);
  allSV = rows.map(s => ({
    ...s,
    gpa: calcGPA(s, SUBJECTS),
    totalTC: calcTotalTC(s, SUBJECTS)
  }));

  const sem = allSV[0]?.hoc_ky || '';
  if (sem) document.getElementById('semBadge').textContent = sem;

  activeClass = 'all';
  buildTableHead();
  renderFilterBar();
  applyFilters();

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}

/* ============================================
   TABLE HEADER
   ============================================ */

function buildTableHead() {
  const subCols = SUBJECTS.map(m => {
    let tcVal = '?';
    for (const sv of allSV) {
      const v = m.tc ? sv[m.tc] : null;
      if (v !== undefined && v !== '' && v !== null) {
        tcVal = v;
        break;
      }
    }
    return `<th class="center">${prettyLabel(m.key)}<br><span style="font-weight:400;opacity:.55">(${tcVal} TC)</span></th>`;
  }).join('');

  document.getElementById('tableHead').innerHTML = `
    <tr>
      <th style="width:36px;text-align:center">STT</th>
      <th>Họ và tên</th>
      <th>MSSV</th>
      <th>Lớp</th>
      ${subCols}
      <th class="center">Tổng TC</th>
      <th class="center">GPA (4.0)</th>
    </tr>
  `;
}

/* ============================================
   FILTER BAR
   ============================================ */

function renderFilterBar() {
  const cls = [...new Set(allSV.map(s => s.lop))].sort();

  document.getElementById('filterBar').innerHTML = `
    <span class="filter-label">Lọc lớp:</span>
    <button class="filter-btn ${activeClass === 'all' ? 'active' : ''}" onclick="setClass('all')">Tất cả</button>
    ${cls.map(c => `<button class="filter-btn ${activeClass === c ? 'active' : ''}" onclick="setClass('${c}')">${c}</button>`).join('')}
  `;
}

function setClass(c) {
  activeClass = c;
  renderFilterBar();
  applyFilters();
}

/* ============================================
   APPLY FILTERS & SORT
   ============================================ */

function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const sort = document.getElementById('sortFilter').value;

  let d = activeClass === 'all' ? allSV : allSV.filter(s => s.lop === activeClass);

  if (q) {
    d = d.filter(s => s.ho_ten.toLowerCase().includes(q) || (s.mssv || '').toLowerCase().includes(q));
  }

  d = [...d];

  if (sort === 'gpa_desc') d.sort((a, b) => b.gpa - a.gpa);
  else if (sort === 'gpa_asc') d.sort((a, b) => a.gpa - b.gpa);
  else if (sort === 'name_asc') d.sort((a, b) => a.ho_ten.localeCompare(b.ho_ten, 'vi'));
  else if (sort === 'mssv_asc') d.sort((a, b) => (a.mssv || '').localeCompare(b.mssv || ''));

  filteredSV = d;
  page = 1;

  document.getElementById('subBadge').textContent = activeClass === 'all' ? 'Toàn khoa' : activeClass;

  renderKPI(d);
  renderClassChart(allSV);
  renderSubjectChart(d);
  renderRankChart(d);
  renderTable();
}

/* ============================================
   KPI CARDS
   ============================================ */

function renderKPI(sv) {
  const n = sv.length;
  if (!n) return;

  const avgGPA = (sv.reduce((a, s) => a + s.gpa, 0) / n).toFixed(2);

  const bestSub = SUBJECTS.map(m => {
    const pts = sv.map(s => gradeToPoint((s[m.key] || '').toString().trim().toUpperCase()));
    return {
      l: prettyLabel(m.key),
      a: pts.reduce((x, y) => x + y, 0) / pts.length
    };
  }).sort((a, b) => b.a - a.a)[0];

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi cb">
      <div class="kpi-label">Tổng sinh viên</div>
      <div class="kpi-val">${n}</div>
      <div class="kpi-sub">đang hiển thị</div>
    </div>
    <div class="kpi ct">
      <div class="kpi-label">GPA trung bình</div>
      <div class="kpi-val">${avgGPA}</div>
      <div class="kpi-sub">thang điểm 4.0</div>
    </div>
    <div class="kpi cp">
      <div class="kpi-label">Môn điểm cao nhất</div>
      <div class="kpi-val">${bestSub?.a.toFixed(2) ?? '—'}</div>
      <div class="kpi-sub">${bestSub?.l ?? '—'}</div>
    </div>
  `;
}

/* ============================================
   CHART HELPER
   ============================================ */

function dc(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

/* ============================================
   CLASS CHART
   ============================================ */

function renderClassChart(sv) {
  dc('class');

  const cls = [...new Set(sv.map(s => s.lop))].sort();
  const gpas = cls.map(c => {
    const g = sv.filter(s => s.lop === c);
    return parseFloat((g.reduce((a, s) => a + s.gpa, 0) / g.length).toFixed(2));
  });

  charts.class = new Chart(document.getElementById('classChart'), {
    type: 'bar',
    data: {
      labels: cls,
      datasets: [{
        label: 'GPA',
        data: gpas,
        backgroundColor: gpas.map(v => v >= 3.6 ? '#3fb95055' : v >= 3.2 ? '#39c5cf55' : v >= 2.5 ? '#58a6ff55' : v >= 2.0 ? '#e3b34155' : '#f8514955'),
        borderColor: gpas.map(v => v >= 3.6 ? '#3fb950' : v >= 3.2 ? '#39c5cf' : v >= 2.5 ? '#58a6ff' : v >= 2.0 ? '#e3b341' : '#f85149'),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 4, ticks: { color: '#7d8590', stepSize: 0.5, callback: v => v.toFixed(1) }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#7d8590' }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` GPA: ${ctx.raw.toFixed(2)}` } }
      }
    }
  });
}

/* ============================================
   SUBJECT CHART
   ============================================ */

function renderSubjectChart(sv) {
  dc('subject');

  const labels = SUBJECTS.map(m => prettyLabel(m.key));
  const gradeKeys = ['A', 'B', 'C', 'D'];
  const colors = { A: '#3fb950', B: '#58a6ff', C: '#e3b341', D: '#f85149' };

  const datasets = gradeKeys.map(g => ({
    label: g,
    data: SUBJECTS.map(m => sv.filter(s => (s[m.key] || '').toString().trim().toUpperCase() === g).length),
    backgroundColor: colors[g] + '99',
    borderColor: colors[g],
    borderWidth: 1,
    borderRadius: 4,
    borderSkipped: false
  }));

  charts.subject = new Chart(document.getElementById('subjectChart'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, stacked: true, ticks: { color: '#7d8590', stepSize: 2 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { stacked: true, ticks: { color: '#7d8590', font: { size: 10 } }, grid: { display: false } }
      },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#7d8590', boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} SV` } }
      }
    }
  });
}

/* ============================================
   RANK CHART
   ============================================ */

function renderRankChart(sv) {
  dc('rank');

  const m = { 'Xuất sắc': 0, 'Giỏi': 0, 'Khá': 0, 'Trung bình': 0 };
  sv.forEach(s => { m[classifyGPA(s.gpa).label]++; });

  const cols = { 'Xuất sắc': '#3fb950', 'Giỏi': '#39c5cf', 'Khá': '#58a6ff', 'Trung bình': '#e3b341' };

  charts.rank = new Chart(document.getElementById('rankChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(m),
      datasets: [{
        data: Object.values(m),
        backgroundColor: Object.keys(m).map(k => cols[k] + '55'),
        borderColor: Object.keys(m).map(k => cols[k]),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { color: '#7d8590', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#7d8590', font: { size: 10 } }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw} sinh viên` } }
      }
    }
  });
}

/* ============================================
   TABLE RENDER
   ============================================ */

function renderTable() {
  const total = filteredSV.length;
  const totalPg = Math.max(1, Math.ceil(total / PER));
  page = Math.min(page, totalPg);

  const start = (page - 1) * PER;
  const pageData = filteredSV.slice(start, start + PER);

  document.getElementById('tableCount').textContent = `${total} sinh viên`;

  document.getElementById('studentTable').innerHTML = pageData.map((s, i) => {
    const gc = gpaColor(s.gpa);
    const pct = Math.min(100, (s.gpa / 4) * 100);

    const gradeCells = SUBJECTS.map(m => {
      const g = (s[m.key] || '').toString().trim().toUpperCase();
      const cls = GRADE_COLOR[g] || '';
      return `<td style="text-align:center"><span class="grade ${cls}">${g || '—'}</span></td>`;
    }).join('');

    return `
      <tr>
        <td style="text-align:center;color:var(--muted);font-size:11px">${start + i + 1}</td>
        <td style="font-weight:500">${s.ho_ten}</td>
        <td class="td-mono">${s.mssv || '—'}</td>
        <td class="td-mono">${s.lop || '—'}</td>
        ${gradeCells}
        <td class="tc-cell">${s.totalTC}</td>
        <td>
          <div class="gpa-bar-wrap">
            <div class="gpa-bar-track"><div class="gpa-bar-fill" style="width:${pct}%;background:${gc}"></div></div>
            <span style="color:${gc};font-weight:700;font-size:13px">${s.gpa.toFixed(2)}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('pageInfo').textContent = `Hiển thị ${Math.min(start + 1, total)}–${Math.min(start + PER, total)} / ${total} sinh viên`;

  const pb = document.getElementById('pageBtns');
  pb.innerHTML = '';

  const mk = (txt, pg, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'pbtn' + (active ? ' active' : '');
    b.textContent = txt;
    b.disabled = disabled;
    b.onclick = () => { page = pg; renderTable(); };
    pb.appendChild(b);
  };

  mk('← Trước', page - 1, page === 1, false);
  for (let i = 1; i <= totalPg; i++) mk(String(i), i, false, i === page);
  mk('Sau →', page + 1, page === totalPg, false);
}

/* ============================================
   EVENT LISTENERS
   ============================================ */

document.getElementById('csvInput').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => boot(ev.target.result);
  r.readAsText(f, 'UTF-8');
});

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);

document.body.addEventListener('dragover', e => e.preventDefault());
document.body.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!f || !f.name.endsWith('.csv')) return;
  const r = new FileReader();
  r.onload = ev => boot(ev.target.result);
  r.readAsText(f, 'UTF-8');
});