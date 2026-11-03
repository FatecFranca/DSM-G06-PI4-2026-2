# Gestão de Colheitas da Plataforma Horta Comunitária

## Indice

```
Objetivo
Arquitetura
Modelo de Dados
Colheitas
Reservas
Fila de Espera
Dashboard
Mobile
Socket.IO
Notificações
Auditoria
Permissões
APIs
Evoluções Futuras
```

## Objetivo

O módulo de Gestão de Colheitas é a principal funcionalidade de negócio da plataforma Horta Comunitária.

Seu objetivo é controlar todo o ciclo produtivo da horta, desde o planejamento do cultivo até a entrega dos alimentos aos moradores da comunidade.

O sistema permitirá:

- Planejamento de cultivos;
- Acompanhamento da produção;
- Disponibilização de colheitas;
- Reservas pelos moradores;
- Controle de entregas;
- Indicadores gerenciais;
- Distribuição justa da produção;
- Histórico completo das colheitas.

---

# Arquitetura

```text
ESP32/Wokwi
      │
      ▼ MQTT
Mosquitto
      │
      ▼
Backend
      │
      ├── MongoDB
      ├── REST API
      └── Socket.IO
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
 React Web       Expo Mobile
```

O MongoDB será responsável pela persistência dos dados de produção, reservas, histórico e auditoria.

---

# Ciclo de Vida da Colheita

Toda colheita deverá possuir um fluxo de estados.

```text
PLANNED
    ↓
GROWING
    ↓
READY
    ↓
AVAILABLE
    ↓
RESERVED
    ↓
DELIVERED
```

Ou:

```text
CANCELLED
```

---

## Descrição dos Estados

Os estados persistidos atualmente são `planned`, `growing`, `ready`, `available`,
`reserved`, `delivered` e `cancelled`. A transição operacional é controlada por
administradores e colaboradores com `manage_harvests`. `reserved` representa
estoque reservado; a entrega individual é controlada pela entidade `Reservation`.

## Regras de datas

- A data do plantio representa a data real ou planejada do início do cultivo.
- O plantio pode estar no passado, no dia atual ou no futuro.
- A data prevista da colheita pode estar no passado para registrar histórico ou no futuro para planejar a produção.
- A única combinação inválida é o plantio acontecer depois da colheita prevista.
- Para cultivos planejados, recomenda-se usar `PLANNED` quando o plantio ainda não começou e `GROWING` quando o cultivo já estiver em andamento.

### PLANNED

Plantio planejado.

Exemplo:

```text
Alface Crespa
Plantio previsto: 10/11/2026
```

---

### GROWING

Cultivo em desenvolvimento.

---

### READY

Produção pronta para colheita.

---

### AVAILABLE

Disponível para reserva.

---

### RESERVED

Quantidade total reservada.

---

### DELIVERED

Colheita totalmente entregue.

---

### CANCELLED

Produção cancelada.

Motivos possíveis:

- Pragas;
- Doenças;
- Fatores climáticos;
- Falha operacional.

---

# Modelo de Dados

## Harvest

Modelo persistido atualmente no MongoDB:

```json
{
  "_id": "...",
  "id": "harvest-...",
  "crop": "Alface Crespa",
  "category": "leafy",
  "status": "available",
  "plantingDate": "2026-10-01T08:00:00.000Z",
  "harvestDate": "2026-11-15T08:00:00.000Z",
  "quantity": 30,
  "availableQuantity": 20,
  "reservedQuantity": 10,
  "deliveredQuantity": 0,
  "unit": "unidade",
  "notes": "Cultivo orgânico",
  "available": true,
  "createdBy": "..."
}
```

Campos legados de reserva podem existir para compatibilidade, mas novas reservas
usam a coleção `reservations` e o modelo `Reservation`.

## Reservation

```json
{
  "_id": "...",
  "harvestId": "...",
  "harvestCode": "harvest-...",
  "userId": "...",
  "quantity": 2,
  "status": "active",
  "reservedAt": "...",
  "cancelledAt": null,
  "deliveredAt": null
}
```

Status persistidos de reserva:

```text
active
cancelled
expired
delivered
```

O MongoDB mantém histórico de reservas canceladas e entregues. A regra de
integridade `one_active_reservation_per_user` impede mais de uma reserva ativa
do mesmo usuário para a mesma colheita.

---

# Categorias de Produção

```text
Folhosas
Legumes
Frutas
Temperos
Medicinais
Outros
```

Exemplos:

```text
Alface
Rúcula
Couve
```

