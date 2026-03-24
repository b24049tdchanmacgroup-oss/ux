import {
  CELL_ORDER,
  MONTH_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  WEEK_OPTIONS,
  clamp,
  createInsightItems,
  escapeHtml,
  formatDateRange,
  getCellMeta,
  getPriorityBadge,
  getQueryParam,
  getStatusMeta,
  getStoredProjects,
  getPreviousProjects,
  loadDefaultProjects,
  matchPreviousProject,
  openDashboard,
  qs,
  qsa,
  saveProjects,
  setSelectOptions,
  showToast,
  normalizeProject,
} from './common.js';

let state = {
  projects: [],
  previousProjects: [],
  filters: {
    cell: 'All',
    status: 'All',
    priority: 'All',
    pm: 'All',
  },
  month: '3월',
  week: '4주차',
  expanded: false,
  selectedId: null,
  editingProject: null,
};

async function init() {
  const defaults = await loadDefaultProjects();
  state.projects = getStoredProjects() || defaults;
  state.previousProjects = getPreviousProjects();
  const requestedCell = getQueryParam('cell');
  if (requestedCell && CELL_ORDER.includes(requestedCell)) state.filters.cell = requestedCell;

  setupControls();
  render();
}

function setupControls() {
  setSelectOptions(qs('#month-select'), MONTH_OPTIONS, state.month);
  setSelectOptions(qs('#week-select'), WEEK_OPTIONS, state.week);
  setSelectOptions(qs('#filter-cell'), ['All', ...CELL_ORDER.filter(Boolean)], state.filters.cell);
  setSelectOptions(qs('#filter-status'), STATUS_OPTIONS, state.filters.status);
  setSelectOptions(qs('#filter-priority'), PRIORITY_OPTIONS, state.filters.priority);
  setSelectOptions(qs('#filter-pm'), buildPmOptions(), state.filters.pm);

  qs('#month-select')?.addEventListener('change', e => { state.month = e.target.value; refreshModalLabels(); });
  qs('#week-select')?.addEventListener('change', e => { state.week = e.target.value; refreshModalLabels(); });
  qs('#filter-cell')?.addEventListener('change', e => { state.filters.cell = e.target.value; renderProjects(); });
  qs('#filter-status')?.addEventListener('change', e => { state.filters.status = e.target.value; renderProjects(); });
  qs('#filter-priority')?.addEventListener('change', e => { state.filters.priority = e.target.value; renderProjects(); });
  qs('#filter-pm')?.addEventListener('change', e => { state.filters.pm = e.target.value; renderProjects(); });
  qs('#toggle-more')?.addEventListener('click', () => {
    state.expanded = !state.expanded;
    renderProjects();
  });
  qs('#save-project-btn')?.addEventListener('click', saveModalProject);

  qsa('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
}

function buildPmOptions() {
  return ['All', ...new Set(state.projects.map(project => project.pm).filter(Boolean))];
}

function render() {
  setSelectOptions(qs('#filter-pm'), buildPmOptions(), state.filters.pm);
  renderProjects();
  refreshModalLabels();
}

function getFilteredProjects() {
  return state.projects.filter(project => {
    if (state.filters.cell !== 'All' && project.cell !== state.filters.cell) return false;
    if (state.filters.status !== 'All' && project.status !== state.filters.status) return false;
    if (state.filters.priority !== 'All' && project.priority !== state.filters.priority) return false;
    if (state.filters.pm !== 'All' && project.pm !== state.filters.pm) return false;
    return true;
  });
}

function renderProjects() {
  const projects = getFilteredProjects();
  const displayed = state.expanded ? projects : projects.slice(0, 8);
  const container = qs('#projects-grid');
  const counter = qs('#project-count');
  if (counter) counter.textContent = String(projects.length);

  if (!container) return;
  if (!projects.length) {
    container.innerHTML = `<div class="empty-state">선택한 조건에 맞는 프로젝트가 없습니다.</div>`;
    qs('#more-wrap')?.classList.add('hidden');
    return;
  }

  container.innerHTML = displayed.map(project => renderProjectCard(project)).join('');
  bindProjectCardEvents();

  const moreWrap = qs('#more-wrap');
  const toggleMore = qs('#toggle-more');
  if (projects.length > 8) {
    moreWrap?.classList.remove('hidden');
    if (toggleMore) toggleMore.textContent = state.expanded ? '접기' : `나머지 ${projects.length - 8}개 더보기`;
  } else {
    moreWrap?.classList.add('hidden');
  }
}

function renderProjectCard(project) {
  const status = getStatusMeta(project.status);
  const cellMeta = getCellMeta(project.cell);
  const circleColor = status.color;

  return `
    <article class="project-card" data-project-id="${project.id}">
      <div class="project-card__top">
        <div class="priority-wrap">
          <span class="badge ${getPriorityBadge(project.priority)}">${project.priority}</span>
          <select data-field="priority" data-id="${project.id}">
            ${['긴급', '높음', '중간', '낮음', '기타'].map(value => `<option value="${value}" ${project.priority === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div class="status-wrap">
          <span class="badge ${status.badge}">${status.text}</span>
          <select data-field="status" data-id="${project.id}">
            ${['시작 전', '진행 중', '지연됨', '완료'].map(value => `<option value="${value}" ${project.status === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
      </div>

      <textarea class="project-name" data-field="name" data-id="${project.id}">${escapeHtml(project.name)}</textarea>

      <div class="pm-row">
        <div class="pm-avatar">${escapeHtml((project.pm || '?').charAt(0))}</div>
        <input type="text" value="${escapeHtml(project.pm)}" data-field="pm" data-id="${project.id}" />
        <span class="badge ${cellMeta.badge}">${project.cell}</span>
      </div>

      <div class="progress-circle" style="--value:${project.progress}; --color:${circleColor}">
        <div class="progress-circle__inner">
          <div>
            <input class="progress-input" type="text" inputmode="numeric" value="${project.progress}" data-field="progress" data-id="${project.id}" />
            <span style="font-weight:900; color:${circleColor}">%</span>
          </div>
        </div>
      </div>

      <div class="project-card__bottom">
        <div>${formatDateRange(project)}</div>
        <button class="button button--ghost" type="button" data-open-modal="${project.id}">상세보기</button>
      </div>
    </article>
  `;
}

function bindProjectCardEvents() {
  qsa('[data-field]').forEach(input => {
    input.addEventListener('change', handleInlineChange);
    if (input.dataset.field === 'progress') input.addEventListener('input', handleInlineChange);
  });
  qsa('[data-open-modal]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openModal(button.dataset.openModal);
  }));
  qsa('.project-card').forEach(card => card.addEventListener('click', event => {
    if (event.target.closest('input, textarea, select, button')) return;
    openModal(card.dataset.projectId);
  }));
}

function handleInlineChange(event) {
  const { id, field } = event.target.dataset;
  const project = state.projects.find(item => item.id === id);
  if (!project) return;

  let value = event.target.value;
  if (field === 'progress') {
    value = String(value).replace(/[^0-9]/g, '');
    value = value === '' ? '0' : value;
    value = String(clamp(Number(value), 0, 100));
    event.target.value = value;
  }

  project[field] = field === 'progress' ? Number(value) : value;

  if (field === 'status') {
    if (value === '완료') project.progress = 100;
    if (value === '시작 전') project.progress = 0;
  }

  if (field === 'progress') {
    if (project.progress === 100) project.status = '완료';
    else if (project.progress === 0 && project.status !== '지연됨') project.status = '시작 전';
    else if (project.status !== '지연됨') project.status = '진행 중';
  }

  state.projects = state.projects.map(item => item.id === project.id ? normalizeProject(project) : item);
  saveProjects(state.projects);
  render();
}

function openModal(projectId) {
  const project = state.projects.find(item => item.id === projectId);
  if (!project) return;
  state.selectedId = projectId;
  state.editingProject = structuredClone(project);
  qs('#modal-project-title').textContent = project.name;
  qs('#project-modal')?.classList.remove('hidden');
  refreshModalLabels();
  renderModalPanels();
}

function closeModal() {
  state.selectedId = null;
  state.editingProject = null;
  qs('#project-modal')?.classList.add('hidden');
}

function refreshModalLabels() {
  const currentTitle = qs('#current-title');
  const previousTitle = qs('#previous-title');
  if (currentTitle) currentTitle.textContent = `${state.month} ${state.week}`;
  if (previousTitle) {
    const weekNumber = Number(state.week.replace(/[^0-9]/g, '')) || 1;
    const prevWeek = weekNumber > 1 ? `${weekNumber - 1}주차` : '4주차';
    previousTitle.textContent = `${state.month} ${prevWeek} (이전)`;
  }
}

function renderModalPanels() {
  const project = state.editingProject;
  if (!project) return;

  const previousProject = matchPreviousProject(project, state.previousProjects);
  qs('#previous-project-panel').innerHTML = previousProject ? renderReadonlyProject(previousProject) : `<div class="empty-state">이전 주차 CSV가 없거나 동일한 프로젝트를 찾지 못했습니다.</div>`;
  qs('#current-project-panel').innerHTML = renderEditableProject(project);
  qs('#insights-panel').innerHTML = createInsightItems(project, previousProject)
    .map(item => `<article class="insight-card"><div class="insight-card__title">${item.title}</div><div class="insight-card__body">${item.body}</div></article>`)
    .join('');

  bindModalFormEvents();
}

function renderReadonlyProject(project) {
  return `
    <article class="detail-card readonly">
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-item__label">PM</span><div class="detail-value">${project.pm}</div></div>
        <div class="detail-item"><span class="detail-item__label">진행률</span><div class="detail-value">${project.progress}%</div></div>
        <div class="detail-item"><span class="detail-item__label">상태</span><div class="detail-value">${project.status}</div></div>
        <div class="detail-item"><span class="detail-item__label">우선순위</span><div class="detail-value">${project.priority}</div></div>
      </div>
    </article>
    <article class="detail-card readonly">
      <h5>첨부문서 및 참고자료</h5>
      ${project.url ? `<a class="link-preview" href="${escapeHtml(project.url)}" target="_blank" rel="noreferrer">🔗 ${escapeHtml(project.url)}</a>` : `<div class="muted">등록된 링크가 없습니다.</div>`}
    </article>
    <article class="detail-card readonly">
      <h5>배경 및 목적</h5>
      <div class="detail-value">${nl2br(project.description) || '<span class="muted">기록 없음</span>'}</div>
    </article>
    <article class="detail-card readonly">
      <h5>업무범위</h5>
      <div class="detail-value">${nl2br(project.scope) || '<span class="muted">기록 없음</span>'}</div>
    </article>
    <article class="detail-card readonly">
      <h5>피드백 내용</h5>
      <div class="detail-value"><strong>사장님</strong> ${project.ceoFeedback || '-'}</div>
      <div class="detail-value" style="margin-top:8px;"><strong>대응안</strong> ${project.feedbackResponse || '-'}</div>
    </article>
    <article class="detail-card readonly">
      <h5>역할 및 책임</h5>
      <div class="members-view">
        ${(project.members || []).length
          ? project.members.map(member => `<div class="detail-value"><strong>${member.name}</strong> · ${member.role || '역할 미지정'}</div>`).join('')
          : '<span class="muted">등록된 팀원이 없습니다.</span>'}
      </div>
    </article>
  `;
}

function renderEditableProject(project) {
  return `
    <article class="detail-card">
      <div class="detail-grid">
        <label class="detail-item"><span class="detail-item__label">프로젝트명</span><input type="text" data-modal-field="name" value="${escapeHtml(project.name)}" /></label>
        <label class="detail-item"><span class="detail-item__label">PM</span><input type="text" data-modal-field="pm" value="${escapeHtml(project.pm)}" /></label>
        <label class="detail-item"><span class="detail-item__label">우선순위</span>
          <select data-modal-field="priority">${['긴급', '높음', '중간', '낮음', '기타'].map(value => `<option value="${value}" ${project.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select>
        </label>
        <label class="detail-item"><span class="detail-item__label">상태</span>
          <select data-modal-field="status">${['시작 전', '진행 중', '지연됨', '완료'].map(value => `<option value="${value}" ${project.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select>
        </label>
        <label class="detail-item"><span class="detail-item__label">진행률</span><input type="number" min="0" max="100" data-modal-field="progress" value="${project.progress}" /></label>
        <label class="detail-item"><span class="detail-item__label">셀</span><select data-modal-field="cell">${CELL_ORDER.map(value => `<option value="${value}" ${project.cell === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label class="detail-item"><span class="detail-item__label">시작일</span><input type="date" data-modal-field="startDate" value="${project.startDate}" /></label>
        <label class="detail-item"><span class="detail-item__label">종료일</span><input type="date" data-modal-field="endDate" value="${project.endDate}" /></label>
      </div>
    </article>
    <article class="detail-card">
      <h5>첨부문서 및 참고자료</h5>
      <input type="text" placeholder="https://" data-modal-field="url" value="${escapeHtml(project.url || '')}" />
    </article>
    <article class="detail-card">
      <h5>배경 및 목적</h5>
      <textarea rows="6" data-modal-field="description">${escapeHtml(project.description || '')}</textarea>
    </article>
    <article class="detail-card">
      <h5>업무범위</h5>
      <textarea rows="6" data-modal-field="scope">${escapeHtml(project.scope || '')}</textarea>
    </article>
    <article class="detail-card">
      <h5>피드백 및 대응</h5>
      <div class="stack" style="gap:10px;">
        <label class="detail-item"><span class="detail-item__label">사장님 피드백</span><textarea rows="4" data-modal-field="ceoFeedback">${escapeHtml(project.ceoFeedback || '')}</textarea></label>
        <label class="detail-item"><span class="detail-item__label">대응안</span><textarea rows="4" data-modal-field="feedbackResponse">${escapeHtml(project.feedbackResponse || '')}</textarea></label>
      </div>
    </article>
    <article class="detail-card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
        <h5>역할 및 책임</h5>
        <button type="button" class="button button--ghost" id="add-member-btn">팀원 추가</button>
      </div>
      <div class="members-editor" id="members-editor">
        ${renderMemberEditorRows(project.members || [])}
      </div>
    </article>
  `;
}

function renderMemberEditorRows(members) {
  const rows = members.length ? members : [{ name: '', role: '' }];
  return rows.map((member, index) => `
    <div class="member-edit-row" data-member-index="${index}">
      <input type="text" placeholder="이름" data-member-field="name" value="${escapeHtml(member.name || '')}" />
      <input type="text" placeholder="담당 업무" data-member-field="role" value="${escapeHtml(member.role || '')}" />
      <button type="button" class="button button--danger" data-remove-member="${index}">삭제</button>
    </div>
  `).join('');
}

function bindModalFormEvents() {
  qsa('[data-modal-field]').forEach(input => input.addEventListener('input', handleModalFieldChange));
  qs('#add-member-btn')?.addEventListener('click', () => {
    state.editingProject.members.push({ name: '', role: '' });
    renderModalPanels();
  });
  qsa('[data-remove-member]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.removeMember);
    state.editingProject.members.splice(index, 1);
    renderModalPanels();
  }));
  qsa('[data-member-index]').forEach(row => {
    const index = Number(row.dataset.memberIndex);
    row.querySelector('[data-member-field="name"]')?.addEventListener('input', event => {
      state.editingProject.members[index].name = event.target.value;
    });
    row.querySelector('[data-member-field="role"]')?.addEventListener('input', event => {
      state.editingProject.members[index].role = event.target.value;
    });
  });
}

function handleModalFieldChange(event) {
  const field = event.target.dataset.modalField;
  if (!field || !state.editingProject) return;
  let value = event.target.value;
  if (field === 'progress') value = clamp(Number(value || 0), 0, 100);
  state.editingProject[field] = value;

  if (field === 'status') {
    if (value === '완료') state.editingProject.progress = 100;
    if (value === '시작 전') state.editingProject.progress = 0;
  }

  if (field === 'progress') {
    if (Number(value) === 100) state.editingProject.status = '완료';
    else if (Number(value) === 0 && state.editingProject.status !== '지연됨') state.editingProject.status = '시작 전';
    else if (state.editingProject.status !== '지연됨') state.editingProject.status = '진행 중';
  }
}

function saveModalProject() {
  if (!state.editingProject || !state.selectedId) return;
  const cleanedMembers = (state.editingProject.members || [])
    .map(member => ({ name: String(member.name || '').trim(), role: String(member.role || '').trim() }))
    .filter(member => member.name);
  state.editingProject.members = cleanedMembers;
  const normalized = normalizeProject(state.editingProject);
  state.projects = state.projects.map(project => project.id === state.selectedId ? normalized : project);
  saveProjects(state.projects);
  closeModal();
  render();
  showToast('프로젝트 정보를 저장했습니다.');
}

function nl2br(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

init();
