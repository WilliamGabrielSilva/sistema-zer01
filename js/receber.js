let receivables = [];

let currentFilter = 'todos';
let currentClient = '';
let currentMonth = '';

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function receberSafe(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

}

function receberMoney(value) {

    return Number(value || 0).toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );

}

function receberDateBR(value) {

    if (!value) {
        return '—';
    }

    const date =
        new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString(
        'pt-BR'
    );

}

function receberToday() {

    const date = new Date();

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, '0');

    const day =
        String(date.getDate())
            .padStart(2, '0');

    return `${year}-${month}-${day}`;

}

function receberDate(days = 0) {

    const date = new Date();

    date.setHours(0, 0, 0, 0);

    date.setDate(
        date.getDate() + days
    );

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, '0');

    const day =
        String(date.getDate())
            .padStart(2, '0');

    return `${year}-${month}-${day}`;

}

function receberDiffDays(dateString) {

    if (!dateString) {
        return 0;
    }

    const today =
        new Date(
            `${receberToday()}T00:00:00`
        );

    const date =
        new Date(
            `${dateString}T00:00:00`
        );

    return Math.round(
        (
            date.getTime() -
            today.getTime()
        ) /
        (1000 * 60 * 60 * 24)
    );

}

/* =========================================================
   STATUS
========================================================= */

function receberSaldo(parcela) {

    const valor =
        Number(parcela.valor || 0);

    const pago =
        Number(
            parcela.valor_pago ||
            parcela.total_pago ||
            0
        );

    return Math.max(
        valor - pago,
        0
    );

}

function receberValorPago(parcela) {

    const valor =
        Number(parcela.valor || 0);

    let pago =
        Number(
            parcela.valor_pago ||
            parcela.total_pago ||
            0
        );

    /*
       Se estiver marcada como paga, mas não
       tiver valor_pago registrado, considera
       o valor integral como recebido.
    */

    if (
        parcela.status === 'paga' &&
        pago <= 0
    ) {

        pago = valor;

    }

    return Math.min(
        pago,
        valor
    );

}

function receberStatus(parcela) {

    const saldo =
        receberSaldo(parcela);

    if (saldo <= 0) {
        return 'paga';
    }

    if (
        receberDiffDays(
            parcela.vencimento
        ) < 0
    ) {

        return 'atrasada';

    }

    const pago =
        receberValorPago(parcela);

    if (pago > 0) {
        return 'parcial';
    }

    return 'pendente';

}

function receberStatusLabel(status) {

    const labels = {

        paga: 'Paga',

        parcial: 'Parcial',

        atrasada: 'Atrasada',

        pendente: 'Pendente'

    };

    return (
        labels[status] ||
        status
    );

}

function receberStatusHTML(status) {

    return `
        <span class="status status-${receberSafe(status)}">
            ${receberSafe(
                receberStatusLabel(status)
            )}
        </span>
    `;

}

/* =========================================================
   CARREGAR CONTAS
========================================================= */

