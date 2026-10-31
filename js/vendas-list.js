
/* =========================================================
   LISTAGEM DE VENDAS
   Fonte única de dados: Supabase
   ========================================================= */

let sales = [];

function paymentMethodLabel(method) {
    const labels = {
        crediario: 'Crediário / fiado',
        dinheiro: 'Dinheiro',
        pix: 'PIX',
        cartao_debito: 'Cartão de débito',
        cartao_credito: 'Cartão de crédito à vista',
        transferencia: 'Transferência bancária',
        cartao: 'Cartão',
        outros: 'Outros'
    };
    return labels[method] || '—';
}


/* =========================================================
   CARREGAR VENDAS
   ========================================================= */

async function loadSales() {

    sales = await supabaseQuery((c) =>
        c
            .from('vendas')
            .select(`
                *,
                clientes(nome),
                parcelas(
                    id,
                    numero,
                    status,
                    valor,
                    valor_pago,
                    vencimento
                )
            `)
            .order('data_venda', {
                ascending: false
            })
    ) || [];

    renderSales();
}


/* =========================================================
   VERIFICAR SE UMA PARCELA ESTÁ PAGA
   ========================================================= */

function parcelaEstaPaga(parcela) {

    const valor =
        Number(parcela?.valor || 0);

    const valorPago =
        Number(
            parcela?.valor_pago ??
            parcela?.total_pago ??
            0
        );


    if (parcela?.status === 'paga') {
        return true;
    }


    if (
        valor > 0 &&
        valorPago >= valor
    ) {
        return true;
    }


    return false;
}


/* =========================================================
   VERIFICAR SE A VENDA ESTÁ ATRASADA
   ========================================================= */

function vendaEstaAtrasada(sale) {

    /*
       Venda cancelada não deve aparecer como atrasada.
    */

    if (
        sale?.status === 'cancelada'
    ) {
        return false;
    }


    const parcelas =
        sale?.parcelas || [];


    if (!parcelas.length) {
        return false;
    }


    const hoje =
        new Date();

    const ano =
        hoje.getFullYear();

    const mes =
        String(
            hoje.getMonth() + 1
        ).padStart(2, '0');

    const dia =
        String(
            hoje.getDate()
        ).padStart(2, '0');


    const hojeISO =
        `${ano}-${mes}-${dia}`;


    /*
       A venda está atrasada se existir
       pelo menos uma parcela:

       - não paga
       - vencida
    */

    return parcelas.some(
        (parcela) => {

            if (
                parcelaEstaPaga(
                    parcela
                )
            ) {
                return false;
            }


            if (
                !parcela?.vencimento
            ) {
                return false;
            }


            return (
                parcela.vencimento <
                hojeISO
            );
        }
    );
}


/* =========================================================
   STATUS VISUAL DA VENDA
   ========================================================= */

function statusVenda(sale) {

    /*
       Atrasada tem prioridade visual.
    */

    if (
        vendaEstaAtrasada(sale)
    ) {

        return {
            status: 'atrasada',
            label: 'Atrasada'
        };
    }


    if (
        sale?.status === 'aberta'
    ) {

        return {
            status: 'aberta',
            label: 'Aberta'
        };
    }


    if (
        sale?.status === 'finalizada'
    ) {

        return {
            status: 'finalizada',
            label: 'Finalizada'
        };
    }


    if (
        sale?.status === 'cancelada'
    ) {

        return {
            status: 'cancelada',
            label: 'Cancelada'
        };
    }


    return {
        status:
            sale?.status ||
            'aberta',

        label:
            sale?.status ||
            'Aberta'
    };
}


/* =========================================================
   RENDERIZAR VENDAS
   ========================================================= */

