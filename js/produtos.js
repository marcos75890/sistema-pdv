/* =====================================================================
   produtos.js — Cadastro / gestão de produtos
   ===================================================================== */
App.registerModule('produtos', {
  filtroCat: 'todas', busca: '', soBaixo: false,

  async render(view) {
    const [produtos, cats] = await Promise.all([Store.list('produtos'), Store.list('categorias')]);
    this._cats = cats;
    const ativos = produtos.filter((p) => p.ativo).length;
    const valorEstoque = produtos.reduce((s, p) => s + (p.preco * (p.estoqueAtual || 0)), 0);
    const baixo = produtos.filter((p) => p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo).length;

    view.innerHTML = App.pageHead('Produtos', `${produtos.length} produtos · ${ativos} ativos`,
      `<button class="btn btn-ghost btn-sm" id="btnCat"><i class="bi bi-tags me-1"></i>Categorias</button>
       <button class="btn btn-ghost btn-sm" id="btnExp"><i class="bi bi-download me-1"></i>Exportar</button>
       <button class="btn btn-primary btn-sm" id="btnNovo"><i class="bi bi-plus-lg me-1"></i>Novo produto</button>`) +
      `<div class="kpi-grid stagger" style="margin-bottom:18px">
        ${App.kpi({ label: 'Total de produtos', icon: 'bi-box-seam', ico: 'ic-blue', value: App.fmt.num(produtos.length) })}
        ${App.kpi({ label: 'Valor em estoque (venda)', icon: 'bi-cash-stack', ico: 'ic-green', value: App.fmt.money(valorEstoque) })}
        ${App.kpi({ label: 'Categorias', icon: 'bi-tags', ico: 'ic-purple', value: App.fmt.num(cats.length) })}
        ${App.kpi({ label: 'Estoque baixo', icon: 'bi-exclamation-triangle', ico: baixo ? 'ic-red' : 'ic-green', value: App.fmt.num(baixo) })}
       </div>
       <div class="panel">
        <div class="panel-head">
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="global-search" style="max-width:260px"><i class="bi bi-search"></i>
              <input type="text" id="pSearch" placeholder="Buscar produto…"></div>
            <select class="form-select form-select-sm" id="pCat" style="width:auto">
              <option value="todas">Todas categorias</option>
              ${cats.map((c) => `<option value="${App.escape(c.nome)}">${App.escape(c.nome)}</option>`).join('')}
            </select>
            <label class="chip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pBaixo"> Estoque baixo</label>
          </div>
        </div>
        <div class="panel-body" style="padding:0"><div id="pTable"></div></div>
       </div>`;

    this._all = produtos;
    const draw = () => this._draw();
    view.querySelector('#pSearch').oninput = App.debounce((e) => { this.busca = e.target.value; draw(); }, 150);
    view.querySelector('#pCat').onchange = (e) => { this.filtroCat = e.target.value; draw(); };
    view.querySelector('#pBaixo').onchange = (e) => { this.soBaixo = e.target.checked; draw(); };
    view.querySelector('#btnNovo').onclick = () => this._form();
    view.querySelector('#btnCat').onclick = () => this._gerenciarCategorias();
    view.querySelector('#btnExp').onclick = () => exportXLSX(this._all.map((p) => ({
      Codigo: p.codigo, Nome: p.nome, Categoria: p.categoria, Unidade: p.unidade, Custo: p.custo,
      Preco: p.preco, Margem: p.margem, EstoqueAtual: p.estoqueAtual, EstoqueMinimo: p.estoqueMinimo, Ativo: p.ativo ? 'Sim' : 'Não'
    })), 'produtos');
    draw();
  },

  _draw() {
    let list = this._all;
    if (this.filtroCat !== 'todas') list = list.filter((p) => p.categoria === this.filtroCat);
    if (this.soBaixo) list = list.filter((p) => p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo);
    const q = (this.busca || '').toLowerCase().trim();
    if (q) list = list.filter((p) => p.nome.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q));
    const box = document.getElementById('pTable');
    if (!list.length) { box.innerHTML = App.empty('Nenhum produto encontrado.', 'box'); return; }
    box.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>
      <th>Produto</th><th>Categoria</th><th class="num">Custo</th><th class="num">Preço</th><th class="num">Margem</th><th class="num">Estoque</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${list.map((p) => {
        const baixo = p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo;
        return `<tr class="row-click" data-edit="${p.id}">
          <td><div class="d-flex align-items-center gap-2">
            <span class="thumb">${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;border-radius:10px;object-fit:cover">` : '<i class="bi bi-box-seam"></i>'}</span>
            <div><strong>${App.escape(p.nome)}</strong><br><small class="text-muted-2">${App.escape(p.codigo || p.sku || '')}</small></div></div></td>
          <td><span class="badge-soft b-gray">${App.escape(p.categoria || '—')}</span></td>
          <td class="num text-muted-2">${App.fmt.money(p.custo)}</td>
          <td class="num"><strong>${App.fmt.money(p.preco)}</strong></td>
          <td class="num">${App.fmt.pct(p.margem || 0)}</td>
          <td class="num"><span class="badge-soft ${baixo ? (p.estoqueAtual <= 0 ? 'b-red' : 'b-orange') : 'b-green'}">${p.estoqueAtual} ${App.escape(p.unidade || 'un')}</span></td>
          <td>${p.ativo ? '<span class="badge-soft b-green"><span class="dot" style="background:var(--ok)"></span>Ativo</span>' : '<span class="badge-soft b-gray">Inativo</span>'}</td>
          <td class="num"><button class="btn-icon" data-del="${p.id}" title="Excluir" style="width:32px;height:32px"><i class="bi bi-trash text-danger"></i></button></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
    box.querySelectorAll('[data-edit]').forEach((r) => r.onclick = (e) => { if (e.target.closest('[data-del]')) return; this._form(r.dataset.edit); });
    box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); this._excluir(b.dataset.del); });
  },

  async _form(id) {
    const p = id ? await Store.get('produtos', id) : {
      nome: '', categoria: '', codigo: '', codigoBarras: '', sku: '', marca: '', unidade: 'un',
      custo: 0, preco: 0, margem: 0, estoqueAtual: 0, estoqueMinimo: 0, foto: '', ativo: true
    };
    const cats = this._cats;
    const body = `
      <form id="prodForm">
        <div class="row g-3">
          <div class="col-12 text-center">
            <div class="thumb" id="fotoPrev" style="width:84px;height:84px;margin:0 auto;font-size:30px">${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;border-radius:10px;object-fit:cover">` : '<i class="bi bi-image"></i>'}</div>
            <input type="file" id="fFoto" accept="image/*" class="d-none">
            <button type="button" class="btn btn-ghost btn-sm mt-2" id="btnFoto"><i class="bi bi-camera me-1"></i>Foto do produto</button>
          </div>
          <div class="col-12"><label class="form-label">Nome *</label><input class="form-control" name="nome" value="${App.escape(p.nome)}" required></div>
          <div class="col-md-6"><label class="form-label">Categoria</label>
            <input class="form-control" name="categoria" list="catList" value="${App.escape(p.categoria || '')}">
            <datalist id="catList">${cats.map((c) => `<option value="${App.escape(c.nome)}">`).join('')}</datalist></div>
          <div class="col-md-3"><label class="form-label">Marca</label><input class="form-control" name="marca" value="${App.escape(p.marca || '')}"></div>
          <div class="col-md-3"><label class="form-label">Unidade</label>
            <select class="form-select" name="unidade">${['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'm'].map((u) => `<option ${p.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
          <div class="col-md-4"><label class="form-label">Código interno</label><input class="form-control" name="codigo" value="${App.escape(p.codigo || '')}"></div>
          <div class="col-md-4"><label class="form-label">SKU</label><input class="form-control" name="sku" value="${App.escape(p.sku || '')}"></div>
          <div class="col-md-4"><label class="form-label">Código de barras</label><input class="form-control" name="codigoBarras" value="${App.escape(p.codigoBarras || '')}"></div>
          <div class="col-md-4"><label class="form-label">Custo (R$)</label><input type="number" step="0.01" class="form-control" name="custo" id="fCusto" value="${p.custo || ''}"></div>
          <div class="col-md-4"><label class="form-label">Preço de venda (R$)</label><input type="number" step="0.01" class="form-control" name="preco" id="fPreco" value="${p.preco || ''}"></div>
          <div class="col-md-4"><label class="form-label">Margem de lucro</label><input class="form-control" id="fMargem" value="${App.fmt.pct(p.margem || 0)}" readonly></div>
          <div class="col-md-4"><label class="form-label">Estoque atual</label><input type="number" class="form-control" name="estoqueAtual" value="${p.estoqueAtual || 0}"></div>
          <div class="col-md-4"><label class="form-label">Estoque mínimo</label><input type="number" class="form-control" name="estoqueMinimo" value="${p.estoqueMinimo || 0}"></div>
          <div class="col-md-4 d-flex align-items-end"><label class="chip w-100 justify-content-center" style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}> Produto ativo</label></div>
        </div>
      </form>`;
    App.modal({
      title: id ? 'Editar produto' : 'Novo produto', size: 'lg', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button>
               <button class="btn btn-primary" id="btnSave"><i class="bi bi-check2 me-1"></i>Salvar</button>`,
      onShown: (c, m) => {
        let fotoData = p.foto || '';
        const calcM = () => {
          const custo = parseFloat(c.querySelector('#fCusto').value) || 0, preco = parseFloat(c.querySelector('#fPreco').value) || 0;
          c.querySelector('#fMargem').value = App.fmt.pct(preco ? (preco - custo) / preco * 100 : 0);
        };
        c.querySelector('#fCusto').oninput = calcM; c.querySelector('#fPreco').oninput = calcM;
        c.querySelector('#btnFoto').onclick = () => c.querySelector('#fFoto').click();
        c.querySelector('#fFoto').onchange = (e) => {
          const file = e.target.files[0]; if (!file) return;
          const r = new FileReader(); r.onload = () => { fotoData = r.result; c.querySelector('#fotoPrev').innerHTML = `<img src="${fotoData}" style="width:100%;height:100%;border-radius:10px;object-fit:cover">`; }; r.readAsDataURL(file);
        };
        c.querySelector('#btnSave').onclick = async () => {
          const f = c.querySelector('#prodForm');
          if (!f.nome.value.trim()) { App.toast('Informe o nome.', 'warning'); return; }
          const custo = parseFloat(f.custo.value) || 0, preco = parseFloat(f.preco.value) || 0;
          const data = {
            nome: f.nome.value.trim(), categoria: f.categoria.value.trim(), marca: f.marca.value.trim(),
            unidade: f.unidade.value, codigo: f.codigo.value.trim(), sku: f.sku.value.trim(), codigoBarras: f.codigoBarras.value.trim(),
            custo, preco, margem: preco ? Math.round((preco - custo) / preco * 1000) / 10 : 0,
            estoqueAtual: parseInt(f.estoqueAtual.value) || 0, estoqueMinimo: parseInt(f.estoqueMinimo.value) || 0,
            foto: fotoData, ativo: f.ativo.checked
          };
          // garante categoria cadastrada
          if (data.categoria && !this._cats.some((x) => x.nome === data.categoria)) {
            await Store.create('categorias', { nome: data.categoria, cor: '#2563eb' });
          }
          if (id) await Store.update('produtos', id, data); else await Store.create('produtos', data);
          m.hide(); App.toast('Produto salvo.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  },

  async _excluir(id) {
    const p = await Store.get('produtos', id);
    const ok = await App.confirm({ title: 'Excluir produto', message: `Excluir <b>${App.escape(p.nome)}</b>? Esta ação não pode ser desfeita.`, danger: true, confirm: 'Excluir' });
    if (!ok) return;
    await Store.remove('produtos', id); App.toast('Produto excluído.', 'info'); this.render(document.getElementById('view'));
  },

  async _gerenciarCategorias() {
    const cats = await Store.list('categorias');
    const body = `<div class="d-flex gap-2 mb-3"><input class="form-control" id="catNome" placeholder="Nova categoria…">
      <button class="btn btn-primary" id="catAdd"><i class="bi bi-plus-lg"></i></button></div>
      <div id="catList">${cats.map((c) => `<div class="d-flex align-items-center justify-content-between p-2 border-bottom">
        <span><span class="dot" style="background:${c.cor || '#2563eb'};margin-right:8px"></span>${App.escape(c.nome)}</span>
        <button class="btn-icon" data-delc="${c.id}" style="width:32px;height:32px"><i class="bi bi-trash text-danger"></i></button></div>`).join('') || App.empty('Sem categorias.', 'tags')}</div>`;
    App.modal({
      title: 'Categorias', body, footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Fechar</button>`,
      onShown: (c, m) => {
        c.querySelector('#catAdd').onclick = async () => {
          const n = c.querySelector('#catNome').value.trim(); if (!n) return;
          await Store.create('categorias', { nome: n, cor: '#2563eb' }); m.hide(); this._gerenciarCategorias();
        };
        c.querySelectorAll('[data-delc]').forEach((b) => b.onclick = async () => {
          await Store.remove('categorias', b.dataset.delc); m.hide(); this._gerenciarCategorias();
        });
      }
    });
  }
});
