'use strict';
/* =========================================================
   Lumi Glow · lógica do sistema
   Dados: clientes, servicos, agendamentos, pacotes, lancamentos, config.
   Persistência: localStorage (trocar por API/banco depois).
   ========================================================= */

// ---------- Utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, a = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [n, v] of Object.entries(a)) {
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(n, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(x => x != null && x !== false));
  return e;
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
const p2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hm = m => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
const toMin = s => { const [a, b] = s.split(':'); return +a * 60 + +b; };
const brData = s => s.slice(0, 10).split('-').reverse().join('/');
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const soDig = s => s.replace(/\D/g, '');
const telOk = s => [10, 11].includes(soDig(s).length);
const wa = (tel, txt) => `https://wa.me/55${soDig(tel)}?text=${encodeURIComponent(txt)}`;
const msg = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const mascara = v => {
  const d = soDig(v).slice(0, 11);
  if (d.length > 10) return d.replace(/(\d\d)(\d{5})(\d{0,4})/, '($1) $2-$3');
  if (d.length > 6) return d.replace(/(\d\d)(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.length > 2 ? d.replace(/(\d\d)(\d*)/, '($1) $2') : d;
};
const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ROT = { agendado: 'Agendado', confirmado: '✔ Confirmado', concluido: 'Concluído', faltou: 'Faltou' };

// ---------- Procedimentos oficiais da clínica ----------
const OFICIAIS = [
  ['🧖‍♀️ Limpeza de Pele Master', 90, 180, 'Evite sol e maquiagem por 24h e use protetor solar.'],
  ['⚡ Depilação a Laser', 30, 150, 'Evite sol e calor na área por 48h e use protetor solar.'],
  ['🎨 Remoção de Tatuagem', 30, 250, 'Mantenha a área limpa e protegida; não retire as casquinhas e evite sol.'],
  ['✨ Peeling de Hollywood', 60, 250, 'Evite sol por 48h, use protetor solar e não esfregue a pele.'],
  ['🌿 Peeling de Algas', 60, 130, 'Evite sol por 24h e use protetor solar.'],
  ['💧 Drenagem Linfática', 60, 100, 'Beba bastante água nas próximas horas.'],
  ['🔥 Massagem Modeladora', 60, 110, 'Beba bastante água e evite alimentos muito gordurosos hoje.'],
  ['💆‍♀️ Massagem Relaxante', 60, 100, 'Beba água e descanse; evite esforço intenso hoje.'],
  ['🔥 Protocolo 3X', 90, 350, ''],
];
const semEmoji = s => s.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();

// ---------- Dados ----------
const KEY = 'lumiglow:v1';
const padrao = () => ({
  perfil: { nome: 'Lumi Glow', cargo: 'Administradora', foto: '' },
  clientes: [
    { id: uid(), nome: 'Maria Silva', telefone: '(11) 90000-0001', email: '', nascimento: '', obs: '', consentimento: true },
    { id: uid(), nome: 'Ana Oliveira', telefone: '(11) 90000-0002', email: '', nascimento: '', obs: '', consentimento: true },
    { id: uid(), nome: 'Carla Souza', telefone: '(11) 90000-0003', email: '', nascimento: '', obs: '', consentimento: true },
  ],
  servicos: OFICIAIS.map(([nome, duracao, preco, cuidados]) => ({ id: uid(), nome, duracao, preco, cuidados })),
  agendamentos: [],
  profissionais: [{ id: uid(), nome: 'Equipe' }],
  bloqueios: [],
  pacotes: [],
  produtos: [],
  espera: [],
  lancamentos: [],
  enviados: {},
  config: {
    inicio: '08:00', fim: '18:00', intervalo: 30, dias: [1, 2, 3, 4, 5],
    msgs: {
      lembrete: 'Olá, {nome}! Lembrando do seu horário de {servico} em {data} às {hora} na Lumi Glow. Pode confirmar?',
      pos: 'Oi, {nome}! Como você está após o {servico}? {cuidados} Qualquer dúvida, é só chamar.',
      retorno: 'Oi, {nome}! Faz um tempo desde o seu último atendimento. Vamos agendar a manutenção?',
      aniv: 'Feliz aniversário, {nome}! 🎉 A Lumi Glow preparou um mimo para você. Vamos agendar?',
      pacote: 'Oi, {nome}! Seu pacote de {servico} está acabando ({restantes} sessão(ões); validade até {validade}). Vamos renovar?',
      vaga: 'Oi, {nome}! Abriu uma vaga para {servico}. Quer aproveitar? Responda e eu reservo para você.',
    },
  },
});
let db;
try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
{
  const p = padrao();
  db = db ? { ...p, ...db, perfil: { ...p.perfil, ...db.perfil }, config: { ...p.config, ...db.config, msgs: { ...p.config.msgs, ...db.config?.msgs } } } : p;
}
const salvar = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { alert('Não foi possível salvar os dados neste navegador. Baixe um backup.'); }
};
salvar();

const migrar = () => {
  db.perfil ||= { nome: 'Lumi Glow', cargo: 'Administradora', foto: '' };
  db.perfil.foto ??= '';
  if (!db.profissionais?.length) db.profissionais = [{ id: uid(), nome: 'Equipe' }];
  db.bloqueios ||= []; db.pacotes ||= []; db.produtos ||= []; db.espera ||= []; db.lancamentos ||= [];
  db.agendamentos.forEach(a => { a.profissionalId ??= db.profissionais[0].id; });

  db.flags ||= {};
  if (!db.flags.procOficiais) {
    for (const [nome, duracao, preco, cuidados] of OFICIAIS) {
      const ex = db.servicos.find(s => semEmoji(s.nome) === semEmoji(nome));
      if (!ex) db.servicos.push({ id: uid(), nome, duracao, preco, cuidados });
      else {
        ex.nome = nome;
        if (!ex.preco) ex.preco = preco;
        if (!ex.cuidados) ex.cuidados = cuidados;
      }
    }
    db.flags.procOficiais = true;
  }
};
migrar(); salvar();
const cli = id => db.clientes.find(c => c.id === id);
const ativos = () => db.agendamentos.filter(a => a.status !== 'cancelado');
const pacoteOk = p => p.usadas < p.total && p.validade >= iso(new Date());
const ultimo = id => ativos().filter(a => a.clienteId === id && a.status === 'concluido').sort((x, y) => x.inicio.localeCompare(y.inicio)).at(-1);
const iniMin = a => toMin(a.inicio.slice(11));
const fimMin = a => iniMin(a) + a.duracao;

function sincronizarBaixas(a) {
  const p = db.pacotes.find(x => x.id === a.pacoteId), srv = db.servicos.find(s => s.id === a.servicoId);
  const pr = srv?.produtoId && db.produtos.find(x => x.id === srv.produtoId), concl = a.status === 'concluido';
  if (concl && !a.baixado) {
    if (p) p.usadas++;
    if (pr) pr.qtd = Math.max(0, +(pr.qtd - (srv.consumo || 0)).toFixed(2));
    a.baixado = { pacoteId: p?.id, produtoId: pr?.id, qtd: pr ? (srv.consumo || 0) : 0 };
  } else if (!concl && a.baixado) {
    const b = a.baixado, pb = db.pacotes.find(x => x.id === b.pacoteId), prb = db.produtos.find(x => x.id === b.produtoId);
    if (pb) pb.usadas = Math.max(0, pb.usadas - 1);
    if (prb) prb.qtd = +(prb.qtd + b.qtd).toFixed(2);
    a.baixado = null;
  }
}
const bloqueado = (data, ini, dur) => db.bloqueios.some(b => b.data === data && ini < toMin(b.fim) && toMin(b.ini) < ini + dur);
const conflito = (data, ini, dur, ignorar, prof) =>
  bloqueado(data, ini, dur) ? 'bloqueio'
  : ativos().some(a => a.id !== ignorar && a.profissionalId === prof && a.inicio.slice(0, 10) === data && ini < fimMin(a) && iniMin(a) < ini + dur) ? 'agenda' : '';

// ---------- Menu em gaveta (celular) e data de hoje ----------
const menuLateral = $('#menuLateral');
const btnMenu = $('#btnMenu');
const scrim = $('#scrim');

function setMenuGaveta(aberto) {
  if (!menuLateral || !btnMenu || !scrim) return;
  menuLateral.classList.toggle('aberto', aberto);
  scrim.hidden = !aberto;
  btnMenu.setAttribute('aria-expanded', String(aberto));
}

if (btnMenu && scrim) {
  btnMenu.addEventListener('click', () => setMenuGaveta(!menuLateral.classList.contains('aberto')));
  scrim.addEventListener('click', () => setMenuGaveta(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenuGaveta(false); });
}

const dataHojeEl = $('#dataHoje');
if (dataHojeEl) {
  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  dataHojeEl.textContent = d.charAt(0).toUpperCase() + d.slice(1);
}

// ---------- Login e Perfil de Múltiplos Usuários ----------
const USERS_KEY = 'lumiglow:usuarios';
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

function getUsuarios() {
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { lista = []; }
  if (!Array.isArray(lista)) lista = [];

  try {
    const antigo = JSON.parse(localStorage.getItem('lumiglow:auth') || 'null');
    if (antigo?.u && antigo?.hs && !lista.some(x => x.u.toLowerCase() === antigo.u.toLowerCase())) {
      lista.push({
        u: antigo.u,
        hs: antigo.hs,
        nome: db.perfil?.nome || antigo.u,
        cargo: db.perfil?.cargo || 'Administradora',
        foto: db.perfil?.foto || ''
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(lista));
    }
  } catch {}
  return lista;
}

function salvarUsuarios(lista) {
  localStorage.setItem(USERS_KEY, JSON.stringify(lista));
}

function usuarioAtualObj() {
  const login = sessionStorage.getItem('lumiglow:usuarioNome') || '';
  return getUsuarios().find(x =>
    x.u.toLowerCase() === login.toLowerCase() ||
    (x.email && x.email.toLowerCase() === login.toLowerCase())
  ) || null;
}

async function gerarAvatarDataUrl(file) {
  const bmp = await createImageBitmap(file);
  const lado = Math.min(bmp.width, bmp.height);
  const sx = Math.floor((bmp.width - lado) / 2);
  const sy = Math.floor((bmp.height - lado) / 2);
  const cv = document.createElement('canvas');
  cv.width = 200;
  cv.height = 200;
  cv.getContext('2d').drawImage(bmp, sx, sy, lado, lado, 0, 0, 200, 200);
  return cv.toDataURL('image/jpeg', 0.82);
}

function renderAvatar(el, foto) {
  if (!el) return;
  if (foto) el.replaceChildren(h('img', { src: foto, alt: 'Foto de perfil' }));
  else el.textContent = '✧';
}

function atualizarIdentidadeUsuario() {
  const user = usuarioAtualObj();
  const usuarioLogin = user?.u || sessionStorage.getItem('lumiglow:usuarioNome') || '';
  const nomeExibicao = user?.nome?.trim() || usuarioLogin || 'Lumi Glow';
  const cargoExibicao = user?.cargo?.trim() || 'Colaboradora';
  const foto = user?.foto || '';

  const elNome = $('#perfilNomeExibicao');
  const elCargo = $('#perfilCargoExibicao');
  const elAvatar = $('#perfilAvatarSidebar');
  const tituloSaudacao = $('.saudacao h1');

  if (elNome) {
    elNome.textContent = nomeExibicao;
    elNome.title = nomeExibicao;
  }
  if (elCargo) elCargo.textContent = cargoExibicao;
  renderAvatar(elAvatar, foto);
  if (tituloSaudacao) tituloSaudacao.textContent = `Olá, ${nomeExibicao}!`;
}

const modalPerfil = $('#modalPerfil');
const btnPerfil = $('#btnPerfil');
let fotoPerfilTemp = '';

function atualizarPreviewModalPerfil() {
  renderAvatar($('#pfPreview'), fotoPerfilTemp);
  const btnRemover = $('#btnRemoverFoto');
  if (btnRemover) btnRemover.hidden = !fotoPerfilTemp;
}

if (btnPerfil && modalPerfil) {
  btnPerfil.addEventListener('click', () => {
    setMenuGaveta(false);
    const user = usuarioAtualObj();
    const usuarioAtual = user?.u || sessionStorage.getItem('lumiglow:usuarioNome') || '';
    $('#pfNome').value = user?.nome || usuarioAtual || '';
    $('#pfCargo').value = user?.cargo || 'Colaboradora';
    $('#pfUsuario').value = usuarioAtual;
    $('#pfSenha').value = '';
    $('#pfFoto').value = '';
    $('#pfErro').textContent = '';
    fotoPerfilTemp = user?.foto || '';
    atualizarPreviewModalPerfil();
    modalPerfil.showModal();
  });

  $('#pfFoto').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      fotoPerfilTemp = await gerarAvatarDataUrl(file);
      $('#pfErro').textContent = '';
      atualizarPreviewModalPerfil();
    } catch {
      $('#pfErro').textContent = 'Não foi possível carregar essa imagem.';
    }
  });

  $('#btnRemoverFoto').addEventListener('click', () => {
    fotoPerfilTemp = '';
    $('#pfFoto').value = '';
    atualizarPreviewModalPerfil();
  });

  $('#btnFecharPerfil').addEventListener('click', () => modalPerfil.close());

  $('#formPerfil').addEventListener('submit', async e => {
    e.preventDefault();
    const erro = t => ($('#pfErro').textContent = t);
    const nome = $('#pfNome').value.trim();
    const cargo = $('#pfCargo').value.trim();
    const novoUsuario = $('#pfUsuario').value.trim();
    const novaSenha = $('#pfSenha').value;

    if (!nome || !cargo || !novoUsuario) {
      return erro('Preencha nome, cargo e usuário de acesso.');
    }

    const lista = getUsuarios();
    const loginAntigo = sessionStorage.getItem('lumiglow:usuarioNome') || '';
    const idx = lista.findIndex(x =>
      x.u.toLowerCase() === loginAntigo.toLowerCase() ||
      (x.email && x.email.toLowerCase() === loginAntigo.toLowerCase())
    );
    const atual = idx >= 0 ? lista[idx] : null;

    const conflitoUsuario = lista.some((x, i) =>
      i !== idx && (
        x.u.toLowerCase() === novoUsuario.toLowerCase() ||
        (x.email && x.email.toLowerCase() === novoUsuario.toLowerCase())
      )
    );
    if (conflitoUsuario) {
      return erro('Este usuário de acesso já pertence a outra conta.');
    }

    if (novaSenha && novaSenha.length < 6) {
      return erro('A nova senha precisa ter ao menos 6 caracteres.');
    }
    if (atual && novoUsuario !== atual.u && !novaSenha) {
      return erro('Informe uma nova senha (mín. 6 caracteres) para alterar o usuário de acesso.');
    }

    let hs = atual?.hs || '';
    if (novaSenha) {
      hs = await sha(novoUsuario + ':' + novaSenha);
    } else if (!atual) {
      return erro('Defina uma senha (mín. 6 caracteres) para o acesso.');
    }

    const atualizado = {
      ...atual,
      u: novoUsuario,
      email: novoUsuario,
      hs,
      nome,
      cargo,
      foto: fotoPerfilTemp
    };
    if (idx >= 0) lista[idx] = atualizado;
    else lista.push(atualizado);

    salvarUsuarios(lista);
    sessionStorage.setItem('lumiglow:usuarioNome', novoUsuario);
    atualizarIdentidadeUsuario();
    modalPerfil.close();
  });
}

