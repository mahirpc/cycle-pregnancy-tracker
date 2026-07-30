
const STORAGE_KEY = 'cycle-pregnancy-tracker-state-v1';
const DEFAULT_STATE = {
  profile: {
    mode: 'cycle',
    lastPeriodStart: '',
    cycleLengthAvg: 28,
    periodLengthAvg: 5,
    birthYear: '',
    pregnancyStartDate: '',
    pregnancyStartType: 'lmp',
    units: 'metric',
    theme: 'system',
    defaultCycleLength: 28,
    defaultPeriodLength: 5,
  },
  cycleEntries: [],
  dailyLogs: [],
  pregnancy: {
    lmpDate: '',
    conceptionDate: '',
    outcome: ''
  }
};

let state = loadState();
let cycleData = null;
let pregnancyData = null;

const els = {
  modePill: document.getElementById('modePill'),
  quickStats: document.getElementById('quickStats'),
  cycleSummary: document.getElementById('cycleSummary'),
  pregnancySummary: document.getElementById('pregnancySummary'),
  currentPhase: document.getElementById('currentPhase'),
  cycleInsight: document.getElementById('cycleInsight'),
  cycleEntries: document.getElementById('cycleEntries'),
  pregnancyInsight: document.getElementById('pregnancyInsight'),
  trimesterPill: document.getElementById('trimesterPill'),
  weekSearch: document.getElementById('weekSearch'),
  weekValue: document.getElementById('weekValue'),
  weekRangeLabel: document.getElementById('weekRangeLabel'),
  weekCard: document.getElementById('weekCard'),
  trimesterCards: document.getElementById('trimesterCards'),
  avoidList: document.getElementById('avoidList'),
  journalList: document.getElementById('journalList'),
  cycleTrend: document.getElementById('cycleTrend'),
  frequencyChart: document.getElementById('frequencyChart'),
  profileForm: document.getElementById('profileForm'),
  cycleEntryForm: document.getElementById('cycleEntryForm'),
  journalForm: document.getElementById('journalForm'),
  settingsForm: document.getElementById('settingsForm'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  resetBtn: document.getElementById('resetBtn'),
};

const moodOptions = ['calm','energetic','low','weepy','irritable','anxious'];
const symptomOptions = ['cramps','bloating','headache','acne','breast tenderness','fatigue','nausea','back pain','sleep changes','spotting'];
const fmtDate = d => d ? new Date(d + 'T00:00:00') : null;
const iso = d => new Date(d).toISOString().slice(0,10);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      profile: { ...structuredClone(DEFAULT_STATE.profile), ...(parsed.profile || {}) },
      pregnancy: { ...structuredClone(DEFAULT_STATE.pregnancy), ...(parsed.pregnancy || {}) },
      cycleEntries: Array.isArray(parsed.cycleEntries) ? parsed.cycleEntries : [],
      dailyLogs: Array.isArray(parsed.dailyLogs) ? parsed.dailyLogs : [],
    };
  } catch (err) {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setTheme(theme) {
  const resolved = theme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
}

function daysBetween(a, b) {
  const start = new Date(a); start.setHours(0,0,0,0);
  const end = new Date(b); end.setHours(0,0,0,0);
  return Math.round((end - start) / 86400000);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getCycleInfo() {
  const today = new Date();
  const start = fmtDate(state.profile.lastPeriodStart);
  const cycleLen = Number(state.profile.cycleLengthAvg) || 28;
  const periodLen = Number(state.profile.periodLengthAvg) || 5;

  if (!start) return null;
  const elapsed = Math.max(0, daysBetween(start, today));
  const cycleDay = (elapsed % cycleLen) + 1;
  const nextPeriod = addDays(start, Math.ceil((elapsed / cycleLen)) * cycleLen);
  const ovulationDay = Math.max(12, Math.round(cycleLen * 14 / 28));
  const fertileStart = Math.max(1, ovulationDay - 5);
  const fertileEnd = Math.min(cycleLen, ovulationDay + 1);
  const menstrualEnd = Math.max(5, Math.round(cycleLen * 5 / 28));
  const follicularEnd = Math.max(menstrualEnd + 1, Math.round(cycleLen * 13 / 28));
  let phase = 'Luteal';
  if (cycleDay <= menstrualEnd) phase = 'Menstrual';
  else if (cycleDay === ovulationDay || Math.abs(cycleDay - ovulationDay) <= 1) phase = 'Ovulatory';
  else if (cycleDay <= follicularEnd) phase = 'Follicular';
  const phaseOrder = { Menstrual: 1, Follicular: 2, Ovulatory: 3, Luteal: 4 };

  return {
    cycleDay,
    cycleLen,
    periodLen,
    nextPeriod,
    phase,
    ovulationDay,
    fertileStart,
    fertileEnd,
    menstrualEnd,
    follicularEnd,
    daysToNextPeriod: Math.max(0, daysBetween(today, nextPeriod)),
    cycleOrder: phaseOrder[phase]
  };
}

function getPregnancyInfo() {
  const today = new Date();
  const source = state.profile.pregnancyStartType === 'conception'
    ? state.profile.pregnancyStartDate || state.pregnancy.conceptionDate
    : state.profile.pregnancyStartDate || state.pregnancy.lmpDate;
  if (!source) return null;
  const start = fmtDate(source);
  const weeksSince = Math.floor(daysBetween(start, today) / 7) + 1;
  const week = Math.min(40, Math.max(1, weeksSince));
  const due = state.profile.pregnancyStartType === 'conception'
    ? addDays(start, 266)
    : addDays(start, 280);
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  return { week, due, trimester, source };
}

function trimesterForWeek(week) {
  return week <= 13 ? 1 : week <= 27 ? 2 : 3;
}

function getWeekData(week) {
  return pregnancyData?.weeks?.find(w => Number(w.week) === Number(week));
}

function getTrimesterData(t) {
  return pregnancyData?.trimesters?.find(x => Number(x.trimester) === Number(t));
}

function render() {
  setTheme(state.profile.theme);
  document.body.dataset.mode = state.profile.mode;
  els.modePill.textContent = state.profile.mode === 'cycle' ? 'Cycle Tracking' : 'Pregnancy Tracking';
  [...document.querySelectorAll('.mode-btn')].forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.profile.mode));

  fillForms();
  renderQuickStats();
  renderOverview();
  renderCycle();
  renderPregnancy();
  renderJournal();
  renderInsights();
  renderSettings();
  saveState();
}

