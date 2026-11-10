// ============================================================
// P2 — Relatório consolidado: arquitetura e atividades
// ISW055 · Introdução à Computação em Nuvem · Fatec Pompeia · 2026.2
// Versão: 10/11/2026. Evidências locais autenticadas adicionadas; pendências externas declaradas.
// ============================================================

#let aluno = "Douglas Felipe Mariano"
#let turma = "161_SIST. INTELIGENTES_N"
#let produto = "AgendaLivre"
#let repositorio = "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/tree/agendalivre"
#let data-relatorio = "10/11/2026"
#let disciplina = "Introdução à Computação em Nuvem"
#let codigo = "ISW055"
#let professor = "Prof. Allan Lincoln Rodrigues Siriani"
#let accent = rgb("#7060d7")

#set document(title: "P2 — " + codigo + " — " + aluno, author: aluno)
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2cm))
#set text(size: 10.5pt, lang: "pt", region: "BR")
#set par(justify: true, leading: 0.72em)
#set heading(numbering: "1.1")
#show heading.where(level: 1): it => { v(0.6em); text(size: 16pt, it); v(0.2em) }
#show heading.where(level: 2): it => { v(0.5em); text(size: 12.5pt, it); v(0.1em) }
#show link: set text(fill: accent)
#show figure.caption: set text(size: 9pt, fill: luma(90))
#set table(stroke: 0.5pt + luma(200), inset: 5pt)
#show table: set text(hyphenate: false)
#show table: set par(justify: false)

