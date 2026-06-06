# Decisão de Banco de Dados — Amazon DynamoDB

**Status:** Aceito  
**Data:** 2026-06-06  
**Autor:** Thiago Tierre  

---

## Contexto

O projeto roda em AWS Lambda (serverless). Precisávamos de um banco de dados que:

1. **Não exija gerenciamento de conexões** — Lambda escala horizontalmente criando e destruindo instâncias; bancos relacionais sofrem com connection pool exhaustion nesse modelo.
2. **Escale automaticamente** com o tráfego sem configuração manual.
3. **Tenha latência previsível** em operações de leitura e escrita por chave primária (operações core do sistema de agenda).
4. **Integre nativamente** com o ecossistema AWS (IAM, VPC, CloudWatch, Streams).
5. **Suporte o modelo de acesso** do sistema: leitura por ID e listagem por usuário/data.

---

## Decisão

Adotamos **Amazon DynamoDB** como banco de dados principal do projeto.

---

## O que é DynamoDB

DynamoDB é um banco de dados NoSQL totalmente gerenciado pela AWS, baseado em tabelas de chave-valor com suporte a documentos JSON. Opera no modelo **key-value + document store** com dois tipos de chaves:

- **Partition Key (PK):** Distribui os dados entre partições físicas. Determina onde o item é armazenado.
- **Sort Key (SK):** Ordena os itens dentro de uma partição. Permite consultas de intervalo.

---

## Por que DynamoDB?

### 1. Modelo serverless-native

DynamoDB opera no modo **on-demand** (pay-per-request): você paga apenas pelas leituras e escritas realizadas, sem provisionamento de capacidade. Isso se alinha perfeitamente com o modelo Lambda, onde os recursos também são provisionados por demanda.

Comparação com RDS (PostgreSQL/MySQL) em ambiente Lambda:

| Aspecto | DynamoDB | RDS |
|---|---|---|
| Connection pooling | Não necessário (HTTP/API) | Obrigatório (TCP connections) |
| Cold start | Sem impacto | Overhead de handshake TCP + TLS |
| Escala automática | Nativa (on-demand mode) | Requer Aurora Serverless ou RDS Proxy |
| Gerenciamento | Zero | Patches, backups, failover manual |
| Custo previsível | Por request | Por hora de instância + storage |

### 2. Latência de um dígito em milissegundos

Para o caso de uso de agenda (buscar compromisso por ID, listar compromissos do dia), DynamoDB garante latência < 10ms em operações por chave primária via partition key, o que é adequado para APIs REST síncronas.

### 3. Integração com DynamoDB Streams

DynamoDB Streams captura alterações nos itens (INSERT, MODIFY, REMOVE) e pode acionar Lambda functions diretamente. Isso permite implementar **event sourcing leve** e reagir a mudanças de estado sem polling.

### 4. IAM-native

Permissões granulares por tabela, operação e até por item (via condition expressions) usando IAM Roles. Lambda assume um IAM Role automaticamente — sem credenciais estáticas no código.

---

## Modelagem de Dados

DynamoDB exige que o **padrão de acesso seja definido antes da modelagem** (diferente de bancos relacionais onde a normalização vem primeiro).

### Padrões de acesso identificados

| # | Descrição | Frequência |
|---|---|---|
| A1 | Buscar compromisso por ID | Alta |
| A2 | Listar compromissos de um usuário por data | Alta |
| A3 | Buscar contato por ID | Média |
| A4 | Listar contatos de um usuário | Média |
| A5 | Buscar compromissos de um contato | Baixa |

### Estratégia: Single-Table Design

Utilizamos **Single-Table Design** — todas as entidades em uma única tabela DynamoDB. Isso maximiza a eficiência de queries e reduz custo (uma tabela = uma throughput capacity).

#### Tabela: `agenda-{stage}`

```
┌─────────────────────────┬───────────────────────────┬──────────────────────────────┐
│ PK                      │ SK                        │ Uso                          │
├─────────────────────────┼───────────────────────────┼──────────────────────────────┤
│ USER#{userId}           │ APPOINTMENT#{appointmentId}│ Compromisso de um usuário   │
│ USER#{userId}           │ CONTACT#{contactId}       │ Contato de um usuário        │
│ APPOINTMENT#{id}        │ METADATA                  │ Dados completos do compromisso│
│ CONTACT#{id}            │ METADATA                  │ Dados completos do contato   │
└─────────────────────────┴───────────────────────────┴──────────────────────────────┘
```