function fillForms() {
  document.getElementById('lastPeriodStart').value = state.profile.lastPeriodStart || '';
  document.getElementById('cycleLengthAvg').value = state.profile.cycleLengthAvg;
  document.getElementById('periodLengthAvg').value = state.profile.periodLengthAvg;
  document.getElementById('birthYear').value = state.profile.birthYear || '';
  document.getElementById('pregnancyStartDate').value = state.profile.pregnancyStartDate || '';
  document.getElementById('pregnancyStartType').value = state.profile.pregnancyStartType || 'lmp';
  document.getElementById('units').value = state.profile.units;
  document.getElementById('theme').value = state.profile.theme;
  document.getElementById('defaultCycleLength').value = state.profile.defaultCycleLength;
  document.getElementById('defaultPeriodLength').value = state.profile.defaultPeriodLength;
}

function renderQuickStats() {
  const cycle = getCycleInfo();
  const preg = getPregnancyInfo();
  const cards = [];
  cards.push(stat('Tracking mode', state.profile.mode === 'cycle' ? 'Cycle' : 'Pregnancy'));
  cards.push(stat('Theme', state.profile.theme));
  cards.push(stat('Logs', `${state.cycleEntries.length} periods · ${state.dailyLogs.length} journals`));
  cards.push(stat('Data', 'Stored locally'));
  els.quickStats.innerHTML = cards.join('');
}

function stat(label, value) {
  return `<div class="stat"><span class="label">${label}</span><strong>${value}</strong></div>`;
}

