# Decisão de Mensageria — RabbitMQ

**Status:** Aceito  
**Data:** 2026-06-06  
**Autor:** Thiago Tierre  

---

## Contexto

O sistema de agenda precisa enviar **notificações e lembretes** de compromissos de forma assíncrona, sem bloquear a resposta da API. Exemplos de eventos que precisam gerar comunicação assíncrona:

- Compromisso criado → notificar o contato por e-mail/SMS
- Lembrete de compromisso (X horas antes) → push notification
- Compromisso cancelado → notificar o contato
- Compromisso remarcado → notificar o contato com nova data

Precisávamos de uma solução de mensageria que:

1. **Desacoplasse** o processamento de notificações da API principal.
2. **Garantisse entrega** com mecanismo de retry e dead-letter queue.
3. **Permitisse múltiplos consumidores** para o mesmo evento (ex: envio de e-mail E registro de auditoria).
4. **Fosse operável localmente** sem dependência de serviços pagos durante o desenvolvimento.

---

## Decisão

Adotamos **RabbitMQ** como message broker do projeto, com **integração via AWS SQS** para o ambiente de produção (bridge RabbitMQ → SQS → Lambda).

---

## O que é RabbitMQ

RabbitMQ é um message broker open-source que implementa o protocolo AMQP (Advanced Message Queuing Protocol). Seus conceitos centrais são:

- **Producer:** Publica mensagens em um **Exchange**.
- **Exchange:** Roteia mensagens para uma ou mais **Queues** baseado em regras (bindings).
- **Queue:** Armazena mensagens até que um **Consumer** as processe.
- **Consumer:** Lê e processa mensagens de uma Queue.

### Tipos de Exchange utilizados

| Tipo | Comportamento | Uso no projeto |
|---|---|---|
| `topic` | Roteia por padrão de routing key (`agenda.appointment.*`) | Exchange principal `agenda.events` |
| `direct` | Roteia para queue com routing key exata | Dead Letter Exchange |
| `fanout` | Broadcast para todas as queues vinculadas | Notificações globais (futuro) |

---

## Arquitetura de Mensageria

### Fluxo principal

```
API Lambda
    │
    │  Publica evento de domínio
    ▼
Exchange: agenda.events (topic)
    │
    ├─── routing key: agenda.appointment.created  ──▶ Queue: appointment.notifications
    ├─── routing key: agenda.appointment.cancelled ──▶ Queue: appointment.notifications
    ├─── routing key: agenda.appointment.reminder  ──▶ Queue: appointment.reminders
    └─── routing key: agenda.appointment.*         ──▶ Queue: appointment.audit
```

### Dead Letter Queue (DLQ)

Mensagens que falham no processamento (após N tentativas) são movidas para a DLQ:

```
Queue: appointment.notifications
    │  (falha após 3 tentativas)
    ▼
Exchange: agenda.dlx (direct)
    │
    ▼
Queue: appointment.notifications.dlq  ←── Monitoramento e reprocessamento manual
```

### Bridge RabbitMQ → AWS SQS (produção)

Em produção, usamos um **Shovel** (plugin nativo do RabbitMQ) para encaminhar mensagens das queues para filas SQS, que por sua vez acionam Lambda functions:

```
RabbitMQ Queue ──[Shovel]──▶ AWS SQS Queue ──[trigger]──▶ Lambda Consumer
```

Isso permite:
- Usar RabbitMQ como broker central (com UI de gerenciamento, routing avançado)
- Aproveitar SQS → Lambda trigger nativo da AWS (sem necessidade de manter workers persistentes)

---

## Padrão de Eventos de Domínio

Cada evento segue uma estrutura padronizada:

```typescript
interface DomainEvent {
  eventId: string         // UUID único do evento
  eventType: string       // ex: "appointment.created"
  aggregateId: string     // ID da entidade que gerou o evento
  aggregateType: string   // ex: "Appointment"
  occurredAt: string      // ISO 8601
  version: number         // versionamento do schema
  payload: unknown        // dados específicos do evento
}
```

### Exemplo — AppointmentCreatedEvent

```json
{
  "eventId": "evt-7f3a9b2c",
  "eventType": "appointment.created",
  "aggregateId": "appt-456",
  "aggregateType": "Appointment",
  "occurredAt": "2026-06-06T09:00:00Z",
  "version": 1,
  "payload": {
    "title": "Reunião de alinhamento",
    "startDate": "2026-06-15T10:00:00Z",
    "contactId": "contact-789",
    "userId": "user-123"
  }
}
```

---

## Por que RabbitMQ?

