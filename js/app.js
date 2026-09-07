
/* =========================================================
   APP.JS — SISTEMA ZER01
   Persistência:
   - Não usa localStorage para dados do sistema.
   - Toda leitura/gravação de dados passa pelo Supabase.
   ========================================================= */


/* =========================================================
   FORMATAÇÃO / FUNÇÕES GERAIS
   ========================================================= */

const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
});

const fmtMoney = v =>
    money.format(Number(v) || 0);

const safe = v =>
    v ?? '';

const display = v =>
    safe(v) || '—';

const todayISO = () =>
    new Date().toISOString().slice(0, 10);

const dateBR = v =>
    v
        ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR')
        : '—';


/* =========================================================
   STATUS DA PARCELA
   ========================================================= */

function statusParcela(p) {

    if (!p) {
        return 'pendente';
    }

    const valor = Number(p.valor || 0);
    const valorPago = Number(p.valor_pago || 0);

    /*
       Se o valor pago quitou a parcela,
       ela é considerada paga.
    */
    if (
        valorPago >= valor &&
        valor > 0
    ) {
        return 'paga';
    }

    /*
       Se ainda existe saldo e o vencimento passou,
       ela está atrasada.
    */
    if (
        p.vencimento &&
        p.vencimento < todayISO()
    ) {
        return 'atrasada';
    }

    return 'pendente';
}


/* =========================================================
   STATUS VISUAL
   ========================================================= */

function statusHTML(status, label) {

    return `
        <span class="status status-${status}">
            ${label || status}
        </span>
    `;
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message, type = 'info') {

    const region =
        document.getElementById('toast-region');

    if (!region) {
        return;
    }

    const element =
        document.createElement('div');

    element.className =
        `toast toast-${type}`;

    element.textContent =
        message;

    region.append(element);

    setTimeout(() => {
        element.remove();
    }, 4200);
}


/* =========================================================
   SUPABASE
   ========================================================= */

function requireSupabase() {

    if (
        !window.SUPABASE_CONFIGURED ||
        !window.supabaseClient
    ) {

        throw new Error(
            'Supabase não configurado. ' +
            'Preencha SUPABASE_URL e SUPABASE_ANON_KEY ' +
            'em js/supabase.js.'
        );
    }

    return window.supabaseClient;
}


async function supabaseQuery(operation) {

    try {

        const client =
            requireSupabase();

        const result =
            await operation(client);

        if (result.error) {
            throw result.error;
        }

        return result.data;

    } catch (error) {

        console.error(
            '[ZER01/Supabase]',
            error
        );

        toast(
            error.message ||
            'Não foi possível acessar o Supabase.',
            'error'
        );

        throw error;
    }
}


/* =========================================================
   MÁSCARA CPF / CNPJ
   ========================================================= */

function maskDoc(v) {

    const d =
        (v || '')
            .replace(/\D/g, '')
            .slice(0, 14);

    if (d.length <= 11) {

        return d
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(
                /(\d{3})(\d{1,2})$/,
                '$1-$2'
            );
    }

    return d
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(
            /(\d{4})(\d{1,2})$/,
            '$1-$2'
        );
}


/* =========================================================
   MÁSCARA TELEFONE
   ========================================================= */

function maskPhone(v) {

    const d =
        (v || '')
            .replace(/\D/g, '')
            .slice(0, 11);

    return d.length > 10

        ? d.replace(
            /(\d{2})(\d{5})(\d{4})/,
            '($1) $2-$3'
        )

        : d
            .replace(
                /(\d{2})(\d{4})(\d{0,4})/,
                '($1) $2-$3'
            )
            .replace(/-$/, '');
}


/* =========================================================
   PERMISSÕES DO MENU
   ========================================================= */

/*
   Regras:

   ADMINISTRADOR:
   - Dashboard
   - Clientes
   - Nova venda
   - Vendas
   - Contas a receber
   - Pagamentos
   - Relatórios
   - Configurações

   VENDEDOR:
   - Dashboard
   - Clientes
   - Nova venda
   - Vendas
   - Contas a receber

   O vendedor NÃO vê:
   - Pagamentos
   - Relatórios
   - Configurações
*/


