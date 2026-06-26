/* =====================================================================
   store.js — Camada de dados (Repository Pattern)
   ---------------------------------------------------------------------
   • Toda a aplicação fala SOMENTE com este módulo, nunca com o
     LocalStorage diretamente. Os métodos são ASSÍNCRONOS (retornam
     Promises) de propósito: assim, quando você plugar uma API/banco de
     dados no futuro, basta trocar o "adapter" abaixo por um que use
     fetch() — a interface (list/get/create/update/remove) continua igual
     e NENHUMA tela precisa ser reescrita.
   • Persistência atual: LocalStorage (chave por coleção).
   ===================================================================== */
(function (global) {
  'use strict';

  const PREFIX = 'erp_v1.';
  const COLLECTIONS = [
    'produtos', 'categorias', 'clientes', 'vendas',
    'contasReceber', 'contasPagar', 'movCaixa', 'movEstoque', 'usuarios'
  ];
  const SINGLETONS = ['empresa', 'config'];

  /* ---------------------------------------------------------------
     ADAPTER — abstrai ONDE os dados ficam.
     Troque LocalStorageAdapter por ApiAdapter (fetch) para migrar.
     --------------------------------------------------------------- */
  const LocalStorageAdapter = {
    _key: (name) => PREFIX + name,
    readRaw(name) {
      try { return JSON.parse(localStorage.getItem(this._key(name))); }
      catch (e) { return null; }
    },
    writeRaw(name, value) {
      localStorage.setItem(this._key(name), JSON.stringify(value));
    },
    remove(name) { localStorage.removeItem(this._key(name)); }
  };

  // Exemplo (comentado) de como seria um adapter de API no futuro:
  // const ApiAdapter = {
  //   base: '/api',
  //   async list(name){ return (await fetch(`${this.base}/${name}`)).json(); }
  //   async create(name, obj){ ... POST ... }
  //   ...
  // };

  const Adapter = LocalStorageAdapter;

  /* --------------------------- helpers --------------------------- */
  const delay = (v) => Promise.resolve(v);          // simula latência de rede (async)
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function _coll(name) {
    const data = Adapter.readRaw(name);
    return Array.isArray(data) ? data : [];
  }
  function _saveColl(name, arr) { Adapter.writeRaw(name, arr); return arr; }

  /* --------------------------- API pública ----------------------- */
  const Store = {
    COLLECTIONS,
    _listeners: [],

    /** Inicializa: na primeira execução carrega o seed importado do Kyte. */
    async init() {
      if (!localStorage.getItem(PREFIX + '_installed')) {
        await this.loadSeed();
        localStorage.setItem(PREFIX + '_installed', '1');
      }
      return true;
    },

    /** Carrega window.__SEED_DATA__ para dentro das coleções. */
    async loadSeed() {
      const seed = global.__SEED_DATA__ || {};
      COLLECTIONS.forEach((c) => _saveColl(c, clone(seed[c] || [])));
      Adapter.writeRaw('empresa', seed.empresa || {});
      Adapter.writeRaw('config', { tema: 'light', moeda: 'BRL' });
      this._emit();
    },

    /* ----- coleções (CRUD genérico) ----- */
    async list(name, filterFn) {
      let arr = _coll(name);
      if (filterFn) arr = arr.filter(filterFn);
      return delay(clone(arr));
    },
    async get(name, id) {
      return delay(clone(_coll(name).find((x) => x.id === id) || null));
    },
    async create(name, obj) {
      const arr = _coll(name);
      const rec = Object.assign({ id: uid(name.slice(0, 3)) }, obj);
      if (!rec.id) rec.id = uid(name.slice(0, 3));
      arr.push(rec); _saveColl(name, arr); this._emit(name);
      return delay(clone(rec));
    },
    async update(name, id, patch) {
      const arr = _coll(name);
      const i = arr.findIndex((x) => x.id === id);
      if (i < 0) return delay(null);
      arr[i] = Object.assign({}, arr[i], patch, { id });
      _saveColl(name, arr); this._emit(name);
      return delay(clone(arr[i]));
    },
    async remove(name, id) {
      const arr = _coll(name).filter((x) => x.id !== id);
      _saveColl(name, arr); this._emit(name);
      return delay(true);
    },
    /** Substitui a coleção inteira (usado em importação em massa). */
    async bulkSet(name, list) { _saveColl(name, clone(list)); this._emit(name); return delay(true); },
    async bulkAdd(name, list) {
      const arr = _coll(name);
      list.forEach((o) => arr.push(Object.assign({ id: uid(name.slice(0, 3)) }, o)));
      _saveColl(name, arr); this._emit(name); return delay(arr.length);
    },

    /* ----- singletons (empresa / config) ----- */
    async getEmpresa() { return delay(clone(Adapter.readRaw('empresa') || {})); },
    async setEmpresa(obj) { Adapter.writeRaw('empresa', obj); this._emit('empresa'); return delay(clone(obj)); },
    async getConfig() { return delay(clone(Adapter.readRaw('config') || { tema: 'light' })); },
    async setConfig(obj) {
      const cur = Adapter.readRaw('config') || {};
      const next = Object.assign({}, cur, obj);
      Adapter.writeRaw('config', next); this._emit('config'); return delay(clone(next));
    },

    /* ----- utilidades de negócio ----- */
    genId: uid,

    /** Backup completo (export JSON). */
    async exportAll() {
      const dump = { _backup: new Date().toISOString(), _versao: 1 };
      COLLECTIONS.forEach((c) => (dump[c] = _coll(c)));
      SINGLETONS.forEach((s) => (dump[s] = Adapter.readRaw(s)));
      return delay(dump);
    },
    /** Restaura backup (import JSON). */
    async importAll(dump) {
      COLLECTIONS.forEach((c) => { if (dump[c]) _saveColl(c, dump[c]); });
      SINGLETONS.forEach((s) => { if (dump[s]) Adapter.writeRaw(s, dump[s]); });
      this._emit();
      return delay(true);
    },
    /** Apaga TUDO. opt.reseed=true recarrega o seed do Kyte. */
    async wipe(reseed) {
      COLLECTIONS.forEach((c) => Adapter.remove(c));
      SINGLETONS.forEach((s) => Adapter.remove(s));
      localStorage.removeItem(PREFIX + '_installed');
      if (reseed) { await this.loadSeed(); localStorage.setItem(PREFIX + '_installed', '1'); }
      this._emit();
      return delay(true);
    },

    /* ----- reatividade simples (pub/sub) ----- */
    subscribe(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter((f) => f !== fn); }; },
    _emit(name) { this._listeners.forEach((fn) => { try { fn(name); } catch (e) {} }); }
  };

  global.Store = Store;
})(window);
