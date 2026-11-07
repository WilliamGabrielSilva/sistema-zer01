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

## Atualização: vendas à vista

- **Instalação nova:** execute `supabase/schema.sql` normalmente.
- **Sistema já em uso:** execute `supabase/migration_vendas_a_vista.sql` no SQL Editor do Supabase antes de publicar os arquivos atualizados. A migração permite `cliente_id` nulo e adiciona `vendas.forma_pagamento`, sem apagar as vendas existentes.
- Na tela **Nova venda**, selecione **À vista** para escolher dinheiro, PIX, cartão de débito, cartão de crédito à vista ou transferência. O cliente é opcional e a venda fica quitada no histórico.
- Selecione **Crediário / fiado** para exigir um cliente e configurar as parcelas como antes.

## Comprovantes de venda (impressora térmica 58 mm)

O sistema permite imprimir um comprovante interno, não fiscal, para vendas à vista e no crediário. Após salvar uma venda, use **Imprimir comprovante**; no histórico, o botão **Imprimir** permite emitir uma segunda via. O layout é otimizado para bobina de 58 mm. Para funcionar, permita pop-ups/impressão no navegador.

Antes de usar a versão atualizada, execute no SQL Editor do Supabase o arquivo `supabase/migration_vendas_a_vista.sql`. A migração inclui `itens_json`, que guarda uma cópia dos itens, quantidades e valores para permitir a reimpressão do comprovante. Vendas antigas sem esse snapshot continuarão imprimindo o resumo textual já salvo.

**Importante:** este comprovante é apenas um registro interno e não substitui NFC-e ou outro documento fiscal obrigatório.


## Cartão da loja (crediário com leitura de cartão)

- **Instalação:** execute `supabase/migration_cartao_loja.sql` no SQL Editor do Supabase (depois de `migration_zer01_score.sql`).
- Os cartões continuam sendo emitidos em **Zer01 Score**; o código do cartão (código de barras CODE128) identifica o cliente.
- Em **Nova venda**, a modalidade **Cartão da loja** funciona como o crediário (parcelas, limite e bloqueio por atraso), mas exige a leitura do cartão. Em **Crediário / fiado** a leitura é opcional.
- Para identificar o cartão: digite o código, passe o **leitor de código de barras** (USB/Bluetooth, que digita o código e envia Enter) ou use o botão **Câmera** (exige HTTPS ou `localhost`).
- Ao ler o cartão abre a tela com dados do cliente, status do cartão, limite aprovado, em aberto, disponível e parcelas vencidas. Cartão bloqueado/cancelado, cliente sem limite, com parcela vencida ou sem limite disponível não pode ser usado.
- A venda no cartão da loja é revalidada ao finalizar e novamente no banco (trigger).
