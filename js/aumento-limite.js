/* =========================================================
   AUMENTO DE LIMITE NO ATO DA VENDA — ZER01
   - Limite efetivo = limite aprovado + aumentos temporários ativos.
   - Se a venda não cabe no limite disponível, abre a tela para
     o operador escolher:
       * Aumento PERMANENTE  → muda o limite aprovado do cliente.
       * Aumento TEMPORÁRIO  → vale até o cliente pagar o valor do
                               aumento; depois volta ao original.
   - A regra real fica no banco (migration_aumento_limite.sql).
   Depende de: app.js (carregado antes).
   ========================================================= */
(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const cents = value => Math.round(Number(value || 0) * 100);

  /* -------------------------------------------------------
     DADOS: limite base, aumento temporário, em aberto
     ------------------------------------------------------- */

  async function fetchLimitInfo(clienteId) {
    const [score, installments, grants] = await Promise.all([
      supabaseQuery(c => c.from('cliente_score')
        .select('limite_aprovado')
        .eq('cliente_id', clienteId)
        .maybeSingle()),
      supabaseQuery(c => c.from('parcelas')
        .select('valor,valor_pago,vencimento,status,vendas!inner(cliente_id,status)')
        .eq('vendas.cliente_id', clienteId)
        .neq('vendas.status', 'cancelada')),
      supabaseQuery(c => c.from('aumentos_limite')
        .select('valor_restante')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'temporario')
        .eq('status', 'ativo'))
    ]);

    const today = todayISO();
    let openBalance = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    (installments || []).forEach(p => {
      const value = Number(p.valor || 0);
      const paid = p.status === 'paga' && p.valor_pago == null ? value : Number(p.valor_pago || 0);
      const remaining = p.status === 'paga' ? 0 : Math.max(value - paid, 0);
      openBalance += remaining;
      if (remaining > 0.005 && p.vencimento < today) {
        overdueCount += 1;
        overdueAmount += remaining;
      }
    });

    const base = score?.limite_aprovado == null ? null : Number(score.limite_aprovado);
    const temp = (grants || []).reduce((sum, g) => sum + Number(g.valor_restante || 0), 0);
    const effective = base == null ? null : base + temp;

    return {
      base,
      temp,
      effective,
      openBalance,
      available: effective == null ? 0 : Math.max(effective - openBalance, 0),
      overdueCount,
      overdueAmount
    };
  }

  /* -------------------------------------------------------
     RPCs
     ------------------------------------------------------- */

  async function grant(clienteId, decision) {
    const result = await supabaseQuery(c => c.rpc('zer01_conceder_aumento_limite', {
      p_cliente_id: clienteId,
      p_tipo: decision.tipo,
      p_valor: decision.valor,
      p_motivo: decision.motivo || null
    }));
    if (!result?.id) throw new Error('Não foi possível aplicar o aumento de limite.');
    return result;
  }

  async function rollback(grantId) {
    if (!grantId) return;
    try {
      const { error } = await window.supabaseClient.rpc('zer01_desfazer_aumento_limite', { p_id: grantId });
      if (error) throw error;
    } catch (error) {
      console.error('[Aumento de limite] Falha ao desfazer:', error);
      toast('A venda falhou e o aumento de limite não pôde ser desfeito automaticamente. Confira o limite do cliente.', 'error');
    }
  }

  async function linkToSale(grantId, saleId) {
    if (!grantId || !saleId) return;
    try {
      const { error } = await window.supabaseClient
        .from('aumentos_limite')
        .update({ venda_id: saleId })
        .eq('id', grantId);
      if (error) throw error;
    } catch (error) {
      console.error('[Aumento de limite] Falha ao vincular à venda:', error);
    }
  }

  /* -------------------------------------------------------
     TELA DE DECISÃO
     Resolve com { tipo, valor, motivo } ou null (cancelou).
     ------------------------------------------------------- */

  function requestIncrease({ clienteNome, saleTotal, info }) {
    return new Promise(resolve => {
      const shortfall = Math.max(Math.ceil((saleTotal - info.available - 0.005) * 100) / 100, 0.01);

      document.getElementById('limit-modal')?.remove();

      const modal = document.createElement('div');
      modal.id = 'limit-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-card limit-modal-card" role="dialog" aria-modal="true" aria-label="Limite insuficiente">
          <div class="modal-head">
            <div>
              <span class="eyebrow">LIMITE INSUFICIENTE</span>
              <h3>${esc(clienteNome || 'Cliente')}</h3>
            </div>
            <button type="button" class="icon-btn" id="limit-close" aria-label="Fechar">×</button>
          </div>

          <div class="limit-summary">
            <div><small>Limite atual</small><strong>${esc(fmtMoney(info.effective))}</strong>${info.temp > 0.005 ? `<small>base ${esc(fmtMoney(info.base))} + temporário ${esc(fmtMoney(info.temp))}</small>` : ''}</div>
            <div><small>Em aberto</small><strong>${esc(fmtMoney(info.openBalance))}</strong></div>
            <div><small>Disponível</small><strong>${esc(fmtMoney(info.available))}</strong></div>
            <div><small>Valor da venda</small><strong>${esc(fmtMoney(saleTotal))}</strong></div>
          </div>

          <div class="limit-missing">Faltam <strong>${esc(fmtMoney(shortfall))}</strong> de limite para concluir esta venda.</div>

          <div class="limit-types" role="radiogroup" aria-label="Tipo de aumento">
            <label class="limit-type">
              <input type="radio" name="limit-type" value="temporario" checked>
              <span>
                <strong>Aumento temporário</strong>
                <small>Vale por cima do limite do cliente. Conforme ele paga, o aumento vai sendo abatido, e quando o valor do aumento for pago o limite volta ao original.</small>
              </span>
            </label>
            <label class="limit-type">
              <input type="radio" name="limit-type" value="permanente">
              <span>
                <strong>Aumento permanente</strong>
                <small>O limite aprovado do cliente passa a ser o novo valor e fica registrado no Zer01 Score.</small>
              </span>
            </label>
          </div>

          <div class="field">
            <label for="limit-value">Valor do aumento (R$)</label>
            <input id="limit-value" type="number" inputmode="decimal" step="0.01" min="${shortfall.toFixed(2)}" value="${shortfall.toFixed(2)}">
          </div>
          <div class="limit-preview" id="limit-preview"></div>

          <div class="field" style="margin-top:12px">
            <label for="limit-reason">Motivo <span id="limit-reason-mark" hidden>*</span></label>
            <textarea id="limit-reason" rows="2" placeholder="Ex.: cliente antigo, bom pagador, autorizado pela gerência..."></textarea>
          </div>

          <div class="limit-error" id="limit-error" hidden></div>

          <div class="card-modal-actions">
            <button type="button" class="btn btn-ghost" id="limit-cancel">Cancelar venda</button>
            <button type="button" class="btn btn-primary" id="limit-apply">Aumentar limite e continuar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      const $ = id => modal.querySelector('#' + id);
      const valueInput = $('limit-value');
      const reason = $('limit-reason');
      const errorBox = $('limit-error');
      const typeOf = () => modal.querySelector('input[name="limit-type"]:checked').value;
      const parsedValue = () => Number(String(valueInput.value).replace(',', '.'));

      const showError = message => { errorBox.textContent = message; errorBox.hidden = !message; };

      const refresh = () => {
        const type = typeOf();
        const value = parsedValue();
        const valid = Number.isFinite(value) && value > 0;
        $('limit-reason-mark').hidden = type !== 'permanente';

        if (!valid) { $('limit-preview').innerHTML = ''; return; }

        if (type === 'permanente') {
          $('limit-preview').innerHTML = `Novo limite aprovado: <strong>${esc(fmtMoney(info.base + value))}</strong> (permanente).`;
        } else {
          $('limit-preview').innerHTML = `Limite nesta venda: <strong>${esc(fmtMoney(info.effective + value))}</strong>. `
            + `Quando o cliente pagar <strong>${esc(fmtMoney(value))}</strong>, o limite volta a ${esc(fmtMoney(info.base))}.`;
        }
      };

      const finish = result => {
        document.removeEventListener('keydown', onKey, true);
        modal.remove();
        resolve(result);
      };

      const onKey = event => { if (event.key === 'Escape') finish(null); };
      document.addEventListener('keydown', onKey, true);

      modal.querySelectorAll('input[name="limit-type"]').forEach(r => r.addEventListener('change', refresh));
      valueInput.addEventListener('input', () => { showError(''); refresh(); });
      $('limit-close').onclick = () => finish(null);
      $('limit-cancel').onclick = () => finish(null);
      modal.addEventListener('mousedown', event => { if (event.target === modal) finish(null); });

      $('limit-apply').onclick = () => {
        const type = typeOf();
        const value = parsedValue();
        const motivo = reason.value.trim();

        if (!Number.isFinite(value) || value <= 0) {
          showError('Informe o valor do aumento.');
          valueInput.focus();
          return;
        }
        if (cents(value) < cents(shortfall)) {
          showError(`O aumento precisa cobrir pelo menos ${fmtMoney(shortfall)} (o que falta para a venda).`);
          valueInput.focus();
          return;
        }
        if (type === 'permanente' && !motivo) {
          showError('Informe o motivo do aumento permanente.');
          reason.focus();
          return;
        }
        finish({ tipo: type, valor: Math.round(value * 100) / 100, motivo: motivo || null });
      };

      refresh();
      valueInput.focus();
      valueInput.select();
    });
  }

  window.ZER01AumentoLimite = { fetchLimitInfo, requestIncrease, grant, rollback, linkToSale };
})();
