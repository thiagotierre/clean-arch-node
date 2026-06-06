# Decisão de Compute — AWS Lambda e Serverless Framework

**Status:** Aceito  
**Data:** 2026-06-06  
**Autor:** Thiago Tierre  

---

## Contexto

Precisávamos de uma estratégia de deploy e execução para a API de agenda que:

1. **Eliminasse** o overhead de gerenciamento de servidores (patches, escalabilidade, disponibilidade).
2. **Escalasse automaticamente** para zero em períodos sem tráfego (custo proporcional ao uso).
3. **Integrasse nativamente** com DynamoDB, SQS, SNS e demais serviços AWS.
4. **Simplificasse o ciclo de deploy** — um comando para subir toda a infraestrutura.
5. **Permitisse desenvolvimento local** sem depender de uma conta AWS ativa.

---

## Decisão

Adotamos **AWS Lambda** como plataforma de execução e **Serverless Framework v3** como ferramenta de IaC (Infrastructure as Code) e deploy.

---

## O que é AWS Lambda

AWS Lambda é um serviço de computação serverless que executa código em resposta a eventos sem que o desenvolvedor precise provisionar ou gerenciar servidores. O Lambda:

- Executa código em containers gerenciados pela AWS (Node.js 20.x)
- Escala automaticamente de 0 a milhares de execuções concorrentes
- Cobra por execução e por duração (milliseconds), não por servidor ativo
- Integra nativamente com API Gateway, SQS, DynamoDB Streams, EventBridge

---

## Por que AWS Lambda?

### 1. Custo operacional

O modelo de cobrança de Lambda é **por invocação + por GB-segundo de execução**. Para um sistema de agenda com tráfego variável (picos de manhã, baixo tráfego à noite), Lambda pode ser até 90% mais barato que uma instância EC2 ou ECS equivalente.

Exemplo de estimativa de custo:
```
100.000 requests/mês × 200ms × 512MB de memória
= 100.000 × 0.2s × 0.5GB
= 10.000 GB-segundos

Custo Lambda: ~$0.00 (dentro do free tier de 400.000 GB-segundos/mês)
Custo EC2 t3.micro equivalente: ~$8.50/mês
```

### 2. Zero gerenciamento de infraestrutura

Sem patching de OS, sem configuração de auto-scaling groups, sem monitoramento de disco. A equipe foca 100% no código de negócio.

### 3. Escalabilidade automática

Lambda escala concorrência automaticamente. Cada request pode ter sua própria instância Lambda. Não há necessidade de configurar load balancers ou réplicas de aplicação.

### 4. Event-driven nativo

Lambda é projetado para ser acionado por eventos:
- **API Gateway** → requisição HTTP
- **SQS** → mensagem na fila (consumer de RabbitMQ via bridge)
- **DynamoDB Streams** → alteração em item do banco
- **EventBridge** → evento agendado (cron) para lembretes

---

## Por que Serverless Framework?

### Alternativas de IaC para Lambda

| Ferramenta | Prós | Contras |
|---|---|---|
| **Serverless Framework** | Simples, foco em funções, plugins, offline mode | Abstração sobre CloudFormation pode ocultar detalhes |
| **AWS SAM** | Oficial AWS, próximo de CloudFormation | Verboso, menos plugins, sem offline mode nativo |
| **CDK (TypeScript)** | Expressivo, type-safe, full-stack IaC | Curva de aprendizado, over-engineering para Lambda simples |
| **Terraform** | Multi-cloud, amplamente adotado | Verboso para Lambda, sem conceito de "stage" nativo |

**Serverless Framework** foi escolhido por:
1. **Developer experience** — `serverless.yml` é conciso e legível
2. **serverless-offline** — emula Lambda + API Gateway localmente
3. **Ecosystem de plugins** maduro (webpack/esbuild, offline, dotenv)
4. **Stage management** — ambientes dev/staging/prod como primeiro cidadão

---

## Estrutura das Funções Lambda

### Funções da API (HTTP via API Gateway)

```yaml
functions:
  createAppointment:
    handler: src/interfaces/lambda/handlers/appointment.create
    events:
      - http:
          method: POST
          path: /appointments

  listAppointments:
    handler: src/interfaces/lambda/handlers/appointment.list
    events:
      - http:
          method: GET
          path: /appointments

  getAppointment:
    handler: src/interfaces/lambda/handlers/appointment.getById
    events:
      - http:
          method: GET
          path: /appointments/{id}
```

### Funções Consumer (SQS via RabbitMQ bridge)

