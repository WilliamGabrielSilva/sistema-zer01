/* =========================================================
ZER01 — PAGAMENTOS

Fluxo:

1. Lista parcelas em aberto.
2. Busca por cliente, CPF ou telefone.
3. Filtros:
   - Todos
   - Vencendo hoje
   - Atrasados
   - Próximos
4. Botão RECEBER direto na parcela.
5. Registro de recebimento:
   - Cliente
   - Parcelas
   - Uma ou várias parcelas
   - Valor recebido
   - Data
   - Forma de pagamento
   - ID/TxID
6. Atualiza parcela no Supabase.
7. Mantém histórico de pagamentos.
8. Permite exclusão do recebimento.
========================================================= */


/* =========================================================
VARIÁVEIS
========================================================= */

let openInstallments = [];

let selectedClient = null;

let currentFilter = 'todos';

let paymentsPageInitialized = false;


/* =========================================================
FUNÇÕES AUXILIARES
========================================================= */

function escapeHTML(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

}


function digitsOnly(value) {

    return String(value || '')
        .replace(/\D/g, '');

}


function normalizeText(value) {

    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

}


function getTodayISO() {

    const now = new Date();

    const offset =
        now.getTimezoneOffset();

    return new Date(
        now.getTime() -
        offset * 60000
    )
        .toISOString()
        .slice(0, 10);

}


function daysFromToday(date) {

    if (!date) {
        return 0;
    }

    const today =
        new Date(
            getTodayISO() +
            'T00:00:00'
        );

    const target =
        new Date(
            String(date).slice(0, 10) +
            'T00:00:00'
        );

    return Math.round(
        (
            target.getTime() -
            today.getTime()
        ) / 86400000
    );

}


function getRemaining(part) {

    const valor =
        Number(
            part?.valor || 0
        );

    const pago =
        Number(
            part?.valor_pago || 0
        );

    return Math.max(
        0,
        valor - pago
    );

}


function getClient(part) {

    return (
        part?.vendas?.clientes ||
        {}
    );

}


function getClientKey(part) {

    const client =
        getClient(part);

    return String(
        client.id ||
        client.cpf ||
        client.telefone ||
        client.nome ||
        part.id
    );

}


function getStatus(part) {

    const days =
        daysFromToday(
            part.vencimento
        );


    if (days < 0) {

        return {

            filter: 'atrasados',

            label:
                days === -1
                    ? 'Atrasada há 1 dia'
                    : `Atrasada há ${Math.abs(days)} dias`,

            className:
                'status-atrasado'

        };

    }


    if (days === 0) {

        return {

            filter: 'hoje',

            label:
                'Vence hoje',

            className:
                'status-hoje'

        };

    }


    return {

        filter: 'proximos',

        label:
            'Em aberto',

        className:
            'status-proximo'

    };

}


function money(value) {

    if (
        typeof fmtMoney ===
        'function'
    ) {

        return fmtMoney(
            Number(value || 0)
        );

    }


    return Number(
        value || 0
    ).toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );

}


function dateFormat(value) {

    if (
        typeof dateBR ===
        'function'
    ) {

        return dateBR(value);

    }


    if (!value) {
        return '—';
    }


    const parts =
        String(value)
            .slice(0, 10)
            .split('-');


    if (parts.length !== 3) {
        return value;
    }


    return (
        parts[2] +
        '/' +
        parts[1] +
        '/' +
        parts[0]
    );

}


function notify(
    message,
    type = 'success'
) {

    if (
        typeof toast ===
        'function'
    ) {

        toast(
            message,
            type
        );

        return;
    }


    alert(message);

}


/* =========================================================
CSS
========================================================= */