function prepararLogin() {
  if ($('#btnLogin')) $('#btnLogin').textContent = 'Entrar';
  if ($('#dicaLogin')) $('#dicaLogin').textContent = '';
  if (btnMenu) btnMenu.hidden = true;
}

$('#formLogin')?.addEventListener('submit', async e => {
  e.preventDefault();
  const u = $('#usuario').value.trim(), s = $('#senha').value;
  const conta = getUsuarios().find(x =>
    x.u.toLowerCase() === u.toLowerCase() ||
    (x.email && x.email.toLowerCase() === u.toLowerCase())
  );
  if (!conta) return ($('#erroLogin').textContent = 'Usuário não encontrado.');
  const hs = await sha(conta.u + ':' + s);
  if (conta.hs !== hs) return ($('#erroLogin').textContent = 'Usuário ou senha incorretos.');
  sessionStorage.setItem('lumiglow:sessao', '1');
  sessionStorage.setItem('lumiglow:usuarioNome', conta.u);
  $('#erroLogin').textContent = ''; $('#senha').value = '';
  abrir();
});

$('#btnSair').addEventListener('click', () => {
  sessionStorage.removeItem('lumiglow:sessao');
  sessionStorage.removeItem('lumiglow:usuarioNome');
  window.location.href = '../login.html';
});

