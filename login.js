/* =========================================================
   LOGIN — SISTEMA ZER01
   ========================================================= */

document
    .getElementById('login-form')
    ?.addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const error =
                document.getElementById(
                    'login-error'
                );


            error.textContent = '';


            /* -----------------------------------------
               VERIFICAR SUPABASE
               ----------------------------------------- */

            if (
                !SUPABASE_CONFIGURED ||
                !supabaseClient
            ) {

                error.textContent =
                    'Configure primeiro a URL e a chave pública em js/supabase.js.';

                return;

            }


            /* -----------------------------------------
               DADOS DO LOGIN
               ----------------------------------------- */

            const email =
                document
                    .getElementById('login-email')
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                document
                    .getElementById('login-password')
                    .value;


            if (!email || !password) {

                error.textContent =
                    'Informe o e-mail e a senha.';

                return;

            }


            /* -----------------------------------------
               VERIFICAR PERFIL
               ----------------------------------------- */

            const usuarioPermitido =
                USUARIOS_ZER01[email];


            if (!usuarioPermitido) {

                error.textContent =
                    'Este usuário não possui permissão para acessar o sistema.';

                return;

            }


            /* -----------------------------------------
               AUTENTICAR NO SUPABASE
               ----------------------------------------- */

            const {
                data,
                error: authError
            } =
                await supabaseClient.auth
                    .signInWithPassword({

                        email: email,

                        password: password

                    });


            /* -----------------------------------------
               ERRO DE AUTENTICAÇÃO
               ----------------------------------------- */

            if (authError) {

                error.textContent =
                    'E-mail ou senha incorretos.';

                console.error(
                    'Erro Supabase:',
                    authError
                );

                return;

            }


            /* -----------------------------------------
               VERIFICAR USUÁRIO
               ----------------------------------------- */

            if (!data?.user) {

                error.textContent =
                    'Não foi possível identificar o usuário.';

                return;

            }


            /* -----------------------------------------
               REGISTRAR PERFIL
               ----------------------------------------- */

            const registrado =
                registrarUsuarioLogado(
                    data.user.email
                );


            if (!registrado) {

                await supabaseClient.auth.signOut();

                error.textContent =
                    'Usuário sem perfil autorizado.';

                return;

            }


            /* -----------------------------------------
               LOGIN CONCLUÍDO
               ----------------------------------------- */

            window.location.replace(
                'dashboard.html'
            );

        }
    );