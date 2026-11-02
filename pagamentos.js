/*
 * ZER01 — Pagamentos
 *
 * Fluxo:
 * 1. Mostra as parcelas em aberto para baixa rápida.
 * 2. Permite buscar por cliente, CPF ou telefone.
 * 3. Permite filtrar por hoje, atrasados e próximos.
 * 4. O recebimento é iniciado pelo cliente e depois pelas parcelas.
 * 5. Uma ou várias parcelas podem ser quitadas no mesmo recebimento.
 * 6. O histórico continua permitindo exclusão com recálculo da parcela.
 */

let openInstallments = [];
let selectedPaymentClient = null;
let selectedPaymentParts = [];
let currentOpenFilter = 'todos';


function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}


function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
}


function todayLocalISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();

    return new Date(
        now.getTime() - offset * 60000
    )
        .toISOString()
        .slice(0, 10);
}


function dateDiffFromToday(dateISO) {
    if (!dateISO) return 0;

    const today =
        new Date(
            todayLocalISO() + 'T00:00:00'
        );

    const date =
        new Date(
            String(dateISO).slice(0, 10) +
            'T00:00:00'
        );

    return Math.round(
        (date - today) / 86400000
    );
}


function openPartStatus(part) {

    const diff =
        dateDiffFromToday(
            part.vencimento
        );

    if (diff < 0) {

        return {
            key: 'atrasados',

            label:
                `Atrasada há ${Math.abs(diff)} ${
                    Math.abs(diff) === 1
                        ? 'dia'
                        : 'dias'
                }`,

            className: 'overdue'
        };
    }

    if (diff === 0) {

        return {
            key: 'hoje',
            label: 'Vence hoje',
            className: 'today'
        };
    }

    return {
        key: 'proximos',
        label: 'Em aberto',
        className: 'next'
    };
}


function getPartRemaining(part) {

    return Math.max(
        0,

        Number(part.valor || 0) -
        Number(part.valor_pago || 0)
    );
}


function clientFromPart(part) {

    return (
        part?.vendas?.clientes ||
        {}
    );
}


function clientName(part) {

    return (
        clientFromPart(part)?.nome ||
        'Cliente'
    );
}


function clientSearchText(part) {

    const client =
        clientFromPart(part);

    return [
        client.nome,
        client.cpf,
        client.telefone,
        digitsOnly(client.cpf),
        digitsOnly(client.telefone)
    ]
        .map(normalizeText)
        .join(' ');
}


function getClientKey(part) {

    const client =
        clientFromPart(part);

    return (
        client.id ||
        client.cpf ||
        client.telefone ||
        client.nome ||
        ''
    );
}


function groupOpenPartsByClient(parts) {

    const groups =
        new Map();

    parts.forEach((part) => {

        const client =
            clientFromPart(part);

        const key =
            client.id ||
            client.cpf ||
            client.telefone ||
            client.nome ||
            `cliente-${part.id}`;

        if (!groups.has(key)) {

            groups.set(key, {

                key,

                client,

                parts: []

            });
        }

        groups
            .get(key)
            .parts
            .push(part);
    });

    return Array.from(
        groups.values()
    );
}


function filteredOpenInstallments() {

    const searchInput =
        document.getElementById(
            'open-payment-search'
        );

    const search =
        normalizeText(
            searchInput?.value || ''
        );

    return openInstallments.filter(
        (part) => {

            const status =
                openPartStatus(part);

            const matchesFilter =
                currentOpenFilter === 'todos' ||
                status.key === currentOpenFilter;

            if (!matchesFilter) {
                return false;
            }

            if (!search) {
                return true;
            }

            const text =
                clientSearchText(part);

            return (
                text.includes(search) ||
                text.includes(
                    digitsOnly(search)
                )
            );
        }
    );
}


