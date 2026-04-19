/**
 * DashboardClient - Real-time dashboard client for HBD.
 * Handles Socket.io connections and DOM updates.
 * @packageDocumentation
 */

class DashboardClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.terminalPaused = false;
    this.terminalBuffer = [];
    this.maxTerminalEntries = 100;
    this.sources = new Map();

    // DOM elements
    this.elements = {
      connectionDot: document.getElementById('connection-dot'),
      connectionText: document.getElementById('connection-text'),
      syncStatus: document.getElementById('sync-status'),
      overallPercent: document.getElementById('overall-percent'),
      overallProgress: document.getElementById('overall-progress'),
      activeSources: document.getElementById('active-sources'),
      completedSources: document.getElementById('completed-sources'),
      errorSources: document.getElementById('error-sources'),
      pipelineGrid: document.getElementById('pipeline-grid'),
      terminal: document.getElementById('terminal'),
      clearTerminal: document.getElementById('clear-terminal'),
      pauseTerminal: document.getElementById('pause-terminal'),
    };

    this.init();
  }

  /**
   * Initialize the dashboard client.
   */
  init() {
    this.setupEventListeners();
    this.connect();
  }

  /**
   * Setup DOM event listeners.
   */
  setupEventListeners() {
    this.elements.clearTerminal.addEventListener('click', () => {
      this.elements.terminal.innerHTML = '';
      this.terminalBuffer = [];
    });

    this.elements.pauseTerminal.addEventListener('click', () => {
      this.terminalPaused = !this.terminalPaused;
      this.elements.pauseTerminal.textContent = this.terminalPaused ? 'Resume' : 'Pause';
      this.elements.pauseTerminal.classList.toggle('text-[#f01532]', this.terminalPaused);
    });
  }

  /**
   * Connect to the Socket.io server.
   */
  connect() {
    this.updateConnectionStatus('connecting');

    this.socket = io();

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.updateConnectionStatus('connected');
      this.logToTerminal('info', 'Connected to HBD dashboard server');
      
      // Join the dashboard room
      this.socket.emit('room:join', 'dashboard');
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      this.logToTerminal('error', 'Disconnected from server');
    });

    this.socket.on('connection:ack', (data) => {
      console.log('Connection acknowledged:', data);
    });

    this.socket.on('state:update', (state) => {
      this.handleStateUpdate(state);
    });

    this.socket.on('log:entry', (log) => {
      this.handleLogEntry(log);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.updateConnectionStatus('disconnected');
      this.logToTerminal('error', `Connection error: ${error.message}`);
    });
  }

  /**
   * Update the connection status indicator.
   */
  updateConnectionStatus(status) {
    const dot = this.elements.connectionDot;
    const text = this.elements.connectionText;

    dot.classList.remove('connected', 'disconnected', 'connecting');

    switch (status) {
      case 'connected':
        dot.classList.add('connected');
        text.textContent = 'Live';
        text.classList.remove('text-white/40');
        text.classList.add('text-[#33afa9]');
        break;
      case 'disconnected':
        dot.classList.add('disconnected');
        text.textContent = 'Offline';
        text.classList.remove('text-[#33afa9]');
        text.classList.add('text-[#f01532]');
        break;
      case 'connecting':
        dot.classList.add('connecting');
        text.textContent = 'Connecting...';
        break;
    }
  }

  /**
   * Handle state update from server.
   */
  handleStateUpdate(state) {
    this.updateOverallProgress(state.overall);
    this.updateSources(state.sources);
    this.updateSyncStatus(state.overall.status);
  }

  /**
   * Update overall progress display.
   */
  updateOverallProgress(overall) {
    this.elements.overallPercent.textContent = `${overall.progress}%`;
    this.elements.overallProgress.style.width = `${overall.progress}%`;
    this.elements.activeSources.textContent = `${overall.activeSources} Active`;
    this.elements.completedSources.textContent = `${overall.completedSources} Completed`;
    this.elements.errorSources.textContent = `${overall.errorSources} Errors`;

    // Color based on status
    const progressBar = this.elements.overallProgress;
    progressBar.classList.remove('bg-[#33afa9]', 'bg-[#f01532]', 'bg-[#c9f1f2]');
    
    if (overall.errorSources > 0) {
      progressBar.classList.add('bg-[#f01532]');
    } else if (overall.status === 'completed') {
      progressBar.classList.add('bg-[#c9f1f2]');
    } else {
      progressBar.classList.add('bg-[#33afa9]');
    }
  }

  /**
   * Update sync status text.
   */
  updateSyncStatus(status) {
    const statusText = {
      'idle': 'Status: Idle',
      'pending': 'Status: Pending',
      'running': 'Status: Real-time Sync',
      'completed': 'Status: Sync Complete',
      'error': 'Status: Errors Detected',
    };
    this.elements.syncStatus.textContent = statusText[status] || `Status: ${status}`;
    
    if (status === 'error') {
      this.elements.syncStatus.classList.add('text-[#f01532]');
      this.elements.syncStatus.classList.remove('text-[#c9f1f2]');
    } else {
      this.elements.syncStatus.classList.remove('text-[#f01532]');
      this.elements.syncStatus.classList.add('text-[#c9f1f2]');
    }
  }

  /**
   * Update source cards in the grid.
   */
  updateSources(sources) {
    // Clear grid if no sources
    if (Object.keys(sources).length === 0) {
      this.elements.pipelineGrid.innerHTML = `
        <div class="glass-card p-10 flex items-center justify-center min-h-[200px] rounded-2xl opacity-50">
          <span class="text-[#fcfdfa]/30 text-sm uppercase tracking-widest">No sources configured</span>
        </div>
      `;
      return;
    }

    // Update or create source cards
    for (const [id, source] of Object.entries(sources)) {
      this.updateSourceCard(id, source);
    }

    // Remove cards for deleted sources
    const currentIds = Object.keys(sources);
    this.elements.pipelineGrid.querySelectorAll('[data-source-id]').forEach(card => {
      const cardId = card.getAttribute('data-source-id');
      if (!currentIds.includes(cardId)) {
        card.remove();
      }
    });
  }

  /**
   * Update or create a single source card.
   */
  updateSourceCard(id, source) {
    let card = this.elements.pipelineGrid.querySelector(`[data-source-id="${id}"]`);

    if (!card) {
      card = this.createSourceCard(id);
      this.elements.pipelineGrid.appendChild(card);
    }

    // Update card content
    this.renderSourceCard(card, source);
  }

  /**
   * Create a new source card element.
   */
  createSourceCard(id) {
    const card = document.createElement('div');
    card.setAttribute('data-source-id', id);
    card.className = 'glass-card p-10 flex flex-col justify-between min-h-[340px] rounded-2xl';
    return card;
  }

  /**
   * Render source card content.
   */
  renderSourceCard(card, source) {
    const statusConfig = this.getStatusConfig(source.status);
    const phases = ['Fetch', 'Sort', 'Parse'];
    
    let phasesHtml = '';
    phases.forEach((phase, index) => {
      const stepNum = index + 1;
      const isActive = source.phase && source.phase.toLowerCase().includes(phase.toLowerCase());
      const isCompleted = source.progress >= ((stepNum / 3) * 100);
      
      let labelClass = '';
      if (source.status === 'error' && isActive) {
        labelClass = 'failed';
      } else if (isCompleted) {
        labelClass = 'completed';
      } else if (isActive) {
        labelClass = 'active';
      }

      const progress = Math.min(100, Math.max(0, source.progress - (index * 33.33)) * 3);
      const progressWidth = isCompleted ? 100 : (isActive ? progress : 0);
      
      phasesHtml += `
        <div class="${index === 2 ? 'opacity-30' : ''}">
          <div class="flex justify-between items-end mb-2">
            <span class="step-label ${labelClass}">${stepNum}. ${phase} Phase</span>
            <span class="${isActive ? 'text-[#fcfdfa]' : 'text-white/40'} font-mono text-[10px] ${isActive ? 'font-bold' : ''}">${Math.round(progressWidth)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${source.status === 'error' && isActive ? 'bg-[#f01532]' : isCompleted ? 'bg-[#0e3754]' : isActive ? 'bg-[#c9f1f2]' : 'bg-transparent'}" style="width: ${progressWidth}%"></div>
          </div>
          ${isActive && source.phase ? `
            <div class="flex justify-between mt-1.5">
              <p class="text-[9px] ${source.status === 'error' ? 'text-[#f01532]' : 'text-[#33afa9]'} uppercase tracking-widest font-mono">${source.phase}</p>
              ${source.status === 'running' ? '<p class="text-[9px] text-white/40 font-mono">In Progress</p>' : ''}
            </div>
          ` : ''}
        </div>
      `;
    });

    const errorHtml = source.error ? `
      <div class="mt-2 p-2 bg-[#f01532]/10 border-l-2 border-[#f01532] text-xs font-mono text-[#fcfdfa]/80">
        ERR: ${source.error}
      </div>
    ` : '';

    card.className = `glass-card p-10 flex flex-col justify-between min-h-[340px] rounded-2xl ${source.status === 'error' ? 'error-state' : ''} ${source.status === 'completed' ? 'bg-[#33afa9]/5 border-[#33afa9]/20' : ''}`;

    card.innerHTML = `
      <div class="flex justify-between items-start mb-12">
        <div>
          <h2 class="text-3xl font-black font-['Outfit'] uppercase text-[#fcfdfa] mb-1 tracking-tight">${source.name || id}</h2>
          <span class="text-[10px] font-bold text-[#c9f1f2] uppercase tracking-[0.2em] bg-[#0e3754]/50 px-2 py-1 rounded-sm border border-[#0e3754]">${source.description || 'Data Source'}</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 ${statusConfig.bgClass} border ${statusConfig.borderClass} rounded-md">
          ${statusConfig.icon}
          <span class="${statusConfig.textClass} text-[10px] uppercase font-bold tracking-widest">${statusConfig.label}</span>
        </div>
      </div>

      <div class="space-y-6">
        ${phasesHtml}
        ${errorHtml}
      </div>
    `;
  }

  /**
   * Get status configuration for styling.
   */
  getStatusConfig(status) {
    const configs = {
      'pending': {
        label: 'Pending',
        bgClass: 'bg-[#fcfdfa]/10',
        borderClass: 'border-[#fcfdfa]/30',
        textClass: 'text-white',
        icon: '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>',
      },
      'running': {
        label: 'Processing',
        bgClass: 'bg-[#33afa9]/10',
        borderClass: 'border-[#33afa9]/30',
        textClass: 'text-[#33afa9]',
        icon: '<div class="w-1.5 h-1.5 rounded-full bg-[#33afa9] animate-pulse"></div>',
      },
      'completed': {
        label: 'Synced',
        bgClass: 'bg-[#fcfdfa]/5',
        borderClass: 'border-white/10',
        textClass: 'text-white/60',
        icon: '<svg class="w-3 h-3 text-[#33afa9]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>',
      },
      'error': {
        label: 'Error',
        bgClass: 'bg-[#f01532]/10',
        borderClass: 'border-[#f01532]/30',
        textClass: 'text-[#f01532]',
        icon: '<div class="w-1.5 h-1.5 rounded-full bg-[#f01532]"></div>',
      },
      'cancelled': {
        label: 'Cancelled',
        bgClass: 'bg-[#fcfdfa]/5',
        borderClass: 'border-white/10',
        textClass: 'text-white/40',
        icon: '<svg class="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
      },
    };

    return configs[status] || configs['pending'];
  }

  /**
   * Handle log entry from server.
   */
  handleLogEntry(log) {
    if (this.terminalPaused) {
      this.terminalBuffer.push(log);
      return;
    }

    this.logToTerminal(this.getLogLevel(log.level), log.msg, log);
  }

  /**
   * Get log level name from Pino level number.
   */
  getLogLevel(level) {
    const levels = {
      10: 'trace',
      20: 'debug',
      30: 'info',
      40: 'warn',
      50: 'error',
      60: 'fatal',
    };
    return levels[level] || 'info';
  }

  /**
   * Add entry to terminal.
   */
  logToTerminal(level, message, meta = {}) {
    const terminal = this.elements.terminal;
    const entry = document.createElement('div');
    entry.className = `terminal-entry ${level}`;

    const timestamp = new Date(meta.time || Date.now()).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const levelColors = {
      'trace': 'text-white/30',
      'debug': 'text-white/50',
      'info': 'text-[#fcfdfa]',
      'warn': 'text-[#ffd93d]',
      'error': 'text-[#ff6b6b]',
      'fatal': 'text-[#f01532] font-bold',
    };

    entry.innerHTML = `
      <span class="text-white/30">[${timestamp}]</span>
      <span class="${levelColors[level] || 'text-[#fcfdfa]'}">${this.escapeHtml(message)}</span>
      ${meta.source ? `<span class="text-[#33afa9] ml-2">[${meta.source}]</span>` : ''}
    `;

    terminal.appendChild(entry);

    // Limit entries
    while (terminal.children.length > this.maxTerminalEntries) {
      terminal.removeChild(terminal.firstChild);
    }

    // Auto-scroll
    terminal.scrollTop = terminal.scrollHeight;
  }

  /**
   * Escape HTML special characters.
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new DashboardClient();
});
