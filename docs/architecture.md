# Decisão de Arquitetura — Clean Architecture

**Status:** Aceito  
**Data:** 2026-06-06  
**Autor:** Thiago Tierre  

---

## Contexto

Ao iniciar o projeto de Agenda API, precisávamos escolher uma abordagem arquitetural que atendesse aos seguintes requisitos:

1. O sistema precisa ser **testável** de forma isolada, sem depender de infraestrutura real nos testes de unidade.
2. As regras de negócio precisam ser **independentes** de frameworks, banco de dados e provedores de cloud.
3. A equipe deve conseguir **trocar ou evoluir** a infraestrutura (ex: migrar de DynamoDB para Aurora, ou de RabbitMQ para Kafka) sem reescrever as regras de negócio.
4. O código precisa ser **legível e navegável** para novos membros de equipe.

---

## Decisão

Adotamos **Clean Architecture** (Robert C. Martin, 2012) como padrão arquitetural do projeto.

---

## O que é Clean Architecture

Clean Architecture é um conjunto de princípios que organiza o código em **camadas concêntricas**, onde a regra fundamental é:

> **As dependências de código-fonte só podem apontar para dentro — em direção às políticas de alto nível.**

Isso significa que camadas externas (frameworks, banco de dados, UI) conhecem as camadas internas, mas as camadas internas nunca conhecem as externas.

### As quatro camadas

```
                    ┌──────────────────────────────────┐
                    │         Interfaces Layer          │
                    │   (Lambda, HTTP, CLI, Workers)    │
               ┌────┴──────────────────────────────────┴────┐
               │           Infrastructure Layer             │
               │    (DynamoDB, RabbitMQ, AWS SDK, Cache)    │
          ┌────┴────────────────────────────────────────────┴────┐
          │                  Application Layer                   │
          │           (Use Cases, Ports, DTOs, Services)         │
     ┌────┴────────────────────────────────────────────────────────┴────┐
     │                        Domain Layer                              │
     │          (Entities, Value Objects, Domain Events, Rules)         │
     └──────────────────────────────────────────────────────────────────┘
```

#### 1. Domain Layer (núcleo)
- Contém as **entidades** do negócio e suas regras intrínsecas.
- Contém **Value Objects** (objetos imutáveis que representam conceitos do domínio).
- Contém os **eventos de domínio** que representam fatos ocorridos.
- Define as **interfaces dos repositórios** (sem implementação).
- **Não depende de nada externo** — zero imports de bibliotecas de terceiros.

#### 2. Application Layer
- Orquestra os casos de uso do sistema (ex: `CreateAppointment`, `CancelAppointment`).
- Define **interfaces (ports)** para serviços externos como mensageria e notificações.
- Contém **DTOs** para transferência de dados entre camadas.
- Depende apenas do Domain Layer.

#### 3. Infrastructure Layer
- **Implementa** as interfaces definidas na Application Layer (Dependency Inversion Principle).
- Contém toda a lógica técnica: acesso ao DynamoDB, publicação no RabbitMQ, chamadas de API externa.
- Depende do Application Layer (para as interfaces) e do Domain Layer (para as entidades).

#### 4. Interfaces Layer
- Adaptadores que convertem dados do mundo externo para o formato que os use cases esperam.
- Lambda handlers, controllers HTTP, CLI commands pertencem aqui.
- Depende do Application Layer (para invocar use cases).

---

## Por que Clean Architecture?

### 1. Testabilidade

Com as regras de negócio isoladas no Domain e Application layers, podemos testar um use case como `CreateAppointment` injetando repositórios em memória — sem precisar de uma conexão real com DynamoDB ou RabbitMQ.

```typescript
// Teste unitário: nenhuma infraestrutura necessária
const repo = new InMemoryAppointmentRepository()
const publisher = new InMemoryEventPublisher()
const useCase = new CreateAppointmentUseCase(repo, publisher)
const result = await useCase.execute(input)
expect(result.isRight()).toBe(true)
```

### 2. Independência de Framework

A lógica de negócio não sabe se está rodando em uma Lambda, em um servidor Express, ou num worker de fila. O mesmo use case pode ser chamado por um handler Lambda ou por um teste CLI.

### 3. Independência de Banco de Dados

O repositório é uma **interface no domínio**. A implementação concreta (DynamoDB) fica na infraestrutura. Podemos adicionar uma implementação PostgreSQL amanhã sem tocar em nenhuma regra de negócio.

```
IAppointmentRepository (domain)  ←──── DynamoAppointmentRepository (infrastructure)
                                  ←──── InMemoryAppointmentRepository (tests)
```

### 4. Legibilidade por intenção

A estrutura de pastas reflete a linguagem do domínio:

```
src/application/use-cases/appointment/
  CreateAppointment.ts
  CancelAppointment.ts
  RescheduleAppointment.ts
```

Qualquer desenvolvedor consegue entender **o que o sistema faz** sem precisar ler implementações.

### 5. Facilidade de escalar a equipe

Times podem trabalhar em paralelo em camadas distintas com pouco risco de conflito:
- Time A trabalha em novos use cases (Application Layer)
- Time B otimiza queries DynamoDB (Infrastructure Layer)
- Time C adiciona novos endpoints (Interfaces Layer)

---

## Tradeoffs e como mitigamos

| Tradeoff | Mitigação |
|---|---|
| **Verbosidade inicial** — mais arquivos e interfaces para criar | Geradores de código (`npm run generate:usecase`) e templates padronizados |
| **Curva de aprendizado** — desenvolvedores precisam entender o padrão | Documentação (este arquivo), onboarding guiado e pair programming |
| **Over-engineering para MVPs** | Para casos simples, use cases podem ser lightweight — não há obrigação de criar todos os abstractions |
| **Mapeamento entre camadas** — conversão de tipos entre DTOs e entidades | Mappers centralizados e bem testados na `interfaces/mappers/` |

---

## Princípios SOLID aplicados

| Princípio | Onde se manifesta |
|---|---|
| **S** — Single Responsibility | Cada use case tem exatamente uma responsabilidade |
| **O** — Open/Closed | Novos casos de uso estendem sem modificar os existentes |
| **L** — Liskov Substitution | Qualquer implementação de `IAppointmentRepository` é substituível |
| **I** — Interface Segregation | `IAppointmentRepository` separa leitura de escrita com interfaces específicas |
| **D** — Dependency Inversion | Use cases dependem de abstrações (interfaces), não de implementações concretas |

---

## Alternativas consideradas

### Layered Architecture (MVC tradicional)
**Rejeitado** porque permite que regras de negócio vазotem através das camadas, acoplando-as ao framework e ao banco de dados. Dificulta testes unitários e evolução independente.

### Hexagonal Architecture (Ports & Adapters)
**Muito similar** à Clean Architecture — ambas implementam Dependency Inversion com ports/adapters. Optamos pela nomenclatura de Clean Architecture por ser mais didática e difundida na comunidade Node.js.

### Feature-based Architecture (Feature Folders)
**Rejeitado** como estrutura principal porque organizar por feature tende a misturar responsabilidades dentro de cada feature. Pode ser combinado com Clean Architecture para projetos maiores (módulos por domínio + Clean Architecture dentro de cada módulo).

---

## Referências

- [Clean Architecture — Robert C. Martin (2017)](https://www.amazon.com/Clean-Architecture-Craftsmans-Software-Structure/dp/0134494164)
- [The Clean Architecture — blog.cleancoder.com](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Implementing Clean Architecture with Node.js — Enterprise Patterns](https://khalilstemmler.com/articles/software-design-architecture/domain-driven-design-intro/)
