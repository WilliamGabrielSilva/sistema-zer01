/* Relatórios: filtros de venda e situação financeira consultam o Supabase. */
let reportSales = [];
let reportParts = [];
let reportClients = [];

async function loadReportData() {
  try {
    [reportSales, reportParts, reportClients] = await Promise.all([
      supabaseQuery((c) => c.from('vendas').select('*')),
      supabaseQuery((c) => c.from('parcelas').select('*')),
      supabaseQuery((c) => c.from('clientes').select('id,nome').order('nome'))
    ]);
    document.getElementById('report-client').innerHTML = '<option value="">Todos os clientes</option>' + reportClients.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
    renderReport();
  } catch (_) { toast('Configure o Supabase para carregar relatórios.', 'error'); }
}

function renderReport() {
  const start = document.getElementById('report-start')?.value || '';
  const end = document.getElementById('report-end')?.value || '';
  const clientId = document.getElementById('report-client')?.value || '';
  const status = document.getElementById('report-status')?.value || '';
  const sales = reportSales.filter((sale) => (!clientId || sale.cliente_id === clientId) && (!start || sale.data_venda >= start) && (!end || sale.data_venda <= end) && (status !== 'paga' && status !== 'atrasada' ? (!status || sale.status === status) : true));
  const saleIds = new Set(sales.map((sale) => sale.id));
  let parts = reportParts.filter((part) => saleIds.has(part.venda_id));
  if (status === 'paga') parts = parts.filter((part) => part.status === 'paga');
  if (status === 'atrasada') parts = parts.filter((part) => statusParcela(part) === 'atrasada');
  document.getElementById('report-sold').textContent = fmtMoney(sales.filter((sale) => sale.status !== 'cancelada').reduce((sum, sale) => sum + Number(sale.valor_total || 0), 0));
  document.getElementById('report-paid').textContent = fmtMoney(parts.filter((part) => part.status === 'paga').reduce((sum, part) => sum + Number(part.valor_pago || part.valor || 0), 0));
  document.getElementById('report-open').textContent = fmtMoney(parts.filter((part) => statusParcela(part) !== 'paga').reduce((sum, part) => sum + Number(part.valor || 0), 0));
  document.getElementById('report-late').textContent = fmtMoney(parts.filter((part) => statusParcela(part) === 'atrasada').reduce((sum, part) => sum + Number(part.valor || 0), 0));
  const debtors = {};
  parts.filter((part) => statusParcela(part) === 'atrasada').forEach((part) => { const sale = reportSales.find((item) => item.id === part.venda_id); if (!sale) return; debtors[sale.cliente_id] ??= { count: 0, total: 0 }; debtors[sale.cliente_id].count += 1; debtors[sale.cliente_id].total += Number(part.valor || 0); });
  document.getElementById('debtors-table').innerHTML = Object.entries(debtors).map(([id, data]) => `<tr><td>${display(reportClients.find((client) => client.id === id)?.nome)}</td><td>${data.count}</td><td>${fmtMoney(data.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Nenhum cliente inadimplente neste filtro.</td></tr>';
}

['report-start', 'report-end', 'report-client', 'report-status'].forEach((id) => document.getElementById(id)?.addEventListener('change', renderReport));
loadReportData();
