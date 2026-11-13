# Jira Cards Dashboard

Extensão de navegador (Chrome e Edge) que exibe um dashboard das movimentações de status dos seus cards no Jira, usando a sessão ativa do Jira (sem precisar de token).

## Funcionalidades

- Consulta as movimentações de status feitas por você na semana selecionada.
- Cards agrupados por dia, com todas as transições de status.
- Badge colorido com a situação atual de cada card (mesma cor do Jira).
- Navegação entre semanas e opção de ocultar sábado/domingo (preferência salva).
- Layout responsivo que se adapta à largura da tela.

## Instalação no Chrome

1. Baixe/extraia a pasta `extension/` deste repositório para uma pasta no seu computador (ex.: `C:\extensoes\jira-dashboard`).
2. Abra o Chrome e acesse `chrome://extensions`.
3. Ative o **Modo do desenvolvedor** (interruptor no canto superior direito).
4. Clique em **Carregar sem compactação** (Load unpacked).
5. Selecione a pasta `extension/`.
6. A extensão **Jira Cards Dashboard** aparecerá na lista. Clique no ícone de quebra-cabeça na barra de ferramentas e fixe a extensão.

## Instalação no Microsoft Edge

1. Baixe/extraia a pasta `extension/` deste repositório para uma pasta no seu computador.
2. Abra o Edge e acesse `edge://extensions`.
3. Ative o **Modo de desenvolvedor** (interruptor no canto inferior esquerdo).
4. Clique em **Carregar descompactada** (Load unpacked).
5. Selecione a pasta `extension/`.
6. A extensão **Jira Cards Dashboard** aparecerá na lista. Clique no ícone de quebra-cabeça na barra de ferramentas e fixe a extensão.

## Como usar

1. Clique no ícone da extensão para abrir o dashboard.
2. Na tela de **Configuração**, informe a URL do seu Jira (ex.: `https://suaempresa.atlassian.net`) e clique em **Salvar**.
3. A extensão usa a sessão ativa do Jira — certifique-se de estar logado no Jira em uma aba do navegador.
4. Navegue entre as semanas com as setas e use o checkbox para ocultar sábado/domingo.

## Estrutura

```
extension/
├── manifest.json   # Configuração da extensão (Manifest V3)
├── background.js   # Service worker
├── dashboard.html  # Interface do dashboard
└── dashboard.js    # Lógica e renderização
```

> **Nota:** a pasta `docs/` contém uma versão standalone (página HTML) que funciona colando o JSON retornado pelo Jira, sem instalação.