# SISTEMA ZER01 — arquivos-fonte

Este pacote é uma implementação em **HTML, CSS e JavaScript puro**, preparada para Supabase Authentication e PostgreSQL. Não há Next.js, cadastro de produtos, estoque, entrada ou valor restante.

## Configuração

1. Abra `js/supabase.js`.
2. Substitua `COLE_AQUI_A_URL_DO_SEU_PROJETO_SUPABASE` pela URL do seu projeto.
3. Substitua `COLE_AQUI_A_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE` pela chave pública do Supabase.
4. Execute `supabase/schema.sql` no SQL Editor do Supabase.
5. Crie usuários em Authentication > Users.
6. Sirva esta pasta por um servidor HTTP local, por exemplo `python3 -m http.server 8080`.

Nunca coloque a `service_role key`, senha, token privado ou credencial bancária no frontend. A integração PIX e a geração de carnê ficam preparadas no modelo de dados para uma etapa posterior com backend seguro/webhook.

## Arquivos principais

| Área | Arquivos |
|---|---|
| Páginas | `login.html`, `dashboard.html`, `clientes.html`, `vendas.html`, `receber.html`, `pagamentos.html`, `relatorios.html`, `configuracoes.html` |
| Estilos | `css/global.css` e arquivos CSS específicos por página |
| JavaScript | `js/supabase.js`, `auth.js`, `app.js` e módulos de cada página |
| Banco | `supabase/schema.sql` |

As credenciais precisam ser preenchidas antes de usar o sistema. O frontend não usa `localStorage` como banco alternativo: sem uma URL e uma chave pública válidas, as consultas e gravações são bloqueadas e uma mensagem de erro é exibida. Depois da configuração, clientes, vendas, parcelas, pagamentos, dashboard e relatórios consultam diretamente as tabelas do Supabase.
