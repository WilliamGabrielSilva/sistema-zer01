/* =========================================================
   CLIENTES — SISTEMA ZER01
   =========================================================
   Cadastro de clientes
   Edição de clientes
   Dívidas existentes
   Histórico de vendas
   Edição de vendas
   Edição de parcelas
   Exclusão de clientes
   Fonte única de dados: Supabase
   ========================================================= */

let clients = [];


/* =========================================================
   CARREGAR CLIENTES
   ========================================================= */

async function loadClients() {

    clients =
        await supabaseQuery((c) =>
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
            document.getElementById('client-search')?.value ||
            ''
        )
            .toLowerCase()
            .trim();


    const rows = clients.filter((client) => {

        return [
            client.nome,
            client.cpf_cnpj,
            client.telefone
        ].some((value) =>
            safe(value)
                .toLowerCase()
                .includes(term)
        );

    });


    const countElement =
        document.getElementById('client-count');

    if (countElement) {
        countElement.textContent =
            `${rows.length} CLIENTES`;
    }


    const table =
        document.getElementById('clients-table');

    if (!table) {
        return;
    }


    table.innerHTML =
        rows.map((client) => {

            return `
                <tr>

                    <td>
                        <strong>
                            ${safe(client.nome)}
                        </strong>
                    </td>

                    <td>
                        ${display(client.cpf_cnpj)}
                    </td>

                    <td>
                        ${display(client.telefone)}
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
                            data-id="${client.id}"
                        >
                            Ver
                        </button>

                        <button
                            class="btn btn-ghost edit-client"
                            data-id="${client.id}"
                        >
                            Editar
                        </button>

                        <button
                            class="btn btn-danger delete-client"
                            data-id="${client.id}"
                        >
                            Excluir
                        </button>

                    </td>

                </tr>
            `;

        }).join('') ||

        `
            <tr>
                <td colspan="6" class="empty">
                    Nenhum cliente encontrado.
                </td>
            </tr>
        `;


    /* =====================================================
       BOTÃO VER
       ===================================================== */

    document
        .querySelectorAll('.view-client')
        .forEach((button) => {

            button.onclick = () =>
                viewClient(button.dataset.id);

        });


    /* =====================================================
       BOTÃO EDITAR CLIENTE
       ===================================================== */

    document
        .querySelectorAll('.edit-client')
        .forEach((button) => {

            button.onclick = () =>
                editClient(button.dataset.id);

        });


    /* =====================================================
       BOTÃO EXCLUIR
       ===================================================== */

    document
        .querySelectorAll('.delete-client')
        .forEach((button) => {

            button.onclick = () =>
                deleteClient(button.dataset.id);

        });

}


/* =========================================================
   GERAR PARCELAS PARA DÍVIDA EXISTENTE
   ========================================================= */