#### Global Secondary Index (GSI) para A2 — listagem por data

```
GSI: userId-startDate-index
  PK: userId
  SK: startDate (ISO 8601)
```

Permite queries como:
```
userId = "user-123" AND startDate BETWEEN "2026-06-01" AND "2026-06-30"
```

### Exemplo de item — Appointment

```json
{
  "PK": "USER#user-123",
  "SK": "APPOINTMENT#appt-456",
  "GSI1PK": "user-123",
  "GSI1SK": "2026-06-15T10:00:00Z",
  "id": "appt-456",
  "title": "Reunião de alinhamento",
  "description": "Sprint planning Q3",
  "startDate": "2026-06-15T10:00:00Z",
  "endDate": "2026-06-15T11:00:00Z",
  "status": "SCHEDULED",
  "contactId": "contact-789",
  "userId": "user-123",
  "createdAt": "2026-06-06T09:00:00Z",
  "updatedAt": "2026-06-06T09:00:00Z",
  "entityType": "APPOINTMENT"
}
```

---

## Estratégia de Acesso no Código

Seguindo Clean Architecture, o DynamoDB é **completamente isolado na Infrastructure Layer**:

```
Domain Layer
  └── IAppointmentRepository (interface)          ← Domínio não sabe nada de DynamoDB

Infrastructure Layer
  └── DynamoAppointmentRepository (implementação) ← Conhece DynamoDB SDK
```

O use case só conhece a interface:

```typescript
// Application Layer — use case não sabe que existe DynamoDB
class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,  // interface
  ) {}
}
```

---

## Tradeoffs

| Tradeoff | Contexto |
|---|---|
| **Sem JOINs nativos** | Resolvido com Single-Table Design e desnormalização controlada |
| **Queries flexíveis limitadas** | Acesso por PK+SK é rápido; queries complexas usam GSI ou DynamoDB Streams → ElasticSearch (se necessário no futuro) |
| **Curva de aprendizado** | Documentação, padrões estabelecidos neste documento |
| **Consistência eventual em GSIs** | Leituras em GSI podem ter delay de milissegundos. Aceitável para listagens, não para operações críticas |
| **Tamanho máximo de item: 400KB** | Adequado para dados de agenda; arquivos binários vão para S3 |

---

## Alternativas consideradas

### Amazon Aurora Serverless v2
**Rejeitado** para o contexto atual. Aurora Serverless resolve o problema de connection pooling mas ainda requer VPC, ainda tem cold start (~ segundos), custo base maior, e os benefícios de SQL relacional não se justificam para os padrões de acesso simples de uma agenda.

### MongoDB Atlas / DocumentDB
**Rejeitado** porque introduz dependência de serviço externo à AWS (Atlas) ou adiciona custo e complexidade de gerenciamento (DocumentDB), sem vantagem clara sobre DynamoDB para os padrões de acesso identificados.

### Amazon ElasticSearch / OpenSearch
**Complementar, não substituto.** Para busca full-text futura (buscar compromisso por palavra-chave no título), ElasticSearch pode ser adicionado como projeção lida via DynamoDB Streams. Não é necessário agora.

---

## Operações e Backups

| Aspecto | Configuração |
|---|---|
| Point-in-Time Recovery (PITR) | Habilitado — permite restaurar para qualquer segundo nos últimos 35 dias |
| Backups on-demand | Via `aws dynamodb create-backup` no pipeline CI/CD |
| Criptografia em repouso | Habilitada por padrão (AWS-managed key) |
| DynamoDB Streams | Habilitado (NEW_AND_OLD_IMAGES) para auditoria e triggers |
| TTL | Configurado no campo `expiresAt` para limpeza automática de dados temporários |

---

## Referências

- [DynamoDB Best Practices — AWS Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [The DynamoDB Book — Alex DeBrie](https://www.dynamodbbook.com/)
- [Single-Table Design — Rick Houlihan (re:Invent 2019)](https://www.youtube.com/watch?v=HaEPXoXVf2k)
- [DynamoDB Local — desenvolvimento sem custo](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
