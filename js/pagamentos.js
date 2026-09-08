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

                            <select id="payment-installment" required>
                                <option value="">
                                    Selecione uma parcela
                                </option>

                                ${parts.map((p) => `
                                    <option
                                        value="${p.id}"
                                        data-value="${Number(p.valor || 0) - Number(p.valor_pago || 0)}"
                                    >
                                        ${p.vendas?.clientes?.nome || 'Cliente'}
                                        —
                                        parcela ${p.numero}
                                        —
                                        ${fmtMoney(
                                            Number(p.valor || 0) -
                                            Number(p.valor_pago || 0)
                                        )}
                                        —
                                        vence ${dateBR(p.vencimento)}
                                    </option>
                                `).join('')}
                            </select>
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
         * Ao selecionar uma parcela,
         * preenche automaticamente somente
         * o valor que ainda falta pagar.
         */
        document.getElementById('payment-installment').onchange =
            (event) => {

                const option = event.target.selectedOptions[0];

                document.getElementById('payment-value').value =
                    option?.dataset.value || '';
            };


        document.getElementById('payment-form').onsubmit =
            async (event) => {

                event.preventDefault();

                try {

                    const parcelaId =
                        document.getElementById(
                            'payment-installment'
                        ).value;

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
