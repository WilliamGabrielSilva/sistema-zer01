/* =========================================================
   ZER01 SCORE — análise interna de crédito
   ========================================================= */

let scoreRows = [];
let scoreConfig = { limite_base: 300, minimo_parcelas_historico: 3 };

const scoreMoney = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const scoreDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const scoreToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const scoreSafe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function scorePaidAmount(parcela) {
  const logged = (parcela.pagamentos || [])
    .filter(p => (p.status || 'confirmado') === 'confirmado')
    .reduce((sum,p) => sum + Number(p.valor || 0), 0);
  const recorded = Number(parcela.valor_pago || 0);
  // Dados legados: algumas parcelas eram marcadas como pagas sem valor_pago nem log.
  if (parcela.status === 'paga' && parcela.valor_pago == null && logged === 0) return Number(parcela.valor || 0);
  // O status pago é uma fonte histórica válida quando o valor agregado não foi gravado.
  if (parcela.status === 'paga' && parcela.valor_pago == null) return Math.max(logged, Number(parcela.valor || 0));
  return Math.max(logged, recorded);
}

function scoreSettledDate(parcela) {
  const value = Number(parcela.valor || 0);
  const rows = (parcela.pagamentos || [])
    .filter(p => (p.status || 'confirmado') === 'confirmado' && p.data_pagamento)
    .sort((a,b) => String(a.data_pagamento).localeCompare(String(b.data_pagamento)));
  let total = 0;
  for (const payment of rows) {
    total += Number(payment.valor || 0);
    if (total + 0.005 >= value) return payment.data_pagamento;
  }

  // Compatibilidade com parcelas quitadas antes da criação do histórico de pagamentos
  // ou com registros antigos em que valor_pago/data_pagamento são a fonte disponível.
  const recordedPaid = Number(parcela.valor_pago || 0);
  if (parcela.status === 'paga' && (recordedPaid + 0.005 >= value || parcela.valor_pago == null)) {
    return parcela.data_pagamento || rows.at(-1)?.data_pagamento || null;
  }
  // Alguns registros antigos têm valor_pago completo, mas também possuem pagamentos
  // parciais/incompletos no histórico. Nesse caso, usa a data final gravada na parcela.
  if (recordedPaid + 0.005 >= value) return parcela.data_pagamento || rows.at(-1)?.data_pagamento || null;
  return null;
}

