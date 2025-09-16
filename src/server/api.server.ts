// src/server/api.server.ts
import { Elysia } from 'elysia';
import chalk from 'chalk';
import { AuthenticationService } from '../services/authentication.service';

export interface APIServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
}

export class APIServer {
  private app: Elysia;
  private isRunning: boolean = false;
  private port: number;
  private host: string;

  constructor(options: APIServerOptions = {}) {
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';

    this.app = new Elysia()
      .onStart(() => {
        console.log(chalk.green(`🚀 API Server rodando em http://${this.host}:${this.port}`));
      })
      .onStop(() => {
        console.log(chalk.gray('🛑 API Server parado'));
      });

    this.setupRoutes();
    this.setupWebSocket();

    if (options.cors) {
      this.setupCORS();
    }
  }

  private setupRoutes(): void {
    this.app
      // Status da CLI
      .get('/api/status', () => ({
        status: 'running',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }))

      // Informações do sistema
      .get('/api/info', () => ({
        platform: process.platform,
        node_version: process.version,
        cwd: process.cwd(),
        env: process.env.NODE_ENV || 'development'
      }))

      // Histórico de comandos
      .get('/api/history', ({ query }) => {
        // Em uma implementação real, isso viria de um serviço de histórico
        return {
          commands: [
            { command: 'help', timestamp: new Date().toISOString(), success: true },
            { command: 'login', timestamp: new Date().toISOString(), success: true },
            { command: 'review src/index.ts', timestamp: new Date().toISOString(), success: true },
          ],
          limit: query.limit || 10
        };
      })

      // Executar comando via API
      .post('/api/command', async ({ body }) => {
        const { command } = body as { command: string };

        if (!command) {
          return {
            success: false,
            error: 'Comando não fornecido'
          };
        }

        // Em uma implementação real, isso executaria o comando através do CommandService
        return {
          success: true,
          command,
          result: `Comando "${command}" executado via API`,
          timestamp: new Date().toISOString()
        };
      })

      // Configurações
      .get('/api/config', () => ({
        theme: 'dark',
        language: 'pt-BR',
        auto_save: true,
        notifications: true
      }))

      .put('/api/config', ({ body }) => {
        const config = body as Record<string, any>;

        // Em uma implementação real, isso salvaria as configurações
        return {
          success: true,
          message: 'Configurações atualizadas',
          config
        };
      })

      // Logs em tempo real
      .get('/api/logs', () => ({
        logs: [
          { level: 'info', message: 'CLI iniciada', timestamp: new Date().toISOString() },
          { level: 'debug', message: 'Comando executado: help', timestamp: new Date().toISOString() },
          { level: 'info', message: 'Usuario logado', timestamp: new Date().toISOString() },
        ]
      }))

      // Health check
      .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

      // Rotas de autenticação
      .get('/auth/:code', ({ params, set }) => {
        const { code } = params;
        const authService = AuthenticationService.getInstance();
        const session = authService.getSession(code);

        if (!session) {
          set.status = 404;
          return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Pixel CLI - Código Inválido</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #fff; padding: 40px; text-align: center; }
        .container { max-width: 500px; margin: 0 auto; }
        .error { background: #ff4444; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .code { font-family: 'Monaco', 'Courier New', monospace; font-size: 24px; background: #2a2a2a; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Pixel CLI</h1>
        <div class="error">
            <h3>❌ Código Inválido</h3>
            <p>O código <span class="code">${code}</span> não foi encontrado ou expirou.</p>
        </div>
        <p>Verifique se o código foi digitado corretamente ou gere um novo código no seu terminal.</p>
    </div>
</body>
</html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }

        if (session.verified) {
          return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Pixel CLI - Já Autenticado</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #fff; padding: 40px; text-align: center; }
        .container { max-width: 500px; margin: 0 auto; }
        .success { background: #44ff44; color: #000; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Pixel CLI</h1>
        <div class="success">
            <h3>✅ Já Autenticado</h3>
            <p>Este código já foi usado com sucesso.</p>
        </div>
        <p>Você pode fechar esta janela.</p>
    </div>
</body>
</html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }

        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Pixel CLI - Autenticação</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #fff; padding: 40px; text-align: center; }
        .container { max-width: 500px; margin: 0 auto; }
        .code { font-family: 'Monaco', 'Courier New', monospace; font-size: 32px; background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .btn { background: #007bff; color: white; border: none; padding: 15px 30px; border-radius: 8px; font-size: 18px; cursor: pointer; margin: 10px; }
        .btn:hover { background: #0056b3; }
        .success { background: #44ff44; color: #000; padding: 20px; border-radius: 8px; margin: 20px 0; display: none; }
        .form { background: #2a2a2a; padding: 30px; border-radius: 12px; margin: 20px 0; }
        input { background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 4px; width: 200px; margin: 10px; font-size: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Pixel CLI</h1>
        <p>Para completar a autenticação, confirme o código:</p>

        <div class="code">${code}</div>

        <div class="form">
            <h3>Autenticação</h3>
            <p>Insira suas credenciais Pixel:</p>
            <input type="email" id="email" placeholder="Email" required>
            <br>
            <input type="password" id="password" placeholder="Senha" required>
            <br>
            <button class="btn" onclick="authenticate()">Autenticar</button>
        </div>

        <div id="success" class="success">
            <h3>✅ Autenticação Concluída!</h3>
            <p>Você pode fechar esta janela e voltar ao terminal.</p>
        </div>
    </div>

    <script>
        async function authenticate() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (!email || !password) {
                alert('Por favor, preencha todos os campos.');
                return;
            }

            try {
                const response = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: '${code}', email, password })
                });

                const result = await response.json();

                if (result.success) {
                    document.querySelector('.form').style.display = 'none';
                    document.getElementById('success').style.display = 'block';
                } else {
                    alert('Credenciais inválidas. Tente novamente.');
                }
            } catch (error) {
                alert('Erro durante autenticação. Tente novamente.');
            }
        }
    </script>
</body>
</html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      })

      // Verificar código via API
      .post('/api/auth/verify', ({ body }) => {
        const { code, email, password } = body as { code: string; email: string; password: string };

        if (!code || !email || !password) {
          return {
            success: false,
            error: 'Campos obrigatórios não fornecidos'
          };
        }

        // Validar credenciais (em um caso real, isso seria uma validação real)
        const isValidUser = email.includes('@') && password.length >= 6;

        if (!isValidUser) {
          return {
            success: false,
            error: 'Credenciais inválidas'
          };
        }

        const authService = AuthenticationService.getInstance();
        const verified = authService.verifyCode(code, email);

        if (verified) {
          return {
            success: true,
            message: 'Autenticação realizada com sucesso',
            user: email
          };
        } else {
          return {
            success: false,
            error: 'Código inválido ou expirado'
          };
        }
      })

      // Interface web simples (opcional)
      .get('/', () => {
        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Pixel CLI Dashboard</title>
    <style>
        body { font-family: 'Courier New', monospace; background: #1a1a1a; color: #00ff41; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { background: #2a2a2a; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .gradient { background: linear-gradient(45deg, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        pre { background: #0a0a0a; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="gradient">PIXEL CLI Dashboard</h1>
        <div class="status">
            <h3>🚀 Status: Online</h3>
            <p>API Server rodando na porta ${this.port}</p>
        </div>
        <div class="status">
            <h3>🔗 Endpoints Disponíveis:</h3>
            <pre>
GET  /api/status     - Status da CLI
GET  /api/info       - Informações do sistema
GET  /api/history    - Histórico de comandos
POST /api/command    - Executar comando
GET  /api/config     - Obter configurações
PUT  /api/config     - Atualizar configurações
GET  /api/logs       - Logs em tempo real
GET  /health         - Health check
            </pre>
        </div>
    </div>
</body>
</html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      });
  }

  private setupWebSocket(): void {
    this.app.ws('/ws', {
      open: (ws) => {
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Conectado ao Pixel CLI WebSocket',
          timestamp: new Date().toISOString()
        }));
      },

      message: (ws, message) => {
        try {
          const data = JSON.parse(message.toString());

          // Echo do comando para todos os clientes conectados
          ws.publish('cli-updates', JSON.stringify({
            type: 'command',
            command: data.command,
            timestamp: new Date().toISOString()
          }));

        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Formato de mensagem inválido',
            timestamp: new Date().toISOString()
          }));
        }
      },

      close: (ws) => {
        console.log(chalk.dim('WebSocket desconectado'));
      }
    });
  }

  private setupCORS(): void {
    // CORS já é habilitado por padrão no Elysia
    // Mas podemos customizar se necessário
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Servidor já está rodando');
    }

    try {
      this.app.listen(this.port);
      this.isRunning = true;
    } catch (error) {
      console.error(chalk.red('Erro ao iniciar servidor API:'), error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.app.stop();
      this.isRunning = false;
    } catch (error) {
      console.error(chalk.red('Erro ao parar servidor API:'), error);
      throw error;
    }
  }

  getPort(): number {
    return this.port;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  // Método para broadcast de eventos para WebSocket
  broadcast(type: string, data: any): void {
    // Em uma implementação mais completa, manteriamos uma lista de conexões WebSocket
    console.log(chalk.dim(`Broadcasting: ${type}`, data));
  }
}