function debtRows() {

    const total =
        Number(
            document.getElementById('debt-total')?.value
        ) || 0;


    const count =
        Number(
            document.getElementById('debt-count')?.value
        ) || 1;


    const cents =
        Math.round(total * 100);


    const baseCents =
        Math.floor(cents / count);


    const remainderCents =
        cents -
        (baseCents * count);


    return Array.from(
        {
            length: count
        },
        (_, index) => {

            const date =
                new Date();

            date.setDate(
                date.getDate() +
                30 * (index + 1)
            );


            const valueCents =
                baseCents +
                (
                    index < remainderCents
                        ? 1
                        : 0
                );


            const value =
                valueCents / 100;


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
    ).join('');
}


/* =========================================================
   MODAL NOVO CLIENTE
   ========================================================= */

function formModal() {

    const modal =
        document.getElementById('client-modal');

    if (!modal) {
        return;
    }


    modal.innerHTML = `

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
                        class="btn btn-primary"
                    >
                        Salvar cliente
                    </button>

                </div>

            </form>

        </div>
    `;


    /* =====================================================
       FECHAR
       ===================================================== */

    document
        .querySelectorAll('.close-modal')
        .forEach((button) => {

            button.onclick = () => {

                modal.innerHTML = '';

            };

        });


    /* =====================================================
       MÁSCARA CPF/CNPJ
       ===================================================== */

    document
        .getElementById('client-doc')
        ?.addEventListener(
            'input',
            (event) => {

                event.target.value =
                    maskDoc(
                        event.target.value
                    );

            }
        );


    /* =====================================================
       MÁSCARA TELEFONE
       ===================================================== */

    document
        .getElementById('client-phone')
        ?.addEventListener(
            'input',
            (event) => {

                event.target.value =
                    maskPhone(
                        event.target.value
                    );

            }
        );


    /* =====================================================
       ESCOLHA DÍVIDA
       ===================================================== */

    document
        .querySelectorAll('.debt-choice')
        .forEach((button) => {

            button.onclick = () => {

                const area =
                    document.getElementById(
                        'debt-area'
                    );


                area.hidden =
                    button.dataset.value !== 'sim';

            };

        });


    /* =====================================================
       GERAR PARCELAS
       ===================================================== */

    document
        .getElementById('generate-debt')
        ?.addEventListener(
            'click',
            () => {

                document
                    .getElementById(
                        'debt-installments'
                    )
                    .innerHTML =
                    debtRows();

            }
        );


    document
        .getElementById('debt-count')
        ?.addEventListener(
            'input',
            () => {

                const area =
                    document.getElementById(
                        'debt-area'
                    );


                if (!area.hidden) {

                    document
                        .getElementById(
                            'debt-installments'
                        )
                        .innerHTML =
                        debtRows();

                }

            }
        );


    document
        .getElementById('debt-total')
        ?.addEventListener(
            'input',
            () => {

                const area =
                    document.getElementById(
                        'debt-area'
                    );


                if (!area.hidden) {

                    document
                        .getElementById(
                            'debt-installments'
                        )
                        .innerHTML =
                        debtRows();

                }

            }
        );


    /* =====================================================
       SALVAR
       ===================================================== */

    document
        .getElementById('client-form')
        ?.addEventListener(
            'submit',
            saveClient
        );
}


/* =========================================================
   SALVAR CLIENTE
   ========================================================= */

async function saveClient(event) {

    event.preventDefault();


    try {

        const hasDebt =
            !document
                .getElementById('debt-area')
                .hidden;


        const nome =
            document
                .getElementById('client-name')
                .value
                .trim();


        if (!nome) {

            throw new Error(
                'Informe o nome do cliente.'
            );

        }


        /* =================================================
           CLIENTE
           ================================================= */

        const client =
            await supabaseQuery((c) =>
                c
                    .from('clientes')
                    .insert({

                        nome,

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


        /* =================================================
           DÍVIDA EXISTENTE
           ================================================= */

        if (hasDebt) {

            const description =
                document
                    .getElementById(
                        'debt-description'
                    )
                    .value
                    .trim();


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


            if (!description) {

                throw new Error(
                    'Informe a descrição da dívida.'
                );

            }


            if (!values.length) {

                throw new Error(
                    'Gere as parcelas da dívida antes de salvar.'
                );

            }


            const total =
                values.reduce(
                    (sum, input) =>
                        sum +
                        (
                            Number(input.value) ||
                            0
                        ),
                    0
                );


            if (total <= 0) {

                throw new Error(
                    'O valor da dívida deve ser maior que zero.'
                );

            }


            const sale =
                await supabaseQuery((c) =>
                    c
                        .from('vendas')
                        .insert({

                            cliente_id:
                                client.id,

                            descricao:
                                `Dívida existente: ${description}`,

                            valor_total:
                                total,

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
                    (input, index) => ({

                        venda_id:
                            sale.id,

                        numero:
                            index + 1,

                        valor:
                            Number(input.value) ||
                            0,

                        vencimento:
                            dates[index]?.value ||
                            null,

                        status:
                            'pendente'

                    })
                );


            await supabaseQuery((c) =>
                c
                    .from('parcelas')
                    .insert(installments)
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
            error.message ||
            'Não foi possível salvar o cliente.',
            'error'
        );

    }

}


/* =========================================================
   EDITAR CLIENTE
   ========================================================= */

async function editClient(id) {

    const client =
        clients.find(
            (item) =>
                String(item.id) ===
                String(id)
        );


    if (!client) {

        toast(
            'Cliente não encontrado.',
            'error'
        );

        return;

    }


    const modal =
        document.getElementById(
            'client-modal'
        );


    modal.innerHTML = `

        <div class="modal">

            <form
                class="modal-card"
                id="edit-client-form"
            >

                <div class="modal-head">

                    <div>

                        <span class="eyebrow">
                            EDITAR CADASTRO
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
                            required
                            value="${safe(client.nome)}"
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
                        class="btn btn-primary"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </div>
    `;


    document
        .querySelectorAll('.close-modal')
        .forEach((button) => {

            button.onclick = () => {

                modal.innerHTML = '';

            };

        });


    document
        .getElementById('edit-client-doc')
        ?.addEventListener(
            'input',
            (event) => {

                event.target.value =
                    maskDoc(
                        event.target.value
                    );

            }
        );


    document
        .getElementById('edit-client-phone')
        ?.addEventListener(
            'input',
            (event) => {

                event.target.value =
                    maskPhone(
                        event.target.value
                    );

            }
        );


    document
        .getElementById('edit-client-form')
        ?.addEventListener(
            'submit',
            async (event) => {

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

                        throw new Error(
                            'Informe o nome do cliente.'
                        );

                    }


                    await supabaseQuery((c) =>
                        c
                            .from('clientes')
                            .update({

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


                    modal.innerHTML = '';


                    await loadClients();

                } catch (error) {

                    toast(
                        error.message ||
                        'Não foi possível atualizar o cliente.',
                        'error'
                    );

                }

            }
        );

}


/* =========================================================
   EXCLUIR CLIENTE
   ========================================================= */

async function deleteClient(id) {

    const client =
        clients.find(
            (item) =>
                String(item.id) ===
                String(id)
        );


    if (
        !confirm(
            `Excluir o cliente ${client?.nome || ''}? Isso também excluirá vendas, parcelas e pagamentos relacionados.`
        )
    ) {

        return;

    }


    try {

        await supabaseQuery((c) =>
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
   VER CLIENTE
   ========================================================= */

async function viewClient(id) {

    try {

        const client =
            clients.find(
                (item) =>
                    String(item.id) ===
                    String(id)
            );


        if (!client) {

            toast(
                'Cliente não encontrado.',
                'error'
            );

            return;

        }


        const sales =
            await supabaseQuery((q) =>
                q
                    .from('vendas')
                    .select(`
                        *,
                        parcelas(
                            id,
                            numero,
                            valor,
                            valor_pago,
                            total_pago,
                            vencimento,
                            status
                        )
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


        const totalParcelas =
            parts.reduce(
                (sum, parcela) =>
                    sum +
                    Number(
                        parcela.valor || 0
                    ),
                0
            );


        const totalPago =
            parts.reduce(
                (sum, parcela) =>
                    sum +
                    Number(
                        parcela.valor_pago ||
                        parcela.total_pago ||
                        (
                            parcela.status === 'paga'
                                ? parcela.valor
                                : 0
                        ) ||
                        0
                    ),
                0
            );


        const totalAberto =
            parts.reduce(
                (sum, parcela) => {

                    const valor =
                        Number(
                            parcela.valor || 0
                        );


                    const pago =
                        Number(
                            parcela.valor_pago ||
                            parcela.total_pago ||
                            (
                                parcela.status === 'paga'
                                    ? valor
                                    : 0
                            ) ||
                            0
                        );


                    return sum +
                        Math.max(
                            valor - pago,
                            0
                        );

                },
                0
            );


        const totalAtrasado =
            parts.reduce(
                (sum, parcela) => {

                    const valor =
                        Number(
                            parcela.valor || 0
                        );


                    const pago =
                        Number(
                            parcela.valor_pago ||
                            parcela.total_pago ||
                            (
                                parcela.status === 'paga'
                                    ? valor
                                    : 0
                            ) ||
                            0
                        );


                    const saldo =
                        Math.max(
                            valor - pago,
                            0
                        );


                    const atrasada =
                        saldo > 0 &&
                        parcela.vencimento &&
                        parcela.vencimento <
                            todayISO();


                    return sum +
                        (
                            atrasada
                                ? saldo
                                : 0
                        );

                },
                0
            );


        const modal =
            document.getElementById(
                'client-modal'
            );


        modal.innerHTML = `

            <div class="modal">

                <section
                    class="modal-card"
                    style="max-width:1100px"
                >

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


                    <div
                        style="
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                            margin-bottom:20px
                        "
                    >

                        <button
                            class="btn btn-ghost edit-client-from-view"
                            data-id="${client.id}"
                        >
                            ✏️ Editar cliente
                        </button>

                    </div>


                    <p>

                        CPF/CNPJ:
                        ${display(client.cpf_cnpj)}

                        ·

                        Telefone:
                        ${display(client.telefone)}

                        ·

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
                                    totalParcelas
                                )}
                            </strong>

                        </div>


                        <div class="panel metric">

                            <label>
                                Pago
                            </label>

                            <strong>
                                ${fmtMoney(
                                    totalPago
                                )}
                            </strong>

                        </div>


                        <div class="panel metric">

                            <label>
                                Em aberto
                            </label>

                            <strong>
                                ${fmtMoney(
                                    totalAberto
                                )}
                            </strong>

                        </div>


                        <div class="panel metric">

                            <label>
                                Atrasado
                            </label>

                            <strong>
                                ${fmtMoney(
                                    totalAtrasado
                                )}
                            </strong>

                        </div>

                    </div>


                    <div
                        style="
                            margin-top:25px;
                            margin-bottom:10px
                        "
                    >

                        <span class="eyebrow">
                            VENDAS E DÍVIDAS
                        </span>

                    </div>


                    <div>

                        ${
                            sales.map(
                                (sale) =>
                                    renderSaleCard(
                                        sale
                                    )
                            ).join('')
                        ||

                        `
                            <div class="empty">
                                Nenhuma venda ou dívida encontrada.
                            </div>
                        `

                        }

                    </div>

                </section>

            </div>
        `;


        /* =================================================
           FECHAR
           ================================================= */

        modal
            .querySelector('.close-modal')
            ?.addEventListener(
                'click',
                () => {

                    modal.innerHTML = '';

                }
            );


        /* =================================================
           EDITAR CLIENTE
           ================================================= */

        modal
            .querySelector(
                '.edit-client-from-view'
            )
            ?.addEventListener(
                'click',
                () => {

                    editClient(id);

                }
            );


        /* =================================================
           EDITAR VENDAS
           ================================================= */

        modal
            .querySelectorAll(
                '.edit-sale-button'
            )
            .forEach(
                (button) => {

                    button.onclick = () => {

                        editSale(
                            button.dataset.id,
                            id
                        );

                    };

                }
            );

    } catch (error) {

        toast(
            error.message ||
            'Não foi possível carregar a ficha do cliente.',
            'error'
        );

    }

}


/* =========================================================
   RENDERIZAR CARD DA VENDA
   ========================================================= */

function renderSaleCard(sale) {

    const parcelas =
        sale.parcelas || [];


    const total =
        parcelas.reduce(
            (sum, parcela) =>
                sum +
                Number(
                    parcela.valor || 0
                ),
            0
        );


    const pago =
        parcelas.reduce(
            (sum, parcela) =>
                sum +
                Number(
                    parcela.valor_pago ||
                    parcela.total_pago ||
                    (
                        parcela.status === 'paga'
                            ? parcela.valor
                            : 0
                    ) ||
                    0
                ),
            0
        );


    const saldo =
        Math.max(
            total - pago,
            0
        );


    return `

        <div
            class="panel"
            style="
                margin-top:15px;
                padding:18px
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:15px;
                    flex-wrap:wrap
                "
            >

                <div>

                    <span
                        style="
                            color:var(--muted);
                            font-size:11px;
                            text-transform:uppercase;
                            letter-spacing:1px
                        "
                    >
                        Venda / Dívida
                    </span>

                    <h4
                        style="
                            margin:5px 0 4px
                        "
                    >
                        ${display(sale.descricao)}
                    </h4>

                    <div
                        style="
                            color:var(--muted);
                            font-size:13px
                        "
                    >
                        ${dateBR(sale.data_venda)}
                        ·
                        ${parcelas.length} parcela(s)
                    </div>

                </div>


                <div
                    style="
                        text-align:right
                    "
                >

                    <strong>
                        ${fmtMoney(total)}
                    </strong>

                    <div
                        style="
                            color:var(--muted);
                            font-size:12px
                        "
                    >
                        Pago:
                        ${fmtMoney(pago)}
                        ·
                        Saldo:
                        ${fmtMoney(saldo)}
                    </div>

                </div>

            </div>


            <div
                class="table-wrap"
                style="margin-top:15px"
            >

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>
                                Parcela
                            </th>

                            <th>
                                Valor
                            </th>

                            <th>
                                Pago
                            </th>

                            <th>
                                Saldo
                            </th>

                            <th>
                                Vencimento
                            </th>

                            <th>
                                Status
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            parcelas
                                .sort(
                                    (a, b) =>
                                        Number(a.numero || 0) -
                                        Number(b.numero || 0)
                                )
                                .map(
                                    (parcela) => {

                                        const valor =
                                            Number(
                                                parcela.valor ||
                                                0
                                            );


                                        const pagoParcela =
                                            Number(
                                                parcela.valor_pago ||
                                                parcela.total_pago ||
                                                (
                                                    parcela.status === 'paga'
                                                        ? valor
                                                        : 0
                                                ) ||
                                                0
                                            );


                                        const saldoParcela =
                                            Math.max(
                                                valor -
                                                pagoParcela,
                                                0
                                            );


                                        const status =
                                            saldoParcela <= 0
                                                ? 'paga'
                                                : (
                                                    parcela.vencimento &&
                                                    parcela.vencimento <
                                                        todayISO()
                                                        ? 'atrasada'
                                                        : 'pendente'
                                                );


                                        const label =
                                            status === 'paga'
                                                ? 'Paga'
                                                : status === 'atrasada'
                                                    ? 'Atrasada'
                                                    : 'Pendente';


                                        return `

                                            <tr>

                                                <td>
                                                    Parcela
                                                    ${parcela.numero}
                                                </td>

                                                <td>
                                                    ${fmtMoney(
                                                        valor
                                                    )}
                                                </td>

                                                <td>
                                                    ${fmtMoney(
                                                        pagoParcela
                                                    )}
                                                </td>

                                                <td>
                                                    ${fmtMoney(
                                                        saldoParcela
                                                    )}
                                                </td>

                                                <td>
                                                    ${dateBR(
                                                        parcela.vencimento
                                                    )}
                                                </td>

                                                <td>
                                                    ${statusHTML(
                                                        status,
                                                        label
                                                    )}
                                                </td>

                                            </tr>

                                        `;

                                    }
                                )
                                .join('')
                        }

                    </tbody>

                </table>

            </div>


            <div
                style="
                    display:flex;
                    justify-content:flex-end;
                    gap:8px;
                    margin-top:15px;
                    flex-wrap:wrap
                "
            >

                <button
                    class="btn btn-primary edit-sale-button"
                    data-id="${sale.id}"
                >
                    ✏️ Editar venda / dívida
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   EDITAR VENDA / DÍVIDA
   ========================================================= */

async function editSale(
    saleId,
    clientId
) {

    try {

        const sale =
            await supabaseQuery((q) =>
                q
                    .from('vendas')
                    .select(`
                        *,
                        parcelas(
                            id,
                            numero,
                            valor,
                            valor_pago,
                            total_pago,
                            vencimento,
                            status
                        )
                    `)
                    .eq(
                        'id',
                        saleId
                    )
                    .single()
            );


        if (!sale) {

            throw new Error(
                'Venda não encontrada.'
            );

        }


        const parcelas =
            [...(sale.parcelas || [])]
                .sort(
                    (a, b) =>
                        Number(a.numero || 0) -
                        Number(b.numero || 0)
                );


        const modal =
            document.getElementById(
                'client-modal'
            );


        modal.innerHTML = `

            <div class="modal">

                <form
                    class="modal-card"
                    id="edit-sale-form"
                    style="max-width:1000px"
                >

                    <div class="modal-head">

                        <div>

                            <span class="eyebrow">
                                EDITAR VENDA / DÍVIDA
                            </span>

                            <h3>
                                ${safe(sale.descricao)}
                            </h3>

                        </div>


                        <button
                            type="button"
                            class="icon-btn close-modal"
                        >
                            ×
                        </button>

                    </div>


                    <div class="field">

                        <label>
                            Descrição da venda / dívida *
                        </label>

                        <input
                            id="edit-sale-description"
                            required
                            value="${safe(sale.descricao)}"
                        >

                    </div>


                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:10px;
                            margin-top:25px;
                            flex-wrap:wrap
                        "
                    >

                        <div>

                            <span class="eyebrow">
                                PARCELAMENTO
                            </span>

                            <h4>
                                Parcelas
                            </h4>

                        </div>


                        <button
                            type="button"
                            class="btn"
                            id="add-sale-installment"
                        >
                            + Adicionar parcela
                        </button>

                    </div>


                    <div
                        id="sale-installments-editor"
                        style="margin-top:10px"
                    >

                        ${
                            parcelas
                                .map(
                                    (parcela, index) =>
                                        renderEditableInstallment(
                                            parcela,
                                            index
                                        )
                                )
                                .join('')
                        }

                    </div>


                    <div
                        class="panel"
                        style="
                            margin-top:20px;
                            padding:15px;
                            display:flex;
                            justify-content:space-between;
                            gap:15px;
                            flex-wrap:wrap
                        "
                    >

                        <strong>
                            Total da venda
                        </strong>

                        <strong
                            id="edit-sale-total"
                        >
                            ${fmtMoney(
                                parcelas.reduce(
                                    (sum, parcela) =>
                                        sum +
                                        Number(
                                            parcela.valor ||
                                            0
                                        ),
                                    0
                                )
                            )}
                        </strong>

                    </div>


                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            gap:8px;
                            margin-top:22px;
                            flex-wrap:wrap
                        "
                    >

                        <button
                            type="button"
                            class="btn btn-ghost back-to-client"
                        >
                            ← Voltar para cliente
                        </button>


                        <div
                            style="
                                display:flex;
                                gap:8px
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

                    </div>

                </form>

            </div>
        `;


        /* =================================================
           FECHAR
           ================================================= */

        modal
            .querySelectorAll('.close-modal')
            .forEach(
                (button) => {

                    button.onclick = () => {

                        modal.innerHTML = '';

                    };

                }
            );


        /* =================================================
           VOLTAR PARA FICHA
           ================================================= */

        modal
            .querySelector(
                '.back-to-client'
            )
            ?.addEventListener(
                'click',
                () => {

                    viewClient(
                        clientId
                    );

                }
            );


        /* =================================================
           ATUALIZAR TOTAL
           ================================================= */

        function atualizarTotalEdicao() {

            const values =
                [
                    ...modal.querySelectorAll(
                        '.edit-sale-value'
                    )
                ];


            const total =
                values.reduce(
                    (sum, input) =>
                        sum +
                        (
                            Number(
                                input.value
                            ) ||
                            0
                        ),
                    0
                );


            const totalElement =
                modal.querySelector(
                    '#edit-sale-total'
                );


            if (totalElement) {

                totalElement.textContent =
                    fmtMoney(total);

            }

        }


        /* =================================================
           EVENTO VALORES
           ================================================= */

        modal
            .querySelectorAll(
                '.edit-sale-value'
            )
            .forEach(
                (input) => {

                    input.addEventListener(
                        'input',
                        atualizarTotalEdicao
                    );

                }
            );


        /* =================================================
           ADICIONAR PARCELA
           ================================================= */

        modal
            .querySelector(
                '#add-sale-installment'
            )
            ?.addEventListener(
                'click',
                () => {

                    const editor =
                        modal.querySelector(
                            '#sale-installments-editor'
                        );


                    const count =
                        editor.querySelectorAll(
                            '.sale-installment-row'
                        ).length;


                    const novaParcela = {

                        id: '',

                        numero:
                            count + 1,

                        valor:
                            0,

                        valor_pago:
                            0,

                        vencimento:
                            calcularNovaData(
                                count
                            ),

                        status:
                            'pendente'

                    };


                    editor.insertAdjacentHTML(
                        'beforeend',
                        renderEditableInstallment(
                            novaParcela,
                            count
                        )
                    );


                    atualizarNumeracaoParcelas();


                    editor
                        .querySelectorAll(
                            '.edit-sale-value'
                        )
                        .forEach(
                            (input) => {

                                input.addEventListener(
                                    'input',
                                    atualizarTotalEdicao
                                );

                            }
                        );


                    adicionarEventosRemoverParcelas();

                }
            );


        /* =================================================
           REMOVER PARCELAS
           ================================================= */

        adicionarEventosRemoverParcelas();


        function adicionarEventosRemoverParcelas() {

            modal
                .querySelectorAll(
                    '.remove-sale-installment'
                )
                .forEach(
                    (button) => {

                        button.onclick = () => {

                            const row =
                                button.closest(
                                    '.sale-installment-row'
                                );


                            if (!row) {
                                return;
                            }


                            const valorPago =
                                Number(
                                    row.dataset.paid ||
                                    0
                                );


                            if (valorPago > 0) {

                                toast(
                                    'Não é possível remover uma parcela que já possui pagamento.',
                                    'error'
                                );

                                return;

                            }


                            const rows =
                                modal.querySelectorAll(
                                    '.sale-installment-row'
                                );


                            if (rows.length <= 1) {

                                toast(
                                    'A venda precisa possuir pelo menos uma parcela.',
                                    'error'
                                );

                                return;

                            }


                            row.remove();


                            atualizarNumeracaoParcelas();

                            atualizarTotalEdicao();

                        };

                    }
                );

        }


        function atualizarNumeracaoParcelas() {

            modal
                .querySelectorAll(
                    '.sale-installment-row'
                )
                .forEach(
                    (row, index) => {

                        const numero =
                            index + 1;


                        row.querySelector(
                            '.installment-number'
                        ).textContent =
                            `Parcela ${numero}`;


                        row.querySelector(
                            '.installment-number-input'
                        ).value =
                            numero;

                    }
                );

        }


        /* =================================================
           SALVAR VENDA
           ================================================= */

        modal
            .querySelector(
                '#edit-sale-form'
            )
            ?.addEventListener(
                'submit',
                async (event) => {

                    event.preventDefault();


                    try {

                        const description =
                            modal
                                .querySelector(
                                    '#edit-sale-description'
                                )
                                .value
                                .trim();


                        if (!description) {

                            throw new Error(
                                'Informe a descrição da venda.'
                            );

                        }


                        const rows =
                            [
                                ...modal.querySelectorAll(
                                    '.sale-installment-row'
                                )
                            ];


                        if (!rows.length) {

                            throw new Error(
                                'A venda precisa possuir pelo menos uma parcela.'
                            );

                        }


                        const installments =
                            rows.map(
                                (row, index) => {

                                    const valor =
                                        Number(
                                            row.querySelector(
                                                '.edit-sale-value'
                                            )?.value ||
                                            0
                                        );


                                    const vencimento =
                                        row.querySelector(
                                            '.edit-sale-date'
                                        )?.value ||
                                        null;


                                    const id =
                                        row.dataset.id ||
                                        null;


                                    const valorPago =
                                        Number(
                                            row.dataset.paid ||
                                            0
                                        );


                                    if (
                                        valor <= 0
                                    ) {

                                        throw new Error(
                                            `Informe um valor válido para a parcela ${index + 1}.`
                                        );

                                    }


                                    if (
                                        !vencimento
                                    ) {

                                        throw new Error(
                                            `Informe o vencimento da parcela ${index + 1}.`
                                        );

                                    }


                                    if (
                                        valor <
                                        valorPago
                                    ) {

                                        throw new Error(
                                            `A parcela ${index + 1} não pode ficar abaixo do valor já pago (${fmtMoney(valorPago)}).`
                                        );

                                    }


                                    return {

                                        id,

                                        numero:
                                            index + 1,

                                        valor,

                                        vencimento,

                                        valorPago

                                    };

                                }
                            );


                        const total =
                            installments.reduce(
                                (sum, parcela) =>
                                    sum +
                                    parcela.valor,
                                0
                            );


                        /* =================================
                           ATUALIZAR VENDA
                           ================================= */

                        const statusAtual =
                            sale.status === 'cancelada'
                                ? 'cancelada'
                                : 'aberta';


                        await supabaseQuery((c) =>
                            c
                                .from('vendas')
                                .update({

                                    descricao:
                                        description,

                                    valor_total:
                                        total,

                                    quantidade_parcelas:
                                        installments.length,

                                    status:
                                        statusAtual

                                })
                                .eq(
                                    'id',
                                    saleId
                                )
                        );


                        /* =================================
                           PARCELAS EXISTENTES
                           ================================= */

                        const parcelasExistentes =
                            [...parcelas];


                        /* =================================
                           ATUALIZAR / CRIAR
                           ================================= */

                        for (
                            let index = 0;
                            index <
                            installments.length;
                            index++
                        ) {

                            const parcela =
                                installments[index];


                            if (parcela.id) {

                                const existente =
                                    parcelasExistentes.find(
                                        (item) =>
                                            String(item.id) ===
                                            String(parcela.id)
                                    );


                                if (
                                    existente &&
                                    parcela.valor <
                                        Number(
                                            existente.valor_pago ||
                                            existente.total_pago ||
                                            (
                                                existente.status === 'paga'
                                                    ? existente.valor
                                                    : 0
                                            ) ||
                                            0
                                        )
                                ) {

                                    throw new Error(
                                        `A parcela ${parcela.numero} possui pagamento e não pode ter valor inferior ao que já foi pago.`
                                    );

                                }


                                await supabaseQuery((c) =>
                                    c
                                        .from('parcelas')
                                        .update({

                                            numero:
                                                parcela.numero,

                                            valor:
                                                parcela.valor,

                                            vencimento:
                                                parcela.vencimento,

                                            status:
                                                calcularStatusParcelaEditada(
                                                    parcela.valor,
                                                    parcela.valorPago,
                                                    parcela.vencimento
                                                )

                                        })
                                        .eq(
                                            'id',
                                            parcela.id
                                        )
                                );

                            } else {

                                await supabaseQuery((c) =>
                                    c
                                        .from('parcelas')
                                        .insert({

                                            venda_id:
                                                saleId,

                                            numero:
                                                parcela.numero,

                                            valor:
                                                parcela.valor,

                                            vencimento:
                                                parcela.vencimento,

                                            valor_pago:
                                                0,

                                            status:
                                                calcularStatusParcelaEditada(
                                                    parcela.valor,
                                                    0,
                                                    parcela.vencimento
                                                )

                                        })
                                );

                            }

                        }


                        /* =================================
                           REMOVER PARCELAS EXCEDENTES
                           ================================= */

                        const idsMantidos =
                            installments
                                .filter(
                                    (item) =>
                                        item.id
                                )
                                .map(
                                    (item) =>
                                        String(item.id)
                                );


                        for (
                            const antiga of parcelasExistentes
                        ) {

                            if (
                                idsMantidos.includes(
                                    String(antiga.id)
                                )
                            ) {

                                continue;

                            }


                            const valorPago =
                                Number(
                                    antiga.valor_pago ||
                                    antiga.total_pago ||
                                    (
                                        antiga.status === 'paga'
                                            ? antiga.valor
                                            : 0
                                    ) ||
                                    0
                                );


                            if (
                                valorPago > 0
                            ) {

                                throw new Error(
                                    `A parcela ${antiga.numero} possui pagamento e não pode ser removida.`
                                );

                            }


                            const pagamentos =
                                await supabaseQuery((c) =>
                                    c
                                        .from('pagamentos')
                                        .select('id')
                                        .eq(
                                            'parcela_id',
                                            antiga.id
                                        )
                                ) || [];


                            if (
                                pagamentos.length
                            ) {

                                throw new Error(
                                    `A parcela ${antiga.numero} possui recebimentos registrados e não pode ser removida.`
                                );

                            }


                            await supabaseQuery((c) =>
                                c
                                    .from('parcelas')
                                    .delete()
                                    .eq(
                                        'id',
                                        antiga.id
                                    )
                            );

                        }


                        /* =================================
                           VERIFICAR SE VENDA FOI QUITADA
                           ================================= */

                        const parcelasAtualizadas =
                            await supabaseQuery((c) =>
                                c
                                    .from('parcelas')
                                    .select(
                                        'valor,valor_pago,total_pago,status'
                                    )
                                    .eq(
                                        'venda_id',
                                        saleId
                                    )
                            ) || [];


                        const todasPagas =
                            parcelasAtualizadas.length > 0 &&
                            parcelasAtualizadas.every(
                                (parcela) => {

                                    const valor =
                                        Number(
                                            parcela.valor ||
                                            0
                                        );


                                    const pago =
                                        Number(
                                            parcela.valor_pago ||
                                            parcela.total_pago ||
                                            (
                                                parcela.status === 'paga'
                                                    ? valor
                                                    : 0
                                            ) ||
                                            0
                                        );


                                    return (
                                        valor > 0 &&
                                        pago >= valor
                                    );

                                }
                            );


                        if (
                            sale.status !== 'cancelada'
                        ) {

                            await supabaseQuery((c) =>
                                c
                                    .from('vendas')
                                    .update({

                                        status:
                                            todasPagas
                                                ? 'finalizada'
                                                : 'aberta'

                                    })
                                    .eq(
                                        'id',
                                        saleId
                                    )
                            );

                        }


                        toast(
                            'Venda/dívida atualizada com sucesso.'
                        );


                        await viewClient(
                            clientId
                        );

                    } catch (error) {

                        toast(
                            error.message ||
                            'Não foi possível atualizar a venda.',
                            'error'
                        );

                    }

                }
            );

    } catch (error) {

        toast(
            error.message ||
            'Não foi possível abrir a venda para edição.',
            'error'
        );

    }

}


/* =========================================================
   RENDERIZAR PARCELA EDITÁVEL
   ========================================================= */

function renderEditableInstallment(
    parcela,
    index
) {

    const valor =
        Number(
            parcela?.valor || 0
        );


    const valorPago =
        Number(
            parcela?.valor_pago ||
            parcela?.total_pago ||
            (
                parcela?.status === 'paga'
                    ? valor
                    : 0
            ) ||
            0
        );


    return `

        <div
            class="panel sale-installment-row"
            data-id="${parcela?.id || ''}"
            data-paid="${valorPago}"
            style="
                margin-top:12px;
                padding:15px
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                    margin-bottom:12px
                "
            >

                <strong
                    class="installment-number"
                >
                    Parcela ${index + 1}
                </strong>


                ${
                    valorPago > 0
                        ? `
                            <span
                                style="
                                    color:var(--muted);
                                    font-size:12px
                                "
                            >
                                Já pago:
                                ${fmtMoney(valorPago)}
                            </span>
                        `
                        : `
                            <button
                                type="button"
                                class="btn btn-danger remove-sale-installment"
                            >
                                Remover
                            </button>
                        `
                }

            </div>


            <input
                type="hidden"
                class="installment-number-input"
                value="${index + 1}"
            >


            <div class="form-grid">

                <div class="field">

                    <label>
                        Valor
                    </label>

                    <input
                        class="edit-sale-value"
                        type="number"
                        min="${valorPago}"
                        step="0.01"
                        value="${valor.toFixed(2)}"
                    >

                </div>


                <div class="field">

                    <label>
                        Vencimento
                    </label>

                    <input
                        class="edit-sale-date"
                        type="date"
                        value="${safe(parcela?.vencimento)}"
                    >

                </div>

            </div>

        </div>
    `;
}


/* =========================================================
   CALCULAR NOVA DATA
   ========================================================= */

function calcularNovaData(index) {

    const date =
        new Date();


    date.setDate(
        date.getDate() +
        30 * (index + 1)
    );


    return date
        .toISOString()
        .slice(
            0,
            10
        );
}


/* =========================================================
   STATUS DA PARCELA EDITADA
   ========================================================= */

function calcularStatusParcelaEditada(
    valor,
    valorPago,
    vencimento
) {

    const v =
        Number(valor || 0);


    const pago =
        Number(valorPago || 0);


    if (
        v > 0 &&
        pago >= v
    ) {

        return 'paga';

    }


    if (
        vencimento &&
        vencimento < todayISO()
    ) {

        return 'atrasada';

    }


    return 'pendente';
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document
    .getElementById('new-client')
    ?.addEventListener(
        'click',
        formModal
    );


document
    .getElementById('client-search')
    ?.addEventListener(
        'input',
        renderClients
    );


loadClients()
    .catch(() => {

        const table =
            document.getElementById(
                'clients-table'
            );


        if (table) {

            table.innerHTML = `

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

    });
