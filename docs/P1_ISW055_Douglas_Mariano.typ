// ============================================================
//  P1 — Relatório bimestral de atividades (entrega INDIVIDUAL)
//  ISW055 · Introdução à Computação em Nuvem · Fatec Pompeia · 2026.2
// ============================================================

// ---------- DADOS DO ALUNO (edite aqui) ----------
#let aluno = "Douglas Felipe Mariano"
#let turma = "Computação em Nuvem"
#let data-relatorio = "06/10/2026"

// ---------- daqui pra baixo, só mexa nas fichas de atividade ----------
#let disciplina = "Introdução à Computação em Nuvem"
#let codigo = "ISW055"
#let professor = "Prof. Allan Lincoln Rodrigues Siriani"
#let accent = rgb("#b96f1f")

#set document(title: "P1 — " + codigo + " — " + aluno, author: aluno)
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2cm))
#set text(size: 11pt, lang: "pt", region: "BR")
#set par(justify: true, leading: 0.7em)
#set heading(numbering: "1.1")
#show heading.where(level: 1): it => { v(0.6em); text(size: 16pt, it); v(0.2em) }
#show heading.where(level: 2): it => { v(0.5em); text(size: 13pt, it); v(0.1em) }
#show link: set text(fill: accent)
#show figure.caption: set text(size: 9pt, fill: luma(90))
#set table(stroke: 0.5pt + luma(200), inset: 6pt)
#show table: set text(hyphenate: false)
#show table: set par(justify: false)

// ---------- ajudantes ----------
#let evidencia(legenda, arquivo: none) = figure(
  if arquivo == none {
    rect(width: 100%, height: 5.5cm, radius: 4pt, stroke: (paint: luma(170), dash: "dashed"))[
      #align(center + horizon)[
        #text(fill: luma(130), size: 9.5pt)[
          cole o print aqui \
          troque `arquivo: none` por `arquivo: "prints/nome.png"`
        ]
      ]
    ]
  } else {
    image(arquivo, width: 100%)
  },
  kind: image,
  supplement: [Figura],
  caption: legenda,
)

#let registro = state("registro", ())