function renderSales() {

    const term =
        (
            document
                .getElementById(
                    'sale-search'
                )
                ?.value ||
            ''
        )
        .toLowerCase()
        .trim();


    const statusFiltro =
        document
            .getElementById(
                'sale-status'
            )
            ?.value || '';


    const filtered =
        sales.filter(
            (sale) => {

                /* -----------------------------------------
                   PESQUISA
                   ----------------------------------------- */

                const correspondePesquisa =
                    [
                        sale.descricao,
                        sale.clientes?.nome,
                        sale.forma_pagamento
                    ].some(
                        (value) =>
                            safe(value)
                                .toLowerCase()
                                .includes(term)
                    );


                if (
                    !correspondePesquisa
                ) {
                    return false;
                }


                /* -----------------------------------------
                   FILTRO DE STATUS
                   ----------------------------------------- */

                if (!statusFiltro) {
                    return true;
                }


                /*
                   FILTRO ATRASADAS
                */

                if (
                    statusFiltro ===
                    'atrasada'
                ) {

                    return vendaEstaAtrasada(
                        sale
                    );
                }


                /*
                   DEMAIS STATUS
                */

                return (
                    sale.status ===
                    statusFiltro
                );
            }
        );


    /* =====================================================
       TABELA
       ===================================================== */

    const tabela =
        document.getElementById(
            'sales-table'
        );


    if (!tabela) {
        return;
    }


    tabela.innerHTML =
        filtered
            .map(
                (sale) => {

                    const statusInfo =
                        statusVenda(
                            sale
                        );


                    /*
                       Somente administrador
                       recebe o botão Excluir.
                    */

                    const botaoExcluir =
                        typeof isAdmin ===
                            'function' &&
                        isAdmin()

                        ? `
                            <button
                                class="btn btn-danger delete-sale-row"
                                data-id="${sale.id}"
                            >
                                Excluir
                            </button>
                        `

                        : '';


                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${display(
                                        sale.clientes?.nome || 'Venda sem identificação'
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${display(
                                    sale.descricao
                                )}
                            </td>

                            <td>
                                ${fmtMoney(
                                    sale.valor_total
                                )}
                            </td>

                            <td>
                                ${display(paymentMethodLabel(sale.forma_pagamento))}
                            </td>

                            <td>
                                ${
                                    sale.parcelas?.length ||
                                    sale.quantidade_parcelas ||
                                    0
                                }
                            </td>

                            <td>
                                ${dateBR(
                                    sale.data_venda
                                )}
                            </td>

                            <td>
                                ${statusHTML(
                                    statusInfo.status,
                                    statusInfo.label
                                )}
                            </td>

                            <td>
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
                    colspan="8"
                    class="empty"
                >
                    Nenhuma venda encontrada.
                </td>
            </tr>
        `;


    /* =====================================================
       BOTÕES DE EXCLUIR
       ===================================================== */

    document
        .querySelectorAll(
            '.delete-sale-row'
        )
        .forEach(
            (button) => {

                button.onclick =
                    async () => {

                        /*
                           SEGURANÇA EXTRA:

                           Mesmo que alguém tente
                           executar a função pelo
                           console, o vendedor
                           não poderá excluir.
                        */

                        if (
                            typeof isAdmin !==
                                'function' ||
                            !isAdmin()
                        ) {

                            toast(
                                'Somente o administrador pode excluir vendas.',
                                'error'
                            );

                            return;
                        }


                        if (
                            !confirm(
                                'Excluir esta venda, todas as parcelas e os recebimentos vinculados?'
                            )
                        ) {
                            return;
                        }


                        try {

                            await supabaseQuery(
                                (c) =>
                                    c
                                        .from(
                                            'vendas'
                                        )
                                        .delete()
                                        .eq(
                                            'id',
                                            button.dataset.id
                                        )
                            );


                            toast(
                                'Venda excluída.'
                            );


                            await loadSales();

                        } catch (_) {}
                    };
            }
        );
}


/* =========================================================
   EVENTOS
   ========================================================= */

document
    .getElementById(
        'sale-search'
    )
    ?.addEventListener(
        'input',
        renderSales
    );


document
    .getElementById(
        'sale-status'
    )
    ?.addEventListener(
        'change',
        renderSales
    );


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

loadSales()
    .catch(
        () => {

            const tabela =
                document.getElementById(
                    'sales-table'
                );


            if (tabela) {

                tabela.innerHTML = `
                    <tr>
                        <td
                            colspan="8"
                            class="empty"
                        >
                            Configure o Supabase para carregar vendas.
                        </td>
                    </tr>
                `;
            }
        }
    );
