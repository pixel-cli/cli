# 🚀 PIXEL CLI

Uma CLI moderna e bonita, inspirada no Claude Code, construída com Bun e Elysia.

## ✨ Características

- 🎨 **Interface Rica**: Banner com gradientes multicoloridos e animações suaves
- 📊 **Barra de Status**: Barra persistente com informações em tempo real
- 🔧 **Comandos Modulares**: Sistema de comandos extensível e bem estruturado
- 🌐 **API Local**: Servidor Elysia integrado com WebSocket
- ⚙️ **Configuração Persistente**: Sistema completo de configurações
- 🎯 **TypeScript**: Totalmente tipado para melhor experiência de desenvolvimento

## 🚀 Como Usar

### Instalação

```bash
git clone <repository-url>
cd pixel-cli
bun install
```

### Executar

```bash
bun start
# ou
bun run start
# ou diretamente
bun src/index.ts
```

## 📋 Comandos Disponíveis

### Comandos Principais

- `help` - Mostra ajuda sobre comandos
- `login` - Autentica sua conta
- `review <arquivo>` - Analisa código e sugere melhorias
- `config <ação>` - Gerencia configurações
- `server <ação>` - Controla o servidor API local
- `clear` - Limpa a tela
- `exit` - Sai da CLI

### Exemplos

```bash
# Ver todos os comandos
help

# Login interativo
login

# Review de código
review src/index.ts

# Configurações
config list
config set theme dark
config edit

# Servidor API
server start
server status --port 8080
server stop
```

## 🌐 API Server

A CLI inclui um servidor API local construído com Elysia:

```bash
# Iniciar servidor
server start

# Ver status
server status

# Acessar dashboard
open http://localhost:3000
```

### Endpoints Disponíveis

- `GET /` - Dashboard web
- `GET /api/status` - Status da CLI
- `GET /api/info` - Informações do sistema
- `POST /api/command` - Executar comandos
- `GET /api/config` - Obter configurações
- `PUT /api/config` - Atualizar configurações
- `WS /ws` - WebSocket para updates em tempo real

## ⚙️ Configuração

A CLI suporta configurações persistentes salvas em `~/.pixel-cli/config.json`:

```json
{
  "theme": "dark",
  "language": "pt-BR",
  "serverPort": 3000,
  "autoStart": false,
  "notifications": true,
  "ui": {
    "showStatusBar": true,
    "animationsEnabled": true,
    "gradientType": "pixel"
  }
}
```

## 🎨 Temas de Gradiente

- `pixel` - Gradiente padrão colorido
- `neon` - Cores neon vibrantes
- `ocean` - Tons de azul e roxo
- `sunset` - Tons quentes de pôr do sol
- `aurora` - Cores suaves da aurora

## 🛠️ Desenvolvimento

```bash
# Modo desenvolvimento (hot reload)
bun run dev

# Build para produção
bun run build

# Executar testes
bun test
```

## 📁 Estrutura do Projeto

```
src/
├── index.ts              # Ponto de entrada
├── commands/             # Comandos da CLI
│   ├── base.command.ts
│   ├── help.command.ts
│   ├── login.command.ts
│   ├── review.command.ts
│   ├── server.command.ts
│   └── config.command.ts
├── services/             # Serviços centrais
│   ├── ui.service.ts
│   ├── gradient.service.ts
│   ├── statusbar.service.ts
│   ├── command.service.ts
│   └── config.service.ts
└── server/               # Servidor API
    └── api.server.ts
```

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

**Construído com ❤️ usando Bun + Elysia + TypeScript**
