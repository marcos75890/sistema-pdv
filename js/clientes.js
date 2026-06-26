/* =====================================================================
   clientes.js — Cadastro / gestão de clientes
   ===================================================================== */
App.registerModule('clientes', {
  busca: '', filtro: 'todos',

  async render(view) {
    const clientes = await Store.list('clientes');
    this._all = clientes;
    const totalComprado = clientes.reduce((s, c) => s + (c.totalComprado || 0), 0);
    const bloqueados = clientes.filter((c) => c.bloqueado).length;
    const ativos = clientes.filter((c) => (c.qtdCompras || 0) > 0).length;

    view.innerHTML = App.pageHead('Clientes', `${clientes.length} clientes cadastrados`,
      `<button class="btn btn-ghost btn-sm" id="btnExp"><i class="bi bi-download me-1"></i>Exportar</button>
       <button class="btn btn-primary btn-sm" id="btnNovo"><i class="bi bi-person-plus me-1"></i>Novo cliente</button>`) +
      `<div class="kpi-grid stagger" style="margin-bottom:18px">
        ${App.kpi({ label: 'Total de clientes', icon: 'bi-people', ico: 'ic-purple', value: App.fmt.num(clientes.length) })}
        ${App.kpi({ label: 'Clientes ativos', icon: 'bi-person-check', ico: 'ic-green', value: App.fmt.num(ativos), foot: 'com ao menos 1 compra' })}
        ${App.kpi({ label: 'Faturado (carteira)', icon: 'bi-cash-stack', ico: 'ic-blue', value: App.fmt.money(totalComprado) })}
        ${App.kpi({ label: 'Bloqueados', icon: 'bi-person-slash', ico: bloqueados ? 'ic-red' : 'ic-green', value: App.fmt.num(bloqueados), foot: 'não vender / não paga' })}
       </div>
       <div class="panel">
        <div class="panel-head">
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="global-search" style="max-width:280px"><i class="bi bi-search"></i>
              <input type="text" id="cSearch" placeholder="Buscar cliente…"></div>
            <select class="form-select form-select-sm" id="cFiltro" style="width:auto">
              <option value="todos">Todos</option><option value="ativos">Com compras</option><option value="bloqueados">Bloqueados</option>
            </select>
          </div>
        </div>
        <div class="panel-body" style="padding:0"><div id="cTable"></div></div>
       </div>`;
    view.querySelector('#cSearch').oninput = App.debounce((e) => { this.busca = e.target.value; this._draw(); }, 150);
    view.querySelector('#cFiltro').onchange = (e) => { this.filtro = e.target.value; this._draw(); };
    view.querySelector('#btnNovo').onclick = () => this._form();
    view.querySelector('#btnExp').onclick = () => exportXLSX(clientes.map((c) => ({
      Nome: c.nome, Documento: c.doc, Telefone: c.telefone, Email: c.email, Cidade: c.cidade, Estado: c.estado,
      TotalComprado: c.totalComprado, QtdCompras: c.qtdCompras, UltimaCompra: c.ultimaCompra ? App.fmt.date(c.ultimaCompra) : '', Bloqueado: c.bloqueado ? 'Sim' : 'Não'
    })), 'clientes');
    this._draw();
  },

  _draw() {
    let list = [...this._all];
    if (this.filtro === 'ativos') list = list.filter((c) => (c.qtdCompras || 0) > 0);
    if (this.filtro === 'bloqueados') list = list.filter((c) => c.bloqueado);
    const q = (this.busca || '').toLowerCase().trim();
    if (q) list = list.filter((c) => c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q) || (c.email || '').toLowerCase().includes(q));
    list.sort((a, b) => (b.totalComprado || 0) - (a.totalComprado || 0));
    const box = document.getElementById('cTable');
    if (!list.length) { box.innerHTML = App.empty('Nenhum cliente encontrado.', 'people'); return; }
    box.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>
      <th>Cliente</th><th>Contato</th><th class="num">Compras</th><th class="num">Total</th><th class="num">Última compra</th><th></th>
    </tr></thead><tbody>
      ${list.map((c) => `<tr class="row-click" data-ver="${c.id}">
        <td><div class="d-flex align-items-center gap-2">
          <span class="avatar avatar-sm" style="${c.bloqueado ? 'background:var(--danger)' : ''}">${ini(c.nome)}</span>
          <div><strong>${App.escape(c.nome)}</strong> ${c.bloqueado ? '<span class="badge-soft b-red" style="font-size:9px">BLOQUEADO</span>' : ''}<br>
            <small class="text-muted-2">${App.escape(c.doc || '—')}</small></div></div></td>
        <td>${c.telefone ? `<span class="text-muted-2"><i class="bi bi-telephone me-1"></i>${App.escape(c.telefone)}</span>` : '<span class="text-3">—</span>'}</td>
        <td class="num">${c.qtdCompras || 0}</td>
        <td class="num"><strong>${App.fmt.money(c.totalComprado || 0)}</strong></td>
        <td class="num text-muted-2">${c.ultimaCompra ? App.fmt.rel(c.ultimaCompra) : '—'}</td>
        <td class="num"><i class="bi bi-chevron-right text-3"></i></td></tr>`).join('')}
    </tbody></table></div>`;
    box.querySelectorAll('[data-ver]').forEach((r) => r.onclick = () => this._detalhe(r.dataset.ver));
  },

  async _detalhe(id) {
    const c = await Store.get('clientes', id);
    const vendas = (await Store.list('vendas', (v) => v.clienteId === id)).sort((a, b) => new Date(b.data) - new Date(a.data));
    const receber = await Store.list('contasReceber', (r) => r.clienteId === id && r.status === 'pendente');
    const totalReceber = receber.reduce((s, r) => s + (r.valor - (r.valorRecebido || 0)), 0);
    const wpp = (c.whatsapp || c.telefone || '').replace(/\D/g, '');
    const body = `
      <div class="d-flex align-items-center gap-3 mb-3">
        <span class="avatar" style="width:54px;height:54px;font-size:20px;${c.bloqueado ? 'background:var(--danger)' : ''}">${ini(c.nome)}</span>
        <div><h4 style="margin:0">${App.escape(c.nome)} ${c.bloqueado ? '<span class="badge-soft b-red">BLOQUEADO</span>' : ''}</h4>
          <small class="text-muted-2">${App.escape(c.doc || 'Sem documento')} · cadastrado ${App.fmt.date(c.criadoEm)}</small></div>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        ${App.kpi({ label: 'Total comprado', icon: 'bi-bag', ico: 'ic-blue', value: App.fmt.money(c.totalComprado || 0) })}
        ${App.kpi({ label: 'Nº de compras', icon: 'bi-receipt', ico: 'ic-green', value: c.qtdCompras || 0 })}
        ${App.kpi({ label: 'Deve (fiado)', icon: 'bi-exclamation-circle', ico: totalReceber ? 'ic-orange' : 'ic-green', value: App.fmt.money(totalReceber) })}
      </div>
      <div class="row g-2 mb-3" style="font-size:13px">
        <div class="col-md-6"><b>Telefone:</b> ${App.escape(c.telefone || '—')}</div>
        <div class="col-md-6"><b>E-mail:</b> ${App.escape(c.email || '—')}</div>
        <div class="col-md-6"><b>Endereço:</b> ${App.escape([c.endereco, c.cidade, c.estado].filter(Boolean).join(', ') || '—')}</div>
        <div class="col-md-6"><b>Obs:</b> ${App.escape(c.obs || '—')}</div>
      </div>
      <h6 class="text-muted-2" style="font-size:12px;text-transform:uppercase;letter-spacing:.5px">Histórico de compras</h6>
      ${vendas.length ? `<div class="table-wrap" style="max-height:240px;overflow:auto"><table class="data"><thead><tr><th>Venda</th><th>Data</th><th>Pagamento</th><th class="num">Total</th></tr></thead><tbody>
        ${vendas.map((v) => `<tr><td>#${App.escape(v.numero)}</td><td class="text-muted-2">${App.fmt.date(v.data)}</td><td>${pagamentoBadge(v)}</td><td class="num"><strong>${App.fmt.money(v.total)}</strong></td></tr>`).join('')}
      </tbody></table></div>` : App.empty('Sem compras registradas.', 'bag')}`;
    App.modal({
      title: 'Ficha do cliente', size: 'lg', body,
      footer: `${wpp ? `<a class="btn btn-ghost" href="https://wa.me/55${wpp}" target="_blank"><i class="bi bi-whatsapp me-1" style="color:#25d366"></i>WhatsApp</a>` : ''}
               <button class="btn btn-ghost text-danger" id="btnDel"><i class="bi bi-trash me-1"></i>Excluir</button>
               <button class="btn btn-primary" id="btnEdit"><i class="bi bi-pencil me-1"></i>Editar</button>`,
      onShown: (cc, m) => {
        cc.querySelector('#btnEdit').onclick = () => { m.hide(); this._form(id); };
        cc.querySelector('#btnDel').onclick = async () => {
          const ok = await App.confirm({ title: 'Excluir cliente', message: `Excluir <b>${App.escape(c.nome)}</b>?`, danger: true, confirm: 'Excluir' });
          if (!ok) return; await Store.remove('clientes', id); m.hide(); App.toast('Cliente excluído.', 'info'); this.render(document.getElementById('view'));
        };
      }
    });
  },

  async _form(id) {
    const c = id ? await Store.get('clientes', id) : {
      nome: '', doc: '', dataNascimento: '', telefone: '', telefone2: '', whatsapp: '', email: '',
      endereco: '', complemento: '', cidade: '', estado: '', cep: '', obs: '', bloqueado: false
    };
    const ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    const body = `<form id="cliForm"><div class="row g-3">
      <div class="col-md-8"><label class="form-label">Nome *</label><input class="form-control" name="nome" value="${App.escape(c.nome)}" required></div>
      <div class="col-md-4"><label class="form-label">CPF / CNPJ</label><input class="form-control" name="doc" value="${App.escape(c.doc || '')}"></div>
      <div class="col-md-4"><label class="form-label">Nascimento</label><input type="date" class="form-control" name="dataNascimento" value="${c.dataNascimento || ''}"></div>
      <div class="col-md-4"><label class="form-label">Telefone</label><input class="form-control" name="telefone" value="${App.escape(c.telefone || '')}"></div>
      <div class="col-md-4"><label class="form-label">WhatsApp</label><input class="form-control" name="whatsapp" value="${App.escape(c.whatsapp || c.telefone || '')}"></div>
      <div class="col-md-8"><label class="form-label">E-mail</label><input type="email" class="form-control" name="email" value="${App.escape(c.email || '')}"></div>
      <div class="col-md-4"><label class="form-label">CEP</label><input class="form-control" name="cep" value="${App.escape(c.cep || '')}"></div>
      <div class="col-md-8"><label class="form-label">Endereço</label><input class="form-control" name="endereco" value="${App.escape(c.endereco || '')}"></div>
      <div class="col-md-4"><label class="form-label">Complemento</label><input class="form-control" name="complemento" value="${App.escape(c.complemento || '')}"></div>
      <div class="col-md-8"><label class="form-label">Cidade</label><input class="form-control" name="cidade" value="${App.escape(c.cidade || '')}"></div>
      <div class="col-md-4"><label class="form-label">UF</label><select class="form-select" name="estado"><option value="">—</option>${ufs.map((u) => `<option ${c.estado === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class="col-12"><label class="form-label">Observações</label><textarea class="form-control" name="obs" rows="2">${App.escape(c.obs || '')}</textarea></div>
      <div class="col-12"><label class="chip" style="display:inline-flex;gap:8px;align-items:center"><input type="checkbox" name="bloqueado" ${c.bloqueado ? 'checked' : ''}> 🚫 Cliente bloqueado (não vender / não paga)</label></div>
    </div></form>`;
    App.modal({
      title: id ? 'Editar cliente' : 'Novo cliente', size: 'lg', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="btnSave"><i class="bi bi-check2 me-1"></i>Salvar</button>`,
      onShown: (cc, m) => {
        cc.querySelector('#btnSave').onclick = async () => {
          const f = cc.querySelector('#cliForm');
          if (!f.nome.value.trim()) { App.toast('Informe o nome.', 'warning'); return; }
          const data = {};
          ['nome', 'doc', 'dataNascimento', 'telefone', 'whatsapp', 'email', 'cep', 'endereco', 'complemento', 'cidade', 'estado', 'obs'].forEach((k) => data[k] = f[k].value.trim());
          data.bloqueado = f.bloqueado.checked;
          if (id) await Store.update('clientes', id, data);
          else await Store.create('clientes', Object.assign({ totalComprado: 0, qtdCompras: 0, ultimaCompra: null, criadoEm: new Date().toISOString() }, data));
          m.hide(); App.toast('Cliente salvo.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  }
});

function ini(name) { const p = (name || '').trim().split(/\s+/); return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase() || 'C'; }
