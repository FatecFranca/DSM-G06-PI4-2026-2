# Instalação da HortaComunitária no Windows

Este documento registra o procedimento que foi testado no Windows 11
para executar a HortaComunitária, incluindo o painel web, backend,
MongoDB, simulação do ESP32 no Wokwi e aplicativo móvel.

> **Atenção:** não compartilhe arquivos `.env`, senhas, tokens ou chaves
> privadas. Os valores de exemplo devem ser substituídos por valores
> próprios quando necessário.

## 1. Pré-requisitos

-   Windows 11.
-   Git.
-   Docker Desktop configurado para usar contêineres Linux.
-   Node.js e npm, para executar o aplicativo móvel.
-   Visual Studio Code.
-   Extensão/licença do Wokwi para executar a simulação.
-   Celular Android com Expo Go compatível com o SDK utilizado pelo
    projeto.
-   Computador e celular conectados à mesma rede Wi-Fi para testar o
    aplicativo móvel.

## 2. Obter o projeto

Clone o repositório Git da equipe usando o endereço correto do projeto:

``` powershell
git clone <URL_DO_REPOSITORIO>
cd DSM-G06-PI4-2026-2
```

Se o repositório já estiver clonado, abra a pasta do projeto no VS Code
e use o terminal integrado.

Confirme que a pasta contém `docker-compose.yml` e as pastas `app`,
`backend` e `wokwi`.

## 3. Configurar o ambiente

Na raiz do projeto, confira os arquivos de exemplo:

``` powershell
Get-ChildItem -Force .env*
```

Se o projeto exigir um `.env` na raiz e ele ainda não existir, copie o
exemplo:

``` powershell
Copy-Item .env.example .env
```

Abra o `.env` e ajuste os valores necessários, incluindo uma chave JWT e
uma senha administrativa fortes. Não use os valores de exemplo em um
ambiente real e não publique o conteúdo do arquivo.

O aplicativo móvel possui sua própria configuração, separada da
configuração da raiz: `app/mobile/.env`.

## 4. Iniciar os serviços Docker

Na raiz do repositório, execute:

``` powershell
docker --version
docker compose version
docker info --format '{{.OSType}}'
```

O último comando deve indicar `linux`. Se o Docker Desktop não estiver
iniciado, abra-o e aguarde ficar pronto.

Construa e inicie os serviços:

``` powershell
docker compose up --build -d
```

Confira o estado dos contêineres:

``` powershell
docker compose ps
```

A instalação testada apresentou os serviços `backend`, `mongo`,
`mosquitto` e `web` em execução. Backend e MongoDB devem indicar estado
saudável (`healthy`) quando os testes de saúde estiverem concluídos.

Endereços locais usados neste projeto:

-   Painel web: `http://localhost:8080`
-   Backend/API: `http://localhost:3000`
-   MongoDB: porta `27017`

Abra `http://localhost:8080` no navegador e faça login com a conta
administrativa configurada para o ambiente. Não deixe a senha padrão de
exemplo.

### Se o PowerShell bloquear `npm`

Em algumas instalações, o PowerShell bloqueia `npm.ps1`. Em vez de
alterar a política de execução do Windows, use `npm.cmd` nos comandos
abaixo.

## 5. Executar a simulação do ESP32 no Wokwi

1.  Abra a pasta do projeto no VS Code.
2.  Abra a pasta `wokwi` e o arquivo `wokwi.ino`.
3.  Entre na conta do Wokwi e solicite/ative a licença disponibilizada
    para a sua conta, se a extensão pedir.
4.  Inicie a simulação e observe o terminal de saída.

Na configuração testada, o firmware usava:

-   Broker MQTT: `broker.hivemq.com`
-   Porta: `1883`
-   Tópico de telemetria: `horta/telemetry`

O backend também precisa estar configurado para receber telemetria do
mesmo broker e tópico. Confira a configuração real do repositório antes
de alterá-la; não troque os endereços MQTT sem necessidade.

Com a simulação ativa, confirme se os valores aparecem e atualizam no
painel web. O controle da irrigação e o modo automático também foram
testados no ambiente.

## 6. Verificar o MongoDB

Confira se o MongoDB está saudável:

``` powershell
docker compose ps
```

Consulte a quantidade de telemetrias armazenadas:

``` powershell
docker compose exec mongo mongosh horta-comunitaria --eval "db.telemetries.countDocuments({})"
```

Para visualizar os três registros mais recentes:

``` powershell
docker compose exec mongo mongosh horta-comunitaria --eval "db.telemetries.find().sort({_id:-1}).limit(3).forEach(printjson)"
```

A quantidade pode variar conforme o tempo em que a simulação permanece
ativa. O teste realizado confirmou que os registros continuaram
disponíveis após reiniciar os serviços.

## 7. Executar o aplicativo móvel

Abra um novo terminal PowerShell no VS Code e entre na pasta do
aplicativo:

``` powershell
cd app\mobile
```

Confira se existe um arquivo `.env`:

``` powershell
Get-ChildItem -Force .env*
```

Se só existir `.env.example`, crie o `.env`:

``` powershell
Copy-Item .env.example .env
```

Instale as dependências:

``` powershell
npm.cmd install
```

### Configurar o endereço do backend

No PowerShell, execute:

``` powershell
ipconfig
```

Encontre o endereço IPv4 do adaptador de rede que está conectado à mesma
rede Wi-Fi do celular. Por exemplo, se o IPv4 do computador for
`192.168.0.5`, a variável no arquivo `app/mobile/.env` deve ser:

``` env
EXPO_PUBLIC_API_URL=http://192.168.0.5:3000
```

Use o IPv4 real do computador; o endereço acima é apenas um exemplo. Não
use `localhost` no celular, porque isso apontaria para o próprio
celular.

Salve o arquivo `.env`. Se o Expo já estiver rodando, pare-o com
`Ctrl+C` e inicie-o novamente para carregar a variável atualizada.

Inicie o Expo:

``` powershell
npm.cmd run start
```

O terminal deve exibir um QR Code e um endereço de rede parecido com
`exp://192.168.0.5:8081`.

1.  Confirme que o celular e o computador estão na mesma rede Wi-Fi.
2.  Abra o Expo Go no celular e escaneie o QR Code.
3.  Aguarde o aplicativo carregar.
4.  Confirme que a telemetria aparece e se atualiza.

**Compatibilidade do Expo Go:** o projeto testado usa Expo SDK 57. Se o
Expo Go instalado no celular for SDK 58, será necessário usar uma versão
compatível com SDK 57 ou planejar uma atualização do projeto
separadamente. Não atualize o SDK às cegas. No teste realizado, o APK
compatível foi baixado do site oficial do Expo; o download precisou
terminar antes de abrir o arquivo.

Se o celular não conseguir acessar o backend, confira o IPv4 no `.env`,
a rede Wi-Fi e se o Firewall do Windows permite a comunicação
necessária. Não desative permanentemente o firewall.

O aplicativo móvel atual é informativo: apresenta os dados, mas não
possui botão para acionar a irrigação. O controle é feito pelo painel
web.

## 8. Testar reinicialização e persistência

Antes de reiniciar, registre a quantidade de documentos:

``` powershell
docker compose exec mongo mongosh horta-comunitaria --eval "db.telemetries.countDocuments({})"
```

Reinicie os serviços:

``` powershell
docker compose restart
```

Confira o estado:

``` powershell
docker compose ps
```

Consulte a contagem novamente:

``` powershell
docker compose exec mongo mongosh horta-comunitaria --eval "db.telemetries.countDocuments({})"
```

Com a simulação ainda enviando telemetria, o total pode aumentar.
Confirme que os registros anteriores permanecem armazenados.

> **Não execute `docker compose down -v` para um teste rotineiro.** A
> opção `-v` pode remover volumes e apagar dados persistidos.

## 9. Verificações finais

-   [ ] `docker compose ps` mostra os serviços em execução.
-   [ ] O painel abre em `http://localhost:8080` e o login funciona.
-   [ ] A telemetria do Wokwi aparece no painel.
-   [ ] O botão manual de irrigação do painel responde.
-   [ ] O modo automático liga e desliga a irrigação conforme as regras
    programadas.
-   [ ] O MongoDB contém registros de telemetria.
-   [ ] Os registros continuam presentes após `docker compose restart`.
-   [ ] O aplicativo abre no Expo Go e mostra a telemetria atualizada.

## 10. Encerrar ou iniciar novamente

Para parar os serviços sem remover os volumes:

``` powershell
docker compose stop
```

Para iniciá-los novamente:

``` powershell
docker compose start
```

Para reconstruir e iniciar os serviços após alterações no código:

``` powershell
docker compose up --build -d
```

Mantenha os arquivos `.env` fora do Git e não compartilhe senhas, tokens
ou chaves em capturas de tela ou mensagens.
