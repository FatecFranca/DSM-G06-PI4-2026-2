# Registro de validação experimental — Horta Comunitária Conectada (CODITEC v5)

## Objetivo e ambiente

Ensaio local de integração de software entre publicador MQTT, broker Mosquitto e backend Express, sem conexão com broker público. Execução em Node.js v22.13.0 e Mosquitto 2.0.18. O broker ouviu somente em `127.0.0.1:18883`; API local na porta 31327; tópicos isolados `coditec/v5/telemetry` e `coditec/v5/irrigation`. MongoDB estava desativado; o backend manteve o histórico em memória. O ensaio não alterou arquivos versionados do repositório.

## Procedimento

Foram publicadas sequencialmente 30 mensagens sintéticas de telemetria, QoS 0, cada uma com identificador de execução e número de sequência. Uma mensagem foi contada como entregue ao backend quando apareceu no endpoint de histórico em memória. Mediu-se, com relógio monotônico, o intervalo desde o início da publicação MQTT até a visibilidade via consulta HTTP.

Em seguida, foram enviadas 30 solicitações seriais de irrigação ao backend: dez ações `on`, dez `off` e dez `auto`. Um assinante MQTT local contou comandos no tópico isolado. O tempo medido foi da solicitação HTTP até a observação do comando pelo assinante local. O percentil 95 foi calculado pelo método de posto mais próximo.

## Resultados observados

| Fluxo | Entrega observada | Mediana | Percentil 95 | Média |
|---|---:|---:|---:|---:|
| Telemetria sintética → histórico em memória | 30/30 (100%) | 7,48 ms | 12,68 ms | 8,67 ms |
| HTTP → broker local (comandos) | 30/30 (100%); 10 por ação | 3,94 ms | 4,66 ms | 4,43 ms |

Todos os 30 comandos receberam HTTP 200. As medições são da execução reproduzida no ambiente de bancada; não são caracterização de latência sob carga, de dispositivo remoto ou de rede de produção.

## Limitações e interpretação

- Payloads de telemetria foram sintéticos; não houve ESP32, sensor calibrado ou transmissão por Wi-Fi real.
- Broker e backend operaram em loopback no mesmo ambiente; latências não representam Internet, rede celular ou instalação urbana.
- A comunicação usou QoS 0; não se mediu reconexão, perda em falha, concorrência ou durabilidade.
- MongoDB foi desligado: a contagem verifica somente a aparição no histórico em memória e não comprova persistência após reinício.
- A observação do comando no broker não comprova recebimento pelo firmware, acionamento de relé, abertura de válvula, vazão ou economia de água.
- Não foram medidos produtividade, qualidade agronômica, atendimento de reservas, inclusão ou resultados sociais.

Portanto, o resultado sustenta uma afirmação limitada: a integração de software entre publicador MQTT, broker local e backend foi observada com entrega de 100% nas duas amostras de 30, nas condições deste ensaio. Métricas de sustentabilidade exigem validação de campo com sensores calibrados, medidor de água, produção registrada e protocolo de participação.

## Artefatos reproduzíveis

- `run_local_validation.sh`: inicia broker e backend locais e executa o ensaio, encerrando os processos ao final.
- `mosquitto-local.conf`: broker anônimo restrito ao loopback e sem persistência.
- `validate_local_integration.mjs`: harness de publicação, verificação e medição.
- `local_integration_results.json`: resultado completo, inclusive amostras brutas em milissegundos.
- Código examinado: `/home/ubuntu/HortaComunitaria_main_v5`, snapshot main `e2e5dba2dac5c7547f7c56135c71f37378df9cd6`.