function calculateCustomerScore(cliente, parcelas) {
  const today = scoreToday();
  const customerInstallments = parcelas.filter(p =>
    p.vendas?.cliente_id === cliente.id &&
    p.vendas?.forma_pagamento === 'crediario' &&
    p.vendas?.status !== 'cancelada'
  );

  const settled = customerInstallments.map(p => ({
    parcela: p,
    dataQuitacao: scoreSettledDate(p)
  })).filter(x => x.dataQuitacao);

  const openBalance = customerInstallments.reduce((sum,p) => {
    const paidTotal = scorePaidAmount(p);
    return sum + Math.max(Number(p.valor || 0) - paidTotal, 0);
  }, 0);

  const overdueCount = customerInstallments.filter(p => {
    const remaining = Math.max(Number(p.valor || 0) - scorePaidAmount(p), 0);
    return remaining > 0.005 && p.vencimento < today;
  }).length;

  const minimum = Number(scoreConfig.minimo_parcelas_historico || 3);
  const enoughHistory = settled.length >= minimum;

  const onTime = settled.filter(x => x.dataQuitacao <= x.parcela.vencimento);
  const late = settled.filter(x => x.dataQuitacao > x.parcela.vencimento);
  const punctuality = settled.length ? (onTime.length / settled.length) * 100 : 0;

  const lateDays = late.map(x => Math.max(0, Math.round(
    (new Date(`${x.dataQuitacao}T00:00:00`) - new Date(`${x.parcela.vencimento}T00:00:00`)) / 86400000
  )));
  const averageLateDays = lateDays.length ? lateDays.reduce((a,b)=>a+b,0)/lateDays.length : 0;
  const delayScore = Math.max(0, 100 - averageLateDays * 3 - (late.length / Math.max(settled.length,1)) * 25);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setHours(0,0,0,0);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recent = settled.filter(x => new Date(`${x.dataQuitacao}T00:00:00`) >= ninetyDaysAgo);
  const recentScore = recent.length ? (recent.filter(x => x.dataQuitacao <= x.parcela.vencimento).length / recent.length) * 100 : 50;

  const created = cliente.criado_em ? new Date(cliente.criado_em) : new Date();
  const months = Math.max(0, (new Date().getFullYear()-created.getFullYear())*12 + new Date().getMonth()-created.getMonth());
  const tenureScore = Math.min(100, months / 24 * 100);

  const totalSettledValue = settled.reduce((s,x)=>s+Number(x.parcela.valor||0),0);
  const onTimeValue = onTime.reduce((s,x)=>s+Number(x.parcela.valor||0),0);
  const valueScore = totalSettledValue ? onTimeValue / totalSettledValue * 100 : 0;

  const components = {
    pontualidade: Math.round(punctuality),
    atrasos: Math.round(delayScore),
    recente: Math.round(recentScore),
    tempo_cliente: Math.round(tenureScore),
    valor_pago: Math.round(valueScore),
    parcelas_quitadas: settled.length,
    parcelas_em_atraso: overdueCount,
    dias_atraso_medio: Math.round(averageLateDays),
    saldo_em_aberto: Math.round(openBalance * 100) / 100
  };

  if (!enoughHistory) {
    return { score: null, classification: 'sem_classificacao', suggested: 0, components, openBalance, overdueCount, settledCount: settled.length };
  }

  const totalWeight = Number(scoreConfig.peso_pontualidade || 40) +
    Number(scoreConfig.peso_atrasos || 25) + Number(scoreConfig.peso_recente || 15) +
    Number(scoreConfig.peso_tempo_cliente || 10) + Number(scoreConfig.peso_valor_pago || 10);
  const weights = [
    [components.pontualidade, Number(scoreConfig.peso_pontualidade || 40) / totalWeight],
    [components.atrasos, Number(scoreConfig.peso_atrasos || 25) / totalWeight],
    [components.recente, Number(scoreConfig.peso_recente || 15) / totalWeight],
    [components.tempo_cliente, Number(scoreConfig.peso_tempo_cliente || 10) / totalWeight],
    [components.valor_pago, Number(scoreConfig.peso_valor_pago || 10) / totalWeight]
  ];
  const score = Math.max(0, Math.min(1000, Math.round(weights.reduce((s,[n,w])=>s+n*w,0)*10)));

  let classification = 'risco_alto', multiplier = 0;
  if (score >= 900) { classification='excelente'; multiplier=2; }
  else if (score >= 750) { classification='muito_bom'; multiplier=1.5; }
  else if (score >= 600) { classification='bom'; multiplier=1; }
  else if (score >= 400) { classification='regular'; multiplier=.5; }

  return {
    score, classification,
    suggested: Math.round(Number(scoreConfig.limite_base || 300) * multiplier * 100) / 100,
    components, openBalance, overdueCount, settledCount: settled.length
  };
}