```text
Cebolinha
Salsinha
Manjericão
```

```text
Tomate
Pepino
Abobrinha
```

---

# Controle de Estoque

Cada colheita mantém:

```text
Quantidade Produzida
Quantidade Disponível
Quantidade Reservada
Quantidade Entregue
```

Exemplo:

```text
Produção: 30

Disponíveis: 20

Reservadas: 10

Entregues: 0
```

---

# Reservas

Moradores poderão reservar produtos disponíveis.

Fluxo:

```text
Visualizar Colheita

↓

Selecionar Produto

↓

Escolher Quantidade

↓

Confirmar Reserva

↓

Gerar Reserva
```

---

## Modelo Reservation

```json
{
  "_id": "...",
  "harvestId": "...",
  "userId": "...",
  "quantity": 2,
  "status": "ACTIVE",
  "reservationDate": "...",
  "deliveryDate": null
}
```

---

# Status da Reserva

```text
ACTIVE

CANCELLED

EXPIRED

DELIVERED
```

---

# Regras de Distribuição

## Limite por Usuário

Exemplo:

```text
Máximo:
2 unidades por produto
```

ou

```text
5 kg por usuário
```

Configuração definida pelo administrador.

---

## Distribuição Justa

Objetivo:

Evitar concentração da produção em poucos moradores.

Exemplo:

```text
Produção:
20 alfaces

Limite:
2 por morador
```

Resultado:

Maior alcance social.

---

# Lista de Espera

Quando a quantidade disponível for esgotada:

```text
WAITING LIST
```

Fluxo:

```text
Produto esgotado

↓

Entrar na fila

↓

Aguardar vaga
```

Caso haja cancelamento:

```text
Primeiro da fila

↓

Recebe oportunidade de reserva
```

---

# Calendário de Colheitas

Visualização mensal implementada no painel web e consulta resumida no mobile.

Exemplo:

```text
Novembro

10 - Alface

15 - Cebolinha

18 - Couve

25 - Rúcula
```

Objetivos:

- Planejamento;
- Divulgação;
- Transparência.

---

# Dashboard de Colheitas

## Indicadores Operacionais

```text
Produção Total

Itens Disponíveis

Itens Reservados

Itens Entregues

Perdas
```

---

## Indicadores Mensais

```text
Produção Total

Número de Colheitas

Número de Reservas

Moradores Atendidos
```

---

## Indicadores por Cultura

```text
Alface

Couve

Cebolinha

Tomate
```

Visualizações:

```text
Produção

Reservas

Entregas

Perdas
```

---

# Atualizações em Tempo Real

O sistema utiliza Socket.IO para manter todos os clientes sincronizados.

---

## Eventos Existentes

```text
telemetry:update

status:update
```

---

## Eventos de Colheitas

### harvest:created

Nova colheita cadastrada.

---

### harvest:updated

Colheita atualizada.

---

### harvest:statusChanged

Mudança de estado.

Exemplo:

```text
GROWING

↓

READY

↓

AVAILABLE
```

---

### harvest:available

Nova colheita disponível.

---

## Eventos de Reserva

### reservation:created

Nova reserva.

---

### reservation:cancelled

Reserva cancelada.

---

### reservation:delivered

Entrega concluída.

---

## Eventos de Lista de Espera

Os eventos de lista de espera abaixo permanecem planejados e ainda não são
emitidos pelo backend.

### waitingList:newPosition

Usuário entrou na fila.

---

### waitingList:promotion

Usuário promovido para reserva disponível.

---

# Aplicativo Mobile

O aplicativo Expo utilizará a mesma arquitetura do sistema Web.

---

## REST API

Utilizada para:

```text
Login

Cadastro

Consultar Colheitas

Reservar Produtos

Consultar Histórico
```

---

## Socket.IO

Utilizado atualmente para:

```text
Novas Colheitas

Atualização de Reservas

Atualização de Estoque

Telemetria
```

O mobile atualiza a tela de colheitas ao receber eventos de criação, atualização,
mudança de status e alterações de reserva. Push notifications ainda não estão
implementadas.

---

## Dashboard Mobile

Fluxo:

### Inicial

```text
GET /harvests

GET /telemetry/history
```

---

### Tempo Real

```text
Socket.IO
```

Atualizando automaticamente:

```text
Disponibilidade

Reservas

Telemetria

Alertas
```

---

# Notificações

Eventos recomendados:

```text
Nova Colheita Disponível

Reserva Confirmada

Reserva Cancelada

Entrega Disponível

Cadastro Aprovado
```

