/* =====================================================================
   configuracoes.js — Empresa, tema, usuários, backup e importação
   ===================================================================== */
App.registerModule('configuracoes', {
  async render(view) {
    const tab = (location.hash.split('?tab=')[1] || 'empresa');
    view.innerHTML = App.pageHead('Configurações', 'Empresa, aparência, usuários e dados') +
      `<div class="chips" style="margin-bottom:16px">
        <button class="chip ${tab === 'empresa' ? 'active' : ''}" data-tab="empresa"><i class="bi bi-building me-1"></i>Empresa</button>
        <button class="chip ${tab === 'aparencia' ? 'active' : ''}" data-tab="aparencia"><i class="bi bi-palette me-1"></i>Aparência</button>
        <button class="chip ${tab === 'usuarios' ? 'active' : ''}" data-tab="usuarios"><i class="bi bi-people me-1"></i>Usuários</button>
        <button class="chip ${tab === 'dados' ? 'active' : ''}" data-tab="dados"><i class="bi bi-database me-1"></i>Dados & Backup</button>
       </div><div id="cfgBody"></div>`;
    view.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => location.hash = '#/configuracoes?tab=' + b.dataset.tab);
    const body = document.getElementById('cfgBody');
    if (tab === 'aparencia') this._aparencia(body);
    else if (tab === 'usuarios') this._usuarios(body);
    else if (tab === 'dados') this._dados(body);
    else this._empresa(body);
  },

  /* ---------------- EMPRESA ---------------- */
  async _empresa(box) {
    const e = await Store.getEmpresa();
    box.innerHTML = `<div class="panel" style="max-width:760px"><div class="panel-body">
      <form id="empForm"><div class="row g-3">
        <div class="col-12 d-flex align-items-center gap-3 mb-2">
          <div class="thumb" id="logoPrev" style="width:72px;height:72px;font-size:26px">${e.logo ? `<img src="${e.logo}" style="width:100%;height:100%;border-radius:10px;object-fit:cover">` : '<i class="bi bi-shop"></i>'}</div>
          <div><input type="file" id="fLogo" accept="image/*" class="d-none"><button type="button" class="btn btn-ghost btn-sm" id="btnLogo"><i class="bi bi-upload me-1"></i>Enviar logo</button>
            <p class="text-3 mb-0" style="font-size:12px;margin-top:4px">PNG ou JPG, aparece no comprovante</p></div>
        </div>
        <div class="col-md-8"><label class="form-label">Nome da empresa</label><input class="form-control" name="nome" value="${App.escape(e.nome || '')}"></div>
        <div class="col-md-4"><label class="form-label">CNPJ / CPF</label><input class="form-control" name="cnpj" value="${App.escape(e.cnpj || '')}"></div>
        <div class="col-md-6"><label class="form-label">Telefone</label><input class="form-control" name="telefone" value="${App.escape(e.telefone || '')}"></div>
        <div class="col-md-6"><label class="form-label">E-mail</label><input class="form-control" name="email" value="${App.escape(e.email || '')}"></div>
        <div class="col-md-8"><label class="form-label">Endereço</label><input class="form-control" name="endereco" value="${App.escape(e.endereco || '')}"></div>
        <div class="col-md-4"><label class="form-label">CEP</label><input class="form-control" name="cep" value="${App.escape(e.cep || '')}"></div>
        <div class="col-md-8"><label class="form-label">Cidade</label><input class="form-control" name="cidade" value="${App.escape(e.cidade || '')}"></div>
        <div class="col-md-4"><label class="form-label">UF</label><input class="form-control" name="estado" value="${App.escape(e.estado || '')}"></div>
        <div class="col-12"><button type="button" class="btn btn-primary" id="btnSaveEmp"><i class="bi bi-check2 me-1"></i>Salvar</button></div>
      </div></form></div></div>`;
    let logo = e.logo || '';
    box.querySelector('#btnLogo').onclick = () => box.querySelector('#fLogo').click();
    box.querySelector('#fLogo').onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { logo = r.result; box.querySelector('#logoPrev').innerHTML = `<img src="${logo}" style="width:100%;height:100%;border-radius:10px;object-fit:cover">`; }; r.readAsDataURL(f); };
    box.querySelector('#btnSaveEmp').onclick = async () => {
      const f = box.querySelector('#empForm'); const data = Object.assign({}, e, { logo });
      ['nome', 'cnpj', 'telefone', 'email', 'endereco', 'cep', 'cidade', 'estado'].forEach((k) => data[k] = f[k].value.trim());
      await Store.setEmpresa(data); App.toast('Dados da empresa salvos.', 'success'); App.refreshChrome();
    };
  },

  /* ---------------- APARÊNCIA ---------------- */
  async _aparencia(box) {
    const cfg = await Store.getConfig(); const cur = document.documentElement.getAttribute('data-bs-theme');
    const accents = [['#2563eb', 'Azul'], ['#16a34a', 'Verde'], ['#7c3aed', 'Roxo'], ['#0ea5e9', 'Ciano'], ['#e11d48', 'Vermelho'], ['#f97316', 'Laranja']];
    box.innerHTML = `<div class="panel" style="max-width:640px"><div class="panel-body">
      <label class="form-label">Tema</label>
      <div class="pay-grid mb-4" style="grid-template-columns:1fr 1fr">
        <div class="pay-opt ${cur === 'light' ? 'active' : ''}" data-theme="light"><i class="bi bi-sun"></i>Claro</div>
        <div class="pay-opt ${cur === 'dark' ? 'active' : ''}" data-theme="dark"><i class="bi bi-moon-stars"></i>Escuro</div>
      </div>
      <label class="form-label">Cor de destaque</label>
      <div class="chips">${accents.map((a) => `<button class="chip" data-accent="${a[0]}" style="border-color:${a[0]}"><span class="dot" style="background:${a[0]};margin-right:6px"></span>${a[1]}</button>`).join('')}</div>
      <p class="text-3 mt-3" style="font-size:12px">As preferências são salvas neste navegador.</p>
    </div></div>`;
    box.querySelectorAll('[data-theme]').forEach((o) => o.onclick = () => { box.querySelectorAll('[data-theme]').forEach((x) => x.classList.remove('active')); o.classList.add('active'); App.applyTheme(o.dataset.theme); });
    box.querySelectorAll('[data-accent]').forEach((b) => b.onclick = () => { document.documentElement.style.setProperty('--brand', b.dataset.accent); Store.setConfig({ accent: b.dataset.accent }); App.toast('Cor aplicada.', 'success'); });
  },

  /* ---------------- USUÁRIOS ---------------- */
  async _usuarios(box) {
    const users = await Store.list('usuarios');
    box.innerHTML = `<div class="panel"><div class="panel-head"><h2>Usuários e permissões</h2>
      <button class="btn btn-primary btn-sm" id="addU"><i class="bi bi-person-plus me-1"></i>Novo usuário</button></div>
      <div class="panel-body" style="padding:0"><div class="table-wrap"><table class="data"><thead><tr><th>Usuário</th><th>E-mail</th><th>Permissão</th><th>Status</th><th></th></tr></thead><tbody>
        ${users.map((u) => `<tr><td><div class="d-flex align-items-center gap-2"><span class="avatar avatar-sm">${ini(u.nome)}</span><strong>${App.escape(u.nome)}</strong></div></td>
          <td class="text-muted-2">${App.escape(u.email || '')}</td><td><span class="badge-soft b-blue">${App.escape(u.papel || 'Vendedor')}</span></td>
          <td>${u.ativo !== false ? '<span class="badge-soft b-green">Ativo</span>' : '<span class="badge-soft b-gray">Inativo</span>'}</td>
          <td class="num"><button class="btn-icon" data-edu="${u.id}" style="width:32px;height:32px"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon" data-delu="${u.id}" style="width:32px;height:32px"><i class="bi bi-trash text-danger"></i></button></td></tr>`).join('')}
      </tbody></table></div></div></div>
      <p class="text-3 mt-2" style="font-size:12px"><i class="bi bi-info-circle me-1"></i>Permissões: <b>Administrador</b> (acesso total), <b>Financeiro</b> (financeiro e relatórios), <b>Vendedor</b> (PDV e clientes). O controle de acesso por perfil é aplicado na futura integração com backend.</p>`;
    box.querySelector('#addU').onclick = () => this._formUser();
    box.querySelectorAll('[data-edu]').forEach((b) => b.onclick = () => this._formUser(b.dataset.edu));
    box.querySelectorAll('[data-delu]').forEach((b) => b.onclick = async () => {
      const ok = await App.confirm({ title: 'Excluir usuário', message: 'Remover este usuário?', danger: true, confirm: 'Excluir' });
      if (ok) { await Store.remove('usuarios', b.dataset.delu); this.render(document.getElementById('view')); }
    });
  },
  async _formUser(id) {
    const u = id ? await Store.get('usuarios', id) : { nome: '', email: '', papel: 'Vendedor', senha: '', ativo: true };
    const body = `<form id="uForm"><div class="row g-3">
      <div class="col-12"><label class="form-label">Nome *</label><input class="form-control" name="nome" value="${App.escape(u.nome)}"></div>
      <div class="col-md-7"><label class="form-label">E-mail</label><input class="form-control" name="email" value="${App.escape(u.email || '')}"></div>
      <div class="col-md-5"><label class="form-label">Senha</label><input class="form-control" name="senha" value="${App.escape(u.senha || '')}"></div>
      <div class="col-md-7"><label class="form-label">Permissão</label><select class="form-select" name="papel">${['Administrador', 'Financeiro', 'Vendedor'].map((p) => `<option ${u.papel === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="col-md-5 d-flex align-items-end"><label class="chip" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="ativo" ${u.ativo !== false ? 'checked' : ''}> Ativo</label></div>
    </div></form>`;
    App.modal({
      title: id ? 'Editar usuário' : 'Novo usuário', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="btnOk">Salvar</button>`,
      onShown: (c, m) => {
        c.querySelector('#btnOk').onclick = async () => {
          const f = c.querySelector('#uForm'); if (!f.nome.value.trim()) { App.toast('Informe o nome.', 'warning'); return; }
          const data = { nome: f.nome.value.trim(), email: f.email.value.trim(), senha: f.senha.value, papel: f.papel.value, ativo: f.ativo.checked };
          if (id) await Store.update('usuarios', id, data); else await Store.create('usuarios', data);
          m.hide(); App.toast('Usuário salvo.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  },

  /* ---------------- DADOS & BACKUP ---------------- */
  async _dados(box) {
    box.innerHTML = `<div class="row g-3">
      <div class="col-md-6"><div class="panel card-pad" style="height:100%">
        <h3 style="font-size:15px"><i class="bi bi-download me-2 text-primary"></i>Backup</h3>
        <p class="text-muted-2" style="font-size:13px">Baixe um arquivo .json com todos os dados (produtos, clientes, vendas, financeiro). Guarde em local seguro.</p>
        <button class="btn btn-primary" id="btnBkp"><i class="bi bi-download me-1"></i>Gerar backup</button></div></div>
      <div class="col-md-6"><div class="panel card-pad" style="height:100%">
        <h3 style="font-size:15px"><i class="bi bi-upload me-2 text-primary"></i>Restaurar backup</h3>
        <p class="text-muted-2" style="font-size:13px">Importe um arquivo de backup .json gerado por este sistema. <b>Substitui</b> os dados atuais.</p>
        <input type="file" id="fBkp" accept=".json" class="d-none"><button class="btn btn-ghost" id="btnRest"><i class="bi bi-upload me-1"></i>Selecionar arquivo</button></div></div>

      <div class="col-12"><div class="panel card-pad">
        <h3 style="font-size:15px"><i class="bi bi-file-earmark-arrow-up me-2 text-success"></i>Importar planilhas do Kyte (CSV)</h3>
        <p class="text-muted-2" style="font-size:13px">Importe os arquivos exportados do Kyte: <b>Produtos</b>, <b>Clientes</b> e <b>Vendas</b> (.csv). O sistema detecta o tipo automaticamente. Itens novos são <b>adicionados</b> aos existentes.</p>
        <input type="file" id="fCsv" accept=".csv" multiple class="d-none">
        <button class="btn btn-success" id="btnCsv"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Selecionar CSV(s)</button>
        <div id="csvLog" class="mt-3"></div></div></div>

      <div class="col-12"><div class="panel card-pad" style="border-color:var(--danger)">
        <h3 style="font-size:15px;color:var(--danger)"><i class="bi bi-exclamation-octagon me-2"></i>Zona de risco</h3>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-ghost" id="btnDemo"><i class="bi bi-arrow-counterclockwise me-1"></i>Restaurar dados de demonstração (Kyte)</button>
          <button class="btn btn-ghost text-danger" id="btnWipe"><i class="bi bi-trash me-1"></i>Apagar todos os dados</button>
        </div></div></div>
    </div>`;

    box.querySelector('#btnBkp').onclick = () => App.doBackup();
    box.querySelector('#btnRest').onclick = () => box.querySelector('#fBkp').click();
    box.querySelector('#fBkp').onchange = (ev) => {
      const f = ev.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = async () => {
        try {
          const ok = await App.confirm({ title: 'Restaurar backup', message: 'Isto substituirá todos os dados atuais. Continuar?', danger: true, confirm: 'Restaurar' });
          if (!ok) return;
          await Store.importAll(JSON.parse(r.result)); App.toast('Backup restaurado!', 'success'); App.refreshChrome(); this.render(document.getElementById('view'));
        } catch (e) { App.toast('Arquivo inválido.', 'danger'); }
      };
      r.readAsText(f);
    };
    box.querySelector('#btnCsv').onclick = () => box.querySelector('#fCsv').click();
    box.querySelector('#fCsv').onchange = (ev) => this._importCsv([...ev.target.files], box.querySelector('#csvLog'));

    box.querySelector('#btnDemo').onclick = async () => {
      const ok = await App.confirm({ title: 'Restaurar demonstração', message: 'Recarrega os dados importados do Kyte e descarta as alterações. Continuar?', danger: true, confirm: 'Restaurar' });
      if (ok) { await Store.wipe(true); App.toast('Dados restaurados.', 'success'); App.refreshChrome(); App.navigate('dashboard'); }
    };
    box.querySelector('#btnWipe').onclick = async () => {
      const ok = await App.confirm({ title: 'Apagar tudo', message: 'Todos os dados serão apagados permanentemente. Esta ação não pode ser desfeita!', danger: true, confirm: 'Apagar tudo' });
      if (ok) { await Store.wipe(false); App.toast('Dados apagados.', 'info'); App.refreshChrome(); this.render(document.getElementById('view')); }
    };
  },

  /* ---- Importação de CSV do Kyte (no navegador) ---- */
  async _importCsv(files, log) {
    log.innerHTML = '<div class="text-muted-2"><span class="skeleton" style="display:inline-block;width:160px;height:14px"></span> Processando…</div>';
    let resumo = [];
    for (const file of files) {
      const text = await file.text();
      const wb = XLSX.read(text, { type: 'string', raw: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      if (cols.includes('Preço de Venda')) resumo.push(await this._impProdutos(rows));
      else if (cols.includes('Meios de Pagamento')) resumo.push(await this._impVendas(rows));
      else if (cols.includes('Telefone') && cols.includes('Data Criação')) resumo.push(await this._impClientes(rows));
      else resumo.push(`<span class="text-danger">⚠ ${App.escape(file.name)}: formato não reconhecido.</span>`);
    }
    log.innerHTML = `<div class="badge-soft b-green w-100 justify-content-start" style="padding:12px;flex-direction:column;align-items:flex-start;gap:4px">
      ${resumo.map((r) => `<div>${r}</div>`).join('')}</div>`;
    App.refreshChrome();
    App.toast('Importação concluída.', 'success');
  },
  async _impProdutos(rows) {
    const cats = await Store.list('categorias'); let n = 0;
    for (const r of rows) {
      const nome = String(r['Nome'] || '').trim(); if (!nome) continue;
      const cat = String(r['Categoria'] || '').trim();
      if (cat && !cats.some((c) => c.nome === cat)) { await Store.create('categorias', { nome: cat, cor: '#2563eb' }); cats.push({ nome: cat }); }
      const custo = App.parseMoney(r['Preço de Custo']); const preco = App.parseMoney(r['Preço de Venda']);
      await Store.create('produtos', { nome, categoria: cat, unidade: String(r['Unit / Frac.'] || 'un'), custo, preco, margem: preco ? Math.round((preco - custo) / preco * 1000) / 10 : 0, estoqueAtual: parseInt(App.parseMoney(r['Estoque Atual'])) || 0, estoqueMinimo: parseInt(App.parseMoney(r['Estoque Minimo'])) || 0, ativo: true, codigo: '', sku: '', codigoBarras: '', foto: '' });
      n++;
    }
    return `✅ <b>${n}</b> produtos importados.`;
  },
  async _impClientes(rows) {
    let n = 0;
    for (const r of rows) {
      const nome = String(r['Nome'] || '').trim(); if (!nome) continue;
      const bloq = /N[ÃA]O\s*VENDER|N[ÃA]O\s*PAGA/i.test(nome);
      await Store.create('clientes', { nome: nome.replace(/\s*-?\s*N[ÃA]O\s*VENDER.*$/i, '').trim() || nome, telefone: String(r['Telefone'] || ''), telefone2: String(r['Telefone 2'] || ''), whatsapp: String(r['Telefone'] || ''), email: String(r['Email'] || ''), endereco: String(r['Endereço'] || ''), doc: String(r['N° Doc.'] || ''), obs: String(r['Observações'] || ''), bloqueado: bloq, totalComprado: 0, qtdCompras: 0, ultimaCompra: null, criadoEm: new Date().toISOString() });
      n++;
    }
    return `✅ <b>${n}</b> clientes importados.`;
  },
  async _impVendas(rows) {
    const clientes = await Store.list('clientes'); let n = 0;
    const findCli = (nome) => clientes.find((c) => c.nome.toLowerCase() === String(nome || '').trim().toLowerCase());
    for (const r of rows) {
      const numero = String(r['Número'] || '').trim(); const total = App.parseMoney(r['Total']);
      const meio = String(r['Meios de Pagamento'] || '').toLowerCase();
      const tipo = meio.includes('fiado') ? 'fiado' : meio.includes('pix') ? 'pix' : meio.includes('dinheiro') ? 'dinheiro' : meio.includes('déb') || meio.includes('deb') ? 'debito' : meio.includes('créd') || meio.includes('cred') || meio.includes('cart') ? 'credito' : 'outro';
      const cli = findCli(r['Cliente']);
      const data = parseDateBR(r['Data/Hora']);
      const v = await Store.create('vendas', { numero, data, itens: parseItens(r['Descri. itens']), qtdItens: parseInt(App.parseMoney(r['Total de itens'])) || 0, subtotal: App.parseMoney(r['Subtotal']) || total, desconto: App.parseMoney(r['Desconto']), acrescimo: App.parseMoney(r['Taxa']), entrega: App.parseMoney(r['Entrega']), total, lucro: App.parseMoney(r['Lucro']), pagamentos: [{ tipo, valor: total, label: r['Meios de Pagamento'] }], clienteId: cli ? cli.id : null, clienteNome: cli ? cli.nome : String(r['Cliente'] || ''), vendedor: String(r['Vendedor'] || ''), obs: String(r['Observação'] || ''), status: 'concluida', pago: tipo !== 'fiado' });
      if (tipo === 'fiado' && cli) await Store.create('contasReceber', { descricao: `Venda ${numero} - ${cli.nome}`, clienteId: cli.id, clienteNome: cli.nome, vendaId: v.id, categoria: 'Vendas a prazo (fiado)', valor: total, valorRecebido: 0, emissao: data, vencimento: data, status: 'pendente', parcela: '1/1' });
      else if (total > 0) await Store.create('movCaixa', { data, tipo: 'entrada', categoria: 'Venda', descricao: 'Venda ' + numero, valor: total, origem: 'venda', refId: v.id, formaPagamento: tipo });
      if (cli) await Store.update('clientes', cli.id, { totalComprado: (cli.totalComprado || 0) + total, qtdCompras: (cli.qtdCompras || 0) + 1, ultimaCompra: data });
      n++;
    }
    return `✅ <b>${n}</b> vendas importadas (fiado vira Contas a Receber).`;
  }
});

/* utilidades de importação CSV */
function parseDateBR(s) {
  s = String(s || '').trim(); const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return new Date().toISOString();
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).toISOString();
}
function parseItens(desc) {
  desc = String(desc || '').trim(); if (!desc) return [];
  return desc.split(/\s*,\s*(?=\d+\s*x)/).map((p) => { const m = p.trim().match(/^(\d+)\s*x\s*(.+)$/); return m ? { nome: m[2].trim(), qtd: +m[1] } : { nome: p.trim(), qtd: 1 }; });
}
