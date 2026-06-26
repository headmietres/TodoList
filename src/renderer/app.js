// ============================================
// TodoList - Main Application
// ============================================

// ---- Calendar Utilities (inlined) ----
/**
 * Calendar utilities
 */

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const days = [];
  
  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    days.push({
      day: prevMonthLastDay - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isOtherMonth: true
    });
  }
  
  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({
      day: i,
      month,
      year,
      isOtherMonth: false
    });
  }
  
  // Padding to fill 6 rows (42 cells)
  while (days.length < 42) {
    const nextDay = days.length - (startPad + lastDay.getDate()) + 1;
    days.push({
      day: nextDay,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isOtherMonth: true
    });
  }
  
  return days;
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayStr() {
  const d = new Date();
  return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
}

function isToday(year, month, day) {
  const d = new Date();
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}


// ---- State ----
let state = {
  tasks: [],
  tags: [],
  stats: { xp: 0, level: 1, perfectDays: [] },
  settings: {},
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedDate: getTodayStr(),
  view: 'day', // 'day' | 'stats' | 'archived'
  sortBy: 'priority',
  miniMode: false
};

// ---- DOM References ----
const $ = (sel) => document.querySelector(sel);
const dom = {
  calendarGrid: $('#calendar-grid'),
  calendarWeekdays: $('#calendar-weekdays'),
  monthTitle: $('#month-title'),
  prevMonth: $('#prev-month'),
  nextMonth: $('#next-month'),
  todayBtn: $('#today-btn'),
  taskList: $('#task-list'),
  taskInput: $('#task-input'),
  addTaskBtn: $('#add-task-btn'),
  prioritySelect: $('#task-priority'),
  tagSelect: $('#task-tag'),
  selectedDateTitle: $('#selected-date-title'),
  taskCount: $('#task-count'),
  bottomCount: $('#bottom-count'),
  showStatsBtn: $('#show-stats-btn'),
  taskDue: $('#task-due'),

  taskExpandBtn: $('#task-expand-btn'),
  taskExtras: $('#task-extras'),

};

// ---- Toast Notification ----
function showToast(msg) {
  var existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:8px 16px;border-radius:var(--radius-md);font-size:13px;z-index:9999;animation:fadeIn 150ms ease;box-shadow:var(--shadow-md)';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 2500);
}

// ---- Initialize ----
async function init() {
  await loadData();
  renderCalendar();
  renderTaskList();
  updateBottomBar();
  refreshMiniView();
  refreshTagSelect();
  updateLevelDisplay();
  bindEvents();
  checkPerfectDay();
}

