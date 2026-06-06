# Diagramas de Arquitetura — Agenda API

Este documento contém os diagramas de fluxo e arquitetura do sistema em formato Mermaid.

---

## 1. Visão Geral da Arquitetura do Sistema

```mermaid
graph TB
    subgraph Client["Cliente"]
        APP["Mobile / Web App"]
    end

    subgraph AWS["AWS Cloud"]
        subgraph API["API Layer"]
            APIGW["API Gateway"]
        end

        subgraph Compute["Compute — AWS Lambda"]
            L_CREATE["λ createAppointment"]
            L_LIST["λ listAppointments"]
            L_GET["λ getAppointment"]
            L_UPDATE["λ updateAppointment"]
            L_DELETE["λ deleteAppointment"]
            L_CONTACT["λ contacts (CRUD)"]
            L_NOTIFY["λ processNotification"]
            L_REMINDER["λ sendReminders (cron)"]
        end

        subgraph Storage["Storage"]
            DYNAMO[("DynamoDB\nagenda-{stage}")]
        end

        subgraph Queue["Messaging Bridge"]
            SQS_NOTIFY["SQS\nappointment-notifications"]
            SQS_REMINDER["SQS\nappointment-reminders"]
        end

        subgraph Observability["Observability"]
            CW["CloudWatch\nLogs + Metrics"]
            XRAY["X-Ray\nTracing"]
        end
    end

    subgraph Messaging["Messaging — RabbitMQ (Amazon MQ)"]
        EXCHANGE["Exchange\nagenda.events (topic)"]
        Q_NOTIFY["Queue\nappointment.notifications"]
        Q_AUDIT["Queue\nappointment.audit"]
        Q_DLQ["Queue DLQ\nappointment.notifications.dlq"]
    end

    APP --> APIGW
    APIGW --> L_CREATE & L_LIST & L_GET & L_UPDATE & L_DELETE & L_CONTACT

    L_CREATE & L_UPDATE & L_DELETE --> DYNAMO
    L_LIST & L_GET --> DYNAMO
    L_CONTACT --> DYNAMO

    L_CREATE & L_UPDATE & L_DELETE --> EXCHANGE
    EXCHANGE --> Q_NOTIFY & Q_AUDIT
    Q_NOTIFY -->|"Shovel"| SQS_NOTIFY
    SQS_NOTIFY --> L_NOTIFY
    Q_NOTIFY -->|"falha 3x"| Q_DLQ

    L_REMINDER -->|"rate(15min)"| DYNAMO
    L_REMINDER --> EXCHANGE

    L_CREATE & L_LIST & L_NOTIFY & L_REMINDER --> CW
    L_CREATE & L_NOTIFY --> XRAY
```

---

## 2. Clean Architecture — Dependências entre Camadas

```mermaid
graph LR
    subgraph Interfaces["Interfaces Layer"]
        HANDLER["Lambda Handler\nappointment.ts"]
        MAPPER["Mapper\nAppointmentMapper"]
    end

    subgraph Application["Application Layer"]
        UC["Use Case\nCreateAppointment"]
        PORT_REPO["Port\nIAppointmentRepository"]
        PORT_MSG["Port\nIMessagePublisher"]
        DTO["DTO\nCreateAppointmentDTO"]
    end

    subgraph Domain["Domain Layer"]
        ENTITY["Entity\nAppointment"]
        VO["Value Object\nAppointmentStatus"]
        EVENT["Domain Event\nAppointmentCreatedEvent"]
        IREPO["Interface\nIAppointmentRepository"]
    end

    subgraph Infrastructure["Infrastructure Layer"]
        DYNAMO_REPO["DynamoAppointmentRepository"]
        RABBIT_PUB["RabbitMQPublisher"]
    end

    HANDLER --> MAPPER
    HANDLER --> UC
    MAPPER --> DTO
    MAPPER --> ENTITY

    UC --> PORT_REPO
    UC --> PORT_MSG
    UC --> ENTITY
    UC --> EVENT

    PORT_REPO --> IREPO
    ENTITY --> VO

    DYNAMO_REPO -.->|"implements"| IREPO
    RABBIT_PUB -.->|"implements"| PORT_MSG

    style Domain fill:#1a1a2e,color:#eee,stroke:#4a90d9
    style Application fill:#16213e,color:#eee,stroke:#4a90d9
    style Infrastructure fill:#0f3460,color:#eee,stroke:#4a90d9
    style Interfaces fill:#533483,color:#eee,stroke:#a855f7
```

