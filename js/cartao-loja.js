/* =========================================================
   CARTÃO DA LOJA — ZER01
   - Identifica o cliente pelo código do cartão (digitado,
     leitor de código de barras USB/Bluetooth ou câmera).
   - Mostra a tela com dados do cliente, status do cartão e
     limite (aprovado / em aberto / disponível).
   - Usado nas modalidades "Crediário / fiado" (opcional) e
     "Cartão da loja" (obrigatório) da tela Nova venda.
   Depende de: app.js, aumento-limite.js, vendas.js (carregado depois deles).
   ========================================================= */
(function () {
  const $ = id => document.getElementById(id);

  const typeSelect = $('sale-type');
  const clientSelect = $('sale-client');
  const field = $('card-field');
  const input = $('card-code');
  if (!typeSelect || !field || !input) return;

  const lookupButton = $('card-lookup');
  const scanButton = $('card-scan');
  const help = $('card-help');
  const chip = $('card-chip');
  const requiredMark = $('card-required-mark');

  /** Cartão atualmente aplicado à venda (ou null). */
  let currentCard = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const normalizeCode = raw => String(raw || '').replace(/\s+/g, '').toUpperCase();

  /* -------------------------------------------------------
     DADOS: cartão + cliente + limite
     ------------------------------------------------------- */

  async function fetchCardByCode(code) {
    return supabaseQuery(c => c
      .from('cartoes_clientes')
      .select('id,cliente_id,codigo,status,tipo,emitido_em,clientes(id,nome,cpf_cnpj,telefone)')
      .eq('codigo', code)
      .maybeSingle());
  }

  /** Mesma regra de limite usada pela venda e pela trava do banco (limite aprovado + aumento temporário). */
  async function fetchCreditProfile(clienteId) {
    const [score, info] = await Promise.all([
      supabaseQuery(c => c.from('cliente_score')
        .select('pontuacao,classificacao,limite_aprovado')
        .eq('cliente_id', clienteId)
        .maybeSingle()),
      window.ZER01AumentoLimite.fetchLimitInfo(clienteId)
    ]);

    return {
      score,
      approved: info.effective,
      base: info.base,
      temp: info.temp,
      openBalance: info.openBalance,
      available: info.available,
      overdueCount: info.overdueCount,
      overdueAmount: info.overdueAmount
    };
  }

  /** Motivo de bloqueio (string) ou null se o cartão pode ser usado. */
  function blockReason(card, profile) {
    if (card.status !== 'ativo') {
      return card.status === 'bloqueado' ? 'Cartão bloqueado.' : 'Cartão cancelado.';
    }
    if (profile.approved == null) {
      return 'Cliente sem limite aprovado. Faça a análise no Zer01 Score.';
    }
    if (profile.overdueCount > 0) {
      return `Cliente com ${profile.overdueCount} parcela(s) vencida(s) em aberto (${fmtMoney(profile.overdueAmount)}).`;
    }
    return null;
  }

  /** Aviso (não bloqueia): o limite pode ser aumentado ao finalizar a venda. */
  function limitWarning(profile) {
    if (profile.approved != null && profile.available <= 0.005) {
      return 'Limite totalmente utilizado. Ao finalizar a venda será possível aumentar o limite.';
    }
    return null;
  }

  /* -------------------------------------------------------
     INTERFACE DO CAMPO
     ------------------------------------------------------- */

  function currentMode() { return typeSelect.value; }
  function usesCard() { return currentMode() === 'crediario' || currentMode() === 'cartao_loja'; }

  function syncUI() {
    const mode = currentMode();
    const show = usesCard();
    const required = mode === 'cartao_loja';

    field.hidden = !show;
    if (requiredMark) requiredMark.hidden = !required;
    if (help) {
      help.textContent = required
        ? 'Obrigatório: o cliente e o limite vêm do cartão. Com leitor de código de barras, basta passar o cartão.'
        : 'Opcional: leia o cartão para preencher o cliente automaticamente, ou escolha o cliente manualmente.';
    }

    // No cartão da loja o cliente vem sempre do cartão.
    if (clientSelect) clientSelect.disabled = required;

    if (!show && currentCard) clear();
    renderChip();
  }

  function renderChip() {
    if (!chip) return;
    if (!currentCard) { chip.hidden = true; chip.innerHTML = ''; return; }
    const { card, profile } = currentCard;
    chip.hidden = false;
    chip.innerHTML = `
      <div class="card-chip-info">
        <strong>${esc(card.clientes?.nome || 'Cliente')}</strong>
        <span>Cartão ${esc(card.codigo)} · Disponível ${esc(fmtMoney(profile.available))}</span>
      </div>
      <div class="card-chip-actions">
        <button type="button" class="btn btn-ghost" id="card-details">Ver detalhes</button>
        <button type="button" class="btn btn-ghost" id="card-remove">Remover</button>
      </div>`;
    $('card-details').onclick = () => showCardModal(card, profile, false);
    $('card-remove').onclick = () => { clear(); input.focus(); };
  }

  function clear() {
    currentCard = null;
    input.value = '';
    if (clientSelect) {
      clientSelect.disabled = currentMode() === 'cartao_loja';
      if (currentMode() === 'cartao_loja') clientSelect.value = '';
    }
    renderChip();
    // Garante a interface correta quando a venda é reiniciada.
    if (field) {
      const show = usesCard();
      field.hidden = !show;
    }
  }

  function applyCard(card, profile) {
    currentCard = { card, profile };

    if (clientSelect) {
      const id = String(card.cliente_id);
      if (![...clientSelect.options].some(o => o.value === id)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = card.clientes?.nome || 'Cliente do cartão';
        clientSelect.appendChild(option);
      }
      clientSelect.value = id;
    }

    input.value = card.codigo;
    renderChip();
    toast(`Cartão identificado: ${card.clientes?.nome || 'cliente'}.`);
  }

  /* -------------------------------------------------------
     BUSCA PELO CÓDIGO
     ------------------------------------------------------- */

  let searching = false;

  async function lookup(rawCode) {
    const code = normalizeCode(rawCode ?? input.value);
    if (!code) {
      toast('Digite ou leia o código do cartão.', 'error');
      input.focus();
      return;
    }
    if (searching) return;
    searching = true;
    if (lookupButton) lookupButton.disabled = true;

    try {
      const card = await fetchCardByCode(code);
      if (!card) {
        toast('Cartão não encontrado. Confira o código.', 'error');
        input.select();
        return;
      }
      const profile = await fetchCreditProfile(card.cliente_id);
      showCardModal(card, profile, true);
    } catch (error) {
      console.error('[Cartão da loja] Falha na busca:', error);
    } finally {
      searching = false;
      if (lookupButton) lookupButton.disabled = false;
    }
  }

  // Leitores de código de barras "digitam" o código e enviam Enter:
  // impedimos que o Enter envie o formulário da venda.
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookup();
    }
  });
  lookupButton?.addEventListener('click', () => lookup());

  /* -------------------------------------------------------
     TELA COM INFORMAÇÕES DO CARTÃO / CLIENTE / LIMITE
     ------------------------------------------------------- */

  function closeModal() {
    const modal = $('card-modal');
    if (modal) modal.remove();
  }

  function showCardModal(card, profile, canApply) {
    closeModal();

    const cliente = card.clientes || {};
    const reason = blockReason(card, profile);
    const saleTotal = typeof total === 'function' ? Number(total()) || 0 : 0;
    const used = profile.approved ? Math.min((profile.openBalance / profile.approved) * 100, 100) : 0;

    const statusLabel = { ativo: 'Ativo', bloqueado: 'Bloqueado', cancelado: 'Cancelado' }[card.status] || card.status;
    const statusClass = card.status === 'ativo' ? 'ok' : 'bad';

    let saleLine = '';
    if (saleTotal > 0 && profile.approved != null) {
      const fits = saleTotal <= profile.available + 0.005;
      saleLine = `<div class="card-sale-check ${fits ? 'ok' : 'warn'}">
        Valor da venda atual: <strong>${esc(fmtMoney(saleTotal))}</strong> —
        ${fits ? 'dentro do limite disponível.' : `acima do limite disponível (faltam ${esc(fmtMoney(saleTotal - profile.available))}). Será possível aumentar o limite ao finalizar a venda.`}
      </div>`;
    }
    const warning = reason ? null : limitWarning(profile);

    const modal = document.createElement('div');
    modal.id = 'card-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card card-modal-card" role="dialog" aria-modal="true" aria-label="Cartão da loja">
        <div class="modal-head">
          <div>
            <span class="eyebrow">CARTÃO DA LOJA</span>
            <h3>${esc(cliente.nome || 'Cliente')}</h3>
          </div>
          <button type="button" class="icon-btn" id="card-modal-close" aria-label="Fechar">×</button>
        </div>

        <div class="card-modal-status">
          <span class="card-status ${statusClass}">${esc(statusLabel)}</span>
          <span class="muted">Código ${esc(card.codigo)}</span>
        </div>

        <div class="card-modal-grid">
          <div><small>CPF/CNPJ</small><strong>${esc(display(cliente.cpf_cnpj))}</strong></div>
          <div><small>Telefone</small><strong>${esc(display(cliente.telefone))}</strong></div>
          <div><small>Classificação</small><strong>${esc(profile.score?.classificacao ? String(profile.score.classificacao).replace(/_/g, ' ') : '—')}</strong></div>
          <div><small>Pontuação</small><strong>${profile.score?.pontuacao == null ? '—' : esc(profile.score.pontuacao)}</strong></div>
        </div>

        <div class="card-limit">
          <div class="card-limit-available">
            <small>LIMITE DISPONÍVEL</small>
            <strong>${profile.approved == null ? 'Sem limite aprovado' : esc(fmtMoney(profile.available))}</strong>
          </div>
          <div class="card-limit-bar"><span style="width:${used.toFixed(1)}%"></span></div>
          <div class="card-modal-grid three">
            <div><small>Limite aprovado</small><strong>${profile.approved == null ? '—' : esc(fmtMoney(profile.approved))}</strong>${profile.temp > 0.005 ? `<small class="sub">base ${esc(fmtMoney(profile.base))} + temporário ${esc(fmtMoney(profile.temp))}</small>` : ''}</div>
            <div><small>Em aberto</small><strong>${esc(fmtMoney(profile.openBalance))}</strong></div>
            <div><small>Parcelas vencidas</small><strong class="${profile.overdueCount ? 'bad-text' : ''}">${profile.overdueCount}${profile.overdueCount ? ' · ' + esc(fmtMoney(profile.overdueAmount)) : ''}</strong></div>
          </div>
        </div>

        ${saleLine}
        ${reason ? `<div class="card-alert">⚠ ${esc(reason)}</div>` : ''}
        ${warning ? `<div class="card-sale-check warn">${esc(warning)}</div>` : ''}

        <div class="card-modal-actions">
          <button type="button" class="btn btn-ghost" id="card-modal-cancel">${canApply ? 'Cancelar' : 'Fechar'}</button>
          ${canApply ? `<button type="button" class="btn btn-primary" id="card-modal-use" ${reason ? 'disabled' : ''}>Usar este cartão na venda</button>` : ''}
        </div>
      </div>`;

    document.body.appendChild(modal);

    const close = () => { closeModal(); input.focus(); };
    $('card-modal-close').onclick = close;
    $('card-modal-cancel').onclick = close;
    modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

    if (canApply) {
      const use = $('card-modal-use');
      use.onclick = () => {
        applyCard(card, profile);
        closeModal();
        $('sale-notes')?.focus();
      };
      if (!reason) use.focus();
    }
  }

  /* -------------------------------------------------------
     LEITURA PELA CÂMERA
     Usa BarcodeDetector (Chrome/Edge/Android) e, quando não
     existe (ex.: Safari/iPhone), carrega o ZXing.
     A câmera exige HTTPS ou localhost.
     ------------------------------------------------------- */

  let stopCamera = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Não foi possível carregar o leitor de câmera.'));
      document.head.appendChild(s);
    });
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('A câmera não está disponível. Abra o sistema por HTTPS ou localhost.', 'error');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.id = 'card-scan-modal';
    overlay.innerHTML = `
      <div class="modal-card card-scan-card">
        <div class="modal-head">
          <div><span class="eyebrow">LEITOR DE CÓDIGO DE BARRAS</span><h3>Aponte para o cartão</h3></div>
          <button type="button" class="icon-btn" id="card-scan-close" aria-label="Fechar">×</button>
        </div>
        <div class="card-scan-view"><video id="card-scan-video" playsinline muted></video><div class="card-scan-line"></div></div>
        <p class="muted" id="card-scan-status">Iniciando câmera…</p>
      </div>`;
    document.body.appendChild(overlay);

    const video = $('card-scan-video');
    const status = $('card-scan-status');
    let stopped = false;
    let stream = null;
    let zxingReader = null;

    const finish = () => {
      stopped = true;
      try { zxingReader?.reset(); } catch (_) { /* ignora */ }
      stream?.getTracks().forEach(t => t.stop());
      overlay.remove();
      stopCamera = null;
    };
    stopCamera = finish;
    $('card-scan-close').onclick = finish;

    const onCode = code => {
      if (stopped) return;
      finish();
      input.value = normalizeCode(code);
      lookup(code);
    };

    try {
      if ('BarcodeDetector' in window) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        status.textContent = 'Procurando código de barras…';

        const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code'] });
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            if (found.length) { onCode(found[0].rawValue); return; }
          } catch (_) { /* tenta no próximo quadro */ }
          setTimeout(tick, 200);
        };
        tick();
      } else {
        if (!window.ZXing) {
          await loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js');
        }
        if (stopped) return;
        zxingReader = new ZXing.BrowserMultiFormatReader();
        status.textContent = 'Procurando código de barras…';
        zxingReader.decodeFromVideoDevice(null, 'card-scan-video', result => {
          if (result) onCode(result.getText());
        });
      }
    } catch (error) {
      console.error('[Cartão da loja] Falha na câmera:', error);
      finish();
      toast(error?.name === 'NotAllowedError'
        ? 'Permissão da câmera negada. Libere o acesso no navegador.'
        : (error?.message || 'Não foi possível abrir a câmera.'), 'error');
    }
  }

  scanButton?.addEventListener('click', openCamera);

  /* -------------------------------------------------------
     INTEGRAÇÃO COM A VENDA
     ------------------------------------------------------- */

  typeSelect.addEventListener('change', () => {
    syncUI();
    if (currentMode() === 'cartao_loja' && !currentCard) input.focus();
  });

  // Se escolher outro cliente manualmente (crediário), o cartão deixa de valer.
  clientSelect?.addEventListener('change', () => {
    if (currentCard && String(currentCard.card.cliente_id) !== clientSelect.value) {
      currentCard = null;
      input.value = '';
      renderChip();
    }
  });

  /**
   * Chamado ao finalizar a venda: confirma de novo, direto no banco,
   * que o cartão continua ativo e o cliente sem bloqueio.
   */
  async function revalidate(clienteId) {
    if (!currentCard) throw new Error('Cartão da loja não identificado.');
    if (String(currentCard.card.cliente_id) !== String(clienteId)) {
      throw new Error('O cliente da venda não corresponde ao cartão lido. Leia o cartão novamente.');
    }
    const fresh = await fetchCardByCode(currentCard.card.codigo);
    if (!fresh || fresh.status !== 'ativo') {
      throw new Error('Este cartão não está mais ativo.');
    }
    const profile = await fetchCreditProfile(fresh.cliente_id);
    const reason = blockReason(fresh, profile);
    if (reason) throw new Error(reason);
    currentCard = { card: fresh, profile };
  }

  window.ZER01CartaoLoja = {
    getCard: () => currentCard?.card || null,
    clear: () => { clear(); syncUI(); },
    revalidate
  };

  syncUI();
})();
