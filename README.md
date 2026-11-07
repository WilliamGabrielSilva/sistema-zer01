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


## Módulo Zer01 Score

O módulo foi adicionado em `zer01-score.html`, com estilos em `css/score.css` e lógica em `js/zer01-score.js`.

### Instalação em uma base já existente

1. Faça backup do projeto Supabase.
2. Abra o SQL Editor do Supabase.
3. Execute `supabase/migration_zer01_score.sql`.
4. Publique os arquivos atualizados do projeto.
5. Acesse **Zer01 Score** pelo menu lateral.
6. Atualize a análise; o sistema calcula a pontuação a partir das parcelas e dos recebimentos registrados.

A migração cria as tabelas de configuração, score atual, histórico, decisões de crédito e cartões. Ela não apaga dados das tabelas existentes.

### Política inicial

- Limite-base: R$ 300,00.
- Pesos: pontualidade 40%, atrasos/duração 25%, histórico recente 15%, tempo como cliente 10% e valor pago em dia 10%.
- Histórico mínimo: 3 parcelas quitadas. Antes disso, o cliente aparece como **sem classificação** e exige decisão manual.
- Faixas: 0–399 bloqueado; 400–599 = 0,5x; 600–749 = 1x; 750–899 = 1,5x; 900–1.000 = 2x.
- O funcionário registra o limite aprovado e o motivo da decisão.
- Qualquer parcela vencida com saldo em aberto bloqueia nova venda no crediário.
- O cartão físico/digital usa um código único Code 128, sem CPF ou dados financeiros no código.

### Observações importantes

- A análise é interna e não consulta score de birôs externos.
- O score é recalculado ao abrir/atualizar a página Zer01 Score; depois de registrar pagamentos ou editar parcelas, entre novamente na página ou use **Atualizar análises** para refletir as mudanças.
- A trava de novas vendas a prazo também é validada por trigger no PostgreSQL. A migração SQL precisa ser executada para que essa proteção do banco entre em vigor.
- A estrutura atual do sistema usa políticas RLS amplas para usuários autenticados. A migração mantém o padrão de acesso atual; uma futura etapa deve migrar os perfis locais de administrador/vendedor para autorização validada no banco, especialmente antes de expor o sistema a usuários externos.
- A impressão do cartão usa tamanho padrão de cartão ID-1 (85,6 × 54 mm); confira a opção de escala/tamanho no diálogo da impressora.