---

## 3. Fluxo — Criar Compromisso (Happy Path)

```mermaid
sequenceDiagram
    autonumber
    participant Client as Cliente
    participant APIGW as API Gateway
    participant Lambda as λ createAppointment
    participant UC as CreateAppointment UseCase
    participant Repo as DynamoAppointmentRepository
    participant DB as DynamoDB
    participant Pub as RabbitMQPublisher
    participant MQ as RabbitMQ Exchange

    Client->>APIGW: POST /appointments
    APIGW->>Lambda: Invoca handler com APIGatewayEvent

    Lambda->>Lambda: Valida body (Zod schema)
    Lambda->>UC: execute(CreateAppointmentDTO)

    UC->>UC: Cria entidade Appointment
    UC->>UC: Valida regras de negócio
    UC->>Repo: save(appointment)
    Repo->>DB: PutItem (PK: USER#{userId}, SK: APPOINTMENT#{id})
    DB-->>Repo: OK
    Repo-->>UC: appointment salvo

    UC->>UC: Cria AppointmentCreatedEvent
    UC->>Pub: publish(event, "agenda.appointment.created")
    Pub->>MQ: Publica na exchange com routing key
    MQ-->>Pub: ACK

    UC-->>Lambda: Right(AppointmentDTO)
    Lambda-->>APIGW: HTTP 201 { appointment }
    APIGW-->>Client: 201 Created
```

---

## 4. Fluxo — Processar Notificação (Consumer Lambda)

```mermaid
sequenceDiagram
    autonumber
    participant MQ as RabbitMQ Queue
    participant Shovel as RabbitMQ Shovel
    participant SQS as AWS SQS
    participant Lambda as λ processNotification
    participant UC as ProcessNotificationUseCase
    participant Repo as DynamoAppointmentRepository
    participant DB as DynamoDB
    participant Notif as NotificationService

    MQ->>Shovel: Mensagem disponível
    Shovel->>SQS: Forward mensagem
    SQS->>Lambda: Trigger com batch de mensagens

    loop Para cada mensagem no batch
        Lambda->>Lambda: Parse e valida DomainEvent
        Lambda->>UC: execute(event)
        UC->>Repo: findById(appointmentId)
        Repo->>DB: GetItem
        DB-->>Repo: Item
        Repo-->>UC: Appointment
        UC->>Notif: sendNotification(appointment, eventType)
        Notif-->>UC: OK
        UC-->>Lambda: Right(void)
        Lambda->>Lambda: Marca mensagem como processada (ACK)
    end

    Lambda-->>SQS: Relatório de falhas (ReportBatchItemFailures)
    Note over Lambda,SQS: Mensagens que falharam voltam para a fila automaticamente
```

---

## 5. Fluxo — Lembrete Automático (Cron)

```mermaid
sequenceDiagram
    autonumber
    participant Cron as EventBridge (rate 15min)
    participant Lambda as λ sendReminders
    participant UC as SendRemindersUseCase
    participant Repo as DynamoAppointmentRepository
    participant DB as DynamoDB
    participant Pub as RabbitMQPublisher
    participant MQ as RabbitMQ

    Cron->>Lambda: Invoca com ScheduledEvent
    Lambda->>UC: execute()
    UC->>Repo: findAppointmentsInTimeRange(now + 1h, now + 1h15min)
    Repo->>DB: Query GSI userId-startDate-index
    DB-->>Repo: Lista de appointments
    Repo-->>UC: Appointment[]

    loop Para cada appointment
        UC->>UC: Verifica se lembrete já foi enviado
        UC->>Pub: publish(ReminderEvent, "agenda.appointment.reminder")
        Pub->>MQ: Publica evento
        UC->>Repo: markReminderSent(appointmentId)
        Repo->>DB: UpdateItem (reminderSentAt = now)
    end

    UC-->>Lambda: Right({ processed: N })
    Lambda-->>Cron: OK (exit 0)
```

---

## 6. Fluxo — Dead Letter Queue (Tratamento de Falhas)

