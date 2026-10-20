# Parte 1: Dashboard Estatístico da Plataforma Horta Comunitária

## Objetivo

Transformar os dados coletados pelos sensores IoT em indicadores estatísticos, métricas de desempenho e informações gerenciais que auxiliem na tomada de decisão e na gestão da horta comunitária.

O dashboard administrativo utilizará tanto os dados em tempo real recebidos via Socket.IO quanto os dados históricos persistidos no MongoDB.

O objetivo é evoluir de um simples monitoramento de sensores para uma plataforma de apoio à decisão baseada em dados.

---

# Arquitetura do Dashboard

O dashboard será dividido em duas camadas:

## Painel Operacional

Responsável pelo monitoramento em tempo real.

Fonte dos dados:

```text
Socket.IO
```

Informações exibidas:

- Temperatura atual
- Umidade atual do ar
- Umidade atual do solo
- Estado atual da irrigação
- Modo de irrigação (manual ou automático)
- Alertas em tempo real

Fluxo:

```text
ESP32
   ↓ MQTT
Mosquitto
   ↓
Backend
   ↓ Socket.IO
Dashboard Web
```

---

## Painel Analítico

Responsável pela análise histórica dos dados.

Fonte dos dados:

```text
MongoDB
```

Informações exibidas:

- Estatísticas
- Tendências
- Correlações
- Eficiência da irrigação
- Indicadores de saúde da horta
- Previsões futuras

Fluxo:

```text
Dashboard
      ↓
Backend
      ↓
MongoDB
```

---

# APIs Analíticas

Recomenda-se criar um módulo específico para Analytics no Backend.

Rotas sugeridas:

```text
GET /analytics/daily
GET /analytics/weekly
GET /analytics/monthly
GET /analytics/irrigation
GET /analytics/correlations
GET /analytics/predictions
GET /analytics/health-score
```

Benefícios:

- Centralização dos cálculos
- Redução da carga no frontend
- Reutilização por Web e Mobile
- Facilidade de manutenção

---

# Fonte dos Dados

Dados de telemetria recebidos do ESP32:

```json
{
  "soilMoisture": 55,
  "temperature": 26.8,
  "humidity": 72.3,
  "irrigationOn": true,
  "mode": "automatic",
  "timestamp": "2026-10-19T20:00:00Z"
}
```

Variáveis monitoradas:

- Umidade do Solo
- Temperatura Ambiente
- Umidade Relativa do Ar
- Estado da Irrigação

---

# Indicadores Estatísticos

## 1. Estatísticas Básicas

### Temperatura

Calcular:

- Média
- Mediana
- Mínima
- Máxima
- Amplitude
- Desvio padrão

Exemplo:

```text
Temperatura Média: 27,3 °C
Temperatura Mediana: 27,1 °C
Temperatura Mínima: 19,8 °C
Temperatura Máxima: 34,1 °C
Amplitude: 14,3 °C
Desvio Padrão: 1,2 °C
```

---

### Umidade do Solo

Calcular:

- Média
- Mediana
- Mínima
- Máxima
- Desvio padrão

Exemplo:

```text
Média: 58%
Mínima: 32%
Máxima: 85%
```

---

### Umidade do Ar

Calcular:

- Média
- Mediana
- Mínima
- Máxima
- Desvio padrão

Exemplo:

```text
Média: 72%
Mínima: 55%
Máxima: 90%
```

---

# 2. Histograma das Leituras

Exibir a distribuição dos dados coletados.

Exemplo:

```text
Umidade do Solo

20% - 30% ███
30% - 40% ██████
40% - 50% ██████████
50% - 60% ███████
60% - 70% ███
```

Objetivo:

Identificar as faixas mais frequentes de operação da horta.

---

# 3. Tendência de Comportamento

Comparar diferentes períodos.

Exemplo:

```text
Últimas 2 horas
versus
Últimas 24 horas
```

Resultado:

```text
Umidade do Solo

Média 24h: 58%
Média 2h: 44%

Queda: 24%
```

Indicadores:

```text
📈 Crescimento
📉 Queda
➖ Estabilidade
```

Aplicação:

Antecipar necessidade de irrigação.

---

# 4. Tempo em Condição Crítica

Calcular quanto tempo a horta permaneceu em condições inadequadas.

Exemplos:

```text
Solo abaixo de 40%
```

```text
Temperatura acima de 35°C
```

```text
Umidade do ar abaixo de 50%
```

Resultado:

```text
Tempo em condição crítica:
2h35min
```

Indicadores:

- Diário
- Semanal
- Mensal

---

# 5. Frequência de Irrigação

Calcular quantas irrigações ocorreram.

Exemplo:

```text
Segunda: 5 ciclos
Terça: 4 ciclos
Quarta: 7 ciclos
Quinta: 6 ciclos
Sexta: 5 ciclos
```

Representação:

```text
Histograma semanal
```

Objetivo:

Avaliar comportamento da irrigação automática.

---

# 6. Tempo Total de Irrigação

Calcular o tempo total de funcionamento do sistema de irrigação.

Exemplo:

```text
Hoje:
38 minutos
```

Também calcular:

```text
Semanal
Mensal
Anual
```

Objetivo:

Monitorar consumo de água.

---

# 7. Eficiência da Irrigação

Avaliar o impacto de cada irrigação.

Comparar:

```text
Umidade antes da irrigação
```

com

```text
Umidade após a irrigação
```

Exemplo:

```text
Antes: 35%
Depois: 68%

Ganho: +33%
```

Indicadores:

```text
Eficiência Média
Eficiência Máxima
Eficiência Mínima
```

Exemplo:

```text
Eficiência Média:
29%
```

---

# 8. Correlação Entre Variáveis

Analisar relações entre sensores.

Exemplo:

```text
Temperatura
x
Umidade do Solo
```

Método:

```text
Coeficiente de Correlação de Pearson
```

Resultado:

```text
-0,81
```

Interpretação:

```text
Forte correlação inversa
```

Ou seja:

Quanto maior a temperatura, menor tende a ser a umidade do solo.

Outras correlações possíveis:

```text
Temperatura × Umidade do Ar

Temperatura × Irrigação

Umidade do Solo × Irrigação

Umidade do Ar × Umidade do Solo
```

---

# 9. Previsão da Próxima Irrigação

Calcular através de:

- Média móvel
- Tendência histórica
- Regressão linear simples

Exemplo:

```text
Perda média:
3% de umidade por hora
```

Situação atual:

```text
Solo:
58%
```

Limite configurado:

```text
40%
```

Resultado:

```text
Próxima irrigação estimada
em aproximadamente 6 horas.
```

Benefícios:

- Planejamento
- Economia de água
- Monitoramento preventivo

---

# 10. Índice de Saúde da Horta

Criar um indicador consolidado.

Escala:

```text
0 a 100
```

Pesos sugeridos:

```text
40% Umidade do Solo

30% Temperatura

30% Umidade do Ar
```

Exemplo:

```text
Índice da Horta:
87 / 100
```

Classificação:

```text
80 a 100 -> Excelente

60 a 79 -> Boa

40 a 59 -> Atenção

0 a 39 -> Crítica
```

Este indicador permite avaliar rapidamente a condição geral da horta.

---

# Dashboard Executivo Proposto

```text
┌─────────────────────────────┐
│ Saúde da Horta      87/100  │
└─────────────────────────────┘

🌡 Temperatura
Média / Mínima / Máxima

💧 Umidade do Ar
Média / Mínima / Máxima

🌱 Umidade do Solo
Média / Mínima / Máxima

🚿 Irrigação
Quantidade de ciclos
Tempo ativo
Eficiência média

⚠ Alertas
Tempo em condição crítica

📈 Tendências

📊 Correlações

🔮 Previsão da próxima irrigação
```

---

# Benefícios Acadêmicos e Técnicos

A implementação dessas métricas permite transformar dados brutos dos sensores em informações de alto valor para gestão da horta.