async function loadReceivables() {

    try {

        const data =
            await supabaseQuery((q) =>
                q
                    .from('parcelas')
                    .select(`
                        *,
                        vendas (
                            id,
                            descricao,
                            cliente_id,
                            data_venda,
                            valor_total,
                            quantidade_parcelas,
                            clientes (
                                nome,
                                cpf_cnpj,
                                telefone,
                                endereco
                            )
                        )
                    `)
                    .order(
                        'vencimento',
                        {
                            ascending: true
                        }
                    )
            );

        receivables =
            data || [];

        preencherClientes();

        renderReceivables();

        renderForecast();

    } catch (error) {

        console.error(
            'Erro ao carregar contas:',
            error
        );

        const table =
            document.getElementById(
                'receivables-table'
            );

        if (table) {

            table.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty">

                        Não foi possível carregar
                        as contas a receber.

                    </td>
                </tr>
            `;

        }

        toast(
            error?.message ||
            'Erro ao carregar contas a receber.',
            'error'
        );

    }

}

/* =========================================================
   PREENCHER CLIENTES
========================================================= */

function preencherClientes() {

    const select =
        document.getElementById(
            'receivable-client'
        );

    if (!select) {
        return;
    }

    const clientes =
        new Map();

    receivables.forEach(
        (item) => {

            const venda =
                item.vendas;

            if (
                !venda ||
                !venda.clientes
            ) {

                return;

            }

            const clienteId =
                venda.cliente_id;

            if (!clienteId) {
                return;
            }

            if (
                !clientes.has(
                    clienteId
                )
            ) {

                clientes.set(
                    clienteId,
                    venda.clientes.nome ||
                    'Cliente'
                );

            }

        }
    );

    const lista =
        [...clientes.entries()]
            .sort(
                (a, b) =>
                    String(a[1]).localeCompare(
                        String(b[1]),
                        'pt-BR'
                    )
            );

    select.innerHTML = `

        <option value="">
            Todos os clientes
        </option>

        ${lista.map(
            ([id, nome]) => `
                <option value="${receberSafe(id)}">
                    ${receberSafe(nome)}
                </option>
            `
        ).join('')}

    `;

    select.value =
        currentClient;

}

/* =========================================================
   FILTRO CLIENTE
========================================================= */

function filtrarPorCliente(lista) {

    if (!currentClient) {
        return lista;
    }

    return lista.filter(
        (item) =>
            String(
                item.vendas?.cliente_id || ''
            ) ===
            String(currentClient)
    );

}

/* =========================================================
   FILTRO MÊS
========================================================= */

function filtrarPorMes(lista) {

    if (!currentMonth) {
        return lista;
    }

    return lista.filter(
        (item) => {

            if (!item.vencimento) {
                return false;
            }

            return item.vencimento
                .startsWith(
                    currentMonth
                );

        }
    );

}

/* =========================================================
   FILTROS RÁPIDOS
========================================================= */

function filtrarPorPeriodo(lista) {

    const hoje =
        receberToday();

    const amanha =
        receberDate(1);

    if (
        currentFilter ===
        'todos'
    ) {

        return lista;

    }

    if (
        currentFilter ===
        'hoje'
    ) {

        return lista.filter(
            item =>
                item.vencimento ===
                hoje
        );

    }

    if (
        currentFilter ===
        'amanha'
    ) {

        return lista.filter(
            item =>
                item.vencimento ===
                amanha
        );

    }

    if (
        currentFilter ===
        '7dias'
    ) {

        const limite =
            receberDate(7);

        return lista.filter(
            item => {

                if (!item.vencimento) {
                    return false;
                }

                return (
                    item.vencimento >=
                    hoje &&
                    item.vencimento <=
                    limite
                );

            }
        );

    }

    if (
        currentFilter ===
        'atrasadas'
    ) {

        return lista.filter(
            item =>
                receberStatus(item) ===
                'atrasada'
        );

    }

    if (
        currentFilter ===
        'pagas'
    ) {

        return lista.filter(
            item =>
                receberStatus(item) ===
                'paga'
        );

    }

    return lista;

}

/* =========================================================
   TODOS OS FILTROS
========================================================= */

function getFilteredReceivables() {

    let lista =
        [...receivables];

    lista =
        filtrarPorCliente(
            lista
        );

    lista =
        filtrarPorMes(
            lista
        );

    lista =
        filtrarPorPeriodo(
            lista
        );

    return lista;

}

/* =========================================================
   CARDS
========================================================= */

function atualizarTotal() {

    const lista =
        getFilteredReceivables();

    const totalGeral =
        lista.reduce(
            (sum, parcela) =>
                sum +
                Number(
                    parcela.valor || 0
                ),
            0
        );

    const totalRecebido =
        lista.reduce(
            (sum, parcela) =>
                sum +
                receberValorPago(
                    parcela
                ),
            0
        );

    const totalAReceber =
        lista.reduce(
            (sum, parcela) =>
                sum +
                receberSaldo(
                    parcela
                ),
            0
        );

    const totalAtrasado =
        lista.reduce(
            (sum, parcela) => {

                if (
                    receberStatus(
                        parcela
                    ) !== 'atrasada'
                ) {

                    return sum;

                }

                return (
                    sum +
                    receberSaldo(
                        parcela
                    )
                );

            },
            0
        );

    document
        .getElementById(
            'receivable-general'
        )
        ?.replaceChildren(
            document.createTextNode(
                receberMoney(
                    totalGeral
                )
            )
        );

    document
        .getElementById(
            'receivable-received'
        )
        ?.replaceChildren(
            document.createTextNode(
                receberMoney(
                    totalRecebido
                )
            )
        );

    document
        .getElementById(
            'receivable-total'
        )
        ?.replaceChildren(
            document.createTextNode(
                receberMoney(
                    totalAReceber
                )
            )
        );

    document
        .getElementById(
            'receivable-overdue'
        )
        ?.replaceChildren(
            document.createTextNode(
                receberMoney(
                    totalAtrasado
                )
            )
        );

    const overdueCount =
        lista.filter(
            parcela =>
                receberStatus(
                    parcela
                ) === 'atrasada'
        ).length;

    const overdueDescription =
        document.getElementById(
            'receivable-overdue-description'
        );

    if (overdueDescription) {

        overdueDescription.textContent =
            `${overdueCount} parcela(s) atrasada(s)`;

    }

}

/* =========================================================
   PREVISÃO DE RECEBIMENTOS
========================================================= */

function renderForecast() {

    const list =
        document.getElementById(
            'forecast-list'
        );

    const totalElement =
        document.getElementById(
            'forecast-total'
        );

    const title =
        document.getElementById(
            'forecast-title'
        );

    const description =
        document.getElementById(
            'forecast-description'
        );

    if (!list) {
        return;
    }

    /*
       A previsão utiliza exatamente os mesmos
       filtros da tabela.
    */

    const lista =
        getFilteredReceivables();

    /*
       Agrupamos pelo vencimento.
    */

    const dias =
        new Map();

    lista.forEach(
        (parcela) => {

            /*
               Parcelas pagas não entram na previsão,
               pois não há mais nada para receber.
            */

            const saldo =
                receberSaldo(
                    parcela
                );

            if (
                saldo <= 0 ||
                !parcela.vencimento
            ) {

                return;

            }

            const data =
                parcela.vencimento;

            if (!dias.has(data)) {

                dias.set(
                    data,
                    {
                        total: 0,
                        parcelas: 0
                    }
                );

            }

            const registro =
                dias.get(data);

            registro.total +=
                saldo;

            registro.parcelas += 1;

        }
    );

    /*
       Ordenar por data.
    */

    const ordenados =
        [...dias.entries()]
            .sort(
                (a, b) =>
                    a[0].localeCompare(
                        b[0]
                    )
            );

    const totalPrevisto =
        ordenados.reduce(
            (sum, [, item]) =>
                sum + item.total,
            0
        );

    if (totalElement) {

        totalElement.textContent =
            receberMoney(
                totalPrevisto
            );

    }

    /*
       Título da previsão.
    */

    if (title) {

        if (currentMonth) {

            const [ano, mes] =
                currentMonth.split('-');

            const data =
                new Date(
                    Number(ano),
                    Number(mes) - 1,
                    1
                );

            let nomeMes =
                data.toLocaleDateString(
                    'pt-BR',
                    {
                        month: 'long',
                        year: 'numeric'
                    }
                );

            nomeMes =
                nomeMes.charAt(0)
                    .toUpperCase() +
                nomeMes.slice(1);

            title.textContent =
                `Previsão de recebimentos — ${nomeMes}`;

        } else {

            title.textContent =
                'Previsão de recebimentos';

        }

    }

    if (description) {

        if (currentClient) {

            const select =
                document.getElementById(
                    'receivable-client'
                );

            const option =
                select?.options[
                    select.selectedIndex
                ];

            description.textContent =
                `Previsão para ${option?.text || 'cliente selecionado'}.`;

        } else {

            description.textContent =
                'Quanto está previsto para entrar em cada dia.';

        }

    }

    /*
       Nenhum recebimento.
    */

    if (!ordenados.length) {

        list.innerHTML = `
            <div
                class="empty"
                style="
                    padding:25px;
                    text-align:center;
                ">

                Nenhum recebimento previsto
                para os filtros selecionados.

            </div>
        `;

        return;

    }

    /*
       Renderização dos dias.
    */

    list.innerHTML =
        ordenados.map(
            ([data, item]) => {

                const atrasado =
                    receberDiffDays(
                        data
                    ) < 0;

                const hoje =
                    data ===
                    receberToday();

                let labelData =
                    receberDateBR(
                        data
                    );

                if (hoje) {

                    labelData +=
                        ' · HOJE';

                } else if (atrasado) {

                    labelData +=
                        ' · ATRASADO';

                }

                return `
                    <div
                        style="
                            display:grid;
                            grid-template-columns:
                                minmax(100px, 150px)
                                1fr
                                auto;
                            align-items:center;
                            gap:15px;
                            padding:14px 16px;
                            border:1px solid var(--line);
                            border-radius:10px;
                        ">

                        <div>

                            <strong
                                style="
                                    display:block;
                                ">

                                ${receberSafe(
                                    labelData
                                )}

                            </strong>

                            <small
                                style="
                                    color:var(--muted);
                                ">

                                ${item.parcelas}
                                ${
                                    item.parcelas === 1
                                        ? 'parcela'
                                        : 'parcelas'
                                }

                            </small>

                        </div>

                        <div
                            style="
                                height:6px;
                                border-radius:10px;
                                background:var(--line);
                                overflow:hidden;
                            ">

                            <div
                                style="
                                    height:100%;
                                    width:${totalPrevisto > 0
                                        ? Math.min(
                                            100,
                                            (
                                                item.total /
                                                totalPrevisto
                                            ) * 100
                                        )
                                        : 0
                                    }%;
                                    background:currentColor;
                                ">
                            </div>

                        </div>

                        <strong
                            style="
                                font-size:16px;
                                white-space:nowrap;
                            ">

                            ${receberMoney(
                                item.total
                            )}

                        </strong>

                    </div>
                `;

            }
        ).join('');

}

/* =========================================================
   RENDERIZAR TABELA
========================================================= */

function renderReceivables() {

    const table =
        document.getElementById(
            'receivables-table'
        );

    if (!table) {
        return;
    }

    const lista =
        getFilteredReceivables();

    atualizarTotal();

    renderForecast();

    if (!lista.length) {

        table.innerHTML = `
            <tr>

                <td
                    colspan="7"
                    class="empty">

                    Nenhuma conta encontrada
                    com os filtros selecionados.

                </td>

            </tr>
        `;

        return;

    }

    table.innerHTML =
        lista.map(
            (parcela) => {

                const venda =
                    parcela.vendas || {};

                const cliente =
                    venda.clientes || {};

                const status =
                    receberStatus(
                        parcela
                    );

                const valor =
                    Number(
                        parcela.valor || 0
                    );

                const pago =
                    receberValorPago(
                        parcela
                    );

                const saldo =
                    receberSaldo(
                        parcela
                    );

                const vendaDescricao =
                    venda.descricao ||
                    'Venda';

                const clienteNome =
                    cliente.nome ||
                    'Cliente não informado';

                const parcelaNumero =
                    parcela.numero ||
                    1;

                const totalParcelas =
                    venda.quantidade_parcelas ||
                    '?';

                return `
                    <tr>

                        <td>

                            <strong>
                                ${receberSafe(
                                    clienteNome
                                )}
                            </strong>

                        </td>

                        <td>

                            <span
                                title="${receberSafe(
                                    vendaDescricao
                                )}">

                                ${receberSafe(
                                    vendaDescricao.length > 35
                                        ? vendaDescricao.slice(
                                            0,
                                            35
                                        ) + '...'
                                        : vendaDescricao
                                )}

                            </span>

                        </td>

                        <td>

                            ${receberSafe(
                                parcelaNumero
                            )}/${receberSafe(
                                totalParcelas
                            )}

                        </td>

                        <td>

                            <strong>
                                ${receberMoney(
                                    valor
                                )}
                            </strong>

                            ${
                                pago > 0 &&
                                saldo > 0
                                    ? `
                                        <small
                                            style="
                                                display:block;
                                                color:var(--muted);
                                                margin-top:3px;
                                            ">

                                            Pago:
                                            ${receberMoney(
                                                pago
                                            )}

                                        </small>

                                        <small
                                            style="
                                                display:block;
                                                color:var(--muted);
                                            ">

                                            Restante:
                                            ${receberMoney(
                                                saldo
                                            )}

                                        </small>
                                    `
                                    : ''
                            }

                        </td>

                        <td>

                            ${receberDateBR(
                                parcela.vencimento
                            )}

                        </td>

                        <td>

                            ${receberStatusHTML(
                                status
                            )}

                        </td>

                        <td>

                            <div
                                style="
                                    display:flex;
                                    gap:6px;
                                    flex-wrap:wrap;
                                ">

                                ${
                                    saldo > 0
                                        ? `
                                            <button
                                                class="btn btn-primary receive-installment"
                                                data-id="${receberSafe(
                                                    parcela.id
                                                )}">

                                                Receber

                                            </button>
                                        `
                                        : ''
                                }

                                ${
                                    venda.id
                                        ? `
                                            <button
                                                class="btn btn-ghost generate-carne"
                                                data-id="${receberSafe(
                                                    venda.id
                                                )}">

                                                CARNÊ

                                            </button>
                                        `
                                        : ''
                                }

                            </div>

                        </td>

                    </tr>
                `;

            }
        ).join('');

    /*
       Botões receber
    */

    document
        .querySelectorAll(
            '.receive-installment'
        )
        .forEach(
            (button) => {

                button.onclick =
                    () =>
                        receberParcela(
                            button.dataset.id
                        );

            }
        );

    /*
       Botões carnê
    */

    document
        .querySelectorAll(
            '.generate-carne'
        )
        .forEach(
            (button) => {

                button.onclick =
                    async () => {

                        const vendaId =
                            button.dataset.id;

                        if (
                            typeof window
                                .gerarCarneVenda !==
                            'function'
                        ) {

                            toast(
                                'O módulo do carnê não foi carregado.',
                                'error'
                            );

                            return;

                        }

                        try {

                            await window
                                .gerarCarneVenda(
                                    vendaId
                                );

                        } catch (error) {

                            console.error(
                                'Erro ao gerar carnê:',
                                error
                            );

                            toast(
                                error?.message ||
                                'Não foi possível gerar o carnê.',
                                'error'
                            );

                        }

                    };

            }
        );

}

/* =========================================================
   RECEBER PARCELA
========================================================= */

async function receberParcela(id) {

    const parcela =
        receivables.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!parcela) {

        toast(
            'Parcela não encontrada.',
            'error'
        );

        return;

    }

    const valor =
        Number(
            parcela.valor || 0
        );

    const pagoAtual =
        receberValorPago(
            parcela
        );

    const saldo =
        Math.max(
            valor - pagoAtual,
            0
        );

    if (saldo <= 0) {

        toast(
            'Esta parcela já está totalmente paga.',
            'error'
        );

        return;

    }

    const entrada =
        prompt(
            `Valor a receber agora:\n\nSaldo restante: ${receberMoney(
                saldo
            )}\n\nDigite o valor do pagamento:`,
            saldo.toFixed(2)
        );

    if (entrada === null) {
        return;
    }

    const valorRecebido =
        Number(
            String(entrada)
                .replace(',', '.')
        );

    if (
        !Number.isFinite(
            valorRecebido
        ) ||
        valorRecebido <= 0
    ) {

        toast(
            'Informe um valor válido.',
            'error'
        );

        return;

    }

    if (
        valorRecebido >
        saldo
    ) {

        toast(
            'O valor recebido não pode ser maior que o saldo da parcela.',
            'error'
        );

        return;

    }

    const novoPago =
        pagoAtual +
        valorRecebido;

    const novoStatus =
        novoPago >= valor
            ? 'paga'
            : 'pendente';

    try {

        /*
           Atualiza parcela
        */

        await supabaseQuery(
            (q) =>
                q
                    .from('parcelas')
                    .update({
                        valor_pago:
                            novoPago,

                        status:
                            novoStatus
                    })
                    .eq(
                        'id',
                        id
                    )
        );

        /*
           Registra pagamento
        */

        await supabaseQuery(
            (q) =>
                q
                    .from('pagamentos')
                    .insert({

                        parcela_id:
                            parcela.id,

                        venda_id:
                            parcela.venda_id,

                        cliente_id:
                            parcela.vendas
                                ?.cliente_id ||
                            null,

                        valor:
                            valorRecebido,

                        data_pagamento:
                            receberToday()

                    })
        );

        toast(
            novoStatus === 'paga'
                ? 'Parcela paga com sucesso.'
                : 'Pagamento parcial registrado.'
        );

        await loadReceivables();

    } catch (error) {

        console.error(
            'Erro ao registrar pagamento:',
            error
        );

        toast(
            error?.message ||
            'Não foi possível registrar o pagamento.',
            'error'
        );

    }

}

/* =========================================================
   EVENTO — CLIENTE
========================================================= */

document
    .getElementById(
        'receivable-client'
    )
    ?.addEventListener(
        'change',
        (event) => {

            currentClient =
                event.target.value ||
                '';

            renderReceivables();

        }
    );

/* =========================================================
   EVENTO — MÊS
========================================================= */

document
    .getElementById(
        'receivable-month'
    )
    ?.addEventListener(
        'change',
        (event) => {

            currentMonth =
                event.target.value ||
                '';

            renderReceivables();

        }
    );

/* =========================================================
   EVENTO — FILTROS RÁPIDOS
========================================================= */

document
    .querySelectorAll(
        '.filter'
    )
    .forEach(
        (button) => {

            button.addEventListener(
                'click',
                () => {

                    document
                        .querySelectorAll(
                            '.filter'
                        )
                        .forEach(
                            (item) =>
                                item.classList
                                    .remove(
                                        'active'
                                    )
                        );

                    button.classList.add(
                        'active'
                    );

                    currentFilter =
                        button.dataset
                            .filter ||
                        'todos';

                    renderReceivables();

                }
            );

        }
    );

/* =========================================================
   EVENTO — LIMPAR FILTROS
========================================================= */

document
    .getElementById(
        'clear-receivable-filters'
    )
    ?.addEventListener(
        'click',
        () => {

            currentClient =
                '';

            currentMonth =
                '';

            currentFilter =
                'todos';

            const client =
                document.getElementById(
                    'receivable-client'
                );

            const month =
                document.getElementById(
                    'receivable-month'
                );

            if (client) {
                client.value = '';
            }

            if (month) {
                month.value = '';
            }

            document
                .querySelectorAll(
                    '.filter'
                )
                .forEach(
                    (button) => {

                        button.classList
                            .remove(
                                'active'
                            );

                        if (
                            button.dataset
                                .filter ===
                            'todos'
                        ) {

                            button.classList
                                .add(
                                    'active'
                                );

                        }

                    }
                );

            renderReceivables();

        }
    );

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

loadReceivables();