#let registro = state("registro", ())
#let registrar(numero, titulo, planejada, realizada, situacao) = registro.update(l => l + ((
  numero: numero, titulo: titulo, planejada: planejada, realizada: realizada, situacao: situacao,
),))
#let atividade(
  numero, titulo, descricao: "", planejada: "", realizada: "—",
  situacao: "entregue", evidencia: "", url: "", corpo,
) = {
  registrar(numero, titulo, planejada, realizada, situacao)
  heading(level: 2, [Atividade #numero — #titulo])
  table(
    columns: (3.4cm, 1fr),
    fill: (x, y) => if x == 0 { luma(245) } else { none },
    [*Descrição*], [#descricao],
    [*Data planejada*], [#planejada],
    [*Data realizada*], [#realizada],
    [*Situação*], [#situacao],
    [*Evidência disponível / pendente*], [#evidencia],
    [*Link direto*], [#if url == "" [—] else [#link(url)]],
  )
  corpo
}

#align(center)[
  #v(1.2cm)
  #image("prints/agendalivre-logo.svg", width: 58%)
  #v(1.1cm)
  #text(size: 12pt, tracking: 0.12em)[FATEC POMPEIA]
  #v(0.4em)
  #text(size: 10.5pt, fill: luma(110))[#disciplina · #codigo · #turma]
  #v(2.6cm)
  #text(size: 26pt, weight: "bold")[P2]
  #v(0.3em)
  #text(size: 18pt, weight: "bold")[Relatório consolidado]
  #v(0.2em)
  #text(size: 13pt)[arquitetura e atividades do 2º bimestre]
  #v(0.8em)
  #text(size: 11pt, fill: luma(110))[Avaliação individual · 2026.2]
  #v(2.4cm)
  #text(size: 14pt)[#aluno]
  #v(0.5em)
  #text(size: 11pt)[Produto: *#produto*] \
  #text(size: 9.5pt)[#link(repositorio)]
  #v(1fr)
  #text(size: 10.5pt)[#professor \ Pompeia, #data-relatorio]
]

#set page(
  numbering: "1",
  number-align: right,
  header: context {
    set text(size: 8pt, fill: luma(120))
    [#codigo · P2 — Relatório consolidado #h(1fr) #aluno]
    line(length: 100%, stroke: 0.4pt + luma(200))
  },
)
#counter(page).update(1)
#outline(title: "Sumário", indent: 1.2em, depth: 2)
#pagebreak()

= Introdução
A disciplina de Introdução à Computação em Nuvem aborda a construção e operação de aplicações distribuídas, com atenção a identidade, isolamento, dados e infraestrutura. Neste segundo bimestre, o projeto deixou de ser somente um catálogo de filmes e passou a ser o AgendaLivre, um protótipo de SaaS para consultórios independentes. A mudança de domínio reaproveita a base técnica de autenticação, autorização, logs, armazenamento e cobrança, mas substitui as telas e as entidades de negócio.

O AgendaLivre busca reduzir o trabalho manual de organizar horários, pacientes e lista de espera. A persona inicial é a profissional de consultório pequeno que hoje combina agenda, planilha e mensagens para preencher cancelamentos. O sistema guarda apenas dados administrativos mínimos; não é prontuário e não deve conter sintomas, diagnósticos ou recomendações clínicas. Este relatório apresenta a arquitetura que pode ser comprovada no repositório, as atividades 7 a 11, suas datas e estados, e as limitações de publicação e evidências que ainda precisam ser resolvidas.

= Metodologia
A implementação foi inspecionada na branch `agendalivre` do repositório TomHanksApp. As datas e horas dos commits foram extraídas do Git e conferidas no GitHub; para as atividades 9 e 10, também foi consultado o timestamp de criação das issues. Em 09/11/2026, além das telas públicas, foram iniciados localmente o frontend Vite, a API e o auth-service. Após autorização explícita da aluna, aplicaram-se as migrações no MariaDB remoto da disciplina e criou-se uma conta de demonstração fictícia, com paciente, agendamentos e lista de espera igualmente sintéticos. Foram exercitados cadastro/login e operações de domínio; a quarta criação de agendamento retornou HTTP 403 pelo limite Free. O Docker Engine não estava disponível; MinIO e Redis/log-service não foram iniciados. No Stripe Test mode, foram criados o produto/preço recorrente e a configuração do Customer Portal, mas não havia chave secreta nem segredo de webhook na configuração local, então checkout, pagamento e webhook não foram executados.

O enunciado da atividade 9 solicita um repositório novo, público e espelhado com todo o histórico, além do backlog. Por decisão de continuidade, o AgendaLivre permaneceu no mesmo repositório, na branch `agendalivre`; essa divergência está explicitada na issue #7 e não é apresentada como requisito cumprido. A conta Stripe Test mode e o MariaDB remoto foram acessados para configuração e testes com dados fictícios; o Portainer não foi verificado. Não há checkout, webhook, stack saudável ou URL implantada a comprovar, e nenhuma dessas evidências foi simulada.

= Arquitetura do SaaS

== Visão geral e componentes
O diagrama a seguir representa os componentes e as integrações declaradas no código e no Docker Compose. Ele não comprova que a stack esteja implantada ou saudável na VM da disciplina.

#figure(
  image("prints/arquitetura-agendalivre.svg", width: 100%),
  caption: [AgendaLivre — arquitetura configurada no repositório; implantação externa ainda não verificada.],
)

#table(
  columns: (2.7cm, 1fr, 3.2cm, 2.2cm),
  fill: (x, y) => if y == 0 { luma(235) } else { none },
  table.header([*Componente*], [*Responsabilidade*], [*Tecnologia / configuração*], [*Exposição*]),
  [app], [Landing, SPA, API do domínio e integrações], [Node.js / Express; porta 3000], [público via domínio],
  [auth-service], [Cadastro, login, validação de token e papel global], [Node.js; porta interna 3001], [rede Docker],
  [log-service + Redis], [Eventos de auditoria e leitura administrativa], [Node.js; Redis Streams], [rede Docker],
  [MariaDB], [Contas, clínicas, equipe, pacientes, agenda e billing], [Externo ao Compose; `DB_*`], [acesso da aplicação],
  [MinIO], [Armazenamento de logos do consultório], [bucket `agendalivre-assets`], [API interna; objeto público],
  [Stripe], [Checkout, assinatura, portal e webhooks], [API Stripe em Test mode], [serviço externo],
  [SMTP], [E-mail de recuperação e campanhas consentidas], [`SMTP_*`], [serviço externo],
)

== Onde roda
O repositório contém Dockerfiles e um `docker-compose.yml` para os containers `app`, `auth-service`, `log-service`, Redis e MinIO. O MariaDB não é criado pelo Compose: endereço, usuário, senha e banco são fornecidos por `DB_HOST`, `DB_USER`, `DB_PASS` e `DB_NAME`. O app serve o build do frontend e expõe a porta configurada por `RESERVED_PORT`; Stripe e SMTP são dependências externas. O bucket do MinIO destina-se somente a logos públicos.

Não há prova disponível nesta execução de qual stack do Portainer está ativa, do repositório configurado nela, dos limites de memória efetivos, do domínio público ou do estado dos containers. Assim, não declaro uma URL de produção. A execução que foi observada para conferir a interface foi local; não equivale ao deploy solicitado nas atividades 9 e 10.

== Fluxo de uma requisição
1. O navegador envia uma requisição autenticada ao endpoint `/api` do `app`.
2. O middleware de autenticação valida a identidade consultando `/auth/me` no `auth-service`; o papel global atual é lido do banco.
3. `clinicAccess` resolve no servidor o consultório e o papel local (`owner`, `reception` ou `professional`). O tenant não é escolhido por um ID fornecido pelo navegador.
4. A rota aplica o papel permitido e restringe consultas pelo `clinic_id`; algumas leituras de profissionais também usam o nome da sessão, limitação documentada que deve evoluir para vínculo por ID imutável.
5. O `app` consulta ou altera o MariaDB e registra eventos no `log-service`, que os guarda no Redis Streams. A resposta JSON retorna pelo mesmo caminho ao navegador.

== Fluxo de assinatura
O backend cria uma Checkout Session hospedada pelo Stripe com `mode=subscription`, vinculada à conta por `client_reference_id` e metadados. O cartão nunca passa pelo backend. A rota exige o preço `STRIPE_PRO_PRICE_ID` ativo em BRL, mensal e de R\$ 39,90. Na volta do Checkout, o frontend apenas consulta o estado; somente os webhooks validados podem sincronizar a assinatura e conceder Pro.

O webhook usa o corpo bruto e `Stripe-Signature`. Os IDs de evento são gravados em `stripe_events` na mesma transação da alteração do usuário, evitando reaplicar um evento repetido. Estados `active`/`trialing` concedem Pro; cancelamento ou `past_due` retiram o benefício. O endpoint do Customer Portal delega gerenciamento/cancelamento ao Stripe. No Stripe Test mode foi criado o produto AgendaLivre Pro, com preço mensal recorrente em BRL de R\$ 39,90, e salva-se a configuração do portal com retorno para a aplicação local. As capturas comprovam a configuração do catálogo e do portal, não checkout, pagamento ou webhook. A chave secreta e o segredo do webhook não foram configurados na aplicação; logo, o ciclo Checkout→banco→Pro permanece pendente. Eventos fora de ordem do mesmo ID de assinatura ainda podem sobrescrever o estado e são limitação conhecida.

== Modelo de dados do domínio
As tabelas centrais são `usuarios` (papel global, estado Pro e IDs Stripe), `clinics` (tenant e proprietário), `clinic_members` (vínculo único de equipe por usuário e papel local), `clinic_patients`, `clinic_appointments`, `clinic_waitlist`, `clinic_marketing_sends`, `reset_tokens` e `stripe_events`. As relações e chaves estrangeiras são declaradas em `database/create.sql` e repetidas/adequadas pelas migrações do backend. `clinic_id` liga os dados operacionais ao consultório; `patient_id` liga atendimento/lista de espera ao paciente; `owner_user_id` liga a clínica à conta proprietária.

Os campos `stripe_customer_id` e `stripe_subscription_id` relacionam a conta ao Stripe; `premium`, `subscription_status`, `subscription_amount_cents`, `premium_since` e `premium_until` guardam a cópia operacional local do plano. Essa cópia depende de webhooks e não é a fonte autoritativa da cobrança.

== Segurança
O papel `admin` é global e permite acessar o resumo administrativo de billing e os logs. `owner` administra clínica, equipe, configuração e cobrança; `reception` consulta a operação e pode cadastrar pacientes, consentimentos e lista de espera; `professional` cria e administra atendimentos associados ao próprio nome de sessão. O backend aplica as regras; esconder controles na interface não é considerado autorização.

As consultas do domínio usam `clinic_id`, e alterações de paciente/consulta verificam que o registro pertence ao tenant. Para profissionais, várias leituras e mutações também filtram pelo nome, não por uma chave imutável, e por isso a documentação registra esse risco. Segredos Stripe, JWT, SMTP, banco e HMAC são nomes de variáveis nos arquivos de exemplo; valores reais não devem ser versionados. O bucket MinIO é público para logos e não deve conter dados de pacientes. Rate limiting, revisão LGPD, retenção e hardening de produção ainda são necessários.

== Observabilidade, CI/CD e documentação da API
O `log-service` usa Redis Streams para eventos e a API administrativa limita o acesso ao papel `admin`. Há testes unitários locais para helpers de billing. Não foi implementado nem validado nesta entrega pipeline de CI/CD, Swagger/OpenAPI, métricas Prometheus ou health checks/readiness de ponta a ponta. A stack não foi observada no Portainer.

== Camadas IaaS, PaaS e SaaS do projeto
#table(
  columns: (2cm, 1fr, 3.5cm),
  fill: (x, y) => if y == 0 { luma(235) } else { none },
  table.header([*Camada*], [*Papel neste projeto*], [*Gestão / estado verificado*]),
  [IaaS], [VM, sistema operacional, disco e rede do laboratório], [Infraestrutura da Fatec/provedor; implantação individual não verificada.],
  [PaaS (didático)], [Docker/Compose e containers da aplicação, auth, logs, Redis e MinIO], [Configurados no repositório; stack/limites no Portainer não inspecionados.],
  [SaaS], [AgendaLivre para o consultório; Stripe e SMTP como serviços externos], [Produto é protótipo; integração externa não validada nesta execução.],
)

= Quadro de entregas
#context {
  let l = registro.final().sorted(key: a => a.numero)
  table(
    columns: (auto, 1fr, 2.2cm, 3.5cm, 2.5cm),
    align: (center, left, center, center, center),
    fill: (x, y) => if y == 0 { luma(235) } else { none },
    table.header([*Nº*], [*Atividade*], [*Planejada*], [*Realizada*], [*Situação*]),
    ..l.map(a => ([#a.numero], [#a.titulo], [#a.planejada], [#a.realizada], [#a.situacao])).flatten(),
  )
}

= Atividades realizadas

#atividade(
  7, "Plano Premium — cobrança de verdade com Stripe",
  descricao: "Checkout de pagamento hospedado e sincronização do benefício Premium via webhook.",
  planejada: "09/10/2026",
  realizada: "09/11/2026 21:01",
  situacao: "implementação parcial, com atraso; produto e portal de teste configurados",
  evidencia: "Commit 70586a6, testes locais e capturas do produto/Customer Portal no Stripe Test mode. Checkout e webhook pendentes.",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/70586a659c9f78db3f5e30f5063f0f41e337f16a",
)[
  O commit `70586a6` contém a primeira integração de Checkout Premium com o Stripe e processamento de webhook. O teste local cobre resolução da sessão e regras de elegibilidade. Durante a validação, foi criado no Stripe Test mode o produto AgendaLivre Pro com preço recorrente mensal em BRL de R\$ 39,90 e configurado o Customer Portal; as capturas a seguir documentam essa configuração, não uma cobrança concluída. Essa parte foi feita depois da data planejada de 09/10.

  A pendência é executar e capturar um Checkout de teste concluído, o webhook recebido e o benefício Pro sincronizado na conta. Não há `STRIPE_SECRET_KEY` nem `STRIPE_WEBHOOK_SECRET` localmente, portanto as capturas de cobrança e ativação não foram produzidas. A decisão de delegar cartão ao Checkout evita armazenar dados de cartão no produto.

  #figure(
    grid(
      columns: 2,
      gutter: 8pt,
      image("prints/agendalivre-stripe-produto-pro-test-20261110.png", width: 100%),
      image("prints/agendalivre-stripe-portal-test-20261110.png", width: 100%),
    ),
    caption: [Stripe Test mode: produto/preço recorrente e configuração do Customer Portal. Não há assinatura ativa nem pagamento comprovado.],
  )
]

#atividade(
  8, "SaaS, PaaS, IaaS — e a documentação que o projeto nunca teve",
  descricao: "Classificação das camadas e documentação reversa da especificação, arquitetura, regras e dados.",
  planejada: "16/10/2026",
  realizada: "09/11/2026 22:29",
  situacao: "documentação commitada com atraso; publicação da stack não verificada",
  evidencia: "Commit 0f754a8; README e DOCUMENTACAO.md no branch. Sem captura de implantação.",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/0f754a8c88289d29030b93d245a35073f161cb99",
)[
  A documentação foi atualizada para o AgendaLivre: o README apresenta a dor, persona, alternativas, receita, métricas, Lean Canvas e mapa de reaproveitamento. `DOCUMENTACAO.md` registra API, arquitetura, regras, modelo de dados, permissões e limitações. O documento separa fatos observados no código das dependências externas ainda não verificadas.

  O commit é posterior ao prazo de 16/10/2026. Não há captura de um deploy para anexar; a atividade 8 de documentação pode ser consultada diretamente no commit e nos arquivos. A principal decisão foi declarar limitações em vez de descrever uma infraestrutura ideal como se estivesse em execução.
]

#atividade(
  9, "Fork e plano de negócio",
  descricao: "Repositório novo espelhado, README do produto e backlog de pelo menos cinco issues.",
  planejada: "23/10/2026",
  realizada: "09/11/2026 22:30",
  situacao: "não entregue conforme enunciado; issue de divergência aberta",
  evidencia: "Issue #7 registra a pendência. O README existe neste repositório; não há repositório separado nem evidência de espelhamento.",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/issues/7",
)[
  O README do AgendaLivre descreve um produto para consultórios, dor e persona, alternativas, proposta de valor, Free/Pro, métricas, Lean Canvas e reaproveitamento dos microsserviços. A implementação, porém, permaneceu no repositório existente, na branch `agendalivre`, em vez de ser espelhada para um repositório novo e público. Isso contraria um requisito explícito da atividade 9 e não é apresentado como concluído.

  A issue #7 foi aberta em 09/11/2026 às 22:30 (horário de Brasília) para registrar a divergência e pedir uma decisão sobre como regularizar o requisito. O README e o histórico existem, mas não há captura do histórico em repositório novo. O backlog de produto também precisa ser distinguido das issues de entrega acadêmica e completado com pelo menos cinco próximas tarefas.
]

#atividade(
  10, "Seu negócio no ar — o domínio no lugar dos filmes",
  descricao: "CRUD do domínio, papéis, isolamento, eventos, upload e landing page na stack do curso.",
  planejada: "06/11/2026",
  realizada: "09/11/2026 22:30",
  situacao: "código parcial commitado com atraso; deploy e evidências pendentes",
  evidencia: "Issues #8, commits 45ef84a/5b03adc e capturas autenticadas do painel, agenda, pacientes e lista de espera com dados fictícios. Deploy, MinIO e logs pendentes.",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/issues/8",
)[
  A branch substitui o catálogo por uma landing page pública, painel de consultório, pacientes, agenda, lista de espera, papéis locais, isolamento por `clinic_id`, eventos e upload de logo. As telas públicas iniciais foram capturadas às 23:03 de 09/11/2026 em Brasília: #link("prints/agendalivre-local-01-landing-20261109-2303.png")[landing], #link("prints/agendalivre-local-02-login-20261109-2303.png")[login], #link("prints/agendalivre-local-03-cadastro-20261109-2303.png")[cadastro], #link("prints/agendalivre-local-04-recuperar-senha-20261109-2303.png")[recuperação] e #link("prints/agendalivre-local-05-reset-sem-token-20261109-2303.png")[redefinição sem token]. Em seguida, API e auth-service locais foram conectados ao MariaDB remoto de teste, após autorização, e foi criada uma clínica fictícia com paciente, agendamentos e lista de espera sintéticos. São evidências locais com dados fictícios, não publicação.

  #figure(
    grid(
      columns: 2,
      gutter: 8pt,
      image("prints/agendalivre-local-06-visao-geral-20261109.png", width: 100%),
      image("prints/agendalivre-local-07-pacientes-20261109.png", width: 100%),
    ),
    caption: [Painel autenticado e cadastro fictício de paciente com consentimento administrativo.],
  )
  #figure(
    grid(
      columns: 2,
      gutter: 8pt,
      image("prints/agendalivre-local-08-agenda-20261109.png", width: 100%),
      image("prints/agendalivre-local-09-lista-espera-20261109.png", width: 100%),
    ),
    caption: [Agenda e lista de espera com registros sintéticos; os horários exibidos não são evidência de validação de fuso horário.],
  )
  #figure(
    grid(
      columns: 2,
      gutter: 8pt,
      image("prints/agendalivre-local-10-recursos-pro-free-20261109.png", width: 100%),
      image("prints/agendalivre-local-11-limite-free-20261109.png", width: 100%),
    ),
    caption: [Recursos Pro exibidos no plano Free e bloqueio após três agendamentos: a API recusou a quarta criação com HTTP 403.],
  )

  Não tive acesso ao Portainer. Portanto, não posso declarar a stack redeployada, os containers saudáveis, o subdomínio atualizado ou os testes de duas contas concluídos. Faltam os prints de publicação, eventos, MinIO e Portainer; o endereço local do navegador não é evidência de deploy. O Docker Engine não estava disponível e Redis/log-service e MinIO não foram iniciados nesta validação.
]

