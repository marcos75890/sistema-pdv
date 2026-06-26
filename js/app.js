/* =====================================================================
   app.js — Núcleo da aplicação
   • Boot / sessão / login
   • Router por hash (SPA)
   • Tema (dark/light)
   • Utilitários (formatação, datas, helpers)
   • Componentes reutilizáveis (toast, modal, confirm, KPI, tabela…)
   • Busca global
   ===================================================================== */
window.App = (function () {
  'use strict';

  const App = {
    modules: {},
    current: null,
    user: null,
    empresa: {},

    /* ============ REGISTRO DE MÓDULOS ============ */
    registerModule(name, mod) { this.modules[name] = mod; },

    /* ============ BOOT ============ */
    async boot() {
      await Store.init();
      this.empresa = await Store.getEmpresa();
      const cfg = await Store.getConfig();
      this.applyTheme(cfg.tema || 'light');

      this._bindGlobalEvents();

      // sessão
      const sess = sessionGet();
      if (sess) { this.user = sess; this._enterApp(); }
      else { this._showLogin(); }

      // reatividade: redesenha "chrome" quando dados mudam
      Store.subscribe(() => this.refreshChrome());
    },

    _showLogin() {
      document.getElementById('app').classList.add('d-none');
      const ls = document.getElementById('loginScreen');
      ls.classList.remove('d-none');
      document.getElementById('loginEmpresa').textContent = this.empresa.nome || 'Gestão Comercial';
      const form = document.getElementById('loginForm');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginUser').value.trim().toLowerCase();
        const pass = document.getElementById('loginPass').value;
        const users = await Store.list('usuarios');
        const u = users.find((x) => (x.email || '').toLowerCase() === email && String(x.senha) === pass);
        if (u || (email === 'admin@empresa.com' && pass === 'admin')) {
          this.user = u || { nome: 'Administrador', papel: 'Administrador', email };
          sessionSet(this.user);
          this._enterApp();
          this.toast('Bem-vindo, ' + this.user.nome + '!', 'success');
        } else {
          this.toast('Usuário ou senha inválidos.', 'danger');
        }
      };
    },

    _enterApp() {
      document.getElementById('loginScreen').classList.add('d-none');
      document.getElementById('app').classList.remove('d-none');
      this.refreshChrome();
      window.addEventListener('hashchange', () => this._route());
      this._route();
    },

    logout() {
      sessionClear();
      location.hash = '';
      location.reload();
    },

    /* ============ ROUTER ============ */
    _route() {
      let name = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
      if (!this.modules[name]) name = 'dashboard';
      this.current = name;
      document.querySelectorAll('#mainNav .nav-link').forEach((a) =>
        a.classList.toggle('active', a.dataset.route === name));
      document.querySelector('.app-shell').classList.remove('nav-open');

      const view = document.getElementById('view');
      view.innerHTML = '';
      view.scrollTop = 0;
      window.scrollTo(0, 0);
      try {
        this.modules[name].render(view);
      } catch (err) {
        console.error(err);
        view.innerHTML = `<div class="empty"><i class="bi bi-exclamation-triangle"></i>
          <p>Erro ao carregar o módulo "${name}".</p><small>${this.escape(err.message)}</small></div>`;
      }
    },

    navigate(route) { location.hash = '#/' + route; },

    /* ============ TEMA ============ */
    applyTheme(theme) {
      document.documentElement.setAttribute('data-bs-theme', theme);
      Store.setConfig({ tema: theme });
      // re-renderiza gráficos do módulo atual (cores dependem do tema)
      if (this.current && this.modules[this.current] && this._booted) this._route();
    },
    toggleTheme() {
      this._booted = true;
      const cur = document.documentElement.getAttribute('data-bs-theme');
      this.applyTheme(cur === 'dark' ? 'light' : 'dark');
    },

    /* ============ CHROME (sidebar/topbar bindings) ============ */
    async refreshChrome() {
      this.empresa = await Store.getEmpresa();
      const u = this.user || {};
      const set = (k, v) => document.querySelectorAll(`[data-bind="${k}"]`).forEach((el) => (el.textContent = v));
      set('empresaNome', this.empresa.nome || 'Gestão Comercial');
      set('userNome', u.nome || 'Usuário');
      set('userPapel', u.papel || '—');
      set('userInitials', initials(u.nome || 'Usuário'));
      // badge de contas a receber pendentes
      const cr = await Store.list('contasReceber', (c) => c.status !== 'recebido');
      const badge = cr.length ? String(cr.length) : '';
      document.querySelectorAll('[data-bind="badgeReceber"]').forEach((el) => (el.textContent = badge));
    },

    /* ============ EVENTOS GLOBAIS ============ */
    _bindGlobalEvents() {
      document.body.addEventListener('click', (e) => {
        const r = e.target.closest('[data-route]');
        if (r) { e.preventDefault(); this.navigate(r.dataset.route); return; }
        const a = e.target.closest('[data-action]');
        if (!a) return;
        const act = a.dataset.action;
        if (act === 'toggle-sidebar') document.querySelector('.app-shell').classList.toggle('nav-open');
        else if (act === 'toggle-theme') this.toggleTheme();
        else if (act === 'logout') this.logout();
        else if (act === 'backup') this.doBackup();
      });

      // busca global
      const gs = document.getElementById('globalSearch');
      if (gs) {
        gs.addEventListener('input', this.debounce((e) => this._globalSearch(e.target.value), 180));
        gs.addEventListener('focus', (e) => { if (e.target.value) this._globalSearch(e.target.value); });
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.global-search')) document.getElementById('searchResults').classList.remove('show');
        });
        // atalho "/" foca busca
        document.addEventListener('keydown', (e) => {
          if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
            e.preventDefault(); gs.focus();
          }
        });
      }
    },

    async _globalSearch(q) {
      const box = document.getElementById('searchResults');
      q = (q || '').trim().toLowerCase();
      if (q.length < 2) { box.classList.remove('show'); return; }
      const [prods, clis, vendas] = await Promise.all([
        Store.list('produtos'), Store.list('clientes'), Store.list('vendas')
      ]);
      const mp = prods.filter((p) => p.nome.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 5);
      const mc = clis.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 5);
      const mv = vendas.filter((v) => (v.numero || '').toLowerCase().includes(q) || (v.clienteNome || '').toLowerCase().includes(q)).slice(0, 4);
      let html = '';
      if (mp.length) {
        html += '<div class="search-cat">Produtos</div>';
        mp.forEach((p) => html += `<div class="search-item" data-go="produtos">
          <span class="si-ico ic-blue"><i class="bi bi-box-seam"></i></span>
          <div class="rank-meta"><strong>${this.escape(p.nome)}</strong><small>${this.fmt.money(p.preco)} · ${p.categoria || ''}</small></div></div>`);
      }
      if (mc.length) {
        html += '<div class="search-cat">Clientes</div>';
        mc.forEach((c) => html += `<div class="search-item" data-go="clientes">
          <span class="si-ico ic-purple"><i class="bi bi-person"></i></span>
          <div class="rank-meta"><strong>${this.escape(c.nome)}</strong><small>${this.fmt.money(c.totalComprado || 0)} em compras</small></div></div>`);
      }
      if (mv.length) {
        html += '<div class="search-cat">Vendas</div>';
        mv.forEach((v) => html += `<div class="search-item" data-go="vendas">
          <span class="si-ico ic-green"><i class="bi bi-receipt"></i></span>
          <div class="rank-meta"><strong>Venda ${this.escape(v.numero)}</strong><small>${this.fmt.money(v.total)} · ${this.escape(v.clienteNome || '')}</small></div></div>`);
      }
      if (!html) html = '<div class="empty" style="padding:24px"><p>Nenhum resultado para "' + this.escape(q) + '"</p></div>';
      box.innerHTML = html;
      box.classList.add('show');
      box.querySelectorAll('[data-go]').forEach((it) => it.addEventListener('click', () => {
        box.classList.remove('show'); document.getElementById('globalSearch').value = '';
        this.navigate(it.dataset.go);
      }));
    },

    /* ============ BACKUP ============ */
    async doBackup() {
      const dump = await Store.exportAll();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'backup-gestao-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      this.toast('Backup gerado com sucesso.', 'success');
    },

    /* ============ FORMATAÇÃO / UTILS ============ */
    fmt: {
      money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
      money0(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); },
      num(v, d = 0) { return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); },
      pct(v, d = 1) { return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; },
      date(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR'); },
      datetime(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); },
      time(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); },
      rel(iso) {
        if (!iso) return '—'; const d = new Date(iso); const days = Math.floor((Date.now() - d) / 86400000);
        if (days <= 0) return 'hoje'; if (days === 1) return 'ontem'; if (days < 30) return days + ' dias atrás';
        if (days < 60) return '1 mês atrás'; return Math.floor(days / 30) + ' meses atrás';
      }
    },
    parseMoney(s) {
      if (typeof s === 'number') return s;
      if (!s) return 0;
      s = String(s).replace(/[^\d,.-]/g, '');
      if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
      return parseFloat(s) || 0;
    },
    escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); },
    debounce(fn, wait) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); }; },
    todayISO() { return new Date().toISOString().slice(0, 10); },
    isSameDay(iso, ref) { const a = new Date(iso), b = ref || new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); },
    isSameMonth(iso, ref) { const a = new Date(iso), b = ref || new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); },

    /* ============ COMPONENTES UI ============ */
    toast(msg, type = 'primary') {
      const icons = { success: 'check-circle-fill', danger: 'x-circle-fill', warning: 'exclamation-triangle-fill', primary: 'info-circle-fill', info: 'info-circle-fill' };
      const colors = { success: 'var(--ok)', danger: 'var(--danger)', warning: 'var(--warn)', primary: 'var(--brand)', info: 'var(--info)' };
      const el = document.createElement('div');
      el.className = 'toast align-items-center border-0 show';
      el.setAttribute('role', 'alert');
      el.innerHTML = `<div class="toast-body"><i class="bi bi-${icons[type] || icons.primary}" style="color:${colors[type]};font-size:18px"></i>
        <span>${this.escape(msg)}</span></div>`;
      document.getElementById('toastContainer').appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .3s'; }, 2600);
      setTimeout(() => el.remove(), 2950);
    },

    /** Modal genérico. opts: {title, body(html), size, footer(html), onShown(modalEl)} */
    modal(opts) {
      const c = document.getElementById('appModalContent');
      const dialog = document.querySelector('#appModal .modal-dialog');
      dialog.className = 'modal-dialog modal-dialog-centered modal-dialog-scrollable' + (opts.size ? ' modal-' + opts.size : '');
      c.innerHTML = `
        <div class="modal-header">
          <h5 class="modal-title">${opts.title || ''}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">${opts.body || ''}</div>
        ${opts.footer === null ? '' : `<div class="modal-footer">${opts.footer || '<button class="btn btn-ghost" data-bs-dismiss="modal">Fechar</button>'}</div>`}`;
      const m = bootstrap.Modal.getOrCreateInstance(document.getElementById('appModal'));
      m.show();
      if (opts.onShown) setTimeout(() => opts.onShown(c, m), 150);
      return m;
    },
    closeModal() { const el = document.getElementById('appModal'); const m = bootstrap.Modal.getInstance(el); if (m) m.hide(); },

    /** Confirmação. Retorna Promise<boolean>. */
    confirm(opts) {
      return new Promise((resolve) => {
        const danger = opts.danger;
        this.modal({
          title: opts.title || 'Confirmar',
          body: `<p class="mb-0">${opts.message || 'Tem certeza?'}</p>`,
          footer: `<button class="btn btn-ghost" data-bs-dismiss="modal" id="cfNo">${opts.cancel || 'Cancelar'}</button>
                   <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cfYes">${opts.confirm || 'Confirmar'}</button>`,
          onShown: (c, m) => {
            c.querySelector('#cfYes').onclick = () => { m.hide(); resolve(true); };
            c.querySelector('#cfNo').onclick = () => resolve(false);
          }
        });
      });
    },

    /* ---- builders (HTML strings) ---- */
    pageHead(title, sub, actionsHtml) {
      return `<div class="page-head fade-in">
        <div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
        ${actionsHtml ? `<div class="page-head-actions">${actionsHtml}</div>` : ''}</div>`;
    },
    kpi(o) {
      return `<div class="kpi">
        <div class="kpi-top">
          <div><div class="kpi-label">${o.label}</div></div>
          <span class="kpi-ico ${o.ico || 'ic-blue'}"><i class="bi ${o.icon || 'bi-graph-up'}"></i></span>
        </div>
        <div class="kpi-value">${o.value}</div>
        ${o.foot ? `<div class="kpi-foot">${o.foot}</div>` : ''}
      </div>`;
    },
    empty(msg, icon = 'inbox') { return `<div class="empty"><i class="bi bi-${icon}"></i><p>${msg}</p></div>`; },

    chartColors() {
      const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      return {
        grid: dark ? 'rgba(255,255,255,.07)' : 'rgba(15,23,42,.07)',
        text: dark ? '#9fb0cd' : '#64748b',
        brand: '#2563eb', green: '#16a34a', orange: '#f97316', red: '#dc2626',
        info: '#0ea5e9', purple: '#7c3aed',
      };
    }
  };

  /* ============ helpers de módulo ============ */
  function initials(name) {
    const p = (name || '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '') || (p[0] || 'U')[0];
  }
  function sessionGet() { try { return JSON.parse(sessionStorage.getItem('erp_session')); } catch (e) { return null; } }
  function sessionSet(u) { try { sessionStorage.setItem('erp_session', JSON.stringify(u)); } catch (e) {} }
  function sessionClear() { try { sessionStorage.removeItem('erp_session'); } catch (e) {} }

  return App;
})();