function renderOverview() {
  const cycle = getCycleInfo();
  const preg = getPregnancyInfo();

  els.cycleSummary.innerHTML = cycle ? [
    row('Current phase', cycle.phase),
    row('Cycle day', `${cycle.cycleDay} of ${cycle.cycleLen}`),
    row('Next period', iso(cycle.nextPeriod)),
    row('Fertile window', `${cycle.fertileStart}–${cycle.fertileEnd}`)
  ].join('') : `<p class="muted">Add your last period start date to see cycle predictions.</p>`;

  if (preg) {
    const data = getWeekData(preg.week);
    els.pregnancySummary.innerHTML = [
      row('Current week', `Week ${preg.week}`),
      row('Trimester', `${preg.trimester}`),
      row('Estimated due date', iso(preg.due)),
      row('Size comparison', data?.sizeComparison || 'n/a')
    ].join('');
  } else {
    els.pregnancySummary.innerHTML = `<p class="muted">Add a pregnancy start date to see week-by-week guidance.</p>`;
  }
}

function row(label, value) {
  return `<div class="row"><div><strong>${label}</strong></div><div class="meta">${value}</div></div>`;
}

function renderCycle() {
  const cycle = getCycleInfo();
  if (!cycle || !cycleData) {
    els.currentPhase.textContent = 'Set a last period date';
    els.cycleInsight.innerHTML = `<p class="muted">The app uses your last period start and average cycle length to map the current cycle day to the shipped phase reference data.</p>`;
  } else {
    const phase = cycleData.phases.find(p => p.phase === cycle.phase);
    els.currentPhase.textContent = phase.phase;
    els.cycleInsight.innerHTML = `
      <p><strong>Typical day range:</strong> ${phase.dayRange}</p>
      <p><strong>Hormone trend:</strong> ${phase.hormoneNotes}</p>
      <p><strong>Commonly reported pattern:</strong> ${phase.moodEnergyNotes}</p>
      <p><strong>Nutrition focus:</strong></p>
      <ul>
        ${phase.nutritionFocus.map(n => `<li><strong>${n.nutrient}:</strong> ${n.why} — ${n.sources.join(', ')}</li>`).join('')}
      </ul>
      <p class="footer-note">This is educational reference content only and is not a diagnosis.</p>
    `;
  }

  const sorted = [...state.cycleEntries].sort((a,b) => b.startDate.localeCompare(a.startDate));
  if (!sorted.length) {
    els.cycleEntries.innerHTML = `<p class="muted">No period entries yet.</p>`;
  } else {
    els.cycleEntries.innerHTML = sorted.map(entry => `
      <div class="row">
        <div>
          <strong>${entry.startDate} → ${entry.endDate}</strong>
          <div class="meta">Flow: ${entry.flowLevel} · Spotting: ${entry.spotting === 'yes' ? 'yes' : 'no'}</div>
          ${entry.notes ? `<div class="meta">${entry.notes}</div>` : ''}
        </div>
      </div>
    `).join('');
  }
}

