/* Pagamentos: registro, atualização da parcela e exclusão com confirmação no Supabase. */

async function loadPayments() {
    try {
        const rows = await supabaseQuery((c) =>
            c
                .from('pagamentos')
                .select('*,parcelas(numero,vendas(descricao,clientes(nome)))')
                .order('data_pagamento', { ascending: false })
        ) || [];

        document.getElementById('payments-table').innerHTML =
            rows.map((p) => `
                <tr>
                    <td>${display(p.parcelas?.vendas?.clientes?.nome)}</td>
                    <td>${p.parcelas?.numero || '—'}</td>
                    <td>${fmtMoney(p.valor)}</td>
                    <td>${dateBR(p.data_pagamento)}</td>
                    <td>${display(p.forma_pagamento)}</td>
                    <td>${display(p.txid || p.id_transacao)}</td>
                    <td>${statusHTML('paga', p.status || 'Confirmado')}</td>
                    <td>
                        <button
                            class="btn btn-danger delete-payment"
                            data-id="${p.id}"
                        >
                            Excluir
                        </button>
                    </td>
                </tr>
            `).join('') ||
            '<tr><td colspan="8" class="empty">Nenhum pagamento registrado.</td></tr>';

        document.querySelectorAll('.delete-payment').forEach((button) => {
            button.onclick = async () => {

                if (!confirm('Excluir este recebimento do histórico?')) {
                    return;
                }

                try {
                    /*
                     * 1. Primeiro buscamos o recebimento
                     * para descobrir qual parcela ele pertence.
                     */
                    const pagamento = await supabaseQuery((c) =>
                        c
                            .from('pagamentos')
                            .select('id, parcela_id')
                            .eq('id', button.dataset.id)
                            .single()
                    );

                    if (!pagamento) {
                        throw new Error('Recebimento não encontrado.');
                    }

                    const parcelaId = pagamento.parcela_id;

                    /*
                     * 2. Excluímos o recebimento.
                     */
                    await supabaseQuery((c) =>
                        c
                            .from('pagamentos')
                            .delete()
                            .eq('id', button.dataset.id)
                    );

                    /*
                     * 3. Buscamos todos os pagamentos restantes
                     * daquela parcela.
                     */
                    const pagamentosRestantes = await supabaseQuery((c) =>
                        c
                            .from('pagamentos')
                            .select('valor')
                            .eq('parcela_id', parcelaId)
                    ) || [];

                    /*
                     * 4. Somamos tudo que ainda foi recebido.
                     */
                    const totalPago = pagamentosRestantes.reduce(
                        (total, pagamento) =>
                            total + Number(pagamento.valor || 0),
                        0
                    );

                    /*
                     * 5. Buscamos o valor original da parcela.
                     */
                    const parcela = await supabaseQuery((c) =>
                        c
                            .from('parcelas')
                            .select('valor')
                            .eq('id', parcelaId)
                            .single()
                    );

                    if (!parcela) {
                        throw new Error('Parcela relacionada não encontrada.');
                    }

                    const valorParcela = Number(parcela.valor || 0);

                    /*
                     * 6. Definimos o novo status.
                     *
                     * Sem nenhum pagamento:
                     * PENDENTE
                     *
                     * Pagamento parcial:
                     * PENDENTE
                     *
                     * Valor total pago:
                     * PAGA
                     */
                    let novoStatus = 'pendente';

                    if (totalPago >= valorParcela) {
                        novoStatus = 'paga';
                    }

                    /*
                     * 7. Atualizamos a parcela.
                     */
                    await supabaseQuery((c) =>
                        c
                            .from('parcelas')
                            .update({
                                status: novoStatus,
                                valor_pago: totalPago,
                                data_pagamento:
                                    totalPago >= valorParcela
                                        ? parcela.data_pagamento
                                        : null
                            })
                            .eq('id', parcelaId)
                    );

                    toast('Recebimento excluído e parcela atualizada.');

                    await loadPayments();

                } catch (error) {
                    console.error(error);
                    toast(
                        error.message || 'Erro ao excluir recebimento.',
                        'error'
                    );
                }
            };
        });

    } catch (error) {
        console.error(error);

        document.getElementById('payments-table').innerHTML =
            '<tr><td colspan="8" class="empty">Configure o Supabase para carregar pagamentos.</td></tr>';
    }
}


