/* =========================================================
   CLIENTES — SISTEMA ZER01
   Cadastro, edição, dívida existente e exclusão.
   Fonte única de dados: Supabase
   ========================================================= */

let clients = [];


/* =========================================================
   CARREGAR CLIENTES
   ========================================================= */

async function loadClients() {

    clients =
        await supabaseQuery(
            (c) =>
                c
                    .from('clientes')
                    .select('*')
                    .order('nome')
        ) || [];

    renderClients();
}


/* =========================================================
   RENDERIZAR CLIENTES
   ========================================================= */

function renderClients() {

    const term =
        (
            document
                .getElementById('client-search')
                ?.value ||
            ''
        )
        .toLowerCase()
        .trim();


    const rows =
        clients.filter(
            (c) =>
                [
                    c.nome,
                    c.cpf_cnpj,
                    c.telefone
                ].some(
                    (v) =>
                        safe(v)
                            .toLowerCase()
                            .includes(term)
                )
        );


    const contador =
        document.getElementById(
            'client-count'
        );


    if (contador) {

        contador.textContent =
            `${rows.length} CLIENTES`;
    }


    const tabela =
        document.getElementById(
            'clients-table'
        );


    if (!tabela) {
        return;
    }


    tabela.innerHTML =
        rows
            .map(
                (c) => {

                    /*
                       Excluir continua sendo
                       exclusivo do administrador.
                    */

                    const botaoExcluir =
                        typeof isAdmin === 'function' &&
                        isAdmin()

                        ? `
                            <button
                                class="btn btn-danger delete-client"
                                data-id="${c.id}"
                            >
                                Excluir
                            </button>
                        `
                        : '';


                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${safe(c.nome)}
                                </strong>
                            </td>

                            <td>
                                ${display(c.cpf_cnpj)}
                            </td>

                            <td>
                                ${display(c.telefone)}
                            </td>

                            <td>
                                —
                            </td>

                            <td>
                                ${statusHTML(
                                    'pendente',
                                    'Ativo'
                                )}
                            </td>

                            <td>

                                <button
                                    class="btn btn-ghost view-client"
                                    data-id="${c.id}"
                                >
                                    Ver
                                </button>

                                <button
                                    class="btn btn-ghost edit-client"
                                    data-id="${c.id}"
                                >
                                    Editar
                                </button>

                                ${botaoExcluir}

                            </td>

                        </tr>
                    `;
                }
            )
            .join('') ||

        `
            <tr>
                <td
                    colspan="6"
                    class="empty"
                >
                    Nenhum cliente encontrado.
                </td>
            </tr>
        `;


    /* =====================================================
       BOTÃO VER
       ===================================================== */

    document
        .querySelectorAll('.view-client')
        .forEach(
            (button) => {

                button.onclick =
                    () =>
                        viewClient(
                            button.dataset.id
                        );
            }
        );


    /* =====================================================
       BOTÃO EDITAR
       ===================================================== */

    document
        .querySelectorAll('.edit-client')
        .forEach(
            (button) => {

                button.onclick =
                    () =>
                        editClient(
                            button.dataset.id
                        );
            }
        );


    /* =====================================================
       BOTÃO EXCLUIR
       ===================================================== */

    document
        .querySelectorAll('.delete-client')
        .forEach(
            (button) => {

                button.onclick =
                    () =>
                        deleteClient(
                            button.dataset.id
                        );
            }
        );
}


/* =========================================================
   MODAL DE EDIÇÃO
   ========================================================= */

function editClient(id) {

    const client =
        clients.find(
            (item) =>
                item.id === id
        );


    if (!client) {

        toast(
            'Cliente não encontrado.',
            'error'
        );

        return;
    }


    document
        .getElementById(
            'client-modal'
        )
        .innerHTML = `

        <div class="modal">

            <form
                class="modal-card"
                id="edit-client-form"
            >

                <div class="modal-head">

                    <div>

                        <span class="eyebrow">
                            EDITAR CLIENTE
                        </span>

                        <h3>
                            ${safe(client.nome)}
                        </h3>

                    </div>

                    <button
                        type="button"
                        class="icon-btn close-modal"
                    >
                        ×
                    </button>

                </div>


                <div class="form-grid">

                    <div class="field full">

                        <label>
                            Nome *
                        </label>

                        <input
                            id="edit-client-name"
                            value="${safe(client.nome)}"
                            required
                        >

                    </div>


                    <div class="field">

                        <label>
                            CPF/CNPJ
                        </label>

                        <input
                            id="edit-client-doc"
                            value="${safe(client.cpf_cnpj)}"
                        >

                    </div>


                    <div class="field">

                        <label>
                            Telefone
                        </label>

                        <input
                            id="edit-client-phone"
                            value="${safe(client.telefone)}"
                        >

                    </div>


                    <div class="field full">

                        <label>
                            Endereço
                        </label>

                        <input
                            id="edit-client-address"
                            value="${safe(client.endereco)}"
                        >

                    </div>


                    <div class="field full">

                        <label>
                            Observações
                        </label>

                        <textarea
                            id="edit-client-notes"
                        >${safe(client.observacoes)}</textarea>

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
                        class="btn close-modal"
                    >
                        Cancelar
                    </button>


                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </div>
    `;


    /* =====================================================
       FECHAR MODAL
       ===================================================== */

    document
        .querySelectorAll('.close-modal')
        .forEach(
            (button) => {

                button.onclick =
                    () => {

                        document
                            .getElementById(
                                'client-modal'
                            )
                            .innerHTML = '';
                    };
            }
        );


    /* =====================================================
       MÁSCARA CPF / CNPJ
       ===================================================== */

    document
        .getElementById(
            'edit-client-doc'
        )
        .oninput =
            (event) => {

                event.target.value =
                    maskDoc(
                        event.target.value
                    );
            };


    /* =====================================================
       MÁSCARA TELEFONE
       ===================================================== */

    document
        .getElementById(
            'edit-client-phone'
        )
        .oninput =
            (event) => {

                event.target.value =
                    maskPhone(
                        event.target.value
                    );
            };


    /* =====================================================
       SALVAR EDIÇÃO
       ===================================================== */

    document
        .getElementById(
            'edit-client-form'
        )
        .onsubmit =
            (event) =>
                saveClientEdit(
                    event,
                    id
                );
}


/* =========================================================
   SALVAR ALTERAÇÕES DO CLIENTE
   ========================================================= */

async function saveClientEdit(
    event,
    id
) {

    event.preventDefault();


    try {

        const nome =
            document
                .getElementById(
                    'edit-client-name'
                )
                .value
                .trim();


        if (!nome) {

            toast(
                'Informe o nome do cliente.',
                'error'
            );

            return;
        }


        await supabaseQuery(
            (c) =>
                c
                    .from('clientes')
                    .update({

                        nome:
                            nome,

                        cpf_cnpj:
                            document
                                .getElementById(
                                    'edit-client-doc'
                                )
                                .value
                                .trim() ||
                            null,

                        telefone:
                            document
                                .getElementById(
                                    'edit-client-phone'
                                )
                                .value
                                .trim() ||
                            null,

                        endereco:
                            document
                                .getElementById(
                                    'edit-client-address'
                                )
                                .value
                                .trim() ||
                            null,

                        observacoes:
                            document
                                .getElementById(
                                    'edit-client-notes'
                                )
                                .value
                                .trim() ||
                            null

                    })
                    .eq(
                        'id',
                        id
                    )
        );


        toast(
            'Cliente atualizado com sucesso.'
        );


        document
            .getElementById(
                'client-modal'
            )
            .innerHTML = '';


        await loadClients();

    } catch (error) {

        toast(
            error.message ||
            'Não foi possível atualizar o cliente.',
            'error'
        );
    }
}


/* =========================================================
   GERAR PARCELAS DA DÍVIDA EXISTENTE
   ========================================================= */

function debtRows() {

    const total =
        Number(
            document
                .getElementById(
                    'debt-total'
                )
                ?.value
        ) || 0;


    const count =
        Number(
            document
                .getElementById(
                    'debt-count'
                )
                ?.value
        ) || 1;


    const cents =
        Math.round(
            total * 100
        );


    const baseCents =
        Math.floor(
            cents / count
        );


    const remainderCents =
        cents -
        (
            baseCents *
            count
        );


    return Array
        .from(
            {
                length: count
            },
            (_, index) => {

                const date =
                    new Date();


                date.setDate(
                    date.getDate() +
                    30 *
                    (index + 1)
                );


                const valueCents =
                    baseCents +
                    (
                        index <
                        remainderCents
                            ? 1
                            : 0
                    );


                const value =
                    valueCents /
                    100;


                return `
                    <div
                        class="form-grid"
                        style="margin-top:10px"
                    >

                        <div class="field">

                            <label>
                                Parcela ${index + 1} — valor
                            </label>

                            <input
                                class="debt-value"
                                type="number"
                                min="0"
                                step="0.01"
                                value="${value.toFixed(2)}"
                            >

                        </div>


                        <div class="field">

                            <label>
                                Vencimento individual
                            </label>

                            <input
                                class="debt-date"
                                type="date"
                                value="${date
                                    .toISOString()
                                    .slice(0, 10)}"
                            >

                        </div>

                    </div>
                `;
            }
        )
        .join('');
}


/* =========================================================
   FORMULÁRIO DE NOVO CLIENTE
   ========================================================= */

function formModal() {

    document
        .getElementById(
            'client-modal'
        )
        .innerHTML = `

        <div class="modal">

            <form
                class="modal-card"
                id="client-form"
            >

                <div class="modal-head">

                    <div>

                        <span class="eyebrow">
                            NOVO CADASTRO
                        </span>

                        <h3>
                            Novo cliente
                        </h3>

                    </div>

                    <button
                        type="button"
                        class="icon-btn close-modal"
                    >
                        ×
                    </button>

                </div>


                <div class="form-grid">

                    <div class="field full">

                        <label>
                            Nome *
                        </label>

                        <input
                            id="client-name"
                            required
                        >

                    </div>


                    <div class="field">

                        <label>
                            CPF/CNPJ
                        </label>

                        <input
                            id="client-doc"
                        >

                    </div>


                    <div class="field">

                        <label>
                            Telefone
                        </label>

                        <input
                            id="client-phone"
                        >

                    </div>


                    <div class="field full">

                        <label>
                            Endereço
                        </label>

                        <input
                            id="client-address"
                        >

                    </div>


                    <div class="field full">

                        <label>
                            Observações
                        </label>

                        <textarea
                            id="client-notes"
                        ></textarea>

                    </div>

                </div>


                <div
                    style="
                        margin-top:20px;
                        padding-top:18px;
                        border-top:1px solid var(--line)
                    "
                >

                    <label
                        style="
                            color:var(--muted);
                            font-size:12px
                        "
                    >
                        Este cliente possui uma dívida existente?
                    </label>


                    <div
                        style="
                            display:flex;
                            gap:8px;
                            margin-top:10px
                        "
                    >

                        <button
                            type="button"
                            class="btn debt-choice"
                            data-value="nao"
                        >
                            NÃO
                        </button>


                        <button
                            type="button"
                            class="btn debt-choice"
                            data-value="sim"
                        >
                            SIM
                        </button>

                    </div>


                    <div
                        id="debt-area"
                        hidden
                        style="margin-top:16px"
                    >

                        <div class="form-grid">

                            <div class="field full">

                                <label>
                                    Descrição da dívida *
                                </label>

                                <input
                                    id="debt-description"
                                    placeholder="Ex.: dívida anterior ao sistema"
                                >

                            </div>


                            <div class="field">

                                <label>
                                    Valor total *
                                </label>

                                <input
                                    id="debt-total"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                >

                            </div>


                            <div class="field">

                                <label>
                                    Quantidade de parcelas *
                                </label>

                                <input
                                    id="debt-count"
                                    type="number"
                                    min="1"
                                    value="1"
                                >

                            </div>

                        </div>


                        <button
                            type="button"
                            class="btn"
                            id="generate-debt"
                            style="margin-top:13px"
                        >
                            Gerar parcelas editáveis
                        </button>


                        <div
                            id="debt-installments"
                        ></div>

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
                        class="btn close-modal"
                    >
                        Cancelar
                    </button>


                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
                        Salvar cliente
                    </button>

                </div>

            </form>

        </div>
    `;


    document
        .querySelectorAll('.close-modal')
        .forEach(
            (button) => {

                button.onclick =
                    () => {

                        document
                            .getElementById(
                                'client-modal'
                            )
                            .innerHTML = '';
                    };
            }
        );


    document
        .getElementById(
            'client-doc'
        )
        .oninput =
            (event) => {

                event.target.value =
                    maskDoc(
                        event.target.value
                    );
            };


    document
        .getElementById(
            'client-phone'
        )
        .oninput =
            (event) => {

                event.target.value =
                    maskPhone(
                        event.target.value
                    );
            };


    document
        .querySelectorAll('.debt-choice')
        .forEach(
            (button) => {

                button.onclick =
                    () => {

                        document
                            .getElementById(
                                'debt-area'
                            )
                            .hidden =
                                button.dataset.value !==
                                'sim';
                    };
            }
        );


    document
        .getElementById(
            'generate-debt'
        )
        .onclick =
            () => {

                document
                    .getElementById(
                        'debt-installments'
                    )
                    .innerHTML =
                        debtRows();
            };


    document
        .getElementById(
            'debt-count'
        )
        .oninput =
            () => {

                if (
                    !document
                        .getElementById(
                            'debt-area'
                        )
                        .hidden
                ) {

                    document
                        .getElementById(
                            'debt-installments'
                        )
                        .innerHTML =
                            debtRows();
                }
            };


    document
        .getElementById(
            'debt-total'
        )
        .oninput =
            () => {

                if (
                    !document
                        .getElementById(
                            'debt-area'
                        )
                        .hidden
                ) {

                    document
                        .getElementById(
                            'debt-installments'
                        )
                        .innerHTML =
                            debtRows();
                }
            };


    document
        .getElementById(
            'client-form'
        )
        .onsubmit =
            saveClient;
}


/* =========================================================
   SALVAR CLIENTE
   ========================================================= */

async function saveClient(event) {

    event.preventDefault();


    try {

        const hasDebt =
            !document
                .getElementById(
                    'debt-area'
                )
                .hidden;


        const client =
            await supabaseQuery(
                (c) =>
                    c
                        .from('clientes')
                        .insert({

                            nome:
                                document
                                    .getElementById(
                                        'client-name'
                                    )
                                    .value
                                    .trim(),

                            cpf_cnpj:
                                document
                                    .getElementById(
                                        'client-doc'
                                    )
                                    .value
                                    .trim() ||
                                null,

                            telefone:
                                document
                                    .getElementById(
                                        'client-phone'
                                    )
                                    .value
                                    .trim() ||
                                null,

                            endereco:
                                document
                                    .getElementById(
                                        'client-address'
                                    )
                                    .value
                                    .trim() ||
                                null,

                            observacoes:
                                document
                                    .getElementById(
                                        'client-notes'
                                    )
                                    .value
                                    .trim() ||
                                null

                        })
                        .select()
                        .single()
            );


        if (hasDebt) {

            const values =
                [
                    ...document.querySelectorAll(
                        '.debt-value'
                    )
                ];


            const dates =
                [
                    ...document.querySelectorAll(
                        '.debt-date'
                    )
                ];


            if (
                !document
                    .getElementById(
                        'debt-description'
                    )
                    .value
                    .trim() ||
                !values.length
            ) {

                throw new Error(
                    'Gere as parcelas da dívida antes de salvar.'
                );
            }


            const sale =
                await supabaseQuery(
                    (c) =>
                        c
                            .from('vendas')
                            .insert({

                                cliente_id:
                                    client.id,

                                descricao:
                                    `Dívida existente: ${
                                        document
                                            .getElementById(
                                                'debt-description'
                                            )
                                            .value
                                            .trim()
                                    }`,

                                valor_total:
                                    values.reduce(
                                        (
                                            sum,
                                            input
                                        ) =>
                                            sum +
                                            (
                                                Number(
                                                    input.value
                                                ) || 0
                                            ),
                                        0
                                    ),

                                quantidade_parcelas:
                                    values.length,

                                data_venda:
                                    todayISO(),

                                status:
                                    'aberta'

                            })
                            .select()
                            .single()
                );


            const installments =
                values.map(
                    (
                        input,
                        index
                    ) => ({

                        venda_id:
                            sale.id,

                        numero:
                            index + 1,

                        valor:
                            Number(
                                input.value
                            ) || 0,

                        vencimento:
                            dates[index].value,

                        status:
                            'pendente'

                    })
                );


            await supabaseQuery(
                (c) =>
                    c
                        .from('parcelas')
                        .insert(
                            installments
                        )
            );
        }


        toast(
            hasDebt
                ? 'Cliente e dívida existente salvos no Supabase.'
                : 'Cliente salvo no Supabase.'
        );


        document
            .getElementById(
                'client-modal'
            )
            .innerHTML = '';


        await loadClients();

    } catch (error) {

        toast(
            error.message,
            'error'
        );
    }
}


/* =========================================================
   EXCLUIR CLIENTE
   ========================================================= */

async function deleteClient(id) {

    /*
       Somente administrador.
    */

    if (
        typeof isAdmin !== 'function' ||
        !isAdmin()
    ) {

        toast(
            'Somente o administrador pode excluir clientes.',
            'error'
        );

        return;
    }


    const client =
        clients.find(
            (item) =>
                item.id === id
        );


    if (
        !confirm(
            `Excluir o cliente ${
                client?.nome || ''
            }? Isso também excluirá vendas, parcelas e pagamentos relacionados.`
        )
    ) {
        return;
    }


    try {

        await supabaseQuery(
            (c) =>
                c
                    .from('clientes')
                    .delete()
                    .eq(
                        'id',
                        id
                    )
        );


        toast(
            'Cliente e registros relacionados excluídos.'
        );


        await loadClients();

    } catch (_) {}
}


/* =========================================================
   VISUALIZAR CLIENTE
   ========================================================= */

async function viewClient(id) {

    const client =
        clients.find(
            (item) =>
                item.id === id
        );


    if (!client) {
        return;
    }


    const sales =
        await supabaseQuery(
            (q) =>
                q
                    .from('vendas')
                    .select(`
                        *,
                        parcelas(*)
                    `)
                    .eq(
                        'cliente_id',
                        id
                    )
                    .order(
                        'data_venda',
                        {
                            ascending: false
                        }
                    )
        ) || [];


    const parts =
        sales.flatMap(
            (sale) =>
                sale.parcelas || []
        );


    document
        .getElementById(
            'client-modal'
        )
        .innerHTML = `

        <div class="modal">

            <section class="modal-card">

                <div class="modal-head">

                    <div>

                        <span class="eyebrow">
                            FICHA DO CLIENTE
                        </span>

                        <h3>
                            ${safe(client.nome)}
                        </h3>

                    </div>

                    <button
                        class="icon-btn close-modal"
                    >
                        ×
                    </button>

                </div>


                <p>
                    CPF/CNPJ:
                    ${display(client.cpf_cnpj)}

                    ·

                    Telefone:
                    ${display(client.telefone)}
                </p>


                <p>
                    Endereço:
                    ${display(client.endereco)}
                </p>


                <div
                    class="grid grid-4"
                    style="margin-top:20px"
                >

                    <div class="panel metric">

                        <label>
                            Parcelas
                        </label>

                        <strong>
                            ${fmtMoney(
                                parts.reduce(
                                    (
                                        sum,
                                        p
                                    ) =>
                                        sum +
                                        Number(
                                            p.valor ||
                                            0
                                        ),
                                    0
                                )
                            )}
                        </strong>

                    </div>


                    <div class="panel metric">

                        <label>
                            Pago
                        </label>

                        <strong>
                            ${fmtMoney(
                                parts
                                    .filter(
                                        (p) =>
                                            p.status ===
                                            'paga'
                                    )
                                    .reduce(
                                        (
                                            sum,
                                            p
                                        ) =>
                                            sum +
                                            Number(
                                                p.valor_pago ||
                                                p.valor ||
                                                0
                                            ),
                                        0
                                    )
                            )}
                        </strong>

                    </div>


                    <div class="panel metric">

                        <label>
                            Em aberto
                        </label>

                        <strong>
                            ${fmtMoney(
                                parts
                                    .filter(
                                        (p) =>
                                            p.status !==
                                            'paga'
                                    )
                                    .reduce(
                                        (
                                            sum,
                                            p
                                        ) =>
                                            sum +
                                            Number(
                                                p.valor ||
                                                0
                                            ),
                                        0
                                    )
                            )}
                        </strong>

                    </div>


                    <div class="panel metric">

                        <label>
                            Atrasado
                        </label>

                        <strong>
                            ${fmtMoney(
                                parts
                                    .filter(
                                        (p) =>
                                            statusParcela(
                                                p
                                            ) ===
                                            'atrasada'
                                    )
                                    .reduce(
                                        (
                                            sum,
                                            p
                                        ) =>
                                            sum +
                                            Number(
                                                p.valor ||
                                                0
                                            ),
                                        0
                                    )
                            )}
                        </strong>

                    </div>

                </div>


                <div
                    class="table-wrap"
                    style="margin-top:20px"
                >

                    <table class="data-table">

                        <tbody>

                            ${
                                parts
                                    .map(
                                        (p) => `

                                        <tr>

                                            <td>
                                                Parcela ${p.numero}
                                            </td>

                                            <td>
                                                ${fmtMoney(
                                                    p.valor
                                                )}
                                            </td>

                                            <td>
                                                ${dateBR(
                                                    p.vencimento
                                                )}
                                            </td>

                                            <td>
                                                ${statusHTML(
                                                    statusParcela(
                                                        p
                                                    )
                                                )}
                                            </td>

                                        </tr>
                                    `
                                    )
                                    .join('') ||

                                `
                                    <tr>
                                        <td
                                            class="empty"
                                        >
                                            Nenhuma parcela.
                                        </td>
                                    </tr>
                                `
                            }

                        </tbody>

                    </table>

                </div>

            </section>

        </div>
    `;


    document
        .querySelector(
            '.close-modal'
        )
        .onclick =
            () => {

                document
                    .getElementById(
                        'client-modal'
                    )
                    .innerHTML = '';
            };
}


/* =========================================================
   EVENTOS
   ========================================================= */

document
    .getElementById(
        'new-client'
    )
    ?.addEventListener(
        'click',
        formModal
    );


document
    .getElementById(
        'client-search'
    )
    ?.addEventListener(
        'input',
        renderClients
    );


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

loadClients()
    .catch(
        () => {

            const tabela =
                document.getElementById(
                    'clients-table'
                );


            if (tabela) {

                tabela.innerHTML = `
                    <tr>
                        <td
                            colspan="6"
                            class="empty"
                        >
                            Configure o Supabase para carregar clientes.
                        </td>
                    </tr>
                `;
            }
        }
    );