#atividade(
  11, "SaaS completo — planos, limites e assinatura com Stripe",
  descricao: "Planos Free/Pro, assinatura recorrente, webhooks, Customer Portal, limites server-side e MRR admin.",
  planejada: "13/11/2026",
  realizada: "Em andamento — código commitado em 09/11/2026 22:29",
  situacao: "em andamento; limite Free testado e catálogo/portal configurados no Stripe Test mode",
  evidencia: "Commit 4660962, 5 testes locais, HTTP 403 ao quarto agendamento e capturas de produto/portal Stripe. Checkout, webhook e painel admin pendentes.",
  url: "https://github.com/Douglas-Felipe-Mariano/TomHanksApp/commit/4660962e16826ce41161a848b24c024f4fd152b3",
)[
  O código cria Checkout de assinatura com preço mensal fixado no servidor, guarda IDs da assinatura/cliente, valida assinatura dos webhooks, deduplica eventos, sincroniza o plano, expõe o Customer Portal, aplica no backend a franquia Free de três agendamentos e calcula o MRR no painel admin. Os cinco testes unitários de billing passaram localmente. Na conta fictícia, três agendamentos foram persistidos e a tentativa seguinte foi bloqueada pela API com HTTP 403 e código `PLAN_LIMIT_REACHED`, conforme a captura do limite Free. O produto e o Customer Portal foram criados no Stripe Test mode. A data planejada de 13/11 ainda não chegou na data desta versão do relatório.

  Isso ainda não comprova a assinatura ponta a ponta: faltam a chave secreta local e o segredo do webhook, portanto não foram executados Checkout, pagamento de teste, entrega de evento, ativação Pro, cancelamento de assinatura ou cálculo de MRR baseado em uma assinatura real de teste. O bloqueio do quarto agendamento é uma validação integrada real do limite Free; não afirmo a atividade como entregue.
]

