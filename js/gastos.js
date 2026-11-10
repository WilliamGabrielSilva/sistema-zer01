/* =========================================================
   GASTOS E INVESTIMENTOS — ZER01 (fase 1)
   - Despesas da loja (com categoria, "a pagar" e recorrentes).
   - Compras de peças (lotes): item, quantidade, custo e venda.
   - Resultado do período e lucro projetado por lote/item.
   Página exclusiva do administrador (app.js + RLS no banco).
   Depende de: app.js. Tabelas: supabase/migration_gastos.sql
   ========================================================= */
(function () {
  const $ = id => document.getElementById(id);

  const CATEGORIAS = {
    aluguel: 'Aluguel',
    energia: 'Energia elétrica',
    agua: 'Água',
    internet: 'Internet / telefone',
    salarios: 'Salários / comissões',
    embalagens: 'Embalagens',
    marketing: 'Marketing',
    impostos: 'Impostos / taxas',
    manutencao: 'Manutenção',
    transporte: 'Transporte / frete',
    outros: 'Outros'
  };

  const FORMAS = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao: 'Cartão',
    transferencia: 'Transferência',
    boleto: 'Boleto',
    outros: 'Outros'
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Datas locais (todayISO() do app.js usa UTC e vira o dia à noite no Brasil).
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayLocal = () => localISO(new Date());
  const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
  const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const pct = v => v == null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`;
  const catLabel = key => CATEGORIAS[key] || key || 'Outros';
  const sum = (list, pick) => round2(list.reduce((s, x) => s + Number(pick(x) || 0), 0));
  const signClass = v => v > 0.004 ? 'pos' : (v < -0.004 ? 'neg' : '');

  const state = { despesas: [], pendentes: [], lotes: [], vendas: [], pagamentos: [] };
  let loadSeq = 0;

  /* -------------------------------------------------------
     PERÍODO
     ------------------------------------------------------- */

  function setPeriod(start, end) { $('g-start').value = start; $('g-end').value = end; }

  function applyPreset(kind) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (kind === 'month') setPeriod(localISO(new Date(y, m, 1)), localISO(new Date(y, m + 1, 0)));
    if (kind === 'prev') setPeriod(localISO(new Date(y, m - 1, 1)), localISO(new Date(y, m, 0)));
    if (kind === 'year') setPeriod(`${y}-01-01`, `${y}-12-31`);
  }

  function period() { return { start: $('g-start').value, end: $('g-end').value }; }

  /* -------------------------------------------------------
     DADOS
     ------------------------------------------------------- */

  async function fetchAll(build) {
    const size = 1000;
    const rows = [];
    for (let from = 0; ; from += size) {
      const page = await supabaseQuery(c => build(c).range(from, from + size - 1));
      rows.push(...(page || []));
      if (!page || page.length < size) break;
    }
    return rows;
  }

  async function load() {
    const { start, end } = period();
    if (!start || !end || start > end) {
      toast('Informe um período válido (a data inicial não pode ser maior que a final).', 'error');
      return;
    }

    const seq = ++loadSeq;
    try {
      const [despesas, pendentes, lotes, vendas, pagamentos] = await Promise.all([
        fetchAll(c => c.from('despesas').select('*')
          .or(`and(data.gte.${start},data.lte.${end}),and(data_pagamento.gte.${start},data_pagamento.lte.${end})`)
          .order('id')),
        fetchAll(c => c.from('despesas').select('id,valor,vencimento,data').eq('status', 'a_pagar').order('id')),
        fetchAll(c => c.from('compras_lotes').select('*,compras_itens(*)')
          .gte('data_compra', start).lte('data_compra', end).order('id')),
        fetchAll(c => c.from('vendas').select('id,valor_total,data_venda')
          .neq('status', 'cancelada').gte('data_venda', start).lte('data_venda', end).order('id')),
        fetchAll(c => c.from('pagamentos').select('id,valor,data_pagamento,parcelas!inner(vendas!inner(status))')
          .eq('status', 'confirmado').neq('parcelas.vendas.status', 'cancelada')
          .gte('data_pagamento', start).lte('data_pagamento', end).order('id'))
      ]);

      if (seq !== loadSeq) return; // chegou uma consulta mais nova
      Object.assign(state, { despesas, pendentes, lotes, vendas, pagamentos });
      renderAll();
    } catch (error) {
      console.error('[Gastos] Falha ao carregar:', error);
      toast('Não foi possível carregar os dados. Confira a migração SQL de gastos e o acesso de administrador.', 'error');
    }
  }

  /* -------------------------------------------------------
     CÁLCULOS
     ------------------------------------------------------- */

  function lotTotals(lot) {
    let qtd = 0; let custo = 0; let venda = 0;
    (lot.compras_itens || []).forEach(i => {
      qtd += Number(i.quantidade || 0);
      custo += Number(i.quantidade || 0) * Number(i.custo_unitario || 0);
      venda += Number(i.quantidade || 0) * Number(i.venda_unitario || 0);
    });
    custo = round2(custo);
    venda = round2(venda);
    return { qtd, custo, venda, lucro: round2(venda - custo), margem: venda > 0 ? (venda - custo) / venda : null };
  }

  const inPeriod = date => { const { start, end } = period(); return !!date && date >= start && date <= end; };
  const expensesByCompetence = () => state.despesas.filter(d => inPeriod(d.data));
  const expensesByCash = () => state.despesas.filter(d => d.status === 'pago' && inPeriod(d.data_pagamento || d.data));

  /* -------------------------------------------------------
     RENDER: RESUMO
     ------------------------------------------------------- */

  function renderResumo() {
    const cash = $('g-basis').value === 'caixa';

    const revenue = cash
      ? sum(state.pagamentos, p => p.valor)
      : sum(state.vendas, v => v.valor_total);
    const expenseList = cash ? expensesByCash() : expensesByCompetence();
    const expenses = sum(expenseList, d => d.valor);
    const lotTotalsList = state.lotes.map(lotTotals);
    const purchases = sum(lotTotalsList, t => t.custo);
    const result = round2(revenue - expenses - purchases);

    $('g-rev-label').textContent = cash ? 'Recebido no período' : 'Vendido no período';
    $('g-rev').textContent = fmtMoney(revenue);
    $('g-exp').textContent = fmtMoney(expenses);
    $('g-exp-sub').textContent = cash ? 'somente despesas já pagas' : 'todas as despesas do período';
    $('g-buy').textContent = fmtMoney(purchases);
    $('g-result').textContent = fmtMoney(result);
    $('g-result').className = signClass(result);

    // Lucro projetado dos lotes
    const projCost = sum(lotTotalsList, t => t.custo);
    const projSale = sum(lotTotalsList, t => t.venda);
    const projProfit = round2(projSale - projCost);
    $('g-proj').textContent = fmtMoney(projProfit);
    $('g-proj').className = signClass(projProfit);
    $('g-proj-sub').textContent = `${state.lotes.length} compra(s) · custo ${fmtMoney(projCost)} · venda prevista ${fmtMoney(projSale)}`;
    $('g-margin').textContent = pct(projSale > 0 ? projProfit / projSale : null);

    // Despesas a pagar (todas, não só do período)
    const today = todayLocal();
    const pending = sum(state.pendentes, d => d.valor);
    const overdue = state.pendentes.filter(d => (d.vencimento || d.data) < today);
    $('g-pending').textContent = fmtMoney(pending);
    $('g-pending-sub').textContent = state.pendentes.length
      ? `${state.pendentes.length} em aberto${overdue.length ? ` · ${overdue.length} vencida(s): ${fmtMoney(sum(overdue, d => d.valor))}` : ''}`
      : 'nada a pagar';

    // Despesas por categoria
    const byCat = {};
    expenseList.forEach(d => { byCat[d.categoria] = round2((byCat[d.categoria] || 0) + Number(d.valor)); });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 0;
    $('g-cats').innerHTML = cats.length
      ? cats.map(([key, value]) => `<div class="gastos-bar-row"><span>${esc(catLabel(key))}</span><div class="gastos-bar-track"><span style="width:${max ? (value / max * 100).toFixed(1) : 0}%"></span></div><b>${esc(fmtMoney(value))} · ${pct(expenses ? value / expenses : null)}</b></div>`).join('')
      : '<div class="empty">Nenhuma despesa neste período.</div>';

    // Lucro por lote
    const lots = [...state.lotes].sort((a, b) => String(b.data_compra).localeCompare(String(a.data_compra)));
    $('g-lots-table').innerHTML = lots.length
      ? lots.map(l => {
        const t = lotTotals(l);
        return `<tr><td>${esc(dateBR(l.data_compra))}</td><td>${esc(display(l.fornecedor))}</td><td>${t.qtd}</td><td>${esc(fmtMoney(t.custo))}</td><td>${esc(fmtMoney(t.venda))}</td><td class="${t.lucro < 0 ? 'text-neg' : 'text-pos'}">${esc(fmtMoney(t.lucro))}</td><td>${pct(t.margem)}</td></tr>`;
      }).join('')
      : '<tr><td colspan="7" class="empty">Nenhuma compra de peças neste período.</td></tr>';

    // Itens com maior lucro previsto (agrupa pelo nome do item)
    const items = new Map();
    state.lotes.forEach(l => (l.compras_itens || []).forEach(i => {
      const key = String(i.descricao || '').trim().toLowerCase();
      const row = items.get(key) || { nome: String(i.descricao || '').trim(), qtd: 0, custo: 0, venda: 0 };
      row.qtd += Number(i.quantidade || 0);
      row.custo += Number(i.quantidade || 0) * Number(i.custo_unitario || 0);
      row.venda += Number(i.quantidade || 0) * Number(i.venda_unitario || 0);
      items.set(key, row);
    }));
    const topItems = [...items.values()]
      .map(r => ({ ...r, custo: round2(r.custo), venda: round2(r.venda), lucro: round2(r.venda - r.custo) }))
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 10);
    $('g-items-table').innerHTML = topItems.length
      ? topItems.map(r => `<tr><td>${esc(r.nome)}</td><td>${r.qtd}</td><td>${esc(fmtMoney(r.custo))}</td><td>${esc(fmtMoney(r.venda))}</td><td class="${r.lucro < 0 ? 'text-neg' : 'text-pos'}">${esc(fmtMoney(r.lucro))}</td><td>${pct(r.venda > 0 ? r.lucro / r.venda : null)}</td></tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nenhum item neste período.</td></tr>';
  }

  /* -------------------------------------------------------
     RENDER: DESPESAS
     ------------------------------------------------------- */

  function renderDespesas() {
    const cat = $('d-category').value;
    const status = $('d-status').value;
    const today = todayLocal();

    const rows = expensesByCompetence()
      .filter(d => (!cat || d.categoria === cat) && (!status || d.status === status))
      .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_em).localeCompare(String(a.criado_em)));

    $('d-table').innerHTML = rows.length
      ? rows.map(d => {
        let situacao;
        if (d.status === 'pago') {
          situacao = `<span class="status status-paga">Paga${d.data_pagamento ? ' · ' + esc(dateBR(d.data_pagamento)) : ''}</span>`;
        } else {
          const late = (d.vencimento || d.data) < today;
          situacao = `<span class="status ${late ? 'status-atrasada' : 'status-apagar'}">${late ? 'Vencida' : 'A pagar'}${d.vencimento ? ' · ' + esc(dateBR(d.vencimento)) : ''}</span>`;
        }
        const extra = [FORMAS[d.forma_pagamento], d.recorrente ? 'recorrente' : null, d.observacoes].filter(Boolean).map(esc).join(' · ');
        return `<tr>
          <td>${esc(dateBR(d.data))}</td>
          <td class="td-desc">${esc(d.descricao)}${extra ? `<small>${extra}</small>` : ''}</td>
          <td>${esc(catLabel(d.categoria))}</td>
          <td>${esc(fmtMoney(d.valor))}</td>
          <td>${situacao}</td>
          <td><div class="gastos-actions">
            ${d.status === 'a_pagar' ? `<button type="button" class="btn btn-ghost" data-act="pay" data-id="${esc(d.id)}">Marcar paga</button>` : ''}
            <button type="button" class="btn btn-ghost" data-act="edit" data-id="${esc(d.id)}">Editar</button>
            <button type="button" class="btn btn-danger" data-act="del" data-id="${esc(d.id)}">Excluir</button>
          </div></td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="6" class="empty">Nenhuma despesa encontrada neste período.</td></tr>';

    $('d-total').innerHTML = rows.length ? `${rows.length} despesa(s) · total <strong>${esc(fmtMoney(sum(rows, d => d.valor)))}</strong>` : '';
  }

  /* -------------------------------------------------------
     RENDER: INVESTIMENTOS (LOTES)
     ------------------------------------------------------- */

  function renderLotes() {
    const lots = [...state.lotes].sort((a, b) => String(b.data_compra).localeCompare(String(a.data_compra)));
    $('l-list').innerHTML = lots.length
      ? lots.map(l => {
        const t = lotTotals(l);
        const itens = [...(l.compras_itens || [])];
        const extra = [FORMAS[l.forma_pagamento], l.observacoes].filter(Boolean).map(esc).join(' · ');
        return `<section class="panel lot-card">
          <div class="lot-head">
            <div><h3>${esc(display(l.fornecedor))}</h3><small>${esc(dateBR(l.data_compra))}${extra ? ' · ' + extra : ''}</small></div>
            <div class="gastos-actions">
              <button type="button" class="btn btn-ghost" data-act="lot-edit" data-id="${esc(l.id)}">Editar</button>
              <button type="button" class="btn btn-danger" data-act="lot-del" data-id="${esc(l.id)}">Excluir</button>
            </div>
          </div>
          <div class="lot-kpis">
            <div><small>Custo total</small><strong>${esc(fmtMoney(t.custo))}</strong></div>
            <div><small>Venda prevista</small><strong>${esc(fmtMoney(t.venda))}</strong></div>
            <div><small>Lucro previsto</small><strong class="${t.lucro < 0 ? 'text-neg' : 'text-pos'}">${esc(fmtMoney(t.lucro))}</strong></div>
            <div><small>Margem</small><strong>${pct(t.margem)}</strong></div>
          </div>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Qtd</th><th>Custo unit.</th><th>Venda unit.</th><th>Lucro unit.</th><th>Lucro total</th></tr></thead><tbody>
            ${itens.map(i => {
              const unit = round2(Number(i.venda_unitario) - Number(i.custo_unitario));
              const total = round2(unit * Number(i.quantidade));
              return `<tr><td class="td-desc">${esc(i.descricao)}</td><td>${Number(i.quantidade)}</td><td>${esc(fmtMoney(i.custo_unitario))}</td><td>${esc(fmtMoney(i.venda_unitario))}</td><td class="${unit < 0 ? 'text-neg' : ''}">${esc(fmtMoney(unit))}</td><td class="${total < 0 ? 'text-neg' : 'text-pos'}">${esc(fmtMoney(total))}</td></tr>`;
            }).join('')}
          </tbody></table></div>
        </section>`;
      }).join('')
      : '<section class="panel"><div class="empty">Nenhuma compra de peças neste período. Use “Nova compra de peças” para cadastrar.</div></section>';
  }

  function renderAll() { renderResumo(); renderDespesas(); renderLotes(); }

  /* -------------------------------------------------------
     MODAL (genérico)
     ------------------------------------------------------- */

  function openModal(html, wide) {
    $('g-modal').innerHTML = `<div class="modal"><div class="modal-card g-modal-card${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  }
  function closeModal() { $('g-modal').innerHTML = ''; }
  function showError(message) { const box = $('g-error'); if (box) { box.textContent = message; box.hidden = !message; } }

  /* -------------------------------------------------------
     DESPESAS: criar / editar / pagar / excluir
     ------------------------------------------------------- */

  function openExpenseForm(expense) {
    const e = expense || {};
    const isNew = !e.id;
    const status = e.status || 'pago';
    openModal(`
      <div class="modal-head"><div><span class="eyebrow">DESPESA DA LOJA</span><h3>${isNew ? 'Nova despesa' : 'Editar despesa'}</h3></div><button type="button" class="icon-btn" id="g-close" aria-label="Fechar">×</button></div>
      <div class="form-grid">
        <div class="field full"><label for="x-desc">Descrição *</label><input id="x-desc" type="text" maxlength="160" value="${esc(e.descricao || '')}" placeholder="Ex.: Aluguel da loja, conta de luz, sacolas..."></div>
        <div class="field"><label for="x-cat">Categoria *</label><select id="x-cat">${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}" ${(e.categoria || 'outros') === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field"><label for="x-val">Valor (R$) *</label><input id="x-val" type="number" inputmode="decimal" step="0.01" min="0.01" value="${e.valor != null ? Number(e.valor).toFixed(2) : ''}"></div>
        <div class="field"><label for="x-date">Data da despesa *</label><input id="x-date" type="date" value="${esc(e.data || todayLocal())}"></div>
        <div class="field"><label for="x-status">Situação *</label><select id="x-status"><option value="pago" ${status === 'pago' ? 'selected' : ''}>Já paga</option><option value="a_pagar" ${status === 'a_pagar' ? 'selected' : ''}>A pagar</option></select></div>
        <div class="field" id="x-due-field" ${status === 'a_pagar' ? '' : 'hidden'}><label for="x-due">Vencimento</label><input id="x-due" type="date" value="${esc(e.vencimento || '')}"></div>
        <div class="field"><label for="x-method">Forma de pagamento</label><select id="x-method"><option value="">—</option>${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}" ${e.forma_pagamento === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field full"><label class="g-check"><input id="x-rec" type="checkbox" ${e.recorrente ? 'checked' : ''}> Despesa recorrente (repete todo mês)</label></div>
        <div class="field full"><label for="x-notes">Observações</label><textarea id="x-notes" rows="2">${esc(e.observacoes || '')}</textarea></div>
      </div>
      <div class="g-error" id="g-error" hidden></div>
      <div class="g-actions"><button type="button" class="btn btn-ghost" id="g-cancel">Cancelar</button><button type="button" class="btn btn-primary" id="g-save">Salvar despesa</button></div>`);

    $('g-close').onclick = closeModal;
    $('g-cancel').onclick = closeModal;
    $('x-status').onchange = () => { $('x-due-field').hidden = $('x-status').value !== 'a_pagar'; };
    $('x-desc').focus();

    $('g-save').onclick = async () => {
      const descricao = $('x-desc').value.trim();
      const valor = round2(num($('x-val').value));
      const data = $('x-date').value;
      const statusValue = $('x-status').value;

      if (!descricao) return showError('Informe a descrição da despesa.');
      if (!(valor > 0)) return showError('Informe um valor maior que zero.');
      if (!data) return showError('Informe a data da despesa.');

      const payload = {
        descricao,
        categoria: $('x-cat').value,
        valor,
        data,
        status: statusValue,
        vencimento: statusValue === 'a_pagar' ? ($('x-due').value || null) : null,
        data_pagamento: statusValue === 'pago' ? (e.data_pagamento || (isNew ? data : todayLocal())) : null,
        forma_pagamento: $('x-method').value || null,
        recorrente: $('x-rec').checked,
        observacoes: $('x-notes').value.trim() || null
      };

      $('g-save').disabled = true;
      try {
        if (isNew) await supabaseQuery(c => c.from('despesas').insert(payload));
        else await supabaseQuery(c => c.from('despesas').update(payload).eq('id', e.id));
        closeModal();
        toast(isNew ? 'Despesa cadastrada.' : 'Despesa atualizada.');
        await load();
      } catch (_) {
        $('g-save').disabled = false;
      }
    };
  }

  async function markExpensePaid(id) {
    try {
      await supabaseQuery(c => c.from('despesas').update({ status: 'pago', data_pagamento: todayLocal() }).eq('id', id));
      toast('Despesa marcada como paga.');
      await load();
    } catch (_) { /* supabaseQuery já avisou */ }
  }

  async function deleteExpense(id) {
    const exp = state.despesas.find(d => d.id === id);
    if (!confirm(`Excluir a despesa "${exp?.descricao || ''}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await supabaseQuery(c => c.from('despesas').delete().eq('id', id));
      toast('Despesa excluída.');
      await load();
    } catch (_) { /* supabaseQuery já avisou */ }
  }

  /** Copia as despesas recorrentes do mês passado para o mês atual (como "a pagar"). */
  async function launchRecurring() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const prevStart = localISO(new Date(y, m - 1, 1));
    const prevEnd = localISO(new Date(y, m, 0));
    const curStart = localISO(new Date(y, m, 1));
    const curEnd = localISO(new Date(y, m + 1, 0));
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    try {
      const [prev, cur] = await Promise.all([
        fetchAll(c => c.from('despesas').select('*').eq('recorrente', true).gte('data', prevStart).lte('data', prevEnd).order('id')),
        fetchAll(c => c.from('despesas').select('descricao,categoria').gte('data', curStart).lte('data', curEnd).order('id'))
      ]);

      const keyOf = d => `${d.categoria}|${String(d.descricao).trim().toLowerCase()}`;
      const existing = new Map();
      cur.forEach(d => existing.set(keyOf(d), (existing.get(keyOf(d)) || 0) + 1));

      const toCreate = [];
      prev.forEach(d => {
        const left = existing.get(keyOf(d)) || 0;
        if (left > 0) existing.set(keyOf(d), left - 1);
        else toCreate.push(d);
      });

      if (!toCreate.length) {
        toast(prev.length ? 'As despesas recorrentes deste mês já estão lançadas.' : 'Não há despesas recorrentes no mês passado para repetir.');
        return;
      }

      const list = toCreate.map(d => `• ${d.descricao} — ${fmtMoney(d.valor)}`).join('\n');
      if (!confirm(`Lançar ${toCreate.length} despesa(s) recorrente(s) neste mês, como "a pagar"?\n\n${list}`)) return;

      const clampDay = iso => Math.min(Number(String(iso).slice(8, 10)), daysInMonth);
      const rows = toCreate.map(d => ({
        descricao: d.descricao,
        categoria: d.categoria,
        valor: d.valor,
        data: localISO(new Date(y, m, clampDay(d.data))),
        status: 'a_pagar',
        vencimento: d.vencimento ? localISO(new Date(y, m, clampDay(d.vencimento))) : null,
        data_pagamento: null,
        forma_pagamento: d.forma_pagamento,
        recorrente: true,
        observacoes: d.observacoes
      }));

      await supabaseQuery(c => c.from('despesas').insert(rows));
      toast(`${rows.length} despesa(s) recorrente(s) lançada(s).`);
      await load();
    } catch (_) { /* supabaseQuery já avisou */ }
  }

  /* -------------------------------------------------------
     COMPRAS DE PEÇAS (LOTES): criar / editar / excluir
     ------------------------------------------------------- */

  function itemRowHTML(item) {
    const i = item || {};
    return `<div class="g-item-row">
      <input class="g-item-desc g-i-desc" type="text" maxlength="160" placeholder="Ex.: Camiseta preta G" value="${esc(i.descricao || '')}">
      <input class="g-i-qty" type="number" inputmode="numeric" step="1" min="1" placeholder="Qtd" value="${i.quantidade != null ? Number(i.quantidade) : ''}">
      <input class="g-i-cost" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Custo" value="${i.custo_unitario != null ? Number(i.custo_unitario).toFixed(2) : ''}">
      <input class="g-i-sale" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Venda" value="${i.venda_unitario != null ? Number(i.venda_unitario).toFixed(2) : ''}">
      <span class="g-item-profit">—</span>
      <button type="button" class="icon-btn g-i-remove" aria-label="Remover item">×</button>
    </div>`;
  }

  function readItemRows() {
    return [...document.querySelectorAll('#g-items .g-item-row')].map(row => ({
      row,
      descricao: row.querySelector('.g-i-desc').value.trim(),
      quantidade: num(row.querySelector('.g-i-qty').value),
      custo_unitario: round2(num(row.querySelector('.g-i-cost').value)),
      venda_unitario: round2(num(row.querySelector('.g-i-sale').value)),
      empty: !row.querySelector('.g-i-desc').value.trim()
        && !row.querySelector('.g-i-qty').value
        && !row.querySelector('.g-i-cost').value
        && !row.querySelector('.g-i-sale').value
    }));
  }

  function refreshLotTotals() {
    let qtd = 0; let custo = 0; let venda = 0;
    readItemRows().forEach(r => {
      const profit = round2((r.venda_unitario - r.custo_unitario) * r.quantidade);
      const cell = r.row.querySelector('.g-item-profit');
      cell.textContent = r.quantidade > 0 ? fmtMoney(profit) : '—';
      cell.className = `g-item-profit ${profit < 0 ? 'text-neg' : (profit > 0 ? 'text-pos' : '')}`;
      if (r.quantidade > 0) {
        qtd += r.quantidade;
        custo += r.custo_unitario * r.quantidade;
        venda += r.venda_unitario * r.quantidade;
      }
    });
    custo = round2(custo);
    venda = round2(venda);
    const lucro = round2(venda - custo);
    $('lt-qtd').textContent = qtd;
    $('lt-cost').textContent = fmtMoney(custo);
    $('lt-sale').textContent = fmtMoney(venda);
    $('lt-profit').textContent = `${fmtMoney(lucro)}${venda > 0 ? ' · ' + pct(lucro / venda) : ''}`;
    $('lt-profit').className = lucro < 0 ? 'text-neg' : (lucro > 0 ? 'text-pos' : '');
  }

  function openLotForm(lot) {
    const l = lot || {};
    const isNew = !l.id;
    const items = (l.compras_itens || []).length ? l.compras_itens : [{}];

    openModal(`
      <div class="modal-head"><div><span class="eyebrow">INVESTIMENTO</span><h3>${isNew ? 'Nova compra de peças' : 'Editar compra de peças'}</h3></div><button type="button" class="icon-btn" id="g-close" aria-label="Fechar">×</button></div>
      <div class="form-grid">
        <div class="field"><label for="l-supplier">Fornecedor</label><input id="l-supplier" type="text" maxlength="120" value="${esc(l.fornecedor || '')}" placeholder="Ex.: Atacado do Brás"></div>
        <div class="field"><label for="l-date">Data da compra *</label><input id="l-date" type="date" value="${esc(l.data_compra || todayLocal())}"></div>
        <div class="field"><label for="l-method">Forma de pagamento</label><select id="l-method"><option value="">—</option>${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}" ${l.forma_pagamento === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field"><label for="l-notes">Observações</label><input id="l-notes" type="text" value="${esc(l.observacoes || '')}"></div>
      </div>

      <div class="g-items-head"><span>Item</span><span>Qtd</span><span>Custo unit.</span><span>Venda unit.</span><span style="text-align:right">Lucro</span><span></span></div>
      <div id="g-items">${items.map(itemRowHTML).join('')}</div>
      <button type="button" class="btn btn-ghost" id="g-add-item" style="margin-top:4px">＋ Adicionar item</button>

      <div class="g-lot-totals">
        <div><small>Peças</small><strong id="lt-qtd">0</strong></div>
        <div><small>Custo total</small><strong id="lt-cost">R$ 0,00</strong></div>
        <div><small>Venda prevista</small><strong id="lt-sale">R$ 0,00</strong></div>
        <div><small>Lucro previsto</small><strong id="lt-profit">R$ 0,00</strong></div>
      </div>

      <div class="g-error" id="g-error" hidden></div>
      <div class="g-actions"><button type="button" class="btn btn-ghost" id="g-cancel">Cancelar</button><button type="button" class="btn btn-primary" id="g-save">Salvar compra</button></div>`, true);

    $('g-close').onclick = closeModal;
    $('g-cancel').onclick = closeModal;

    const itemsBox = $('g-items');
    itemsBox.addEventListener('input', refreshLotTotals);
    itemsBox.addEventListener('click', event => {
      const btn = event.target.closest('.g-i-remove');
      if (!btn) return;
      const rows = itemsBox.querySelectorAll('.g-item-row');
      if (rows.length === 1) {
        rows[0].querySelectorAll('input').forEach(i => { i.value = ''; });
      } else {
        btn.closest('.g-item-row').remove();
      }
      refreshLotTotals();
    });
    $('g-add-item').onclick = () => {
      itemsBox.insertAdjacentHTML('beforeend', itemRowHTML());
      itemsBox.lastElementChild.querySelector('.g-i-desc').focus();
      refreshLotTotals();
    };
    refreshLotTotals();

    $('g-save').onclick = async () => {
      const date = $('l-date').value;
      if (!date) return showError('Informe a data da compra.');

      const rows = readItemRows().filter(r => !r.empty);
      if (!rows.length) return showError('Adicione pelo menos um item com quantidade, custo e preço de venda.');

      for (const [index, r] of rows.entries()) {
        const n = index + 1;
        if (!r.descricao) return showError(`Item ${n}: informe a descrição.`);
        if (!Number.isInteger(r.quantidade) || r.quantidade < 1) return showError(`Item ${n}: a quantidade precisa ser um número inteiro de 1 em diante.`);
        if (!(r.custo_unitario >= 0) || !(r.venda_unitario >= 0)) return showError(`Item ${n}: custo e venda não podem ser negativos.`);
      }

      $('g-save').disabled = true;
      try {
        await supabaseQuery(c => c.rpc('zer01_salvar_lote', {
          p_id: l.id || null,
          p_fornecedor: $('l-supplier').value.trim() || null,
          p_data: date,
          p_forma: $('l-method').value || null,
          p_obs: $('l-notes').value.trim() || null,
          p_itens: rows.map(r => ({
            descricao: r.descricao,
            quantidade: r.quantidade,
            custo_unitario: r.custo_unitario,
            venda_unitario: r.venda_unitario
          }))
        }));
        closeModal();
        toast(isNew ? 'Compra cadastrada.' : 'Compra atualizada.');
        await load();
      } catch (_) {
        $('g-save').disabled = false;
      }
    };
  }

  async function deleteLot(id) {
    const lot = state.lotes.find(l => l.id === id);
    const t = lot ? lotTotals(lot) : null;
    if (!confirm(`Excluir esta compra${lot?.fornecedor ? ` (${lot.fornecedor})` : ''}${t ? ` de ${fmtMoney(t.custo)}` : ''} e todos os itens dela? Esta ação não pode ser desfeita.`)) return;
    try {
      await supabaseQuery(c => c.from('compras_lotes').delete().eq('id', id));
      toast('Compra excluída.');
      await load();
    } catch (_) { /* supabaseQuery já avisou */ }
  }

  /* -------------------------------------------------------
     EVENTOS
     ------------------------------------------------------- */

  function showTab(name) {
    document.querySelectorAll('.gastos-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.gastos-pane').forEach(p => { p.hidden = p.id !== `tab-${name}`; });
  }

  document.querySelectorAll('.gastos-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => { applyPreset(btn.dataset.preset); load(); }));
  $('g-start').addEventListener('change', load);
  $('g-end').addEventListener('change', load);
  $('g-basis').addEventListener('change', renderResumo);
  $('d-category').addEventListener('change', renderDespesas);
  $('d-status').addEventListener('change', renderDespesas);
  $('d-new').addEventListener('click', () => openExpenseForm());
  $('d-recurring').addEventListener('click', launchRecurring);
  $('l-new').addEventListener('click', () => openLotForm());

  $('d-table').addEventListener('click', event => {
    const btn = event.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'edit') openExpenseForm(state.despesas.find(d => d.id === id));
    if (btn.dataset.act === 'pay') markExpensePaid(id);
    if (btn.dataset.act === 'del') deleteExpense(id);
  });

  $('l-list').addEventListener('click', event => {
    const btn = event.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'lot-edit') openLotForm(state.lotes.find(l => l.id === id));
    if (btn.dataset.act === 'lot-del') deleteLot(id);
  });

  /* -------------------------------------------------------
     INICIALIZAÇÃO
     ------------------------------------------------------- */

  $('d-category').innerHTML += Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  applyPreset('month');
  load();
})();