O sistema deixa de ser apenas um monitoramento IoT e passa a atuar como ferramenta de apoio à decisão.

Entre os principais benefícios:

- Acompanhamento da saúde da horta
- Avaliação da eficiência da irrigação
- Detecção de padrões ambientais
- Identificação de situações críticas
- Redução do desperdício de água
- Planejamento preventivo
- Aplicação prática de estatística descritiva
- Aplicação de análise temporal
- Aplicação de correlação estatística
- Aplicação de técnicas simples de previsão

Esses recursos elevam significativamente o nível técnico e acadêmico do projeto Horta Comunitária.

# Parte 2: Complementos ao Dashboard Estatístico da Plataforma Horta Comunitária

## Dashboard Mobile

Além do painel Web administrativo, recomenda-se implementar uma versão simplificada do dashboard estatístico no aplicativo Mobile desenvolvido com Expo.

O objetivo do dashboard móvel é disponibilizar informações operacionais e gerenciais de forma rápida e acessível para moradores, administradores e responsáveis pela horta.

---

## Funcionalidades Recomendadas

### Monitoramento em Tempo Real

O aplicativo deverá receber atualizações através do Socket.IO.

Eventos consumidos:

```text
status:update

telemetry:update
```

Informações apresentadas:

- Temperatura atual
- Umidade do ar atual
- Umidade do solo atual
- Estado atual da irrigação
- Modo de operação (manual ou automático)

---

### Histórico Recente

Ao abrir a tela o aplicativo deverá consultar:

```text
GET /telemetry/history
```

Objetivo:

Carregar os registros mais recentes persistidos no MongoDB.

Após o carregamento inicial, as novas leituras passarão a ser recebidas via Socket.IO.

Fluxo:

```text
Mobile
    │
    ├── GET /telemetry/history
    │
    └── Socket.IO
            │
            ▼
         Backend
```

---

### Gráfico de Telemetria

O aplicativo poderá apresentar gráficos simplificados contendo:

- Umidade do Solo
- Temperatura
- Umidade do Ar

Sugestão:

Exibir as últimas 20 ou 30 leituras para facilitar a visualização em dispositivos móveis.

Objetivo:

Permitir acompanhamento rápido da evolução da horta sem necessidade de acessar o painel administrativo completo.

---

### Controle de Irrigação

O aplicativo poderá executar as mesmas funcionalidades do painel Web.

Exemplo:

```text
Ligar Irrigação

Desligar Irrigação

Modo Automático
```

Fluxo:

```text
Mobile
     │
POST /irrigation
     │
     ▼
Backend
     │
     ▼ MQTT
Mosquitto
     │
     ▼
ESP32
```

---

## Benefícios da Implementação Mobile

- Acompanhamento remoto da horta
- Atualização em tempo real
- Interface simplificada
- Melhor experiência para usuários finais
- Reutilização da mesma API utilizada pelo painel Web

---

# Processamento Estatístico no Backend

Todos os cálculos estatísticos deverão ser executados pelo Backend.

O Frontend Web e o Aplicativo Mobile não devem acessar diretamente o MongoDB nem realizar cálculos estatísticos complexos.

Arquitetura recomendada:

```text
Web ou Mobile
       │
       ▼
Backend Analytics
       │
       ▼
MongoDB
```

---

## Responsabilidades do Backend

O Backend será responsável por:

- Consultar o MongoDB
- Processar os dados históricos
- Calcular indicadores
- Aplicar algoritmos estatísticos
- Retornar resultados prontos para consumo

---

## Indicadores Calculados pelo Backend

### Estatísticas Descritivas

- Média
- Mediana
- Mínimo
- Máximo
- Amplitude
- Desvio padrão

---

### Indicadores de Irrigação

- Quantidade de ciclos
- Tempo total irrigando
- Eficiência média das irrigações

---

### Tendências

Comparação entre períodos:

```text
Últimas 2 horas

Últimas 24 horas

Últimos 7 dias
```

---

### Correlações

Exemplo:

```text
Temperatura × Umidade do Solo
```

