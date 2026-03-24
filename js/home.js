import {
  CELL_ORDER,
  formatDateRange,
  getCellMeta,
  getPriorityBadge,
  getStatusMeta,
  groupByCell,
  loadDefaultProjects,
  loadTeamMembers,
  openDashboard,
  qs,
  readCsvFile,
  savePreviousProjects,
  saveProjects,
  showToast,
  getStoredProjects,
} from './common.js';

let state = {
  viewMode: 'project',
  projects: [],
  teamMembers: {},
};

async function init() {
  const defaultProjects = await loadDefaultProjects();
  state.projects = getStoredProjects() || defaultProjects;
  state.teamMembers = await loadTeamMembers();

  bindEvents();
  render();
}

function bindEvents() {
  qs('#view-project-btn')?.addEventListener('click', () => setViewMode('project'));
  qs('#view-member-btn')?.addEventListener('click', () => setViewMode('member'));
  qs('#csv-upload-current')?.addEventListener('change', event => handleUpload(event, false));
  qs('#csv-upload-previous')?.addEventListener('change', event => handleUpload(event, true));
}

function setViewMode(mode) {
  state.viewMode = mode;
  qs('#view-project-btn')?.classList.toggle('is-active', mode === 'project');
  qs('#view-member-btn')?.classList.toggle('is-active', mode === 'member');
  qs('#project-view')?.classList.toggle('hidden', mode !== 'project');
  qs('#member-view')?.classList.toggle('hidden', mode !== 'member');
}

async function handleUpload(event, isPrevious) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const projects = await readCsvFile(file);
    if (!projects.length) {
      showToast('데이터가 없거나 파일 형식이 올바르지 않습니다.');
      event.target.value = '';
      return;
    }

    if (isPrevious) {
      savePreviousProjects(projects);
      showToast(`이전 주차 데이터 ${projects.length}건을 저장했습니다.`);
    } else {
      state.projects = projects;
      saveProjects(projects);
      render();
      showToast(`이번 주차 데이터 ${projects.length}건을 불러왔습니다.`);
    }
  } catch (error) {
    console.error(error);
    showToast('CSV를 처리하는 도중 오류가 발생했습니다.');
  } finally {
    event.target.value = '';
  }
}

function render() {
  renderSummaryStats();
  renderProjectView();
  renderMemberView();
  setViewMode(state.viewMode);
}

function renderSummaryStats() {
  const container = qs('#summary-stats');
  if (!container) return;

  const totalProjects = state.projects.length;
  const inProgress = state.projects.filter(project => project.status === '진행 중').length;
  const completed = state.projects.filter(project => project.status === '완료').length;
  const avgProgress = totalProjects
    ? Math.round(state.projects.reduce((sum, project) => sum + project.progress, 0) / totalProjects)
    : 0;

  container.innerHTML = [
    { label: '전체 프로젝트', value: `${totalProjects}`, sub: '현재 업로드된 이번 주차 기준' },
    { label: '진행 중', value: `${inProgress}`, sub: '현재 액션이 필요한 과업' },
    { label: '완료', value: `${completed}`, sub: '이번 주 완료된 프로젝트' },
    { label: '평균 진행률', value: `${avgProgress}%`, sub: '전체 프로젝트 평균' },
  ].map(card => `
    <article class="stat-card">
      <div class="stat-card__label">${card.label}</div>
      <div class="stat-card__value">${card.value}</div>
      <div class="stat-card__sub">${card.sub}</div>
    </article>
  `).join('');
}

function renderProjectView() {
  const container = qs('#project-view');
  if (!container) return;

  const grouped = groupByCell(state.projects);
  container.innerHTML = CELL_ORDER.map(cell => renderCellCard(cell, grouped[cell] || [])).join('');

  container.querySelectorAll('[data-open-cell]').forEach(button => {
    button.addEventListener('click', () => openDashboard(button.dataset.openCell));
  });
}

function renderCellCard(cell, projects) {
  const meta = getCellMeta(cell);
  const pmCount = new Set(projects.map(project => project.pm)).size;
  const progressSorted = [...projects].sort((a, b) => b.progress - a.progress);

  return `
    <article class="cell-card cell-card--${meta.key}" data-open-cell="${cell}">
      <div class="cell-card__head">
        <div>
          <div class="icon-chip">${meta.icon}</div>
          <h2 class="cell-card__title">${cell === '공통' ? '공통 업무' : `${cell} 셀`}</h2>
          <div class="cell-card__meta">
            <span class="badge ${meta.badge}">프로젝트 ${projects.length}개</span>
            <span class="badge badge--neutral">PM ${pmCount}명</span>
          </div>
        </div>
        <span class="badge badge--neutral">상세보기 →</span>
      </div>

      <div class="list scrollable">
        ${projects.length
          ? progressSorted.map(project => renderTaskCard(project)).join('')
          : `<div class="empty-state">업로드된 프로젝트가 없습니다.<br />CSV를 업로드하면 이 영역에 표시됩니다.</div>`}
      </div>
    </article>
  `;
}

