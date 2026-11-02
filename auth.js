/* =========================================================
   AUTENTICAÇÃO — SISTEMA ZER01
   ========================================================= */


/* =========================================================
   USUÁRIOS / PERFIS
   ========================================================= */

const USUARIOS_ZER01 = {

    'barbadosearrumados02@gmail.com': {
        perfil: 'administrador',
        nome: 'Administrador'
    },

    'contatestewgs05@gmail.com': {
        perfil: 'vendedor',
        nome: 'Vendedor'
    }

};;


/* =========================================================
   VERIFICAR SE ESTÁ LOGADO
   ========================================================= */

function usuarioEstaLogado() {

    return (
        localStorage.getItem(
            'zer01_usuario_logado'
        ) === 'true'
    );

}


/* =========================================================
   OBTER USUÁRIO LOGADO
   ========================================================= */

function obterUsuarioLogado() {

    try {

        const dados =
            localStorage.getItem(
                'zer01_usuario'
            );

        if (!dados) {
            return null;
        }

        return JSON.parse(dados);

    } catch (error) {

        console.error(
            'Erro ao obter usuário:',
            error
        );

        return null;

    }

}


/* =========================================================
   OBTER PERFIL
   ========================================================= */

function obterPerfilUsuario() {

    const usuario =
        obterUsuarioLogado();

    return usuario?.perfil || null;

}


/* =========================================================
   OBTER NOME
   ========================================================= */

function obterNomeUsuario() {

    const usuario =
        obterUsuarioLogado();

    return usuario?.nome || 'Usuário';

}


/* =========================================================
   VERIFICAR ADMINISTRADOR
   ========================================================= */

function isAdmin() {

    return (
        obterPerfilUsuario() ===
        'administrador'
    );

}


/* =========================================================
   VERIFICAR VENDEDOR
   ========================================================= */

function isVendedor() {

    return (
        obterPerfilUsuario() ===
        'vendedor'
    );

}


/* =========================================================
   PROTEGER PÁGINAS
   ========================================================= */

function protegerPagina() {

    const paginaAtual =
        window.location.pathname
            .split('/')
            .pop()
            .toLowerCase();


    /*
     * Login não pode ser protegido.
     */

    if (
        paginaAtual === 'login.html' ||
        paginaAtual === ''
    ) {

        return;

    }


    /*
     * Usuário não está logado.
     */

    if (!usuarioEstaLogado()) {

        window.location.replace(
            'login.html'
        );

        return;

    }


    /*
     * Usuário logado, mas sem perfil.
     */

    if (!obterPerfilUsuario()) {

        localStorage.removeItem(
            'zer01_usuario_logado'
        );

        localStorage.removeItem(
            'zer01_usuario'
        );

        window.location.replace(
            'login.html'
        );

    }

}


/* =========================================================
   REGISTRAR USUÁRIO APÓS LOGIN
   ========================================================= */

function registrarUsuarioLogado(email) {

    const emailNormalizado =
        String(email || '')
            .trim()
            .toLowerCase();


    const usuario =
        USUARIOS_ZER01[
            emailNormalizado
        ];


    /*
     * E-mail não está autorizado
     * para usar o sistema.
     */

    if (!usuario) {

        return false;

    }


    /*
     * Salva sessão.
     */

    localStorage.setItem(
        'zer01_usuario_logado',
        'true'
    );


    /*
     * Salva informações do perfil.
     */

    localStorage.setItem(
        'zer01_usuario',
        JSON.stringify({
            email: emailNormalizado,
            perfil: usuario.perfil,
            nome: usuario.nome
        })
    );


    return true;

}


/* =========================================================
   EXIGIR ADMINISTRADOR
   ========================================================= */

function requireAdmin() {

    if (!usuarioEstaLogado()) {

        window.location.replace(
            'login.html'
        );

        return false;

    }


    if (!isAdmin()) {

        toast(
            'Acesso permitido somente ao administrador.',
            'error'
        );

        return false;

    }


    return true;

}


/* =========================================================
   EXIGIR USUÁRIO AUTORIZADO
   ========================================================= */

function requireUsuario() {

    if (!usuarioEstaLogado()) {

        window.location.replace(
            'login.html'
        );

        return false;

    }


    if (
        !isAdmin() &&
        !isVendedor()
    ) {

        toast(
            'Usuário sem permissão.',
            'error'
        );

        return false;

    }


    return true;

}


/* =========================================================
   LOGOUT
   ========================================================= */

function realizarLogout() {

    localStorage.removeItem(
        'zer01_usuario_logado'
    );


    localStorage.removeItem(
        'zer01_usuario'
    );


    /*
     * Também encerra a sessão do Supabase.
     */

    if (
        typeof supabaseClient !== 'undefined' &&
        supabaseClient
    ) {

        supabaseClient.auth
            .signOut()
            .finally(() => {

                window.location.replace(
                    'login.html'
                );

            });

        return;

    }


    window.location.replace(
        'login.html'
    );

}


/* =========================================================
   BOTÃO SAIR
   ========================================================= */

document
    .getElementById('logout-button')
    ?.addEventListener(
        'click',
        realizarLogout
    );


/* =========================================================
   PROTEGER PÁGINA ATUAL
   ========================================================= */

protegerPagina();