function renderPregnancy() {
  const preg = getPregnancyInfo();
  if (!preg) {
    els.trimesterPill.textContent = 'Add a start date';
    els.pregnancyInsight.innerHTML = `<p class="muted">Use the pregnancy start date field to calculate the current week and due date. The week browser still shows the reference dataset below.</p>`;
  } else {
    const weekData = getWeekData(preg.week);
    const triData = getTrimesterData(preg.trimester);
    els.trimesterPill.textContent = `Trimester ${preg.trimester}`;
    els.pregnancyInsight.innerHTML = `
      <p><strong>Estimated due date:</strong> ${iso(preg.due)}</p>
      <p><strong>Current week:</strong> Week ${preg.week}</p>
      <p><strong>Hormone shifts:</strong> ${triData.hormoneNotes}</p>
      <p><strong>Commonly reported patterns:</strong> ${triData.moodPhysicalNotes}</p>
      <p><strong>Week highlight:</strong> ${weekData?.milestones?.join(' ') || 'No week data found.'}</p>
    `;
  }

  const weekNum = Number(els.weekSearch.value);
  const weekData = getWeekData(weekNum);
  const tri = trimesterForWeek(weekNum);
  const trimesterData = getTrimesterData(tri);
  els.weekValue.textContent = weekNum;
  els.weekRangeLabel.textContent = trimesterData?.weekRange || '';
  els.weekCard.innerHTML = weekData ? `
    <h3>Week ${weekData.week}</h3>
    <p><strong>Trimester:</strong> ${weekData.trimester}</p>
    <p><strong>Size comparison:</strong> ${weekData.sizeComparison}</p>
    <p><strong>Milestone:</strong> ${weekData.milestones.join(' ')}</p>
    <p class="muted">Trimester reference: ${trimesterData?.hormoneNotes || ''}</p>
  ` : `<p class="muted">No week data available.</p>`;

  els.trimesterCards.innerHTML = (pregnancyData?.trimesters || []).map(t => `
    <article class="card" style="box-shadow:none">
      <h3>Trimester ${t.trimester} · Weeks ${t.weekRange}</h3>
      <p><strong>Hormones:</strong> ${t.hormoneNotes}</p>
      <p><strong>Common patterns:</strong> ${t.moodPhysicalNotes}</p>
      <p><strong>Nutrition focus:</strong></p>
      <ul>
        ${t.nutritionFocus.map(n => `<li><strong>${n.nutrient}:</strong> ${n.why}</li>`).join('')}
      </ul>
      <p class="muted">${t.generalTips}</p>
    </article>
  `).join('');

  els.avoidList.innerHTML = (pregnancyData?.avoidList || []).map(item => `<span class="chip">${item.item}</span>`).join('');
}