async function loadZer01Score() {
  const refresh = document.getElementById('score-refresh');
  if (refresh) refresh.disabled = true;
  try {
    // Busca em consultas separadas para não depender do nome/shape da relação
    // aninhada do PostgREST. Isso também permite conciliar pagamentos legados.
    const [clients, config, oldScores, sales] = await Promise.all([
      supabaseQuery(c => c.from('clientes').select('*').order('nome')),
      supabaseQuery(c => c.from('score_configuracoes').select('*').eq('id',1).maybeSingle()),
      supabaseQuery(c => c.from('cliente_score').select('*')),
      supabaseQuery(c => c.from('vendas').select('id,cliente_id,status,forma_pagamento').eq('forma_pagamento','crediario'))
    ]);

    if (config) scoreConfig = config;
    const validSales = (sales || []).filter(v => v.status !== 'cancelada' && v.cliente_id);
    const saleIds = validSales.map(v => v.id);
    let installments = [];
    let payments = [];
    if (saleIds.length) {
      installments = await supabaseQuery(c => c.from('parcelas')
        .select('id,venda_id,numero,valor,vencimento,status,data_pagamento,valor_pago')
        .in('venda_id', saleIds)) || [];
      const installmentIds = installments.map(p => p.id);
      if (installmentIds.length) {
        payments = await supabaseQuery(c => c.from('pagamentos')
          .select('id,parcela_id,valor,data_pagamento,status')
          .in('parcela_id', installmentIds)
          .order('data_pagamento', { ascending: true })) || [];
      }
    }

    const saleById = new Map(validSales.map(v => [v.id, v]));
    const paymentsByInstallment = new Map();
    for (const payment of payments) {
      if (!paymentsByInstallment.has(payment.parcela_id)) paymentsByInstallment.set(payment.parcela_id, []);
      paymentsByInstallment.get(payment.parcela_id).push(payment);
    }
    const normalizedInstallments = installments.map(p => ({
      ...p,
      vendas: saleById.get(p.venda_id) || null,
      pagamentos: paymentsByInstallment.get(p.id) || []
    }));

    const oldMap = new Map((oldScores || []).map(s => [s.cliente_id,s]));
    const computed = (clients || []).map(cliente => {
      const result = calculateCustomerScore(cliente, normalizedInstallments);
      return { cliente, ...result, saved: oldMap.get(cliente.id) || null };
    });

    for (const row of computed) {
      const payload = {
        cliente_id: row.cliente.id,
        pontuacao: row.score,
        classificacao: row.classification,
        limite_sugerido: row.suggested,
        parcelas_quitadas: row.settledCount,
        parcelas_em_atraso: row.overdueCount,
        saldo_em_aberto: row.openBalance,
        limite_aprovado: row.saved?.limite_aprovado ?? null,
        status_analise: row.saved?.status_analise || 'pendente',
        atualizado_por: row.saved?.atualizado_por || null,
        ultima_analise_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      };
      await supabaseQuery(c => c.from('cliente_score').upsert(payload, { onConflict:'cliente_id' }));

      const previous = row.saved;
      if (!previous || previous.pontuacao !== row.score || previous.classificacao !== row.classification ||
          Number(previous.limite_sugerido) !== Number(row.suggested)) {
        await supabaseQuery(c => c.from('cliente_score_historico').insert({
          cliente_id: row.cliente.id,
          pontuacao: row.score,
          classificacao: row.classification,
          limite_sugerido: row.suggested,
          componentes: row.components
        }));
      }
    }

    scoreRows = computed;
    renderZer01Score();
    document.getElementById('score-base').textContent = scoreMoney(scoreConfig.limite_base);
    document.getElementById('score-count').textContent = `${computed.length} clientes`;
    document.getElementById('score-overdue').textContent = computed.filter(x=>x.overdueCount>0).length;
  } catch (error) {
    console.error('[ZER01 SCORE] Falha ao carregar/calcular:', error);
    toast(`${error.message || 'Não foi possível carregar o Zer01 Score.'} Confira se a migração SQL foi executada.`, 'error');
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

function renderZer01Score() {
  const term = (document.getElementById('score-search')?.value || '').toLowerCase().trim();
  const rows = scoreRows.filter(x => [x.cliente.nome,x.cliente.cpf_cnpj,x.cliente.telefone].some(v=>String(v||'').toLowerCase().includes(term)));
  const tbody = document.getElementById('score-table');
  if (!tbody) return;
  tbody.innerHTML = rows.map(row => {
    const saved = row.saved || {};
    const scoreText = row.score === null ? '—' : row.score;
    const status = row.overdueCount ? '<span class="score-tag danger">Com atraso</span>' :
      row.score === null ? '<span class="score-tag neutral">Sem histórico</span>' :
      `<span class="score-tag good">${scoreSafe(row.classification.replace('_',' '))}</span>`;
    const approved = saved.limite_aprovado == null ? 'Não aprovado' : scoreMoney(saved.limite_aprovado);
    return `<tr>
      <td><strong>${scoreSafe(row.cliente.nome)}</strong><small>${scoreSafe(row.cliente.cpf_cnpj || row.cliente.telefone || '')}</small></td>
      <td><strong>${scoreText}</strong><small>/ 1.000</small></td>
      <td>${status}</td>
      <td>${scoreMoney(row.suggested)}</td>
      <td>${approved}</td>
      <td>${scoreMoney(row.openBalance)}</td>
      <td><div class="score-actions">
        <button class="btn btn-ghost score-details" data-id="${row.cliente.id}">Analisar</button>
        <button class="btn btn-primary score-approve" data-id="${row.cliente.id}">Decidir</button>
        <button class="btn btn-ghost score-card" data-id="${row.cliente.id}">Cartão</button>
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="empty">Nenhum cliente encontrado.</td></tr>';

  tbody.querySelectorAll('.score-details').forEach(b=>b.onclick=()=>showScoreDetails(b.dataset.id));
  tbody.querySelectorAll('.score-approve').forEach(b=>b.onclick=()=>decideCredit(b.dataset.id));
  tbody.querySelectorAll('.score-card').forEach(b=>b.onclick=()=>issueCustomerCard(b.dataset.id));
}

function showScoreDetails(id) {
  const row = scoreRows.find(x=>x.cliente.id===id);
  if (!row) return;
  const s = row.saved || {};
  const parts = [
    ['Parcelas pagas em dia',row.components.pontualidade,40],
    ['Atrasos e duração',row.components.atrasos,25],
    ['Histórico recente · 90 dias',row.components.recente,15],
    ['Tempo como cliente',row.components.tempo_cliente,10],
    ['Valor pago em dia',row.components.valor_pago,10]
  ];
  document.getElementById('score-modal').innerHTML = `<div class="score-overlay"><section class="score-modal">
    <header><div><span class="eyebrow">PERFIL FINANCEIRO</span><h2>${scoreSafe(row.cliente.nome)}</h2></div><button class="icon-btn" id="score-close">×</button></header>
    <div class="score-profile">
      <div class="score-circle"><strong>${row.score === null ? '—' : row.score}</strong><small>/ 1.000</small></div>
      <div><span class="score-tag ${row.overdueCount?'danger':row.score===null?'neutral':'good'}">${row.overdueCount?'Crediário bloqueado':row.score===null?'Sem classificação':scoreSafe(row.classification.replace('_',' '))}</span>
      <p>${row.score===null?'Histórico insuficiente: necessária análise manual.':'Pontuação calculada pelo histórico interno da loja.'}</p></div>
    </div>
    <div class="score-metrics"><div><small>Limite sugerido</small><strong>${scoreMoney(row.suggested)}</strong></div><div><small>Limite aprovado</small><strong>${s.limite_aprovado==null?'Não aprovado':scoreMoney(s.limite_aprovado)}</strong></div><div><small>Saldo em aberto</small><strong>${scoreMoney(row.openBalance)}</strong></div><div><small>Parcelas vencidas</small><strong>${row.overdueCount}</strong></div><div><small>Parcelas quitadas reconhecidas</small><strong>${row.settledCount}</strong></div></div>
    <h3>Composição do score</h3>
    ${parts.map(([label,value,weight])=>`<div class="score-component"><div><span>${label}</span><strong>${value}/100</strong></div><div class="score-track"><i style="width:${value}%"></i></div><small>Peso ${weight}%</small></div>`).join('')}
    <p class="score-note">A pontuação não libera crédito automaticamente. Qualquer parcela vencida em aberto bloqueia novas compras no crediário.</p>
    <footer><button class="btn btn-ghost" id="score-close-bottom">Fechar</button><button class="btn btn-primary" id="score-decide-modal" data-id="${id}">Registrar decisão</button></footer>
  </section></div>`;
  document.getElementById('score-close').onclick=closeScoreModal;
  document.getElementById('score-close-bottom').onclick=closeScoreModal;
  document.getElementById('score-decide-modal').onclick=()=>decideCredit(id);
}

function closeScoreModal() { document.getElementById('score-modal').innerHTML=''; }

function decideCredit(id) {
  const row = scoreRows.find(x=>x.cliente.id===id);
  if (!row) return;
  const saved = row.saved || {};
  const initial = saved.limite_aprovado == null ? row.suggested : saved.limite_aprovado;
  const blocked = row.overdueCount > 0;
  document.getElementById('score-modal').innerHTML = `<div class="score-overlay"><section class="score-modal score-decision-modal">
    <header><div><span class="eyebrow">DECISÃO MANUAL DE CRÉDITO</span><h2>${scoreSafe(row.cliente.nome)}</h2></div><button class="icon-btn" id="score-close">×</button></header>
    <div class="score-metrics">
      <div><small>Score atual</small><strong>${row.score === null ? 'Sem classificação' : `${row.score}/1.000`}</strong></div>
      <div><small>Limite recomendado</small><strong>${scoreMoney(row.suggested)}</strong></div>
      <div><small>Saldo em aberto</small><strong>${scoreMoney(row.openBalance)}</strong></div>
      <div><small>Parcelas vencidas</small><strong>${row.overdueCount}</strong></div>
    </div>
    ${blocked ? '<p class="score-note score-warning">Este cliente possui parcela vencida. Mesmo que um limite seja aprovado, novas compras no crediário continuarão bloqueadas até a regularização.</p>' : ''}
    ${row.score === null ? '<p class="score-note">Cliente sem histórico mínimo. Você pode registrar uma decisão manual, mas o sistema não atribuirá uma pontuação artificial.</p>' : ''}
    <label class="score-form-label" for="score-decision-limit">Limite que deseja aprovar (R$)</label>
    <input id="score-decision-limit" class="search score-decision-input" type="number" min="0" step="0.01" value="${Number(initial || 0).toFixed(2)}" />
    <label class="score-form-label" for="score-decision-reason">Motivo / observação</label>
    <textarea id="score-decision-reason" class="search score-decision-reason" rows="3" placeholder="Ex.: análise cadastral, indicação, histórico anterior...">${scoreSafe(saved.motivo_analise || '')}</textarea>
    <p class="score-note">Informe R$ 0,00 para negar o crédito. A decisão ficará registrada no histórico com o usuário e a data.</p>
    <footer><button class="btn btn-ghost" id="score-close-bottom">Cancelar</button><button class="btn btn-primary" id="score-save-decision">Registrar decisão</button></footer>
  </section></div>`;
  document.getElementById('score-close').onclick=closeScoreModal;
  document.getElementById('score-close-bottom').onclick=closeScoreModal;
  document.getElementById('score-save-decision').onclick=()=>saveCreditDecision(id);
}

async function saveCreditDecision(id) {
  const row = scoreRows.find(x=>x.cliente.id===id);
  if (!row) return;
  const input = document.getElementById('score-decision-limit');
  const reason = document.getElementById('score-decision-reason')?.value.trim() || null;
  const limit = Number(String(input?.value || '').replace(',', '.'));
  if (!Number.isFinite(limit) || limit < 0) {
    toast('Informe um limite válido, igual ou maior que zero.', 'error');
    input?.focus();
    return;
  }
  const button = document.getElementById('score-save-decision');
  if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
  const decision = limit > 0 ? 'aprovado' : 'negado';
  try {
    const authResult = await window.supabaseClient.auth.getUser();
    const actorId = authResult?.data?.user?.id || null;
    await supabaseQuery(c=>c.from('analises_credito').insert({
      cliente_id:id, pontuacao:row.score, limite_recomendado:row.suggested,
      limite_aprovado:limit, decisao:decision, motivo:reason, usuario_id:actorId
    }));
    await supabaseQuery(c=>c.from('cliente_score').upsert({
      cliente_id:id, pontuacao:row.score, classificacao:row.classification,
      limite_sugerido:row.suggested, limite_aprovado:limit,
      status_analise:decision, atualizado_em:new Date().toISOString(), atualizado_por:actorId
    }, { onConflict:'cliente_id' }));
    toast(decision==='aprovado'?'Limite aprovado e registrado.':'Crédito negado e registrado.');
    closeScoreModal();
    await loadZer01Score();
  } catch(error) {
    console.error('[ZER01 SCORE] Falha ao salvar decisão:', error);
    toast(error.message || 'Não foi possível registrar a decisão. Verifique as permissões e a migração SQL.', 'error');
    if (button) { button.disabled = false; button.textContent = 'Registrar decisão'; }
  }
}

async function issueCustomerCard(id) {
  const row = scoreRows.find(x=>x.cliente.id===id);
  if (!row) return;
  try {
    let card = await supabaseQuery(c=>c.from('cartoes_clientes').select('*').eq('cliente_id',id).eq('status','ativo').maybeSingle());
    if (!card) {
      const code = `Z1${crypto.randomUUID().replace(/-/g,'').slice(0,20).toUpperCase()}`;
      card = await supabaseQuery(c=>c.from('cartoes_clientes').insert({
        cliente_id:id, codigo:code, tipo:'fisico_digital', status:'ativo'
      }).select().single());
    }
    showCustomerCard(row.cliente, card);
  } catch(error) { toast(error.message || 'Não foi possível emitir o cartão.','error'); }
}

function showCustomerCard(cliente, card) {
  document.getElementById('score-modal').innerHTML = `<div class="score-overlay"><section class="score-modal score-card-modal">
    <header><div><span class="eyebrow">CARTÃO ZER01</span><h2>Identificação do cliente</h2></div><button class="icon-btn" id="score-close">×</button></header>
    <div class="zer01-card-print" id="zer01-card-print">
      <div class="zer01-card-brand">ZER<span>01</span><small>CLIENTE</small></div>
      <div class="zer01-card-name">${scoreSafe(cliente.nome)}</div>
      <div class="zer01-card-label">CARTÃO DE IDENTIFICAÇÃO</div>
      <svg id="zer01-barcode"></svg>
      <div class="zer01-card-code">${scoreSafe(card.codigo)}</div>
    </div>
    <p class="score-note">O mesmo código identifica o cartão físico e digital. Não contém CPF, limite ou score.</p>
    <footer><button class="btn btn-ghost" id="score-close-bottom">Fechar</button><button class="btn btn-primary" id="score-print">Imprimir cartão</button></footer>
  </section></div>`;
  document.getElementById('score-close').onclick=closeScoreModal;
  document.getElementById('score-close-bottom').onclick=closeScoreModal;
  if (window.JsBarcode) JsBarcode('#zer01-barcode', card.codigo, {format:'CODE128', displayValue:false, height:48, margin:2, width:1.5});
  document.getElementById('score-print').onclick=()=>window.print();
}

document.getElementById('score-search')?.addEventListener('input',renderZer01Score);
document.getElementById('score-refresh')?.addEventListener('click',loadZer01Score);
loadZer01Score();