---

## Web

```text
Socket.IO
```

---

## Mobile

```text
Push Notifications
```

(Evolução futura)

---

# Permissões

## Administrador

Pode:

```text
Criar Colheitas

Editar Colheitas

Excluir Colheitas

Gerenciar Reservas

Confirmar Entregas

Visualizar o dashboard operacional
```

---

## Colaborador

Pode:

```text
Cadastrar Colheitas

Atualizar Status

Registrar Entregas

Consultar o calendário operacional
```

---

## Voluntário

Pode:

```text
Visualizar Produção

Consultar Colheitas

Consultar disponibilidade conforme as permissões atribuídas
```

---

## Morador

Pode:

```text
Visualizar Disponibilidade

Reservar Produtos

Cancelar Reservas

Consultar Histórico
```

---

# APIs

## Colheitas

```text
GET    /harvest

GET    /harvest/:id

GET    /harvest/mine

GET    /harvest/calendar?from=<ISO>&to=<ISO>

POST   /harvest

PATCH  /harvest/:id

PATCH  /harvest/:id/status

DELETE /harvest/:id
```

---

## Reservas

```text
GET    /reservations

PATCH  /reservations/:id/status

PUT    /harvest/:id/reserve

PUT    /harvest/:id/cancel-reservation
```

`GET /reservations` retorna reservas ativas por padrão. `status=history` retorna
canceladas, entregues e expiradas; `status=all` retorna todo o histórico para a
interface administrativa.

---

## Dashboard

```text
GET /harvest/dashboard

GET /telemetry/history

GET /status
```

---

# Implementação atual

O backend mantém compatibilidade com as rotas legadas `/harvest` e expõe o fluxo integrado usado pelo web e pelo mobile:

```text
GET    /harvest
GET    /harvest/:id
GET    /harvest/mine
POST   /harvest
PATCH  /harvest/:id
PATCH  /harvest/:id/status
DELETE /harvest/:id
PUT    /harvest/:id/reserve
PUT    /harvest/:id/cancel-reservation
GET    /harvest/dashboard
GET    /reservations
PATCH  /reservations/:id/status
GET    /harvest/calendar?from=<ISO>&to=<ISO>
```

As reservas persistentes usam a entidade `Reservation`, vinculada ao usuário e à colheita. A atualização da disponibilidade é atômica no MongoDB, evitando reservar quantidade além do estoque em requisições concorrentes. As mudanças de colheita e reserva são publicadas por Socket.IO para atualizar as interfaces sem depender apenas de recarregamento manual.

O estoque é dividido em quantidade produzida, disponível, reservada e entregue. Reservas ativas podem ser canceladas pelo morador; administradores e colaboradores com a permissão correspondente podem confirmar a entrega ou cancelar a reserva pelo painel.

Cada usuário pode manter somente uma reserva ativa para cada colheita. O mobile e o web removem essa colheita da lista de disponíveis do próprio usuário e a exibem em "Minhas reservas". Uma nova reserva para a mesma colheita só pode ser feita depois do cancelamento da reserva anterior.

Na aplicação web, a seção "Colheitas" assume funções diferentes conforme o perfil:

- Administradores e colaboradores visualizam todas as colheitas, inclusive as que já possuem reservas, e podem administrar cadastro, edição, ciclo de status, exclusão e reservas.
- A área "Reservas da comunidade" mostra a cultura, o usuário, o e-mail, a quantidade, o status e permite confirmar entrega ou cancelar uma reserva, conforme a permissão.
- "Minhas reservas" é uma visão pessoal e mostra somente as reservas do usuário conectado, incluindo a quantidade reservada.
- Moradores e demais usuários sem permissão de gestão utilizam "Colheitas" para consultar disponibilidade e fazer reservas.

O dashboard administrativo atual cobre produção, estoque, reservas, confirmação de entrega, auditoria e atualização em tempo real. Permanecem como evoluções de módulo, e não devem ser considerados entregues apenas pelos indicadores atuais:

- fila de espera e promoção automática após cancelamentos;
- registro e indicadores de perdas;
- relatórios mensais e comparativos por cultura;
- notificações push para o mobile;
- etapas intermediárias de separação e pronta para retirada;
- prazo, local e responsável pela retirada;
- limites configuráveis de distribuição por usuário.

## Plano de evolução adotado

O painel web é a superfície administrativa para administradores e colaboradores. O aplicativo mobile permanece focado no morador e no colaborador em campo: consulta de disponibilidade, reservas, cancelamentos e acompanhamento de atualizações.

