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

```json
{
  "_id": "...",
  "cropName": "Alface Crespa",
  "cropCategory": "Folhosa",
  "status": "AVAILABLE",
  "plantingDate": "2026-10-01",
  "expectedHarvestDate": "2026-11-15",
  "actualHarvestDate": null,
  "quantity": 30,
  "availableQuantity": 30,
  "reservedQuantity": 0,
  "unit": "unidade",
  "notes": "Cultivo orgânico",
  "createdBy": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

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

Visualização mensal.

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

O sistema deverá utilizar Socket.IO para manter todos os clientes sincronizados.

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

Utilizado para:

```text
Novas Colheitas

Atualização de Reservas

Atualização de Estoque

Notificações

Telemetria
```

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

Visualizar Relatórios
```

---

## Colaborador

Pode:

```text
Cadastrar Colheitas

Atualizar Status

Registrar Entregas

Visualizar Relatórios
```

---

## Voluntário

Pode:

```text
Visualizar Produção

Consultar Colheitas

Consultar Relatórios Básicos
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
GET    /harvests

GET    /harvests/:id

POST   /harvests

PUT    /harvests/:id

DELETE /harvests/:id
```

---

## Reservas

```text
POST   /reservations

GET    /reservations

GET    /reservations/my

PUT    /reservations/:id/cancel

PUT    /reservations/:id/deliver
```

---

## Dashboard

```text
GET /harvests/dashboard

GET /harvests/statistics

GET /harvests/calendar

GET /harvests/reports
```

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