function injectPaymentStyles() {

    if (
        document.getElementById(
            'zer01-payment-styles'
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            'style'
        );


    style.id =
        'zer01-payment-styles';


    style.textContent = `

        .open-payments-panel {
            margin-bottom:20px;
        }

        .open-payments-header {
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:20px;
            margin-bottom:18px;
        }

        .open-payments-title {
            margin:0;
            font-size:20px;
            font-weight:700;
        }

        .open-payments-subtitle {
            margin-top:5px;
            color:#777e88;
            font-size:13px;
        }

        .open-payments-summary {
            text-align:right;
            color:#777e88;
            font-size:13px;
            line-height:1.6;
        }

        .open-payments-summary strong {
            color:#fff;
        }

        .open-payments-toolbar {
            display:flex;
            gap:10px;
            align-items:center;
            margin-bottom:15px;
            flex-wrap:wrap;
        }

        .open-payment-search {
            flex:1;
            min-width:250px;
            height:42px;
            padding:0 14px;
            border-radius:8px;
            border:1px solid #30343a;
            background:#111315;
            color:#fff;
            outline:none;
        }

        .open-payment-search:focus {
            border-color:#e60000;
        }

        .payment-filter {
            border:1px solid #30343a;
            background:#151719;
            color:#9ca3ad;
            padding:9px 13px;
            border-radius:8px;
            cursor:pointer;
            transition:.2s;
        }

        .payment-filter:hover {
            border-color:#555;
            color:#fff;
        }

        .payment-filter.active {
            background:#240000;
            border-color:#e60000;
            color:#fff;
        }

        .open-payments-table td {
            vertical-align:middle;
        }

        .client-name-payment {
            display:block;
            font-weight:600;
            color:#fff;
        }

        .client-phone-payment {
            display:block;
            margin-top:3px;
            color:#777e88;
            font-size:12px;
        }

        .payment-date-status {
            display:inline-block;
            font-weight:600;
        }

        .payment-date-status.status-atrasado {
            color:#ff6b6b;
        }

        .payment-date-status.status-hoje {
            color:#ffc107;
        }

        .payment-date-status.status-proximo {
            color:#7db7ff;
        }

        .open-status-badge {
            display:inline-flex;
            align-items:center;
            padding:5px 8px;
            border-radius:6px;
            font-size:11px;
            font-weight:600;
            white-space:nowrap;
        }

        .open-status-badge.status-atrasado {
            background:#2b1111;
            color:#ff7777;
        }

        .open-status-badge.status-hoje {
            background:#2b2209;
            color:#ffc947;
        }

        .open-status-badge.status-proximo {
            background:#101d30;
            color:#78aefc;
        }

        .receive-payment-btn {
            padding:8px 12px;
            font-size:12px;
            white-space:nowrap;
        }

        .payment-modal-overlay {
            position:fixed;
            inset:0;
            z-index:9999;
            background:rgba(0,0,0,.78);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        }

        .payment-modal-card {
            width:min(760px,100%);
            max-height:90vh;
            overflow:auto;
            background:#1a1d21;
            border:1px solid #383d44;
            border-radius:10px;
            box-shadow:0 25px 80px rgba(0,0,0,.65);
            color:#fff;
            padding:24px;
        }

        .payment-modal-head {
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:20px;
            margin-bottom:24px;
        }

        .payment-modal-head h3 {
            margin:4px 0 0;
            font-size:21px;
        }

        .payment-modal-close {
            width:34px;
            height:34px;
            border-radius:7px;
            border:1px solid #3b4148;
            background:#17191c;
            color:#9da4ad;
            cursor:pointer;
            font-size:18px;
        }

        .payment-modal-close:hover {
            color:#fff;
            border-color:#666;
        }

        .payment-label {
            display:block;
            font-size:12px;
            font-weight:600;
            color:#aeb5be;
            margin-bottom:7px;
        }

        .payment-search-wrap {
            position:relative;
        }

        .payment-client-search {
            width:100%;
            height:44px;
            box-sizing:border-box;
            padding:0 14px 0 42px;
            border:1px solid #3a4047;
            background:#111315;
            color:#fff;
            border-radius:8px;
            outline:none;
        }

        .payment-client-search:focus {
            border-color:#e60000;
        }

        .payment-search-icon {
            position:absolute;
            left:14px;
            top:50%;
            transform:translateY(-50%);
            color:#8c949e;
            pointer-events:none;
        }

        .client-results {
            display:none;
            margin-top:6px;
            border:1px solid #383e45;
            border-radius:8px;
            background:#121416;
            overflow:hidden;
            max-height:250px;
            overflow-y:auto;
        }

        .client-results.visible {
            display:block;
        }

        .client-result-item {
            width:100%;
            border:0;
            border-bottom:1px solid #292d32;
            background:#121416;
            color:#fff;
            padding:12px 14px;
            cursor:pointer;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:15px;
            text-align:left;
        }

        .client-result-item:hover {
            background:#1d2024;
        }

        .client-result-name {
            font-weight:600;
            display:block;
        }

        .client-result-info {
            display:block;
            margin-top:4px;
            color:#777e88;
            font-size:12px;
        }

        .client-result-total {
            text-align:right;
            white-space:nowrap;
        }

        .client-result-total small {
            display:block;
            color:#777e88;
            margin-bottom:3px;
        }

        .selected-client-card {
            margin-top:12px;
            padding:15px;
            border:1px solid #353b42;
            border-radius:8px;
            background:#151719;
            display:flex;
            align-items:center;
            gap:15px;
        }

        .selected-client-info {
            flex:1;
        }

        .selected-client-info small {
            display:block;
            margin-top:5px;
            color:#858d97;
        }

        .selected-client-debt {
            text-align:right;
            padding-left:15px;
            border-left:1px solid #30353b;
        }

        .selected-client-debt span {
            display:block;
            font-size:11px;
            color:#858d97;
            margin-bottom:3px;
        }

        .change-client-btn {
            border:0;
            background:none;
            color:#777e88;
            cursor:pointer;
            font-size:18px;
            padding:5px;
        }

        .payment-section {
            margin-top:22px;
        }

        .payment-section-head {
            display:flex;
            justify-content:space-between;
            align-items:flex-end;
            gap:15px;
            margin-bottom:10px;
        }

        .payment-help {
            display:block;
            margin-top:3px;
            color:#777e88;
            font-size:12px;
        }

        .installment-actions {
            display:flex;
            gap:7px;
        }

        .installment-action {
            border:1px solid #383e45;
            background:#151719;
            color:#aeb5be;
            padding:7px 10px;
            border-radius:6px;
            cursor:pointer;
            font-size:11px;
        }

        .installment-action:hover {
            color:#fff;
            border-color:#666;
        }

        .installments-list {
            display:flex;
            flex-direction:column;
            gap:7px;
            max-height:300px;
            overflow-y:auto;
            padding-right:3px;
        }

        .installment-item {
            display:grid;
            grid-template-columns:30px 1fr auto 125px;
            gap:12px;
            align-items:center;
            padding:12px;
            border:1px solid #30353b;
            border-radius:8px;
            background:#141618;
        }

        .installment-item.selected {
            border-color:#7d1717;
            background:#1d1515;
        }

        .installment-checkbox {
            width:18px;
            height:18px;
            accent-color:#e60000;
            cursor:pointer;
        }

        .installment-number {
            font-weight:600;
        }

        .installment-meta {
            display:block;
            color:#777e88;
            font-size:11px;
            margin-top:3px;
        }

        .installment-value {
            text-align:right;
        }

        .installment-value small {
            display:block;
            color:#777e88;
            font-size:10px;
        }

        .installment-value strong {
            font-size:14px;
        }

        .installment-receive {
            width:100%;
            box-sizing:border-box;
            height:34px;
            border:1px solid #363c43;
            border-radius:6px;
            background:#0f1113;
            color:#fff;
            padding:0 8px;
        }

        .installment-receive:disabled {
            opacity:.35;
            cursor:not-allowed;
        }

        .receipt-summary {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:10px;
            margin-top:18px;
        }

        .receipt-summary-box {
            padding:13px;
            border:1px solid #343a41;
            border-radius:8px;
            background:#151719;
        }

        .receipt-summary-box span {
            display:block;
            color:#777e88;
            font-size:11px;
            margin-bottom:4px;
        }

        .receipt-summary-box strong {
            font-size:18px;
        }

        .payment-form-grid {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:14px;
            margin-top:18px;
            padding-top:18px;
            border-top:1px solid #30353b;
        }

        .payment-field.full {
            grid-column:1 / -1;
        }

        .payment-field input,
        .payment-field select {
            width:100%;
            height:40px;
            box-sizing:border-box;
            border:1px solid #373d44;
            border-radius:7px;
            background:#111315;
            color:#fff;
            padding:0 11px;
            outline:none;
        }

        .payment-field input:focus,
        .payment-field select:focus {
            border-color:#e60000;
        }

        .payment-modal-actions {
            display:flex;
            justify-content:flex-end;
            gap:8px;
            margin-top:22px;
            padding-top:18px;
            border-top:1px solid #30353b;
        }

        .payment-empty {
            padding:30px 15px;
            text-align:center;
            color:#777e88;
        }

        @media(max-width:700px) {

            .open-payments-header {
                flex-direction:column;
            }

            .open-payments-summary {
                text-align:left;
            }

            .payment-section-head {
                flex-direction:column;
                align-items:flex-start;
            }

            .installment-item {
                grid-template-columns:30px 1fr;
            }

            .installment-value {
                text-align:left;
                grid-column:2;
            }

            .installment-receive {
                grid-column:2;
            }

            .receipt-summary {
                grid-template-columns:1fr;
            }

            .payment-form-grid {
                grid-template-columns:1fr;
            }

            .payment-field.full {
                grid-column:auto;
            }

            .selected-client-card {
                flex-wrap:wrap;
            }

            .selected-client-debt {
                width:100%;
                text-align:left;
                padding:10px 0 0;
                border-left:0;
                border-top:1px solid #30353b;
            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
CRIA ÁREA DE PARCELAS
========================================================= */

function createOpenPaymentsArea() {

    if (
        document.getElementById(
            'open-payments-area'
        )
    ) {
        return true;
    }


    const historyPanel =
        document.querySelector(
            '#payments-table'
        )?.closest('.panel');


    if (!historyPanel) {

        console.warn(
            'ZER01: #payments-table não encontrado.'
        );

        return false;
    }


    const panel =
        document.createElement(
            'section'
        );


    panel.className =
        'panel open-payments-panel';

    panel.id =
        'open-payments-area';


    panel.innerHTML = `

        <div class="open-payments-header">

            <div>

                <span class="eyebrow">
                    BAIXA RÁPIDA
                </span>

                <h2 class="open-payments-title">
                    Parcelas em aberto
                </h2>

                <div class="open-payments-subtitle">
                    Encontre o cliente e registre
                    o recebimento diretamente.
                </div>

            </div>


            <div
                id="open-payments-summary"
                class="open-payments-summary"
            >
                Carregando...
            </div>

        </div>


        <div class="open-payments-toolbar">

            <input
                type="text"
                id="open-payment-search"
                class="open-payment-search"
                placeholder="🔍  Buscar por nome, CPF ou telefone..."
            >


            <button
                type="button"
                class="payment-filter active"
                data-filter="todos"
            >
                Todos
            </button>


            <button
                type="button"
                class="payment-filter"
                data-filter="hoje"
            >
                Vencendo hoje
            </button>


            <button
                type="button"
                class="payment-filter"
                data-filter="atrasados"
            >
                Atrasados
            </button>


            <button
                type="button"
                class="payment-filter"
                data-filter="proximos"
            >
                Próximos
            </button>

        </div>


        <div class="table-wrap">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>Cliente</th>

                        <th>Parcela</th>

                        <th>Vencimento</th>

                        <th>Valor</th>

                        <th>Situação</th>

                        <th>Ação</th>

                    </tr>

                </thead>


                <tbody
                    id="open-payments-table"
                >

                    <tr>

                        <td
                            colspan="6"
                            class="payment-empty"
                        >
                            Carregando parcelas...
                        </td>

                    </tr>

                </tbody>

            </table>

        </div>

    `;


    historyPanel.parentNode.insertBefore(
        panel,
        historyPanel
    );


    document
        .querySelectorAll(
            '.payment-filter'
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    'click',
                    () => {

                        currentFilter =
                            button.dataset.filter ||
                            'todos';


                        document
                            .querySelectorAll(
                                '.payment-filter'
                            )
                            .forEach(
                                (item) => {

                                    item.classList.toggle(
                                        'active',
                                        item === button
                                    );

                                }
                            );


                        renderOpenPayments();

                    }
                );

            }
        );


    document
        .getElementById(
            'open-payment-search'
        )
        ?.addEventListener(
            'input',
            renderOpenPayments
        );


    return true;

}


/* =========================================================
CARREGA PARCELAS EM ABERTO
========================================================= */

async function loadOpenInstallments() {

    const tbody =
        document.getElementById(
            'open-payments-table'
        );


    const summary =
        document.getElementById(
            'open-payments-summary'
        );


    if (!tbody) {

        console.warn(
            'ZER01: tabela de parcelas não encontrada.'
        );

        return;

    }


    try {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="payment-empty"
                >
                    Carregando parcelas...
                </td>

            </tr>

        `;


        if (summary) {

            summary.textContent =
                'Carregando...';

        }


        /*
         * Busca todas as parcelas.
         *
         * Não filtramos o status diretamente
         * no Supabase.
         *
         * Isso evita que diferenças de status
         * existentes no banco façam a tela
         * ficar vazia.
         */

        const rows =
            await supabaseQuery(
                (c) =>
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
                                clientes(*)
                            )
                        `)
                        .order(
                            'vencimento',
                            {
                                ascending:true
                            }
                        )
            );


        openInstallments =
            Array.isArray(rows)
                ? rows.filter(
                    (part) => {

                        const status =
                            String(
                                part?.status ||
                                ''
                            )
                            .toLowerCase()
                            .trim();


                        const remaining =
                            getRemaining(part);


                        /*
                         * Consideramos aberta
                         * qualquer parcela que
                         * ainda tenha saldo.
                         *
                         * Assim não dependemos
                         * exclusivamente do texto
                         * do status.
                         */

                        return (
                            remaining > 0 &&
                            status !== 'paga'
                        );

                    }
                )
                : [];


        console.log(
            'ZER01 parcelas carregadas:',
            openInstallments
        );


        renderOpenPayments();

        updateOpenSummary();


    } catch (error) {

        console.error(
            'ZER01 — Erro ao carregar parcelas:',
            error
        );


        openInstallments =
            [];


        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="payment-empty"
                >
                    Não foi possível carregar
                    as parcelas em aberto.
                </td>

            </tr>

        `;


        if (summary) {

            summary.textContent =
                'Erro ao carregar';

        }

    }

}


