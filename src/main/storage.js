const { app } = require('electron');
const path = require('path');
const fs = require('fs');
function _uuidv4() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8); return v.toString(16); }); }

class Storage {
  constructor() {
this.dataDir = path.join(app.getPath('userData'), 'data');
    this.tasksFile = path.join(this.dataDir, 'tasks.json');
    this.tagsFile = path.join(this.dataDir, 'tags.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    
    this.data = {
      tasks: [],
      tags: [],
      stats: { xp: 0, level: 1, perfectDays: [] },
      history: { stack: [], pointer: -1 },
      settings: {
        alwaysOnTop: false,
        darkMode: 'system', // 'light' | 'dark' | 'system'
        sortBy: 'createdAt',
        sortOrder: 'desc',
        soundEnabled: true,
        dailyTaskLimit: 0, // 0 = no limit
        miniMode: false
      }
    };

    this._ensureDataDir();
    this._loadAll();
  }

  _ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  _loadAll() {
    this.data.tasks = this._loadFile(this.tasksFile, []);
    this.data.tags = this._loadFile(this.tagsFile, []);
    this.data.stats = this._loadFile(this.statsFile, { xp: 0, level: 1, perfectDays: [] });
    this.data.history = this._loadFile(this.historyFile, { stack: [], pointer: -1 });
    this.data.settings = this._loadFile(this.settingsFile, this.data.settings);
  }

  _loadFile(filePath, defaultVal) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error(`Failed to load ${filePath}:`, e.message);
    }
    return JSON.parse(JSON.stringify(defaultVal));
  }

  _saveFile(filePath, data) {
    try {
      this._ensureDataDir();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Failed to save ${filePath}:`, e.message);
    }
  }

  // ---- Tasks ----
  getTasks() { return this.data.tasks; }

  addTask(taskData) {
    const task = {
      id: _uuidv4(),
      title: taskData.title || '',
      description: taskData.description || '',
      dueDate: taskData.dueDate || null,
      priority: taskData.priority || 'medium',
      tagId: taskData.tagId || null,
      status: 'todo',
      subtasks: taskData.subtasks || [],
      createdAt: new Date().toISOString(),
      completedAt: null,
      archived: false
    };
    this.data.tasks.push(task);
    this._saveFile(this.tasksFile, this.data.tasks);
    this._pushHistory('add', task.id, null);
    return task;
  }

  updateTask(id, updates) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const old = { ...this.data.tasks[idx] };
    Object.assign(this.data.tasks[idx], updates);
    this._saveFile(this.tasksFile, this.data.tasks);
    this._pushHistory('update', id, old);
    return this.data.tasks[idx];
  }

  deleteTask(id) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const old = { ...this.data.tasks[idx] };
    this.data.tasks.splice(idx, 1);
    this._saveFile(this.tasksFile, this.data.tasks);
    this._pushHistory('delete', id, old);
    return true;
  }

  archiveTask(id) {
    return this.updateTask(id, { archived: true });
  }

  unarchiveTask(id) {
    return this.updateTask(id, { archived: false });
  }

  // ---- Tags ----
  getTags() { return this.data.tags; }

  addTag(name, color) {
    const tag = { id: _uuidv4(), name, color: color || '#3b82f6' };
    this.data.tags.push(tag);
    this._saveFile(this.tagsFile, this.data.tags);
    return tag;
  }

  updateTag(id, updates) {
    const idx = this.data.tags.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(this.data.tags[idx], updates);
    this._saveFile(this.tagsFile, this.data.tags);
    return this.data.tags[idx];
  }

  deleteTag(id) {
    const idx = this.data.tags.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.tags.splice(idx, 1);
    // Remove tag reference from tasks
    for (const task of this.data.tasks) {
      if (task.tagId === id) task.tagId = null;
    }
    this._saveFile(this.tagsFile, this.data.tags);
    this._saveFile(this.tasksFile, this.data.tasks);
    return true;
  }

  // ---- Stats ----
  getStats() { return this.data.stats; }

  addXp(amount) {
    this.data.stats.xp += amount;
    // Level formula: each level needs level * 50 XP (level 1->2 needs 50, 2->3 needs 100, etc.)
    let newLevel = 1;
    let xpNeeded = 0;
    for (let lv = 1; lv < 100; lv++) {
      xpNeeded += lv * 50;
      if (this.data.stats.xp >= xpNeeded) newLevel = lv + 1;
      else break;
    }
    const leveledUp = newLevel > this.data.stats.level;
    this.data.stats.level = newLevel;
    this._saveFile(this.statsFile, this.data.stats);
    return { leveledUp, newLevel, xp: this.data.stats.xp };
  }

  addPerfectDay(dateStr) {
    if (!this.data.stats.perfectDays.includes(dateStr)) {
      this.data.stats.perfectDays.push(dateStr);
      this._saveFile(this.statsFile, this.data.stats);
    }
  }

  isPerfectDay(dateStr) {
    const tasksForDate = this.data.tasks.filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate.startsWith(dateStr);
    });
    if (tasksForDate.length === 0) return false;
    return tasksForDate.every(t => t.status === 'done');
  }

  // ---- History (Undo/Redo) ----
  _pushHistory(action, taskId, oldData) {
    const hist = this.data.history;
    hist.stack = hist.stack.slice(0, hist.pointer + 1);
    hist.stack.push({ action, taskId, oldData, timestamp: Date.now() });
    // Keep max 50 entries
    if (hist.stack.length > 50) hist.stack.shift();
    hist.pointer = hist.stack.length - 1;
    this._saveFile(this.historyFile, hist);
  }

  undo() {
    const hist = this.data.history;
    if (hist.pointer < 0) return null;
    const entry = hist.stack[hist.pointer];
    hist.pointer--;
    
    if (entry.action === 'add') {
      this.data.tasks = this.data.tasks.filter(t => t.id !== entry.taskId);
    } else if (entry.action === 'delete') {
      this.data.tasks.push(entry.oldData);
    } else if (entry.action === 'update') {
      const idx = this.data.tasks.findIndex(t => t.id === entry.taskId);
      if (idx !== -1) this.data.tasks[idx] = entry.oldData;
    }
    
    this._saveFile(this.tasksFile, this.data.tasks);
    this._saveFile(this.historyFile, hist);
    return entry;
  }

  redo() {
    const hist = this.data.history;
    if (hist.pointer >= hist.stack.length - 1) return null;
    hist.pointer++;
    const entry = hist.stack[hist.pointer];
    
    if (entry.action === 'add') {
      this.data.tasks.push(entry.oldData);
    } else if (entry.action === 'delete') {
      this.data.tasks = this.data.tasks.filter(t => t.id !== entry.taskId);
    }
    // update redo is a no-op (undo restores oldData directly)
    
    this._saveFile(this.tasksFile, this.data.tasks);
    this._saveFile(this.historyFile, hist);
    return entry;
  }

  // ---- Settings ----
  getSettings() { return this.data.settings; }

  updateSettings(updates) {
    Object.assign(this.data.settings, updates);
    this._saveFile(this.settingsFile, this.data.settings);
    return this.data.settings;
  }
}

module.exports = { Storage };
