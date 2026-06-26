/* =====================================================================
   financeiro.js — Contas a pagar/receber, fluxo de caixa e resultado
   ===================================================================== */
App.registerModule('financeiro', {
  charts: [],
  _destroy() { this.charts.forEach((c) => { try { c.destroy(); } catch (e) {} }); this.charts = []; },

  async render(view) {
    this._destroy();
    const tab = (location.hash.split('?tab=')[1] || 'visao');
    const [cr, cp, mov] = await Promise.all([Store.list('contasReceber'), Store.list('contasPagar'), Store.list('movCaixa')]);
    const aReceber = cr.filter((c) => c.status === 'pendente' || c.status === 'parcial').reduce((s, c) => s + (c.valor - (c.valorRecebido || 0)), 0);
    const aPagar = cp.filter((c) => c.status !== 'pago' && c.status !== 'cancelado').reduce((s, c) => s + (c.valor - (c.valorPago || 0)), 0);
    const entradasMes = mov.filter((m) => m.tipo === 'entrada' && App.isSameMonth(m.data)).reduce((s, m) => s + m.valor, 0);
    const saidasMes = mov.filter((m) => m.tipo === 'saida' && App.isSameMonth(m.data)).reduce((s, m) => s + m.valor, 0);
    const saldo = mov.reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0);

    view.innerHTML = App.pageHead('Financeiro', 'Contas, caixa e resultado do negócio',
      `<button class="btn btn-ghost btn-sm" id="btnNovaCP"><i class="bi bi-dash-circle me-1"></i>Conta a pagar</button>
       <button class="btn btn-ghost btn-sm" id="btnNovoLanc"><i class="bi bi-plus-circle me-1"></i>Lançar no caixa</button>`) +
      `<div class="kpi-grid stagger" style="margin-bottom:18px">
        ${App.kpi({ label: 'Saldo em caixa', icon: 'bi-wallet2', ico: saldo >= 0 ? 'ic-green' : 'ic-red', value: App.fmt.money(saldo) })}
        ${App.kpi({ label: 'A receber', icon: 'bi-arrow-down-left-circle', ico: 'ic-blue', value: App.fmt.money(aReceber), foot: `${cr.filter((c) => c.status === 'pendente').length} título(s)` })}
        ${App.kpi({ label: 'A pagar', icon: 'bi-arrow-up-right-circle', ico: 'ic-orange', value: App.fmt.money(aPagar), foot: `${cp.filter((c) => c.status !== 'pago').length} conta(s)` })}
        ${App.kpi({ label: 'Resultado do mês', icon: 'bi-graph-up-arrow', ico: 'ic-purple', value: App.fmt.money(entradasMes - saidasMes), foot: `Entradas − Saídas` })}
       </div>
       <div class="chips" style="margin-bottom:16px">
        <button class="chip ${tab === 'visao' ? 'active' : ''}" data-tab="visao">Visão geral</button>
        <button class="chip ${tab === 'receber' ? 'active' : ''}" data-tab="receber">A receber</button>
        <button class="chip ${tab === 'pagar' ? 'active' : ''}" data-tab="pagar">A pagar</button>
        <button class="chip ${tab === 'caixa' ? 'active' : ''}" data-tab="caixa">Fluxo de caixa</button>
       </div>
       <div id="finBody"></div>`;
    view.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { location.hash = '#/financeiro?tab=' + b.dataset.tab; });
    view.querySelector('#btnNovaCP').onclick = () => this._formCP();
    view.querySelector('#btnNovoLanc').onclick = () => this._formLanc();

    const body = document.getElementById('finBody');
    if (tab === 'receber') this._receber(body, cr);
    else if (tab === 'pagar') this._pagar(body, cp);
    else if (tab === 'caixa') this._caixa(body, mov);
    else this._visao(body, mov, cr, cp);
  },

  /* ---------------- VISÃO GERAL ---------------- */
  _visao(box, mov, cr, cp) {
    box.innerHTML = `<div class="grid-2">
      <div class="panel"><div class="panel-head"><h2>Fluxo de caixa (30 dias)</h2></div>
        <div class="panel-body"><div class="chart-box"><canvas id="chFluxo"></canvas></div></div></div>
      <div class="panel"><div class="panel-head"><h2>Entradas x Saídas (mês)</h2></div>
        <div class="panel-body"><div class="chart-box"><canvas id="chES"></canvas></div></div></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="panel-head"><h2>Próximos a receber</h2><a data-tab2="receber" class="badge-soft b-gray cursor">Ver todos</a></div>
        <div class="panel-body" style="padding:0"><div id="vReceber"></div></div></div>
      <div class="panel"><div class="panel-head"><h2>Próximos a pagar</h2><a data-tab2="pagar" class="badge-soft b-gray cursor">Ver todos</a></div>
        <div class="panel-body" style="padding:0"><div id="vPagar"></div></div></div>
    </div>`;
    box.querySelectorAll('[data-tab2]').forEach((a) => a.onclick = () => location.hash = '#/financeiro?tab=' + a.dataset.tab2);

    const prox = (arr) => arr.filter((c) => c.status === 'pendente' || c.status === 'parcial').sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).slice(0, 6);
    const tbl = (arr, isReceber) => arr.length ? `<div class="table-wrap"><table class="data"><tbody>
      ${arr.map((c) => `<tr><td><strong>${App.escape(isReceber ? (c.clienteNome || c.descricao) : c.descricao)}</strong><br><small class="text-muted-2">vence ${App.fmt.date(c.vencimento)}</small></td>
        <td class="num"><strong>${App.fmt.money(c.valor - (c[isReceber ? 'valorRecebido' : 'valorPago'] || 0))}</strong></td></tr>`).join('')}
    </tbody></table></div>` : App.empty(isReceber ? 'Nada a receber.' : 'Nada a pagar.', 'check-circle');
    document.getElementById('vReceber').innerHTML = tbl(prox(cr), true);
    document.getElementById('vPagar').innerHTML = tbl(prox(cp), false);

    this._chartFluxo(mov); this._chartES(mov);
  },

  _chartFluxo(mov) {
    const cc = App.chartColors(); const days = [], labels = [], saldoMap = {};
    let run = mov.filter((m) => new Date(m.data) < new Date(Date.now() - 30 * 86400000)).reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0);
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); days.push(k); saldoMap[k] = 0; labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })); }
    mov.forEach((m) => { const k = new Date(m.data).toISOString().slice(0, 10); if (k in saldoMap) saldoMap[k] += (m.tipo === 'entrada' ? m.valor : -m.valor); });
    const data = days.map((k) => (run += saldoMap[k]));
    const ctx = document.getElementById('chFluxo');
    const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280); grad.addColorStop(0, 'rgba(22,163,74,.25)'); grad.addColorStop(1, 'rgba(22,163,74,0)');
    this.charts.push(new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Saldo', data, borderColor: cc.green, backgroundColor: grad, fill: true, tension: .4, borderWidth: 2.5, pointRadius: 0 }] }, options: chartOpts(cc, true) }));
  },
  _chartES(mov) {
    const cc = App.chartColors();
    const ent = mov.filter((m) => m.tipo === 'entrada' && App.isSameMonth(m.data)).reduce((s, m) => s + m.valor, 0);
    const sai = mov.filter((m) => m.tipo === 'saida' && App.isSameMonth(m.data)).reduce((s, m) => s + m.valor, 0);
    this.charts.push(new Chart(document.getElementById('chES'), {
      type: 'bar', data: { labels: ['Entradas', 'Saídas', 'Resultado'], datasets: [{ data: [ent, sai, ent - sai], backgroundColor: [cc.green, cc.red, cc.brand], borderRadius: 8, barThickness: 54 }] },
      options: chartOpts(cc, true)
    }));
  },

  /* ---------------- A RECEBER ---------------- */
  _receber(box, cr) {
    const draw = (filtro) => {
      let list = cr.filter((c) => c.status !== 'cancelado');
      if (filtro === 'pendente') list = list.filter((c) => c.status === 'pendente' || c.status === 'parcial');
      if (filtro === 'recebido') list = list.filter((c) => c.status === 'recebido');
      list.sort((a, b) => new Date(b.emissao) - new Date(a.emissao));
      box.querySelector('#crTable').innerHTML = list.length ? `<div class="table-wrap"><table class="data"><thead><tr>
        <th>Cliente / Descrição</th><th>Emissão</th><th>Categoria</th><th class="num">Valor</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map((c) => `<tr><td><strong>${App.escape(c.clienteNome || c.descricao)}</strong><br><small class="text-muted-2">${App.escape(c.descricao)}</small></td>
          <td class="text-muted-2">${App.fmt.date(c.emissao)}</td><td><span class="badge-soft b-gray">Fiado</span></td>
          <td class="num"><strong>${App.fmt.money(c.valor)}</strong></td>
          <td>${statusBadge(c.status)}</td>
          <td class="num">${c.status === 'recebido' ? '' : `<button class="btn btn-success btn-sm" data-rec="${c.id}">Receber</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : App.empty('Nenhum título.', 'inbox');
      box.querySelectorAll('[data-rec]').forEach((b) => b.onclick = () => this._receberTitulo(b.dataset.rec));
    };
    box.innerHTML = `<div class="panel"><div class="panel-head"><h2>Contas a receber</h2>
      <div class="chips"><button class="chip active" data-f="pendente">Em aberto</button><button class="chip" data-f="recebido">Recebidos</button><button class="chip" data-f="todos">Todos</button></div></div>
      <div class="panel-body" style="padding:0"><div id="crTable"></div></div></div>`;
    box.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { box.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('active', x === b)); draw(b.dataset.f); });
    draw('pendente');
  },

  async _receberTitulo(id) {
    const c = await Store.get('contasReceber', id); const rest = c.valor - (c.valorRecebido || 0);
    App.modal({
      title: 'Receber título', body: `<p>Cliente: <b>${App.escape(c.clienteNome || '')}</b></p>
        <div class="cart-total-row grand"><span>Em aberto</span><span>${App.fmt.money(rest)}</span></div>
        <label class="form-label">Valor recebido</label><input type="number" step="0.01" class="form-control" id="recVal" value="${rest.toFixed(2)}">
        <label class="form-label mt-2">Forma</label><select class="form-select" id="recForma"><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="credito">Cartão crédito</option><option value="debito">Cartão débito</option></select>`,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-success" id="btnOk">Confirmar recebimento</button>`,
      onShown: (cc, m) => {
        cc.querySelector('#btnOk').onclick = async () => {
          const val = parseFloat(cc.querySelector('#recVal').value) || 0; if (val <= 0) return;
          const novoReceb = (c.valorRecebido || 0) + val;
          const status = novoReceb >= c.valor - 0.001 ? 'recebido' : 'parcial';
          await Store.update('contasReceber', id, { valorRecebido: novoReceb, status, recebidoEm: new Date().toISOString() });
          await Store.create('movCaixa', { data: new Date().toISOString(), tipo: 'entrada', categoria: 'Recebimento fiado', descricao: 'Recebimento ' + (c.clienteNome || ''), valor: val, origem: 'receber', refId: id, formaPagamento: cc.querySelector('#recForma').value });
          if (c.vendaId) await Store.update('vendas', c.vendaId, { pago: status === 'recebido' });
          m.hide(); App.toast('Recebimento registrado.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  },

  /* ---------------- A PAGAR ---------------- */
  _pagar(box, cp) {
    const draw = (filtro) => {
      let list = cp.filter((c) => c.status !== 'cancelado');
      if (filtro === 'pendente') list = list.filter((c) => c.status !== 'pago');
      if (filtro === 'pago') list = list.filter((c) => c.status === 'pago');
      list.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
      box.querySelector('#cpTable').innerHTML = list.length ? `<div class="table-wrap"><table class="data"><thead><tr>
        <th>Descrição</th><th>Categoria</th><th>Vencimento</th><th class="num">Valor</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map((c) => { const venc = new Date(c.vencimento) < new Date() && c.status !== 'pago'; return `<tr><td><strong>${App.escape(c.descricao)}</strong>${c.parcela ? ` <small class="text-3">${c.parcela}</small>` : ''}</td>
          <td><span class="badge-soft b-gray">${App.escape(c.categoria || '—')}</span></td>
          <td class="${venc ? 'text-danger' : 'text-muted-2'}">${App.fmt.date(c.vencimento)} ${venc ? '<i class="bi bi-exclamation-circle"></i>' : ''}</td>
          <td class="num"><strong>${App.fmt.money(c.valor)}</strong></td><td>${statusBadge(c.status === 'pago' ? 'recebido' : (venc ? 'vencido' : 'pendente'))}</td>
          <td class="num">${c.status === 'pago' ? `<button class="btn-icon" data-delp="${c.id}" style="width:32px;height:32px"><i class="bi bi-trash text-danger"></i></button>` : `<button class="btn btn-primary btn-sm" data-pay="${c.id}">Pagar</button>`}</td></tr>`; }).join('')}
      </tbody></table></div>` : App.empty('Nenhuma conta a pagar. Cadastre suas despesas.', 'inbox');
      box.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => this._pagarConta(b.dataset.pay));
      box.querySelectorAll('[data-delp]').forEach((b) => b.onclick = async () => { await Store.remove('contasPagar', b.dataset.delp); this.render(document.getElementById('view')); });
    };
    box.innerHTML = `<div class="panel"><div class="panel-head"><h2>Contas a pagar</h2>
      <div class="d-flex gap-2"><div class="chips"><button class="chip active" data-f="pendente">Em aberto</button><button class="chip" data-f="pago">Pagas</button></div>
      <button class="btn btn-primary btn-sm" id="addCP"><i class="bi bi-plus-lg"></i></button></div></div>
      <div class="panel-body" style="padding:0"><div id="cpTable"></div></div></div>`;
    box.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { box.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('active', x === b)); draw(b.dataset.f); });
    box.querySelector('#addCP').onclick = () => this._formCP();
    draw('pendente');
  },

  async _pagarConta(id) {
    const c = await Store.get('contasPagar', id);
    const ok = await App.confirm({ title: 'Pagar conta', message: `Confirmar pagamento de <b>${App.escape(c.descricao)}</b> (${App.fmt.money(c.valor)})?`, confirm: 'Pagar' });
    if (!ok) return;
    await Store.update('contasPagar', id, { status: 'pago', valorPago: c.valor, pagoEm: new Date().toISOString() });
    await Store.create('movCaixa', { data: new Date().toISOString(), tipo: 'saida', categoria: c.categoria || 'Despesa', descricao: c.descricao, valor: c.valor, origem: 'pagar', refId: id });
    App.toast('Conta paga.', 'success'); this.render(document.getElementById('view'));
  },

  _formCP(id) {
    const cats = ['Fornecedores', 'Aluguel', 'Energia', 'Água', 'Internet/Telefone', 'Salários', 'Impostos', 'Embalagens', 'Marketing', 'Outros'];
    const body = `<form id="cpForm"><div class="row g-3">
      <div class="col-12"><label class="form-label">Descrição *</label><input class="form-control" name="descricao" required></div>
      <div class="col-md-6"><label class="form-label">Categoria</label><select class="form-select" name="categoria">${cats.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="col-md-6"><label class="form-label">Valor (R$) *</label><input type="number" step="0.01" class="form-control" name="valor" required></div>
      <div class="col-md-6"><label class="form-label">Vencimento</label><input type="date" class="form-control" name="vencimento" value="${App.todayISO()}"></div>
      <div class="col-md-6"><label class="form-label">Parcelas</label><select class="form-select" name="parcelas">${[1, 2, 3, 4, 5, 6, 10, 12].map((n) => `<option value="${n}">${n}x</option>`).join('')}</select></div>
    </div></form>`;
    App.modal({
      title: 'Nova conta a pagar', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="btnOk">Salvar</button>`,
      onShown: (c, m) => {
        c.querySelector('#btnOk').onclick = async () => {
          const f = c.querySelector('#cpForm'); const desc = f.descricao.value.trim(); const valor = parseFloat(f.valor.value) || 0;
          if (!desc || valor <= 0) { App.toast('Preencha descrição e valor.', 'warning'); return; }
          const parc = parseInt(f.parcelas.value) || 1; const vBase = new Date(f.vencimento.value || App.todayISO());
          for (let i = 0; i < parc; i++) {
            const venc = new Date(vBase); venc.setMonth(venc.getMonth() + i);
            await Store.create('contasPagar', { descricao: desc, categoria: f.categoria.value, valor: Math.round(valor / parc * 100) / 100, valorPago: 0, emissao: new Date().toISOString(), vencimento: venc.toISOString(), status: 'pendente', parcela: parc > 1 ? `${i + 1}/${parc}` : '' });
          }
          m.hide(); App.toast('Conta cadastrada.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  },

  /* ---------------- FLUXO DE CAIXA ---------------- */
  _caixa(box, mov) {
    box.innerHTML = `<div class="panel"><div class="panel-head"><h2>Movimentações de caixa</h2>
      <div class="d-flex gap-2 align-items-center">
        <select class="form-select form-select-sm" id="cxPeriodo" style="width:auto"><option value="30">Últimos 30 dias</option><option value="mes">Este mês</option><option value="0">Tudo</option></select>
        <button class="btn btn-ghost btn-sm" id="cxExp"><i class="bi bi-download me-1"></i>Excel</button></div></div>
      <div class="panel-body"><div id="cxResumo" class="mb-3"></div><div id="cxTable"></div></div></div>`;
    const draw = () => {
      const per = box.querySelector('#cxPeriodo').value;
      let list = [...mov].sort((a, b) => new Date(b.data) - new Date(a.data));
      if (per === '30') list = list.filter((m) => new Date(m.data) >= new Date(Date.now() - 30 * 86400000));
      else if (per === 'mes') list = list.filter((m) => App.isSameMonth(m.data));
      const ent = list.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0);
      const sai = list.filter((m) => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0);
      box.querySelector('#cxResumo').innerHTML = `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
        ${App.kpi({ label: 'Entradas', icon: 'bi-arrow-down', ico: 'ic-green', value: App.fmt.money(ent) })}
        ${App.kpi({ label: 'Saídas', icon: 'bi-arrow-up', ico: 'ic-red', value: App.fmt.money(sai) })}
        ${App.kpi({ label: 'Saldo do período', icon: 'bi-wallet2', ico: 'ic-blue', value: App.fmt.money(ent - sai) })}</div>`;
      box.querySelector('#cxTable').innerHTML = list.length ? `<div class="table-wrap"><table class="data"><thead><tr>
        <th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="num">Valor</th></tr></thead><tbody>
        ${list.map((m) => `<tr><td class="text-muted-2">${App.fmt.datetime(m.data)}</td><td><strong>${App.escape(m.descricao)}</strong></td>
          <td><span class="badge-soft b-gray">${App.escape(m.categoria || '')}</span></td><td class="text-muted-2">${App.escape(m.formaPagamento || '—')}</td>
          <td class="num"><strong class="${m.tipo === 'entrada' ? 'trend-up' : 'trend-down'}">${m.tipo === 'entrada' ? '+' : '−'} ${App.fmt.money(m.valor)}</strong></td></tr>`).join('')}
      </tbody></table></div>` : App.empty('Sem movimentações no período.', 'wallet2');
    };
    box.querySelector('#cxPeriodo').onchange = draw;
    box.querySelector('#cxExp').onclick = () => exportXLSX(mov.map((m) => ({ Data: App.fmt.datetime(m.data), Tipo: m.tipo, Descricao: m.descricao, Categoria: m.categoria, Forma: m.formaPagamento, Valor: m.tipo === 'entrada' ? m.valor : -m.valor })), 'fluxo-caixa');
    draw();
  },

  _formLanc() {
    const body = `<form id="lancForm"><div class="row g-3">
      <div class="col-12"><div class="pay-grid" style="grid-template-columns:1fr 1fr"><div class="pay-opt active" data-t="entrada"><i class="bi bi-arrow-down-circle"></i>Entrada</div><div class="pay-opt" data-t="saida"><i class="bi bi-arrow-up-circle"></i>Saída</div></div></div>
      <div class="col-12"><label class="form-label">Descrição *</label><input class="form-control" name="descricao" required></div>
      <div class="col-md-6"><label class="form-label">Categoria</label><input class="form-control" name="categoria" value="Outros"></div>
      <div class="col-md-6"><label class="form-label">Valor (R$) *</label><input type="number" step="0.01" class="form-control" name="valor" required></div>
    </div></form>`;
    App.modal({
      title: 'Lançar no caixa', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="btnOk">Lançar</button>`,
      onShown: (c, m) => {
        let tipo = 'entrada';
        c.querySelectorAll('.pay-opt').forEach((o) => o.onclick = () => { c.querySelectorAll('.pay-opt').forEach((x) => x.classList.remove('active')); o.classList.add('active'); tipo = o.dataset.t; });
        c.querySelector('#btnOk').onclick = async () => {
          const f = c.querySelector('#lancForm'); const desc = f.descricao.value.trim(); const valor = parseFloat(f.valor.value) || 0;
          if (!desc || valor <= 0) { App.toast('Preencha descrição e valor.', 'warning'); return; }
          await Store.create('movCaixa', { data: new Date().toISOString(), tipo, categoria: f.categoria.value.trim() || 'Outros', descricao: desc, valor, origem: 'manual', formaPagamento: 'dinheiro' });
          m.hide(); App.toast('Lançamento registrado.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  }
});

function statusBadge(s) {
  const map = { pendente: ['b-orange', 'Em aberto'], parcial: ['b-blue', 'Parcial'], recebido: ['b-green', 'Quitado'], vencido: ['b-red', 'Vencido'], cancelado: ['b-gray', 'Cancelado'] };
  const m = map[s] || map.pendente; return `<span class="badge-soft ${m[0]}">${m[1]}</span>`;
}