Aplicação do coeficiente de correlação de Pearson.

---

### Previsões

Estimativa de:

```text
Próxima irrigação necessária
```

utilizando:

- Média móvel
- Tendência histórica
- Regressão linear simples

---

## Benefícios da Centralização dos Cálculos

- Menor processamento no navegador
- Menor processamento no aplicativo móvel
- Código centralizado
- Reutilização dos indicadores
- Facilidade de manutenção
- Padronização dos resultados

---

# Contribuição Acadêmica do Dashboard Estatístico

A implementação do Dashboard Estatístico amplia significativamente o escopo do projeto.

O sistema deixa de ser apenas uma solução de monitoramento IoT e passa a atuar como uma ferramenta de apoio à decisão baseada em dados.

---

## Evolução do Projeto

### Etapa Inicial

Monitoramento básico:

```text
Sensor
↓
Leitura
↓
Exibição na tela
```

---

### Etapa Evoluída

Análise de dados:

```text
Sensor
↓
Armazenamento
↓
Processamento Estatístico
↓
Indicadores
↓
Tomada de Decisão
```

---

## Conceitos Aplicados

O Dashboard Estatístico permite aplicar conhecimentos de diferentes áreas da computação.

### Internet das Coisas (IoT)

- Sensoriamento
- Telemetria
- Comunicação MQTT

### Computação em Nuvem

- Hospedagem em Azure
- Containers Docker
- Serviços distribuídos

### Bancos de Dados NoSQL

- MongoDB
- Persistência histórica
- Consultas analíticas

### Estatística Descritiva

- Média
- Mediana
- Desvio padrão
- Distribuição de frequência

### Análise Temporal

- Tendências
- Séries temporais
- Comparação entre períodos

### Correlação Estatística

- Relação entre variáveis ambientais
- Correlação de Pearson

### Previsão de Eventos

- Estimativa da próxima irrigação
- Identificação preventiva de condições críticas

### Sistemas de Apoio à Decisão

- Visualização de indicadores
- Monitoramento gerencial
- Tomada de decisão baseada em dados

---

## Benefícios Práticos

A plataforma passa a permitir:

- Avaliação da eficiência da irrigação automática
- Identificação de padrões ambientais
- Redução do desperdício de água
- Monitoramento da saúde da horta
- Planejamento preventivo
- Gestão orientada por dados

---

## Resultado Esperado

Com a implementação do Dashboard Estatístico, o projeto Horta Comunitária evolui de uma plataforma de monitoramento de sensores para uma solução completa de gestão inteligente da horta.

Essa evolução agrega valor técnico, acadêmico e prático ao projeto, demonstrando a integração entre IoT, Computação em Nuvem, Bancos de Dados, Estatística e Sistemas de Apoio à Decisão.

# Parte 3: Tecnologias Recomendadas para o Dashboard Estatístico

## Objetivo

Definir as bibliotecas e ferramentas recomendadas para implementação dos dashboards Web e Mobile da plataforma Horta Comunitária.

A escolha prioriza:

- Facilidade de desenvolvimento
- Compatibilidade com React e Expo
- Boa documentação
- Facilidade de manutenção
- Recursos de visualização estatística

---

# Backend

O processamento estatístico deve ser realizado preferencialmente no Backend.

Stack atual:

```text
Node.js
Express
MongoDB
```

Bibliotecas recomendadas:

## Math.js

Cálculos matemáticos e estatísticos.

Instalação:

```bash
npm install mathjs
```

Exemplos:

- Média
- Mediana
- Variância
- Desvio padrão

Exemplo:

```javascript
import { mean, median, std } from 'mathjs';

const media = mean(valores);
const mediana = median(valores);
const desvio = std(valores);
```

---

## Simple Statistics

Biblioteca especializada em estatística.

Instalação:

```bash
npm install simple-statistics
```

Recursos:

- Correlação de Pearson
- Regressão Linear
- Quartis
- Distribuições

Exemplo:

```javascript
import ss from 'simple-statistics';

const correlacao = ss.sampleCorrelation(temperaturas, umidadeSolo);
```

