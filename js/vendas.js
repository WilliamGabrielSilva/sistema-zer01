/* =========================================================
   VENDAS
   Grava venda e parcelas no Supabase.
   Não utiliza localStorage.
   ========================================================= */


/* =========================================================
   ESTADO
   ========================================================= */

let items = [
  {
    descricao: '',
    quantidade: 1,
    valor: 0
  }
];

let clients = [];


/* =========================================================
   CALCULAR TOTAL DA VENDA
   ========================================================= */

function total() {

  return items.reduce((sum, item) => {

    const quantidade =
      Number(item.quantidade) || 0;

    const valor =
      Number(item.valor) || 0;

    return sum + (quantidade * valor);

  }, 0);

}


/* =========================================================
   RENDERIZAR ITENS
   ========================================================= */

function renderItems() {

  const container =
    document.getElementById('sale-items');

  if (!container) return;


  container.innerHTML = items.map((item, index) => {

    return `
      <div
        class="form-grid"
        style="margin-bottom:13px"
      >

        <!-- DESCRIÇÃO -->

        <div class="field full">

          <label>
            Descrição do item ${index + 1}
          </label>

          <input
            data-i="${index}"
            data-k="descricao"
            value="${escapeHTML(item.descricao)}"
          >

        </div>


        <!-- QUANTIDADE -->

        <div class="field">

          <label>
            Quantidade
          </label>

          <input
            data-i="${index}"
            data-k="quantidade"
            type="number"
            min="1"
            step="1"
            value="${item.quantidade}"
          >

        </div>


        <!-- VALOR -->

        <div class="field">

          <label>
            Valor unitário
          </label>

          <input
            data-i="${index}"
            data-k="valor"
            type="number"
            min="0"
            step="0.01"
            value="${Number(item.valor || 0).toFixed(2)}"
          >

        </div>

      </div>
    `;

  }).join('');


  /*
   * Eventos dos campos dos itens
   */

  container
    .querySelectorAll('input')
    .forEach(input => {

      input.addEventListener('input', () => {

        const index =
          Number(input.dataset.i);

        const key =
          input.dataset.k;


        if (key === 'descricao') {

          items[index][key] =
            input.value;

        } else {

          items[index][key] =
            Number(input.value) || 0;

        }


        renderTotal();

      });

    });

}


/* =========================================================
   ESCAPAR HTML
   Evita problemas quando a descrição possui caracteres
   especiais.
   ========================================================= */

