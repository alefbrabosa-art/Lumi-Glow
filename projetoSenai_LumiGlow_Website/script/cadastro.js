// 1. ESTRUTURA DE DADOS EM MEMÓRIA (Array de Objetos / JSON)
const profissionaisCadastrados = [
    {
        id: 1,
        nome: "Dra. Helena Vasconcelos",
        email: "helena@lumiglow.com.br",
        clinica: "Lumi Glow Jardins",
        especialidade: "Harmonização"
    },
    {
        id: 2,
        nome: "Mariana Costa",
        email: "mariana.facial@lumiglow.com.br",
        clinica: "Lumi Glow Moema",
        especialidade: "Estética Facial"
    },
    {
        id: 3,
        nome: "Beatriz Nogueira",
        email: "gestao@lumiglow.com.br",
        clinica: "Lumi Glow Jardins",
        especialidade: "Gestão e Recepção"
    }
];

// SELEÇÃO DE ELEMENTOS DO DOM
const formCadastro = document.getElementById("formCadastro");
const cardsContainer = document.getElementById("cardsContainer");
const contadorRegistros = document.getElementById("contadorRegistros");
const mensagemFeedback = document.getElementById("mensagemFeedback");
const campoBusca = document.getElementById("campoBusca");
const filtroEspecialidade = document.getElementById("filtroEspecialidade");
const inputSenha = document.getElementById("senha");
const btnMostrarSenha = document.getElementById("mostrarSenha");

// Alternar visualização da senha
btnMostrarSenha.addEventListener("click", () => {
    const isPassword = inputSenha.type === "password";
    inputSenha.type = isPassword ? "text" : "password";
    btnMostrarSenha.textContent = isPassword ? "◎" : "◉";
});

// 2. RENDERIZAÇÃO DINÂMICA (.map() + Destructuring)
function renderizarCards(lista) {
    contadorRegistros.textContent = `${lista.length} ${lista.length === 1 ? "cadastro" : "cadastros"}`;

    if (lista.length === 0) {
        cardsContainer.innerHTML = `
            <p class="mensagem-vazia">
                Nenhum profissional encontrado com os filtros informados.
            </p>
        `;
        return;
    }

    cardsContainer.innerHTML = lista
        .map(({ nome, email, clinica, especialidade }) => `
            <article class="usuario-card">
                <div class="card-topo">
                    <h4>${nome}</h4>
                    <span class="tag-area">${especialidade}</span>
                </div>
                <p class="card-info"><strong>Unidade:</strong> ${clinica}</p>
                <p class="card-info"><strong>E-mail:</strong> ${email}</p>
            </article>
        `)
        .join("");
}

// 4. FILTRO E BUSCA EM TEMPO REAL (.filter() + .includes())
function aplicarFiltros() {
    const termoBusca = campoBusca.value.trim().toLowerCase();
    const areaSelecionada = filtroEspecialidade.value;

    const listaFiltrada = profissionaisCadastrados.filter((profissional) => {
        const correspondeTexto =
            profissional.nome.toLowerCase().includes(termoBusca) ||
            profissional.clinica.toLowerCase().includes(termoBusca) ||
            profissional.email.toLowerCase().includes(termoBusca);

        const correspondeArea =
            areaSelecionada === "" || profissional.especialidade.includes(areaSelecionada);

        return correspondeTexto && correspondeArea;
    });

    renderizarCards(listaFiltrada);
}

campoBusca.addEventListener("input", aplicarFiltros);
filtroEspecialidade.addEventListener("change", aplicarFiltros);

// 3. CAPTURA DE FORMULÁRIO SEM RECARREGAR (event.preventDefault())
formCadastro.addEventListener("submit", (event) => {
    event.preventDefault();

    const novoProfissional = {
        id: Date.now(),
        nome: document.getElementById("nome").value.trim(),
        email: document.getElementById("email").value.trim(),
        clinica: document.getElementById("clinica").value.trim(),
        especialidade: document.getElementById("especialidade").value
    };

    profissionaisCadastrados.unshift(novoProfissional);

    aplicarFiltros();
    formCadastro.reset();

    mensagemFeedback.textContent = `✧ Cadastro de ${novoProfissional.nome} realizado com sucesso!`;
    setTimeout(() => {
        mensagemFeedback.textContent = "";
    }, 4000);
});

// Inicializa a lista ao carregar a página
renderizarCards(profissionaisCadastrados);