---

## DayJS

Manipulação de datas.

Instalação:

```bash
npm install dayjs
```

Utilização:

- Agrupamentos diários
- Agrupamentos semanais
- Agrupamentos mensais

---

# Dashboard Web

Aplicação React.

---

## Recharts

Biblioteca principal recomendada.

Instalação:

```bash
npm install recharts
```

Motivos:

- Integração nativa com React
- Fácil utilização
- Ótima documentação
- Gráficos responsivos

Tipos de gráfico:

```text
LineChart
AreaChart
BarChart
PieChart
ScatterChart
RadarChart
ComposedChart
```

Exemplos de uso no projeto:

- Evolução da temperatura
- Evolução da umidade
- Histórico da irrigação
- Eficiência da irrigação

---

## React Gauge Component

Para o Índice de Saúde da Horta.

Instalação:

```bash
npm install react-gauge-component
```

Exemplo:

```text
Saúde da Horta

87 / 100
```

Representação:

```text
🟢 Excelente
```

---

## React CountUp

Para indicadores de destaque.

Instalação:

```bash
npm install react-countup
```

Permite animações em:

- Média de temperatura
- Número de irrigações
- Eficiência média

---

## React Query

Cache das consultas analíticas.

Instalação:

```bash
npm install @tanstack/react-query
```

Benefícios:

- Cache automático
- Atualizações eficientes
- Melhor desempenho

---

# Dashboard Mobile

Aplicação Expo.

---

## Socket.IO Client

Comunicação em tempo real.

Instalação:

```bash
npm install socket.io-client
```

Uso:

```javascript
const socket = io(API_URL);
```

Eventos:

```text
telemetry:update

status:update
```

---

## React Native Chart Kit

Biblioteca recomendada para gráficos.

Instalação:

```bash
npm install react-native-chart-kit
```

Dependências:

```bash
npm install react-native-svg
```

Tipos de gráfico:

```text
LineChart
BarChart
PieChart
ProgressChart
```

Aplicações:

- Umidade do Solo
- Temperatura
- Umidade do Ar

---

## Victory Native

Alternativa mais avançada.

Instalação:

```bash
npm install victory-native
npm install react-native-svg
```

Indicado para:

- Correlações
- Scatter Plot
- Visualizações estatísticas

---

# Gráficos Recomendados

## Temperatura

Tipo:

```text
Line Chart
```

Biblioteca:

```text
Recharts
```

ou

```text
React Native Chart Kit
```

---

## Umidade do Solo

Tipo:

```text
Area Chart
```

Objetivo:

Visualizar quedas até o acionamento da irrigação.

---

## Frequência de Irrigação

Tipo:

```text
Bar Chart
```

Objetivo:

Analisar quantidade de ciclos por dia.

---

## Correlação

Tipo:

```text
Scatter Plot
```

Objetivo:

Relacionar:

Temperatura x Umidade do Solo

---

## Índice de Saúde

Tipo:

```text
Gauge
```

Faixas:

```text
0-39   Crítica

40-59  Atenção

60-79  Boa

80-100 Excelente
```

---

# Dependências Recomendadas

## Backend

```bash
npm install mathjs
npm install simple-statistics
npm install dayjs
```

---

## Web

```bash
npm install recharts
npm install react-gauge-component
npm install react-countup
npm install @tanstack/react-query
```

---

## Mobile Expo

```bash
npm install socket.io-client
npm install react-native-chart-kit
npm install react-native-svg
```

Opcional:

```bash
npm install victory-native
```

---

# Arquitetura Final

```text
ESP32
    │
    ▼ MQTT
Mosquitto
    │
    ▼
Backend
    │
    ├── MongoDB
    ├── Analytics
    └── Socket.IO
            │
            ├── React Web
            └── Expo Mobile
```

Os cálculos estatísticos devem ser executados no Backend. O Web e o Mobile devem apenas consumir os indicadores já processados através das APIs Analytics e exibir os resultados utilizando bibliotecas gráficas apropriadas.