async function loadData() {
  const [tasks, tags, stats, settings] = await Promise.all([
    window.todoAPI.getTasks(),
    window.todoAPI.getTags(),
    window.todoAPI.getStats(),
    window.todoAPI.getSettings()
  ]);
  state.tasks = tasks;
  state.tags = tags;
  state.stats = stats;
  state.settings = settings;
  
  // Apply theme
  if (settings.darkMode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (settings.darkMode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

// ---- Calendar Rendering ----
function renderCalendar() {
  const { currentYear, currentMonth } = state;
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  dom.monthTitle.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;
  
  // Weekday headers
  dom.calendarWeekdays.innerHTML = ['日', '一', '二', '三', '四', '五', '六']
    .map(d => `<div class="calendar-weekday">${d}</div>`).join('');
  
  // Day cells
  const days = getMonthDays(currentYear, currentMonth);
  dom.calendarGrid.innerHTML = days.map(d => {
    const dateStr = formatDate(d.year, d.month, d.day);
    const dayTasks = getTasksForDate(dateStr);
    const total = dayTasks.length;
    const done = dayTasks.filter(t => t.status === 'done').length;
    const completionRate = total > 0 ? done / total : 0;
    
    let cls = 'calendar-day';
    if (d.isOtherMonth) cls += ' other-month';
    if (isToday(d.year, d.month, d.day)) cls += ' today';
    if (state.selectedDate === dateStr) cls += ' selected';
    
    // Completion color
    if (total > 0) {
      if (completionRate >= 1) cls += ' completion-high';
      else if (completionRate >= 0.5) cls += ' completion-mid';
      else cls += ' completion-low';
    }
    
    // Perfect day
    if (total > 0 && completionRate >= 1) {
      cls += ' has-perfect';
    }
    
    return `<div class="${cls}" data-date="${dateStr}">
      <span class="day-number">${d.day}</span>
      ${total > 0 ? `<span class="task-count">${done}/${total}</span>` : ''}
    </div>`;
  }).join('');
  
  // Click handlers for days
  dom.calendarGrid.querySelectorAll('.calendar-day').forEach(el => {
    el.addEventListener('click', () => {
      const date = el.dataset.date;
      state.selectedDate = date;
      renderCalendar();
      renderTaskList();
    });
  });
}

// ---- Task List Rendering ----
function renderTaskList() {
  // Hide input area in non-day views
  const inputArea = document.querySelector('.task-input-area');
  if (inputArea) inputArea.style.display = (state.view === 'day' || state.miniMode) ? '' : 'none';
  

  // Archived view (collapsible)
  if (state.view === 'archived') {
    dom.selectedDateTitle.textContent = '归档';
    const archivedTasks = state.tasks.filter(t => t.archived);
    if (archivedTasks.length === 0) {
      dom.taskList.innerHTML = '<div class="empty-state"><p>暂无归档任务</p></div>';
      return;
    }
    // Toggle button hidden in archived view; content centered
    dom.taskList.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:16px 0">' +
      '<button class="btn btn-sm" id="toggle-archived-btn" style="margin-bottom:8px">▶ 展开归档 (' + archivedTasks.length + ')</button>' +
      '<div id="archived-content" style="width:100%;display:none">' +
      archivedTasks.map(task => renderTaskCard(task)).join('') +
      '</div></div>';
    
    // Toggle archived content
    const toggleBtn = document.getElementById('toggle-archived-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const content = document.getElementById('archived-content');
        if (content) {
          const isHidden = content.style.display === 'none';
          content.style.display = isHidden ? '' : 'none';
          toggleBtn.textContent = isHidden ? '▼ 收起 (' + archivedTasks.length + ')' : '▶ 展开 (' + archivedTasks.length + ')';
        }
      });
    }
    
    // Bind events for archived tasks
    dom.taskList.querySelectorAll('.task-card').forEach(card => {
      const id = card.dataset.taskId;
      // Unarchive button instead of archive
      card.querySelector('[data-action="archive"]').textContent = '↩';
      card.querySelector('[data-action="archive"]').title = '恢复';
      card.querySelector('[data-action="archive"]').addEventListener('click', async () => {
        await window.todoAPI.unarchiveTask(id);
        await reloadAndRender();
        renderCalendar();
      });
      bindTaskEvents(card, id);
    });
    return;
  }
  // Stats view
  if (state.view === 'stats') {
    dom.selectedDateTitle.textContent = '统计看板';
    dom.taskList.innerHTML = renderStatsPanel();
    // Hide input area
    const inputArea = document.querySelector('.task-input-area');
    if (inputArea) inputArea.style.display = 'none';
    const taskCount = document.getElementById('task-count');
    if (taskCount) taskCount.textContent = '';
    return;
  }
  
  const tasks = getTasksForDate(state.selectedDate);
  const dateObj = new Date(state.selectedDate);
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateLabel = `${state.selectedDate} ${weekdays[dateObj.getDay()]}`;
  dom.selectedDateTitle.textContent = dateLabel;
  
  if (tasks.length === 0) {
    dom.taskList.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
      </svg>
      <p>今天还没有任务，添加一个吧</p>
    </div>`;
    return;
  }
  
  const bigRing = state.selectedDate === getTodayStr() ? renderBigProgressRing() : '';
  dom.taskList.innerHTML = bigRing + tasks.map(task => renderTaskCard(task)).join('');
  
  // Bind task events
  dom.taskList.querySelectorAll('.task-card').forEach(card => {
    const id = card.dataset.taskId;
    bindTaskEvents(card, id);
  });
}

function renderTaskCard(task) {
  const doneCount = task.subtasks.filter(s => s.done).length;
  const totalSubtasks = task.subtasks.length;
  const progress = totalSubtasks > 0 ? Math.round((doneCount / totalSubtasks) * 100) : 0;
  
  const tag = state.tags.find(t => t.id === task.tagId);
  const priorityLabel = { high: '高', medium: '中', low: '低' }[task.priority];
  

  return `<div class="task-card ${task.status === 'done' ? 'completed' : ''} ${task.status === 'in_progress' ? 'in-progress' : ''}" data-task-id="${task.id}">
    <div class="task-body">
      <div class="task-title-row">
        <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''}>
        <span class="task-title">${escapeHtml(task.title)}</span>
        ${renderProgressRingSmall(progress)}
      </div>
      <div class="task-meta">
        <span class="priority-badge ${task.priority}">${priorityLabel}</span>
        ${tag ? `<span class="tag-badge" style="background:${tag.color}">${escapeHtml(tag.name)}</span>` : ''}
        ${task.dueDate ? `<span>${formatDueDate(task.dueDate)}</span>` : ''}

      </div>
      ${renderSubtasks(task)}
    </div>
    <div class="task-actions">
      <button class="btn-icon" data-action="archive" title="归档" style="font-size:12px;font-weight:600">A</button>
      <button class="btn-icon" data-action="edit" title="编辑" style="font-size:13px;font-weight:500">E</button>
      <button class="btn-icon" data-action="delete" title="删除">✕</button>
    </div>
  </div>`;
}

function renderSubtasks(task) {
  const hasSubtasks = task.subtasks.length > 0;
  const doneCount = task.subtasks.filter(s => s.done).length;
  const taskId = task.id;
  
  let html = '<div class="subtask-section">';
  
  // Top bar
  html += '<div class="subtask-toggle">';
  if (hasSubtasks) {
    html += '<button class="subtask-collapse-btn" data-target="st-' + taskId + '">▼</button>';
  } else {
    html += '<span style="width:16px;display:inline-block"></span>';
  }
  html += '<button class="btn btn-xs subtask-add-btn" data-add-st data-id="' + taskId + '">＋</button>';
  if (hasSubtasks) {
    html += '<span class="text-sm text-muted" style="font-size:11px">' + doneCount + '/' + task.subtasks.length + '</span>';
  }
  html += '</div>';
  
  // Subtask list (collapsible)
  html += '<div id="st-' + taskId + '" class="subtask-list" style="display:none">';
  if (hasSubtasks) {
    task.subtasks.forEach((st, idx) => {
      html += '<div class="subtask-item' + (st.done ? ' done' : '') + '" data-si="' + idx + '">';
      html += '<input type="checkbox"' + (st.done ? ' checked' : '') + '>';
      html += '<span class="subtask-title">' + escapeHtml(st.title) + '</span>';
      html += '<button class="subtask-del" data-del-st>×</button>';
      html += '</div>';
    });
  }
  html += '</div>';
  
  html += '</div>';
  return html;
}

function renderProgressRingSmall(percent) {
  const color = percent >= 100 ? '#22c55e' : percent >= 50 ? '#3b82f6' : '#ef4444';
  
  return `<div class="circle-progress-sm" style="background: conic-gradient(${color} 0% ${percent}%, var(--ring-bg) ${percent}% 100%)">
    <div class="circle-progress-sm-inner">
      <span class="circle-progress-sm-pct">${percent}%</span>
    </div>
  </div>`;
}



// ---- Stats Panel ----
function renderStatsPanel() {
  const allTasks = state.tasks.filter(t => !t.archived);
  const total = allTasks.length;
  const done = allTasks.filter(t => t.status === 'done').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  
  // 7-day trend
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d.getFullYear(), d.getMonth(), d.getDate());
    const dayTasks = state.tasks.filter(t => {
      if (t.archived) return false;
      return t.dueDate && t.dueDate.startsWith(dateStr);
    });
    const dayDone = dayTasks.filter(t => t.status === 'done').length;
    days.push({ date: dateStr, total: dayTasks.length, done: dayDone, label: (i === 0 ? '今天' : (i === 1 ? '昨天' : String(d.getMonth()+1)+'/'+d.getDate())) });
  }
  const maxCount = Math.max(1, ...days.map(d => d.total));
  
  // Subtask stats
  let subtaskTotal = 0, subtaskDone = 0;
  allTasks.forEach(t => {
    t.subtasks.forEach(st => {
      subtaskTotal++;
      if (st.done) subtaskDone++;
    }
  )});
  const subtaskRate = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;
  
  // XP stats
  const { stats } = state;
  
  let html = '<div class="stats-panel">';
  
  // Summary cards
  html += '<div class="stats-grid">' +
    '<div class="stat-card"><div class="stat-value">' + completionRate + '%</div><div class="stat-label">总体完成率</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + done + '/' + total + '</div><div class="stat-label">已完成/总数</div></div>' +
    '<div class="stat-card"><div class="stat-value">Lv.' + stats.level + '</div><div class="stat-label">' + stats.xp + ' XP</div></div>' +
    '</div>';
  
  // 7-day trend chart (simple bar)
  html += '<h4 style="font-size:13px;margin-bottom:8px;color:var(--fg-secondary)">近7天完成趋势</h4>';
  html += '<div class="trend-chart">';
  days.forEach(d => {
    const barH = d.total > 0 ? Math.max(4, (d.done / maxCount) * 80) : 0;
    const bgH = d.total > 0 ? Math.max(4, (d.total / maxCount) * 80) : 0;
    html += '<div class="trend-day">' +
      '<div class="trend-bars">' +
      '<div class="trend-bar-done" style="height:' + barH + 'px"></div>' +
      '<div class="trend-bar-total" style="height:' + bgH + 'px"></div>' +
      '</div>' +
      '<span class="trend-label">' + d.label + '</span>' +
      '</div>';
  });
  html += '</div>';
  
  // Subtask stats
  if (subtaskTotal > 0) {
    html += '<div style="margin-top:12px"><h4 style="font-size:13px;margin-bottom:4px;color:var(--fg-secondary)">子任务统计</h4>' +
      '<div class="stat-card" style="text-align:center;padding:8px"><span class="stat-value" style="font-size:18px">' + subtaskDone + '/' + subtaskTotal + '</span> <span class="stat-label">(' + subtaskRate + '%)</span></div></div>';
  }
  
  // Perfect days count
  if (stats.perfectDays && stats.perfectDays.length > 0) {
    html += '<div style="margin-top:12px"><h4 style="font-size:13px;margin-bottom:4px;color:var(--fg-secondary)">完美日 ✨</h4>' +
      '<div class="stat-card" style="text-align:center;padding:8px"><span class="stat-value" style="font-size:18px">' + stats.perfectDays.length + '</span> <span class="stat-label">天</span></div></div>';
  }
  
  html += '</div>';
  return html;
}

function renderBigProgressRing() {
  const todayStr = getTodayStr();
  const todayTasks = state.tasks.filter(t => {
    if (t.archived) return false;
    if (!t.dueDate) return false;
    return t.dueDate.startsWith(todayStr);
  });
  const total = todayTasks.length;
  if (total === 0) return '';
  const done = todayTasks.filter(t => t.status === 'done').length;
  const pct = Math.round((done / total) * 100);
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#ef4444';
  
  return '<div class="today-progress">' +
    '<div class="circle-progress" style="background: conic-gradient(' + color + ' 0% ' + pct + '%, var(--ring-bg) ' + pct + '% 100%)">' +
      '<div class="circle-progress-inner">' +
        '<span class="circle-progress-pct">' + pct + '%</span>' +
      '</div>' +
    '</div>' +
    '<div class="today-progress-text"><span class="today-label">今日进度</span><span class="today-count">' + done + '/' + total + '</span></div>' +
    '</div>';
}

// ---- Task Events Binding ----
function bindTaskEvents(card, id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  // Checkbox (main task)
  const checkbox = card.querySelector('.task-checkbox');
  checkbox.addEventListener('change', async () => {
    if (checkbox.checked) {
      await window.todoAPI.updateTask(id, { status: 'done', completedAt: new Date().toISOString(), isRunning: false });
      // Award XP
      const lvResult1 = await window.todoAPI.addXp(10);
      for (const st of task.subtasks) {
        if (!st.done) {
          const lvSub = await window.todoAPI.addXp(2);
        }
      }
      // Make all subtasks done
      const updatedSubtasks = task.subtasks.map(st => ({ ...st, done: true }));
      await window.todoAPI.updateTask(id, { subtasks: updatedSubtasks });
    } else {
      await window.todoAPI.updateTask(id, { status: 'todo', completedAt: null });
    }
    await reloadAndRender();
    checkPerfectDay();
  });
  
  // Edit
  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    openEditDialog(task);
  });
  
  // Archive
  card.querySelector('[data-action="archive"]').addEventListener('click', async () => {
    await window.todoAPI.archiveTask(id);
    await reloadAndRender();
    renderCalendar();
  });
  
  // Delete
  card.querySelector('[data-action="delete"]').addEventListener('click', () => {
    openDeleteDialog(id);
  });
  

  // Subtask events handled via delegation on #task-list
}

// ---- Subtask Prompt Dialog ----
function showSubtaskPrompt() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal-content" style="min-width:300px">' +
      '<h3>添加子任务</h3>' +
      '<input type="text" class="task-input" id="subtask-prompt-input" placeholder="子任务标题" style="width:100%;margin-top:8px" autofocus>' +
      '<div class="modal-actions">' +
      '<button class="btn" id="subtask-prompt-cancel">取消</button>' +
      '<button class="btn btn-primary" id="subtask-prompt-ok">确定</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#subtask-prompt-input');
    const okBtn = overlay.querySelector('#subtask-prompt-ok');
    const cancelBtn = overlay.querySelector('#subtask-prompt-cancel');
    
    const close = (result) => {
      overlay.remove();
      resolve(result);
    };
    
    okBtn.addEventListener('click', () => close(input.value.trim()));
    cancelBtn.addEventListener('click', () => close(''));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim());
      if (e.key === 'Escape') close('');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close('');
    });
    setTimeout(() => input.focus(), 100);
  });
}

async function addTask() {
  const input = dom.taskInput;
  let title = input.value.trim();
  if (!title) return;
  
  // Check daily task limit
  const limit = state.settings.dailyTaskLimit || 0;
  if (limit > 0) {
    const todayStr = getTodayStr();
    const todayCount = state.tasks.filter(t => {
      if (t.archived) return false;
      return t.dueDate && t.dueDate.startsWith(todayStr);
    }).length;
    if (todayCount >= limit) {
      showToast('今日任务已达到上限 (' + limit + '个)');
      input.value = '';
      return;
    }
  }
  
  // Get values from selectors and extras
  const priority = dom.prioritySelect ? dom.prioritySelect.value : 'medium';
  const tagId = dom.tagSelect ? dom.tagSelect.value || null : null;
  
  let dueDate = state.selectedDate + 'T23:59:59';
  if (dom.taskDue && dom.taskDue.value) {
    // Date input gives YYYY-MM-DD, prepend to selected date if not same
    dueDate = dom.taskDue.value + 'T23:59:59';
  }
  
const task = await window.todoAPI.addTask({
    title,
    description: '',
    dueDate,
    priority,
    tagId,
  subtasks: []
  });
  
  // Reset all inputs
  input.value = '';
  if (dom.prioritySelect) dom.prioritySelect.value = 'medium';
  if (dom.tagSelect) dom.tagSelect.value = '';
  if (dom.taskDue) dom.taskDue.value = '';
await reloadAndRender();
  renderCalendar();
}

// ---- Edit Dialog ----
function openEditDialog(task) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-content">
    <h3>编辑任务</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input class="task-input" id="edit-title" value="${escapeHtml(task.title)}" placeholder="任务标题">
      <textarea class="task-input" id="edit-desc" placeholder="描述/备注" rows="3">${escapeHtml(task.description || '')}</textarea>
      <div class="flex gap-2 items-center">
        <label class="text-sm">截止日期</label>
        <input type="datetime-local" class="task-input" id="edit-due" value="${task.dueDate ? task.dueDate.slice(0, 16) : ''}">
      </div>
      <div class="flex gap-2 items-center">
        <label class="text-sm">优先级</label>
        <select class="task-input" id="edit-priority">
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>高</option>
          <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>中</option>
          <option value="low" ${task.priority === 'low' ? 'selected' : ''}>低</option>
        </select>
        <label class="text-sm">标签</label>
        <select class="task-input" id="edit-tag">
          <option value="">无标签</option>
          ${state.tags.map(t => `<option value="${t.id}" ${task.tagId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="edit-cancel">取消</button>
      <button class="btn btn-primary" id="edit-save">保存</button>
    </div>
  </div>`;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('#edit-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#edit-save').addEventListener('click', async () => {
    const title = overlay.querySelector('#edit-title').value.trim();
    if (!title) return;
    await window.todoAPI.updateTask(task.id, {
      title,
      description: overlay.querySelector('#edit-desc').value.trim(),
      dueDate: overlay.querySelector('#edit-due').value ? overlay.querySelector('#edit-due').value + ':00' : null,
      priority: overlay.querySelector('#edit-priority').value,
      tagId: overlay.querySelector('#edit-tag').value || null
    });
    overlay.remove();
    await reloadAndRender();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ---- Delete Dialog ----
function openDeleteDialog(id) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-content">
    <h3>删除任务</h3>
    <p>确定要删除这个任务吗？此操作可以撤销。</p>
    <div class="modal-actions">
      <button class="btn" id="del-cancel">取消</button>
      <button class="btn btn-danger" id="del-confirm">删除</button>
    </div>
  </div>`;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('#del-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#del-confirm').addEventListener('click', async () => {
    await window.todoAPI.deleteTask(id);
    overlay.remove();
    await reloadAndRender();
    renderCalendar();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ---- Perfect Day Check ----
async function checkPerfectDay() {
  const todayStr = getTodayStr();
  const todayTasks = getTasksForDate(todayStr);
  if (todayTasks.length > 0 && todayTasks.every(t => t.status === 'done')) {
    const isPerfect = await window.todoAPI.isPerfectDay(todayStr);
    if (!isPerfect) {
      await window.todoAPI.addPerfectDay(todayStr);
      await window.todoAPI.addXp(20);
      // Show celebration
      showCelebration('✨ PERFECT DAY');
    }
  }
}


// ---- Level Up Celebration ----
function showLevelUp(level) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal-content celebrate" style="text-align:center;padding:40px">' +
    '<div style="font-size:28px;margin-bottom:12px;font-weight:700;color:var(--accent)">LEVEL UP</div>' +
    '<p style="font-size:36px;font-weight:700;color:var(--fg);margin-bottom:4px">Lv.' + level + '</p>' +
    '<p class="text-muted" style="font-size:13px;margin-top:4px">恭喜达到新等级！</p>' +
    '<div style="margin-top:16px"><button class="btn btn-primary" id="lvup-ok">确定</button></div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#lvup-ok').addEventListener('click', () => overlay.remove());
  setTimeout(() => overlay.remove(), 4000);
}

function showCelebration(text) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-content celebrate" style="text-align:center;padding:40px">
    <div style="font-size:48px;margin-bottom:16px"></div>
    <h3 style="font-size:20px;margin-bottom:8px">${text}</h3>
    <p class="text-muted">今日所有任务全部完成！+20 XP</p>
    <div style="margin-top:16px"><button class="btn btn-primary" id="celeb-ok">太棒了！</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#celeb-ok').addEventListener('click', () => overlay.remove());
  setTimeout(() => overlay.remove(), 5000);
}

// ---- Helper Functions ----
function getTasksForDate(dateStr) {
  let tasks = state.tasks.filter(t => {
    if (t.archived) return false;
    if (!t.dueDate) return false;
    return t.dueDate.startsWith(dateStr);
  });
  

  // Apply sort
  const sortField = state.sortBy || 'createdAt';
  tasks.sort((a, b) => {
    if (sortField === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }
    if (sortField === 'progress') {
      const pA = a.subtasks.length > 0 ? a.subtasks.filter(s => s.done).length / a.subtasks.length : 0;
      const pB = b.subtasks.length > 0 ? b.subtasks.filter(s => s.done).length / b.subtasks.length : 0;
      return pB - pA;
    }
    const valA = a[sortField] || '';
    const valB = b[sortField] || '';
    return valA > valB ? -1 : valA < valB ? 1 : 0;
  });
  
  return tasks;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


function formatDueDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return (d.getMonth() + 1) + '/' + d.getDate();
}


function refreshTagSelect() {
  const sel = dom.tagSelect;
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">标签</option>' +
    state.tags.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  // Restore selection if still valid
  if (currentVal && state.tags.some(t => t.id === currentVal)) {
    sel.value = currentVal;
  }
}

function refreshMiniView() {
  const mv = document.getElementById('mini-view');
  if (mv) renderMiniView();
}

async function reloadAndRender() {
  state.tasks = await window.todoAPI.getTasks();
  renderTaskList();
  updateBottomBar();
}

async function reloadTags() {
  state.tags = await window.todoAPI.getTags();
  refreshTagSelect();
}

function updateBottomBar() {
  const total = state.tasks.filter(t => !t.archived).length;
  const done = state.tasks.filter(t => t.status === 'done' && !t.archived).length;
  const archived = state.tasks.filter(t => t.archived).length;
  dom.bottomCount.innerHTML = `<span style="display:flex;align-items:center;gap:6px;justify-content:center">已完成 ${done} / 共 ${total} 项${archived > 0 ? '<a id="show-archived-btn" style="cursor:pointer;color:var(--fg-muted);text-decoration:none;font-size:12px;font-weight:500;margin-left:4px" title="查看归档">归档</a>' : ''}</span>`;
  dom.taskCount.textContent = `${total} 项任务`;
}

// Event listeners
function bindEvents() {
  // Calendar navigation
  dom.prevMonth.addEventListener('click', () => {
    state.currentMonth--;
    if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    renderCalendar();
  });
  
  dom.nextMonth.addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    renderCalendar();
  });
  
  dom.todayBtn.addEventListener('click', () => {
    const today = new Date();
    state.currentYear = today.getFullYear();
    state.currentMonth = today.getMonth();
    state.selectedDate = getTodayStr();
    renderCalendar();
    renderTaskList();
  });
  
  // Add task
  dom.addTaskBtn.addEventListener('click', addTask);
  
  // Expand/collapse extra task options
  if (dom.taskExpandBtn && dom.taskExtras) {
    dom.taskExpandBtn.addEventListener('click', () => {
      dom.taskExtras.classList.toggle('hidden');
      dom.taskExpandBtn.textContent = dom.taskExtras.classList.contains('hidden') ? '⋯' : '▲';
    });
  }
  dom.taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });
  


  // Keyboard shortcuts
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        await window.todoAPI.redo();
      } else {
        await window.todoAPI.undo();
      }
      await reloadAndRender();
      renderCalendar();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      dom.taskInput.focus();
    }
  });
  
  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);

  // Mini mode toggle
  const miniBtn = document.getElementById('mini-mode-btn');
  if (miniBtn) {
    miniBtn.addEventListener('click', async () => {
      state.miniMode = !state.miniMode;
      await window.todoAPI.setMiniMode(state.miniMode);
      const calendarPanel = document.querySelector('.calendar-panel');
      if (state.miniMode) {
        calendarPanel.style.display = 'none';
        const appHeader = document.querySelector('.app-header');
        const taskList = document.getElementById('task-list');
        const taskHeader = document.querySelector('.task-header');
        const taskInput = document.querySelector('.task-input-area');
        const bottomBar = document.querySelector('.bottom-bar');
        if (appHeader) appHeader.style.display = 'none';
        if (taskHeader) taskHeader.style.display = 'none';
        if (taskInput) taskInput.style.display = '';
        if (bottomBar) bottomBar.style.display = 'none';
        // Create mini header row
        const appContainer = document.querySelector('.app-container');
        let miniHeader = document.getElementById('mini-header');
        if (!miniHeader) {
          miniHeader = document.createElement('div');
          miniHeader.id = 'mini-header';
          appContainer.insertBefore(miniHeader, document.querySelector('.main-content'));
        }
        if (taskList) {
          taskList.id = 'mini-view';
          taskList.style.padding = '4px 8px';
          taskList.style.flex = '1';
          taskList.style.overflowY = 'auto';
        }
        renderMiniView();
      } else {
        calendarPanel.style.display = '';
        const appHeader = document.querySelector('.app-header');
        const taskList = document.getElementById('mini-view') || document.getElementById('task-list');
        const taskHeader = document.querySelector('.task-header');
        const taskInput = document.querySelector('.task-input-area');
        const bottomBar = document.querySelector('.bottom-bar');
        if (appHeader) appHeader.style.display = '';
        if (taskHeader) taskHeader.style.display = '';
        if (taskInput) taskInput.style.display = '';
        if (bottomBar) bottomBar.style.display = '';
        const miniHeader = document.getElementById('mini-header');
        if (miniHeader) miniHeader.remove();
        if (taskList) {
          taskList.id = 'task-list';
          taskList.style.padding = '8px';
          taskList.style.flex = '';
          taskList.style.overflowY = '';
        }
        renderTaskList();
      }
    });
  }

  // Stats button
  if (dom.showStatsBtn) dom.showStatsBtn.addEventListener('click', () => {
    state.view = (state.view === 'stats') ? 'day' : 'stats';
    renderTaskList();
  });


  // Archived button delegation (on bottom-bar)
  document.querySelector('.bottom-bar')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('#show-archived-btn');
    if (btn) {
      if (state.view === 'archived') {
        state.view = 'day';
      } else {
        state.view = 'archived';
      }
      renderTaskList();
      renderCalendar();
    }
  });
  
  // Subtask event delegation (on .task-panel - handles both #task-list and #mini-view)
  const taskPanel = document.querySelector('.task-panel');
  
  // ＋ add subtask
  taskPanel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-add-st]');
    if (btn) {
      const taskId = btn.dataset.id;
      const t = state.tasks.find(x => x.id === taskId);
      if (!t) return;
      const title = await showSubtaskPrompt();
      if (title && title.trim()) {
        const updatedSubtasks = [...t.subtasks, { id: crypto.randomUUID(), title: title.trim(), done: false }];
        await window.todoAPI.updateTask(taskId, { subtasks: updatedSubtasks });
        await reloadAndRender();
      }
      return;
    }
    
    // × delete subtask
    const delBtn = e.target.closest('[data-del-st]');
    if (delBtn) {
      const item = delBtn.closest('.subtask-item');
      if (!item) return;
      const card = item.closest('.task-card');
      if (!card) return;
      const taskId = card.dataset.taskId;
      const t = state.tasks.find(x => x.id === taskId);
      if (!t) return;
      const idx = parseInt(item.dataset.si);
      const updatedSubtasks = t.subtasks.filter((_, i) => i !== idx);
      await window.todoAPI.updateTask(taskId, { subtasks: updatedSubtasks });
      await reloadAndRender();
      return;
    }
    
    // ▼ collapse/expand
    const collapseBtn = e.target.closest('.subtask-collapse-btn');
    if (collapseBtn) {
      const target = document.getElementById(collapseBtn.dataset.target);
      if (target) {
        const collapsed = collapseBtn.classList.toggle('collapsed');
        target.style.display = collapsed ? 'none' : '';
      }
      return;
    }
  });
  
  // Subtask checkbox change (use change event via delegation)
  taskPanel.addEventListener('change', async (e) => {
    const cb = e.target.closest('.subtask-item input[type="checkbox"]');
    if (!cb) return;
    const item = cb.closest('.subtask-item');
    if (!item) return;
    const card = item.closest('.task-card');
    if (!card) return;
    const taskId = card.dataset.taskId;
    const t = state.tasks.find(x => x.id === taskId);
    if (!t) return;
    const idx = parseInt(item.dataset.si);
    const updatedSubtasks = [...t.subtasks];
    updatedSubtasks[idx] = { ...updatedSubtasks[idx], done: cb.checked };
    await window.todoAPI.updateTask(taskId, { subtasks: updatedSubtasks });
    if (cb.checked) {
      const lvSub = await window.todoAPI.addXp(2);
      if (lvSub && lvSub.leveledUp) showLevelUp(lvSub.newLevel);
    }
    await reloadAndRender();
    checkPerfectDay();
  });


}





