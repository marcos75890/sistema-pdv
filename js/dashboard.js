/* =====================================================================
   dashboard.js — Painel principal (KPIs + gráficos + rankings)
   ===================================================================== */
App.registerModule('dashboard', {
  charts: [],

  _destroyCharts() { this.charts.forEach((c) => { try { c.destroy(); } catch (e) {} }); this.charts = []; },

  async render(view) {
    this._destroyCharts();
    const [vendas, produtos, clientes, crNaoRecebidas, cpNaoPagas, mov] = await Promise.all([
      Store.list('vendas'),
      Store.list('produtos'),
      Store.list('clientes'),
      Store.list('contasReceber', (c) => c.status !== 'recebido'),
      Store.list('contasPagar', (c) => c.status !== 'pago'),
      Store.list('movCaixa'),
    ]);

    // ---- métricas ----
    const hoje = vendas.filter((v) => App.isSameDay(v.data));
    const mes = vendas.filter((v) => App.isSameMonth(v.data));
    const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
    const fatMes = sum(mes, (v) => v.total);
    const lucroMes = sum(mes, (v) => v.lucro);
    const fatHoje = sum(hoje, (v) => v.total);
    const ticket = mes.length ? fatMes / mes.length : 0;

    const totalReceber = sum(crNaoRecebidas, (c) => c.valor - (c.valorRecebido || 0));
    const totalPagar = sum(cpNaoPagas, (c) => c.valor - (c.valorPago || 0));
    const baixoEstoque = produtos.filter((p) => p.ativo && p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo);

    // ---- render shell ----
    view.innerHTML =
      App.pageHead('Dashboard', 'Visão geral do seu negócio · ' + new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
        `<button class="btn btn-soft btn-sm" data-route="relatorios"><i class="bi bi-graph-up-arrow me-1"></i>Relatórios</button>
         <button class="btn btn-primary btn-sm" data-route="vendas"><i class="bi bi-plus-lg me-1"></i>Nova venda</button>`) +
      `<div class="kpi-grid stagger" style="margin-bottom:16px">
        ${App.kpi({ label: 'Vendas do dia', icon: 'bi-calendar-day', ico: 'ic-blue', value: App.fmt.money(fatHoje), foot: `<i class="bi bi-receipt"></i> ${hoje.length} pedido(s) hoje` })}
        ${App.kpi({ label: 'Faturamento do mês', icon: 'bi-cash-stack', ico: 'ic-green', value: App.fmt.money(fatMes), foot: `<span class="trend-up"><i class="bi bi-graph-up-arrow"></i> ${mes.length} vendas</span>` })}
        ${App.kpi({ label: 'Lucro do mês', icon: 'bi-piggy-bank', ico: 'ic-purple', value: App.fmt.money(lucroMes), foot: `Margem ${App.fmt.pct(fatMes ? lucroMes / fatMes * 100 : 0)}` })}
        ${App.kpi({ label: 'Ticket médio', icon: 'bi-tag', ico: 'ic-info', value: App.fmt.money(ticket), foot: `Por venda no mês` })}
       </div>
       <div class="kpi-grid stagger" style="margin-bottom:22px">
        ${App.kpi({ label: 'A receber (fiado)', icon: 'bi-arrow-down-left-circle', ico: 'ic-orange', value: App.fmt.money(totalReceber), foot: `<a data-route="financeiro">${crNaoRecebidas.length} título(s) em aberto</a>` })}
        ${App.kpi({ label: 'A pagar', icon: 'bi-arrow-up-right-circle', ico: 'ic-red', value: App.fmt.money(totalPagar), foot: `<a data-route="financeiro">${cpNaoPagas.length} conta(s)</a>` })}
        ${App.kpi({ label: 'Produtos cadastrados', icon: 'bi-box-seam', ico: 'ic-blue', value: App.fmt.num(produtos.length), foot: `${produtos.filter((p) => p.ativo).length} ativos` })}
        ${App.kpi({ label: 'Estoque baixo', icon: 'bi-exclamation-triangle', ico: baixoEstoque.length ? 'ic-red' : 'ic-green', value: App.fmt.num(baixoEstoque.length), foot: baixoEstoque.length ? `<a data-route="estoque" class="trend-down">Repor itens</a>` : 'Tudo em ordem' })}
       </div>

       <div class="grid-2-1" style="margin-bottom:16px">
        <div class="panel">
          <div class="panel-head"><h2>Vendas no período</h2>
            <span class="badge-soft b-blue"><i class="bi bi-calendar3"></i> Últimos 30 dias</span></div>
          <div class="panel-body"><div class="chart-box"><canvas id="chVendas"></canvas></div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Formas de pagamento</h2></div>
          <div class="panel-body"><div class="chart-box"><canvas id="chPagto"></canvas></div></div>
        </div>
       </div>

       <div class="grid-2-1" style="margin-bottom:16px">
        <div class="panel">
          <div class="panel-head"><h2>Últimas vendas</h2><a data-route="vendas" class="badge-soft b-gray">Ver todas <i class="bi bi-arrow-right"></i></a></div>
          <div class="panel-body" style="padding-top:6px"><div id="ultimasVendas"></div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Produtos mais vendidos</h2></div>
          <div class="panel-body"><div id="topProdutos"></div></div>
        </div>
       </div>

       <div class="grid-2" style="margin-bottom:16px">
        <div class="panel">
          <div class="panel-head"><h2>Clientes que mais compram</h2><a data-route="clientes" class="badge-soft b-gray">Ver todos <i class="bi bi-arrow-right"></i></a></div>
          <div class="panel-body"><div id="topClientes"></div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Alertas de estoque</h2><a data-route="estoque" class="badge-soft b-gray">Estoque <i class="bi bi-arrow-right"></i></a></div>
          <div class="panel-body"><div id="alertasEstoque"></div></div>
        </div>
       </div>`;

    // ---- últimas vendas ----
    const ultimas = [...vendas].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);
    document.getElementById('ultimasVendas').innerHTML = ultimas.length ? `
      <div class="table-wrap"><table class="data"><thead><tr>
        <th>Venda</th><th>Cliente</th><th>Pagamento</th><th class="num">Total</th><th class="num">Quando</th></tr></thead><tbody>
        ${ultimas.map((v) => `<tr class="row-click" data-route="vendas">
          <td><strong>#${App.escape(v.numero)}</strong></td>
          <td>${App.escape(v.clienteNome || '—')}</td>
          <td>${pagamentoBadge(v)}</td>
          <td class="num"><strong>${App.fmt.money(v.total)}</strong></td>
          <td class="num text-muted-2">${App.fmt.rel(v.data)}</td></tr>`).join('')}
      </tbody></table></div>` : App.empty('Nenhuma venda registrada ainda.', 'receipt');

    // ---- top produtos (agregado das vendas) ----
    const agg = {};
    vendas.forEach((v) => (v.itens || []).forEach((it) => {
      const k = it.nome; if (!agg[k]) agg[k] = { nome: it.nome, qtd: 0, valor: 0 };
      agg[k].qtd += it.qtd; agg[k].valor += (it.subtotal || it.preco * it.qtd || 0);
    }));
    const topP = Object.values(agg).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
    const maxQ = topP[0] ? topP[0].qtd : 1;
    document.getElementById('topProdutos').innerHTML = topP.length ? topP.map((p, i) => `
      <div class="rank-item">
        <span class="rank-pos ${['gold', 'silver', 'bronze'][i] || ''}">${i + 1}</span>
        <div class="rank-meta"><strong>${App.escape(p.nome)}</strong>
          <div class="progress-thin" style="margin-top:6px"><span style="width:${p.qtd / maxQ * 100}%;background:var(--brand)"></span></div></div>
        <div class="rank-val">${p.qtd} un<br><small class="text-muted-2" style="font-weight:500">${App.fmt.money(p.valor)}</small></div>
      </div>`).join('') : App.empty('Sem dados de vendas.', 'box');

    // ---- top clientes ----
    const topC = [...clientes].filter((c) => c.totalComprado > 0).sort((a, b) => b.totalComprado - a.totalComprado).slice(0, 6);
    const maxC = topC[0] ? topC[0].totalComprado : 1;
    document.getElementById('topClientes').innerHTML = topC.length ? topC.map((c, i) => `
      <div class="rank-item">
        <span class="rank-pos ${['gold', 'silver', 'bronze'][i] || ''}">${i + 1}</span>
        <div class="rank-meta"><strong>${App.escape(c.nome)}</strong>
          <div class="progress-thin" style="margin-top:6px"><span style="width:${c.totalComprado / maxC * 100}%;background:var(--purple)"></span></div></div>
        <div class="rank-val">${App.fmt.money(c.totalComprado)}<br><small class="text-muted-2" style="font-weight:500">${c.qtdCompras} compra(s)</small></div>
      </div>`).join('') : App.empty('Sem clientes com compras.', 'people');

    // ---- alertas estoque ----
    document.getElementById('alertasEstoque').innerHTML = baixoEstoque.length ? `
      <div class="table-wrap"><table class="data"><thead><tr><th>Produto</th><th class="num">Atual</th><th class="num">Mínimo</th><th></th></tr></thead><tbody>
      ${baixoEstoque.slice(0, 7).map((p) => `<tr><td><strong>${App.escape(p.nome)}</strong><br><small class="text-muted-2">${p.categoria || ''}</small></td>
        <td class="num"><span class="badge-soft ${p.estoqueAtual === 0 ? 'b-red' : 'b-orange'}">${p.estoqueAtual}</span></td>
        <td class="num text-muted-2">${p.estoqueMinimo}</td>
        <td class="num"><button class="btn btn-soft btn-sm" data-route="estoque">Repor</button></td></tr>`).join('')}
      </tbody></table></div>` : App.empty('Nenhum produto com estoque baixo. 👍', 'check-circle');

    // ---- gráficos ----
    this._chartVendas(vendas);
    this._chartPagto(vendas);

    // navegação dentro de tabelas
    view.querySelectorAll('.row-click').forEach((r) => r.style.cursor = 'pointer');
  },

  _chartVendas(vendas) {
    const cc = App.chartColors();
    const days = []; const labels = []; const map = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = 0; days.push(key);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }
    vendas.forEach((v) => { const k = new Date(v.data).toISOString().slice(0, 10); if (k in map) map[k] += v.total; });
    const data = days.map((k) => map[k]);
    const ctx = document.getElementById('chVendas');
    const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, 'rgba(37,99,235,.28)'); grad.addColorStop(1, 'rgba(37,99,235,0)');
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Vendas', data, borderColor: cc.brand, backgroundColor: grad, fill: true, tension: .4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: cc.brand }] },
      options: chartOpts(cc, true)
    }));
  },

  _chartPagto(vendas) {
    const cc = App.chartColors();
    const labels = { fiado: 'Fiado', dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito', outro: 'Outro' };
    const colors = { fiado: cc.orange, dinheiro: cc.green, pix: cc.info, credito: cc.brand, debito: cc.purple, outro: '#94a3b8' };
    const agg = {};
    vendas.forEach((v) => (v.pagamentos || []).forEach((p) => { agg[p.tipo] = (agg[p.tipo] || 0) + (p.valor || 0); }));
    const keys = Object.keys(agg);
    const ctx = document.getElementById('chPagto');
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: { labels: keys.map((k) => labels[k] || k), datasets: [{ data: keys.map((k) => agg[k]), backgroundColor: keys.map((k) => colors[k] || '#94a3b8'), borderWidth: 0, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '66%',
        plugins: { legend: { position: 'bottom', labels: { color: cc.text, usePointStyle: true, padding: 14, font: { size: 12 } } },
          tooltip: { callbacks: { label: (c) => ' ' + c.label + ': ' + App.fmt.money(c.parsed) } } }
      }
    }));
  }
});

/* helpers compartilhados do dashboard */
function chartOpts(cc, money) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + (money ? App.fmt.money(c.parsed.y != null ? c.parsed.y : c.parsed) : c.parsed) } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: cc.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } } },
      y: { grid: { color: cc.grid }, ticks: { color: cc.text, font: { size: 11 }, callback: (v) => money ? 'R$' + (v >= 1000 ? (v / 1000) + 'k' : v) : v } }
    }
  };
}
function pagamentoBadge(v) {
  const p = (v.pagamentos && v.pagamentos[0]) ? v.pagamentos[0].tipo : 'outro';
  const map = { fiado: ['b-orange', 'Fiado'], dinheiro: ['b-green', 'Dinheiro'], pix: ['b-info', 'PIX'], credito: ['b-blue', 'Crédito'], debito: ['b-purple', 'Débito'], outro: ['b-gray', 'Outro'] };
  const m = map[p] || map.outro;
  return `<span class="badge-soft ${m[0]}">${m[1]}</span>`;
}