/* =========================================================
RESUMO
========================================================= */

function updateOpenSummary() {

    const element =
        document.getElementById(
            'open-payments-summary'
        );


    if (!element) {
        return;
    }


    const total =
        openInstallments.reduce(
            (sum, part) =>
                sum +
                getRemaining(part),

            0
        );


    element.innerHTML = `

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
            ${money(total)}
        </strong>

        a receber

    `;

}


/* =========================================================
RENDERIZA PARCELAS
========================================================= */

function renderOpenPayments() {

    const tbody =
        document.getElementById(
            'open-payments-table'
        );


    if (!tbody) {
        return;
    }


    const searchInput =
        document.getElementById(
            'open-payment-search'
        );


    const search =
        normalizeText(
            searchInput?.value || ''
        );


    const searchDigits =
        digitsOnly(search);


    const filtered =
        openInstallments.filter(
            (part) => {

                const status =
                    getStatus(part);


                if (
                    currentFilter !==
                    'todos' &&
                    status.filter !==
                    currentFilter
                ) {

                    return false;

                }


                if (!search) {
                    return true;
                }


                const client =
                    getClient(part);


                const text =
                    normalizeText(
                        [
                            client.nome,
                            client.cpf,
                            client.telefone
                        ].join(' ')
                    );


                const digits =
                    digitsOnly(
                        [
                            client.cpf,
                            client.telefone
                        ].join(' ')
                    );


                return (
                    text.includes(search) ||
                    (
                        searchDigits &&
                        digits.includes(
                            searchDigits
                        )
                    )
                );

            }
        );


    if (!filtered.length) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="payment-empty"
                >
                    Nenhuma parcela encontrada.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        filtered
            .map(
                (part) => {

                    const client =
                        getClient(part);


                    const status =
                        getStatus(part);


                    const remaining =
                        getRemaining(part);


                    return `

                        <tr>

                            <td>

                                <span
                                    class="client-name-payment"
                                >
                                    ${escapeHTML(
                                        client.nome ||
                                        'Cliente'
                                    )}
                                </span>


                                ${
                                    client.telefone
                                        ? `
                                            <span
                                                class="client-phone-payment"
                                            >
                                                ${escapeHTML(
                                                    client.telefone
                                                )}
                                            </span>
                                        `
                                        : ''
                                }

                            </td>


                            <td>

                                ${
                                    escapeHTML(
                                        part.numero ??
                                        '—'
                                    )
                                }

                            </td>


                            <td>

                                <span
                                    class="payment-date-status ${status.className}"
                                >
                                    ${dateFormat(
                                        part.vencimento
                                    )}
                                </span>

                            </td>


                            <td>

                                <strong>
                                    ${money(
                                        remaining
                                    )}
                                </strong>

                            </td>


                            <td>

                                <span
                                    class="open-status-badge ${status.className}"
                                >
                                    ${status.label}
                                </span>

                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="btn btn-primary receive-payment-btn"
                                    data-part-id="${escapeHTML(part.id)}"
                                >
                                    Receber
                                </button>

                            </td>

                        </tr>

                    `;

                }
            )
            .join('');


    document
        .querySelectorAll(
            '.receive-payment-btn'
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    'click',
                    () => {

                        const part =
                            openInstallments.find(
                                (item) =>
                                    String(item.id) ===
                                    String(
                                        button.dataset.partId
                                    )
                            );


                        if (!part) {

                            notify(
                                'Parcela não encontrada.',
                                'error'
                            );

                            return;

                        }


                        openPaymentModal(
                            part.id
                        );

                    }
                );

            }
        );

}


