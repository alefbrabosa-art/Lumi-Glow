// ===== 1. DADOS: array de objetos (formato JSON) =====
const funcionalidades = [
    {
        titulo: "Agendamentos Inteligentes",
        categoria: "Atendimento",
        descricao: "Organize atendimentos e evite sobreposição de horários."
    },
    {
        titulo: "Gestão de Clientes",
        categoria: "Gestão",
        descricao: "Cadastro completo e histórico de cada cliente."
    },
    {
        titulo: "Procedimentos e Sessões",
        categoria: "Atendimento",
        descricao: "Controle sessões contratadas, realizadas e restantes."
    },
    {
        titulo: "Relatórios e Financeiro",
        categoria: "Financeiro",
        descricao: "Acompanhe pagamentos e indicadores do seu negócio."
    }
];

const lista = document.querySelector(".cards");
const form = document.getElementById("form-funcionalidade");
const busca = document.getElementById("busca-funcionalidade");

// ===== 2. RENDERIZAÇÃO: .map() + destructuring =====
function renderizar(itens) {
    if (!lista) return;

    lista.innerHTML = itens
        .map(
            ({ titulo, categoria, descricao }, i) => `
            <article class="card">
                <span class="card-numero">${String(i + 1).padStart(2, "0")}</span>
                <span class="card-categoria">${escaparHTML(categoria)}</span>
                <h3>${escaparHTML(titulo)}</h3>
                <p>${escaparHTML(descricao)}</p>
            </article>
        `
        )
        .join("");
}

// Evita que textos digitados no formulário sejam interpretados como HTML.
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caractere]));
}

// ===== 3. FORMULÁRIO: submit + preventDefault =====
if (form) {
    form.addEventListener("submit", (evento) => {
        evento.preventDefault();

        const titulo = form.titulo.value.trim();
        const categoria = form.categoria.value;
        const descricao = form.descricao.value.trim();
        if (!titulo || !descricao) return;

        funcionalidades.push({ titulo, categoria, descricao });
        form.reset();

        filtrarFuncionalidades();
    });
}

// ===== 4. FILTRO OPCIONAL: .filter() + .includes() =====
function filtrarFuncionalidades() {
    const termo = busca ? busca.value.toLowerCase().trim() : "";

    const resultado = funcionalidades.filter(
        ({ titulo, categoria, descricao }) =>
            titulo.toLowerCase().includes(termo) ||
            categoria.toLowerCase().includes(termo) ||
            descricao.toLowerCase().includes(termo)
    );

    renderizar(resultado);
}

if (busca) {
    busca.addEventListener("input", filtrarFuncionalidades);
}

// ===== 5. EFEITO: card inclina com o mouse =====
if (lista) {
    lista.addEventListener("mousemove", (e) => {
        const card = e.target.closest(".card");
        if (!card) return;
        const { left, top, width, height } = card.getBoundingClientRect();
        const x = (e.clientX - left) / width - 0.5;
        const y = (e.clientY - top) / height - 0.5;
        card.style.transform = `perspective(800px) rotateX(${-y * 16}deg) rotateY(${x * 16}deg) scale(1.04)`;
    });

    lista.addEventListener("mouseout", (e) => {
        const card = e.target.closest(".card");
        if (card && !card.contains(e.relatedTarget)) {
            card.style.transform = "";
        }
    });
}

renderizar(funcionalidades);