### 1. Routing avançado com Topic Exchange

O sistema de agenda tem múltiplos tipos de notificação com consumidores diferentes. O `topic` exchange do RabbitMQ permite rotear `agenda.appointment.*` para o serviço de notificações e `agenda.appointment.created` especificamente para o onboarding de contatos — sem alterar o código do producer.

### 2. Garantia de entrega (At-Least-Once)

RabbitMQ usa **acknowledgements** (acks): a mensagem só é removida da queue após o consumer confirmar que processou com sucesso. Se o consumer falhar, a mensagem volta para a queue automaticamente.

### 3. Interface de gerenciamento

RabbitMQ Management Plugin oferece UI web para:
- Monitorar filas em tempo real
- Inspecionar mensagens enfileiradas
- Reprocessar mensagens da DLQ
- Visualizar throughput e métricas

Isso reduz significativamente o tempo de diagnóstico em produção.

### 4. Ambiente de desenvolvimento simples

```bash
docker-compose up -d rabbitmq
# UI disponível em http://localhost:15672
```

Nenhuma dependência externa ou custo durante o desenvolvimento.

### 5. Protocol AMQP maduro

RabbitMQ implementa AMQP 0-9-1 — protocolo binário eficiente, com suporte em praticamente todas as linguagens. A biblioteca `amqplib` para Node.js é madura e bem mantida.

---

## Tradeoffs

| Tradeoff | Mitigação |
|---|---|
| **RabbitMQ não é serverless nativo** | Bridge via SQS Shovel em produção. RabbitMQ em EC2 ou Amazon MQ (gerenciado) |
| **Necessidade de manter o broker ativo** | Amazon MQ (RabbitMQ gerenciado) elimina o overhead operacional em produção |
| **Ordenação de mensagens** | Não garantida por padrão. Para processos que exigem ordem, usar Single Active Consumer |
| **Mensagens não persistem além do restart** por padrão | Filas e mensagens configuradas como `durable: true` e `persistent: true` |

---

## Configuração de Filas

```typescript
// Queue: appointment.notifications
{
  durable: true,                      // sobrevive ao restart do broker
  deadLetterExchange: 'agenda.dlx',   // DLQ após falhas
  deadLetterRoutingKey: 'appointment.notifications.failed',
  messageTtl: 86400000,              // 24h de TTL máximo
  maxLength: 100000                   // limite de backpressure
}

// Mensagem
{
  persistent: true,                   // persiste em disco (sobrevive a crash)
  contentType: 'application/json'
}
```

---

## Retry Policy

O retry é implementado com **exponential backoff** usando Dead Letter Exchange + TTL:

```
Tentativa 1 (falha) ──▶ DLX com TTL 5s ──▶ Re-enfileira
Tentativa 2 (falha) ──▶ DLX com TTL 30s ──▶ Re-enfileira
Tentativa 3 (falha) ──▶ DLX com TTL 5min ──▶ Re-enfileira
Tentativa 4 (falha) ──▶ Queue DLQ final (requer intervenção manual)
```

---

## Alternativas consideradas

### AWS SQS + SNS (puro)
**Considerado como alternativa principal.** SQS/SNS é serverless-native e sem custo de gerenciamento. **Rejeitado como broker principal** porque:
- SNS não tem routing por padrão de routing key (apenas por atributo de mensagem — menos flexível)
- Sem interface de gerenciamento visual nativa comparável ao RabbitMQ Management
- Sem suporte a Dead Letter com retry automático baseado em TTL (SQS tem visibility timeout, mas não é o mesmo)

SQS é usado como **bridge de entrega** para acionar Lambdas consumidoras — o melhor dos dois mundos.

### Apache Kafka
**Rejeitado** pelo overhead operacional e por ser over-engineering para o volume atual. Kafka brilha em streaming de alto volume (milhões de eventos/segundo) e event sourcing completo. Para o volume de uma agenda, RabbitMQ é mais simples e adequado.

### AWS EventBridge
**Complementar, não substituto.** EventBridge é excelente para integração entre serviços AWS com regras de filtragem. Pode ser adicionado no futuro para integrações com serviços externos (envio de e-mail via SES, por exemplo).

---

## Referências

- [RabbitMQ Tutorials](https://www.rabbitmq.com/tutorials)
- [AMQP Concepts](https://www.rabbitmq.com/tutorials/amqp-concepts.html)
- [Amazon MQ for RabbitMQ](https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/working-with-rabbitmq.html)
- [RabbitMQ Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)
- [amqplib — Node.js AMQP client](https://amqp-node.github.io/amqplib/)
