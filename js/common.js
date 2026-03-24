const STORAGE_KEYS = {
  current: 'dashboard_projects',
  previous: 'previous_projects_data',
};

const FALLBACK_TEAM_MEMBERS = {
  "공통": [{ "name": "신혜영", "role": "책임연구원/팀장", "isLeader": true }],
  "UX": [
    { "name": "정은혜", "role": "책임연구원" },
    { "name": "채선영", "role": "선임연구원" },
    { "name": "김수현", "role": "선임연구원" },
    { "name": "허유나", "role": "선임연구원" },
    { "name": "김정석", "role": "연구원" }
  ],
  "3D/영상": [
    { "name": "김태식", "role": "책임연구원" },
    { "name": "최영환", "role": "선임연구원" },
    { "name": "정두휘", "role": "연구원" },
    { "name": "박지영", "role": "연구원" },
    { "name": "권순호", "role": "연구원" },
    { "name": "양숙영", "role": "연구원" }
  ],
  "편집": [
    { "name": "마희연", "role": "선임연구원" },
    { "name": "최혜은", "role": "선임연구원" },
    { "name": "윤봄이", "role": "선임연구원" },
    { "name": "정지윤", "role": "연구원" },
    { "name": "이예진", "role": "선임연구원" }
  ]
};

const FALLBACK_PROJECTS = [];

export const CELL_ORDER = ['공통', 'UX', '3D/영상', '편집'];
export const STATUS_OPTIONS = ['All', '진행 중', '완료', '시작 전', '지연됨'];
export const PRIORITY_OPTIONS = ['All', '긴급', '높음', '중간', '낮음', '기타'];
export const MONTH_OPTIONS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
export const WEEK_OPTIONS = ['1주차', '2주차', '3주차', '4주차'];

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function loadTeamMembers() {
  return await loadJson('data/team-members.json', FALLBACK_TEAM_MEMBERS);
}

export async function loadDefaultProjects() {
  const projects = await loadJson('data/default-projects.json', FALLBACK_PROJECTS);
  return Array.isArray(projects) ? projects.map(normalizeProject) : [];
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('Fetch failed');
    return await response.json();
  } catch (error) {
    return structuredClone(fallback);
  }
}

export function getStoredProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.current);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeProject) : null;
  } catch (error) {
    return null;
  }
}

export function getPreviousProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.previous);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeProject) : [];
  } catch (error) {
    return [];
  }
}

export function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(projects.map(normalizeProject)));
}

export function savePreviousProjects(projects) {
  localStorage.setItem(STORAGE_KEYS.previous, JSON.stringify(projects.map(normalizeProject)));
}

export function showToast(message, timeout = 2200) {
  const toast = qs('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), timeout);
}

export function normalizeProject(project = {}) {
  const normalized = {
    id: project.id || generateId(),
    name: String(project.name || '제목 없음').trim(),
    cell: normalizeCell(project.cell),
    pm: String(project.pm || '미지정').trim(),
    priority: normalizePriority(project.priority),
    status: normalizeStatus(project.status),
    progress: clamp(Number(project.progress) || 0, 0, 100),
    startDate: normalizeDate(project.startDate),
    endDate: normalizeDate(project.endDate),
    month: normalizeMonth(project.month || project.quarter),
    description: String(project.description || '').trim(),
    scope: String(project.scope || '').trim(),
    ceoFeedback: String(project.ceoFeedback || '').trim(),
    deptFeedback: String(project.deptFeedback || '').trim(),
    pmFeedback: String(project.pmFeedback || '').trim(),
    feedbackResponse: String(project.feedbackResponse || '').trim(),
    collaborationTeam: String(project.collaborationTeam || '').trim(),
    seminarNotes: String(project.seminarNotes || '').trim(),
    memberNotes: String(project.memberNotes || '').trim(),
    resourcePlan: String(project.resourcePlan || '').trim(),
    docPlan: String(project.docPlan || '').trim(),
    url: String(project.url || '').trim(),
    members: normalizeMembers(project.members),
  };
  if (normalized.status === '완료') normalized.progress = 100;
  if (normalized.status === '시작 전' && normalized.progress === 0) normalized.progress = 0;
  return normalized;
}

export function normalizeMembers(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') return parseMemberText(item);
        return { name: String(item.name || '').trim(), role: String(item.role || '').trim() };
      })
      .filter(item => item.name);
  }
  if (typeof value === 'string') return parseMembersField(value);
  return [];
}