function renderTaskCard(project) {
  const status = getStatusMeta(project.status);
  return `
    <article class="task-card">
      <div class="task-card__top">
        <span class="badge ${getPriorityBadge(project.priority)}">${project.priority}</span>
        <span class="badge ${status.badge}">${status.text}</span>
      </div>
      <div class="task-card__title">${project.name}</div>
      <div class="task-card__sub">PM: ${project.pm}</div>
      <div class="task-card__sub">기간: ${formatDateRange(project)}</div>
      <div class="progress-row">
        <strong>${project.progress}%</strong>
      </div>
      <div class="progress-bar"><span style="width:${project.progress}%"></span></div>
    </article>
  `;
}

function renderMemberView() {
  const container = qs('#member-view');
  if (!container) return;

  const sections = [];
  sections.push(renderLeaderSection());
  sections.push(...CELL_ORDER.filter(cell => cell !== '공통').map(cell => renderMemberSection(cell)));
  container.innerHTML = sections.join('');

  // 아코디언 이벤트 바인딩
  container.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector('.accordion-icon');
      const isCollapsed = content.classList.contains('collapsed');
      
      if (isCollapsed) {
        content.classList.remove('collapsed');
        icon.style.transform = 'rotate(0deg)';
      } else {
        content.classList.add('collapsed');
        icon.style.transform = 'rotate(180deg)';
      }
    });
  });
}

function renderLeaderSection() {
  const leaderName = '신혜영';
  const leaderProjects = state.projects.filter(project => project.pm === leaderName || project.members.some(member => member.name === leaderName));
  return `
    <section class="member-section">
      <div class="member-section__head accordion-header">
        <div>
          <div class="icon-chip">👑</div>
          <h2 class="member-section__title">디자인 기획팀장</h2>
          <div class="member-section__meta">
            <span class="badge badge--amber">${leaderName}</span>
            <span class="badge badge--neutral">과업 ${leaderProjects.length}건</span>
          </div>
        </div>
        <span class="accordion-icon">▼</span>
      </div>
      <div class="member-grid accordion-content">
        ${renderMemberCard({ name: leaderName, role: '책임연구원/팀장', isLeader: true }, leaderProjects)}
      </div>
    </section>
  `;
}

function renderMemberSection(cell) {
  const members = state.teamMembers[cell] || [];
  const cellProjects = state.projects.filter(project => project.cell === cell);
  return `
    <section class="member-section">
      <div class="member-section__head accordion-header">
        <div>
          <div class="icon-chip">${getCellMeta(cell).icon}</div>
          <h2 class="member-section__title">${cell} 셀</h2>
          <div class="member-section__meta">
            <span class="badge ${getCellMeta(cell).badge}">인원 ${members.length}명</span>
            <span class="badge badge--neutral">프로젝트 ${cellProjects.length}개</span>
          </div>
        </div>
        <span class="accordion-icon">▼</span>
      </div>
      <div class="member-grid accordion-content">
        ${members.length
          ? members.map(member => {
              const projects = state.projects.filter(project => project.pm === member.name || project.members.some(item => item.name === member.name));
              return renderMemberCard(member, projects);
            }).join('')
          : `<div class="empty-state">등록된 팀원이 없습니다.</div>`}
      </div>
    </section>
  `;
}

function renderMemberCard(member, projects) {
  return `
    <article class="member-card">
      <div class="member-card__head">
        <div>
          <h3 class="member-name">${member.name}</h3>
          <p class="member-role">${member.role || '역할 미지정'}</p>
        </div>
        <span class="badge badge--neutral">${projects.length}건</span>
      </div>
      <div class="member-projects">
        ${projects.length
          ? projects.map(project => {
              const memberRole = project.pm === member.name
                ? `PM · ${project.scope || '업무범위 미기재'}`
                : (project.members.find(item => item.name === member.name)?.role || '팀원');
              return `
                <div class="member-project-item">
                  <strong>${project.name}</strong>
                  <span class="muted">${memberRole}</span>
                  <div class="progress-bar"><span style="width:${project.progress}%"></span></div>
                </div>
              `;
            }).join('')
          : `<div class="empty-state">현재 할당된 과업이 없습니다.</div>`}
      </div>
    </article>
  `;
}

init();