function aplicarPermissoesMenu() {

    /*
       Se auth.js ainda não carregou,
       não tenta aplicar as permissões.
    */

    if (
        typeof obterPerfilUsuario !== 'function'
    ) {
        console.warn(
            '[ZER01] auth.js não foi carregado antes do app.js.'
        );

        return;
    }


    const perfil =
        obterPerfilUsuario();


    /*
       Itens que somente o administrador pode visualizar.
    */

    const somenteAdmin = [
        'pagamentos.html',
        'relatorios.html',
        'configuracoes.html'
    ];


    document
        .querySelectorAll('.sidebar a')
        .forEach(link => {

            const href =
                (
                    link.getAttribute('href') ||
                    ''
                )
                .split('?')[0]
                .split('#')[0]
                .toLowerCase();

            const pagina =
                href
                    .split('/')
                    .pop();


            if (
                somenteAdmin.includes(pagina)
            ) {

                if (
                    perfil !== 'administrador'
                ) {

                    link.style.display =
                        'none';
                }
            }
        });
}


/* =========================================================
   PROTEÇÃO DE PÁGINAS
   ========================================================= */

/*
   Mesmo escondendo o menu,
   também protegemos diretamente as páginas.

   Assim o vendedor não poderá simplesmente
   digitar:

   pagamentos.html
   relatorios.html
   configuracoes.html

   no navegador.
*/

function protegerPaginaPorPerfil() {

    if (
        typeof obterPerfilUsuario !== 'function'
    ) {
        return;
    }


    const perfil =
        obterPerfilUsuario();


    const paginaAtual =
        window.location.pathname
            .split('/')
            .pop()
            .toLowerCase();


    const paginasSomenteAdmin = [

        'pagamentos.html',

        'relatorios.html',

        'configuracoes.html'

    ];


    if (
        paginasSomenteAdmin.includes(
            paginaAtual
        )
    ) {

        if (
            perfil !== 'administrador'
        ) {

            toast(
                'Esta área é exclusiva do administrador.',
                'error'
            );

            setTimeout(() => {

                window.location.replace(
                    'dashboard.html'
                );

            }, 300);

            return false;
        }
    }


    return true;
}


/* =========================================================
   BOTÕES / AÇÕES ADMINISTRATIVAS
   ========================================================= */

/*
   Essa função permite marcar botões específicos
   como exclusivos do administrador.

   Exemplo no HTML:

   <button data-permissao="admin">
       Excluir
   </button>

   Se for vendedor, o botão desaparece.
*/

function aplicarPermissoesBotoes() {

    if (
        typeof obterPerfilUsuario !== 'function'
    ) {
        return;
    }


    const perfil =
        obterPerfilUsuario();


    document
        .querySelectorAll(
            '[data-permissao="admin"]'
        )
        .forEach(element => {

            if (
                perfil !== 'administrador'
            ) {

                element.style.display =
                    'none';
            }
        });
}


/* =========================================================
   SHELL DO SISTEMA
   ========================================================= */

function renderShell() {

    const sidebar =
        document.querySelector(
            '.sidebar'
        );


    /*
       Menu mobile
    */

    document
        .getElementById('mobile-menu')
        ?.addEventListener(
            'click',
            () => {

                sidebar?.classList.toggle(
                    'open'
                );

            }
        );


    /*
       Logout
    */

    document
        .getElementById('logout-button')
        ?.addEventListener(
            'click',
            async () => {

                try {

                    if (
                        window.supabaseClient
                    ) {

                        await window
                            .supabaseClient
                            .auth
                            .signOut();

                    }

                } finally {

                    /*
                       Limpa a sessão visual
                       somente através do fluxo
                       de autenticação.

                       Os dados do sistema continuam
                       no Supabase.
                    */

                    window.location.href =
                        'login.html';
                }

            }
        );


    /*
       Aplicar permissões depois
       que o shell foi carregado.
    */

    aplicarPermissoesMenu();

    aplicarPermissoesBotoes();

    protegerPaginaPorPerfil();
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

renderShell();