// ---- XP / Level Display ----
function updateLevelDisplay() {
  const el = document.getElementById('level-display');
  if (!el) return;
  const { stats } = state;
  const xpForNext = stats.level * 50;
  const xpInLevel = stats.xp - ((stats.level - 1) * stats.level / 2 * 50);
  el.textContent = 'Lv.' + stats.level + ' · ' + stats.xp + ' XP';
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);

// ============================================
// Settings Dialog
// ============================================


// ---- Mini Mode ----
function renderMiniView() {
  const mv = document.getElementById('mini-view');
  if (!mv) return;
  const todayStr = getTodayStr();
  const dateObj = new Date(todayStr);
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateLabel = todayStr + ' ' + weekdays[dateObj.getDay()];
  
  // Render mini header in its own element
  const miniHeader = document.getElementById('mini-header');
  if (miniHeader) {
    miniHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-card);border-bottom:1px solid var(--border)';
    miniHeader.innerHTML = 
      '<span style="font-size:14px;font-weight:600">' + dateLabel + '</span>' +
      '<button class="btn-icon" id="mini-exit-btn" title="退出迷你模式" style="min-width:28px;min-height:28px;font-size:14px">⊞</button>';
    
    const exitBtn = miniHeader.querySelector('#mini-exit-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        const miniBtn = document.getElementById('mini-mode-btn');
        if (miniBtn) miniBtn.click();
      });
    }
  }
  
  let tasks = state.tasks.filter(t => {
    if (t.archived) return false;
    if (!t.dueDate) return false;
    return t.dueDate.startsWith(todayStr);
  }).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
  
  if (tasks.length === 0) {
    mv.innerHTML = '<div class="empty-state" style="padding:20px"><p>今日暂无任务</p></div>';
  } else {
    mv.innerHTML = tasks.map(task => renderMiniTaskCard(task)).join('');
    
    mv.querySelectorAll('.task-card').forEach(card => {
      const id = card.dataset.taskId;
      bindTaskEvents(card, id);
    });
  }
}