#let atividade(
  numero, titulo,
  descricao: "",
  planejada: "",
  realizada: "—",
  situacao: "entregue",
  evidencia: "",
  url: "",
  corpo,
) = {
  registro.update(l => l + ((
    numero: numero, titulo: titulo, descricao: descricao,
    planejada: planejada, realizada: realizada, situacao: situacao,
  ),))
  heading(level: 2, [Atividade #numero — #titulo])
  table(
    columns: (3.4cm, 1fr),
    fill: (x, y) => if x == 0 { luma(245) } else { none },
    [*Descrição*], [#descricao],
    [*Data planejada*], [#planejada],
    [*Data realizada*], [#realizada],
    [*Situação*], [#situacao],
    [*Evidência*], [#evidencia],
    [*Link*], [#if url == "" [—] else [#link(url)]],
  )
  corpo
}

// ============================================================
//  CAPA
// ============================================================
#align(center)[
  #v(2.5cm)
  #text(size: 12pt, tracking: 0.12em)[FATEC POMPEIA]
  #v(0.4em)
  #text(size: 10.5pt, fill: luma(110))[#disciplina · #codigo · #turma]
  #v(4.5cm)
  #text(size: 26pt, weight: "bold")[P1]
  #v(0.3em)
  #text(size: 18pt, weight: "bold")[Relatório bimestral de atividades]
  #v(0.8em)
  #text(size: 11pt, fill: luma(110))[Avaliação individual · 2026.2]
  #v(5cm)
  #text(size: 14pt)[#aluno]
  #v(1fr)
  #text(size: 10.5pt)[#professor \ Pompeia, #data-relatorio]
]

#set page(
  numbering: "1",
  number-align: right,
  header: context {
    set text(size: 8pt, fill: luma(120))
    [#codigo · P1 — Relatório bimestral #h(1fr) #aluno]
    line(length: 100%, stroke: 0.4pt + luma(200))
  },
)
#counter(page).update(1)

#outline(title: "Sumário", indent: 1.2em, depth: 2)
#pagebreak()

// ============================================================
= Introdução
// ============================================================
A disciplina de Introdução à Computação em Nuvem nos proporciona a base técnica sobre como projetar, construir e orquestrar aplicações modernas para rodarem em ambientes distribuídos e containerizados, saindo do modelo tradicional e monolítico.

Ao longo do bimestre, evoluímos um projeto base: um catálogo de filmes do ator Tom Hanks. O que começou como uma simples integração com a API do TMDB logo escalou para um sistema complexo dividido em microsserviços. Neste relatório, documento o passo a passo dessa evolução, passando pela configuração do Docker, criação do microsserviço de autenticação, implementação de RBAC, sistema de logs com Redis e armazenamento de arquivos estáticos no MinIO, compondo a nota da P1.

// ============================================================
= Metodologia
// ============================================================
Todas as atividades foram desenvolvidas e centralizadas em um único repositório no GitHub, tratando-se de iterações em cima do mesmo projeto do Catálogo. A arquitetura foi desenvolvida utilizando Node.js e React (Vite), com MariaDB, Redis e MinIO como ferramentas de persistência e orquestradas pelo Docker Compose.

As datas e horas de realização foram conferidas nas páginas dos commits do GitHub, usando o horário de commit registrado pelo repositório. Quando a data de autoria do Git difere da data de commit, adotei a data de commit exibida pelo GitHub para manter consistência com a evidência clicável.

As capturas da aplicação foram feitas no deploy público em 06/10/2026 e demonstram o estado funcional observado nessa data; elas não substituem as evidências históricas dos commits. Os testes de catálogo, favoritos, comentários, perfil e sessão foram feitos com uma conta comum de teste. A consulta administrativa de logs retornou 403 para essa conta, como esperado; não foi possível validar a visualização privilegiada sem uma conta admin.

// ============================================================
= Quadro de entregas
// ============================================================
#context {
  let l = registro.final()
  table(
    columns: (auto, 1.4fr, 2fr, 2.6cm, 2.9cm, 2.3cm),
    align: (center, left, left, center, center, center),
    fill: (x, y) => if y == 0 { luma(235) } else { none },
    table.header([*Nº*], [*Atividade*], [*Descrição*], [*Data \ planejada*], [*Data \ realizada*], [*Situação*]),
    ..l.map(a => (
      [#a.numero], [#a.titulo], [#text(size: 9pt)[#a.descricao]],
      [#a.planejada], [#a.realizada], [#a.situacao],
    )).flatten()
  )
}

// ============================================================
= Atividades realizadas
// ============================================================

#atividade(
  "1", "Agenda telefônica em Flask",
  descricao: "Nivelamento em sala: sistema monolítico Flask + Jinja com persistência em JSON.",
  planejada: "07/08/2026",
  realizada: "—",
  situacao: "não entregue",
  evidencia: "—",
  url: "",
)[
  Esta atividade de nivelamento inicial não foi versionada no repositório final do projeto. Sendo assim, declaro-a como não entregue.
]

#atividade(
  "2", "Catálogo de filmes — Tom Hanks",
  descricao: "Consumo da API TMDB, persistência em MariaDB e segregação por usuário.",
  planejada: "20/08/2026",
  realizada: "20/08/2026 13:14",
  situacao: "entregue",
  evidencia: "Commit b9d5fef + catálogo, favoritos e comentários no deploy",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/b9d5fef",
)[
  Nesta fase, foi construída a fundação em React e o backend Node.js. O banco de dados MariaDB foi introduzido para armazenar os comentários e favoritos dos usuários. Todo o ambiente foi configurado para subir no Docker Compose.

  #evidencia([Atividade 2 — Commit b9d5fef no GitHub · 20/08/2026 13:14], arquivo: "prints/atividade-2-commit.png")
  #evidencia([Atividade 2 — Catálogo carregado no deploy], arquivo: "prints/atividade-2-catalogo.png")
  #evidencia([Atividade 2 — Filme favoritado; registro de teste removido após a captura], arquivo: "prints/atividade-2-favoritos.png")
  #evidencia([Atividade 2 — Comentário criado; registro de teste removido após a captura], arquivo: "prints/atividade-2-comentario.png")

  A maior dificuldade foi entender a melhor abordagem para juntar o build do frontend e do backend numa mesma imagem Docker para facilitar o roteamento.
]

#atividade(
  "3", "Desacoplando o login — microsserviço de autenticação",
  descricao: "Login, cadastro e esqueci-minha-senha num serviço à parte na rede interna do Docker.",
  planejada: "28/08/2026",
  realizada: "08/09/2026 20:36",
  situacao: "com atraso",
  evidencia: "Commit 69eb135 + sessão autenticada no deploy",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/69eb135",
)[
  O catálogo foi refatorado. Extraímos toda a lógica de segurança, JWT, verificação de rotas e redefinição de senha com tokens por email (Mailtrap) para um container dedicado chamado `auth-service`, que só se comunica pela rede interna.

  #evidencia([Atividade 3 — Commit 69eb135 no GitHub · 08/09/2026 20:36], arquivo: "prints/atividade-3-4-commit.png")
  #evidencia([Atividade 3 — Sessão autenticada no catálogo], arquivo: "prints/atividade-3-sessao-autenticada.png")

  Gerenciar a comunicação de microsserviços via proxy na API principal exigiu cuidado na passagem e repasse do header Authorization.
]

#atividade(
  "4", "Controle de acesso por papel — RBAC",
  descricao: "O campo role passa a decidir permissões reais no backend (403 para usuário comum).",
  planejada: "04/09/2026",
  realizada: "08/09/2026 20:36",
  situacao: "com atraso",
  evidencia: "Commit 69eb135 + teste de autorização (403 para usuário comum)",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/69eb135",
)[
  Adicionamos a coluna `role` ao MariaDB (admin/usuário) e adotamos o Padrão A de autorização: as checagens ocorrem centralizadas comunicando-se sempre com o `auth-service`. No teste do deploy, a conta comum recebeu HTTP 403 ao consultar a rota administrativa de logs, confirmando a restrição para esse papel. A moderação com uma conta admin não foi repetida nesta validação porque não foi fornecida uma credencial administrativa.

  #evidencia([Atividade 4 — Commit 69eb135 com implementação RBAC · 08/09/2026 20:36], arquivo: "prints/atividade-3-4-commit.png")
  #evidencia([Atividade 4 — Sessão identificada como usuário comum], arquivo: "prints/atividade-3-sessao-autenticada.png")

  A dificuldade foi garantir a alteração do banco em uma tabela que já existia no projeto.
]

#atividade(
  "5", "Logs e auditoria",
  descricao: "Novo log-service com Redis registrando login, ações sensíveis e tentativas negadas.",
  planejada: "25/09/2026",
  realizada: "24/09/2026 19:55",
  situacao: "entregue",
  evidencia: "Commit 183ce60 + teste de restrição da rota administrativa",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/183ce60",
)[
  Um terceiro microsserviço (`log-service`) foi incluído juntamente com o banco em memória Redis. O código registra eventos em Redis Streams (XADD), incluindo ações sensíveis e tentativas HTTP 403. Na validação atual, a conta comum recebeu HTTP 403 ao chamar `/api/admin/logs`; a leitura positiva dos eventos com uma conta admin não foi validada nesta sessão.

  #evidencia([Atividade 5 — Commit 183ce60 no GitHub · 24/09/2026 19:55], arquivo: "prints/atividade-5-commit.png")
  #evidencia([Atividade 5 — Logout realizado no deploy; consulta admin requer credencial privilegiada], arquivo: "prints/atividade-3-logout.png")

  A escolha pelo Redis Streams no lugar do Pub/Sub exigiu entender melhor o funcionamento de comandos persistentes temporais (XRANGE).
]

#atividade(
  "6", "Upload e perfil de usuário",
  descricao: "Página de perfil com avatar no MinIO; só a referência fica no banco relacional.",
  planejada: "02/10/2026",
  realizada: "02/10/2026 14:36",
  situacao: "entregue",
  evidencia: "Commit e0113da + perfil e validação de formato de arquivo",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/e0113da",
)[
  O sistema de Catálogo se transformou numa rede social de perfis. Integramos o MinIO para armazenar arquivos estáticos binários (fotos). Implementamos validações (multer) de formato e limite (5MB) e proteção na edição do perfil. O bucket do MinIO foi configurado como Leitura Pública, gerando menos gargalos no banco.

  #evidencia([Atividade 6 — Commit e0113da no GitHub · 02/10/2026 14:36], arquivo: "prints/atividade-6-commit.png")
  #evidencia([Atividade 6 — Perfil no deploy; sem foto previamente cadastrada], arquivo: "prints/atividade-6-perfil.png")
  #evidencia([Atividade 6 — O servidor rejeitou arquivo SVG com HTTP 400, conforme validação de formato], arquivo: "prints/atividade-6-validacao-upload.png")

  A edição da bio foi testada e o valor original vazio foi restaurado. Para evitar alterar permanentemente a foto do perfil da conta de teste, não foi enviado um avatar válido nesta sessão; portanto, o upload bem-sucedido ao MinIO não foi revalidado no deploy atual. A tela de perfil também apresentou contraste baixo no texto sobre o cartão branco.

  Fazer com que a imagem carregue publicamente tanto de maneira local quanto em container demandou mapeamento inteligente de rotas com variáveis como `MINIO_PUBLIC_URL`.
]


// ============================================================
= Considerações finais
// ============================================================
Durante este bimestre, a maior lição foi entender na prática a diferença tangível entre desenvolver uma aplicação monolítica que roda estritamente local, e desenhar uma arquitetura projetada para a nuvem. A fragmentação de um simples repositório em diversos microsserviços provou como a separação de responsabilidades cria dependências na orquestração e rede.

A maior dificuldade geral sem dúvida foi a manutenção do ambiente Docker para que todas as partes do sistema (backend público, autenticação privada, log isolado, MariaDB, Redis, Minio) pudessem escalar e se comunicar sem vazamentos de escopo de rede, tudo através das configurações do `docker-compose.yml`. Para os próximos passos, minha expectativa é conseguir integrar essa base de projetos a uma automação mais severa na nuvem (CI/CD) para desdobrar em um deploy PaaS/IaaS.

// ============================================================
= Declaração de autoria
// ============================================================
Declaro que este relatório foi elaborado por mim, individualmente, e que as evidências apresentadas correspondem a entregas de minha autoria, verificáveis nos links informados. Nas atividades realizadas em grupo, o conteúdo aqui descrito refere-se à minha participação.

#v(1.5cm)
#grid(
  columns: (1fr, 1fr), gutter: 2cm,
  align(center)[#line(length: 100%, stroke: 0.5pt) \ #aluno],
  align(center)[#line(length: 100%, stroke: 0.5pt) \ Pompeia, #data-relatorio],
)
