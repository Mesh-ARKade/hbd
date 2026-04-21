/**
 * DashboardClient - Real-time dashboard client for HBD.
 * Refactored for High Fidelity, Source Registry, and Curator Identity.
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
      curatorProfile: document.getElementById('curator-profile'),
      githubUsername: document.getElementById('github-username'),
      githubAvatar: document.getElementById('github-avatar'),
    };

    this.init();
  }

  /**
   * Initialize the dashboard client.
   */
  async init() {
    this.setupEventListeners();
    this.connect();
    await this.fetchIdentity();
  }

  /**
   * Fetch the curator's identity from the server.
   */
  async fetchIdentity() {
    try {
      const response = await fetch('/api/identity');
      const data = await response.json();
      
      if (data.github) {
        // Update header profile
        this.elements.githubUsername.textContent = data.github.login;
        this.elements.githubAvatar.src = data.github.avatar_url || '';
        this.elements.curatorProfile.classList.remove('hidden');
        
        // Update nav bar curator ID
        const curatorId = document.getElementById('curator-id');
        const curatorAvatar = document.getElementById('curator-avatar');
        const curatorName = document.getElementById('curator-name');
        
        if (curatorId && curatorName) {
          curatorName.textContent = data.github.login;
          if (curatorAvatar && data.github.avatar_url) {
            curatorAvatar.src = data.github.avatar_url;
            curatorAvatar.alt = data.github.login;
          }
          curatorId.classList.remove('hidden');
        }
        
        this.logToTerminal('info', `Authenticated as curator: ${data.github.login}`);
      }
      
      if (data.p2p) {
        this.logToTerminal('info', `P2P Identity Loaded: ${data.p2p.publicKey.slice(0, 8)}...`);
      }
    } catch (error) {
      console.error('Failed to fetch identity:', error);
    }
  }

  /**
   * Setup DOM event listeners.
   */
  setupEventListeners() {
    this.elements.clearTerminal.addEventListener('click', () => {
      this.elements.terminal.innerHTML = '<div class="text-[#fcfdfa]/30 text-xs italic">Terminal cleared.</div>';
      this.terminalBuffer = [];
    });

    this.elements.pauseTerminal.addEventListener('click', () => {
      this.terminalPaused = !this.terminalPaused;
      this.elements.pauseTerminal.textContent = this.terminalPaused ? 'Resume' : 'Pause';
      this.elements.pauseTerminal.classList.toggle('text-[#f01532]', this.terminalPaused);
    });

    // Run All button
    const runAllBtn = document.getElementById('run-all-btn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => this.handleRunAll());
    }

    // Max Parallel dropdown
    const maxParallel = document.getElementById('max-parallel');
    if (maxParallel) {
      maxParallel.addEventListener('change', (e) => this.handleMaxParallelChange(e.target.value));
    }

    // Navigation tabs
    const navPipeline = document.getElementById('nav-pipeline');
    const navSettings = document.getElementById('nav-settings');
    if (navPipeline && navSettings) {
      navPipeline.addEventListener('click', (e) => {
        e.preventDefault();
        this.showPanel('pipeline');
      });
      navSettings.addEventListener('click', (e) => {
        e.preventDefault();
        this.showPanel('settings');
      });
    }

    // Settings panel
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }

    const githubAuthBtn = document.getElementById('github-auth-btn');
    if (githubAuthBtn) {
      githubAuthBtn.addEventListener('click', () => this.connectGitHub());
    }

    // Load initial settings
    this.loadSettings();
  }

  /**
   * Show a specific panel (pipeline or settings).
   */
  showPanel(panel) {
    const pipelineGrid = document.getElementById('pipeline-grid');
    const settingsPanel = document.getElementById('settings-panel');
    const navPipeline = document.getElementById('nav-pipeline');
    const navSettings = document.getElementById('nav-settings');

    if (panel === 'settings') {
      pipelineGrid?.classList.add('hidden');
      settingsPanel?.classList.remove('hidden');
      navSettings?.classList.add('text-[#33afa9]', 'border-b-2', 'border-[#33afa9]');
      navPipeline?.classList.remove('text-[#fcfdfa]', 'border-b-2', 'border-[#33afa9]');
    } else {
      pipelineGrid?.classList.remove('hidden');
      settingsPanel?.classList.add('hidden');
      navPipeline?.classList.add('text-[#fcfdfa]', 'border-b-2', 'border-[#33afa9]');
      navSettings?.classList.remove('text-[#33afa9]', 'border-b-2', 'border-[#33afa9]');
    }
  }

  /**
   * Load settings from server.
   */
  async loadSettings() {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        const mnemonicInput = document.getElementById('mnemonic-input');
        if (mnemonicInput && data.mnemonic) {
          mnemonicInput.value = data.mnemonic;
        }
        this.updateGitHubStatus(data.github);
      }
    } catch (error) {
      this.logToTerminal('error', `Failed to load settings: ${error.message}`);
    }
  }

  /**
   * Save settings to server.
   */
  async saveSettings() {
    const mnemonicInput = document.getElementById('mnemonic-input');
    const mnemonic = mnemonicInput?.value?.trim();

    if (!mnemonic) {
      this.logToTerminal('error', 'Mnemonic is required');
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic }),
      });

      const data = await response.json();
      if (data.success) {
        this.logToTerminal('info', 'Settings saved successfully');
      } else {
        this.logToTerminal('error', data.error || 'Failed to save settings');
      }
    } catch (error) {
      this.logToTerminal('error', `Save settings failed: ${error.message}`);
    }
  }

  /**
   * Connect GitHub account.
   */
  async connectGitHub() {
    this.logToTerminal('info', 'Starting GitHub authentication...');
    // This would trigger the device flow
    try {
      const response = await fetch('/api/auth/github/start', { method: 'POST' });
      const data = await response.json();
      if (data.verification_uri) {
        this.logToTerminal('info', `Please visit: ${data.verification_uri}`);
        this.logToTerminal('info', `User code: ${data.user_code}`);
      }
    } catch (error) {
      this.logToTerminal('error', `GitHub auth failed: ${error.message}`);
    }
  }

  /**
   * Update GitHub status display.
   */
  updateGitHubStatus(github) {
    const statusDot = document.getElementById('github-status-dot');
    const statusText = document.getElementById('github-status-text');
    const userDisplay = document.getElementById('github-user');
    const orgSection = document.getElementById('org-membership-section');
    const orgStatusDot = document.getElementById('org-status-dot');
    const orgStatusText = document.getElementById('org-status-text');

    if (github?.connected) {
      statusDot?.classList.remove('bg-yellow-500', 'bg-red-500');
      statusDot?.classList.add('bg-green-500');
      if (statusText) statusText.textContent = 'Connected';
      if (userDisplay) {
        userDisplay.classList.remove('hidden');
        userDisplay.querySelector('span').textContent = github.login;
      }
      orgSection?.classList.remove('hidden');
      if (github.orgMember) {
        orgStatusDot?.classList.remove('bg-red-500');
        orgStatusDot?.classList.add('bg-green-500');
        if (orgStatusText) {
          orgStatusText.textContent = 'Member';
          orgStatusText.classList.remove('text-red-400');
          orgStatusText.classList.add('text-green-400');
        }
      }
    } else {
      statusDot?.classList.remove('bg-green-500', 'bg-yellow-500');
      statusDot?.classList.add('bg-red-500');
      if (statusText) statusText.textContent = 'Disconnected';
      userDisplay?.classList.add('hidden');
      orgSection?.classList.add('hidden');
    }
  }

  /**
   * Handle Run All button click.
   */
  async handleRunAll() {
    try {
      this.logToTerminal('info', 'Triggering entire pipeline...');
      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: 'all' }),
      });

      const data = await response.json();
      if (!data.success) {
        this.logToTerminal('error', data.error || 'Failed to start sources');
      }
    } catch (error) {
      this.logToTerminal('error', `Run All failed: ${error.message}`);
    }
  }

  /**
   * Start a specific source.
   */
  async startSource(sourceId) {
    try {
      this.logToTerminal('info', `Starting source: ${sourceId}...`);
      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      const data = await response.json();
      if (!data.success) {
        this.logToTerminal('error', data.error || `Failed to start ${sourceId}`);
      }
    } catch (error) {
      this.logToTerminal('error', `Start ${sourceId} failed: ${error.message}`);
    }
  }

  /**
   * Handle Max Parallel change.
   */
  async handleMaxParallelChange(value) {
    const max = parseInt(value, 10);
    try {
      const response = await fetch('/api/pipeline/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxConcurrent: max }),
      });

      const data = await response.json();
      if (data.success) {
        this.logToTerminal('info', `Max parallel set to ${data.maxConcurrent}`);
      }
    } catch (error) {
      this.logToTerminal('error', `Config update failed: ${error.message}`);
    }
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
      
      // Join the dashboard room
      this.socket.emit('room:join', 'dashboard');
      
      // Register default sources on connect
      this.registerDefaultSources();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
    });

    this.socket.on('state:update', (state) => {
      this.handleStateUpdate(state);
    });

    this.socket.on('log:entry', (log) => {
      this.handleLogEntry(log);
    });
  }

  /**
   * Register default preservation sources.
   */
  registerDefaultSources() {
    const defaultSources = [
      { id: 'nointro', name: 'No-Intro', description: 'Cartridge-based systems preservation standard' },
      { id: 'redump', name: 'Redump', description: 'Optical media preservation standard' },
      { id: 'tosec', name: 'TOSEC', description: 'The Old School Emulation Center catalog' },
      { id: 'mame', name: 'MAME', description: 'Multiple Arcade Machine Emulator software list' },
    ];

    // Only register if no sources exist yet
    if (this.sources.size === 0) {
      defaultSources.forEach(source => {
        this.sources.set(source.id, {
          ...source,
          status: 'idle',
          progress: 0,
          phase: 'Ready',
        });
      });
      
      // Render the sources
      this.renderSourceRegistry();
      this.logToTerminal('info', 'Source registry loaded: No-Intro, Redump, TOSEC, MAME');
    }
  }

  /**
   * Render the source registry cards.
   */
  renderSourceRegistry() {
    const grid = this.elements.pipelineGrid;
    if (!grid) return;

    grid.innerHTML = '';

    for (const [id, source] of this.sources) {
      const card = this.createSourceCard(id, source);
      grid.appendChild(card);
    }
  }

  /**
   * Create a source card element.
   */
  createSourceCard(id, source) {
    const div = document.createElement('div');
    div.className = 'glass-card rounded-2xl p-6 source-card';
    div.id = `source-${id}`;

    const statusColors = {
      idle: 'text-white/40',
      pending: 'text-yellow-400',
      running: 'text-[#33afa9]',
      completed: 'text-green-400',
      error: 'text-[#f01532]',
    };

    div.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3 class="text-lg font-bold tracking-tight">${source.name}</h3>
          <p class="text-[11px] text-white/40 mt-1">${source.description || ''}</p>
        </div>
        <span class="text-[10px] font-mono uppercase tracking-wider ${statusColors[source.status] || 'text-white/40'}">
          ${source.status}
        </span>
      </div>
      <div class="w-full bg-white/5 rounded-full h-1.5 mb-4">
        <div class="progress-fill bg-[#33afa9] h-1.5 rounded-full transition-all duration-500" style="width: ${source.progress || 0}%"></div>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-white/30 font-mono">${source.phase || 'Ready'}</span>
        <button class="source-start-btn px-3 py-1.5 bg-[#33afa9]/10 border border-[#33afa9]/30 rounded text-[10px] font-bold uppercase tracking-wider text-[#33afa9] hover:bg-[#33afa9]/20 transition-all" data-source="${id}">
          Start
        </button>
      </div>
    `;

    // Add start button handler
    const startBtn = div.querySelector('.source-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startSource(id));
    }

    return div;
  }

  /**
   * Start a specific source.
   */
  async startSource(sourceId) {
    try {
      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      const data = await response.json();
      if (data.success) {
        this.logToTerminal('info', `Started ${sourceId}`);
      } else {
        this.logToTerminal('error', data.error || `Failed to start ${sourceId}`);
      }
    } catch (error) {
      this.logToTerminal('error', `Start ${sourceId} failed: ${error.message}`);
    }
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
  }

  /**
   * Update source cards in the grid.
   */
  updateSources(sources) {
    // If no sources from server, the registry in the engine will handle the 'Idle' state
    // But we iterate what we get to ensure cards are updated or created
    for (const [id, source] of Object.entries(sources)) {
      this.updateSourceCard(id, source);
    }
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

    this.renderSourceCard(card, id, source);
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
  renderSourceCard(card, id, source) {
    const statusConfig = this.getStatusConfig(source.status);
    
    // Standard phases to display
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

      // Calculate progress width for this specific phase
      const progressWidth = isCompleted ? 100 : (isActive ? source.progress % 34 * 3 : 0);
      
      phasesHtml += `
        <div>
          <div class="flex justify-between items-end mb-2">
            <span class="step-label ${labelClass}">${stepNum}. ${phase} Phase</span>
            <span class="${isActive ? 'text-[#fcfdfa]' : 'text-white/40'} font-mono text-[10px] ${isActive ? 'font-bold' : ''}">${Math.round(progressWidth)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${source.status === 'error' && isActive ? 'bg-[#f01532]' : isCompleted ? 'bg-[#0e3754]' : isActive ? 'bg-[#c9f1f2]' : 'bg-transparent'}" style="width: ${progressWidth}%"></div>
          </div>
        </div>
      `;
    });

    const errorHtml = source.error ? `
      <div class="mt-4 p-3 bg-[#f01532]/10 border-l-2 border-[#f01532] text-[10px] font-mono text-[#fcfdfa]/80">
        ERR: ${source.error}
      </div>
    ` : '';

    const isRunning = source.status === 'running' || source.status === 'pending';

    card.className = `glass-card p-10 flex flex-col justify-between min-h-[340px] rounded-2xl ${source.status === 'error' ? 'error-state' : ''} ${source.status === 'completed' ? 'bg-[#33afa9]/5 border-[#33afa9]/20' : ''}`;

    card.innerHTML = `
      <div class="flex justify-between items-start mb-12">
        <div>
          <h2 class="text-3xl font-black font-['Outfit'] uppercase text-[#fcfdfa] mb-1 tracking-tight">${source.name || id}</h2>
          <span class="text-[10px] font-bold text-[#c9f1f2] uppercase tracking-[0.2em] bg-[#0e3754]/50 px-2 py-1 rounded-sm border border-[#0e3754]">${source.description || 'Data Source'}</span>
        </div>
        <div class="flex flex-col items-end gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 ${statusConfig.bgClass} border ${statusConfig.borderClass} rounded-md">
            ${statusConfig.icon}
            <span class="${statusConfig.textClass} text-[10px] uppercase font-bold tracking-widest">${statusConfig.label}</span>
          </div>
          ${!isRunning ? `
            <button onclick="dashboard.startSource('${id}')" class="source-btn px-4 py-1.5 rounded text-[9px] font-black uppercase tracking-widest text-[#33afa9]">
              Start Scrape
            </button>
          ` : ''}
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
      'idle': {
        label: 'Idle',
        bgClass: 'bg-white/5',
        borderClass: 'border-white/10',
        textClass: 'text-white/40',
        icon: '<div class="w-1.5 h-1.5 rounded-full bg-white/20"></div>',
      },
      'pending': {
        label: 'Queued',
        bgClass: 'bg-[#fcfdfa]/10',
        borderClass: 'border-[#fcfdfa]/30',
        textClass: 'text-white',
        icon: '<svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>',
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
        bgClass: 'bg-[#33afa9]/10',
        borderClass: 'border-[#33afa9]/20',
        textClass: 'text-[#33afa9]',
        icon: '<svg class="w-3 h-3 text-[#33afa9]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>',
      },
      'error': {
        label: 'Error',
        bgClass: 'bg-[#f01532]/10',
        borderClass: 'border-[#f01532]/30',
        textClass: 'text-[#f01532]',
        icon: '<div class="w-1.5 h-1.5 rounded-full bg-[#f01532]"></div>',
      },
    };

    return configs[status] || configs['idle'];
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
      'trace': 'text-white/20',
      'debug': 'text-white/40',
      'info': 'text-[#fcfdfa]',
      'warn': 'text-[#ffd93d]',
      'error': 'text-[#ff6b6b]',
      'fatal': 'text-[#f01532] font-bold',
    };

    entry.innerHTML = `
      <span class="text-white/20 font-mono">[${timestamp}]</span>
      <span class="${levelColors[level] || 'text-[#fcfdfa]'}">${this.escapeHtml(message)}</span>
      ${meta.source ? `<span class="text-[#33afa9] ml-2 font-mono text-[9px] uppercase tracking-tighter">${meta.source}</span>` : ''}
    `;

    terminal.appendChild(entry);

    while (terminal.children.length > this.maxTerminalEntries) {
      terminal.removeChild(terminal.firstChild);
    }

    if (!this.terminalPaused) {
      terminal.scrollTop = terminal.scrollHeight;
    }
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
