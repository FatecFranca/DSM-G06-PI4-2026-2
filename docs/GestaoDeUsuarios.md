# Especificação Funcional e Arquitetural do Módulo de Gestão de Usuários

## Objetivo

Implementar uma solução completa de gestão de usuários para a plataforma Horta Comunitária, permitindo:

- Cadastro de usuários
- Solicitação de acesso à plataforma
- Aprovação administrativa
- Controle de permissões
- Controle de acesso por perfil
- Autenticação Web e Mobile
- Auditoria de ações
- Gestão futura das colheitas e reservas

Este módulo será a base para todas as funcionalidades multiusuário da plataforma.

---

# Motivação

Atualmente a plataforma funciona sem identificação formal dos usuários.

Para as próximas fases do projeto, especialmente:

- Gestão de colheitas
- Reservas
- Distribuição de alimentos
- Controle operacional
- Relatórios

torna-se necessário identificar quem está utilizando o sistema.

---

# Arquitetura

```text
Web App
     │
     │ HTTPS
     ▼
Backend API
     │
     ├── Auth
     ├── Users
     ├── Roles
     ├── Permissions
     └── Harvest Management
             │
             ▼
         MongoDB

Mobile Expo
     │
     └── HTTPS + Socket.IO
```

---

# Processo de Cadastro

## Auto Cadastro

O usuário poderá realizar o cadastro através:

- Aplicativo Mobile
- Aplicação Web

Tela:

```text
Nome Completo
CPF
Telefone
E-mail
Senha
Confirmar Senha

Tipo de Usuário
```

Opções:

```text
Morador
Voluntário
Colaborador
```

Observação:

O perfil Administrador não poderá ser solicitado diretamente.

Será criado apenas por outro Administrador.

---

# Fluxo de Aprovação

Após o cadastro:

```text
Usuário
    ↓
Pendente
    ↓
Admin analisa
    ↓
Aprovado ou Rejeitado
```

Status possíveis:

```text
PENDING
APPROVED
REJECTED
BLOCKED
```

---

# Processo de Validação

O Administrador poderá:

- Analisar os dados
- Conferir CPF
- Conferir telefone
- Entrar em contato com o candidato
- Validar participação na comunidade

Exemplo:

```text
Morador realiza cadastro.

Administrador recebe notificação.

Administrador liga para o número informado.

Confirma identidade.

Aprova cadastro.
```

---

# Perfis de Usuário

## Administrador

Responsável pela gestão completa da plataforma.

Permissões:

```text
Gerenciar usuários
Gerenciar colheitas
Gerenciar reservas
Gerenciar irrigação
Visualizar dashboards
Gerenciar permissões
Configurar plataforma
Bloquear usuários
Aprovar usuários
```

---

## Colaborador

Participante ativo da gestão da horta.

Permissões:

```text
Visualizar dashboard
Cadastrar colheitas
Editar colheitas
Gerenciar reservas
Visualizar telemetria
Controlar irrigação
```

Não pode:

```text
Gerenciar usuários
Alterar permissões
Criar administradores
```

---

## Voluntário

Participante auxiliar.

Permissões:

```text
Visualizar dashboard
Visualizar telemetria
Registrar atividades
Consultar colheitas
```

Não pode:

```text
Controlar irrigação
Gerenciar usuários
Editar permissões
```

---

## Morador

Usuário final da comunidade.

Permissões:

```text
Consultar colheitas
Reservar colheitas
Visualizar disponibilidade
Consultar histórico pessoal
Editar dados próprios
```

Não pode:

```text
Controlar irrigação
Gerenciar sistema
Editar colheitas
```

---

# Modelo RBAC

Recomenda-se utilizar:

```text
RBAC
Role Based Access Control
```

Estrutura:

```text
Usuário
      │
      ▼
Role
      │
      ▼
Permissões
```

---

# Entidades

## User

```json
{
  "_id": "...",
  "name": "José Paulo Conrado",
  "email": "usuario@email.com",
  "cpf": "00000000000",
  "phone": "16999999999",
  "role": "resident",
  "status": "pending",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Role

```json
{
  "_id": "...",
  "name": "admin",
  "description": "Administrador do sistema"
}
```

---

## Permission

```json
{
  "_id": "...",
  "resource": "harvest",
  "action": "create"
}
```

---

# Autenticação

Recomenda-se utilizar:

```text
JWT
JSON Web Token
```

Fluxo:

```text
Login
     ↓
Backend
     ↓
JWT
     ↓
