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

/* =====================================================
   EDITAR VENDA
===================================================== */

/* =====================================================
   ABRIR EDIÇÃO DA VENDA
===================================================== */

async function editSale(id) {

    try {

        const { data: venda, error } =
            await supabaseClient
                .from("vendas")
                .select(`
                    *,
                    parcelas(*)
                `)
                .eq("id", id)
                .single();


        if (error) {
            throw error;
        }


        if (!venda) {

            alert(
                "Venda não encontrada."
            );

            return;
        }


        /* Abre o novo modal */

        abrirModalEditarVenda(venda);


    } catch (erro) {

        console.error(
            "Erro ao abrir venda:",
            erro
        );

        alert(
            "Não foi possível abrir a venda.\n\n" +
            (erro.message || erro)
        );

    }

}

/* =====================================================
   EDITAR PARCELA
===================================================== */

async function editParcela(id) {

    try {

        const { data: parcela, error } =
            await supabaseClient
                .from("parcelas")
                .select("*")
                .eq("id", id)
                .single();

        if (error) throw error;

        if (!parcela) {
            alert("Parcela não encontrada.");
            return;
        }

        /* Abre o modal de edição */
        abrirModalEditarParcela(parcela);
        return;

        /* =========================================
           VALOR
        ========================================= */

        const valorAtual =
            Number(parcela.valor || 0);

        const novoValor =
            prompt(
                "Valor da parcela:",
                valorAtual.toFixed(2).replace(".", ",")
            );

        if (novoValor === null) {
            return;
        }

        const valorNumerico =
            Number(
                String(novoValor)
                    .replace(/\./g, "")
                    .replace(",", ".")
            );

        if (
            !Number.isFinite(valorNumerico) ||
            valorNumerico < 0
        ) {
            alert("Informe um valor válido.");
            return;
        }


        /* =========================================
           VENCIMENTO
        ========================================= */

        const vencimentoAtual =
            parcela.vencimento
                ? String(parcela.vencimento).substring(0, 10)
                : "";

        const novoVencimento =
            prompt(
                "Data de vencimento (AAAA-MM-DD):",
                vencimentoAtual
            );

        if (novoVencimento === null) {
            return;
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(
                novoVencimento
            )
        ) {
            alert(
                "Data inválida.\n\n" +
                "Use o formato AAAA-MM-DD."
            );

            return;
        }


        /* =========================================
           VALOR PAGO
        ========================================= */

        const valorPagoAtual =
            Number(parcela.valor_pago || 0);

        const novoValorPago =
            prompt(
                "Valor já pago:",
                valorPagoAtual
                    .toFixed(2)
                    .replace(".", ",")
            );

        if (novoValorPago === null) {
            return;
        }

        const valorPagoNumerico =
            Number(
                String(novoValorPago)
                    .replace(/\./g, "")
                    .replace(",", ".")
            );

        if (
            !Number.isFinite(valorPagoNumerico) ||
            valorPagoNumerico < 0
        ) {
            alert("Informe um valor pago válido.");
            return;
        }

        if (
            valorPagoNumerico >
            valorNumerico
        ) {
            alert(
                "O valor pago não pode ser maior " +
                "que o valor da parcela."
            );

            return;
        }


        /* =========================================
           STATUS AUTOMÁTICO
        ========================================= */

        let novoStatus = "pendente";

        if (
            valorNumerico > 0 &&
            valorPagoNumerico >= valorNumerico
        ) {

            novoStatus = "paga";

        } else {

            const hoje =
                new Date();

            hoje.setHours(
                0,
                0,
                0,
                0
            );

            const dataVencimento =
                new Date(
                    novoVencimento +
                    "T00:00:00"
                );

            if (
                dataVencimento < hoje
            ) {

                novoStatus = "atrasada";

            } else {

                novoStatus = "pendente";

            }
        }


        /* =========================================
           DATA DE PAGAMENTO
        ========================================= */

        let dataPagamento =
            parcela.data_pagamento || null;

        if (novoStatus === "paga") {

            if (!dataPagamento) {

                dataPagamento =
                    new Date()
                        .toISOString()
                        .split("T")[0];

            }

        } else {

            dataPagamento = null;

        }


        /* =========================================
           ATUALIZAR PARCELA
        ========================================= */

        const { error: erroUpdate } =
            await supabaseClient
                .from("parcelas")
                .update({

                    valor:
                        valorNumerico,

                    vencimento:
                        novoVencimento,

                    valor_pago:
                        valorPagoNumerico,

                    status:
                        novoStatus,

                    data_pagamento:
                        dataPagamento

                })
                .eq("id", id);


        if (erroUpdate) {
            throw erroUpdate;
        }


        alert(
            "Parcela atualizada com sucesso!"
        );


        /* =========================================
           ATUALIZA A TELA
        ========================================= */

        if (parcela.venda_id) {

            const { data: venda } =
                await supabaseClient
                    .from("vendas")
                    .select("cliente_id")
                    .eq(
                        "id",
                        parcela.venda_id
                    )
                    .single();

            if (venda) {

                await viewClient(
                    venda.cliente_id
                );

            }

        }

    } catch (erro) {

        console.error(
            "Erro ao editar parcela:",
            erro
        );

        alert(
            "Não foi possível editar a parcela.\n\n" +
            (erro.message || erro)
        );

    }

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

/* =====================================================
   VENDAS DO CLIENTE
===================================================== */

    const vendasHTML =
        sales
            .map(
                (sale) => `

                    <div
                        class="panel"
                        style="
                            margin-top:12px;
                            padding:16px;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                                gap:12px;
                                flex-wrap:wrap;
                            "
                        >

                            <div>

                                <strong>
                                    Venda
                                </strong>

                                <div
                                    style="
                                        color:var(--muted);
                                        margin-top:5px;
                                    "
                                >
                                    ${dateBR(sale.data_venda)}
                                </div>

                            </div>

                            <strong>
                                ${fmtMoney(sale.valor_total)}
                            </strong>

                        </div>


                        <div
                            style="
                                margin-top:12px;
                                color:var(--muted);
                            "
                        >
                            ${safe(sale.descricao || 'Sem descrição')}
                        </div>


                        <div
                            style="
                                margin-top:12px;
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                                gap:10px;
                                flex-wrap:wrap;
                            "
                        >

                            <span>
                                ${
                                    (sale.parcelas || []).length
                                }
                                parcela(s)
                            </span>


                            <button
                                type="button"
                                class="btn btn-ghost"
                                onclick="editSale('${sale.id}')"
                            >
                                Editar venda
                            </button>

                        </div>

                    </div>

                `
            )
            .join('');


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
                                parts.reduce(
                                    (
                                        sum,
                                        p
                                    ) =>
                                        sum +
                                        Number(
                                            p.valor_pago || 0
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
                                parts.reduce(
                                    (
                                        sum,
                                        p
                                    ) => {

                                        const valor =
                                            Number(
                                                p.valor || 0
                                            );

                                        const pago =
                                            Number(
                                                p.valor_pago || 0
                                            );

                                        return sum +
                                            Math.max(
                                                0,
                                                valor - pago
                                            );
                                    },
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

                    <div style="margin-top:24px;">
                        <h3 style="margin-bottom:14px;">Vendas do cliente</h3>

                        ${
                        vendasHTML ||
                        `<div class="empty">Nenhuma venda cadastrada.</div>`
                        }
                    </div>

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
                                                Math.max(
                                                    0,
                                                    Number(p.valor || 0) -
                                                    Number(p.valor_pago || 0)
                                                )
                                            )}

                                            ${
                                                Number(p.valor_pago || 0) > 0 &&
                                                Number(p.valor_pago || 0) <
                                                Number(p.valor || 0)
                                                    ? `
                                                        <div
                                                            style="
                                                                font-size:11px;
                                                                color:var(--muted);
                                                                margin-top:4px;
                                                            "
                                                        >
                                                            Pago:
                                                            ${fmtMoney(
                                                                Number(p.valor_pago || 0)
                                                            )}
                                                        </div>
                                                    `
                                                    : ''
                                            }

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

                                        
                                        <td>
                                            <button
                                                type="button"
                                                class="btn btn-ghost"
                                                onclick="editParcela('${p.id}')"
                                            >
                                                Editar
                                            </button>
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

/* =====================================================
   MODAL — EDITAR PARCELA
===================================================== */

function abrirModalEditarParcela(parcela) {

    const modalExistente =
        document.getElementById("modalEditarParcela");

    if (modalExistente) {
        modalExistente.remove();
    }

    const valor =
        Number(parcela.valor || 0)
            .toFixed(2)
            .replace(".", ",");

    const valorPago =
        Number(parcela.valor_pago || 0)
            .toFixed(2)
            .replace(".", ",");

    const vencimento =
        parcela.vencimento
            ? String(parcela.vencimento).substring(0, 10)
            : "";

    const modal =
        document.createElement("div");

    modal.id = "modalEditarParcela";

    modal.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.75);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:9999;
        padding:20px;
    `;

    modal.innerHTML = `

        <div
            style="
                width:100%;
                max-width:480px;
                background:var(--card,#151515);
                border:1px solid rgba(255,255,255,.08);
                border-radius:16px;
                padding:24px;
                box-shadow:0 20px 60px rgba(0,0,0,.5);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:20px;
                "
            >

                <div>

                    <h2 style="margin:0;">
                        Editar parcela
                    </h2>

                    <div
                        style="
                            color:var(--muted);
                            margin-top:5px;
                        "
                    >
                        Parcela ${parcela.numero || "-"}
                    </div>

                </div>

                <button
                    type="button"
                    class="btn btn-ghost"
                    onclick="fecharModalEditarParcela()"
                >
                    ✕
                </button>

            </div>


            <div style="margin-bottom:15px;">

                <label>
                    Valor da parcela
                </label>

                <input
                    id="editarParcelaValor"
                    type="text"
                    inputmode="decimal"
                    value="${valor}"
                    style="
                        width:100%;
                        margin-top:6px;
                    "
                >

            </div>


            <div style="margin-bottom:15px;">

                <label>
                    Data de vencimento
                </label>

                <input
                    id="editarParcelaVencimento"
                    type="date"
                    value="${vencimento}"
                    style="
                        width:100%;
                        margin-top:6px;
                    "
                >

            </div>


            <div style="margin-bottom:20px;">

                <label>
                    Valor já pago
                </label>

                <input
                    id="editarParcelaValorPago"
                    type="text"
                    inputmode="decimal"
                    value="${valorPago}"
                    style="
                        width:100%;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    display:flex;
                    gap:10px;
                    justify-content:flex-end;
                "
            >

                <button
                    type="button"
                    class="btn btn-ghost"
                    onclick="fecharModalEditarParcela()"
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="salvarEdicaoParcela('${parcela.id}')"
                >
                    Salvar alterações
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);


    /* Fecha clicando fora */

    modal.addEventListener(
        "click",
        function(event) {

            if (event.target === modal) {
                fecharModalEditarParcela();
            }

        }
    );

}


/* =====================================================
   FECHAR MODAL
===================================================== */

function fecharModalEditarParcela() {

    const modal =
        document.getElementById(
            "modalEditarParcela"
        );

    if (modal) {
        modal.remove();
    }

}

/* =====================================================
   SALVAR EDIÇÃO DA PARCELA
===================================================== */

async function salvarEdicaoParcela(id) {

    try {

        const campoValor =
            document.getElementById(
                "editarParcelaValor"
            );

        const campoVencimento =
            document.getElementById(
                "editarParcelaVencimento"
            );

        const campoValorPago =
            document.getElementById(
                "editarParcelaValorPago"
            );


        if (
            !campoValor ||
            !campoVencimento ||
            !campoValorPago
        ) {
            alert(
                "Não foi possível localizar os campos da parcela."
            );

            return;
        }


        /* =========================================
           CONVERTER VALORES
        ========================================= */

        const valor =
            Number(
                String(campoValor.value)
                    .replace(/\./g, "")
                    .replace(",", ".")
            );

        const valorPago =
            Number(
                String(campoValorPago.value)
                    .replace(/\./g, "")
                    .replace(",", ".")
            );


        /* =========================================
           VALIDAÇÕES
        ========================================= */

        if (
            !Number.isFinite(valor) ||
            valor < 0
        ) {
            alert(
                "Informe um valor de parcela válido."
            );

            return;
        }


        if (
            !Number.isFinite(valorPago) ||
            valorPago < 0
        ) {
            alert(
                "Informe um valor pago válido."
            );

            return;
        }


        if (valorPago > valor) {

            alert(
                "O valor pago não pode ser maior " +
                "que o valor da parcela."
            );

            return;
        }


        if (!campoVencimento.value) {

            alert(
                "Informe a data de vencimento."
            );

            return;
        }


        /* =========================================
           DEFINIR STATUS
        ========================================= */

        let status = "pendente";

        if (
            valor > 0 &&
            valorPago >= valor
        ) {

            status = "paga";

        } else {

            const hoje =
                new Date();

            hoje.setHours(
                0,
                0,
                0,
                0
            );

            const vencimento =
                new Date(
                    campoVencimento.value +
                    "T00:00:00"
                );

            if (vencimento < hoje) {

                status = "atrasada";

            } else {

                status = "pendente";

            }

        }


        /* =========================================
           DATA DE PAGAMENTO
        ========================================= */

        let dataPagamento = null;


        if (status === "paga") {

            dataPagamento =
                new Date()
                    .toISOString()
                    .split("T")[0];

        }


        /* =========================================
           ATUALIZAR SUPABASE
        ========================================= */

        const { data, error } =
            await supabaseClient
                .from("parcelas")
                .update({

                    valor:
                        valor,

                    vencimento:
                        campoVencimento.value,

                    valor_pago:
                        valorPago,

                    status:
                        status,

                    data_pagamento:
                        dataPagamento

                })
                .eq("id", id)
                .select()
                .single();


        if (error) {
            throw error;
        }


        /* =========================================
           FECHAR MODAL
        ========================================= */

        fecharModalEditarParcela();


        alert(
            "Parcela atualizada com sucesso!"
        );


        /* =========================================
           DESCOBRIR O CLIENTE
        ========================================= */

        if (data && data.venda_id) {

            const {
                data: venda,
                error: erroVenda
            } =
                await supabaseClient
                    .from("vendas")
                    .select("cliente_id")
                    .eq(
                        "id",
                        data.venda_id
                    )
                    .single();


            if (erroVenda) {
                throw erroVenda;
            }


            if (venda) {

                await viewClient(
                    venda.cliente_id
                );

            }

        }


    } catch (erro) {

        console.error(
            "Erro ao salvar parcela:",
            erro
        );

        alert(
            "Não foi possível salvar a parcela.\n\n" +
            (erro.message || erro)
        );

    }

}

/* =====================================================
   MODAL — EDITAR VENDA
===================================================== */

function abrirModalEditarVenda(venda) {

    const modalExistente =
        document.getElementById("modalEditarVenda");

    if (modalExistente) {
        modalExistente.remove();
    }

    const valor =
        Number(venda.valor_total || 0)
            .toFixed(2)
            .replace(".", ",");

    const modal =
        document.createElement("div");

    modal.id = "modalEditarVenda";

    modal.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.75);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:9999;
        padding:20px;
    `;

    modal.innerHTML = `

        <div
            style="
                width:100%;
                max-width:520px;
                background:var(--card,#151515);
                border:1px solid rgba(255,255,255,.08);
                border-radius:16px;
                padding:24px;
                box-shadow:0 20px 60px rgba(0,0,0,.5);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:20px;
                "
            >

                <div>

                    <h2 style="margin:0;">
                        Editar venda
                    </h2>

                    <div
                        style="
                            color:var(--muted);
                            margin-top:5px;
                        "
                    >
                        Dados da venda
                    </div>

                </div>

                <button
                    type="button"
                    class="btn btn-ghost"
                    onclick="fecharModalEditarVenda()"
                >
                    ✕
                </button>

            </div>


            <div style="margin-bottom:15px;">

                <label>
                    Descrição da venda
                </label>

                <textarea
                    id="editarVendaDescricao"
                    rows="4"
                    style="
                        width:100%;
                        margin-top:6px;
                        resize:vertical;
                    "
                >${safe(venda.descricao || "")}</textarea>

            </div>


            <div style="margin-bottom:20px;">

                <label>
                    Valor total da venda
                </label>

                <input
                    id="editarVendaValor"
                    type="text"
                    inputmode="decimal"
                    value="${valor}"
                    style="
                        width:100%;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    display:flex;
                    gap:10px;
                    justify-content:flex-end;
                "
            >

                <button
                    type="button"
                    class="btn btn-ghost"
                    onclick="fecharModalEditarVenda()"
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="salvarEdicaoVenda('${venda.id}')"
                >
                    Salvar alterações
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);


    /* Fecha clicando fora */

    modal.addEventListener(
        "click",
        function(event) {

            if (event.target === modal) {
                fecharModalEditarVenda();
            }

        }
    );

}