= Considerações finais
O trabalho deste bimestre mostrou que mudar o domínio de uma aplicação envolve mais do que trocar telas: foi necessário modelar tenants, definir papéis locais, controlar os acessos no servidor e manter o estado de assinatura separado da resposta do navegador. A parte que mais exige cuidado é provar que as integrações e a infraestrutura configurada no código realmente funcionam em conjunto, sem confundir build local ou testes unitários com um deploy real.

Neste momento, o AgendaLivre tem fluxos locais de autenticação, CRUD, agenda e limite Free exercitados com dados fictícios no banco de teste autorizado, mas este relatório não deve ser tratado como evidência de um SaaS publicado. Para concluir a entrega faltam resolver o requisito de repositório da atividade 9, validar o ciclo completo Stripe com segredos de teste configurados e publicar as atividades 10 e 11 nos serviços da disciplina. Uma futura versão deve também vincular profissionais por ID, padronizar timezone e tornar a cota de e-mails atômica.

= Declaração de autoria
Declaro que este relatório foi elaborado por mim, individualmente. As datas de commits, issues e testes citadas são verificáveis nos links informados. As capturas de ambiente externo ainda não disponíveis foram declaradas como pendentes, sem simulação de evidência.

#v(1.5cm)
#grid(
  columns: (1fr, 1fr), gutter: 2cm,
  align(center)[#line(length: 100%, stroke: 0.5pt) \ #aluno],
  align(center)[#line(length: 100%, stroke: 0.5pt) \ Pompeia, #data-relatorio],
)