function renderMiniTaskCard(task) {
  const doneCount = task.subtasks.filter(s => s.done).length;
  const totalSubtasks = task.subtasks.length;
  const priorityLabel = { high: '高', medium: '中', low: '低' }[task.priority];
  
  return '<div class="task-card ' + (task.status === 'done' ? 'completed' : '') + '" data-task-id="' + task.id + '" style="padding:6px 10px;margin-bottom:4px">' +
    '<div class="task-body" style="min-width:0">' +
      '<div class="task-title-row">' +
        '<input type="checkbox" class="task-checkbox" ' + (task.status === 'done' ? 'checked' : '') + '>' +
        '<span class="task-title" style="font-size:13px">' + escapeHtml(task.title) + '</span>' +
      '</div>' +
      '<div class="task-meta" style="margin-top:2px">' +
        '<span class="priority-badge ' + task.priority + '">' + priorityLabel + '</span>' +
        (task.dueDate && task.dueDate !== state.selectedDate + 'T23:59:59' ? '<span style="font-size:11px;color:var(--fg-muted)">' + formatDueDate(task.dueDate) + '</span>' : '') +
      '</div>' +
      renderSubtasks(task) +
    '</div>' +
    '<div class="task-actions">' +
      '<button class="btn-icon" data-action="archive" title="归档" style="min-width:24px;min-height:24px;font-size:11px;font-weight:600">A</button>' +
      '<button class="btn-icon" data-action="delete" title="删除" style="min-width:24px;min-height:24px;font-size:12px">✕</button>' +
    '</div>' +
  '</div>';
}