export function parseMembersField(value = '') {
  return String(value)
    .split(',')
    .map(item => parseMemberText(item))
    .filter(item => item.name);
}

function parseMemberText(text = '') {
  const raw = String(text).trim();
  if (!raw) return { name: '', role: '' };
  if (raw.includes(':')) {
    const [name, ...rest] = raw.split(':');
    return { name: name.trim(), role: rest.join(':').trim() };
  }
  if (raw.includes('(') && raw.includes(')')) {
    const idx = raw.indexOf('(');
    return { name: raw.slice(0, idx).trim(), role: raw.slice(idx + 1).replace(/\)+$/, '').trim() };
  }
  return { name: raw, role: '' };
}

export function normalizeCell(cell = '') {
  const value = String(cell || '').trim().toLowerCase();
  if (!value) return '공통';
  if (value.includes('3d') || value.includes('영상')) return '3D/영상';
  if (value.includes('ux')) return 'UX';
  if (value.includes('편집')) return '편집';
  if (value.includes('공통')) return '공통';
  return '공통';
}

export function normalizePriority(priority = '') {
  return ['긴급', '높음', '중간', '낮음', '기타'].includes(priority) ? priority : '기타';
}

export function normalizeStatus(status = '') {
  return ['시작 전', '진행 중', '완료', '지연됨'].includes(status) ? status : '시작 전';
}

export function normalizeMonth(value = '') {
  const v = String(value || '').trim();
  if (MONTH_OPTIONS.includes(v)) return v;
  const quarterMap = { '1분기': '3월', '2분기': '6월', '3분기': '9월', '4분기': '12월' };
  return quarterMap[v] || '1월';
}

export function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return new Date().toISOString().slice(0, 10);
}

export function groupByCell(projects = []) {
  const grouped = Object.fromEntries(CELL_ORDER.map(cell => [cell, []]));
  projects.forEach(project => {
    const cell = normalizeCell(project.cell);
    grouped[cell].push(normalizeProject(project));
  });
  return grouped;
}

export function getCellMeta(cell) {
  switch (cell) {
    case 'UX':
      return { key: 'ux', icon: '🧩', badge: 'badge--blue', color: '#2563eb' };
    case '3D/영상':
      return { key: '3d', icon: '🎬', badge: 'badge--purple', color: '#7c3aed' };
    case '편집':
      return { key: 'edit', icon: '✏️', badge: 'badge--emerald', color: '#059669' };
    default:
      return { key: 'common', icon: '👥', badge: 'badge--indigo', color: '#4f46e5' };
  }
}

export function getStatusMeta(status) {
  switch (status) {
    case '완료': return { text: '완료', badge: 'badge--emerald', color: '#059669' };
    case '지연됨': return { text: '지연됨', badge: 'badge--red', color: '#dc2626' };
    case '시작 전': return { text: '시작 전', badge: 'badge--gray', color: '#94a3b8' };
    default: return { text: '진행 중', badge: 'badge--blue', color: '#2563eb' };
  }
}

export function getPriorityBadge(priority) {
  switch (priority) {
    case '긴급': return 'badge--red';
    case '높음': return 'badge--amber';
    case '중간': return 'badge--indigo';
    case '낮음': return 'badge--blue';
    default: return 'badge--gray';
  }
}

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function openDashboard(cell) {
  const url = new URL('dashboard.html', window.location.href);
  if (cell) url.searchParams.set('cell', cell);
  window.location.href = url.toString();
}

export function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function setSelectOptions(selectEl, options, currentValue) {
  if (!selectEl) return;
  selectEl.innerHTML = options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
  if (currentValue != null) selectEl.value = currentValue;
}

export function formatDateRange(project) {
  const start = normalizeDate(project.startDate).slice(5).replace('-', '.');
  const end = normalizeDate(project.endDate).slice(5).replace('-', '.');
  return `${start} ~ ${end}`;
}

export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      const meaningful = row.some(item => String(item || '').trim() !== '');
      if (meaningful) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    const meaningful = row.some(item => String(item || '').trim() !== '');
    if (meaningful) rows.push(row);
  }

  if (!rows.length) return [];

  const headerRow = rows.shift().map(header => normalizeHeader(header));
  return rows
    .map(values => Object.fromEntries(headerRow.map((header, index) => [header, String(values[index] || '').trim()])))
    .filter(rowObj => Object.values(rowObj).some(value => String(value).trim() !== ''));
}