/* =========================================================
ABRE MODAL
========================================================= */

async function openPaymentModal(
    preferredPartId = null
) {

    /*
     * Se ainda não carregou,
     * tenta novamente.
     */

    if (
        !openInstallments.length
    ) {

        await loadOpenInstallments();

    }


    const modal =
        document.getElementById(
            'payment-modal'
        );


    if (!modal) {

        notify(
            'Área do formulário de recebimento não encontrada.',
            'error'
        );

        return;

    }


    selectedClient =
        null;


    modal.innerHTML = `

        <div
            class="payment-modal-overlay"
            id="payment-modal-overlay"
        >

            <form
                class="payment-modal-card"
                id="payment-form"
            >

                <div
                    class="payment-modal-head"
                >

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
                        class="payment-modal-close"
                        id="close-payment-modal"
                    >
                        ×
                    </button>

                </div>


                <div>

                    <label
                        class="payment-label"
                    >
                        Cliente
                    </label>


                    <div
                        class="payment-search-wrap"
                    >

                        <span
                            class="payment-search-icon"
                        >
                            🔍
                        </span>


                        <input
                            type="text"
                            id="payment-client-search"
                            class="payment-client-search"
                            autocomplete="off"
                            placeholder="Digite nome, CPF ou telefone..."
                        >

                    </div>


                    <div
                        id="client-results"
                        class="client-results"
                    ></div>


                    <div
                        id="selected-client-area"
                    ></div>

                </div>


                <div
                    class="payment-section"
                >

                    <div
                        class="payment-section-head"
                    >

                        <div>

                            <label
                                class="payment-label"
                            >
                                Parcelas em aberto
                            </label>

                            <span
                                class="payment-help"
                            >
                                Selecione uma ou várias
                                parcelas para receber.
                            </span>

                        </div>


                        <div
                            class="installment-actions"
                        >

                            <button
                                type="button"
                                class="installment-action"
                                id="select-next-payment"
                            >
                                Próxima parcela
                            </button>


                            <button
                                type="button"
                                class="installment-action"
                                id="select-all-payments"
                            >
                                Selecionar todas
                            </button>

                        </div>

                    </div>


                    <div
                        id="installments-list"
                        class="installments-list"
                    >

                        <div
                            class="payment-empty"
                        >
                            Primeiro selecione um cliente.
                        </div>

                    </div>

                </div>


                <div
                    class="receipt-summary"
                >

                    <div
                        class="receipt-summary-box"
                    >

                        <span>
                            Parcelas selecionadas
                        </span>

                        <strong
                            id="selected-count"
                        >
                            0
                        </strong>

                    </div>


                    <div
                        class="receipt-summary-box"
                    >

                        <span>
                            Total do recebimento
                        </span>

                        <strong
                            id="selected-total"
                        >
                            R$ 0,00
                        </strong>

                    </div>

                </div>


                <div
                    class="payment-form-grid"
                    id="payment-extra-fields"
                    style="display:none;"
                >

                    <div
                        class="payment-field"
                    >

                        <label
                            class="payment-label"
                        >
                            Data do recebimento *
                        </label>


                        <input
                            type="date"
                            id="payment-date"
                            value="${getTodayISO()}"
                            required
                        >

                    </div>


                    <div
                        class="payment-field"
                    >

                        <label
                            class="payment-label"
                        >
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


                    <div
                        class="payment-field full"
                    >

                        <label
                            class="payment-label"
                        >
                            ID/TxID
                            <span
                                style="
                                    font-weight:400;
                                    color:#777e88
                                "
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
                    class="payment-modal-actions"
                >

                    <button
                        type="button"
                        class="btn"
                        id="cancel-payment-modal"
                    >
                        Cancelar
                    </button>


                    <button
                        type="submit"
                        class="btn btn-primary"
                        id="save-payment"
                    >
                        Registrar recebimento
                    </button>

                </div>

            </form>

        </div>

    `;


    document
        .getElementById(
            'close-payment-modal'
        )
        .onclick =
            closePaymentModal;


    document
        .getElementById(
            'cancel-payment-modal'
        )
        .onclick =
            closePaymentModal;


    document
        .getElementById(
            'payment-modal-overlay'
        )
        .addEventListener(
            'click',
            (event) => {

                if (
                    event.target.id ===
                    'payment-modal-overlay'
                ) {

                    closePaymentModal();

                }

            }
        );


    const search =
        document.getElementById(
            'payment-client-search'
        );


    search.addEventListener(
        'input',
        () => {

            if (
                selectedClient
            ) {

                selectedClient =
                    null;


                document.getElementById(
                    'selected-client-area'
                ).innerHTML = '';


                document.getElementById(
                    'installments-list'
                ).innerHTML = `

                    <div class="payment-empty">
                        Selecione novamente um cliente.
                    </div>

                `;


                updateReceiptSummary();

            }


            renderClientResults(
                search.value
            );

        }
    );


    document
        .getElementById(
            'select-next-payment'
        )
        .onclick =
            selectNextInstallment;


    document
        .getElementById(
            'select-all-payments'
        )
        .onclick =
            selectAllInstallments;


    document
        .getElementById(
            'payment-form'
        )
        .addEventListener(
            'submit',
            savePayment
        );


    if (preferredPartId) {

        const part =
            openInstallments.find(
                (item) =>
                    String(item.id) ===
                    String(preferredPartId)
            );


        if (part) {

            selectClient(
                getClientKey(part),
                preferredPartId
            );

            return;

        }

    }


    search.focus();

}