function openSettings() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-content" style="min-width:420px">
    <h3>设置</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <!-- Theme -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold">主题</span>
        <select class="task-input" id="set-theme" style="width:auto">
          <option value="system" ${state.settings.darkMode === 'system' ? 'selected' : ''}>跟随系统</option>
          <option value="light" ${state.settings.darkMode === 'light' ? 'selected' : ''}>浅色</option>
          <option value="dark" ${state.settings.darkMode === 'dark' ? 'selected' : ''}>深色</option>
        </select>
      </div>
      <!-- Always on top -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold">窗口置顶</span>
        <input type="checkbox" id="set-alwaysontop" ${state.settings.alwaysOnTop ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
      </div>
      <!-- Sound -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold">提醒音效</span>
        <input type="checkbox" id="set-sound" ${state.settings.soundEnabled !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
      </div>
      <!-- Daily task limit -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold">每日任务限额</span>
        <input type="number" id="set-dailylimit" value="${state.settings.dailyTaskLimit || 0}" style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--fg)" min="0" max="50">
      </div>
      <hr style="border:none;border-top:1px solid var(--border)">
      <!-- Tags management -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-bold">标签管理</span>
        </div>
        <div id="tag-list" style="display:flex;flex-direction:column;gap:4px;max-height:180px;overflow-y:auto">
          ${state.tags.map(t => `<div class="flex items-center justify-between" data-tag-id="${t.id}" style="padding:4px 0">
            <div class="flex items-center gap-2">
              <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${t.color}"></span>
              <span>${escapeHtml(t.name)}</span>
            </div>
            <button class="btn-icon btn-xs" data-action="del-tag" data-tag-id="${t.id}" style="min-width:24px;min-height:24px;font-size:12px">✕</button>
          </div>`).join('')}
        </div>
        <div class="flex gap-2 mt-2">
          <input type="text" class="task-input" id="new-tag-name" placeholder="标签名称" style="flex:1">
          <input type="color" id="new-tag-color" value="#3b82f6" style="width:36px;height:32px;padding:2px;border:1px solid var(--border);border-radius:var(--radius-sm)">
          <button class="btn btn-primary btn-sm" id="add-tag-btn">添加</button>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="settings-close">关闭</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Theme change
  overlay.querySelector('#set-theme').addEventListener('change', async (e) => {
    const val = e.target.value;
    await window.todoAPI.updateSettings({ darkMode: val });
    state.settings.darkMode = val;
    if (val === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (val === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  });

  // Always on top
  overlay.querySelector('#set-alwaysontop').addEventListener('change', async (e) => {
    const val = e.target.checked;
    await window.todoAPI.setAlwaysOnTop(val);
    await window.todoAPI.updateSettings({ alwaysOnTop: val });
    state.settings.alwaysOnTop = val;
  });

  // Sound
  overlay.querySelector('#set-sound').addEventListener('change', async (e) => {
    await window.todoAPI.updateSettings({ soundEnabled: e.target.checked });
    state.settings.soundEnabled = e.target.checked;
  });

  // Daily limit
  overlay.querySelector('#set-dailylimit').addEventListener('change', async (e) => {
    const val = parseInt(e.target.value) || 0;
    await window.todoAPI.updateSettings({ dailyTaskLimit: val });
    state.settings.dailyTaskLimit = val;
  });

  // Add tag
  overlay.querySelector('#add-tag-btn').addEventListener('click', async () => {
    const nameInput = overlay.querySelector('#new-tag-name');
    const name = nameInput.value.trim();
    if (!name) return;
    const color = overlay.querySelector('#new-tag-color').value;
    await window.todoAPI.addTag(name, color);
    nameInput.value = '';
    overlay.remove();
    await reloadTags();
    openSettings();
  });

  // Delete tag
  overlay.querySelectorAll('[data-action="del-tag"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.tagId;
      await window.todoAPI.deleteTag(id);
      overlay.remove();
      await reloadTags();
      openSettings();
    });
  });

  overlay.querySelector('#settings-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