```mermaid
flowchart TD
    MSG["Mensagem publicada\nno Exchange"] --> QUEUE["Queue\nappointment.notifications"]
    QUEUE --> CONSUMER["λ processNotification"]

    CONSUMER --> SUCCESS{"Processamento\nbem-sucedido?"}
    SUCCESS -->|Sim| ACK["ACK — mensagem\nremovida da fila"]
    SUCCESS -->|Não| NACK["NACK — mensagem\nvolta para a fila"]

    NACK --> RETRY_COUNT{"Tentativas\n≥ 3?"}
    RETRY_COUNT -->|Não| QUEUE
    RETRY_COUNT -->|Sim| DLX["Dead Letter Exchange\nagenda.dlx"]
    DLX --> DLQ["Dead Letter Queue\nappointment.notifications.dlq"]

    DLQ --> ALERT["CloudWatch Alarm\n(DLQ depth > 0)"]
    ALERT --> SLACK["Alerta no Slack\n/ PagerDuty"]
    DLQ --> MANUAL["Reprocessamento\nManual via UI\nRabbitMQ Management"]

    style DLQ fill:#7f1d1d,color:#fff
    style ALERT fill:#78350f,color:#fff
    style ACK fill:#14532d,color:#fff
```

---

## 7. Modelagem de Dados — Single-Table Design DynamoDB

```mermaid
erDiagram
    DYNAMO_TABLE {
        string PK "Partition Key"
        string SK "Sort Key"
        string GSI1PK "GSI1 Partition Key (userId)"
        string GSI1SK "GSI1 Sort Key (startDate)"
        string entityType "APPOINTMENT | CONTACT"
        string id
        string userId
        string status
        string createdAt
        string updatedAt
    }

    APPOINTMENT_ITEM {
        string PK "USER#{userId}"
        string SK "APPOINTMENT#{id}"
        string GSI1PK "userId"
        string GSI1SK "startDate (ISO 8601)"
        string title
        string description
        string startDate
        string endDate
        string status "SCHEDULED|COMPLETED|CANCELLED"
        string contactId
        boolean reminderSent
        string reminderSentAt
    }

    CONTACT_ITEM {
        string PK "USER#{userId}"
        string SK "CONTACT#{id}"
        string name
        string email
        string phone
    }

    DYNAMO_TABLE ||--o{ APPOINTMENT_ITEM : "contém"
    DYNAMO_TABLE ||--o{ CONTACT_ITEM : "contém"
```

---

## 8. Estrutura de Pastas do Projeto

```mermaid
graph TD
    ROOT["clean-arch-node/"]

    ROOT --> SRC["src/"]
    ROOT --> DOCS["docs/"]
    ROOT --> TESTS["tests/"]
    ROOT --> CONFIG["Configurações\nserverless.yml, package.json,\ntsconfig.json, docker-compose.yml"]

    SRC --> DOMAIN["domain/\n(regras de negócio puras)"]
    SRC --> APPLICATION["application/\n(orquestração)"]
    SRC --> INFRA["infrastructure/\n(detalhes técnicos)"]
    SRC --> INTERFACES["interfaces/\n(adaptadores)"]

    DOMAIN --> D_ENTITIES["entities/\nAppointment.ts\nContact.ts"]
    DOMAIN --> D_VO["value-objects/\nAppointmentStatus.ts\nDateRange.ts"]
    DOMAIN --> D_REPOS["repositories/\nIAppointmentRepository.ts\nIContactRepository.ts"]
    DOMAIN --> D_EVENTS["events/\nAppointmentCreatedEvent.ts\nAppointmentReminderEvent.ts"]

    APPLICATION --> A_UC["use-cases/\nappointment/ | contact/"]
    APPLICATION --> A_PORTS["interfaces/\nIMessagePublisher.ts"]
    APPLICATION --> A_DTOS["dtos/\nAppointmentDTO.ts"]

    INFRA --> I_DB["database/dynamodb/\nDynamoAppointmentRepository.ts"]
    INFRA --> I_MQ["messaging/rabbitmq/\nRabbitMQPublisher.ts\nRabbitMQConsumer.ts"]
    INFRA --> I_DI["container/\nDIContainer.ts"]

    INTERFACES --> IF_LAMBDA["lambda/handlers/\nappointment.ts\ncontact.ts\nnotification.ts"]
    INTERFACES --> IF_MAPPERS["mappers/\nAppointmentMapper.ts"]

    style DOMAIN fill:#1a1a2e,color:#eee
    style APPLICATION fill:#16213e,color:#eee
    style INFRA fill:#0f3460,color:#eee
    style INTERFACES fill:#533483,color:#eee
```