function abrir() {
  if ($('#telaLogin')) $('#telaLogin').hidden = true;
  $('#app').hidden = false;
  if (btnMenu) btnMenu.hidden = false;
  atualizarIdentidadeUsuario();
  ir('secaoDashboard');
}

// ---------- Navegação ----------
const SECOES = {
  secaoDashboard: renderDashboard,
  secaoAgenda: renderAgenda,
  secaoClientes: renderClientes,
  secaoProcedimentos: renderProcedimentos,
  secaoSessoes: renderSessoes,
  secaoFinanceiro: renderFinanceiro,
  secaoRelatorios: renderRelatorios,
  secaoConfig: renderConfig,
};

function ir(id) {
  $$('.sec').forEach(s => (s.hidden = s.id !== id));
  $$('.menu-btn').forEach(b => {
    const on = b.dataset.secao === id;
    b.classList.toggle('ativo', on);
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  SECOES[id]?.();
}
$$('.menu-btn').forEach(b => b.addEventListener('click', () => {
  setMenuGaveta(false);
  ir(b.dataset.secao);
}));
document.addEventListener('input', e => { if (e.target.matches('[data-tel]')) e.target.value = mascara(e.target.value); });

// ---------- Atalhos da Tela Início ----------
$('#btnVerTodosAg').addEventListener('click', () => ir('secaoAgenda'));

$('#atalhoNovoAg').addEventListener('click', () => {
  const agora = new Date();
  const proxHora = `${p2(Math.min(23, agora.getHours() + 1))}:00`;
  abrirModal({ data: iso(agora), hora: proxHora });
});

$('#atalhoRegProc').addEventListener('click', () => {
  ir('secaoProcedimentos');
  $('#sNome').focus();
});

$('#atalhoLancarFin').addEventListener('click', () => {
  ir('secaoFinanceiro');
  $('#finDesc').focus();
});

$('#atalhoCadCliente').addEventListener('click', () => {
  ir('secaoClientes');
  $('#cNome').focus();
});

// ---------- Agenda ----------
const segunda = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
let semana = segunda(new Date());
let profAtual = db.profissionais[0].id;
$('#btnAnt').onclick = () => { semana.setDate(semana.getDate() - 7); renderAgenda(); };
$('#btnProx').onclick = () => { semana.setDate(semana.getDate() + 7); renderAgenda(); };
$('#btnHoje').onclick = () => { semana = segunda(new Date()); renderAgenda(); };
$('#filtroProf').onchange = e => { profAtual = e.target.value; renderAgenda(); };

function renderAgenda() {
  if (!db.profissionais.some(p => p.id === profAtual)) profAtual = db.profissionais[0].id;
  const fp = $('#filtroProf');
  fp.replaceChildren(...db.profissionais.map(p => h('option', { value: p.id, selected: p.id === profAtual }, p.nome)));
  fp.hidden = db.profissionais.length < 2;
  const { inicio, fim, intervalo, dias } = db.config;
  const i0 = toMin(inicio), i1 = toMin(fim), agora = new Date();
  const fimSem = new Date(semana); fimSem.setDate(fimSem.getDate() + 6);
  const f = d => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
  $('#tituloSemana').textContent = `${f(semana)} a ${f(fimSem)}`;
  const slot = (min, el) => h('div', { style: `height:calc(var(--h-slot) * ${min / intervalo});padding:2px 0;box-sizing:border-box;` }, el);
  const box = $('#containerDias'); box.replaceChildren();
  for (const wd of [1, 2, 3, 4, 5, 6, 0].filter(x => dias.includes(x))) {
    const d = new Date(semana); d.setDate(d.getDate() + ((wd + 6) % 7));
    const data = iso(d);
    const col = h('div', { class: 'dia-grade', style: 'display:flex;flex-direction:column;gap:0;' });

    const ags = ativos().filter(x => x.inicio.slice(0, 10) === data && x.profissionalId === profAtual)
      .map(a => ({ tipo: 'ag', a, ini: Math.max(i0, iniMin(a)), fim: Math.min(i1, fimMin(a)) })).filter(e => e.fim > e.ini);
    const blqs = [];
    for (const b of db.bloqueios.filter(x => x.data === data)) {
      let pecas = [[Math.max(i0, toMin(b.ini)), Math.min(i1, toMin(b.fim))]].filter(([x, y]) => y > x);
      for (const e of ags) pecas = pecas.flatMap(([x, y]) => (e.fim <= x || e.ini >= y) ? [[x, y]] : [[x, Math.min(y, e.ini)], [Math.max(x, e.fim), y]].filter(([p, q]) => q > p));
      pecas.forEach(([x, y]) => blqs.push({ tipo: 'bloq', b, ini: x, fim: y }));
    }

    const livres = (de, ate) => {
      for (let t = de; t < ate;) {
        const len = Math.min(intervalo, ate - t), tt = t;
        col.append(slot(len, len < 15 ? h('span') : h('button', {
          type: 'button', class: 'livre', style: 'width:100%;height:100%;',
          disabled: new Date(`${data}T${hm(tt)}`) < agora, onclick: () => abrirModal({ data, hora: hm(tt) }),
        }, hm(tt), ' livre')));
        t += len;
      }
    };

    let cursor = i0;
    for (const e of [...ags, ...blqs].sort((x, y) => x.ini - y.ini || (x.tipo === 'ag' ? -1 : 1))) {
      const s = Math.max(e.ini, cursor);
      if (e.fim <= s) continue;
      livres(cursor, s);
      if (e.tipo === 'ag') {
        const a = e.a;
        col.append(slot(e.fim - s, h('button', { type: 'button', class: `ag st-${a.status}`, style: 'width:100%;height:100%;', onclick: () => abrirModal({ id: a.id }) },
          h('b', {}, `${a.inicio.slice(11)}–${hm(fimMin(a))} · ${ROT[a.status]}`), h('span', {}, `${cli(a.clienteId)?.nome ?? '—'} · ${a.servico}`))));
      } else {
        col.append(slot(e.fim - s, h('div', { class: 'bloq', style: 'height:100%;' }, '⛔ ' + (e.b.motivo || 'Bloqueado'))));
      }
      cursor = e.fim;
    }
    livres(cursor, i1);
    box.append(h('div', { class: 'dia-card' }, h('h3', {}, NOMES[wd], ' ', h('small', {}, f(d))), col));
  }
  if (!box.children.length) box.append(h('p', { class: 'vazio' }, 'Nenhum dia de atendimento configurado.'));
}

// ---------- Modal de agendamento ----------
const modal = $('#modal');
let editando = null;
function opcoesClientes(sel, valor, comNovo) {
  const ops = [...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map(c => h('option', { value: c.id, selected: c.id === valor }, c.nome));
  if (comNovo) ops.push(h('option', { value: '__novo__' }, '+ Cadastrar novo cliente…'));
  sel.replaceChildren(...ops);
}
const rotuloServico = s => `${s.nome} · ${s.duracao} min${s.preco ? ' · ' + brl(s.preco) : ''}`;
function opcoesServicos(selecionado) {
  $('#mServico').replaceChildren(...db.servicos.map(s => h('option', { value: s.id, selected: selecionado === s.id }, rotuloServico(s))));
}
function abrirModal({ id, data, hora }) {
  const a = id ? db.agendamentos.find(x => x.id === id) : null;
  editando = a;
  $('#mTitulo').textContent = a ? 'Editar agendamento' : 'Novo agendamento';
  opcoesClientes($('#mCliente'), a?.clienteId, true);
  opcoesServicos(a?.servicoId);
  $('#mProf').replaceChildren(...db.profissionais.map(p => h('option', { value: p.id, selected: p.id === (a?.profissionalId ?? profAtual) }, p.nome)));
  $('#mData').value = a ? a.inicio.slice(0, 10) : data;
  $('#mHora').value = a ? a.inicio.slice(11) : hora;
  $('#mObs').value = a?.obs || ''; $('#mStatus').value = a?.status || 'agendado'; $('#mMotivo').value = '';
  $('#mNome').value = ''; $('#mTel').value = ''; $('#mErro').textContent = '';
  $('#grupoNovo').hidden = $('#mCliente').value !== '__novo__';
  $('#mEdicao').hidden = !a; $('#grupoRepetir').hidden = !!a; $('#mRepetir').value = 1;
  $('#mValor').value = a ? (a.valor ?? a.preco) : ''; $('#mPago').value = a?.pago ?? '';
  $('#mForma').value = a?.forma || ''; $('#mEvol').value = a?.evolucao || '';
  alertaCliente(); opcoesPacote(a?.pacoteId);
  if (a && cli(a.clienteId)) {
    const c = cli(a.clienteId);
    $('#btnLembrete').href = wa(c.telefone, msg(db.config.msgs.lembrete, { nome: c.nome.split(' ')[0], servico: a.servico, data: brData(a.inicio), hora: a.inicio.slice(11) }));
    $('#btnLembrete').onclick = () => { db.enviados['lembrete:' + a.id] = true; salvar(); };
  }
  modal.showModal();
}
function alertaCliente() {
  const c = cli($('#mCliente').value), p = [];
  if (c?.alergias) p.push('Alergias: ' + c.alergias);
  if (c?.gestante) p.push('Gestante ou lactante');
  if (c && !c.termo) p.push('Termo de consentimento pendente');
  $('#mAlerta').textContent = '⚠ ' + p.join(' · '); $('#mAlerta').hidden = !p.length;
}
function opcoesPacote(sel) {
  const cid = $('#mCliente').value, sid = $('#mServico').value;
  const ps = db.pacotes.filter(p => p.clienteId === cid && p.servicoId === sid && (pacoteOk(p) || p.id === sel));
  $('#grupoPacote').hidden = !ps.length;
  $('#mPacote').replaceChildren(h('option', { value: '' }, 'Sem pacote'),
    ...ps.map(p => h('option', { value: p.id, selected: p.id === sel }, `${p.total - p.usadas} restante(s) até ${brData(p.validade)}`)));
}
$('#mCliente').addEventListener('change', e => { $('#grupoNovo').hidden = e.target.value !== '__novo__'; alertaCliente(); opcoesPacote(); });
$('#mServico').addEventListener('change', () => opcoesPacote());
$('#btnFechar').onclick = () => modal.close();

$('#formAg').addEventListener('submit', e => {
  e.preventDefault();
  const erro = t => ($('#mErro').textContent = t);
  const serv = db.servicos.find(s => s.id === $('#mServico').value);
  const data = $('#mData').value, hora = $('#mHora').value;
  if (!serv) return erro('Cadastre um procedimento na aba Procedimentos.');
  if (!data || !hora) return erro('Informe data e hora.');
  const ini = toMin(hora);
  if (ini < toMin(db.config.inicio) || ini + serv.duracao > toMin(db.config.fim)) return erro(`Fora do horário de atendimento (${db.config.inicio} às ${db.config.fim}).`);
  if (!editando && new Date(`${data}T${hora}`) < new Date()) return erro('Não é possível agendar no passado.');
  const prof = $('#mProf').value, cf = conflito(data, ini, serv.duracao, editando?.id, prof);
  if (cf) return erro(cf === 'bloqueio' ? 'Esse horário está bloqueado na agenda.' : 'Esse horário conflita com outro agendamento deste profissional.');
  let cid = $('#mCliente').value;
  if (cid === '__novo__') {
    const nome = $('#mNome').value.trim(), tel = $('#mTel').value;
    if (!nome || !telOk(tel)) return erro('Informe o nome e um telefone válido (com DDD).');
    const dup = db.clientes.find(c => soDig(c.telefone) === soDig(tel));
    if (dup) return erro(`Telefone já cadastrado para ${dup.nome}.`);
    cid = uid();
    db.clientes.push({ id: cid, nome, telefone: tel, email: '', nascimento: '', obs: '', consentimento: false });
  }
  const base = { clienteId: cid, servicoId: serv.id, servico: serv.nome, duracao: serv.duracao, preco: serv.preco, profissionalId: prof, pacoteId: $('#mPacote').value || null, obs: $('#mObs').value.trim() };
  if (editando) {
    const valor = $('#mValor').value, pago = $('#mPago').value;
    Object.assign(editando, base, { inicio: `${data}T${hora}`, status: $('#mStatus').value, valor: valor === '' ? (base.pacoteId ? 0 : serv.preco) : +valor, pago: pago === '' ? 0 : +pago, forma: $('#mForma').value, evolucao: $('#mEvol').value.trim() });
    sincronizarBaixas(editando);
  } else {
    const reps = Math.max(1, Math.min(52, +$('#mRepetir').value || 1)), puladas = [];
    const pk = db.pacotes.find(x => x.id === base.pacoteId);
    if (pk && reps > pk.total - pk.usadas) return erro(`O pacote só tem ${pk.total - pk.usadas} sessão(ões) restante(s).`);
    for (let w = 0; w < reps; w++) {
      const d = new Date(data + 'T00:00'); d.setDate(d.getDate() + 7 * w);
      const dt = iso(d);
      if (conflito(dt, ini, serv.duracao, null, prof)) { puladas.push(brData(dt)); continue; }
      db.agendamentos.push({ id: uid(), ...base, ...(base.pacoteId ? { valor: 0 } : {}), inicio: `${dt}T${hora}`, status: 'agendado' });
    }
    if (puladas.length) alert('Estas datas não foram marcadas por conflito ou bloqueio: ' + puladas.join(', '));
  }
  salvar(); modal.close();
  if (!$('#secaoDashboard').hidden) renderDashboard();
  else renderAgenda();
});
$('#btnCancelarAg').onclick = () => {
  if (!editando || !confirm('Cancelar este agendamento?')) return;
  editando.status = 'cancelado'; editando.motivo = $('#mMotivo').value.trim();
  sincronizarBaixas(editando);
  const fila = db.espera.filter(x => x.servicoId === editando.servicoId).map(x => cli(x.clienteId)?.nome).filter(Boolean);
  salvar(); modal.close();
  if (!$('#secaoDashboard').hidden) renderDashboard();
  else renderAgenda();
  if (fila.length) alert('Vaga liberada! Na lista de espera para este procedimento: ' + fila.join(', ') + '. Avise pela aba Sessões.');
};

// ---------- Automações (mensagens sugeridas) ----------
function tarefas() {
  const t = [], agora = new Date(), M = db.config.msgs, hoje = iso(agora);
  const add = (key, tipo, c, txt) => { if (c && !db.enviados[key]) t.push({ key, tipo, c, txt }); };
  const v = (c, a) => ({ nome: c.nome.split(' ')[0], servico: a?.servico, data: a && brData(a.inicio), hora: a?.inicio.slice(11), cuidados: db.servicos.find(s => s.id === a?.servicoId)?.cuidados || '' });
  for (const a of ativos()) {
    const c = cli(a.clienteId), horas = (new Date(a.inicio) - agora) / 36e5;
    if (!c) continue;
    if (a.status === 'agendado' && horas > 0 && horas <= 48) add('lembrete:' + a.id, 'Lembrete', c, msg(M.lembrete, v(c, a)));
    if (a.status === 'concluido' && horas > -48 && horas <= 0) add('pos:' + a.id, 'Pós-atendimento', c, msg(M.pos, v(c, a)));
  }
  for (const c of db.clientes) {
    if (!c.consentimento) continue;
    const ult = ativos().filter(a => a.clienteId === c.id && a.status === 'concluido').sort((x, y) => x.inicio.localeCompare(y.inicio)).at(-1);
    const futuro = ativos().some(a => a.clienteId === c.id && new Date(a.inicio) > agora);
    if (ult && !futuro && (agora - new Date(ult.inicio)) / 864e5 >= 30) add(`retorno:${c.id}:${ult.inicio.slice(0, 10)}`, 'Retorno', c, msg(M.retorno, v(c, ult)));
    if (c.nascimento && c.nascimento.slice(5) === hoje.slice(5)) add(`aniv:${c.id}:${hoje.slice(0, 4)}`, 'Aniversário', c, msg(M.aniv, v(c)));
  }
  for (const p of db.pacotes) {
    const c = cli(p.clienteId), rest = p.total - p.usadas, dias = (new Date(p.validade + 'T23:59') - agora) / 864e5;
    if (c && rest > 0 && dias >= 0 && (rest <= 1 || dias <= 15)) add(`pacote:${p.id}:${rest}`, 'Pacote acabando', c, msg(M.pacote, { nome: c.nome.split(' ')[0], servico: p.servico, restantes: rest, validade: brData(p.validade) }));
  }
  return t.filter(x => x.c.consentimento);
}

// ---------- Início (Painel) ----------
function renderDashboard() {
  const agora = new Date(), hoje = iso(agora), mesAtual = hoje.slice(0, 7);

  // 1. KPIs principais
  const agHoje = ativos().filter(a => a.inicio.startsWith(hoje)).length;
  const clientesAtivos = db.clientes.length;
  const procMes = ativos().filter(a => a.inicio.startsWith(mesAtual)).length;

  const mesAgs = ativos().filter(a => a.inicio.startsWith(mesAtual));
  const recAtendimentos = mesAgs.reduce((s, a) => s + (a.pago || 0), 0);
  const recPacotes = db.pacotes.filter(p => p.data.startsWith(mesAtual)).reduce((s, p) => s + (p.pago || 0), 0);
  const recManuais = db.lancamentos.filter(l => l.tipo === 'receita' && l.data.startsWith(mesAtual)).reduce((s, l) => s + (l.valor || 0), 0);
  const receitaMes = recAtendimentos + recPacotes + recManuais;

  $('#kpiAgHoje').textContent = agHoje;
  $('#kpiClientesAtivos').textContent = clientesAtivos;
  $('#kpiProcMes').textContent = procMes;
  $('#kpiReceitaMes').textContent = brl(receitaMes);

  // 2. Próximos atendimentos (hoje em diante)
  const ulProx = $('#listaProximos');
  ulProx.replaceChildren();
  const proximos = ativos()
    .filter(a => a.inicio.slice(0, 10) >= hoje && a.status !== 'concluido' && a.status !== 'faltou')
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 6);

  if (!proximos.length) {
    ulProx.append(h('li', { class: 'vazio' }, 'Nenhum atendimento próximo agendado.'));
  } else {
    for (const a of proximos) {
      const hora = a.inicio.slice(11, 16);
      const diaPrefixo = a.inicio.startsWith(hoje) ? '' : `${brData(a.inicio)} · `;
      const nomeCliente = cli(a.clienteId)?.nome ?? 'Cliente';
      const nomeServico = a.servico.replace(/^[^\p{L}\p{N}]+\s*/u, '');
      ulProx.append(h('li', {},
        h('button', { type: 'button', class: 'proximo-item', onclick: () => abrirModal({ id: a.id }) },
          h('b', {}, `${diaPrefixo}${hora}`),
          ` | ${nomeCliente} — ${nomeServico}`
        )
      ));
    }
  }

  // 3. Mensagens para enviar hoje
  const ul = $('#listaTarefas'); ul.replaceChildren();
  const ts = tarefas();
  if (!ts.length) ul.append(h('li', { class: 'vazio' }, 'Nenhuma mensagem pendente.'));
  for (const t of ts) ul.append(h('li', {}, h('span', {}, `${t.tipo}: ${t.c.nome}`),
    h('a', { class: 'btn btn-ok', href: wa(t.c.telefone, t.txt), target: '_blank', rel: 'noopener', onclick: () => { db.enviados[t.key] = true; salvar(); setTimeout(renderDashboard, 400); } }, 'Enviar no WhatsApp')));

  for (const p of db.produtos.filter(x => x.qtd <= x.minimo)) ul.append(h('li', {}, h('span', {}, `⚠ Estoque baixo: ${p.nome} (restam ${p.qtd})`)));
}

// ---------- Clientes ----------
function limparFormCliente() {
  $('#formCliente').reset(); $('#cId').value = ''; $('#cErro').textContent = '';
  $('#cTitulo').textContent = 'Novo cadastro'; $('#cCancelar').hidden = true;
}
$('#cCancelar').onclick = limparFormCliente;
$('#busca').addEventListener('input', renderClientes);

function renderClientes() {
  preencherSelects();
  const q = $('#busca').value.trim().toLowerCase(), qd = soDig(q), tb = $('#tabelaClientesBody');
  tb.replaceChildren();
  const lista = db.clientes.filter(c => !q || c.nome.toLowerCase().includes(q) || (qd && soDig(c.telefone).includes(qd)));
  if (!lista.length) tb.append(h('tr', {}, h('td', { colspan: 6, class: 'vazio' }, 'Nenhum cliente encontrado.')));
  for (const c of lista.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const hist = ativos().filter(a => a.clienteId === c.id && a.status === 'concluido').sort((x, y) => x.inicio.localeCompare(y.inicio));
    tb.append(h('tr', {},
      h('td', {}, c.nome), h('td', {}, c.telefone), h('td', {}, c.consentimento ? 'Sim' : 'Pendente'),
      h('td', {}, hist.length), h('td', {}, hist.length ? `${hist.at(-1).servico} (${brData(hist.at(-1).inicio)})` : '—'),
      h('td', {}, h('button', { type: 'button', class: 'btn btn-ok', onclick: () => abrirFicha(c) }, 'Ficha'),
        h('button', { type: 'button', class: 'btn btn-neutro', onclick: () => editarCliente(c) }, 'Editar'),
        h('button', { type: 'button', class: 'btn btn-perigo', onclick: () => excluirCliente(c) }, 'Excluir'))));
  }
}
function editarCliente(c) {
  $('#cId').value = c.id; $('#cNome').value = c.nome; $('#cTel').value = c.telefone; $('#cEmail').value = c.email;
  $('#cNasc').value = c.nascimento; $('#cObs').value = c.obs; $('#cConsent').checked = c.consentimento;
  $('#cAlergias').value = c.alergias || ''; $('#cMeds').value = c.meds || ''; $('#cHist').value = c.hist || '';
  $('#cGest').checked = !!c.gestante; $('#cTermo').checked = !!c.termo;
  $('#cInd').value = c.indicadaPor || ''; $('#cFoto').checked = !!c.foto;
  $('#cTitulo').textContent = 'Editar cliente'; $('#cCancelar').hidden = false;
  $('#cNome').focus(); scrollTo({ top: 0 });
}
function excluirCliente(c) {
  const futuros = ativos().filter(a => a.clienteId === c.id && new Date(a.inicio) > new Date());
  if (!confirm(`Excluir ${c.nome}?` + (futuros.length ? `\n${futuros.length} agendamento(s) futuro(s) serão cancelados.` : ''))) return;
  futuros.forEach(a => { a.status = 'cancelado'; a.motivo = 'Cliente excluído'; });
  db.clientes = db.clientes.filter(x => x.id !== c.id);
  db.pacotes = db.pacotes.filter(p => p.clienteId !== c.id); db.espera = db.espera.filter(x => x.clienteId !== c.id);
  dbFoto('readonly', s => s.getAll()).then(fs => (fs || []).filter(x => x.clienteId === c.id).forEach(x => dbFoto('readwrite', s => s.delete(x.id)))).catch(() => {});
  salvar(); renderClientes();
}
$('#formCliente').addEventListener('submit', e => {
  e.preventDefault();
  const id = $('#cId').value, tel = $('#cTel').value, erro = t => ($('#cErro').textContent = t);
  if (!telOk(tel)) return erro('Telefone inválido. Use DDD + número.');
  const dup = db.clientes.find(c => c.id !== id && soDig(c.telefone) === soDig(tel));
  if (dup) return erro(`Esse telefone já está cadastrado para ${dup.nome}.`);
  const dados = { nome: $('#cNome').value.trim(), telefone: tel, email: $('#cEmail').value.trim(), nascimento: $('#cNasc').value, obs: $('#cObs').value.trim(), consentimento: $('#cConsent').checked,
    alergias: $('#cAlergias').value.trim(), meds: $('#cMeds').value.trim(), hist: $('#cHist').value.trim(), gestante: $('#cGest').checked, termo: $('#cTermo').checked, indicadaPor: $('#cInd').value, foto: $('#cFoto').checked };
  if (id) Object.assign(cli(id), dados); else db.clientes.push({ id: uid(), ...dados });
  salvar(); limparFormCliente(); renderClientes();
});

const fill = (sel, ops) => { if (!sel) return; const v = sel.value; sel.replaceChildren(...ops); if ([...sel.options].some(o => o.value === v)) sel.value = v; };
const optsC = () => [...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map(c => h('option', { value: c.id }, c.nome));
const optsS = () => db.servicos.map(s => h('option', { value: s.id }, s.nome));
function preencherSelects() {
  fill($('#cInd'), [h('option', { value: '' }, '—'), ...optsC()]);
  fill($('#pkCliente'), optsC()); fill($('#esCliente'), optsC());
  fill($('#pkServico'), optsS()); fill($('#esServico'), optsS());
  fill($('#cpServico'), [h('option', { value: '' }, 'Qualquer'), ...optsS()]);
}

// Campanha segmentada
$('#formCampanha').addEventListener('submit', e => {
  e.preventDefault();
  const sid = $('#cpServico').value, dias = +$('#cpDias').value || 0, agora = new Date();
  const alvo = db.clientes.filter(c => {
    if (!c.consentimento) return false;
    if (sid && !ativos().some(a => a.clienteId === c.id && a.servicoId === sid && a.status === 'concluido')) return false;
    if (dias) { const u = ultimo(c.id); if (!u || (agora - new Date(u.inicio)) / 864e5 < dias) return false; }
    return true;
  });
  $('#listaCampanha').replaceChildren(...(alvo.length ? alvo.map(c => h('li', {}, h('span', {}, c.nome),
    h('a', { class: 'btn btn-ok', href: wa(c.telefone, msg($('#cpMsg').value, { nome: c.nome.split(' ')[0] })), target: '_blank', rel: 'noopener' }, 'Enviar no WhatsApp')))
    : [h('li', { class: 'vazio' }, 'Ninguém corresponde a esse filtro.')]));
});

// ---------- Procedimentos e Estoque ----------
function renderProcedimentos() {
  const ul = $('#listaServicos');
  ul.replaceChildren();
  if (!db.servicos.length) {
    ul.append(h('li', { class: 'vazio' }, 'Nenhum procedimento cadastrado.'));
  } else {
    for (const s of db.servicos) {
      ul.append(h('li', {},
        h('span', {}, `${s.nome} · ${s.duracao} min · ${brl(s.preco)}${s.cuidados ? ' · ' + s.cuidados : ''}`),
        h('span', {},
          h('button', { type: 'button', class: 'btn btn-neutro', onclick: () => editarServico(s) }, 'Editar'),
          h('button', { type: 'button', class: 'btn btn-perigo', onclick: () => removerServico(s) }, 'Excluir')
        )
      ));
    }
  }
  renderProdutos();
  fill($('#sProduto'), [h('option', { value: '' }, 'Nenhum'), ...db.produtos.map(p => h('option', { value: p.id }, p.nome))]);
}

$('#formServico').addEventListener('submit', e => {
  e.preventDefault();
  db.servicos.push({
    id: uid(),
    nome: $('#sNome').value.trim(),
    duracao: +$('#sDur').value,
    preco: +$('#sPreco').value,
    cuidados: $('#sCuidados').value.trim(),
    produtoId: $('#sProduto').value,
    consumo: +$('#sConsumo').value || 0,
  });
  e.target.reset(); $('#sDur').value = 60; $('#sPreco').value = 0;
  salvar(); renderProcedimentos();
});

function editarServico(s) {
  const nome = prompt('Nome do procedimento:', s.nome);
  if (nome === null) return;
  const dur = parseInt(prompt('Duração (minutos):', s.duracao), 10);
  if (!(dur >= 5)) return alert('Duração inválida.');
  const preco = parseFloat(String(prompt('Preço (R$):', s.preco)).replace(',', '.'));
  if (!(preco >= 0)) return alert('Preço inválido.');
  s.nome = nome.trim() || s.nome; s.duracao = dur; s.preco = preco;
  salvar(); renderProcedimentos();
}

function removerServico(s) {
  if (ativos().some(a => a.servicoId === s.id && new Date(a.inicio) > new Date())) {
    return ($('#sErro').textContent = 'Há agendamentos futuros com este procedimento. Cancele-os antes de excluir.');
  }
  if (!confirm(`Excluir "${s.nome}"? O histórico continua guardado.`)) return;
  db.servicos = db.servicos.filter(x => x.id !== s.id);
  $('#sErro').textContent = ''; salvar(); renderProcedimentos();
}

function renderProdutos() {
  const ul = $('#listaProdutos');
  ul.replaceChildren(...(db.produtos.length ? db.produtos.map(p => h('li', {},
    h('span', {}, `${p.nome} · ${p.qtd} em estoque (alerta em ${p.minimo})${p.qtd <= p.minimo ? ' ⚠' : ''}`),
    h('span', {},
      h('button', { type: 'button', class: 'btn btn-neutro', onclick: () => { const q = parseFloat(prompt('Quantidade que entrou no estoque:', '1')); if (q > 0) { p.qtd = +(p.qtd + q).toFixed(2); salvar(); renderProcedimentos(); } } }, '+ Entrada'),
      h('button', { type: 'button', class: 'btn btn-perigo', onclick: () => { if (confirm(`Excluir ${p.nome}?`)) { db.produtos = db.produtos.filter(x => x.id !== p.id); db.servicos.forEach(s => { if (s.produtoId === p.id) s.produtoId = ''; }); salvar(); renderProcedimentos(); } } }, 'Excluir'))))
    : [h('li', { class: 'vazio' }, 'Nenhum produto cadastrado.')]));
}

$('#formProduto').addEventListener('submit', e => {
  e.preventDefault();
  db.produtos.push({ id: uid(), nome: $('#prNome').value.trim(), qtd: +$('#prQtd').value, minimo: +$('#prMin').value });
  e.target.reset(); salvar(); renderProcedimentos();
});

// ---------- Sessões (Pacotes, Histórico e Lista de Espera) ----------
function renderSessoes() {
  preencherSelects();
  renderPacotes();
  renderEspera();

  const concluidas = ativos()
    .filter(a => a.status === 'concluido')
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
    .slice(0, 15);

  $('#listaSessoesRecentes').replaceChildren(...(concluidas.length
    ? concluidas.map(a => h('li', {},
        h('span', {}, `${brData(a.inicio)} às ${a.inicio.slice(11)} · ${cli(a.clienteId)?.nome ?? '—'} · ${a.servico}`),
        h('button', { type: 'button', class: 'btn btn-neutro btn-mini', onclick: () => abrirModal({ id: a.id }) }, 'Detalhes')
      ))
    : [h('li', { class: 'vazio' }, 'Nenhuma sessão concluída registrada.')]));
}

function renderPacotes() {
  $('#listaPacotes').replaceChildren(...(db.pacotes.length ? [...db.pacotes].reverse().map(p => h('li', {},
    h('span', {}, `${cli(p.clienteId)?.nome ?? '—'} · ${p.servico} · ${p.total - p.usadas}/${p.total} restantes · até ${brData(p.validade)} · pago ${brl(p.pago)} de ${brl(p.valor)}`),
    h('span', {},
      p.usadas < p.total ? h('button', {
        type: 'button', class: 'btn btn-ok btn-mini',
        onclick: () => { p.usadas++; salvar(); renderPacotes(); }
      }, '+1 Feita') : null,
      h('button', {
        type: 'button', class: 'btn btn-perigo btn-mini',
        onclick: () => { if (confirm('Excluir este pacote?')) { db.pacotes = db.pacotes.filter(x => x.id !== p.id); salvar(); renderPacotes(); } }
      }, 'Excluir')
    )))
    : [h('li', { class: 'vazio' }, 'Nenhum pacote vendido.')]));
}

$('#formPacote').addEventListener('submit', e => {
  e.preventDefault();
  const s = db.servicos.find(x => x.id === $('#pkServico').value), validade = $('#pkValidade').value, cid = $('#pkCliente').value;
  if (!s || !cid) return ($('#pkErro').textContent = 'Escolha cliente e procedimento.');
  if (validade < iso(new Date())) return ($('#pkErro').textContent = 'A validade não pode ser no passado.');
  db.pacotes.push({ id: uid(), clienteId: cid, servicoId: s.id, servico: s.nome, total: +$('#pkTotal').value, usadas: 0, validade, valor: +$('#pkValor').value, pago: +$('#pkPago').value, data: iso(new Date()) });
  $('#pkErro').textContent = ''; salvar(); renderPacotes();
});

function renderEspera() {
  const itens = db.espera.map(x => {
    const c = cli(x.clienteId), s = db.servicos.find(v => v.id === x.servicoId);
    if (!c) return null;
    return h('li', {}, h('span', {}, `${c.nome} · ${s?.nome ?? '—'}${x.obs ? ' · ' + x.obs : ''}`),
      h('span', {}, c.consentimento ? h('a', { class: 'btn btn-ok btn-mini', href: wa(c.telefone, msg(db.config.msgs.vaga, { nome: c.nome.split(' ')[0], servico: s?.nome })), target: '_blank', rel: 'noopener' }, 'Avisar vaga') : null,
        h('button', { type: 'button', class: 'btn btn-neutro btn-mini', onclick: () => { db.espera = db.espera.filter(v => v.id !== x.id); salvar(); renderEspera(); } }, 'Remover')));
  }).filter(Boolean);
  $('#listaEspera').replaceChildren(...(itens.length ? itens : [h('li', { class: 'vazio' }, 'Ninguém na lista de espera.')]));
}

$('#formEspera').addEventListener('submit', e => {
  e.preventDefault();
  db.espera.push({ id: uid(), clienteId: $('#esCliente').value, servicoId: $('#esServico').value, obs: $('#esObs').value.trim() });
  $('#esObs').value = ''; salvar(); renderEspera();
});

// ---------- Financeiro ----------
function renderFinanceiro() {
  const hoje = iso(new Date()), mesAtual = hoje.slice(0, 7);
  if (!$('#finData').value) $('#finData').value = hoje;

  const val = a => a.valor ?? a.preco;
  const mesAgs = ativos().filter(a => a.inicio.startsWith(mesAtual));
  const recAtendimentos = mesAgs.reduce((s, a) => s + (a.pago || 0), 0);
  const recPacotes = db.pacotes.filter(p => p.data.startsWith(mesAtual)).reduce((s, p) => s + (p.pago || 0), 0);
  const recManuais = db.lancamentos.filter(l => l.tipo === 'receita' && l.data.startsWith(mesAtual)).reduce((s, l) => s + (l.valor || 0), 0);
  const despesasMes = db.lancamentos.filter(l => l.tipo === 'despesa' && l.data.startsWith(mesAtual)).reduce((s, l) => s + (l.valor || 0), 0);

  const receitaTotal = recAtendimentos + recPacotes + recManuais;
  const saldoMes = receitaTotal - despesasMes;

  const pendentesAg = ativos().filter(a => a.status === 'concluido' && (val(a) - (a.pago || 0)) > 0.009);
  const pendentesPk = db.pacotes.filter(p => (p.valor - (p.pago || 0)) > 0.009);
  const aReceber = pendentesAg.reduce((s, a) => s + (val(a) - (a.pago || 0)), 0) + pendentesPk.reduce((s, p) => s + (p.valor - (p.pago || 0)), 0);

  const card = (r, v) => h('div', { class: 'card' }, h('strong', {}, v), r);
  $('#finCards').replaceChildren(
    card('Receita no mês', brl(receitaTotal)),
    card('Despesas no mês', brl(despesasMes)),
    card('Saldo líquido no mês', brl(saldoMes)),
    card('A receber de clientes', brl(aReceber))
  );

  // Valores a receber
  const ulRec = $('#listaReceber');
  ulRec.replaceChildren();
  const pendencias = [
    ...pendentesAg.map(a => ({
      texto: `${brData(a.inicio)} · ${cli(a.clienteId)?.nome ?? '—'} · ${a.servico} (falta ${brl(val(a) - (a.pago || 0))})`,
      quitar: () => { a.pago = val(a); salvar(); renderFinanceiro(); }
    })),
    ...pendentesPk.map(p => ({
      texto: `Pacote · ${cli(p.clienteId)?.nome ?? '—'} · ${p.servico} (falta ${brl(p.valor - (p.pago || 0))})`,
      quitar: () => { p.pago = p.valor; salvar(); renderFinanceiro(); }
    }))
  ];

  if (!pendencias.length) {
    ulRec.append(h('li', { class: 'vazio' }, 'Nenhum valor pendente a receber.'));
  } else {
    for (const item of pendencias) {
      ulRec.append(h('li', {},
        h('span', {}, item.texto),
        h('button', { type: 'button', class: 'btn btn-ok btn-mini', onclick: item.quitar }, 'Quitar')
      ));
    }
  }

  // Lançamentos manuais
  const ulLanc = $('#listaLancamentos');
  ulLanc.replaceChildren();
  if (!db.lancamentos.length) {
    ulLanc.append(h('li', { class: 'vazio' }, 'Nenhum lançamento manual registrado.'));
  } else {
    for (const l of [...db.lancamentos].sort((a, b) => b.data.localeCompare(a.data))) {
      const ehRec = l.tipo === 'receita';
      ulLanc.append(h('li', {},
        h('span', {},
          h('span', { class: ehRec ? 'tag-receita' : 'tag-despesa' }, ehRec ? '+ Receita' : '− Despesa'),
          ` · ${brData(l.data)} · ${l.descricao} (${l.forma}) · `,
          h('b', {}, brl(l.valor))
        ),
        h('button', {
          type: 'button', class: 'btn btn-perigo btn-mini',
          onclick: () => { if (confirm('Excluir este lançamento?')) { db.lancamentos = db.lancamentos.filter(x => x.id !== l.id); salvar(); renderFinanceiro(); } }
        }, 'Excluir')
      ));
    }
  }
}

$('#formLancamento').addEventListener('submit', e => {
  e.preventDefault();
  const valor = +$('#finValor').value;
  if (!(valor > 0)) return ($('#finErro').textContent = 'Informe um valor maior que zero.');
  db.lancamentos.push({
    id: uid(),
    tipo: $('#finTipo').value,
    descricao: $('#finDesc').value.trim(),
    valor,
    data: $('#finData').value || iso(new Date()),
    forma: $('#finForma').value,
  });
  $('#finErro').textContent = '';
  $('#finDesc').value = '';
  $('#finValor').value = '';
  salvar();
  renderFinanceiro();
});

// ---------- Relatórios ----------
function renderRelatorios() {
  const agora = new Date(), hoje = iso(agora), s0 = segunda(agora), s1 = new Date(s0); s1.setDate(s1.getDate() + 7);
  const ult30 = ativos().filter(a => { const d = new Date(a.inicio); return d <= agora && agora - d <= 30 * 864e5; });
  const faltas = ult30.filter(a => a.status === 'faltou').length;
  const base = ult30.filter(a => ['faltou', 'concluido'].includes(a.status)).length;
  const mes = ativos().filter(a => a.inicio.slice(0, 7) === hoje.slice(0, 7));
  const conc = mes.filter(a => a.status === 'concluido');
  const val = a => a.valor ?? a.preco;
  const ticket = conc.length ? conc.reduce((s, a) => s + val(a), 0) / conc.length : 0;

  const { inicio, fim, dias } = db.config;
  const cap = dias.length * (toMin(fim) - toMin(inicio)) * db.profissionais.length;
  const ocup = cap ? Math.round(ativos().filter(a => { const d = new Date(a.inicio); return d >= s0 && d < s1; }).reduce((s, a) => s + a.duracao, 0) / cap * 100) : 0;
  const semRetorno = db.clientes.filter(c => { const u = ultimo(c.id); return u && (agora - new Date(u.inicio)) / 864e5 >= 30 && !ativos().some(a => a.clienteId === c.id && new Date(a.inicio) > agora); }).length;

  const card = (r, v) => h('div', { class: 'card' }, h('strong', {}, v), r);
  $('#relCards').replaceChildren(
    card('Ocupação da semana', ocup + '%'),
    card('Faltas (30 dias)', base ? Math.round(faltas / base * 100) + '%' : '—'),
    card('Ticket médio (mês)', brl(ticket)),
    card('Sem retorno há 30+ dias', semRetorno)
  );

  const cont = {};
  ativos().forEach(a => (cont[a.servico] = (cont[a.servico] || 0) + 1));
  const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const fprc = {};
  conc.forEach(a => (fprc[a.servico] = (fprc[a.servico] || 0) + val(a)));
  const fl = Object.entries(fprc).sort((a, b) => b[1] - a[1]);

  $('#topProc').replaceChildren(...(top.length ? top.map(([n, q]) => h('li', {}, h('span', {}, n), h('b', {}, `${q}x`))) : [h('li', { class: 'vazio' }, 'Sem agendamentos ainda.')]));
  $('#fatProc').replaceChildren(...(fl.length ? fl.map(([n, v]) => h('li', {}, h('span', {}, n), h('b', {}, brl(v)))) : [h('li', { class: 'vazio' }, 'Sem atendimentos concluídos neste mês.')]));
}

// ---------- Fotos de clientes ----------
const idb = new Promise((ok, no) => { const r = indexedDB.open('lumiglow-fotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('fotos', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const dbFoto = async (modo, fn) => { const d = await idb; return new Promise((ok, no) => { const t = d.transaction('fotos', modo), r = fn(t.objectStore('fotos')); t.oncomplete = () => ok(r?.result); t.onerror = () => no(t.error); }); };
const reduzir = async f => {
  const bmp = await createImageBitmap(f), k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.75));
};
async function montarFotos(c) {
  const box = $('#fFotos'); box.replaceChildren();
  if (!c.foto) return box.append(h('p', { class: 'vazio' }, 'Marque "Autoriza o registro de fotos" na edição do cliente para guardar fotos.'));
  const tipo = h('select', { 'aria-label': 'Tipo da foto' }, h('option', {}, 'Antes'), h('option', {}, 'Depois'));
  const arq = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Escolher foto' });
  arq.addEventListener('change', async () => {
    const f = arq.files[0]; if (!f) return;
    try { const blob = await reduzir(f); await dbFoto('readwrite', s => s.put({ id: uid(), clienteId: c.id, tipo: tipo.value, data: iso(new Date()), blob })); }
    catch { alert('Não foi possível salvar a foto neste navegador.'); }
    montarFotos(c);
  });
  box.append(h('div', { class: 'envio' }, tipo, arq));
  try {
    const fotos = ((await dbFoto('readonly', s => s.getAll())) || []).filter(x => x.clienteId === c.id).sort((a, b) => a.data.localeCompare(b.data));
    const col = t => h('div', {}, h('b', {}, t), ...fotos.filter(x => x.tipo === t).map(x => h('figure', { class: 'foto' },
      h('img', { src: URL.createObjectURL(x.blob), alt: `${t} ${brData(x.data)}` }),
      h('figcaption', {}, brData(x.data), ' ', h('button', { type: 'button', class: 'btn btn-perigo', onclick: async () => { await dbFoto('readwrite', s => s.delete(x.id)); montarFotos(c); } }, 'Excluir')))));
    box.append(h('div', { class: 'duas-col' }, col('Antes'), col('Depois')));
  } catch { box.append(h('p', { class: 'erro' }, 'Não foi possível abrir as fotos neste navegador.')); }
}

function abrirFicha(c) {
  $('#fTitulo').textContent = 'Ficha · ' + c.nome;
  const sessoes = ativos().filter(a => a.clienteId === c.id).sort((x, y) => y.inicio.localeCompare(x.inicio));
  const linha = (r, v) => h('p', {}, h('b', {}, r + ': '), v || '—');
  $('#fCorpo').replaceChildren(
    linha('Alergias', c.alergias), linha('Medicamentos', c.meds), linha('Histórico de saúde', c.hist),
    linha('Gestante ou lactante', c.gestante ? 'Sim' : 'Não'), linha('Termo assinado', c.termo ? 'Sim' : 'Pendente'), linha('Observações', c.obs),
    linha('Indicada por', cli(c.indicadaPor)?.nome), linha('Indicou', db.clientes.filter(x => x.indicadaPor === c.id).map(x => x.nome).join(', ')),
    h('h4', {}, 'Atendimentos'),
    ...(sessoes.length ? sessoes.map(a => h('div', { class: 'ficha-item' },
      h('b', {}, `${brData(a.inicio)} · ${a.servico} · ${ROT[a.status]}`),
      h('div', {}, `${db.profissionais.find(p => p.id === a.profissionalId)?.nome ?? '—'} · Valor ${brl(a.valor ?? a.preco)} · Pago ${brl(a.pago || 0)}${a.forma ? ' (' + a.forma + ')' : ''}`),
      a.evolucao ? h('div', {}, a.evolucao) : null)) : [h('p', { class: 'vazio' }, 'Nenhum atendimento registrado.')]));
  $('#fCorpo').append(h('h4', {}, 'Fotos de antes e depois'), h('div', { id: 'fFotos' }));
  montarFotos(c);
  $('#modalFicha').showModal();
}
$('#btnFecharFicha').onclick = () => $('#modalFicha').close();

// ---------- Configurações ----------
function renderConfig() {
  const c = db.config;
  $('#cfgInicio').value = c.inicio; $('#cfgFim').value = c.fim; $('#cfgInter').value = c.intervalo;
  $('#cfgDias').replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map(d => h('label', {}, h('input', { type: 'checkbox', value: d, checked: c.dias.includes(d) }), NOMES[d])));
  $('#cfgMsgs').replaceChildren(...Object.entries({ lembrete: 'Lembrete (até 48h antes)', pos: 'Pós-atendimento', retorno: 'Retorno (30 dias sem atendimento)', aniv: 'Aniversário', pacote: 'Pacote acabando', vaga: 'Vaga liberada (lista de espera)' })
    .map(([k, t]) => h('div', { class: 'campo' }, h('label', { for: 'msg-' + k }, t), h('textarea', { id: 'msg-' + k, rows: 2 }, c.msgs[k]))));
  $('#listaProf').replaceChildren(...db.profissionais.map(p => h('li', {}, h('span', {}, p.nome),
    h('button', { type: 'button', class: 'btn btn-perigo', onclick: () => removerProf(p) }, 'Excluir'))));
  const hojeIso = iso(new Date());
  $('#listaBloqueios').replaceChildren(...db.bloqueios.filter(b => b.data >= hojeIso).sort((a, b) => a.data.localeCompare(b.data)).map(b =>
    h('li', {}, h('span', {}, `${brData(b.data)} · ${b.ini}–${b.fim}${b.motivo ? ' · ' + b.motivo : ''}`),
      h('button', { type: 'button', class: 'btn btn-perigo', onclick: () => { db.bloqueios = db.bloqueios.filter(x => x.id !== b.id); salvar(); renderConfig(); } }, 'Remover'))));
}
$('#formHorarios').addEventListener('submit', e => {
  e.preventDefault();
  const ini = $('#cfgInicio').value, fim = $('#cfgFim').value, dias = $$('#cfgDias input:checked').map(i => +i.value);
  if (toMin(fim) <= toMin(ini)) return ($('#hErro').textContent = 'O horário de fechamento deve ser depois do de abertura.');
  if (!dias.length) return ($('#hErro').textContent = 'Escolha ao menos um dia de atendimento.');
  Object.assign(db.config, { inicio: ini, fim, intervalo: +$('#cfgInter').value, dias });
  $('#hErro').textContent = ''; salvar(); alert('Horários salvos.');
});
$('#formMsgs').addEventListener('submit', e => {
  e.preventDefault();
  for (const k of Object.keys(db.config.msgs)) db.config.msgs[k] = $('#msg-' + k).value.trim() || db.config.msgs[k];
  salvar(); alert('Mensagens salvas.');
});
$('#formProf').addEventListener('submit', e => {
  e.preventDefault();
  db.profissionais.push({ id: uid(), nome: $('#pNome').value.trim() });
  e.target.reset(); salvar(); renderConfig();
});
function removerProf(p) {
  if (db.profissionais.length < 2) return ($('#pErro').textContent = 'É preciso manter ao menos um profissional.');
  if (ativos().some(a => a.profissionalId === p.id && new Date(a.inicio) > new Date())) return ($('#pErro').textContent = 'Há agendamentos futuros com este profissional. Remarque ou cancele antes.');
  if (!confirm(`Excluir ${p.nome}?`)) return;
  db.profissionais = db.profissionais.filter(x => x.id !== p.id); $('#pErro').textContent = ''; salvar(); renderConfig();
}
$('#bDia').addEventListener('change', e => { $('#bIni').disabled = $('#bFim').disabled = e.target.checked; });
$('#formBloqueio').addEventListener('submit', e => {
  e.preventDefault();
  const dia = $('#bDia').checked, data = $('#bData').value, ini = dia ? '00:00' : $('#bIni').value, fim = dia ? '23:59' : $('#bFim').value;
  if (toMin(fim) <= toMin(ini)) return ($('#bErro').textContent = 'O fim deve ser depois do início.');
  const n = ativos().filter(a => a.inicio.slice(0, 10) === data && iniMin(a) < toMin(fim) && toMin(ini) < fimMin(a)).length;
  if (n && !confirm(`${n} agendamento(s) já existem nesse período e não serão cancelados. Continuar?`)) return;
  db.bloqueios.push({ id: uid(), data, ini, fim, motivo: $('#bMotivo').value.trim() });
  $('#bErro').textContent = ''; e.target.reset(); $('#bIni').disabled = $('#bFim').disabled = false;
  salvar(); renderConfig();
});
$('#btnExportar').onclick = () => {
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })), download: `lumi-glow-backup-${iso(new Date())}.json` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#inputImportar').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!['clientes', 'servicos', 'agendamentos'].every(k => Array.isArray(d[k])) || !d.config) throw 0;
    if (!confirm('Substituir todos os dados atuais pelo backup?')) return;
    db = { ...padrao(), ...d }; migrar(); salvar(); renderConfig();
  } catch { alert('Arquivo de backup inválido.'); }
});

// ---------- Início ----------
if (sessionStorage.getItem('lumiglow:sessao')) {
  abrir();
} else {
  window.location.href = '../login.html';
}