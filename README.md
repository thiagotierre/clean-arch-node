# Agenda API — Clean Architecture on AWS Serverless

Sistema de gerenciamento de agenda desenvolvido com foco em **qualidade arquitetural**, **escalabilidade** e **manutenibilidade**, seguindo os princípios de Clean Architecture com Node.js/TypeScript rodando em AWS Lambda.

---

## Índice

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Como Executar](#como-executar)
- [Endpoints](#endpoints)
- [Testes](#testes)
- [Deploy](#deploy)
- [Documentação Técnica](#documentação-técnica)

---

## Visão Geral

A **Agenda API** é um sistema backend para gerenciamento de compromissos e contatos. Permite criar, listar, atualizar e cancelar agendamentos, além de enviar notificações assíncronas via mensageria.

**Funcionalidades principais:**
- Criação e gerenciamento de compromissos (appointments)
- Gerenciamento de contatos
- Notificações assíncronas por mensageria (lembretes de compromissos)
- Histórico de eventos por agregado

---

## Tecnologias

| Tecnologia | Versão | Finalidade |
|---|---|---|
| Node.js | 20.x | Runtime |
| TypeScript | 5.x | Linguagem |
| AWS Lambda | — | Compute serverless |
| Serverless Framework | 3.x | Deploy e IaC |
| Amazon DynamoDB | — | Banco de dados NoSQL |
| RabbitMQ | 3.x | Mensageria assíncrona |
| AWS SQS | — | Fila de mensagens (bridge RabbitMQ → Lambda) |
| Jest | 29.x | Testes unitários e de integração |
| Zod | 3.x | Validação de schemas |

---

## Arquitetura

O projeto segue **Clean Architecture** (Robert C. Martin), dividindo responsabilidades em camadas concêntricas com dependências apontando sempre para o centro:

```
┌─────────────────────────────────────────────┐
│              Interfaces Layer               │  ← Lambda handlers, HTTP controllers
├─────────────────────────────────────────────┤
│           Infrastructure Layer             │  ← DynamoDB, RabbitMQ, AWS SDK
├─────────────────────────────────────────────┤
│            Application Layer               │  ← Use Cases, DTOs, interfaces
├─────────────────────────────────────────────┤
│               Domain Layer                 │  ← Entities, Value Objects, Events
└─────────────────────────────────────────────┘
```

> Ver [docs/architecture.md](docs/architecture.md) para a decisão técnica completa.  
> Ver [docs/diagrams.md](docs/diagrams.md) para diagramas de fluxo do sistema.

---

## Estrutura do Projeto

```
clean-arch-node/
├── src/
│   ├── domain/                    # Camada de domínio (regras de negócio puras)
│   │   ├── entities/              # Entidades e agregados
│   │   ├── value-objects/         # Objetos de valor imutáveis
│   │   ├── repositories/          # Interfaces dos repositórios
│   │   └── events/                # Eventos de domínio
│   │
│   ├── application/               # Camada de aplicação (orquestração)
│   │   ├── use-cases/             # Casos de uso
│   │   │   ├── appointment/
│   │   │   └── contact/
│   │   ├── interfaces/            # Contratos para infraestrutura
│   │   └── dtos/                  # Data Transfer Objects
│   │
│   ├── infrastructure/            # Camada de infraestrutura (detalhes técnicos)
│   │   ├── database/
│   │   │   └── dynamodb/          # Implementação DynamoDB
│   │   ├── messaging/
│   │   │   └── rabbitmq/          # Implementação RabbitMQ
│   │   └── container/             # Injeção de dependências
│   │
│   └── interfaces/                # Camada de interface (adaptadores)
│       ├── lambda/                # Handlers AWS Lambda
│       └── mappers/               # Mapeadores entre camadas
│
├── docs/                          # Documentação técnica
│   ├── architecture.md
│   ├── database.md
│   ├── messaging.md
│   ├── serverless.md
│   └── diagrams.md
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── serverless.yml                 # Configuração Serverless Framework
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Pré-requisitos

### Ferramentas obrigatórias

| Ferramenta | Versão mínima | Instalação |
|---|---|---|
| Node.js | 20.x | [nodejs.org](https://nodejs.org) |
| npm | 10.x | Incluído no Node.js |
| Docker | 24.x | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | 2.x | Incluído no Docker Desktop |
| AWS CLI | 2.x | [aws.amazon.com/cli](https://aws.amazon.com/cli/) |
| Serverless Framework | 3.x | `npm install -g serverless` |

### Serviços locais (via Docker)

- **DynamoDB Local** — emulador local do DynamoDB
- **RabbitMQ** — broker de mensagens

### Credenciais AWS (apenas para deploy)

Configure as credenciais AWS com permissões para Lambda, DynamoDB, SQS, IAM e CloudFormation:

```bash
aws configure
```

---

## Instalação e Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/clean-arch-node.git
cd clean-arch-node
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env com suas configurações locais
```

### 4. Suba os serviços locais

```bash
docker-compose up -d
```

Isso iniciará:
- DynamoDB Local em `http://localhost:8000`
- RabbitMQ em `amqp://localhost:5672`
- RabbitMQ Management UI em `http://localhost:15672` (guest/guest)

### 5. Crie as tabelas no DynamoDB Local

```bash
npm run db:setup
```

---

## Variáveis de Ambiente

| Variável | Descrição | Padrão (local) |
|---|---|---|
| `NODE_ENV` | Ambiente de execução | `development` |
| `AWS_REGION` | Região AWS | `us-east-1` |
| `DYNAMODB_ENDPOINT` | Endpoint DynamoDB (local apenas) | `http://localhost:8000` |
| `DYNAMODB_TABLE_APPOINTMENTS` | Nome da tabela de compromissos | `agenda-appointments-dev` |
| `DYNAMODB_TABLE_CONTACTS` | Nome da tabela de contatos | `agenda-contacts-dev` |
| `RABBITMQ_URL` | URL de conexão RabbitMQ | `amqp://guest:guest@localhost:5672` |
| `RABBITMQ_EXCHANGE` | Nome do exchange principal | `agenda.events` |
| `RABBITMQ_QUEUE_NOTIFICATIONS` | Fila de notificações | `agenda.notifications` |

---

## Como Executar

### Desenvolvimento local (offline)

```bash
# Sobe os serviços de infraestrutura
docker-compose up -d

# Inicia o servidor local com hot-reload (Serverless Offline)
npm run dev
```

A API ficará disponível em `http://localhost:3000`.

### Compilar TypeScript

```bash
npm run build
```

### Executar em modo produção (local)

```bash
npm run build
npm start
```

---

## Endpoints

### Appointments

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/appointments` | Criar compromisso |
| `GET` | `/appointments` | Listar compromissos |
| `GET` | `/appointments/{id}` | Buscar compromisso por ID |
| `PUT` | `/appointments/{id}` | Atualizar compromisso |
| `DELETE` | `/appointments/{id}` | Cancelar compromisso |

### Contacts

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/contacts` | Criar contato |
| `GET` | `/contacts` | Listar contatos |
| `GET` | `/contacts/{id}` | Buscar contato por ID |
| `PUT` | `/contacts/{id}` | Atualizar contato |

---

## Testes

```bash
# Todos os testes
npm test

# Apenas unitários
npm run test:unit

# Apenas integração
npm run test:integration

# Com cobertura
npm run test:coverage

# Watch mode
npm run test:watch
```

**Cobertura mínima esperada:** 80% em todas as métricas.

---

## Deploy

### Deploy para staging

```bash
npm run deploy:staging
```

### Deploy para produção

```bash
npm run deploy:prod
```

### Deploy de uma função específica

```bash
npx serverless deploy function --function createAppointment --stage prod
```

### Remover stack

```bash
npx serverless remove --stage dev
```

---

## Documentação Técnica

| Documento | Descrição |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Decisão sobre Clean Architecture |
| [docs/database.md](docs/database.md) | Decisão sobre DynamoDB e modelagem |
| [docs/messaging.md](docs/messaging.md) | Decisão sobre RabbitMQ e padrões de mensageria |
| [docs/serverless.md](docs/serverless.md) | Decisão sobre AWS Lambda e Serverless |
| [docs/diagrams.md](docs/diagrams.md) | Diagramas de arquitetura e fluxos |

---

## Licença

MIT — veja [LICENSE](LICENSE) para detalhes.
