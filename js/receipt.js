/* =========================================================
   COMPROVANTES DE VENDA — ZER01
   Comprovante interno, não fiscal, otimizado para bobina 58 mm.
   ========================================================= */
(function () {
  const methodLabels = {
    crediario: 'Crediário / fiado', dinheiro: 'Dinheiro', pix: 'PIX',
    cartao_debito: 'Cartão de débito', cartao_credito: 'Cartão de crédito à vista',
    transferencia: 'Transferência bancária', cartao: 'Cartão', outros: 'Outros'
  };
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dateBR = value => {
    if (!value) return '—';
    const parts = String(value).slice(0, 10).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : escape(value);
  };

  function itemRows(sale) {
    let items = sale.itens_json;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = null; }
    }
    if (Array.isArray(items) && items.length) {
      return items.map(item => {
        const qty = Number(item.quantidade) || 1;
        const price = Number(item.valor) || 0;
        return `<div class="item"><div class="item-name">${escape(item.descricao || 'Item')}</div><div class="item-detail"><span>${qty} x ${money(price)}</span><strong>${money(qty * price)}</strong></div></div>`;
      }).join('');
    }
    return `<div class="item"><div class="item-name">${escape(sale.descricao || 'Produtos da venda')}</div></div>`;
  }

  function receiptHTML(sale) {
    const isCredit = sale.forma_pagamento === 'crediario';
    const installments = Array.isArray(sale.parcelas) ? [...sale.parcelas].sort((a, b) => Number(a.numero) - Number(b.numero)) : [];
    const installmentsHTML = isCredit ? `
      <div class="rule"></div><div class="section-title">PARCELAMENTO</div>
      ${installments.length ? installments.map(p => `<div class="installment"><span>Parcela ${escape(p.numero)} · ${dateBR(p.vencimento)}</span><strong>${money(p.valor)}</strong></div>`).join('') : `<p class="muted">${Number(sale.quantidade_parcelas) || 0} parcela(s) cadastrada(s). Consulte o sistema para os vencimentos.</p>`}
      <div class="total-row"><span>Saldo a receber</span><strong>${money(installments.length ? installments.reduce((sum, p) => sum + Math.max(0, Number(p.valor || 0) - Number(p.valor_pago || 0)), 0) : sale.valor_total)}</strong></div>` : '';
    const created = sale.criado_em || sale.created_at;
    const dateText = created ? new Date(created).toLocaleString('pt-BR') : dateBR(sale.data_venda);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprovante Zer01</title><style>
      @page{size:58mm auto;margin:3mm}*{box-sizing:border-box}body{font:12px/1.4 Arial,sans-serif;color:#111;width:52mm;margin:0 auto}h1{font-size:20px;text-align:center;margin:0;letter-spacing:1px} .subtitle{text-align:center;font-size:8px;line-height:1.35;letter-spacing:.35px;margin-bottom:8px}.center{text-align:center}.muted{color:#555;font-size:10px}.rule{border-top:1px dashed #555;margin:8px 0}.meta{display:flex;justify-content:space-between;gap:8px;margin:3px 0}.section-title{font-weight:bold;margin:7px 0}.item{margin:7px 0}.item-name{overflow-wrap:anywhere}.item-detail{display:flex;justify-content:space-between;gap:4px;font-size:11px}.total-row{display:flex;justify-content:space-between;gap:8px;font-size:14px;font-weight:bold;margin-top:8px}.installment{display:flex;justify-content:space-between;gap:4px;font-size:10px;margin:4px 0}.footer{text-align:center;font-size:10px;margin-top:12px}.status{text-align:center;font-weight:bold;font-size:14px;margin:8px 0;padding:5px;border:1px solid #111}
      </style></head><body><h1>ZER01</h1><div class="subtitle">MODA MASCULINA<br>COMPROVANTE DE VENDA</div><div class="rule"></div><div class="meta"><span>Venda</span><strong>#${escape(String(sale.id || '').slice(0, 8).toUpperCase() || '—')}</strong></div><div class="meta"><span>Data</span><span>${escape(dateText)}</span></div><div class="meta"><span>Cliente</span><span>${escape(sale.clientes?.nome || sale.cliente_nome || 'Não identificado')}</span></div><div class="rule"></div><div class="section-title">ITENS</div>${itemRows(sale)}<div class="rule"></div><div class="total-row"><span>TOTAL</span><strong>${money(sale.valor_total)}</strong></div><div class="meta" style="margin-top:7px"><span>Pagamento</span><strong>${escape(methodLabels[sale.forma_pagamento] || sale.forma_pagamento || '—')}</strong></div><div class="status">${isCredit ? 'VENDA NO CREDIÁRIO' : 'PAGO'}</div>${installmentsHTML}<div class="rule"></div><div class="footer"><div class="store-address">Avenida Inglaterra, 626<br>Londrina/PR</div><br>Este documento é um comprovante interno,<br>não é documento fiscal.<br><br>Obrigado pela preferência!<br>ZER01</div><script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),250)});window.addEventListener('afterprint',()=>setTimeout(()=>window.close(),250));</script></body></html>`;
  }

  window.printSaleReceipt = function (sale) {
    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');
      return;
    }
    popup.document.open();
    popup.document.write(receiptHTML(sale));
    popup.document.close();
  };

  window.offerSaleReceipt = function (sale) {
    document.getElementById('sale-receipt-prompt')?.remove();
    const modal = document.createElement('div');
    modal.id = 'sale-receipt-prompt';
    modal.innerHTML = `<div class="receipt-prompt-backdrop"><section class="receipt-prompt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-prompt-title"><h2 id="receipt-prompt-title">Venda registrada!</h2><p>Deseja imprimir o comprovante desta venda agora?</p><div class="receipt-prompt-actions"><button type="button" class="btn btn-ghost" data-receipt-close>Agora não</button><button type="button" class="btn btn-primary" data-receipt-print>Imprimir comprovante</button></div></section></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-receipt-close]').onclick = () => modal.remove();
    modal.querySelector('[data-receipt-print]').onclick = () => { modal.remove(); window.printSaleReceipt(sale); };
  };
})();
