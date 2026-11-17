// ESTRUTURA DE DADOS EM MEMÓRIA
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
const formLogin = document.getElementById("formLogin");
const inputUsuario = document.getElementById("usuario");
const senha = document.getElementById("senha");
const mostrarSenha = document.getElementById("mostrarSenha");
const mensagemFeedback = document.getElementById("mensagemFeedback");
const btnGoogle = document.getElementById("btnGoogle");

// Alternar visualização da senha (igual ao cadastro.js)
mostrarSenha.addEventListener("click", () => {
    const isPassword = senha.type === "password";
    senha.type = isPassword ? "text" : "password";
    mostrarSenha.textContent = isPassword ? "◎" : "◉";
});

// Captura do formulário sem recarregar a página
formLogin.addEventListener("submit", (event) => {
    event.preventDefault();

    const valorDigitado = inputUsuario.value.trim().toLowerCase();

    const usuarioEncontrado = profissionaisCadastrados.find(
        ({ email, nome }) =>
            email.toLowerCase() === valorDigitado ||
            nome.toLowerCase().includes(valorDigitado)
    );

    if (usuarioEncontrado) {
        const { nome, clinica } = usuarioEncontrado;
        mensagemFeedback.style.color = "#5C7A52";
        mensagemFeedback.textContent = `✧ Bem-vindo(a) de volta, ${nome} (${clinica})!`;
    } else {
        mensagemFeedback.style.color = "#5C7A52";
        mensagemFeedback.textContent = `✧ Acesso realizado para ${inputUsuario.value.trim()}!`;
    }

    formLogin.reset();
    senha.type = "password";
    mostrarSenha.textContent = "◉";

    setTimeout(() => {
        mensagemFeedback.textContent = "";
    }, 4000);
});

// Feedback ao clicar no botão Google
btnGoogle.addEventListener("click", () => {
    mensagemFeedback.style.color = "#8F7E6B";
    mensagemFeedback.textContent = "✧ Conectando com a conta Google...";

    setTimeout(() => {
        mensagemFeedback.textContent = "";
    }, 3000);
});