Web ou Mobile
```

---

# Login

Endpoint:

```text
POST /auth/login
```

Entrada:

```json
{
  "email": "usuario@email.com",
  "password": "123456"
}
```

Saída:

```json
{
  "token": "jwt-token"
}
```

---

# Registro

Endpoint:

```text
POST /auth/register
```

Entrada:

```json
{
  "name": "José Paulo",
  "email": "usuario@email.com",
  "cpf": "00000000000",
  "phone": "16999999999",
  "password": "123456",
  "role": "resident"
}
```

Status inicial:

```text
PENDING
```

---

# Aprovação Administrativa

Endpoints:

```text
GET /admin/users/pending

PUT /admin/users/:id/approve

PUT /admin/users/:id/reject

PUT /admin/users/:id/block
```

---

# CRUD de Usuários

## Consultar Usuários

```text
GET /users
```

---

## Consultar Usuário

```text
GET /users/:id
```

---

## Atualizar Usuário

```text
PUT /users/:id
```

---

## Excluir Usuário

```text
DELETE /users/:id
```

---

# Recuperação de Senha

Endpoints:

```text
POST /auth/forgot-password

POST /auth/reset-password
```

Fluxo:

```text
Usuário informa e-mail.
Sistema envia link.
Usuário redefine senha.
```

---

# Controle de Acesso Web

Menus exibidos conforme perfil.

Exemplo:

Administrador:

```text
Dashboard
Usuários
Colheitas
Telemetria
Irrigação
Configurações
```

---

Morador:

```text
Dashboard
Colheitas
Minhas Reservas
Meu Cadastro
```

---

# Controle de Acesso Mobile

Mesmo conceito do Web.

O aplicativo deverá obter:

```text
Role
Permissões
```

após autenticação.

Com isso a interface será montada dinamicamente.

---

# Gestão de Colheitas

Este módulo será utilizado na próxima fase.

Exemplo:

Administrador cria colheita.

```text
Alface
Quantidade: 30
Data: 15/11/2026
```

Moradores podem:

```text
Consultar
Reservar
Cancelar Reserva
```

Administradores e colaboradores podem:

```text
Criar
Editar
Encerrar
```

---

# Auditoria

Registrar operações críticas.

Exemplo:

```text
Usuário aprovado
Usuário bloqueado
Senha alterada
Reserva realizada
Irrigação acionada
```

Modelo:

```json
{
  "userId": "...",
  "action": "APPROVE_USER",
  "timestamp": "...",
  "ip": "..."
}
```

---

# Dashboard Administrativo de Usuários

Indicadores:

```text
Usuários cadastrados
Usuários pendentes
Usuários aprovados
Usuários bloqueados

Moradores
Voluntários
Colaboradores
Administradores
```

---

# Segurança

Recomendações:

- Senhas criptografadas com bcrypt
- JWT com expiração
- HTTPS obrigatório
- Rate Limiting
- Validação de CPF
- Validação de e-mail
- Validação de telefone

Bibliotecas sugeridas:

```bash
npm install bcrypt
npm install jsonwebtoken
npm install express-validator
npm install helmet
npm install express-rate-limit
```

---

# Evoluções Futuras

Possíveis melhorias:

- Login Google
- Login Microsoft
- Login Gov.br
- MFA (duplo fator)
- Aprovação por WhatsApp
- Aprovação automática baseada em critérios
- Notificações Push Mobile
- Gestão de grupos comunitários
- Gestão de múltiplas hortas

---

# Conclusão

A implementação do módulo de Gestão de Usuários cria a base necessária para evolução da plataforma Horta Comunitária para um ambiente multiusuário seguro e escalável.

A solução proposta utiliza autenticação moderna baseada em JWT, modelo RBAC para controle de acesso, fluxo de aprovação administrativa e segregação de responsabilidades por perfil.

Essa arquitetura permite suportar futuras funcionalidades como gestão de colheitas, reservas de alimentos, auditoria de operações e expansão da plataforma para múltiplas hortas comunitárias.

o documento cobre adequadamente:

✅ Objetivo do módulo
✅ Arquitetura geral
✅ Processo de cadastro
✅ Processo de aprovação pelo administrador
✅ Perfis de usuários
✅ RBAC (Role-Based Access Control)
✅ CRUD de usuários
✅ Autenticação JWT
✅ Fluxo de login e registro
✅ Controle de acesso Web
✅ Controle de acesso Mobile
✅ Preparação para gestão de colheitas
✅ Auditoria
✅ Dashboard administrativo de usuários
✅ Segurança (bcrypt, JWT, Helmet, Rate Limit)
✅ Evoluções futuras
