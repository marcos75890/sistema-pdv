/* =====================================================================
   estoque.js — Controle de estoque (entradas, saídas, ajustes, histórico)
   ===================================================================== */
App.registerModule('estoque', {
  async render(view) {
    const tab = (location.hash.split('?tab=')[1] || 'posicao');
    const produtos = await Store.list('produtos');
    const custoTotal = produtos.reduce((s, p) => s + (p.custo * (p.estoqueAtual || 0)), 0);
    const vendaTotal = produtos.reduce((s, p) => s + (p.preco * (p.estoqueAtual || 0)), 0);
    const falta = produtos.filter((p) => p.estoqueMinimo > 0 && p.estoqueAtual <= 0).length;
    const baixo = produtos.filter((p) => p.estoqueMinimo > 0 && p.estoqueAtual > 0 && p.estoqueAtual <= p.estoqueMinimo).length;

    view.innerHTML = App.pageHead('Estoque', 'Posição, movimentações e ajustes',
      `<button class="btn btn-ghost btn-sm" id="btnSaida"><i class="bi bi-box-arrow-up me-1"></i>Saída</button>
       <button class="btn btn-primary btn-sm" id="btnEntrada"><i class="bi bi-box-arrow-in-down me-1"></i>Entrada</button>`) +
      `<div class="kpi-grid stagger" style="margin-bottom:18px">
        ${App.kpi({ label: 'Valor (custo)', icon: 'bi-cash-coin', ico: 'ic-blue', value: App.fmt.money(custoTotal) })}
        ${App.kpi({ label: 'Valor (venda)', icon: 'bi-cash-stack', ico: 'ic-green', value: App.fmt.money(vendaTotal) })}
        ${App.kpi({ label: 'Em falta', icon: 'bi-x-octagon', ico: falta ? 'ic-red' : 'ic-green', value: App.fmt.num(falta) })}
        ${App.kpi({ label: 'Estoque baixo', icon: 'bi-exclamation-triangle', ico: baixo ? 'ic-orange' : 'ic-green', value: App.fmt.num(baixo) })}
       </div>
       <div class="chips" style="margin-bottom:16px">
        <button class="chip ${tab === 'posicao' ? 'active' : ''}" data-tab="posicao">Posição de estoque</button>
        <button class="chip ${tab === 'mov' ? 'active' : ''}" data-tab="mov">Movimentações</button>
       </div>
       <div id="estBody"></div>`;
    view.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { location.hash = '#/estoque?tab=' + b.dataset.tab; });
    view.querySelector('#btnEntrada').onclick = () => this._mov('entrada');
    view.querySelector('#btnSaida').onclick = () => this._mov('saida');

    if (tab === 'mov') this._movimentacoes(document.getElementById('estBody'));
    else this._posicao(document.getElementById('estBody'), produtos);
  },

  _posicao(box, produtos) {
    const ordered = [...produtos].sort((a, b) => {
      const ba = a.estoqueMinimo > 0 && a.estoqueAtual <= a.estoqueMinimo ? 0 : 1;
      const bb = b.estoqueMinimo > 0 && b.estoqueAtual <= b.estoqueMinimo ? 0 : 1;
      return ba - bb || a.nome.localeCompare(b.nome);
    });
    box.innerHTML = `<div class="panel"><div class="panel-head"><h2>Posição atual</h2>
      <div class="global-search" style="max-width:240px"><i class="bi bi-search"></i><input id="eSearch" placeholder="Buscar produto…"></div></div>
      <div class="panel-body" style="padding:0"><div id="eTable"></div></div></div>`;
    const draw = (q) => {
      q = (q || '').toLowerCase();
      const list = ordered.filter((p) => p.nome.toLowerCase().includes(q));
      box.querySelector('#eTable').innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>
        <th>Produto</th><th class="num">Estoque</th><th class="num">Mínimo</th><th>Situação</th><th class="num">Valor (custo)</th><th></th>
      </tr></thead><tbody>${list.map((p) => {
        const falta = p.estoqueMinimo > 0 && p.estoqueAtual <= 0;
        const baixo = p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo;
        const sit = falta ? '<span class="badge-soft b-red">Em falta</span>' : baixo ? '<span class="badge-soft b-orange">Baixo</span>' : '<span class="badge-soft b-green">OK</span>';
        return `<tr><td><strong>${App.escape(p.nome)}</strong><br><small class="text-muted-2">${App.escape(p.categoria || '')}</small></td>
          <td class="num"><strong>${p.estoqueAtual}</strong> ${App.escape(p.unidade || 'un')}</td>
          <td class="num text-muted-2">${p.estoqueMinimo}</td><td>${sit}</td>
          <td class="num text-muted-2">${App.fmt.money(p.custo * p.estoqueAtual)}</td>
          <td class="num"><button class="btn btn-soft btn-sm" data-adj="${p.id}">Ajustar</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
      box.querySelectorAll('[data-adj]').forEach((b) => b.onclick = () => this._ajuste(b.dataset.adj));
    };
    box.querySelector('#eSearch').oninput = App.debounce((e) => draw(e.target.value), 150);
    draw('');
  },

  async _movimentacoes(box) {
    const movs = (await Store.list('movEstoque')).sort((a, b) => new Date(b.data) - new Date(a.data));
    box.innerHTML = `<div class="panel"><div class="panel-head"><h2>Histórico de movimentações</h2>
      <button class="btn btn-ghost btn-sm" id="mExp"><i class="bi bi-download me-1"></i>Excel</button></div>
      <div class="panel-body" style="padding:0">${movs.length ? `<div class="table-wrap"><table class="data"><thead><tr>
        <th>Data</th><th>Produto</th><th>Tipo</th><th class="num">Qtd</th><th>Motivo</th></tr></thead><tbody>
        ${movs.map((m) => `<tr><td class="text-muted-2">${App.fmt.datetime(m.data)}</td><td><strong>${App.escape(m.produtoNome || '')}</strong></td>
          <td>${m.tipo === 'entrada' ? '<span class="badge-soft b-green"><i class="bi bi-arrow-down"></i>Entrada</span>' : m.tipo === 'saida' ? '<span class="badge-soft b-red"><i class="bi bi-arrow-up"></i>Saída</span>' : '<span class="badge-soft b-blue">Ajuste</span>'}</td>
          <td class="num">${m.tipo === 'saida' ? '-' : '+'}${m.qtd}</td><td class="text-muted-2">${App.escape(m.motivo || '')}</td></tr>`).join('')}
      </tbody></table></div>` : App.empty('Nenhuma movimentação registrada.', 'arrow-left-right')}</div></div>`;
    if (movs.length) box.querySelector('#mExp').onclick = () => exportXLSX(movs.map((m) => ({
      Data: App.fmt.datetime(m.data), Produto: m.produtoNome, Tipo: m.tipo, Qtd: m.qtd, Motivo: m.motivo
    })), 'movimentacoes-estoque');
  },

  async _mov(tipo) {
    const produtos = await Store.list('produtos', (p) => p.ativo);
    const body = `<form id="movForm">
      <label class="form-label">Produto *</label>
      <select class="form-select mb-3" name="produtoId" required>
        <option value="">Selecione…</option>
        ${produtos.map((p) => `<option value="${p.id}">${App.escape(p.nome)} (atual: ${p.estoqueAtual})</option>`).join('')}
      </select>
      <div class="row g-3">
        <div class="col-6"><label class="form-label">Quantidade *</label><input type="number" min="1" class="form-control" name="qtd" value="1"></div>
        <div class="col-6"><label class="form-label">Data</label><input type="date" class="form-control" name="data" value="${App.todayISO()}"></div>
        <div class="col-12"><label class="form-label">Motivo</label>
          <input class="form-control" name="motivo" placeholder="${tipo === 'entrada' ? 'Compra de fornecedor, devolução…' : 'Perda, consumo, ajuste…'}"></div>
      </div></form>`;
    App.modal({
      title: tipo === 'entrada' ? '📥 Entrada de estoque' : '📤 Saída de estoque', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn ${tipo === 'entrada' ? 'btn-success' : 'btn-primary'}" id="btnOk">Confirmar</button>`,
      onShown: (c, m) => {
        c.querySelector('#btnOk').onclick = async () => {
          const f = c.querySelector('#movForm'); const pid = f.produtoId.value; const qtd = parseInt(f.qtd.value) || 0;
          if (!pid || qtd <= 0) { App.toast('Selecione produto e quantidade.', 'warning'); return; }
          const p = await Store.get('produtos', pid);
          const novo = tipo === 'entrada' ? p.estoqueAtual + qtd : Math.max(0, p.estoqueAtual - qtd);
          await Store.update('produtos', pid, { estoqueAtual: novo });
          await Store.create('movEstoque', { data: new Date(f.data.value || App.todayISO()).toISOString(), produtoId: pid, produtoNome: p.nome, tipo, qtd, motivo: f.motivo.value.trim() || (tipo === 'entrada' ? 'Entrada manual' : 'Saída manual') });
          m.hide(); App.toast('Movimentação registrada.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  },

  async _ajuste(id) {
    const p = await Store.get('produtos', id);
    const body = `<p>Estoque atual de <b>${App.escape(p.nome)}</b>: <b>${p.estoqueAtual} ${App.escape(p.unidade || 'un')}</b></p>
      <label class="form-label">Novo estoque (contagem física)</label>
      <input type="number" class="form-control" id="ajVal" value="${p.estoqueAtual}">
      <label class="form-label mt-2">Estoque mínimo</label>
      <input type="number" class="form-control" id="ajMin" value="${p.estoqueMinimo}">`;
    App.modal({
      title: 'Ajuste de inventário', body,
      footer: `<button class="btn btn-ghost" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="btnOk">Salvar ajuste</button>`,
      onShown: (c, m) => {
        c.querySelector('#btnOk').onclick = async () => {
          const novo = parseInt(c.querySelector('#ajVal').value) || 0; const min = parseInt(c.querySelector('#ajMin').value) || 0;
          const diff = novo - p.estoqueAtual;
          await Store.update('produtos', id, { estoqueAtual: novo, estoqueMinimo: min });
          if (diff !== 0) await Store.create('movEstoque', { data: new Date().toISOString(), produtoId: id, produtoNome: p.nome, tipo: 'ajuste', qtd: Math.abs(diff), motivo: `Ajuste de inventário (${diff > 0 ? '+' : '-'}${Math.abs(diff)})` });
          m.hide(); App.toast('Estoque ajustado.', 'success'); this.render(document.getElementById('view'));
        };
      }
    });
  }
});