function escapeHTML(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


/* =========================================================
   RENDERIZAR TOTAL
   ========================================================= */

function renderTotal() {

  const totalElement =
    document.getElementById('sale-total');

  if (!totalElement) return;


  const saleTotal =
    total();


  totalElement.textContent =
    fmtMoney(saleTotal);


  renderInstallments();

}


/* =========================================================
   GERAR PARCELAS
   ========================================================= */

function renderInstallments() {

  const container =
    document.getElementById('installments');

  if (!container) return;


  /*
   * Quantidade de parcelas
   */

  let count =
    Number(
      document.getElementById(
        'installment-count'
      )?.value
    );


  if (!Number.isInteger(count) || count < 1) {

    count = 1;

  }


  /*
   * Total da venda em centavos.
   *
   * Trabalhar em centavos evita problemas
   * de precisão com números decimais.
   *
   * Exemplo:
   *
   * 100 / 3
   *
   * 3334
   * 3333
   * 3333
   */

  const totalCents =
    Math.round(total() * 100);


  /*
   * Valor base de cada parcela
   */

  const baseCents =
    Math.floor(totalCents / count);


  /*
   * Centavos restantes
   */

  const remainderCents =
    totalCents -
    (baseCents * count);


  /*
   * Gera as parcelas
   */

  container.innerHTML =
    Array.from(
      { length: count },
      (_, index) => {


        /*
         * Distribuímos os centavos restantes
         * entre as primeiras parcelas.
         */

        const installmentCents =
          baseCents +
          (
            index < remainderCents
              ? 1
              : 0
          );


        const installmentValue =
          installmentCents / 100;


        /*
         * Data padrão.
         *
         * Parcela 1 = +30 dias
         * Parcela 2 = +60 dias
         * Parcela 3 = +90 dias
         */

        const date =
          new Date();


        date.setDate(
          date.getDate() +
          (30 * (index + 1))
        );


        const dateISO =
          date.toISOString()
            .slice(0, 10);


        return `

          <div
            class="form-grid"
            style="margin-bottom:12px"
          >

            <!-- VALOR DA PARCELA -->

            <div class="field">

              <label>
                Parcela ${index + 1} — valor
              </label>

              <input
                class="installment-value"
                data-i="${index}"
                type="number"
                min="0"
                step="0.01"
                value="${installmentValue.toFixed(2)}"
              >

            </div>


            <!-- VENCIMENTO -->

            <div class="field">

              <label>
                Vencimento
              </label>

              <input
                class="installment-date"
                data-i="${index}"
                type="date"
                value="${dateISO}"
              >

            </div>

          </div>

        `;

      }
    ).join('');

}


/* =========================================================
   CARREGAR CLIENTES
   ========================================================= */

async function init() {

  clients =
    await supabaseQuery(
      client =>
        client
          .from('clientes')
          .select('id,nome')
          .order('nome')
    ) || [];


  const select =
    document.getElementById(
      'sale-client'
    );


  if (!select) return;


  select.innerHTML =
    `
      <option value="">
        Selecione um cliente
      </option>
    `;


  clients.forEach(client => {

    const option =
      document.createElement('option');


    option.value =
      client.id;


    option.textContent =
      client.nome;


    select.appendChild(option);

  });

}


/* =========================================================
   ADICIONAR ITEM
   ========================================================= */

document
  .getElementById('add-item')
  ?.addEventListener(
    'click',
    () => {

      items.push({

        descricao: '',

        quantidade: 1,

        valor: 0

      });


      renderItems();

    }
  );


/* =========================================================
   ALTERAR QUANTIDADE DE PARCELAS
   ========================================================= */

document
  .getElementById('installment-count')
  ?.addEventListener(
    'input',
    () => {

      renderInstallments();

    }
  );


/* =========================================================
   SALVAR VENDA
   ========================================================= */

document
  .getElementById('sale-form')
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      try {


        /* -------------------------------------------------
           CLIENTE
           ------------------------------------------------- */

        const clienteId =
          document
            .getElementById(
              'sale-client'
            )
            ?.value;


        if (!clienteId) {

          toast(
            'Selecione um cliente.',
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           TOTAL DA VENDA
           ------------------------------------------------- */

        const saleTotal =
          total();


        if (saleTotal <= 0) {

          toast(
            'Adicione pelo menos um item com valor válido.',
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           QUANTIDADE DE PARCELAS
           ------------------------------------------------- */

        const installmentCount =
          Number(
            document.getElementById(
              'installment-count'
            )?.value
          );


        if (
          !Number.isInteger(installmentCount) ||
          installmentCount < 1
        ) {

          toast(
            'Informe uma quantidade válida de parcelas.',
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           CAMPOS DAS PARCELAS
           ------------------------------------------------- */

        const installmentInputs = [
          ...document.querySelectorAll(
            '.installment-value'
          )
        ];


        const dateInputs = [
          ...document.querySelectorAll(
            '.installment-date'
          )
        ];


        if (
          installmentInputs.length !==
          installmentCount
        ) {

          toast(
            'Erro ao gerar as parcelas. Tente novamente.',
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           VALORES
           ------------------------------------------------- */

        const installmentValues =
          installmentInputs.map(input => {

            const value =
              Number(input.value);


            return Number.isFinite(value)
              ? value
              : 0;

          });


        /* -------------------------------------------------
           VERIFICAR VALORES
           ------------------------------------------------- */

        const invalidValue =
          installmentValues.some(
            value =>
              value < 0
          );


        if (invalidValue) {

          toast(
            'O valor das parcelas não pode ser negativo.',
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           SOMA DAS PARCELAS
           ------------------------------------------------- */

        const installmentsTotal =
          installmentValues.reduce(
            (sum, value) =>
              sum + value,
            0
          );


        /*
         * Converte os dois valores para centavos.
         */

        const saleCents =
          Math.round(
            saleTotal * 100
          );


        const installmentsCents =
          Math.round(
            installmentsTotal * 100
          );


        /* -------------------------------------------------
           CONFERIR SE FECHA A VENDA
           ------------------------------------------------- */

        if (
          saleCents !==
          installmentsCents
        ) {

          toast(
            `A soma das parcelas (${fmtMoney(
              installmentsTotal
            )}) precisa ser igual ao total da venda (${fmtMoney(
              saleTotal
            )}).`,
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           VERIFICAR DATAS
           ------------------------------------------------- */

        const invalidDate =
          dateInputs.some(
            input =>
              !input.value
          );


        if (invalidDate) {

          toast(
            'Informe o vencimento de todas as parcelas.',
            'error'
          );

          return;

        }


        /* -------------------------------------------------
           DESCRIÇÃO DOS ITENS
           ------------------------------------------------- */

        const descricao =
          items
            .map(item =>
              item.descricao
            )
            .filter(
              descricao =>
                descricao &&
                descricao.trim()
            )
            .join(' / ');


        /* -------------------------------------------------
           OBSERVAÇÕES
           ------------------------------------------------- */

        const observacoes =
          document.getElementById(
            'sale-notes'
          )?.value || null;


        /* -------------------------------------------------
           SALVAR VENDA
           ------------------------------------------------- */

        const sale =
          await supabaseQuery(
            client =>
              client
                .from('vendas')
                .insert({

                  cliente_id:
                    clienteId,

                  descricao:
                    descricao || null,

                  valor_total:
                    saleTotal,

                  quantidade_parcelas:
                    installmentCount,

                  data_venda:
                    todayISO(),

                  status:
                    'aberta',

                  observacoes:
                    observacoes

                })
                .select()
                .single()
          );


        if (!sale || !sale.id) {

          throw new Error(
            'A venda não foi criada corretamente.'
          );

        }


        /* -------------------------------------------------
           MONTAR PARCELAS
           ------------------------------------------------- */

        const rows =
          installmentValues.map(
            (value, index) => {

              return {

                venda_id:
                  sale.id,

                numero:
                  index + 1,

                valor:
                  value,

                vencimento:
                  dateInputs[index].value,

                status:
                  'pendente'

              };

            }
          );


        /* -------------------------------------------------
           SALVAR PARCELAS
           ------------------------------------------------- */

        await supabaseQuery(
          client =>
            client
              .from('parcelas')
              .insert(rows)
        );


        /* -------------------------------------------------
           SUCESSO
           ------------------------------------------------- */

        toast(
          'Venda e parcelas salvas no Supabase.'
        );


        /* -------------------------------------------------
           LIMPAR FORMULÁRIO
           ------------------------------------------------- */

        event.target.reset();


        items = [
          {
            descricao: '',
            quantidade: 1,
            valor: 0
          }
        ];


        renderItems();

        renderTotal();


      } catch (error) {


        console.error(
          'Erro ao salvar venda:',
          error
        );


        toast(
          error?.message ||
          'Erro ao salvar a venda.',
          'error'
        );

      }

    }
  );


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

init()
  .catch(error => {

    console.error(
      'Erro ao carregar clientes:',
      error
    );


    toast(
      'Configure o Supabase para carregar clientes.',
      'error'
    );

  });


/* =========================================================
   PRIMEIRA RENDERIZAÇÃO
   ========================================================= */

renderItems();

renderTotal();