/* =====================================================
   FECHAR MODAL DE VENDA
===================================================== */

function fecharModalEditarVenda() {

    const modal =
        document.getElementById(
            "modalEditarVenda"
        );

    if (modal) {
        modal.remove();
    }

}

/* =====================================================
   SALVAR EDIÇÃO DA VENDA
===================================================== */

async function salvarEdicaoVenda(id) {

    try {

        const campoDescricao =
            document.getElementById("editarVendaDescricao");

        const campoValor =
            document.getElementById("editarVendaValor");

        if (!campoDescricao || !campoValor) {
            alert("Não foi possível localizar os campos da venda.");
            return;
        }

        const descricao =
            campoDescricao.value.trim();

        const valor =
            Number(
                String(campoValor.value)
                    .replace(/\./g, "")
                    .replace(",", ".")
            );

        if (!descricao) {
            alert("Informe a descrição da venda.");
            campoDescricao.focus();
            return;
        }

        if (!Number.isFinite(valor) || valor < 0) {
            alert("Informe um valor válido.");
            campoValor.focus();
            return;
        }


        /* =========================================
           BUSCAR VENDA ATUAL
        ========================================= */

        const { data: vendaAtual, error: erroVenda } =
            await supabaseClient
                .from("vendas")
                .select("*")
                .eq("id", id)
                .single();

        if (erroVenda) {
            throw erroVenda;
        }

        if (!vendaAtual) {
            alert("Venda não encontrada.");
            return;
        }


        /* =========================================
           BUSCAR PARCELAS
        ========================================= */

        const { data: parcelasVenda, error: erroParcelas } =
            await supabaseClient
                .from("parcelas")
                .select("*")
                .eq("venda_id", id)
                .order("numero", {
                    ascending: true
                });

        if (erroParcelas) {
            throw erroParcelas;
        }

        /* =========================================
           DIAGNÓSTICO: nenhuma parcela encontrada
           Se a venda tem parcelas mas a busca voltou
           vazia, é sinal de venda_id não bater com o
           id (tipo diferente) ou RLS bloqueando o
           SELECT em "parcelas". Sem isso, a função
           seguiria e "teria sucesso" sem alterar nada.
        ========================================= */

        if (!parcelasVenda || parcelasVenda.length === 0) {

            console.warn(
                "Nenhuma parcela encontrada para venda_id =",
                id,
                "(tipo:", typeof id, ")"
            );

            alert(
                "A venda foi atualizada, mas nenhuma parcela foi " +
                "encontrada para redistribuir (venda_id = " + id + "). " +
                "Verifique se o id da venda bate com o tipo da coluna " +
                "venda_id em 'parcelas', e se a policy de SELECT dessa " +
                "tabela permite a leitura."
            );
        }


        /* =========================================
           TOTAL JÁ PAGO
        ========================================= */

        const totalPago =
            (parcelasVenda || []).reduce(
                (sum, parcela) =>
                    sum + Number(parcela.valor_pago || 0),
                0
            );


        /* =========================================
           NOVO SALDO
        ========================================= */

        const novoSaldo =
            Math.max(
                0,
                valor - totalPago
            );


        /* =========================================
           PARCELAS QUE AINDA POSSUEM SALDO
        ========================================= */

        const parcelasAbertas =
            (parcelasVenda || []).filter((parcela) => {

                const valorParcela =
                    Number(parcela.valor || 0);

                const pago =
                    Number(parcela.valor_pago || 0);

                return valorParcela > pago;
            });


        /* =========================================
           ATUALIZAR VENDA
        ========================================= */

        const { data: vendaAtualizada, error: erroAtualizacaoVenda } =
            await supabaseClient
                .from("vendas")
                .update({
                    descricao: descricao,
                    valor_total: valor
                })
                .eq("id", id)
                .select()
                .single();

        if (erroAtualizacaoVenda) {
            throw erroAtualizacaoVenda;
        }


        /* =========================================
        REDISTRIBUIR PARCELAS ABERTAS
        ========================================= */

        if (parcelasAbertas.length > 0) {

            /* =========================================
               PISO: soma do que já foi pago nas
               parcelas abertas. Nenhuma parcela pode
               receber um "valor" menor do que o que
               já foi pago nela — então primeiro
               reservamos esse piso, e distribuímos
               apenas o EXCEDENTE do saldo entre as
               parcelas abertas.
            ========================================= */

            const pagoNasAbertas =
                parcelasAbertas.reduce(
                    (sum, parcela) =>
                        sum + Number(parcela.valor_pago || 0),
                    0
                );

            /*
               Excedente a distribuir além do que já
               foi pago em cada parcela aberta. Se o
               novo total da venda for menor que o que
               já foi pago (situação anômala), o
               excedente fica zerado e cada parcela
               aberta recebe exatamente o seu piso —
               nunca um valor abaixo do que já pagou.
            */

            const excedente =
                Math.max(
                    0,
                    novoSaldo - pagoNasAbertas
                );

            const excedenteBase =
                excedente / parcelasAbertas.length;

            let acumuladoExcedente = 0;

            for (
                let i = 0;
                i < parcelasAbertas.length;
                i++
            ) {

                const parcela =
                    parcelasAbertas[i];

                const pisoParcela =
                    Number(parcela.valor_pago || 0);

                let fatiaExcedente;

                /* =====================================
                ÚLTIMA PARCELA
                recebe qualquer diferença de centavos
                ===================================== */

                if (
                    i ===
                    parcelasAbertas.length - 1
                ) {

                    fatiaExcedente =
                        Math.round(
                            (excedente - acumuladoExcedente) * 100
                        ) / 100;

                } else {

                    fatiaExcedente =
                        Math.round(
                            excedenteBase * 100
                        ) / 100;

                    acumuladoExcedente +=
                        fatiaExcedente;
                }

                const novoValorParcela =
                    Math.round(
                        (pisoParcela + fatiaExcedente) * 100
                    ) / 100;


                /* =====================================
                DEFINIR STATUS
                ===================================== */

                const pago =
                    Number(
                        parcela.valor_pago || 0
                    );

                let novoStatus = "pendente";


                if (
                    novoValorParcela > 0 &&
                    pago >= novoValorParcela
                ) {

                    novoStatus = "paga";

                } else {

                    const hoje =
                        new Date();

                    hoje.setHours(
                        0,
                        0,
                        0,
                        0
                    );


                    const vencimento =
                        new Date(
                            parcela.vencimento +
                            "T00:00:00"
                        );

                    vencimento.setHours(
                        0,
                        0,
                        0,
                        0
                    );


                    if (
                        vencimento < hoje
                    ) {

                        novoStatus = "atrasada";

                    } else {

                        novoStatus = "pendente";
                    }
                }


                /* =====================================
                ATUALIZAR PARCELA
                ===================================== */

                const {
                    data: parcelaAtualizada,
                    error: erroAtualizacaoParcela
                } =
                    await supabaseClient
                        .from("parcelas")
                        .update({
                            valor:
                                novoValorParcela,

                            status:
                                novoStatus
                        })
                        .eq(
                            "id",
                            parcela.id
                        )
                        .select()
                        .single();


                if (
                    erroAtualizacaoParcela
                ) {

                    console.error(
                        "Erro ao atualizar parcela:",
                        parcela.id,
                        erroAtualizacaoParcela
                    );

                    throw erroAtualizacaoParcela;
                }


                /* =====================================
                CONFIRMAR ATUALIZAÇÃO
                ===================================== */

                console.log(
                    "Parcela atualizada:",
                    parcelaAtualizada
                );
            }
        }
        


        /* =========================================
           FECHAR MODAL
        ========================================= */

        fecharModalEditarVenda();


        alert(
            "Venda e parcelas atualizadas com sucesso!"
        );


        /* =========================================
           RECARREGAR CLIENTE
        ========================================= */

        if (
            vendaAtualizada &&
            vendaAtualizada.cliente_id
        ) {

            await viewClient(
                vendaAtualizada.cliente_id
            );
        }


    } catch (erro) {

        console.error(
            "Erro ao salvar venda:",
            erro
        );

        alert(
            "Não foi possível salvar a venda.\n\n" +
            (erro.message || erro)
        );
    }
}
