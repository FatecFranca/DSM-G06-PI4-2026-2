# Deploy da Plataforma Horta Comunitária em Máquina Virtual Azure

## Objetivo

Disponibilizar em ambiente de nuvem todos os serviços necessários para a execução do sistema Horta Comunitária utilizando uma Máquina Virtual Azure Linux e containers Docker.

A solução centraliza os serviços de Backend, Frontend, MQTT Broker e MongoDB em uma única VM, simplificando a implantação, reduzindo custos e facilitando a administração do ambiente.

---

```
# Assuntos abordados no documento

Arquitetura completa da solução
Azure VM
Docker
Docker Compose
MongoDB local na VM
Comparação MongoDB local × Atlas
MongoDB Compass
SSH Tunnel
Mosquitto
Backend Express
Frontend React
Mobile Expo
Socket.IO
REST API
Fluxos de comunicação
Wokwi local
Migração Wokwi → ESP32
HTTPS
Domínios
Segurança
CI/CD
Persistência de dados
```

# Arquitetura Geral da Solução

```text
                              ┌──────────────┐
                              │ Expo Mobile  │
                              └──────┬───────┘
                                     │
                             REST + Socket.IO
                                     │
                                     ▼

                     ┌─────────────────────────┐
                     │      Azure VM           │
                     │                         │
                     │  Frontend React         │
                     │  Backend Express        │
                     │  Socket.IO              │
                     │  Mosquitto MQTT         │
                     │  MongoDB                │
                     └──────────┬──────────────┘
                                ▲
                                │ MQTT
                                │
                      ESP32 Físico ou Wokwi
```

---

# Componentes da Solução

## Frontend Web

Aplicação React responsável pela interface administrativa.

Principais funcionalidades:

- Monitoramento em tempo real
- Visualização de telemetria
- Controle de irrigação
- Gestão de colheitas
- Dashboard estatístico
- Visualização de indicadores históricos

---

## Backend

Aplicação Node.js com Express responsável por:

- API REST
- Comunicação Socket.IO
- Integração MQTT
- Persistência MongoDB
- Regras de negócio
- Processamento de estatísticas

Principais endpoints:

```text
GET  /health
GET  /status
GET  /telemetry/history
POST /irrigation
GET  /harvest
POST /harvest
PUT  /harvest/:id/reserve
```

---

## Eventos Socket.IO

Eventos enviados pelo Backend:

```text
status:update

telemetry:update
```

Esses eventos permitem atualização em tempo real tanto para o painel Web quanto para o aplicativo Mobile.

---

## Broker MQTT

Utilização do Eclipse Mosquitto.

Tópicos utilizados:

```text
horta/telemetry

horta/irrigation
```

Responsável pela comunicação entre:

- ESP32
- Simulador Wokwi
- Backend

---

## MongoDB

Persistência das informações de:

- Telemetrias
- Colheitas
- Reservas
- Histórico operacional

Recomenda-se utilizar MongoDB em container Docker com volume persistente.

Exemplo:

```yaml
volumes:
  - mongo_data:/data/db
```

---

# Estratégia de Persistência

Durante a fase inicial do projeto será utilizado o MongoDB executando em container Docker na própria VM Azure.

Vantagens:

- Menor custo
- Simplicidade operacional
- Fácil implantação
- Controle total da infraestrutura
- Ambiente semelhante ao desenvolvimento local

Evolução futura:

Utilização do MongoDB Atlas para:

- Alta disponibilidade
- Escalabilidade
- Backups gerenciados
- Monitoramento avançado
- Recuperação de desastres

---

# Estrutura de Comunicação

## Fluxo de Telemetria

```text
ESP32 / Wokwi
      │
      ▼ MQTT
Mosquitto
      │
      ▼
Backend
      │
      ├── MongoDB
      │
      └── Socket.IO
              │
              ▼
Frontend Web
              │
              ▼
          Mobile Expo
```

---

## Fluxo de Controle da Irrigação

```text
Frontend ou Mobile
         │
         ▼
 POST /irrigation
         │
         ▼
       Backend
         │ MQTT
         ▼
      Mosquitto
         │
         ▼
        ESP32
```

---

# Aplicativo Mobile (Expo)

O aplicativo móvel não deve acessar diretamente:

- MongoDB
- Mosquitto

Arquitetura recomendada:

```text
Mobile Expo
     │
     ├── REST API
     └── Socket.IO
             │
             ▼
          Backend
```

Toda a lógica de negócio permanece concentrada no Backend.

Benefícios:

- Maior segurança
- Menor acoplamento
- Facilidade de manutenção
- Reutilização das APIs

---

# Integração com o Simulador Wokwi

O simulador Wokwi não precisa ser executado na Azure.

Ele continua funcionando localmente no VS Code.

Arquitetura:

```text
Notebook Local
       │
       ▼
 VS Code + Wokwi
       │ MQTT
       ▼
 Mosquitto Azure
```

Atualmente o firmware utiliza:

```cpp
#define MQTT_BROKER "broker.hivemq.com"
```

Após o deploy:

```cpp
#define MQTT_BROKER "mqtt.seudominio.com"
```

ou

```cpp
#define MQTT_BROKER "IP_DA_VM"
```

Nenhuma alteração adicional será necessária na lógica MQTT.

---

# Migração para Hardware Real

O firmware utilizado no simulador Wokwi é compatível com ESP32 físico.

Na maioria dos casos será necessário alterar apenas as credenciais de Wi-Fi.

Exemplo:

Wokwi:

```cpp
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""
```

ESP32 real:

```cpp
#define WIFI_SSID "MinhaRede"
#define WIFI_PASSWORD "MinhaSenha"
```

Toda a lógica de:

- MQTT
- Publicação de telemetria
- Recebimento de comandos
- Controle da irrigação

permanece inalterada.

---

# Administração do MongoDB

O MongoDB poderá ser administrado através do MongoDB Compass.

Não é recomendado expor a porta 27017 para a Internet.

Utilizar túnel SSH:

```bash
ssh -L 27017:localhost:27017 azureuser@IP_DA_VM
```

Após estabelecer o túnel:

```text
mongodb://localhost:27017
```

pode ser utilizado normalmente no Compass.

Benefícios:

- Segurança
- Sem exposição do banco
- Administração remota simples

---

# Persistência dos Dados

Toda telemetria recebida via MQTT deverá ser armazenada no MongoDB.

Esses dados servirão para:

- Histórico operacional
- Dashboard estatístico
- Relatórios
- Auditoria
- Tendências
- Previsões futuras

---

# Organização de Domínios

Sugestão de estrutura:

```text
www.horta.com.br
Frontend
```

```text
api.horta.com.br
Backend
```

```text
mqtt.horta.com.br
Broker MQTT
```

Benefícios:

- Organização
- Escalabilidade
- Facilidade de manutenção

---

# Segurança

## MongoDB

Não expor:

```text
27017
```

para a internet.

Permitir acesso apenas pela rede interna Docker.

---

## MQTT

Configurar:

```text
Usuário
Senha
ACL
```

Evitar utilização de brokers públicos em produção.

---

## HTTPS

Utilizar:

```text
Nginx
Let's Encrypt
```

Endpoints:

```text
https://www.horta.com.br

https://api.horta.com.br
```

Benefícios:

- Criptografia
- Credibilidade
- Segurança das credenciais

---

# Infraestrutura Recomendada

Para ambiente acadêmico e homologação:

```text
Ubuntu Server 22.04
2 vCPU
4 GB RAM
Docker
Docker Compose
```

Toda a solução poderá ser executada em uma única VM.

---

# Evolução para CI/CD

Como evolução futura recomenda-se utilizar GitHub Actions para automatizar a implantação.

Arquitetura:

```text
GitHub
   │
   ▼
GitHub Actions
   │
   ▼
Azure VM
   │
   ▼
docker compose up -d
```

Benefícios:

- Menos intervenção manual
- Atualizações rápidas
- Menor risco de erro operacional
- Padronização do processo de deploy

---

# Conclusão

A arquitetura proposta permite hospedar toda a plataforma Horta Comunitária em uma única Máquina Virtual Azure utilizando Docker.

A solução contempla:

- Frontend React
- Backend Node.js
- Socket.IO
- Broker MQTT Mosquitto
- MongoDB
- Aplicativo Expo
- Simulador Wokwi
- ESP32 físico

Além de oferecer simplicidade de implantação, a arquitetura mantém compatibilidade com futuras evoluções para ambientes de produção mais robustos, incluindo MongoDB Atlas, CI/CD automatizado, múltiplas VMs e arquiteturas distribuídas.