/* =========================================================
FECHAR MODAL
========================================================= */

function closePaymentModal() {

    const modal =
        document.getElementById(
            'payment-modal'
        );


    if (modal) {

        modal.innerHTML =
            '';

    }


    selectedClient =
        null;

}


/* =========================================================
BUSCA CLIENTES
========================================================= */

function renderClientResults(
    searchValue
) {

    const results =
        document.getElementById(
            'client-results'
        );


    if (!results) {
        return;
    }


    const search =
        normalizeText(
            searchValue
        );


    const searchDigits =
        digitsOnly(
            searchValue
        );


    const groups =
        new Map();


    openInstallments.forEach(
        (part) => {

            const key =
                getClientKey(part);


            if (
                !groups.has(key)
            ) {

                groups.set(
                    key,
                    {
                        client:
                            getClient(part),

                        parts:[]
                    }
                );

            }


            groups
                .get(key)
                .parts
                .push(part);

        }
    );


    let clients =
        Array.from(
            groups.entries()
        );


    if (search) {

        clients =
            clients.filter(
                ([key, group]) => {

                    const client =
                        group.client;


                    const text =
                        normalizeText(
                            [
                                client.nome,
                                client.cpf,
                                client.telefone
                            ].join(' ')
                        );


                    const digits =
                        digitsOnly(
                            [
                                client.cpf,
                                client.telefone
                            ].join(' ')
                        );


                    return (
                        text.includes(search) ||
                        (
                            searchDigits &&
                            digits.includes(
                                searchDigits
                            )
                        )
                    );

                }
            );

    }


    clients =
        clients.slice(
            0,
            10
        );


    if (!clients.length) {

        results.innerHTML = `

            <div
                style="
                    padding:15px;
                    color:#777e88;
                    text-align:center
                "
            >
                Nenhum cliente encontrado.
            </div>

        `;


        results.classList.add(
            'visible'
        );

        return;

    }


    results.innerHTML =
        clients
            .map(
                ([key, group]) => {

                    const client =
                        group.client;


                    const total =
                        group.parts.reduce(
                            (sum, part) =>
                                sum +
                                getRemaining(part),

                            0
                        );


                    return `

                        <button
                            type="button"
                            class="client-result-item"
                            data-client-key="${escapeHTML(key)}"
                        >

                            <span>

                                <span
                                    class="client-result-name"
                                >
                                    ${escapeHTML(
                                        client.nome ||
                                        'Cliente'
                                    )}
                                </span>


                                <span
                                    class="client-result-info"
                                >

                                    ${
                                        client.cpf
                                            ? `CPF/CNPJ: ${escapeHTML(client.cpf)}`
                                            : ''
                                    }

                                    ${
                                        client.telefone
                                            ? ` • ${escapeHTML(client.telefone)}`
                                            : ''
                                    }

                                </span>

                            </span>


                            <span
                                class="client-result-total"
                            >

                                <small>

                                    ${group.parts.length}

                                    ${
                                        group.parts.length === 1
                                            ? 'parcela'
                                            : 'parcelas'
                                    }

                                </small>


                                <strong>
                                    ${money(total)}
                                </strong>

                            </span>

                        </button>

                    `;

                }
            )
            .join('');


    results
        .querySelectorAll(
            '.client-result-item'
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    'click',
                    () => {

                        selectClient(
                            button.dataset.clientKey
                        );

                    }
                );

            }
        );


    results.classList.add(
        'visible'
    );

}


