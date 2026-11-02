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
      :root {
        --largura: 50mm; /* área realmente impressa pela OIA-8383 (testada: corta perto de 45mm) */
        --margem: 1.5mm;
      }
      @page { size: 58mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: var(--largura); min-width: 0; }
      body {
        font: 10px/1.3 Arial, sans-serif;
        color: #111;
        padding: 0 var(--margem);
        overflow-wrap: anywhere;
        word-break: normal;
      }
      h1 { font-size: 17px; text-align: center; margin: 0; letter-spacing: 1px; }
      .subtitle { text-align: center; font-size: 8px; line-height: 1.25; letter-spacing: .2px; margin-bottom: 5px; }
      .center { text-align: center; }
      .muted { color: #555; font-size: 9px; }
      .rule { border-top: 1px dashed #555; margin: 5px 0; }
      .meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 2px; margin: 2px 0; min-width: 0; }
      .meta > * { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
      .meta > span:last-child, .meta > strong:last-child { text-align: right; }
      .section-title { font-weight: bold; margin: 5px 0; }
      .item { margin: 5px 0; }
      .item-name { overflow-wrap: anywhere; word-break: break-word; }
      .item-detail { display: flex; justify-content: space-between; align-items: flex-start; gap: 2px; font-size: 9px; }
      .item-detail > * { min-width: 0; overflow-wrap: anywhere; }
      .total-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 2px; font-size: 12px; font-weight: bold; margin-top: 5px; }
      .total-row > * { min-width: 0; overflow-wrap: anywhere; }
      .installment { display: flex; justify-content: space-between; align-items: flex-start; gap: 2px; font-size: 9px; margin: 3px 0; }
      .installment > * { min-width: 0; overflow-wrap: anywhere; }
      .total-row > strong,
      .installment > strong,
      .item-detail > strong,
      .meta > strong {white-space: nowrap; flex-shrink: 0;}
      .footer { text-align: center; font-size: 8px; margin-top: 7px; overflow-wrap: anywhere; }
      .status { text-align: center; font-weight: bold; font-size: 11px; margin: 5px 0; padding: 3px; border: 1px solid #111; }
      @media print {
        @page { size: 58mm auto; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; width: var(--largura) !important; min-width: 0 !important; }
        body { padding: 0 var(--margem) !important; }
      }
    </style></head><body><h1>ZER01</h1><div class="subtitle">MODA MASCULINA<br>COMPROVANTE DE VENDA</div><div class="rule"></div><div class="meta"><span>Venda</span><strong>#${escape(String(sale.id || '').slice(0, 8).toUpperCase() || '—')}</strong></div><div class="meta"><span>Data</span><span>${escape(dateText)}</span></div><div class="meta"><span>Cliente</span><span>${escape(sale.clientes?.nome || sale.cliente_nome || 'Não identificado')}</span></div><div class="rule"></div><div class="section-title">ITENS</div>${itemRows(sale)}<div class="rule"></div><div class="total-row"><span>TOTAL</span><strong>${money(sale.valor_total)}</strong></div><div class="meta" style="margin-top:7px"><span>Pagamento</span><strong>${escape(methodLabels[sale.forma_pagamento] || sale.forma_pagamento || '—')}</strong></div><div class="status">${isCredit ? 'VENDA NO CREDIÁRIO' : 'PAGO'}</div>${installmentsHTML}<div class="rule"></div><div class="footer"><div class="store-address">Avenida Inglaterra, 626<br>Londrina/PR</div><br>Este documento é um comprovante interno,<br>não é documento fiscal.<br><br>Obrigado pela preferência!<br>ZER01</div><script>
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 300);
      });
      window.addEventListener('afterprint', () => setTimeout(() => window.close(), 250));
    </script></body></html>`;
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