function renderJournal() {
  const sorted = [...state.dailyLogs].sort((a,b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    els.journalList.innerHTML = `<p class="muted">No journal entries yet.</p>`;
    return;
  }
  els.journalList.innerHTML = sorted.slice(0, 20).map(entry => `
    <div class="row">
      <div>
        <strong>${entry.date}</strong>
        <div class="meta">Mood: ${entry.moodTag} · Symptoms: ${entry.symptoms.join(', ') || 'none'}</div>
        ${entry.note ? `<div class="meta">${entry.note}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderInsights() {
  const cycleLengths = [];
  const sortedPeriods = [...state.cycleEntries].sort((a,b) => a.startDate.localeCompare(b.startDate));
  for (let i = 1; i < sortedPeriods.length; i++) {
    const prev = fmtDate(sortedPeriods[i-1].startDate);
    const cur = fmtDate(sortedPeriods[i].startDate);
    if (prev && cur) cycleLengths.push({ label: `${sortedPeriods[i-1].startDate} → ${sortedPeriods[i].startDate}`, value: daysBetween(prev, cur) });
  }
  renderBars(els.cycleTrend, cycleLengths.length ? cycleLengths : [{ label: 'No cycle history yet', value: 0 }], 'days');

  const counts = new Map();
  [...state.dailyLogs].forEach(entry => {
    counts.set(entry.moodTag, (counts.get(entry.moodTag) || 0) + 1);
    entry.symptoms.forEach(s => counts.set(s, (counts.get(s) || 0) + 1));
  });
  const freq = [...counts.entries()].sort((a,b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  renderBars(els.frequencyChart, freq.length ? freq : [{ label: 'No logs yet', value: 0 }], 'entries');
}

function renderBars(container, items, suffix) {
  const max = Math.max(1, ...items.map(i => i.value));
  container.innerHTML = items.map(item => `
    <div class="bar-row">
      <div class="bar-top"><span>${item.label}</span><span>${item.value} ${suffix}</span></div>
      <div class="bar"><span style="width:${Math.max(4, (item.value / max) * 100)}%"></span></div>
    </div>
  `).join('');
}

function renderSettings() {
  // forms are filled in fillForms
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.profile.mode = btn.dataset.mode;
      render();
    });
  });

  els.profileForm.addEventListener('submit', e => {
    e.preventDefault();
    state.profile.lastPeriodStart = document.getElementById('lastPeriodStart').value;
    state.profile.cycleLengthAvg = Number(document.getElementById('cycleLengthAvg').value) || 28;
    state.profile.periodLengthAvg = Number(document.getElementById('periodLengthAvg').value) || 5;
    state.profile.birthYear = document.getElementById('birthYear').value;
    state.profile.pregnancyStartDate = document.getElementById('pregnancyStartDate').value;
    state.profile.pregnancyStartType = document.getElementById('pregnancyStartType').value;
    render();
  });

  els.cycleEntryForm.addEventListener('submit', e => {
    e.preventDefault();
    state.cycleEntries.push({
      id: crypto.randomUUID(),
      startDate: document.getElementById('cycleStartDate').value,
      endDate: document.getElementById('cycleEndDate').value,
      flowLevel: document.getElementById('flowLevel').value,
      spotting: document.getElementById('spotting').value,
      notes: document.getElementById('cycleNotes').value.trim()
    });
    e.target.reset();
    render();
  });

  els.journalForm.addEventListener('submit', e => {
    e.preventDefault();
    const symptoms = document.getElementById('symptoms').value.split(',').map(s => s.trim()).filter(Boolean);
    state.dailyLogs.push({
      id: crypto.randomUUID(),
      date: document.getElementById('journalDate').value,
      moodTag: document.getElementById('moodTag').value,
      symptoms,
      note: document.getElementById('journalNote').value.trim()
    });
    e.target.reset();
    render();
  });

  els.settingsForm.addEventListener('submit', e => {
    e.preventDefault();
    state.profile.units = document.getElementById('units').value;
    state.profile.theme = document.getElementById('theme').value;
    state.profile.defaultCycleLength = Number(document.getElementById('defaultCycleLength').value) || 28;
    state.profile.defaultPeriodLength = Number(document.getElementById('defaultPeriodLength').value) || 5;
    state.profile.cycleLengthAvg = state.profile.defaultCycleLength;
    state.profile.periodLengthAvg = state.profile.defaultPeriodLength;
    render();
  });

  els.weekSearch.addEventListener('input', renderPregnancy);

  els.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cycle-pregnancy-tracker-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.importInput.addEventListener('change', async () => {
    const file = els.importInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      state = {
        ...structuredClone(DEFAULT_STATE),
        ...imported,
        profile: { ...structuredClone(DEFAULT_STATE.profile), ...(imported.profile || {}) },
        pregnancy: { ...structuredClone(DEFAULT_STATE.pregnancy), ...(imported.pregnancy || {}) },
        cycleEntries: Array.isArray(imported.cycleEntries) ? imported.cycleEntries : [],
        dailyLogs: Array.isArray(imported.dailyLogs) ? imported.dailyLogs : [],
      };
      render();
    } catch {
      alert('That file is not a valid export.');
    } finally {
      els.importInput.value = '';
    }
  });

  els.resetBtn.addEventListener('click', () => {
    if (confirm('Delete all local data from this browser? This cannot be undone.')) {
      state = structuredClone(DEFAULT_STATE);
      localStorage.removeItem(STORAGE_KEY);
      render();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (state.profile.theme === 'system') setTheme('system');
  });
}

async function init() {
  const [cycleResp, pregResp] = await Promise.all([
    fetch('data/cycle-phase-data.json'),
    fetch('data/pregnancy-weekly-data.json'),
  ]);
  cycleData = await cycleResp.json();
  pregnancyData = await pregResp.json();

  bindEvents();
  els.weekSearch.value = 1;

  // initialize some date defaults for convenience
  const today = iso(new Date());
  document.getElementById('lastPeriodStart').placeholder = today;
  document.getElementById('pregnancyStartDate').placeholder = today;
  document.getElementById('cycleStartDate').value = today;
  document.getElementById('cycleEndDate').value = today;
  document.getElementById('journalDate').value = today;

  render();
}

init();