```yaml
  processNotification:
    handler: src/interfaces/lambda/handlers/notification.process
    events:
      - sqs:
          arn: !GetAtt AppointmentNotificationsQueue.Arn
          batchSize: 10
          functionResponseType: ReportBatchItemFailures
```

### Função agendada (Cron — lembretes)

```yaml
  sendReminders:
    handler: src/interfaces/lambda/handlers/reminder.send
    events:
      - schedule:
          rate: rate(15 minutes)
          enabled: true
```

---

## Configuração de Lambda

### Limites e timeouts

| Função | Timeout | Memória | Justificativa |
|---|---|---|---|
| API handlers (sync) | 10s | 512MB | Resposta rápida, maioria < 500ms |
| SQS consumers | 60s | 512MB | Processamento de lote com retries |
| Cron reminders | 300s | 256MB | Pode processar muitos lembretes |

### Variáveis de ambiente por stage

```yaml
provider:
  environment:
    NODE_ENV: ${self:provider.stage}
    DYNAMODB_TABLE_APPOINTMENTS: agenda-appointments-${self:provider.stage}
    RABBITMQ_URL: ${ssm:/agenda/${self:provider.stage}/rabbitmq-url}
```

Segredos (RABBITMQ_URL, etc.) são armazenados no **AWS Systems Manager Parameter Store** (SSM) — nunca em variáveis de ambiente em texto claro no código.

---

## Cold Start

### O que é

Cold start ocorre quando Lambda precisa inicializar um novo container de execução. Para Node.js 20.x, o cold start típico é de **100-500ms** — aceitável para o uso de agenda.

### Mitigações implementadas

1. **Bundle com esbuild** — bundle mínimo sem `node_modules` desnecessários reduz tempo de inicialização do módulo.
2. **Provisioned Concurrency** — para funções críticas em produção, mantém N instâncias "quentes" (custo adicional).
3. **Lambda Layers** — dependências compartilhadas (AWS SDK, etc.) em layer separada para reutilização entre cold starts.
4. **Lazy initialization** — conexões com DynamoDB e RabbitMQ são inicializadas fora do handler (no module scope) para reutilização entre invocações do mesmo container.

```typescript
// Conexão reutilizada entre invocações do mesmo container
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION })

export const handler = async (event: APIGatewayEvent) => {
  // dynamoClient já está inicializado — sem overhead de cold start aqui
}
```

---

## Desenvolvimento Local

### serverless-offline

O plugin `serverless-offline` emula o API Gateway e Lambda localmente:

```bash
npm run dev
# API disponível em http://localhost:3000
# Lambda logs no terminal
```

### Emulação de SQS/DynamoDB

```bash
docker-compose up -d
# DynamoDB Local: http://localhost:8000
# RabbitMQ: amqp://localhost:5672
```

---

## Pipeline CI/CD

```
Push → GitHub Actions
  │
  ├── lint + type-check
  ├── unit tests
  ├── integration tests (com DynamoDB Local + RabbitMQ em Docker)
  └── deploy
        ├── staging: main branch → auto-deploy
        └── prod: release tag → deploy manual aprovado
```

---

## Observabilidade

| Aspecto | Ferramenta |
|---|---|
| Logs | CloudWatch Logs (estruturado em JSON) |
| Métricas | CloudWatch Metrics + Lambda Insights |
| Tracing | AWS X-Ray (trace distribuído entre Lambda + DynamoDB) |
| Alertas | CloudWatch Alarms → SNS → Slack/PagerDuty |
| Dashboards | CloudWatch Dashboard por stage |

---

## Tradeoffs

| Tradeoff | Mitigação |
|---|---|
| **Cold start** (100-500ms) | Esbuild bundling, Provisioned Concurrency para funções críticas |
| **Timeout máximo 15 min** | Processos longos usam Step Functions ou ECS Task |
| **Sem estado persistente entre invocações** | Estado fica no DynamoDB; conexões reutilizadas no module scope |
| **Debugging mais complexo** | X-Ray tracing, logs estruturados, `serverless-offline` local |
| **Vendor lock-in AWS** | Clean Architecture isola o código de negócio dos detalhes Lambda — migração é viável |

---

## Referências

- [AWS Lambda — Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs)
- [Best Practices for Lambda Cold Starts](https://docs.aws.amazon.com/lambda/latest/operatorguide/perf-optimize.html)
- [Lambda Power Tuning — otimização de memória](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [serverless-offline plugin](https://github.com/dherault/serverless-offline)
