/* =====================================================================
   vendas.js — PDV (ponto de venda) + histórico de vendas
   ===================================================================== */
App.registerModule('vendas', {
  cart: [],
  clienteId: null,
  desconto: 0,
  acrescimo: 0,
  filtroCat: 'todas',
  busca: '',

  async render(view) {
    const tab = (location.hash.split('?tab=')[1] || 'pdv');
    view.innerHTML = App.pageHead('PDV / Vendas', 'Registre vendas em poucos cliques',
      `<div class="chips">
        <button class="chip ${tab === 'pdv' ? 'active' : ''}" data-tab="pdv"><i class="bi bi-bag-plus me-1"></i>Nova venda</button>
        <button class="chip ${tab === 'historico' ? 'active' : ''}" data-tab="historico"><i class="bi bi-clock-history me-1"></i>Histórico</button>
      </div>`) + `<div id="vendasBody"></div>`;

    view.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { location.hash = '#/vendas?tab=' + b.dataset.tab; });

    if (tab === 'historico') this._historico(document.getElementById('vendasBody'));
    else this._pdv(document.getElementById('vendasBody'));
  },

  /* ============================ PDV ============================ */
  async _pdv(box) {
    const [produtos, clientes] = await Promise.all([
      Store.list('produtos', (p) => p.ativo), Store.list('clientes')
    ]);
    this._produtos = produtos; this._clientes = clientes;
    const cats = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))];

    box.innerHTML = `
      <div class="pdv">
        <div class="pdv-catalog">
          <div class="pdv-search global-search" style="max-width:none">
            <i class="bi bi-upc-scan"></i>
            <input type="text" id="pdvBusca" placeholder="Buscar por nome, SKU ou código de barras… (Enter adiciona)" autocomplete="off" autofocus />
          </div>
          <div class="chips" id="pdvCats" style="margin-bottom:14px">
            <button class="chip ${this.filtroCat === 'todas' ? 'active' : ''}" data-cat="todas">Todas</button>
            ${cats.map((c) => `<button class="chip ${this.filtroCat === c ? 'active' : ''}" data-cat="${App.escape(c)}">${App.escape(c)}</button>`).join('')}
          </div>
          <div class="pdv-grid" id="pdvGrid"></div>
        </div>

        <div class="cart panel">
          <div class="cart-head">
            <h2 style="margin:0;font-size:15px"><i class="bi bi-cart3 me-1"></i>Carrinho</h2>
            <button class="btn-icon" id="cartClear" title="Limpar carrinho"><i class="bi bi-trash"></i></button>
          </div>
          <div style="padding:10px 14px 0">
            <button class="btn btn-ghost btn-sm w-100 text-start" id="cartCliente">
              <i class="bi bi-person-plus me-1"></i><span id="cartClienteLbl">Selecionar cliente (opcional)</span>
            </button>
          </div>
          <div class="cart-items" id="cartItems"></div>
          <div class="cart-foot" id="cartFoot"></div>
        </div>
      </div>`;

    // eventos catálogo
    const busca = box.querySelector('#pdvBusca');
    busca.addEventListener('input', App.debounce(() => { this.busca = busca.value; this._renderGrid(); }, 120));
    busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._scanAdd(busca.value, busca); });
    box.querySelectorAll('#pdvCats .chip').forEach((c) => c.onclick = () => {
      this.filtroCat = c.dataset.cat;
      box.querySelectorAll('#pdvCats .chip').forEach((x) => x.classList.toggle('active', x === c));
      this._renderGrid();
    });
    box.querySelector('#cartClear').onclick = () => this._confirmClear();
    box.querySelector('#cartCliente').onclick = () => this._pickCliente();

    this._renderGrid();
    this._renderCart();
  },

  _renderGrid() {
    const grid = document.getElementById('pdvGrid');
    if (!grid) return;
    let list = this._produtos;
    if (this.filtroCat !== 'todas') list = list.filter((p) => p.categoria === this.filtroCat);
    const q = (this.busca || '').toLowerCase().trim();
    if (q) list = list.filter((p) => p.nome.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.codigoBarras || '').includes(q));
    if (!list.length) { grid.innerHTML = App.empty('Nenhum produto encontrado.', 'search'); return; }
    grid.innerHTML = list.slice(0, 60).map((p) => {
      const cor = (this._catCor(p.categoria));
      const semEstoque = p.estoqueMinimo > 0 && p.estoqueAtual <= 0;
      return `<button class="prod-card" data-add="${p.id}">
        ${p.estoqueMinimo > 0 ? `<span class="pc-stock badge-soft ${semEstoque ? 'b-red' : 'b-gray'}">${p.estoqueAtual} un</span>` : ''}
        <div class="pc-thumb" style="background:${cor}1f;color:${cor}"><i class="bi bi-cup-straw"></i></div>
        <div class="pc-name">${App.escape(p.nome)}</div>
        <div class="pc-price">${App.fmt.money(p.preco)}</div>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => this._add(b.dataset.add));
  },

  _catCor(nome) { const p = this._produtos.find((x) => x.categoria === nome); return '#2563eb'; },

  _scanAdd(value, input) {
    const q = (value || '').toLowerCase().trim(); if (!q) return;
    let prod = this._produtos.find((p) => (p.codigoBarras || '') === value.trim() || (p.sku || '').toLowerCase() === q);
    if (!prod) prod = this._produtos.find((p) => p.nome.toLowerCase().includes(q));
    if (prod) { this._add(prod.id); input.value = ''; this.busca = ''; this._renderGrid(); App.toast(prod.nome + ' adicionado', 'success'); }
    else App.toast('Produto não encontrado.', 'warning');
  },

  _add(id) {
    const p = this._produtos.find((x) => x.id === id); if (!p) return;
    const item = this.cart.find((i) => i.produtoId === id);
    if (item) item.qtd++;
    else this.cart.push({ produtoId: id, nome: p.nome, preco: p.preco, custo: p.custo, qtd: 1 });
    this._renderCart();
  },
  _setQty(id, delta) {
    const i = this.cart.find((x) => x.produtoId === id); if (!i) return;
    i.qtd += delta; if (i.qtd <= 0) this.cart = this.cart.filter((x) => x.produtoId !== id);
    this._renderCart();
  },

  _totais() {
    const subtotal = this.cart.reduce((s, i) => s + i.preco * i.qtd, 0);
    const total = Math.max(0, subtotal - this.desconto + this.acrescimo);
    const custo = this.cart.reduce((s, i) => s + (i.custo || 0) * i.qtd, 0);
    return { subtotal, total, lucro: total - custo, custo };
  },

  /* helpers de data p/ vencimento do fiado — retornam 'YYYY-MM-DD' (local) */
  _toYMD(d) {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
  },
  _addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return this._toYMD(d); },
  _addMonths(n) {
    const d = new Date(); const dia = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < dia) d.setDate(0); // ajusta meses mais curtos (ex.: 31 -> último dia)
    return this._toYMD(d);
  },

  _renderCart() {
    const wrap = document.getElementById('cartItems'); const foot = document.getElementById('cartFoot');
    if (!wrap) return;
    if (!this.cart.length) {
      wrap.innerHTML = `<div class="empty" style="padding:34px 10px"><i class="bi bi-cart"></i><p>Carrinho vazio</p><small class="text-3">Clique nos produtos para adicionar</small></div>`;
    } else {
      wrap.innerHTML = this.cart.map((i) => `
        <div class="cart-row">
          <div class="ci-name"><strong>${App.escape(i.nome)}</strong><small>${App.fmt.money(i.preco)} cada</small></div>
          <div class="qty-step">
            <button data-dec="${i.produtoId}">−</button><span>${i.qtd}</span><button data-inc="${i.produtoId}">+</button>
          </div>
          <div style="width:74px;text-align:right;font-weight:700">${App.fmt.money(i.preco * i.qtd)}</div>
        </div>`).join('');
      wrap.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => this._setQty(b.dataset.inc, 1));
      wrap.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => this._setQty(b.dataset.dec, -1));
    }
    const t = this._totais();
    const cli = this.clienteId ? this._clientes.find((c) => c.id === this.clienteId) : null;
    const lbl = document.getElementById('cartClienteLbl');
    if (lbl) lbl.textContent = cli ? cli.nome : 'Selecionar cliente (opcional)';

    foot.innerHTML = `
      <div class="d-flex gap-2 mb-2">
        <div class="flex-fill"><label class="form-label" style="font-size:11px">Desconto (R$)</label>
          <input type="number" class="form-control form-control-sm" id="inDesc" min="0" step="0.01" value="${this.desconto || ''}" placeholder="0,00"></div>
        <div class="flex-fill"><label class="form-label" style="font-size:11px">Acréscimo (R$)</label>
          <input type="number" class="form-control form-control-sm" id="inAcr" min="0" step="0.01" value="${this.acrescimo || ''}" placeholder="0,00"></div>
      </div>
      <div class="cart-total-row"><span>Subtotal</span><span>${App.fmt.money(t.subtotal)}</span></div>
      ${this.desconto ? `<div class="cart-total-row"><span>Desconto</span><span class="trend-down">− ${App.fmt.money(this.desconto)}</span></div>` : ''}
      ${this.acrescimo ? `<div class="cart-total-row"><span>Acréscimo</span><span>+ ${App.fmt.money(this.acrescimo)}</span></div>` : ''}
      <div class="cart-total-row grand"><span>Total</span><span>${App.fmt.money(t.total)}</span></div>
      <button class="btn btn-primary btn-lg w-100" id="btnFinalizar" ${this.cart.length ? '' : 'disabled'}>
        <i class="bi bi-check2-circle me-1"></i>Finalizar venda</button>`;
    foot.querySelector('#inDesc').oninput = (e) => { this.desconto = parseFloat(e.target.value) || 0; this._updTotals(); };
    foot.querySelector('#inAcr').oninput = (e) => { this.acrescimo = parseFloat(e.target.value) || 0; this._updTotals(); };
    foot.querySelector('#btnFinalizar').onclick = () => this._finalizar();
  },
  _updTotals() {
    const t = this._totais();
    const grand = document.querySelector('#cartFoot .grand span:last-child');
    if (grand) grand.textContent = App.fmt.money(t.total);
  },

  /* ---- seleção de cliente ---- */
  _pickCliente() {
    const body = `<input type="text" class="form-control mb-2" id="cliSearch" placeholder="Buscar cliente…" autofocus>
      <div id="cliList" style="max-height:340px;overflow:auto"></div>`;
    App.modal({
      title: 'Selecionar cliente', body, footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Fechar</button>`,
      onShown: (c, m) => {
        const render = (q) => {
          q = (q || '').toLowerCase();
          const list = this._clientes.filter((x) => x.nome.toLowerCase().includes(q)).slice(0, 40);
          c.querySelector('#cliList').innerHTML =
            `<div class="search-item" data-pick=""><span class="si-ico ic-blue"><i class="bi bi-person-x"></i></span><div class="rank-meta"><strong>Sem cliente (consumidor)</strong></div></div>` +
            list.map((x) => `<div class="search-item ${x.bloqueado ? 'text-danger' : ''}" data-pick="${x.id}">
              <span class="si-ico ${x.bloqueado ? 'ic-red' : 'ic-purple'}"><i class="bi bi-person"></i></span>
              <div class="rank-meta"><strong>${App.escape(x.nome)} ${x.bloqueado ? '<span class="badge-soft b-red" style="font-size:9px">BLOQUEADO</span>' : ''}</strong>
              <small>${App.fmt.money(x.totalComprado || 0)} · ${x.qtdCompras || 0} compras</small></div></div>`).join('');
          c.querySelectorAll('[data-pick]').forEach((it) => it.onclick = () => {
            this.clienteId = it.dataset.pick || null; m.hide(); this._renderCart();
          });
        };
        c.querySelector('#cliSearch').oninput = (e) => render(e.target.value);
        render('');
      }
    });
  },

  _confirmClear() {
    if (!this.cart.length) return;
    App.confirm({ title: 'Limpar carrinho', message: 'Remover todos os itens do carrinho?', danger: true, confirm: 'Limpar' })
      .then((ok) => { if (ok) { this.cart = []; this.desconto = 0; this.acrescimo = 0; this.clienteId = null; this._renderCart(); } });
  },

  /* ---- finalização / pagamento ---- */
  _finalizar() {
    const t = this._totais();
    const cli = this.clienteId ? this._clientes.find((c) => c.id === this.clienteId) : null;
    if (cli && cli.bloqueado) {
      App.confirm({ title: 'Cliente bloqueado', message: `<b>${App.escape(cli.nome)}</b> está marcado como <b>NÃO VENDER / NÃO PAGA</b>. Deseja continuar mesmo assim?`, danger: true, confirm: 'Vender assim mesmo' })
        .then((ok) => { if (ok) this._pagamentoModal(t, cli); });
      return;
    }
    this._pagamentoModal(t, cli);
  },

  _pagamentoModal(t, cli) {
    const metodos = [
      ['dinheiro', 'Dinheiro', 'bi-cash'], ['pix', 'PIX', 'bi-qr-code'], ['credito', 'Crédito', 'bi-credit-card'],
      ['debito', 'Débito', 'bi-credit-card-2-front'], ['fiado', 'Fiado', 'bi-journal-text']
    ];
    this._pgMetodo = 'dinheiro';
    const body = `
      <div class="text-center mb-3">
        <div class="text-muted-2" style="font-size:13px">Total a pagar</div>
        <div style="font-size:30px;font-weight:800;color:var(--brand)">${App.fmt.money(t.total)}</div>
        ${cli ? `<span class="badge-soft b-purple"><i class="bi bi-person"></i> ${App.escape(cli.nome)}</span>` : '<span class="badge-soft b-gray">Consumidor</span>'}
      </div>
      <label class="form-label">Forma de pagamento</label>
      <div class="pay-grid mb-3" id="payGrid">
        ${metodos.map((m, i) => `<div class="pay-opt ${i === 0 ? 'active' : ''}" data-m="${m[0]}"><i class="bi ${m[2]}"></i>${m[1]}</div>`).join('')}
      </div>
      <div id="payExtra"></div>`;
    App.modal({
      title: 'Pagamento', size: '', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button>
               <button class="btn btn-success" id="btnConfirmPag"><i class="bi bi-check2 me-1"></i>Confirmar venda</button>`,
      onShown: (c, m) => {
        const extra = c.querySelector('#payExtra');
        const renderExtra = () => {
          if (this._pgMetodo === 'dinheiro') {
            extra.innerHTML = `<label class="form-label">Valor recebido</label>
              <input type="number" class="form-control form-control-lg" id="recebido" step="0.01" value="${t.total.toFixed(2)}">
              <div class="mt-2 d-flex justify-content-between"><span class="text-muted-2">Troco</span><strong id="troco">${App.fmt.money(0)}</strong></div>`;
            const inp = c.querySelector('#recebido');
            inp.oninput = () => c.querySelector('#troco').textContent = App.fmt.money(Math.max(0, (parseFloat(inp.value) || 0) - t.total));
            inp.focus(); inp.select();
          } else if (this._pgMetodo === 'credito') {
            extra.innerHTML = `<label class="form-label">Parcelas</label>
              <select class="form-select" id="parcelas">${[1, 2, 3, 4, 5, 6, 10, 12].map((n) => `<option value="${n}">${n}x de ${App.fmt.money(t.total / n)}</option>`).join('')}</select>`;
          } else if (this._pgMetodo === 'fiado') {
            if (!cli) {
              extra.innerHTML = `<div class="badge-soft b-red w-100 justify-content-center" style="padding:10px"><i class="bi bi-exclamation-triangle"></i> Selecione um cliente para vender fiado.</div>`;
            } else {
              this._fiadoVenc = this._addMonths(1);
              extra.innerHTML = `
                <div class="badge-soft b-orange w-100 justify-content-center mb-3" style="padding:10px"><i class="bi bi-info-circle"></i> Será lançado em <b>Contas a Receber</b> de ${App.escape(cli.nome)}.</div>
                <label class="form-label">Vencimento (quando o cliente vai pagar)</label>
                <input type="date" class="form-control form-control-lg" id="fiadoVenc" value="${this._fiadoVenc}">
                <div class="chips mt-2" id="fiadoAtalhos">
                  <button type="button" class="chip active" data-venc="m1"><i class="bi bi-calendar-event me-1"></i>Próximo mês</button>
                  <button type="button" class="chip" data-venc="d15">+15 dias</button>
                  <button type="button" class="chip" data-venc="d30">+30 dias</button>
                </div>`;
              const inp = c.querySelector('#fiadoVenc');
              inp.oninput = () => {
                this._fiadoVenc = inp.value;
                c.querySelectorAll('#fiadoAtalhos .chip').forEach((x) => x.classList.remove('active'));
              };
              c.querySelectorAll('#fiadoAtalhos .chip').forEach((b) => b.onclick = () => {
                const v = b.dataset.venc;
                this._fiadoVenc = v === 'm1' ? this._addMonths(1) : this._addDays(v === 'd15' ? 15 : 30);
                inp.value = this._fiadoVenc;
                c.querySelectorAll('#fiadoAtalhos .chip').forEach((x) => x.classList.toggle('active', x === b));
              });
            }
          } else extra.innerHTML = '';
        };
        c.querySelectorAll('.pay-opt').forEach((o) => o.onclick = () => {
          c.querySelectorAll('.pay-opt').forEach((x) => x.classList.remove('active')); o.classList.add('active');
          this._pgMetodo = o.dataset.m; renderExtra();
        });
        renderExtra();
        c.querySelector('#btnConfirmPag').onclick = () => {
          if (this._pgMetodo === 'fiado' && !cli) { App.toast('Selecione um cliente para vender fiado.', 'warning'); return; }
          this._salvarVenda(t, cli, m);
        };
      }
    });
  },

  async _salvarVenda(t, cli, modal) {
    const vendas = await Store.list('vendas');
    const maxNum = vendas.reduce((mx, v) => Math.max(mx, parseInt(v.numero) || 0), 1000);
    const numero = String(maxNum + 1);
    const tipo = this._pgMetodo;
    const vencISO = (tipo === 'fiado' && this._fiadoVenc) ? new Date(this._fiadoVenc + 'T12:00:00').toISOString() : null;
    const venda = {
      numero, data: new Date().toISOString(),
      vencimento: vencISO,
      itens: this.cart.map((i) => ({ produtoId: i.produtoId, nome: i.nome, qtd: i.qtd, preco: i.preco, subtotal: i.preco * i.qtd })),
      qtdItens: this.cart.reduce((s, i) => s + i.qtd, 0),
      subtotal: t.subtotal, desconto: this.desconto, acrescimo: this.acrescimo, entrega: 0,
      total: t.total, lucro: t.lucro,
      pagamentos: [{ tipo, valor: t.total, label: tipo }],
      clienteId: cli ? cli.id : null, clienteNome: cli ? cli.nome : 'Consumidor',
      vendedor: (App.user && App.user.nome) || 'Sistema',
      obs: '', status: 'concluida', pago: tipo !== 'fiado'
    };
    const saved = await Store.create('vendas', venda);

    // baixa de estoque + movimentação
    for (const it of this.cart) {
      const p = this._produtos.find((x) => x.id === it.produtoId);
      if (p && typeof p.estoqueAtual === 'number') {
        await Store.update('produtos', p.id, { estoqueAtual: p.estoqueAtual - it.qtd });
        await Store.create('movEstoque', { data: venda.data, produtoId: p.id, produtoNome: p.nome, tipo: 'saida', qtd: it.qtd, motivo: 'Venda ' + numero, refId: saved.id });
      }
    }
    // financeiro
    if (tipo === 'fiado' && cli) {
      await Store.create('contasReceber', {
        descricao: `Venda ${numero} - ${cli.nome}`, clienteId: cli.id, clienteNome: cli.nome, vendaId: saved.id,
        categoria: 'Vendas a prazo (fiado)', valor: t.total, valorRecebido: 0,
        emissao: venda.data, vencimento: vencISO || venda.data, status: 'pendente', parcela: '1/1'
      });
    } else {
      await Store.create('movCaixa', { data: venda.data, tipo: 'entrada', categoria: 'Venda', descricao: 'Venda ' + numero, valor: t.total, origem: 'venda', refId: saved.id, formaPagamento: tipo });
    }
    // atualiza cliente
    if (cli) {
      await Store.update('clientes', cli.id, {
        totalComprado: (cli.totalComprado || 0) + t.total, qtdCompras: (cli.qtdCompras || 0) + 1, ultimaCompra: venda.data
      });
    }

    modal.hide();
    App.toast('Venda ' + numero + ' registrada!', 'success');
    this.cart = []; this.desconto = 0; this.acrescimo = 0; this.clienteId = null;
    this._recibo(saved);
    // recarrega produtos (estoque atualizado)
    this._produtos = await Store.list('produtos', (p) => p.ativo);
    this._renderGrid(); this._renderCart();
  },

  /* ---- recibo / comprovante ---- */
  async _recibo(v) {
    const emp = await Store.getEmpresa();
    const html = this._reciboHTML(v, emp);
    App.modal({
      title: 'Venda concluída', body: `<div id="recArea">${html}</div>`,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Fechar</button>
               <button class="btn btn-primary" id="btnPrint"><i class="bi bi-printer me-1"></i>Imprimir comprovante</button>`,
      onShown: (c) => { c.querySelector('#btnPrint').onclick = () => this._imprimir(html); }
    });
  },
  _reciboHTML(v, emp) {
    return `<div class="receipt">
      <h3>${App.escape(emp.nome || 'Gestão Comercial')}</h3>
      <div style="text-align:center;font-size:11px">${App.escape(emp.cnpj ? 'CNPJ: ' + emp.cnpj : '')}</div>
      <hr>
      <div class="r-row"><span>Venda</span><span>#${App.escape(v.numero)}</span></div>
      <div class="r-row"><span>Data</span><span>${App.fmt.datetime(v.data)}</span></div>
      <div class="r-row"><span>Cliente</span><span>${App.escape(v.clienteNome || 'Consumidor')}</span></div>
      <div class="r-row"><span>Vendedor</span><span>${App.escape(v.vendedor || '')}</span></div>
      <hr>
      ${v.itens.map((i) => `<div class="r-row"><span>${i.qtd}x ${App.escape(i.nome)}</span><span>${App.fmt.money(i.subtotal)}</span></div>`).join('')}
      <hr>
      <div class="r-row"><span>Subtotal</span><span>${App.fmt.money(v.subtotal)}</span></div>
      ${v.desconto ? `<div class="r-row"><span>Desconto</span><span>-${App.fmt.money(v.desconto)}</span></div>` : ''}
      ${v.acrescimo ? `<div class="r-row"><span>Acréscimo</span><span>+${App.fmt.money(v.acrescimo)}</span></div>` : ''}
      <div class="r-row" style="font-weight:bold;font-size:15px"><span>TOTAL</span><span>${App.fmt.money(v.total)}</span></div>
      <div class="r-row"><span>Pagamento</span><span>${(v.pagamentos || []).map((p) => p.tipo).join(', ')}</span></div>
      ${v.vencimento && (v.pagamentos || []).some((p) => p.tipo === 'fiado') ? `<div class="r-row"><span>Vencimento (fiado)</span><span>${App.fmt.date ? App.fmt.date(v.vencimento) : App.fmt.datetime(v.vencimento)}</span></div>` : ''}
      <hr>
      <div style="text-align:center;font-size:11px">Obrigado pela preferência! 💙</div>
    </div>`;
  },
  _imprimir(html) {
    const w = window.open('', '_blank', 'width=380,height=640');
    w.document.write(`<html><head><title>Comprovante</title><style>
      body{font-family:'Courier New',monospace;padding:10px}
      .receipt{font-size:13px;color:#000}.receipt hr{border:0;border-top:1px dashed #999;margin:8px 0}
      .r-row{display:flex;justify-content:space-between}.receipt h3{text-align:center;margin:0}
    </style></head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  },

  /* ======================== HISTÓRICO ======================== */
  async _historico(box) {
    const vendas = (await Store.list('vendas')).sort((a, b) => new Date(b.data) - new Date(a.data));
    this._allVendas = vendas;
    box.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="global-search" style="max-width:280px"><i class="bi bi-search"></i>
              <input type="text" id="hSearch" placeholder="Buscar nº ou cliente…"></div>
            <select class="form-select form-select-sm" id="hPag" style="width:auto">
              <option value="">Todos pagamentos</option><option value="fiado">Fiado</option>
              <option value="dinheiro">Dinheiro</option><option value="pix">PIX</option>
              <option value="credito">Crédito</option><option value="debito">Débito</option>
            </select>
          </div>
          <button class="btn btn-ghost btn-sm" id="hExport"><i class="bi bi-file-earmark-excel me-1"></i>Excel</button>
        </div>
        <div class="panel-body" style="padding:0"><div id="hTable"></div></div>
      </div>`;
    const draw = () => {
      const q = (box.querySelector('#hSearch').value || '').toLowerCase();
      const pg = box.querySelector('#hPag').value;
      let list = vendas;
      if (q) list = list.filter((v) => (v.numero || '').toLowerCase().includes(q) || (v.clienteNome || '').toLowerCase().includes(q));
      if (pg) list = list.filter((v) => (v.pagamentos || []).some((p) => p.tipo === pg));
      box.querySelector('#hTable').innerHTML = list.length ? `
        <div class="table-wrap"><table class="data"><thead><tr>
          <th>Venda</th><th>Data/Hora</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th class="num">Total</th><th class="num">Lucro</th><th></th>
        </tr></thead><tbody>
        ${list.map((v) => `<tr class="row-click" data-ver="${v.id}">
          <td><strong>#${App.escape(v.numero)}</strong>${v.status === 'cancelada' ? ' <span class="badge-soft b-red">Cancelada</span>' : ''}</td>
          <td class="text-muted-2">${App.fmt.datetime(v.data)}</td>
          <td>${App.escape(v.clienteNome || '—')}</td>
          <td class="text-muted-2">${v.qtdItens || (v.itens || []).length}</td>
          <td>${pagamentoBadge(v)}</td>
          <td class="num"><strong>${App.fmt.money(v.total)}</strong></td>
          <td class="num text-muted-2">${App.fmt.money(v.lucro)}</td>
          <td class="num"><i class="bi bi-chevron-right text-3"></i></td></tr>`).join('')}
        </tbody></table></div>` : App.empty('Nenhuma venda encontrada.', 'receipt');
      box.querySelectorAll('[data-ver]').forEach((r) => r.onclick = () => this._verVenda(r.dataset.ver));
    };
    box.querySelector('#hSearch').oninput = App.debounce(draw, 150);
    box.querySelector('#hPag').onchange = draw;
    box.querySelector('#hExport').onclick = () => exportXLSX(vendas.map((v) => ({
      Numero: v.numero, Data: App.fmt.datetime(v.data), Cliente: v.clienteNome, Itens: v.qtdItens,
      Pagamento: (v.pagamentos || []).map((p) => p.tipo).join('+'), Total: v.total, Lucro: v.lucro, Status: v.status
    })), 'vendas');
    draw();
  },

  async _verVenda(id) {
    const v = await Store.get('vendas', id); const emp = await Store.getEmpresa();
    const html = this._reciboHTML(v, emp);
    App.modal({
      title: 'Venda #' + v.numero, body: html,
      footer: `${v.status !== 'cancelada' ? `<button class="btn btn-ghost text-danger" id="btnCancelar"><i class="bi bi-x-circle me-1"></i>Cancelar venda</button>` : ''}
               <button class="btn btn-primary" id="btnPrint"><i class="bi bi-printer me-1"></i>Imprimir</button>`,
      onShown: (c, m) => {
        c.querySelector('#btnPrint').onclick = () => this._imprimir(html);
        const cb = c.querySelector('#btnCancelar');
        if (cb) cb.onclick = async () => {
          const ok = await App.confirm({ title: 'Cancelar venda', message: 'A venda será marcada como cancelada e o estoque devolvido. Continuar?', danger: true, confirm: 'Cancelar venda' });
          if (!ok) return;
          await Store.update('vendas', v.id, { status: 'cancelada' });
          for (const it of (v.itens || [])) {
            if (it.produtoId) { const p = await Store.get('produtos', it.produtoId); if (p && typeof p.estoqueAtual === 'number') await Store.update('produtos', p.id, { estoqueAtual: p.estoqueAtual + it.qtd }); }
          }
          const crs = await Store.list('contasReceber', (x) => x.vendaId === v.id);
          for (const cr of crs) await Store.update('contasReceber', cr.id, { status: 'cancelado' });
          m.hide(); App.toast('Venda cancelada.', 'info'); this._historico(document.getElementById('vendasBody'));
        };
      }
    });
  }
});

/* util de exportação Excel (compartilhado) */
function exportXLSX(rows, nome) {
  if (!rows || !rows.length) { App.toast('Nada para exportar.', 'warning'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, nome);
  XLSX.writeFile(wb, nome + '-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  App.toast('Excel exportado.', 'success');
}
