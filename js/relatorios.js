/* =====================================================================
   relatorios.js — Central de relatórios + comparativos (PDF / Excel)
   ===================================================================== */
App.registerModule('relatorios', {
  charts: [],
  _destroy() { this.charts.forEach((c) => { try { c.destroy(); } catch (e) {} }); this.charts = []; },

  async render(view) {
    this._destroy();
    const [vendas, produtos, clientes, mov, cr] = await Promise.all([
      Store.list('vendas'), Store.list('produtos'), Store.list('clientes'), Store.list('movCaixa'), Store.list('contasReceber')
    ]);
    this._data = { vendas, produtos, clientes, mov, cr };
    const fat = vendas.filter((v) => v.status !== 'cancelada').reduce((s, v) => s + v.total, 0);
    const lucro = vendas.filter((v) => v.status !== 'cancelada').reduce((s, v) => s + v.lucro, 0);

    const cards = [
      ['Vendas', 'Todas as vendas do período', 'bi-receipt', 'ic-blue', 'vendas'],
      ['Produtos mais vendidos', 'Ranking por quantidade e valor', 'bi-trophy', 'ic-orange', 'topprod'],
      ['Clientes que mais compram', 'Ranking de faturamento por cliente', 'bi-people', 'ic-purple', 'topcli'],
      ['Catálogo de produtos', 'Lista completa com preços e estoque', 'bi-box-seam', 'ic-blue', 'produtos'],
      ['Clientes', 'Base completa de clientes', 'bi-person-lines-fill', 'ic-purple', 'clientes'],
      ['Estoque', 'Posição e valorização do estoque', 'bi-boxes', 'ic-green', 'estoque'],
      ['Fluxo de caixa', 'Entradas, saídas e saldo', 'bi-wallet2', 'ic-green', 'caixa'],
      ['Lucro e margem', 'Resultado por venda e margem', 'bi-graph-up-arrow', 'ic-purple', 'lucro'],
      ['Contas a receber (fiado)', 'Títulos em aberto por cliente', 'bi-cash-coin', 'ic-orange', 'receber'],
    ];

    view.innerHTML = App.pageHead('Relatórios', 'Gere relatórios e exporte em PDF ou Excel') +
      `<div class="kpi-grid stagger" style="margin-bottom:18px">
        ${App.kpi({ label: 'Faturamento total', icon: 'bi-cash-stack', ico: 'ic-green', value: App.fmt.money(fat) })}
        ${App.kpi({ label: 'Lucro total', icon: 'bi-piggy-bank', ico: 'ic-purple', value: App.fmt.money(lucro) })}
        ${App.kpi({ label: 'Margem média', icon: 'bi-percent', ico: 'ic-blue', value: App.fmt.pct(fat ? lucro / fat * 100 : 0) })}
        ${App.kpi({ label: 'Vendas realizadas', icon: 'bi-receipt', ico: 'ic-orange', value: App.fmt.num(vendas.filter((v) => v.status !== 'cancelada').length) })}
       </div>

       <div class="grid-2" style="margin-bottom:18px">
        <div class="panel"><div class="panel-head"><h2>Vendas por categoria</h2></div><div class="panel-body"><div class="chart-box sm"><canvas id="chCat"></canvas></div></div></div>
        <div class="panel"><div class="panel-head"><h2>Faturamento por dia (mês)</h2></div><div class="panel-body"><div class="chart-box sm"><canvas id="chDia"></canvas></div></div></div>
       </div>

       <h5 style="font-weight:700;margin:6px 0 14px">Relatórios disponíveis</h5>
       <div class="kpi-grid">
        ${cards.map((c) => `<div class="panel card-pad" style="display:flex;flex-direction:column;gap:10px">
          <div class="d-flex align-items-center gap-2"><span class="kpi-ico ${c[3]}"><i class="bi ${c[2]}"></i></span>
            <div><strong style="font-size:14.5px">${c[0]}</strong><br><small class="text-muted-2">${c[1]}</small></div></div>
          <div class="d-flex gap-2 mt-1">
            <button class="btn btn-ghost btn-sm flex-fill" data-pdf="${c[4]}"><i class="bi bi-file-earmark-pdf text-danger me-1"></i>PDF</button>
            <button class="btn btn-ghost btn-sm flex-fill" data-xls="${c[4]}"><i class="bi bi-file-earmark-excel text-success me-1"></i>Excel</button>
          </div></div>`).join('')}
       </div>`;

    view.querySelectorAll('[data-pdf]').forEach((b) => b.onclick = () => this._gerar(b.dataset.pdf, 'pdf'));
    view.querySelectorAll('[data-xls]').forEach((b) => b.onclick = () => this._gerar(b.dataset.xls, 'xls'));
    this._chartCat(vendas, produtos); this._chartDia(vendas);
  },

  _chartCat(vendas, produtos) {
    const cc = App.chartColors(); const agg = {};
    vendas.forEach((v) => (v.itens || []).forEach((it) => {
      const p = produtos.find((x) => x.id === it.produtoId); const cat = p ? p.categoria : 'Outros';
      agg[cat] = (agg[cat] || 0) + (it.subtotal || it.preco * it.qtd || 0);
    }));
    const keys = Object.keys(agg);
    this.charts.push(new Chart(document.getElementById('chCat'), {
      type: 'bar', data: { labels: keys, datasets: [{ data: keys.map((k) => agg[k]), backgroundColor: [cc.brand, cc.orange, cc.info, cc.green, cc.purple, cc.red], borderRadius: 8 }] },
      options: chartOpts(cc, true)
    }));
  },
  _chartDia(vendas) {
    const cc = App.chartColors(); const map = {}; const labels = []; const days = [];
    for (let i = 1; i <= new Date().getDate(); i++) { const k = i; map[k] = 0; days.push(k); labels.push(String(i)); }
    vendas.filter((v) => App.isSameMonth(v.data)).forEach((v) => { const d = new Date(v.data).getDate(); if (d in map) map[d] += v.total; });
    this.charts.push(new Chart(document.getElementById('chDia'), {
      type: 'bar', data: { labels, datasets: [{ data: days.map((k) => map[k]), backgroundColor: cc.brand, borderRadius: 5 }] }, options: chartOpts(cc, true)
    }));
  },

  /* ---- geração de relatórios ---- */
  _dataset(tipo) {
    const { vendas, produtos, clientes, mov, cr } = this._data;
    const ativas = vendas.filter((v) => v.status !== 'cancelada');
    if (tipo === 'vendas') return {
      titulo: 'Relatório de Vendas', cols: ['Nº', 'Data', 'Cliente', 'Pagamento', 'Total', 'Lucro'],
      rows: ativas.sort((a, b) => new Date(b.data) - new Date(a.data)).map((v) => [v.numero, App.fmt.datetime(v.data), v.clienteNome || '', (v.pagamentos || []).map((p) => p.tipo).join('+'), App.fmt.money(v.total), App.fmt.money(v.lucro)]),
      total: ['', '', '', 'TOTAL', App.fmt.money(ativas.reduce((s, v) => s + v.total, 0)), App.fmt.money(ativas.reduce((s, v) => s + v.lucro, 0))]
    };
    if (tipo === 'topprod') {
      const agg = {}; ativas.forEach((v) => (v.itens || []).forEach((it) => { const k = it.nome; if (!agg[k]) agg[k] = { nome: k, qtd: 0, valor: 0 }; agg[k].qtd += it.qtd; agg[k].valor += (it.subtotal || it.preco * it.qtd || 0); }));
      const list = Object.values(agg).sort((a, b) => b.qtd - a.qtd);
      return { titulo: 'Produtos Mais Vendidos', cols: ['#', 'Produto', 'Qtd vendida', 'Valor'], rows: list.map((p, i) => [i + 1, p.nome, p.qtd, App.fmt.money(p.valor)]), total: ['', '', list.reduce((s, p) => s + p.qtd, 0), App.fmt.money(list.reduce((s, p) => s + p.valor, 0))] };
    }
    if (tipo === 'topcli') { const list = [...clientes].filter((c) => c.totalComprado > 0).sort((a, b) => b.totalComprado - a.totalComprado);
      return { titulo: 'Clientes Que Mais Compram', cols: ['#', 'Cliente', 'Compras', 'Total'], rows: list.map((c, i) => [i + 1, c.nome, c.qtdCompras || 0, App.fmt.money(c.totalComprado)]), total: ['', '', list.reduce((s, c) => s + (c.qtdCompras || 0), 0), App.fmt.money(list.reduce((s, c) => s + c.totalComprado, 0))] }; }
    if (tipo === 'produtos') return { titulo: 'Catálogo de Produtos', cols: ['Código', 'Produto', 'Categoria', 'Custo', 'Preço', 'Estoque'], rows: produtos.map((p) => [p.codigo || '', p.nome, p.categoria || '', App.fmt.money(p.custo), App.fmt.money(p.preco), p.estoqueAtual]) };
    if (tipo === 'clientes') return { titulo: 'Base de Clientes', cols: ['Cliente', 'Telefone', 'Documento', 'Compras', 'Total'], rows: clientes.map((c) => [c.nome, c.telefone || '', c.doc || '', c.qtdCompras || 0, App.fmt.money(c.totalComprado || 0)]) };
    if (tipo === 'estoque') { const list = produtos; return { titulo: 'Relatório de Estoque', cols: ['Produto', 'Estoque', 'Mínimo', 'Custo unit.', 'Valor total'], rows: list.map((p) => [p.nome, p.estoqueAtual, p.estoqueMinimo, App.fmt.money(p.custo), App.fmt.money(p.custo * p.estoqueAtual)]), total: ['', '', '', 'TOTAL', App.fmt.money(list.reduce((s, p) => s + p.custo * p.estoqueAtual, 0))] }; }
    if (tipo === 'caixa') return { titulo: 'Fluxo de Caixa', cols: ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor'], rows: [...mov].sort((a, b) => new Date(b.data) - new Date(a.data)).map((m) => [App.fmt.date(m.data), m.tipo, m.descricao, m.categoria || '', (m.tipo === 'entrada' ? '+' : '-') + App.fmt.money(m.valor)]), total: ['', '', '', 'SALDO', App.fmt.money(mov.reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0))] };
    if (tipo === 'lucro') return { titulo: 'Lucro e Margem por Venda', cols: ['Nº', 'Data', 'Total', 'Lucro', 'Margem'], rows: ativas.map((v) => [v.numero, App.fmt.date(v.data), App.fmt.money(v.total), App.fmt.money(v.lucro), App.fmt.pct(v.total ? v.lucro / v.total * 100 : 0)]), total: ['', 'TOTAL', App.fmt.money(ativas.reduce((s, v) => s + v.total, 0)), App.fmt.money(ativas.reduce((s, v) => s + v.lucro, 0)), ''] };
    if (tipo === 'receber') { const list = cr.filter((c) => c.status === 'pendente' || c.status === 'parcial'); return { titulo: 'Contas a Receber (Fiado)', cols: ['Cliente', 'Descrição', 'Emissão', 'Valor'], rows: list.map((c) => [c.clienteNome || '', c.descricao, App.fmt.date(c.emissao), App.fmt.money(c.valor - (c.valorRecebido || 0))]), total: ['', '', 'TOTAL', App.fmt.money(list.reduce((s, c) => s + (c.valor - (c.valorRecebido || 0)), 0))] }; }
    return { titulo: 'Relatório', cols: [], rows: [] };
  },

  async _gerar(tipo, fmt) {
    const ds = this._dataset(tipo);
    if (!ds.rows.length) { App.toast('Sem dados para este relatório.', 'warning'); return; }
    if (fmt === 'xls') {
      const rows = ds.rows.map((r) => { const o = {}; ds.cols.forEach((c, i) => o[c] = r[i]); return o; });
      exportXLSX(rows, ds.titulo.toLowerCase().replace(/\s+/g, '-'));
      return;
    }
    // PDF
    const emp = await Store.getEmpresa();
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(37, 99, 235); doc.text(emp.nome || 'Gestão Comercial', 14, 18);
    doc.setFontSize(12); doc.setTextColor(40); doc.text(ds.titulo, 14, 26);
    doc.setFontSize(9); doc.setTextColor(120); doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), 14, 32);
    doc.autoTable({
      head: [ds.cols], body: ds.rows, foot: ds.total ? [ds.total] : undefined, startY: 38,
      styles: { fontSize: 8.5, cellPadding: 2.5 }, headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    doc.save(ds.titulo.toLowerCase().replace(/\s+/g, '-') + '.pdf');
    App.toast('PDF gerado.', 'success');
  }
});
