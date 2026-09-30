import { lifeEvents } from './data/financial-decisions.js';
import { generateTimeline, demoPlan, formatDate, offsetLabel, parseDate } from './lib/timeline.js';
import { loadState, saveState } from './lib/storage.js';

const paths = {
  leaf: '<path d="M20 4c-8-2-16 2-15 9 1 7 14 8 15-9Z"/><path d="m4 21 11-12M8 16v-5m4 1h5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12c6 4 12 4 18 0m-9 0v4"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h12v4M3 5v14a2 2 0 0 0 2 2h15V7m0 5h-6v5h6m-3-3h.1"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z"/>',
  spark: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.calendar}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let stored = loadState();
let state = stored || { plan: demoPlan(), completed: [], checks: {} };
let isDemo = !stored;
let eventFilter = 'all';
let statusFilter = 'all';
let toastTimer;
const items = () => generateTimeline(state.plan, state.completed);
function notify(message) {
  const el = document.querySelector('#toast');
  el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}
function persist() {
  if (isDemo) return;
  if (!saveState(state)) notify('브라우저 저장 공간을 사용할 수 없어 이번 방문에서만 유지돼요.');
}
function tag(event) { const e = lifeEvents[event]; return `<span class="tag ${e.color}">${e.label}</span>`; }
function statusLabel(status) { return { now: '지금 준비', upcoming: '준비 예정', done: '준비 완료' }[status]; }
function shell(content, page) {
  return `<aside class="sidebar">
    <a href="#/timeline" class="brand" aria-label="FinPath 홈"><span class="brand-icon">${icon('leaf')}</span>FinPath<span class="brand-dot">.</span></a>
    <div class="workspace-label">MY FINANCIAL JOURNEY</div>
    <nav aria-label="주 메뉴"><a class="nav-item ${page !== 'plan' ? 'active' : ''}" ${page !== 'plan' ? 'aria-current="page"' : ''} href="#/timeline">${icon('grid')}<span>나의 금융 타임라인</span></a><a class="nav-item ${page === 'plan' ? 'active' : ''}" ${page === 'plan' ? 'aria-current="page"' : ''} href="#/plan">${icon('calendar')}<span>내 계획 입력</span></a></nav>
    <div class="sidebar-note"><div class="mini-sprout">${icon('leaf')}</div><h3>작은 준비가 만드는<br>더 단단한 내일.</h3><p>나의 속도로, 한 걸음씩<br>금융 생활을 만들어 가요.</p><div class="note-path"><i></i><i></i><i></i><span>${icon('flag')}</span></div></div>
    <div class="sidebar-bottom"><span class="avatar">${isDemo ? 'F' : escape((state.plan.name || '나').slice(0, 1))}</span><div><strong>${isDemo ? '나의 첫 금융 여정' : escape(state.plan.name ? `${state.plan.name}님의 금융 여정` : '나의 금융 여정')}</strong><small>${isDemo ? '예시 계획 둘러보는 중' : '이 브라우저에 저장됨'}</small></div></div>
  </aside><div class="app-body"><header class="topbar"><div>나의 공간 <span>/</span> <strong>${page === 'plan' ? '내 계획 입력' : page === 'detail' ? '금융 의사결정' : 'My Financial Timeline'}</strong></div><span class="topbar-right">${icon('leaf')} 미래를 준비하는 오늘</span></header><main id="main" tabindex="-1">${content}</main><footer><span class="footer-brand">FinPath</span><span>내 삶에 맞는 금융, 필요한 순간에.</span><span>금융상품 추천 없이, 의사결정을 위한 준비 정보만 담아요.</span></footer></div>`;
}
function journeyArt() {
  return `<svg class="journey-art" viewBox="0 0 350 220" fill="none" aria-hidden="true"><circle cx="235" cy="107" r="91" fill="#e4ebd9"/><circle cx="235" cy="107" r="67" stroke="#d2dec7" stroke-dasharray="3 7"/><path d="M19 204c25-85 87 31 121-47s83 18 110-65 69-50 81-66" stroke="#a4bea3" stroke-width="27" stroke-linecap="round"/><path d="M19 204c25-85 87 31 121-47s83 18 110-65 69-50 81-66" stroke="#fafcf4" stroke-width="2" stroke-dasharray="5 8"/><g transform="translate(222 30)"><path d="M0 29 30 7l30 22v51H0Z" fill="#fcfcf3"/><path d="m-8 32 38-29 38 29" stroke="#2b6248" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 80V51h18v29" fill="#719a75"/><path d="M9 41h12v12H9m34-12h10v12H43" fill="#d7b977"/><path d="M49 15V3h10v19" fill="#2b6248"/></g><g transform="translate(111 112) rotate(-9)"><rect width="52" height="43" rx="9" fill="#d8a969"/><path d="M17 0v-8h19v8M0 17c16 8 36 8 52 0" stroke="#a97844" stroke-width="3"/><rect x="22" y="16" width="9" height="10" rx="2" fill="#f4dfb8"/></g><circle cx="56" cy="174" r="15" fill="#2e674b"/><path d="m49 174 5 5 9-11" stroke="white" stroke-width="2.5" stroke-linecap="round"/><path d="M310 161v-39m0 25c-21-1-22-19-22-19 18 0 22 19 22 19Zm0-9c1-19 19-24 19-24 2 18-19 24-19 24Z" stroke="#7f9c72" stroke-width="3" fill="#9ab68a"/><path d="m190 28 2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#c2a36d"/></svg>`;
}
function decisionCard(d) {
  const event = lifeEvents[d.event];
  return `<a class="decision-card" href="#/decision/${d.id}"><div class="card-top"><span class="icon-box ${event.color}">${icon(event.icon)}</span>${tag(d.event)}<span class="card-arrow">${icon('arrow')}</span></div><div class="card-timing">${event.short} ${offsetLabel(d.offsetMonths)}<span>·</span>${formatDate(d.dueDate)}부터</div><h3>${d.title}</h3><p>${d.description}</p><div class="card-bottom"><span>${icon('clock')} ${d.duration}분이면 준비할 수 있어요</span><strong>살펴보기 ${icon('chevron')}</strong></div></a>`;
}
function renderTimeline() {
  const all = items();
  const now = all.filter(d => d.status === 'now');
  const done = all.filter(d => d.status === 'done');
  const filtered = all.filter(d => (eventFilter === 'all' || d.event === eventFilter) && (statusFilter === 'all' || d.status === statusFilter));
  const groups = Map.groupBy(filtered, d => d.dueDate.slice(0, 7));
  const today = new Date();
  return shell(`<section class="page-heading"><div class="eyebrow">YOUR NEXT CHAPTER</div><h1>나의 금융 타임라인<span class="heading-dot">.</span></h1><p>앞으로의 계획에 맞춰, 필요한 금융 준비를 한 걸음씩.</p><a class="button secondary heading-action" href="#/plan">${icon('edit')}${isDemo ? '내 계획 입력하기' : '계획 수정하기'}</a></section>
    ${isDemo ? `<div class="demo-strip"><span>${icon('info')} 지금은 <strong>예시 계획</strong>을 보고 있어요. 나의 날짜를 입력하면 준비 일정이 달라져요.</span><a href="#/plan">내 계획으로 시작 ${icon('arrow')}</a></div>` : ''}
    <div class="dashboard-layout"><div class="dashboard-main"><section class="hero"><div class="hero-copy"><span class="hero-kicker"><i></i> 나의 다음 순간을 위한 준비</span><h2>미래의 나를 위해,<br>오늘 한 걸음.</h2><p>취업부터 첫 독립까지.<br>막막했던 금융 준비를 작은 계획으로 바꿔 보세요.</p><a href="#prepare" class="hero-link" data-scroll="prepare">지금 필요한 준비 보기 ${icon('arrow')}</a></div>${journeyArt()}</section>
    <section id="prepare" class="prepare-section"><div class="section-heading"><h2>지금 준비하면 좋아요 <span class="count">${now.length}</span></h2><span>오늘, ${today.getMonth() + 1}월 ${today.getDate()}일 기준</span></div><p class="section-desc">준비 시작일이 된 항목이에요. 아직 못 했다면 지금부터 차근차근.</p><div class="decision-grid">${now.length ? now.map(decisionCard).join('') : `<div class="empty-state">${icon('check')}<h3>${all.length ? '지금 필요한 준비를 모두 마쳤어요' : '첫 계획을 세워 볼까요?'}</h3><p>${all.length ? '아래 타임라인에서 다음 준비를 미리 살펴보세요.' : '예정일 하나만 입력해도 나만의 일정이 만들어져요.'}</p>${!all.length ? '<a class="button primary" href="#/plan">계획 입력하기</a>' : ''}</div>`}</div></section>
    <section class="timeline-section"><div class="section-heading"><h2>앞으로의 금융 여정</h2><span class="total-count">전체 ${all.length}개의 준비</span></div><div class="filter-bar"><div class="filter-tabs" role="group" aria-label="라이프 이벤트 필터">${[['all', '전체'], ...Object.entries(lifeEvents).map(([k, v]) => [k, v.label])].map(([key, label]) => `<button class="filter-tab ${eventFilter === key ? 'selected' : ''}" data-event-filter="${key}" aria-pressed="${eventFilter === key}">${label}</button>`).join('')}</div><label class="sr-only" for="status-filter">준비 상태</label><select id="status-filter"><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>모든 상태</option><option value="now" ${statusFilter === 'now' ? 'selected' : ''}>지금 준비</option><option value="upcoming" ${statusFilter === 'upcoming' ? 'selected' : ''}>준비 예정</option><option value="done" ${statusFilter === 'done' ? 'selected' : ''}>준비 완료</option></select></div><div class="timeline-list">${groups.size ? [...groups].map(([month, list]) => `<div class="timeline-month"><div class="month-label"><span class="timeline-dot"></span><strong>${Number(month.slice(5))}월</strong><span>${month.slice(0, 4)}</span></div><div class="month-items">${list.map(d => `<a class="timeline-row ${d.status === 'done' ? 'completed' : ''}" href="#/decision/${d.id}"><span class="icon-box small ${lifeEvents[d.event].color}">${icon(d.status === 'done' ? 'check' : lifeEvents[d.event].icon)}</span><div class="row-copy"><h3>${d.title}</h3><span>${lifeEvents[d.event].label} <i>·</i> ${offsetLabel(d.offsetMonths)}</span></div><span class="row-date">${formatDate(d.dueDate)}</span><span class="status ${d.status}">${statusLabel(d.status)}</span>${icon('chevron')}</a>`).join('')}</div></div>`).join('') : '<div class="empty-state compact"><p>선택한 조건에 해당하는 준비가 없어요.</p><button class="text-button" data-reset-filters>전체 일정 보기</button></div>'}</div></section></div>
    <aside class="dashboard-aside"><section class="plan-summary"><div class="section-heading"><h2>나의 라이프 플랜</h2>${icon('flag')}</div><p>내가 그려가는 다음 순간들</p><div class="life-events">${Object.entries(lifeEvents).map(([key, event]) => `<div class="life-event"><span class="icon-box ${event.color}">${icon(event.icon)}</span><div><span>${event.label}</span><strong>${formatDate(state.plan[event.field], true)}</strong></div>${parseDate(state.plan[event.field]) ? '<span class="event-dot"></span>' : ''}</div>`).join('')}</div><a class="plan-edit" href="#/plan">${isDemo ? '나만의 계획 만들기' : '내 계획 수정하기'} ${icon('arrow')}</a></section><section class="progress-card"><div class="section-heading"><h2>차곡차곡, 준비 중</h2><span>${icon('leaf')}</span></div><div class="progress-number">${done.length}<span> / ${all.length}</span></div><div class="progress-track" role="progressbar" aria-label="준비 완료" aria-valuenow="${done.length}" aria-valuemin="0" aria-valuemax="${all.length || 1}"><span style="width:${all.length ? done.length / all.length * 100 : 0}%"></span></div><p>${done.length ? '하나씩 쌓이는 준비가 내일의 자신감이 돼요.' : '첫 번째 준비를 완료하고 나만의 여정을 시작해 보세요.'}</p></section><div class="gentle-note">${icon('spark')}<p>계획은 바뀌어도 괜찮아요.<br>날짜를 바꾸면 준비 일정도<br>함께 맞춰 드릴게요.</p></div></aside></div>`, 'timeline');
}
function renderPlan() {
  const plan = isDemo ? { name: '', employmentDate: '', salaryDate: '', independenceDate: '' } : state.plan;
  return shell(`<a class="back-link" href="#/timeline">${icon('back')} 타임라인으로</a><section class="page-heading"><div class="eyebrow">MAKE IT YOURS</div><h1>어떤 내일을 준비하고 있나요<span class="heading-dot">?</span></h1><p>아직 정확하지 않아도 괜찮아요. 예정일 하나부터 시작해 보세요.</p></section><div class="plan-layout"><form id="plan-form" class="form-panel"><div class="form-section"><span class="step-label">01 · 나를 부르는 이름</span><label for="name">어떻게 불러 드릴까요? <span class="optional">선택</span></label><input id="name" name="name" placeholder="닉네임을 입력해 주세요" maxlength="20" autocomplete="nickname" value="${escape(plan.name)}"></div><div class="form-section"><span class="step-label">02 · 나의 다음 라이프 이벤트</span><h2>예정된 순간을 알려 주세요</h2><p class="field-help">준비 중인 이벤트의 날짜를 하나 이상 입력해 주세요.</p>${Object.entries(lifeEvents).map(([key, event]) => `<div class="event-input"><span class="icon-box ${event.color}">${icon(event.icon)}</span><div><label for="${event.field}">${event.label}</label><p>${{ employment: '새로운 회사에서 시작하는 날', salary: '첫 월급을 받게 될 날', independence: '나만의 공간으로 이사하는 날' }[key]}</p></div><input type="date" id="${event.field}" name="${event.field}" min="2000-01-01" max="2100-12-31" aria-label="${event.short}" value="${parseDate(plan[event.field]) ? plan[event.field] : ''}"></div>`).join('')}<div class="input-note">${icon('info')} 첫 월급일은 입사일과 별도로 입력해 주세요. 모르는 날짜는 비워 두어도 돼요.</div></div><p id="form-error" class="form-error" role="alert"></p><button class="button primary submit-plan" type="submit">${isDemo ? '나의 타임라인 만들기' : '변경한 계획 저장하기'} ${icon('arrow')}</button><p class="local-note">계획은 현재 브라우저에만 저장돼요. 언제든 수정할 수 있어요.</p></form><aside class="plan-explainer"><span class="icon-box green">${icon('spark')}</span><h2>미래의 날짜가<br>오늘의 준비가 돼요.</h2><p>예정일을 기준으로 필요한 준비 시점을<br>거꾸로 계산해 나만의 일정을 만들어요.</p><div class="example-timeline"><strong>독립을 계획한다면</strong>${[['6개월 전', '전세·월세 비교'], ['5개월 전', '주거비 예산 설정'], ['3개월 전', '대출 조건 확인'], ['1개월 전', '계약·보증 체크']].map(([date, title]) => `<div><i></i><span>${date}</span><strong>${title}</strong></div>`).join('')}</div><p class="explainer-bottom">정해진 속도는 없어요.<br>지금 나에게 필요한 준비부터 시작해요.</p></aside></div>`, 'plan');
}
function renderDetail(id) {
  const d = items().find(item => item.id === id);
  if (!d) return shell('<div class="empty-state"><h1>이 계획에서 찾을 수 없는 준비예요</h1><p>계획이 바뀌었거나 주소가 올바르지 않아요.</p><a class="button primary" href="#/timeline">타임라인으로 돌아가기</a></div>', 'detail');
  const checked = Array.isArray(state.checks[d.id]) ? state.checks[d.id] : [];
  return shell(`<a class="back-link" href="#/timeline">${icon('back')} 타임라인으로</a><section class="detail-heading">${tag(d.event)}<span class="status ${d.status}">${statusLabel(d.status)}</span><h1>${d.title}</h1><p>${d.description}</p><div class="detail-meta"><span>${icon('calendar')} ${formatDate(d.dueDate, true)}부터 준비</span><span>${icon('clock')} 약 ${d.duration}분</span><span>${lifeEvents[d.event].short} ${offsetLabel(d.offsetMonths)}</span></div></section><div class="detail-layout"><div><section class="detail-panel why-panel"><span class="icon-box green">${icon('leaf')}</span><div><h2>왜 이때 준비하면 좋을까요?</h2><p>${d.why}</p></div></section><section class="detail-panel checklist-panel"><div class="section-heading"><h2>하나씩 확인해 보세요</h2><span id="check-count">${checked.length} / ${d.checks.length}</span></div><p>확인한 항목을 체크하며 생각을 정리해 보세요.</p><div class="checklist">${d.checks.map((check, i) => `<label class="check-item"><input type="checkbox" data-check="${i}" data-id="${d.id}" ${checked.includes(i) ? 'checked' : ''}><span>${check}</span></label>`).join('')}</div></section><section class="detail-panel question-panel"><h2>결정하기 전, 나에게 던질 질문</h2>${d.questions.map((q, i) => `<div><span>0${i + 1}</span><p>${q}</p></div>`).join('')}</section></div><aside><section class="detail-action"><span class="icon-box ${lifeEvents[d.event].color}">${icon(lifeEvents[d.event].icon)}</span><h2>내 계획과 연결된 준비</h2><div class="detail-anchor"><span>${lifeEvents[d.event].short}</span><strong>${formatDate(d.anchorDate, true)}</strong></div><div class="detail-anchor"><span>준비 시점</span><strong>${offsetLabel(d.offsetMonths)}</strong></div><p>내 상황에 필요한 내용을 확인했다면 준비 완료로 표시해 주세요.</p><button class="button ${d.status === 'done' ? 'secondary' : 'primary'}" data-complete="${d.id}">${icon(d.status === 'done' ? 'back' : 'check')}${d.status === 'done' ? '준비 중으로 되돌리기' : '준비 완료로 표시'}</button>${isDemo ? '<small>예시 계획의 체크는 이번 방문에서만 유지돼요.</small>' : ''}</section><div class="gentle-note">${icon('info')}<p>준비를 돕는 일반적인 확인 목록이에요. 실제 조건과 절차는 해당 기관에서 확인해 주세요.</p></div></aside></div>`, 'detail');
}
function render({ focus = false } = {}) {
  const route = location.hash.slice(1) || '/timeline';
  const page = route === '/plan' ? 'plan' : route.startsWith('/decision/') ? 'detail' : 'timeline';
  document.querySelector('#app').innerHTML = page === 'plan' ? renderPlan() : page === 'detail' ? renderDetail(route.split('/')[2]) : renderTimeline();
  document.title = `${page === 'plan' ? '내 계획 입력' : page === 'detail' ? '금융 의사결정' : '나의 금융 타임라인'} | FinPath`;
  if (focus) { document.querySelector('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
document.addEventListener('click', e => {
  if (e.target.closest('.skip-link')) { e.preventDefault(); document.querySelector('#main').focus(); return; }
  const filter = e.target.closest('[data-event-filter]');
  if (filter) { eventFilter = filter.dataset.eventFilter; render(); document.querySelector(`[data-event-filter="${eventFilter}"]`).focus({ preventScroll: true }); }
  if (e.target.closest('[data-reset-filters]')) { eventFilter = 'all'; statusFilter = 'all'; render(); }
  const scroll = e.target.closest('[data-scroll]');
  if (scroll) { e.preventDefault(); document.getElementById(scroll.dataset.scroll).scrollIntoView({ behavior: 'smooth' }); }
  const complete = e.target.closest('[data-complete]');
  if (complete) {
    const id = complete.dataset.complete;
    const wasDone = state.completed.includes(id);
    state.completed = wasDone ? state.completed.filter(x => x !== id) : [...state.completed, id];
    persist(); render(); document.querySelector('[data-complete]').focus({ preventScroll: true }); notify(wasDone ? '준비 중으로 변경했어요.' : '준비를 하나 마쳤어요. 다음 한 걸음도 함께해요!');
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'status-filter') { statusFilter = e.target.value; render(); document.querySelector('#status-filter').focus({ preventScroll: true }); }
  if (e.target.matches('[data-check]')) {
    const id = e.target.dataset.id, index = Number(e.target.dataset.check);
    const checked = new Set(Array.isArray(state.checks[id]) ? state.checks[id] : []);
    e.target.checked ? checked.add(index) : checked.delete(index);
    state.checks[id] = [...checked]; persist();
    document.querySelector('#check-count').textContent = `${checked.size} / ${items().find(d => d.id === id).checks.length}`;
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'plan-form') return;
  e.preventDefault();
  const plan = Object.fromEntries(new FormData(e.target));
  plan.name = plan.name.trim();
  const dateFields = Object.values(lifeEvents).map(event => event.field);
  const error = document.querySelector('#form-error');
  if (!dateFields.some(key => parseDate(plan[key]))) { error.textContent = '예정일을 하나 이상 입력해 주세요.'; document.querySelector('#employmentDate').focus(); return; }
  if (dateFields.some(key => plan[key] && !parseDate(plan[key]))) { error.textContent = '입력한 날짜를 다시 확인해 주세요.'; return; }
  if (plan.employmentDate && plan.salaryDate && plan.salaryDate < plan.employmentDate) { error.textContent = '첫 월급일은 입사일과 같거나 이후 날짜로 입력해 주세요.'; document.querySelector('#salaryDate').focus(); return; }
  state = { plan, completed: isDemo ? [] : state.completed, checks: isDemo ? {} : state.checks };
  isDemo = false; const saved = saveState(state); eventFilter = 'all'; statusFilter = 'all'; location.hash = '/timeline';
  notify(saved ? '내 계획에 맞춰 타임라인을 만들었어요.' : '타임라인을 만들었어요. 브라우저 저장이 제한되어 이번 방문에서만 유지돼요.');
});
window.addEventListener('hashchange', () => render({ focus: true }));
render();