/* =========================================================
SELECIONA CLIENTE
========================================================= */

function selectClient(
    clientKey,
    preferredPartId = null
) {

    const groups =
        new Map();


    openInstallments.forEach(
        (part) => {

            const key =
                getClientKey(part);


            if (
                !groups.has(key)
            ) {

                groups.set(
                    key,
                    {
                        client:
                            getClient(part),

                        parts:[]
                    }
                );

            }


            groups
                .get(key)
                .parts
                .push(part);

        }
    );


    const group =
        groups.get(
            String(clientKey)
        );


    if (!group) {

        notify(
            'Cliente não encontrado.',
            'error'
        );

        return;

    }


    selectedClient =
        group;


    const results =
        document.getElementById(
            'client-results'
        );


    if (results) {

        results.classList.remove(
            'visible'
        );

    }


    const area =
        document.getElementById(
            'selected-client-area'
        );


    const total =
        group.parts.reduce(
            (sum, part) =>
                sum +
                getRemaining(part),

            0
        );


    area.innerHTML = `

        <div
            class="selected-client-card"
        >

            <div
                class="selected-client-info"
            >

                <span
                    style="
                        display:block;
                        font-size:10px;
                        color:#777e88;
                        margin-bottom:3px
                    "
                >
                    CLIENTE SELECIONADO
                </span>


                <strong>
                    ${escapeHTML(
                        group.client.nome ||
                        'Cliente'
                    )}
                </strong>


                ${
                    group.client.cpf
                        ? `
                            <small>
                                CPF/CNPJ:
                                ${escapeHTML(
                                    group.client.cpf
                                )}
                            </small>
                        `
                        : ''
                }


                ${
                    group.client.telefone
                        ? `
                            <small>
                                ${escapeHTML(
                                    group.client.telefone
                                )}
                            </small>
                        `
                        : ''
                }

            </div>


            <div
                class="selected-client-debt"
            >

                <span>

                    ${group.parts.length}

                    ${
                        group.parts.length === 1
                            ? 'parcela'
                            : 'parcelas'
                    }

                    em aberto

                </span>


                <strong>
                    ${money(total)}
                </strong>

            </div>


            <button
                type="button"
                class="change-client-btn"
                id="change-payment-client"
                title="Trocar cliente"
            >
                ×
            </button>

        </div>

    `;


    document
        .getElementById(
            'change-payment-client'
        )
        .onclick =
            () => {

                selectedClient =
                    null;


                area.innerHTML =
                    '';


                document.getElementById(
                    'installments-list'
                ).innerHTML = `

                    <div class="payment-empty">
                        Primeiro selecione um cliente.
                    </div>

                `;


                updateReceiptSummary();


                const input =
                    document.getElementById(
                        'payment-client-search'
                    );


                input.value =
                    '';


                input.focus();

            };


    renderClientInstallments(
        preferredPartId
    );


    updateReceiptSummary();

}


/* =========================================================
PARCELAS DO CLIENTE
========================================================= */