function normalizeHeader(header = '') {
  return String(header)
    .replace(/\uFEFF/g, '')
    .split('(')[0]
    .trim();
}

export function rowsToProjects(rows = []) {
  return rows
    .filter(row => row.name && String(row.name).trim())
    .map(row => normalizeProject({
      id: row.id,
      name: row.name,
      cell: row.cell,
      pm: row.pm,
      priority: row.priority,
      status: row.status,
      progress: row.progress,
      startDate: row.startDate,
      endDate: row.endDate,
      month: row.month || row.quarter,
      description: row.description,
      scope: row.scope,
      ceoFeedback: row.ceoFeedback,
      deptFeedback: row.deptFeedback,
      pmFeedback: row.pmFeedback,
      feedbackResponse: row.feedbackResponse,
      collaborationTeam: row.collaborationTeam,
      seminarNotes: row.seminarNotes,
      memberNotes: row.memberNotes,
      resourcePlan: row.resourcePlan,
      docPlan: row.docPlan,
      url: row.url,
      members: row.members,
    }));
}

export async function readCsvFile(file) {
  const text = await readTextFile(file, 'euc-kr').catch(() => readTextFile(file, 'utf-8'));
  const cleanedText = text
    .split(/\r?\n/)
    .filter(line => line.trim().replace(/,/g, '') !== '')
    .join('\n');
  return rowsToProjects(parseCsvText(cleanedText));
}

function readTextFile(file, encoding) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('File read error'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file, encoding);
  });
}

export function matchPreviousProject(currentProject, previousProjects = []) {
  if (!currentProject) return null;
  return previousProjects.find(project => project.id === currentProject.id)
    || previousProjects.find(project => String(project.name).trim() === String(currentProject.name).trim())
    || null;
}

export function createInsightItems(currentProject, previousProject) {
  const items = [];
  if (previousProject) {
    const diff = (currentProject.progress || 0) - (previousProject.progress || 0);
    if (diff > 0) {
      items.push({
        title: `진행률 ${diff}% 증가`,
        body: `지난 주 대비 진행률이 ${diff}%p 상승했습니다. 현재 일정 흐름은 양호합니다.`,
      });
    } else if (diff < 0) {
      items.push({
        title: `진행률 ${Math.abs(diff)}% 감소`,
        body: `지난 주 대비 진행률이 하락했습니다. 일정 지연 요소와 리소스 배분을 다시 확인하는 것이 좋습니다.`,
      });
    } else {
      items.push({
        title: `진행률 변동 없음`,
        body: `지난 주와 동일한 진행률입니다. 이번 주 산출물이나 의사결정 포인트를 추가로 기록해두면 좋습니다.`,
      });
    }

    if ((currentProject.ceoFeedback || '').trim()) {
      items.push({
        title: '피드백 대응 필요',
        body: '사장님 피드백이 등록되어 있습니다. 대응안과 후속 조치 일정을 함께 정리해두세요.',
      });
    }

    const prevCount = previousProject.members?.length || 0;
    const currCount = currentProject.members?.length || 0;
    if (currCount > prevCount) {
      items.push({
        title: '참여 인원 증가',
        body: `참여 인원이 ${prevCount}명에서 ${currCount}명으로 늘었습니다. 역할과 책임을 명확히 정리해두는 것이 좋습니다.`,
      });
    }
  } else {
    items.push({
      title: '비교 데이터 없음',
      body: '이전 주차 CSV를 업로드하면 주간 변화 분석을 함께 볼 수 있습니다.',
    });
  }

  if (currentProject.status === '지연됨') {
    items.push({
      title: '지연 리스크 관리',
      body: '현재 상태가 지연됨으로 표시되어 있습니다. 병목 원인과 일정 회복 계획을 함께 기록해두세요.',
    });
  }

  if (currentProject.status === '완료') {
    items.push({
      title: '완료 단계',
      body: '완료된 프로젝트입니다. 산출물 정리와 후속 공유 문서를 체크하면 좋습니다.',
    });
  }

  if (!items.length) {
    items.push({
      title: '주간 메모 권장',
      body: '이번 주 변경점이 있다면 피드백, 문서화 계획, 리소스 계획을 채워두면 다음 주 비교에 도움이 됩니다.',
    });
  }

  return items.slice(0, 4);
}