As reservas administrativas são separadas em:

- **Ativas**: reservas que ainda exigem separação, retirada ou confirmação de entrega;
- **Histórico**: reservas canceladas, entregues ou expiradas, preservadas para auditoria e relatórios.

Essa separação evita que o histórico operacional seja confundido com trabalho pendente e mantém a rastreabilidade sem apagar registros.

A API segue a mesma regra: `GET /reservations` retorna ativas por padrão; `status=history` retorna canceladas, entregues e expiradas; `status=all` é reservado para telas que precisam alternar entre as duas visões.

O próximo incremento funcional deve implementar, nesta ordem, fila de espera,
perdas e ajustes de estoque, fluxo de separação/retirada, relatórios e
notificações. Cada módulo deverá ter modelo persistente, API protegida, regras
de estado, auditoria e interface web/mobile antes de ser considerado concluído.

## Calendário operacional

O calendário usa os campos persistidos `plantingDate` e `harvestDate` de cada colheita como fonte única de verdade. Ele não cria uma coleção paralela nem duplica reservas:

- `GET /harvest/calendar?from=<ISO>&to=<ISO>` retorna eventos dentro do intervalo;
- cada evento é `planting` ou `harvest`;
- eventos carregam cultura, quantidade, unidade e status atual da colheita;
- o intervalo é fechado no início e aberto no fim (`from <= date < to`);
- datas inválidas ou intervalo invertido retornam `422`;
- o MongoDB possui índices para `plantingDate` e `harvestDate`.

No painel web, administradores e colaboradores navegam por mês e visualizam plantios e colheitas previstas. No mobile, moradores veem somente as próximas colheitas previstas, sem receber ações administrativas de produção.

## Status de entrega do módulo

| Capacidade | Situação |
|---|---|
| Cadastro, edição, exclusão e status de colheitas | Implementado |
| Datas de plantio e colheita com validação | Implementado |
| Quantidade produzida, disponível, reservada e entregue | Implementado |
| Reserva com quantidade | Implementado |
| Uma reserva ativa por usuário e colheita | Implementado |
| Cancelamento pelo morador | Implementado |
| Confirmação de entrega pelo gestor | Implementado |
| Reservas ativas e histórico administrativo | Implementado |
| Dashboard de produção e estoque | Implementado |
| Calendário operacional web | Implementado |
| Próximas colheitas no mobile | Implementado |
| Auditoria de operações críticas | Implementado parcialmente |
| Fila de espera | Planejado |
| Perdas e ajustes de estoque | Planejado |
| Separação, retirada e notificações push | Planejado |
| Relatórios gerenciais | Planejado |

O módulo é adequado para um piloto comunitário integrado. Para operação
profissional em escala, os itens planejados devem ser concluídos antes de
considerar o processo totalmente operacional.

---

# Auditoria

Todas as operações críticas deverão ser registradas.

Eventos:

```text
Criação de Colheita

Alteração de Quantidade

Reserva Criada

Reserva Cancelada

Entrega Confirmada
```

Modelo:

```json
{
  "userId": "...",
  "action": "CREATE_HARVEST",
  "entityId": "...",
  "timestamp": "...",
  "ip": "..."
}
```

---

# Integração Futura com IoT

A plataforma poderá relacionar:

```text
Temperatura

Umidade do Solo

Umidade do Ar

Tempo de Irrigação
```

com:

```text
Produção

Perdas

Produtividade
```

Permitir análises como:

```text
Qual cultura produz melhor?

Qual faixa de umidade gera maior produtividade?

Qual cultura possui menor perda?
```

---

# Evoluções Futuras

## QR Code

Cada colheita poderá possuir um QR Code.

Utilizações:

```text
Identificação

Rastreamento

Entrega
```

---

## Ranking Comunitário

Indicadores:

```text
Voluntários mais ativos

Moradores mais participativos
```

---

## Múltiplas Hortas

Suporte para:

```text
Horta Centro

Horta Norte

Horta Sul
```

utilizando a mesma plataforma.

---

# Conclusão

O módulo de Gestão de Colheitas representa a principal funcionalidade de negócio da plataforma Horta Comunitária.

A solução proposta integra Web, Mobile, MongoDB, Socket.IO e IoT para permitir o gerenciamento completo da produção agrícola comunitária, oferecendo rastreabilidade, transparência, distribuição justa dos alimentos e suporte à tomada de decisão através de informações em tempo real e dados históricos.