function renderClientInstallments(
    preferredPartId = null
) {

    const list =
        document.getElementById(
            'installments-list'
        );


    if (
        !list ||
        !selectedClient
    ) {
        return;
    }


    const parts =
        [...selectedClient.parts]
            .sort(
                (a, b) =>
                    String(
                        a.vencimento
                    ).localeCompare(
                        String(
                            b.vencimento
                        )
                    )
            );


    if (!parts.length) {

        list.innerHTML = `

            <div class="payment-empty">
                Nenhuma parcela em aberto.
            </div>

        `;

        return;

    }


    list.innerHTML =
        parts
            .map(
                (part) => {

                    const status =
                        getStatus(part);


                    const remaining =
                        getRemaining(part);


                    const selected =
                        preferredPartId &&
                        String(
                            preferredPartId
                        ) ===
                        String(part.id);


                    return `

                        <div
                            class="installment-item ${
                                selected
                                    ? 'selected'
                                    : ''
                            }"
                            data-part-id="${escapeHTML(part.id)}"
                        >

                            <div>

                                <input
                                    type="checkbox"
                                    class="installment-checkbox"
                                    data-part-id="${escapeHTML(part.id)}"
                                    ${
                                        selected
                                            ? 'checked'
                                            : ''
                                    }
                                >

                            </div>


                            <div>

                                <strong
                                    class="installment-number"
                                >
                                    Parcela ${escapeHTML(
                                        part.numero
                                    )}
                                </strong>


                                <span
                                    class="installment-meta"
                                >

                                    Vencimento:
                                    ${dateFormat(
                                        part.vencimento
                                    )}

                                    •

                                    <span
                                        class="${status.className}"
                                    >
                                        ${status.label}
                                    </span>

                                </span>

                            </div>


                            <div
                                class="installment-value"
                            >

                                <small>
                                    Restante
                                </small>

                                <strong>
                                    ${money(
                                        remaining
                                    )}
                                </strong>

                            </div>


                            <div>

                                <input
                                    type="number"
                                    class="installment-receive"
                                    data-part-id="${escapeHTML(part.id)}"
                                    value="${remaining.toFixed(2)}"
                                    min="0.01"
                                    max="${remaining.toFixed(2)}"
                                    step="0.01"
                                    ${
                                        selected
                                            ? ''
                                            : 'disabled'
                                    }
                                >

                            </div>

                        </div>

                    `;

                }
            )
            .join('');


    list
        .querySelectorAll(
            '.installment-checkbox'
        )
        .forEach(
            (checkbox) => {

                checkbox.addEventListener(
                    'change',
                    () => {

                        const row =
                            checkbox.closest(
                                '.installment-item'
                            );


                        const valueInput =
                            row.querySelector(
                                '.installment-receive'
                            );


                        if (
                            checkbox.checked
                        ) {

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

            }
        );


    list
        .querySelectorAll(
            '.installment-receive'
        )
        .forEach(
            (input) => {

                input.addEventListener(
                    'input',
                    updateReceiptSummary
                );

            }
        );


    updateReceiptSummary();

}


/* =========================================================
PRÓXIMA PARCELA
========================================================= */

function selectNextInstallment() {

    if (
        !selectedClient
    ) {

        notify(
            'Primeiro selecione um cliente.',
            'error'
        );

        return;

    }


    const list =
        document.getElementById(
            'installments-list'
        );


    const checkbox =
        list?.querySelector(
            '.installment-checkbox:not(:checked)'
        );


    if (!checkbox) {

        notify(
            'Todas as parcelas já estão selecionadas.'
        );

        return;

    }


    checkbox.checked =
        true;


    const row =
        checkbox.closest(
            '.installment-item'
        );


    row.classList.add(
        'selected'
    );


    const valueInput =
        row.querySelector(
            '.installment-receive'
        );


    valueInput.disabled =
        false;


    updateReceiptSummary();

}


/* =========================================================
SELECIONAR TODAS
========================================================= */

function selectAllInstallments() {

    if (
        !selectedClient
    ) {

        notify(
            'Primeiro selecione um cliente.',
            'error'
        );

        return;

    }


    const list =
        document.getElementById(
            'installments-list'
        );


    list
        .querySelectorAll(
            '.installment-checkbox'
        )
        .forEach(
            (checkbox) => {

                checkbox.checked =
                    true;


                const row =
                    checkbox.closest(
                        '.installment-item'
                    );


                row.classList.add(
                    'selected'
                );


                const input =
                    row.querySelector(
                        '.installment-receive'
                    );


                input.disabled =
                    false;

            }
        );


    updateReceiptSummary();

}


/* =========================================================
OBTÉM PARCELAS SELECIONADAS
========================================================= */

function getSelectedPayments() {

    const list =
        document.getElementById(
            'installments-list'
        );


    if (
        !list ||
        !selectedClient
    ) {

        return [];

    }


    return Array.from(
        list.querySelectorAll(
            '.installment-checkbox:checked'
        )
    )
        .map(
            (checkbox) => {

                const partId =
                    checkbox.dataset.partId;


                const part =
                    selectedClient.parts.find(
                        (item) =>
                            String(item.id) ===
                            String(partId)
                    );


                const input =
                    list.querySelector(
                        `.installment-receive[data-part-id="${partId}"]`
                    );


                return {

                    part,

                    amount:
                        Number(
                            input?.value || 0
                        )

                };

            }
        )
        .filter(
            (item) =>
                item.part
        );

}


/* =========================================================
ATUALIZA RESUMO
========================================================= */

function updateReceiptSummary() {

    const selected =
        getSelectedPayments();


    const count =
        document.getElementById(
            'selected-count'
        );


    const total =
        document.getElementById(
            'selected-total'
        );


    const extra =
        document.getElementById(
            'payment-extra-fields'
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
            money(
                totalValue
            );

    }


    if (extra) {

        extra.style.display =
            selected.length
                ? 'grid'
                : 'none';

    }

}


/* =========================================================
SALVAR RECEBIMENTO
========================================================= */

async function savePayment(
    event
) {

    event.preventDefault();


    try {

        if (
            !selectedClient
        ) {

            throw new Error(
                'Selecione um cliente.'
            );

        }


        const selected =
            getSelectedPayments();


        if (!selected.length) {

            throw new Error(
                'Selecione pelo menos uma parcela.'
            );

        }


        const dateInput =
            document.getElementById(
                'payment-date'
            );


        const methodInput =
            document.getElementById(
                'payment-method'
            );


        const txidInput =
            document.getElementById(
                'payment-txid'
            );


        const dataPagamento =
            dateInput?.value;


        const formaPagamento =
            methodInput?.value ||
            'dinheiro';


        const txid =
            txidInput?.value
                ?.trim() ||
            '';


        if (!dataPagamento) {

            throw new Error(
                'Informe a data do recebimento.'
            );

        }


        for (
            const item of selected
        ) {

            const remaining =
                getRemaining(
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
                    `O valor máximo da parcela ${item.part.numero} é ${money(remaining)}.`
                );

            }

        }


        const button =
            document.getElementById(
                'save-payment'
            );


        if (button) {

            button.disabled =
                true;

            button.textContent =
                'Registrando...';

        }


        for (
            const item of selected
        ) {

            const partId =
                item.part.id;


            const value =
                Number(
                    item.amount.toFixed(2)
                );


            const parcela =
                await supabaseQuery(
                    (c) =>
                        c
                            .from('parcelas')
                            .select(
                                'id,valor,valor_pago,status'
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


            const valorParcela =
                Number(
                    parcela.valor || 0
                );


            const valorJaPago =
                Number(
                    parcela.valor_pago || 0
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
                    `A parcela ${item.part.numero} foi alterada. O máximo agora é ${money(valorRestante)}.`
                );

            }


            await supabaseQuery(
                (c) =>
                    c
                        .from('pagamentos')
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


            const novaStatus =
                novoTotalPago >=
                valorParcela
                    ? 'paga'
                    : 'pendente';


            await supabaseQuery(
                (c) =>
                    c
                        .from('parcelas')
                        .update({

                            status:
                                novaStatus,

                            valor_pago:
                                novoTotalPago,

                            data_pagamento:
                                novaStatus ===
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


        const total =
            selected.reduce(
                (sum, item) =>
                    sum +
                    item.amount,

                0
            );


        closePaymentModal();


        notify(
            selected.length === 1
                ? 'Recebimento registrado com sucesso.'
                : `${selected.length} parcelas recebidas. Total: ${money(total)}.`
        );


        await Promise.all([
            loadPayments(),
            loadOpenInstallments()
        ]);


    } catch (error) {

        console.error(
            'ZER01 — Erro ao registrar:',
            error
        );


        notify(
            error.message ||
            'Erro ao registrar recebimento.',
            'error'
        );


        const button =
            document.getElementById(
                'save-payment'
            );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                'Registrar recebimento';

        }

    }

}


/* =========================================================
HISTÓRICO DE PAGAMENTOS
========================================================= */

async function loadPayments() {

    const table =
        document.getElementById(
            'payments-table'
        );


    if (!table) {
        return;
    }


    try {

        const rows =
            await supabaseQuery(
                (c) =>
                    c
                        .from('pagamentos')
                        .select(`
                            *,
                            parcelas(
                                numero,
                                vencimento,
                                valor,
                                valor_pago,
                                vendas(
                                    descricao,
                                    clientes(nome)
                                )
                            )
                        `)
                        .order(
                            'data_pagamento',
                            {
                                ascending:false
                            }
                        )
            ) || [];


        table.innerHTML =

            rows.length

                ? rows
                    .map(
                        (p) => `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        p.parcelas
                                            ?.vendas
                                            ?.clientes
                                            ?.nome ||
                                        '—'
                                    )}
                                </td>


                                <td>
                                    ${
                                        p.parcelas
                                            ?.numero ||
                                        '—'
                                    }
                                </td>


                                <td>
                                    ${money(
                                        p.valor
                                    )}
                                </td>


                                <td>
                                    ${dateFormat(
                                        p.data_pagamento
                                    )}
                                </td>


                                <td>
                                    ${escapeHTML(
                                        p.forma_pagamento ||
                                        '—'
                                    )}
                                </td>


                                <td>
                                    ${escapeHTML(
                                        p.id_transacao ||
                                        '—'
                                    )}
                                </td>


                                <td>

                                    ${
                                        typeof statusHTML ===
                                        'function'

                                            ? statusHTML(
                                                'paga',
                                                p.status ||
                                                'Confirmado'
                                            )

                                            : `
                                                <span>
                                                    Confirmado
                                                </span>
                                            `
                                    }

                                </td>


                                <td>

                                    <button
                                        type="button"
                                        class="btn btn-danger delete-payment"
                                        data-id="${escapeHTML(p.id)}"
                                    >
                                        Excluir
                                    </button>

                                </td>

                            </tr>

                        `
                    )
                    .join('')

                :

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


        table
            .querySelectorAll(
                '.delete-payment'
            )
            .forEach(
                (button) => {

                    button.onclick =
                        () =>
                            deletePayment(
                                button.dataset.id
                            );

                }
            );


    } catch (error) {

        console.error(
            'ZER01 — Erro no histórico:',
            error
        );


        table.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty"
                >
                    Não foi possível carregar
                    o histórico de pagamentos.
                </td>

            </tr>

        `;

    }

}


/* =========================================================
EXCLUI PAGAMENTO
========================================================= */

async function deletePayment(
    paymentId
) {

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
                        .from('pagamentos')
                        .select(
                            'id,parcela_id'
                        )
                        .eq(
                            'id',
                            paymentId
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
                    .from('pagamentos')
                    .delete()
                    .eq(
                        'id',
                        paymentId
                    )
        );


        const pagamentosRestantes =
            await supabaseQuery(
                (c) =>
                    c
                        .from('pagamentos')
                        .select(
                            'valor,data_pagamento'
                        )
                        .eq(
                            'parcela_id',
                            parcelaId
                        )
                        .order(
                            'data_pagamento',
                            {
                                ascending:false
                            }
                        )
            ) || [];


        const totalPago =
            pagamentosRestantes.reduce(
                (total, item) =>
                    total +
                    Number(
                        item.valor || 0
                    ),

                0
            );


        const parcela =
            await supabaseQuery(
                (c) =>
                    c
                        .from('parcelas')
                        .select(
                            'id,valor'
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
                parcela.valor || 0
            );


        const novoStatus =
            totalPago >=
            valorParcela
                ? 'paga'
                : 'pendente';


        const ultimaData =
            pagamentosRestantes.length
                ? pagamentosRestantes[0]
                    .data_pagamento
                : null;


        await supabaseQuery(
            (c) =>
                c
                    .from('parcelas')
                    .update({

                        status:
                            novoStatus,

                        valor_pago:
                            totalPago,

                        data_pagamento:
                            novoStatus ===
                            'paga'
                                ? ultimaData
                                : null

                    })
                    .eq(
                        'id',
                        parcelaId
                    )
        );


        notify(
            'Recebimento excluído e parcela atualizada.'
        );


        await Promise.all([
            loadPayments(),
            loadOpenInstallments()
        ]);


    } catch (error) {

        console.error(
            'ZER01 — Erro ao excluir:',
            error
        );


        notify(
            error.message ||
            'Erro ao excluir recebimento.',
            'error'
        );

    }

}


/* =========================================================
INICIALIZAÇÃO
========================================================= */

function initPaymentsPage() {

    /*
     * Impede que o script seja inicializado
     * duas vezes.
     */

    if (
        paymentsPageInitialized
    ) {

        return;

    }


    /*
     * Só inicializa quando a tabela
     * principal de pagamentos existir.
     */

    const paymentsTable =
        document.getElementById(
            'payments-table'
        );


    if (!paymentsTable) {

        console.warn(
            'ZER01: página de pagamentos ainda não está pronta.'
        );

        return;

    }


    paymentsPageInitialized =
        true;


    injectPaymentStyles();


    createOpenPaymentsArea();


    /*
     * Botão principal
     */

    const newPayment =
        document.getElementById(
            'new-payment'
        );


    if (newPayment) {

        newPayment.onclick =
            () => {

                openPaymentModal();

            };

    }


    /*
     * Carrega histórico
     */

    loadPayments();


    /*
     * Carrega parcelas
     */

    loadOpenInstallments();

}


/* =========================================================
INICIA
========================================================= */

function startPaymentsPage() {

    initPaymentsPage();


    /*
     * Caso o script tenha sido executado
     * antes da página terminar de montar,
     * tenta novamente.
     */

    if (
        !paymentsPageInitialized
    ) {

        setTimeout(
            initPaymentsPage,
            300
        );

    }

}


if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        startPaymentsPage
    );

} else {

    startPaymentsPage();

}