async function openPaymentModal() {
    try {
        const parts = await supabaseQuery((c) =>
            c
                .from('parcelas')
                .select('id,numero,valor,vencimento,status,valor_pago,vendas(descricao,clientes(nome))')
                .neq('status', 'paga')
                .order('vencimento')
        ) || [];

        document.getElementById('payment-modal').innerHTML = `
            <div class="modal">
                <form class="modal-card" id="payment-form">

                    <style>
                        .installment-picker { position: relative; }
                        #payment-installment-search {
                            width: 100%;
                            box-sizing: border-box;
                            padding: 10px 12px;
                            border: 1px solid #d0d5dd;
                            border-radius: 8px;
                            font-size: 14px;
                        }
                        .installment-list {
                            margin-top: 8px;
                            max-height: 260px;
                            overflow-y: auto;
                            border: 1px solid #e4e7ec;
                            border-radius: 8px;
                        }
                        .installment-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            gap: 12px;
                            width: 100%;
                            padding: 10px 12px;
                            background: #111;
                            color: #fff;
                            border: none;
                            border-bottom: 1px solid #eef0f3;
                            text-align: left;
                            cursor: pointer;
                            font: inherit;
                        }
                        .installment-item:last-child { border-bottom: none; }
                        .installment-item:hover { background: #111; }
                        .installment-item-main { display: flex; flex-direction: column; gap: 2px; }
                        .installment-item-main strong { font-size: 14px; }
                        .installment-item-desc { font-size: 12px; color: #667085; }
                        .installment-item-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
                        .installment-item-value { font-weight: 600; font-size: 13px; }
                        .installment-badge {
                            font-size: 11px;
                            font-weight: 600;
                            padding: 2px 8px;
                            border-radius: 999px;
                            white-space: nowrap;
                        }
                        .installment-badge--atrasada { background: #111; color: #b91c1c; }
                        .installment-badge--vence-hoje { background: #111; color: #92400e; }
                        .installment-badge--a-vencer { background: #111; color: #075985; }
                        .installment-empty {
                            padding: 16px 12px;
                            text-align: center;
                            color: #667085;
                            font-size: 13px;
                        }
                        .installment-selected {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            gap: 12px;
                            padding: 12px 14px;
                            border: 1px solid #d0d5dd;
                            border-radius: 8px;
                            background: #111;
                        }
                        .installment-selected-label { display: block; font-size: 14px; }
                        .installment-selected-value { font-size: 13px; color: #667085; }
                    </style>

                    <div class="modal-head">
                        <div>
                            <span class="eyebrow">BAIXA FINANCEIRA</span>
                            <h3>Registrar recebimento</h3>
                        </div>

                        <button
                            type="button"
                            class="icon-btn close-payment"
                        >
                            ×
                        </button>
                    </div>

                    <div class="form-grid">

                        <div class="field full">
                            <label>Parcela *</label>

                            <div class="installment-picker" id="installment-picker">

                                <div id="installment-search-wrap">
                                    <input
                                        type="text"
                                        id="payment-installment-search"
                                        placeholder="Buscar por cliente, venda ou nº da parcela..."
                                        autocomplete="off"
                                    >
                                    <div class="installment-list" id="installment-list"></div>
                                </div>

                                <div class="installment-selected" id="installment-selected" style="display:none">
                                    <div>
                                        <strong class="installment-selected-label"></strong><br>
                                        <span class="installment-selected-value"></span>
                                    </div>
                                    <button type="button" class="btn" id="installment-change">
                                        Trocar
                                    </button>
                                </div>

                            </div>
                        </div>

                        <div class="field">
                            <label>Valor recebido *</label>

                            <input
                                id="payment-value"
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                            >
                        </div>

                        <div class="field">
                            <label>Data do recebimento *</label>

                            <input
                                id="payment-date"
                                type="date"
                                value="${todayISO()}"
                                required
                            >
                        </div>

                        <div class="field">
                            <label>Forma de pagamento</label>

                            <select id="payment-method">
                                <option value="dinheiro">Dinheiro</option>
                                <option value="pix">PIX</option>
                                <option value="cartao">Cartão</option>
                                <option value="outros">Outros</option>
                            </select>
                        </div>

                        <div class="field">
                            <label>ID/TxID</label>

                            <input id="payment-txid">
                        </div>

                    </div>

                    <div
                        style="
                            display:flex;
                            justify-content:end;
                            gap:8px;
                            margin-top:22px
                        "
                    >
                        <button
                            type="button"
                            class="btn close-payment"
                        >
                            Cancelar
                        </button>

                        <button
                            class="btn btn-primary"
                            type="submit"
                        >
                            Salvar recebimento
                        </button>
                    </div>

                </form>
            </div>
        `;

        document.querySelectorAll('.close-payment').forEach((button) => {
            button.onclick = () => {
                document.getElementById('payment-modal').innerHTML = '';
            };
        });


        /*
         * Busca/seleção de parcela.
         *
         * Em vez de um <select> só com texto corrido,
         * mostramos uma lista filtrável (por cliente,
         * venda ou nº da parcela) com selo de urgência
         * (atrasada / vence hoje / a vencer) para facilitar
         * achar a parcela certa.
         */
        let selectedParcela = null;

        function statusParcela(vencimento) {
            const hoje = new Date(`${todayISO()}T00:00:00`);
            const venc = new Date(`${vencimento}T00:00:00`);
            const diffDias = Math.round((venc - hoje) / 86400000);

            if (diffDias < 0) {
                const dias = Math.abs(diffDias);
                return {
                    classe: 'atrasada',
                    label: `Atrasada há ${dias} dia${dias === 1 ? '' : 's'}`
                };
            }

            if (diffDias === 0) {
                return { classe: 'vence-hoje', label: 'Vence hoje' };
            }

            return {
                classe: 'a-vencer',
                label: `Vence em ${diffDias} dia${diffDias === 1 ? '' : 's'}`
            };
        }

        function renderInstallmentList(filterText) {
            const termo = (filterText || '').trim().toLowerCase();

            const filtradas = parts.filter((p) => {
                if (!termo) return true;

                const cliente = (p.vendas?.clientes?.nome || '').toLowerCase();
                const descricao = (p.vendas?.descricao || '').toLowerCase();
                const numero = String(p.numero || '');

                return (
                    cliente.includes(termo) ||
                    descricao.includes(termo) ||
                    numero.includes(termo)
                );
            });

            const lista = document.getElementById('installment-list');

            if (!filtradas.length) {
                lista.innerHTML =
                    '<div class="installment-empty">Nenhuma parcela encontrada.</div>';
                return;
            }

            lista.innerHTML = filtradas.map((p) => {
                const restante = Number(p.valor || 0) - Number(p.valor_pago || 0);
                const status = statusParcela(p.vencimento);
                const cliente = display(p.vendas?.clientes?.nome);

                return `
                    <button
                        type="button"
                        class="installment-item"
                        data-id="${p.id}"
                        data-value="${restante}"
                        data-label="${cliente} — parcela ${p.numero}"
                    >
                        <div class="installment-item-main">
                            <strong>${cliente}</strong>
                            <span class="installment-item-desc">
                                ${display(p.vendas?.descricao)}
                                · parcela ${p.numero}
                                · vence ${dateBR(p.vencimento)}
                            </span>
                        </div>
                        <div class="installment-item-side">
                            <span class="installment-badge installment-badge--${status.classe}">
                                ${status.label}
                            </span>
                            <span class="installment-item-value">
                                ${fmtMoney(restante)}
                            </span>
                        </div>
                    </button>
                `;
            }).join('');

            lista.querySelectorAll('.installment-item').forEach((item) => {
                item.onclick = () => selecionarParcela(item);
            });
        }

        function selecionarParcela(item) {
            selectedParcela = {
                id: item.dataset.id,
                valor: item.dataset.value
            };

            document.getElementById('payment-value').value =
                item.dataset.value;

            const selecionado = document.getElementById('installment-selected');
            selecionado.querySelector('.installment-selected-label').textContent =
                item.dataset.label;
            selecionado.querySelector('.installment-selected-value').textContent =
                `Falta receber: ${fmtMoney(Number(item.dataset.value))}`;
            selecionado.style.display = 'flex';

            document.getElementById('installment-search-wrap').style.display = 'none';
        }

        renderInstallmentList('');

        document.getElementById('payment-installment-search').oninput =
            (event) => renderInstallmentList(event.target.value);

        document.getElementById('installment-change').onclick = () => {
            selectedParcela = null;

            document.getElementById('installment-selected').style.display = 'none';
            document.getElementById('installment-search-wrap').style.display = 'block';

            const busca = document.getElementById('payment-installment-search');
            busca.value = '';
            busca.focus();

            renderInstallmentList('');
        };


        document.getElementById('payment-form').onsubmit =
            async (event) => {

                event.preventDefault();

                try {

                    const parcelaId = selectedParcela?.id || '';

                    const value =
                        Number(
                            document.getElementById(
                                'payment-value'
                            ).value
                        );

                    const dataPagamento =
                        document.getElementById(
                            'payment-date'
                        ).value;

                    const formaPagamento =
                        document.getElementById(
                            'payment-method'
                        ).value;

                    const txid =
                        document.getElementById(
                            'payment-txid'
                        ).value.trim();


                    if (!parcelaId || value <= 0) {
                        throw new Error(
                            'Selecione uma parcela e informe um valor válido.'
                        );
                    }


                    /*
                     * 1. Busca a parcela atual.
                     */
                    const parcela = await supabaseQuery((c) =>
                        c
                            .from('parcelas')
                            .select('id,valor,valor_pago')
                            .eq('id', parcelaId)
                            .single()
                    );

                    if (!parcela) {
                        throw new Error('Parcela não encontrada.');
                    }


                    /*
                     * 2. Calcula quanto já foi pago.
                     */
                    const valorJaPago =
                        Number(parcela.valor_pago || 0);

                    const valorParcela =
                        Number(parcela.valor || 0);


                    /*
                     * 3. Impede receber mais do que falta.
                     */
                    const valorRestante =
                        valorParcela - valorJaPago;

                    if (value > valorRestante + 0.01) {
                        throw new Error(
                            `O valor máximo para esta parcela é ${fmtMoney(valorRestante)}.`
                        );
                    }


                    /*
                     * 4. Registra o recebimento.
                     */
                    await supabaseQuery((c) =>
                        c
                            .from('pagamentos')
                            .insert({
                                parcela_id: parcelaId,
                                valor: value,
                                data_pagamento: dataPagamento,
                                forma_pagamento: formaPagamento,
                                id_transacao: txid || null,
                                status: 'confirmado'
                            })
                    );


                    /*
                     * 5. Soma o pagamento novo
                     * ao que já havia sido pago.
                     */
                    const novoTotalPago =
                        valorJaPago + value;


                    /*
                     * 6. Define o status correto.
                     */
                    const novoStatus =
                        novoTotalPago >= valorParcela
                            ? 'paga'
                            : 'pendente';


                    /*
                     * 7. Atualiza a parcela.
                     */
                    await supabaseQuery((c) =>
                        c
                            .from('parcelas')
                            .update({
                                status: novoStatus,
                                valor_pago: novoTotalPago,
                                data_pagamento:
                                    novoStatus === 'paga'
                                        ? dataPagamento
                                        : null
                            })
                            .eq('id', parcelaId)
                    );


                    toast(
                        novoStatus === 'paga'
                            ? 'Recebimento registrado. Parcela quitada.'
                            : 'Recebimento parcial registrado.'
                    );

                    document.getElementById(
                        'payment-modal'
                    ).innerHTML = '';

                    await loadPayments();

                } catch (error) {

                    console.error(error);

                    toast(
                        error.message ||
                        'Erro ao registrar recebimento.',
                        'error'
                    );
                }
            };

    } catch (error) {

        console.error(error);

        toast(
            'Não foi possível carregar as parcelas em aberto.',
            'error'
        );
    }
}


document
    .getElementById('new-payment')
    ?.addEventListener('click', openPaymentModal);

loadPayments();