function renderOpenInstallments() {

    const target =
        document.getElementById(
            'open-payments-table'
        );

    if (!target) return;

    const parts =
        filteredOpenInstallments();

    if (!parts.length) {

        target.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="empty-open"
                >
                    Nenhuma parcela encontrada
                    para este filtro.
                </td>
            </tr>
        `;

        return;
    }

    target.innerHTML =
        parts.map((part) => {

            const status =
                openPartStatus(part);

            const remaining =
                getPartRemaining(part);

            const client =
                clientFromPart(part);

            return `
                <tr>

                    <td class="client-cell">

                        <span class="client-name">
                            ${display(
                                client.nome ||
                                'Cliente'
                            )}
                        </span>

                        ${
                            client.telefone
                                ? `
                                    <span class="client-meta">
                                        ${display(
                                            client.telefone
                                        )}
                                    </span>
                                `
                                : ''
                        }

                    </td>

                    <td>

                        <span
                            class="installment-number"
                        >
                            ${part.numero || '—'}
                        </span>

                    </td>

                    <td>

                        <span
                            class="due-date ${status.className}"
                        >
                            ${dateBR(
                                part.vencimento
                            )}
                        </span>

                    </td>

                    <td>
                        <strong>
                            ${fmtMoney(
                                remaining
                            )}
                        </strong>
                    </td>

                    <td>

                        <span
                            class="open-status ${status.className}"
                        >
                            ${status.label}
                        </span>

                    </td>

                    <td>

                        <button
                            type="button"
                            class="btn btn-primary btn-receive receive-open-payment"
                            data-part-id="${part.id}"
                        >
                            Receber
                        </button>

                    </td>

                </tr>
            `;

        }).join('');


    document
        .querySelectorAll(
            '.receive-open-payment'
        )
        .forEach((button) => {

            button.onclick = () => {

                const part =
                    openInstallments.find(
                        (item) =>
                            String(item.id) ===
                            String(
                                button.dataset.partId
                            )
                    );

                if (!part) return;

                openPaymentModal({

                    clientKey:
                        getClientKey(part),

                    partId:
                        part.id

                });
            };
        });
}


function updateOpenSummary() {

    const summary =
        document.getElementById(
            'open-summary'
        );

    if (!summary) return;

    const total =
        openInstallments.reduce(
            (sum, part) =>
                sum +
                getPartRemaining(part),

            0
        );

    summary.innerHTML = `

        <strong>
            ${openInstallments.length}
        </strong>

        ${
            openInstallments.length === 1
                ? 'parcela'
                : 'parcelas'
        }

        em aberto

        <br>

        <strong>
            ${fmtMoney(total)}
        </strong>

        a receber
    `;
}


async function loadOpenInstallments() {

    try {

        openInstallments =
            await supabaseQuery((c) =>
                c
                    .from('parcelas')
                    .select(`
                        id,
                        numero,
                        valor,
                        vencimento,
                        status,
                        valor_pago,
                        vendas(
                            descricao,
                            clientes(
                                id,
                                nome,
                                cpf,
                                telefone
                            )
                        )
                    `)
                    .neq(
                        'status',
                        'paga'
                    )
                    .order(
                        'vencimento',
                        {
                            ascending: true
                        }
                    )
            ) || [];

        updateOpenSummary();

        renderOpenInstallments();

    } catch (error) {

        console.error(error);

        openInstallments = [];

        const target =
            document.getElementById(
                'open-payments-table'
            );

        if (target) {

            target.innerHTML = `
                <tr>

                    <td
                        colspan="6"
                        class="empty-open"
                    >
                        Não foi possível carregar
                        as parcelas em aberto.
                    </td>

                </tr>
            `;
        }

        const summary =
            document.getElementById(
                'open-summary'
            );

        if (summary) {

            summary.textContent =
                'Erro ao carregar';
        }
    }
}


async function loadPayments() {

    try {

        const rows =
            await supabaseQuery((c) =>
                c
                    .from('pagamentos')
                    .select(`
                        *,
                        parcelas(
                            numero,
                            vencimento,
                            valor,
                            vendas(
                                descricao,
                                clientes(nome)
                            )
                        )
                    `)
                    .order(
                        'data_pagamento',
                        {
                            ascending: false
                        }
                    )
            ) || [];


        document.getElementById(
            'payments-table'
        ).innerHTML =

            rows.map((p) => `

                <tr>

                    <td>
                        ${display(
                            p.parcelas
                                ?.vendas
                                ?.clientes
                                ?.nome
                        )}
                    </td>

                    <td>
                        ${
                            p.parcelas?.numero ||
                            '—'
                        }
                    </td>

                    <td>
                        ${fmtMoney(p.valor)}
                    </td>

                    <td>
                        ${dateBR(
                            p.data_pagamento
                        )}
                    </td>

                    <td>
                        ${display(
                            p.forma_pagamento
                        )}
                    </td>

                    <td>
                        ${display(
                            p.txid ||
                            p.id_transacao
                        )}
                    </td>

                    <td>
                        ${statusHTML(
                            'paga',
                            p.status ||
                            'Confirmado'
                        )}
                    </td>

                    <td>

                        <button
                            class="btn btn-danger delete-payment"
                            data-id="${p.id}"
                        >
                            Excluir
                        </button>

                    </td>

                </tr>

            `).join('')

            ||

            `
                <tr>
                    <td
                        colspan="8"
                        class="empty"
                    >
                        Nenhum pagamento registrado.
                    </td>
                </tr>
            `;


        document
            .querySelectorAll(
                '.delete-payment'
            )
            .forEach((button) => {

                button.onclick =
                    async () => {

                        if (
                            !confirm(
                                'Excluir este recebimento do histórico?'
                            )
                        ) {
                            return;
                        }

                        try {

                            const pagamento =
                                await supabaseQuery(
                                    (c) =>
                                        c
                                            .from(
                                                'pagamentos'
                                            )
                                            .select(
                                                'id, parcela_id'
                                            )
                                            .eq(
                                                'id',
                                                button.dataset.id
                                            )
                                            .single()
                                );


                            if (!pagamento) {

                                throw new Error(
                                    'Recebimento não encontrado.'
                                );
                            }


                            const parcelaId =
                                pagamento.parcela_id;


                            await supabaseQuery(
                                (c) =>
                                    c
                                        .from(
                                            'pagamentos'
                                        )
                                        .delete()
                                        .eq(
                                            'id',
                                            button.dataset.id
                                        )
                            );


                            const pagamentosRestantes =
                                await supabaseQuery(
                                    (c) =>
                                        c
                                            .from(
                                                'pagamentos'
                                            )
                                            .select(
                                                'valor'
                                            )
                                            .eq(
                                                'parcela_id',
                                                parcelaId
                                            )
                                ) || [];


                            const totalPago =
                                pagamentosRestantes.reduce(
                                    (
                                        total,
                                        pagamento
                                    ) =>
                                        total +
                                        Number(
                                            pagamento.valor ||
                                            0
                                        ),

                                    0
                                );


                            const parcela =
                                await supabaseQuery(
                                    (c) =>
                                        c
                                            .from(
                                                'parcelas'
                                            )
                                            .select(
                                                'valor'
                                            )
                                            .eq(
                                                'id',
                                                parcelaId
                                            )
                                            .single()
                                );


                            if (!parcela) {

                                throw new Error(
                                    'Parcela relacionada não encontrada.'
                                );
                            }


                            const valorParcela =
                                Number(
                                    parcela.valor ||
                                    0
                                );


                            let novoStatus =
                                'pendente';


                            if (
                                totalPago >=
                                valorParcela
                            ) {

                                novoStatus =
                                    'paga';
                            }


                            await supabaseQuery(
                                (c) =>
                                    c
                                        .from(
                                            'parcelas'
                                        )
                                        .update({

                                            status:
                                                novoStatus,

                                            valor_pago:
                                                totalPago,

                                            data_pagamento:
                                                totalPago >=
                                                valorParcela
                                                    ? parcela.data_pagamento
                                                    : null

                                        })
                                        .eq(
                                            'id',
                                            parcelaId
                                        )
                            );


                            toast(
                                'Recebimento excluído e parcela atualizada.'
                            );


                            await Promise.all([
                                loadPayments(),
                                loadOpenInstallments()
                            ]);

                        } catch (error) {

                            console.error(error);

                            toast(
                                error.message ||
                                'Erro ao excluir recebimento.',
                                'error'
                            );
                        }
                    };
            });

    } catch (error) {

        console.error(error);

        document.getElementById(
            'payments-table'
        ).innerHTML = `
            <tr>

                <td
                    colspan="8"
                    class="empty"
                >
                    Configure o Supabase
                    para carregar pagamentos.
                </td>

            </tr>
        `;
    }
}


function renderClientResults(searchValue) {

    const results =
        document.getElementById(
            'client-results'
        );

    if (!results) return;

    const search =
        normalizeText(
            searchValue
        );

    const groups =
        groupOpenPartsByClient(
            openInstallments
        );


    let filtered =
        groups.filter(
            (group) => {

                if (!search) {
                    return true;
                }

                const client =
                    group.client;

                const text = [
                    client.nome,
                    client.cpf,
                    client.telefone,
                    digitsOnly(
                        client.cpf
                    ),
                    digitsOnly(
                        client.telefone
                    )
                ]
                    .map(normalizeText)
                    .join(' ');

                return (
                    text.includes(search) ||
                    text.includes(
                        digitsOnly(search)
                    )
                );
            }
        );


    filtered =
        filtered.slice(0, 10);


    if (!filtered.length) {

        results.innerHTML = `
            <div class="client-result-empty">
                Nenhum cliente encontrado.
            </div>
        `;

        results.classList.add(
            'visible'
        );

        return;
    }


    results.innerHTML =
        filtered.map((group) => {

            const client =
                group.client;

            const total =
                group.parts.reduce(
                    (sum, part) =>
                        sum +
                        getPartRemaining(part),

                    0
                );


            return `

                <button
                    type="button"
                    class="client-result"
                    data-client-key="${String(
                        group.key
                    ).replace(
                        /"/g,
                        '&quot;'
                    )}"
                >

                    <span class="client-result-main">

                        <strong>
                            ${display(
                                client.nome ||
                                'Cliente'
                            )}
                        </strong>

                        ${
                            client.cpf
                                ? `
                                    <small>
                                        CPF/CNPJ:
                                        ${display(
                                            client.cpf
                                        )}
                                    </small>
                                `
                                : ''
                        }

                        ${
                            client.telefone
                                ? `
                                    <small>
                                        ${display(
                                            client.telefone
                                        )}
                                    </small>
                                `
                                : ''
                        }

                    </span>

                    <span class="client-result-side">

                        <strong>
                            ${group.parts.length}
                            ${
                                group.parts.length === 1
                                    ? 'parcela'
                                    : 'parcelas'
                            }
                        </strong>

                        <small>
                            ${fmtMoney(total)}
                        </small>

                    </span>

                </button>

            `;

        }).join('');


    results
        .querySelectorAll(
            '.client-result'
        )
        .forEach((button) => {

            button.onclick = () => {

                selectPaymentClient(
                    button.dataset.clientKey
                );
            };
        });


    results.classList.add(
        'visible'
    );
}


function clearPaymentClient() {

    selectedPaymentClient =
        null;

    selectedPaymentParts =
        [];


    const selectedBox =
        document.getElementById(
            'selected-client'
        );

    if (selectedBox) {

        selectedBox.innerHTML = `
            <div class="selected-client-placeholder">
                Selecione um cliente para
                visualizar as parcelas.
            </div>
        `;
    }


    const list =
        document.getElementById(
            'installment-list'
        );

    if (list) {

        list.innerHTML = `
            <div class="installment-empty">
                Primeiro selecione um cliente.
            </div>
        `;
    }


    const formGrid =
        document.getElementById(
            'payment-form-grid'
        );

    if (formGrid) {

        formGrid.classList.add(
            'hidden'
        );
    }


    updateReceiptSummary();


    const results =
        document.getElementById(
            'client-results'
        );

    if (results) {

        results.classList.remove(
            'visible'
        );
    }
}


function selectPaymentClient(
    clientKey,
    preferredPartId = null
) {

    const group =
        groupOpenPartsByClient(
            openInstallments
        ).find(
            (item) =>
                String(item.key) ===
                String(clientKey)
        );


    if (!group) {

        toast(
            'Cliente não encontrado.',
            'error'
        );

        return;
    }


    selectedPaymentClient =
        group;


    selectedPaymentParts =
        [];


    const search =
        document.getElementById(
            'payment-client-search'
        );

    if (search) {

        search.value =
            group.client.nome ||
            '';
    }


    const results =
        document.getElementById(
            'client-results'
        );

    if (results) {

        results.classList.remove(
            'visible'
        );
    }


    renderSelectedClient();


    renderPaymentInstallments(
        preferredPartId
    );


    updateReceiptSummary();
}


function renderSelectedClient() {

    const box =
        document.getElementById(
            'selected-client'
        );

    if (!box ||
        !selectedPaymentClient
    ) {
        return;
    }


    const client =
        selectedPaymentClient.client;

    const parts =
        selectedPaymentClient.parts;


    const total =
        parts.reduce(
            (sum, part) =>
                sum +
                getPartRemaining(part),

            0
        );


    box.innerHTML = `

        <div class="selected-client-card">

            <div class="selected-client-info">

                <span class="selected-client-label">
                    CLIENTE SELECIONADO
                </span>

                <strong>
                    ${display(
                        client.nome ||
                        'Cliente'
                    )}
                </strong>

                <div class="selected-client-meta">

                    ${
                        client.cpf
                            ? `
                                <span>
                                    CPF/CNPJ:
                                    ${display(
                                        client.cpf
                                    )}
                                </span>
                            `
                            : ''
                    }

                    ${
                        client.telefone
                            ? `
                                <span>
                                    ${display(
                                        client.telefone
                                    )}
                                </span>
                            `
                            : ''
                    }

                </div>

            </div>

            <div class="selected-client-debt">

                <span>
                    ${parts.length}
                    ${
                        parts.length === 1
                            ? 'parcela'
                            : 'parcelas'
                    }
                    em aberto
                </span>

                <strong>
                    ${fmtMoney(total)}
                </strong>

            </div>

            <button
                type="button"
                class="icon-btn change-client"
                title="Trocar cliente"
            >
                ×
            </button>

        </div>
    `;


    box
        .querySelector(
            '.change-client'
        )
        ?.addEventListener(
            'click',
            () => {

                clearPaymentClient();

                const input =
                    document.getElementById(
                        'payment-client-search'
                    );

                input?.focus();
            }
        );
}


function renderPaymentInstallments(
    preferredPartId = null
) {

    const list =
        document.getElementById(
            'installment-list'
        );

    if (!list ||
        !selectedPaymentClient
    ) {
        return;
    }


    const parts =
        [...selectedPaymentClient.parts]
            .sort(
                (a, b) =>
                    String(
                        a.vencimento || ''
                    ).localeCompare(
                        String(
                            b.vencimento || ''
                        )
                    )
            );


    if (!parts.length) {

        list.innerHTML = `
            <div class="installment-empty">
                Este cliente não possui
                parcelas em aberto.
            </div>
        `;

        return;
    }


    list.innerHTML =
        parts.map((part) => {

            const remaining =
                getPartRemaining(part);

            const status =
                openPartStatus(part);

            const checked =
                preferredPartId &&
                String(
                    preferredPartId
                ) ===
                String(part.id);


            return `

                <div
                    class="installment-row ${checked ? 'selected' : ''}"
                    data-part-id="${part.id}"
                >

                    <label
                        class="installment-check"
                    >

                        <input
                            type="checkbox"
                            class="payment-part-checkbox"
                            data-part-id="${part.id}"
                            ${checked ? 'checked' : ''}
                        >

                        <span class="custom-check"></span>

                    </label>


                    <div class="installment-main">

                        <div class="installment-title">

                            <strong>
                                Parcela ${part.numero}
                            </strong>

                            <span
                                class="open-status ${status.className}"
                            >
                                ${status.label}
                            </span>

                        </div>

                        <span class="installment-date">
                            Vencimento:
                            ${dateBR(
                                part.vencimento
                            )}
                        </span>

                    </div>


                    <div class="installment-value">

                        <span>
                            Restante
                        </span>

                        <strong>
                            ${fmtMoney(
                                remaining
                            )}
                        </strong>

                    </div>


                    <div class="installment-payment-value">

                        <label>
                            Receber
                        </label>

                        <input
                            type="number"
                            class="payment-part-value"
                            data-part-id="${part.id}"
                            value="${
                                checked
                                    ? remaining.toFixed(2)
                                    : remaining.toFixed(2)
                            }"
                            min="0.01"
                            max="${remaining.toFixed(2)}"
                            step="0.01"
                            ${checked ? '' : 'disabled'}
                        >

                    </div>

                </div>

            `;

        }).join('');


    list
        .querySelectorAll(
            '.payment-part-checkbox'
        )
        .forEach((checkbox) => {

            checkbox.addEventListener(
                'change',
                () => {

                    const row =
                        checkbox.closest(
                            '.installment-row'
                        );

                    const valueInput =
                        row.querySelector(
                            '.payment-part-value'
                        );


                    if (checkbox.checked) {

                        row.classList.add(
                            'selected'
                        );

                        valueInput.disabled =
                            false;

                    } else {

                        row.classList.remove(
                            'selected'
                        );

                        valueInput.disabled =
                            true;
                    }


                    updateReceiptSummary();
                }
            );
        });


    list
        .querySelectorAll(
            '.payment-part-value'
        )
        .forEach((input) => {

            input.addEventListener(
                'input',
                updateReceiptSummary
            );
        });


    updateReceiptSummary();
}


function getSelectedInstallments() {

    const list =
        document.getElementById(
            'installment-list'
        );

    if (!list) return [];


    return Array.from(
        list.querySelectorAll(
            '.payment-part-checkbox:checked'
        )
    )
        .map((checkbox) => {

            const partId =
                checkbox.dataset.partId;

            const part =
                selectedPaymentClient.parts.find(
                    (item) =>
                        String(item.id) ===
                        String(partId)
                );


            const valueInput =
                list.querySelector(
                    `.payment-part-value[data-part-id="${partId}"]`
                );


            const amount =
                Number(
                    valueInput?.value || 0
                );


            return {
                part,
                amount
            };

        })
        .filter(
            (item) =>
                item.part
        );
}


function updateReceiptSummary() {

    const selected =
        getSelectedInstallments();


    const count =
        document.getElementById(
            'receipt-count'
        );

    const total =
        document.getElementById(
            'receipt-total'
        );


    const formGrid =
        document.getElementById(
            'payment-form-grid'
        );


    if (count) {

        count.textContent =
            selected.length;
    }


    const totalValue =
        selected.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.amount || 0
                ),

            0
        );


    if (total) {

        total.textContent =
            fmtMoney(
                totalValue
            );
    }


    if (formGrid) {

        if (
            selected.length > 0
        ) {

            formGrid.classList.remove(
                'hidden'
            );

        } else {

            formGrid.classList.add(
                'hidden'
            );
        }
    }
}


function selectAllPaymentParts() {

    const list =
        document.getElementById(
            'installment-list'
        );

    if (!list) return;


    list
        .querySelectorAll(
            '.payment-part-checkbox'
        )
        .forEach((checkbox) => {

            checkbox.checked =
                true;

            const row =
                checkbox.closest(
                    '.installment-row'
                );

            const valueInput =
                row.querySelector(
                    '.payment-part-value'
                );

            row.classList.add(
                'selected'
            );

            valueInput.disabled =
                false;
        });


    updateReceiptSummary();
}


function selectNextPaymentPart() {

    const list =
        document.getElementById(
            'installment-list'
        );

    if (!list ||
        !selectedPaymentClient
    ) {
        return;
    }


    const checkbox =
        list.querySelector(
            '.payment-part-checkbox:not(:checked)'
        );


    if (!checkbox) {

        toast(
            'Todas as parcelas já estão selecionadas.'
        );

        return;
    }


    checkbox.checked =
        true;


    const row =
        checkbox.closest(
            '.installment-row'
        );


    const valueInput =
        row.querySelector(
            '.payment-part-value'
        );


    row.classList.add(
        'selected'
    );

    valueInput.disabled =
        false;


    updateReceiptSummary();
}


async function openPaymentModal(
    options = {}
) {

    try {

        if (!openInstallments.length) {

            await loadOpenInstallments();
        }


        document.getElementById(
            'payment-modal'
        ).innerHTML = `

            <div class="modal">

                <form
                    class="modal-card payment-modal-card"
                    id="payment-form"
                >

                    <div class="modal-head">

                        <div>

                            <span class="eyebrow">
                                BAIXA FINANCEIRA
                            </span>

                            <h3>
                                Registrar recebimento
                            </h3>

                        </div>


                        <button
                            type="button"
                            class="icon-btn close-payment"
                        >
                            ×
                        </button>

                    </div>


                    <div class="payment-client-section">

                        <label
                            class="payment-section-label"
                        >
                            Cliente
                        </label>


                        <div class="client-search-wrap">

                            <span
                                class="client-search-icon"
                            >
                                🔍
                            </span>

                            <input
                                id="payment-client-search"
                                type="text"
                                autocomplete="off"
                                placeholder="Digite nome, CPF ou telefone..."
                            >

                        </div>


                        <div
                            id="client-results"
                            class="client-results"
                        ></div>


                        <div
                            id="selected-client"
                            class="selected-client-container"
                        ></div>

                    </div>


                    <div class="payment-installments-section">

                        <div class="payment-section-head">

                            <div>

                                <label
                                    class="payment-section-label"
                                >
                                    Parcelas em aberto
                                </label>

                                <span
                                    class="payment-section-help"
                                >
                                    Selecione uma ou várias
                                    parcelas para receber.
                                </span>

                            </div>


                            <div class="installment-actions">

                                <button
                                    type="button"
                                    class="installment-action"
                                    id="select-next-part"
                                >
                                    Próxima parcela
                                </button>

                                <button
                                    type="button"
                                    class="installment-action"
                                    id="select-all-parts"
                                >
                                    Selecionar todas
                                </button>

                            </div>

                        </div>


                        <div
                            id="installment-list"
                            class="installment-list"
                        ></div>

                    </div>


                    <div
                        id="receipt-summary"
                        class="receipt-summary"
                    >

                        <div class="receipt-summary-card">

                            <span>
                                Parcelas selecionadas
                            </span>

                            <strong id="receipt-count">
                                0
                            </strong>

                        </div>


                        <div class="receipt-summary-card">

                            <span>
                                Total do recebimento
                            </span>

                            <strong id="receipt-total">
                                R$ 0,00
                            </strong>

                        </div>

                    </div>


                    <div
                        id="payment-form-grid"
                        class="form-grid payment-form-grid hidden"
                    >

                        <div class="field">

                            <label>
                                Data do recebimento *
                            </label>

                            <input
                                id="payment-date"
                                type="date"
                                value="${todayISO()}"
                                required
                            >

                        </div>


                        <div class="field">

                            <label>
                                Forma de pagamento
                            </label>

                            <select
                                id="payment-method"
                            >

                                <option value="dinheiro">
                                    Dinheiro
                                </option>

                                <option value="pix">
                                    PIX
                                </option>

                                <option value="cartao">
                                    Cartão
                                </option>

                                <option value="outros">
                                    Outros
                                </option>

                            </select>

                        </div>


                        <div class="field full">

                            <label>
                                ID/TxID
                                <span
                                    style="font-weight:400;color:#777e88"
                                >
                                    (opcional)
                                </span>
                            </label>

                            <input
                                id="payment-txid"
                                placeholder="Se houver, informe o código da transação"
                            >

                        </div>

                    </div>


                    <div
                        style="
                            display:flex;
                            justify-content:flex-end;
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
                            Registrar recebimento
                        </button>

                    </div>

                </form>

            </div>
        `;


        document
            .querySelectorAll(
                '.close-payment'
            )
            .forEach((button) => {

                button.onclick = () => {

                    document.getElementById(
                        'payment-modal'
                    ).innerHTML = '';
                };
            });


        const clientInput =
            document.getElementById(
                'payment-client-search'
            );


        clientInput.oninput =
            () => {

                if (
                    selectedPaymentClient
                ) {

                    clearPaymentClient();
                }

                renderClientResults(
                    clientInput.value
                );
            };


        clientInput.onfocus =
            () => {

                if (
                    clientInput.value &&
                    !selectedPaymentClient
                ) {

                    renderClientResults(
                        clientInput.value
                    );
                }
            };


        document.getElementById(
            'select-all-parts'
        ).onclick =
            selectAllPaymentParts;


        document.getElementById(
            'select-next-part'
        ).onclick =
            selectNextPaymentPart;


        document.getElementById(
            'payment-form'
        ).onsubmit =
            async (event) => {

                event.preventDefault();


                try {

                    if (
                        !selectedPaymentClient
                    ) {

                        throw new Error(
                            'Selecione um cliente.'
                        );
                    }


                    const selected =
                        getSelectedInstallments();


                    if (!selected.length) {

                        throw new Error(
                            'Selecione pelo menos uma parcela.'
                        );
                    }


                    for (
                        const item of selected
                    ) {

                        const remaining =
                            getPartRemaining(
                                item.part
                            );


                        if (
                            item.amount <= 0
                        ) {

                            throw new Error(
                                `Informe um valor válido para a parcela ${item.part.numero}.`
                            );
                        }


                        if (
                            item.amount >
                            remaining + 0.01
                        ) {

                            throw new Error(
                                `O valor máximo da parcela ${item.part.numero} é ${fmtMoney(remaining)}.`
                            );
                        }
                    }


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


                    const submitButton =
                        event.currentTarget.querySelector(
                            'button[type="submit"]'
                        );


                    if (submitButton) {

                        submitButton.disabled =
                            true;

                        submitButton.textContent =
                            'Registrando...';
                    }


                    for (
                        const item of selected
                    ) {

                        const partId =
                            item.part.id;


                        const value =
                            Number(
                                item.amount.toFixed(
                                    2
                                )
                            );


                        const parcela =
                            await supabaseQuery(
                                (c) =>
                                    c
                                        .from(
                                            'parcelas'
                                        )
                                        .select(
                                            'id,valor,valor_pago'
                                        )
                                        .eq(
                                            'id',
                                            partId
                                        )
                                        .single()
                            );


                        if (!parcela) {

                            throw new Error(
                                `Parcela ${item.part.numero} não encontrada.`
                            );
                        }


                        const valorJaPago =
                            Number(
                                parcela.valor_pago ||
                                0
                            );


                        const valorParcela =
                            Number(
                                parcela.valor ||
                                0
                            );


                        const valorRestante =
                            Math.max(
                                0,
                                valorParcela -
                                valorJaPago
                            );


                        if (
                            value >
                            valorRestante + 0.01
                        ) {

                            throw new Error(
                                `A parcela ${item.part.numero} foi alterada. O valor máximo agora é ${fmtMoney(valorRestante)}.`
                            );
                        }


                        await supabaseQuery(
                            (c) =>
                                c
                                    .from(
                                        'pagamentos'
                                    )
                                    .insert({

                                        parcela_id:
                                            partId,

                                        valor:
                                            value,

                                        data_pagamento:
                                            dataPagamento,

                                        forma_pagamento:
                                            formaPagamento,

                                        id_transacao:
                                            txid ||
                                            null,

                                        status:
                                            'confirmado'

                                    })
                        );


                        const novoTotalPago =
                            valorJaPago +
                            value;


                        const novoStatus =
                            novoTotalPago >=
                            valorParcela

                                ? 'paga'

                                : 'pendente';


                        await supabaseQuery(
                            (c) =>
                                c
                                    .from(
                                        'parcelas'
                                    )
                                    .update({

                                        status:
                                            novoStatus,

                                        valor_pago:
                                            novoTotalPago,

                                        data_pagamento:
                                            novoStatus ===
                                            'paga'

                                                ? dataPagamento

                                                : null

                                    })
                                    .eq(
                                        'id',
                                        partId
                                    )
                        );
                    }


                    const totalRecebido =
                        selected.reduce(
                            (sum, item) =>
                                sum +
                                item.amount,

                            0
                        );


                    toast(

                        selected.length === 1

                            ? 'Recebimento registrado com sucesso.'

                            : `${selected.length} parcelas recebidas. Total: ${fmtMoney(totalRecebido)}.`

                    );


                    document.getElementById(
                        'payment-modal'
                    ).innerHTML = '';


                    await Promise.all([

                        loadPayments(),

                        loadOpenInstallments()

                    ]);

                } catch (error) {

                    console.error(error);


                    toast(
                        error.message ||
                        'Erro ao registrar recebimento.',
                        'error'
                    );


                    const submitButton =
                        event.currentTarget.querySelector(
                            'button[type="submit"]'
                        );


                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            'Registrar recebimento';
                    }
                }
            };


        selectedPaymentClient =
            null;

        selectedPaymentParts =
            [];


        if (options.partId) {

            const part =
                openInstallments.find(
                    (item) =>
                        String(item.id) ===
                        String(options.partId)
                );


            if (part) {

                selectPaymentClient(
                    getClientKey(part),
                    part.id
                );

                return;
            }
        }


        clearPaymentClient();

    } catch (error) {

        console.error(error);

        toast(
            'Não foi possível abrir o registro de recebimento.',
            'error'
        );
    }
}


function setupPaymentFilters() {

    document
        .querySelectorAll(
            '.payment-filter'
        )
        .forEach((button) => {

            button.onclick =
                () => {

                    currentOpenFilter =
                        button.dataset.filter ||
                        'todos';


                    document
                        .querySelectorAll(
                            '.payment-filter'
                        )
                        .forEach((item) => {

                            item.classList.toggle(
                                'active',
                                item === button
                            );
                        });


                    renderOpenInstallments();
                };
        });


    document
        .getElementById(
            'open-payment-search'
        )
        ?.addEventListener(
            'input',
            renderOpenInstallments
        );
}


// Fecha resultados de clientes
// ao clicar fora da busca/modal.

document.addEventListener(
    'click',
    (event) => {

        const results =
            document.getElementById(
                'client-results'
            );

        const search =
            document.getElementById(
                'payment-client-search'
            );


        if (
            results &&
            search &&
            !search.contains(
                event.target
            ) &&
            !results.contains(
                event.target
            )
        ) {

            results.classList.remove(
                'visible'
            );
        }
    }
);


document
    .getElementById(
        'new-payment'
    )
    ?.addEventListener(
        'click',
        () => openPaymentModal()
    );


setupPaymentFilters();

loadPayments();

loadOpenInstallments();