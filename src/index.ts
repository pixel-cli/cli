#!/usr/bin/env bun
// index.ts
import { UIService } from './services/ui.service';
import { CommandService } from './services/command.service';
import { ClaudeCodeService } from './services/claude-code.service';
import { DaemonService } from './services/daemon.service';
import { MenuService } from './services/menu.service';
import { TerminalService } from './services/terminal.service';
import { debugLogger } from './utils/debug-logger';
import chalk from 'chalk';

class PixelCLI {
  private ui: UIService;
  private commandService: CommandService;
  private claudeService: ClaudeCodeService;
  private menuService: MenuService;
  private terminalService: TerminalService | null = null;
  private selectedMode: 'pixel-login' | 'claude-code' | null = null;

  constructor() {
    debugLogger.debug('Initializing Pixel CLI');
    this.ui = new UIService();
    this.commandService = new CommandService();
    this.claudeService = new ClaudeCodeService();
    this.menuService = new MenuService();
    debugLogger.debug('Pixel CLI components initialized');
  }

  async start(): Promise<void> {
    try {
      debugLogger.info('Pixel CLI starting up');

      // Configurar handlers de sinal
      debugLogger.debug('Setting up signal handlers');
      this.setupSignalHandlers();

      // Mostrar menu inicial
      debugLogger.debug('Showing initial menu');
      this.selectedMode = await this.menuService.showInitialMenu();
      this.menuService.showModeSelected(this.selectedMode);

      // Executar modo selecionado
      if (this.selectedMode === 'pixel-login') {
        await this.handlePixelLogin();
      } else {
        // Conectar ao Claude Code
        debugLogger.debug('Initializing Claude Code connection');
        await this.initializeClaudeCode();

        // Se Claude Code conectou, usar terminal fixo
        if (this.claudeService.isReady()) {
          await this.startFixedTerminal();
        } else {
          // Fallback para interface tradicional
          await this.ui.showBanner();
          await this.mainLoop();
        }
      }

    } catch (error) {
      console.error(chalk.red('\n=== ERRO FATAL ==='));
      if (error instanceof Error) {
        console.error(chalk.red(`Mensagem: ${error.message}`));
        if (error.stack) {
          console.error(chalk.red('Stack trace:'));
          console.error(chalk.red(error.stack));
        }
      } else {
        console.error(chalk.red('Erro desconhecido:'), error);
      }
      console.error(chalk.red('=================='));
      process.exit(1);
    }
  }

  private async startFixedTerminal(): Promise<void> {
    try {
      console.clear();
      console.log(chalk.green('✅ Claude Code conectado!'));
      console.log(chalk.gray('Iniciando interface de terminal fixo...'));

      // Pequena pausa para o usuário ver a mensagem
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.terminalService = new TerminalService({
        onInput: async (input: string) => {
          try {
            const response = await this.claudeService.sendMessage(input);
            if (this.terminalService && response) {
              this.terminalService.addClaudeMessage(response);
            }
          } catch (error) {
            if (this.terminalService) {
              this.terminalService.addSystemMessage(`Erro: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        },
        onExit: () => {
          this.gracefulExit();
        }
      });

      this.terminalService.start();

    } catch (error) {
      console.error(chalk.red('Erro ao iniciar terminal fixo:'), error);
      console.log(chalk.gray('Voltando para interface tradicional...'));
      await this.ui.showBanner();
      await this.mainLoop();
    }
  }

  private async handlePixelLogin(): Promise<void> {
    try {
      // Importar LoginCommand dinamicamente para evitar dependência circular
      const { LoginCommand } = await import('./commands/login.command');
      const loginCommand = new LoginCommand();

      // Executar comando de login
      await loginCommand.execute([], {});

      // Após login, mostrar banner simplificado
      await this.ui.showBanner();

    } catch (error) {
      console.error(chalk.red('Erro durante login:'), error);
      console.log(chalk.gray('Continuando em modo Claude Code...'));
      await this.ui.showBanner();
      await this.initializeClaudeCode();
    }
  }

  private async initializeClaudeCode(): Promise<void> {
    try {
      debugLogger.debug('Starting Claude Code initialization');
      this.ui.showInfo('Conectando ao Claude Code...');

      debugLogger.debug('Attempting Claude Code connection');
      const connected = await this.claudeService.connect();

      if (connected) {
        debugLogger.info('Claude Code connected successfully');
        this.ui.showSuccess('✨ Conectado ao Claude Code! Agora você pode conversar diretamente comigo.');
        console.log(chalk.dim('💡 Dicas:'));
        console.log(chalk.dim('   • Use comandos do sistema com ":" (ex: :config, :server, :help)'));
        console.log(chalk.dim('   • Use "/" para comandos rápidos (/exit, /quit, /help)'));
        console.log(chalk.dim('   • Use Ctrl+D, Ctrl+Q ou Ctrl+C para sair'));
        console.log('');
      } else {
        debugLogger.warn('Claude Code connection failed - running in traditional mode');
        this.ui.showWarning('⚠️  Claude Code não encontrado. Funcionando no modo tradicional de comandos.');
        console.log(chalk.dim('📦 Para instalar o Claude Code: npm install -g @anthropic-ai/claude-code'));
        console.log(chalk.dim('💡 Experimente o comando "daemon" para funcionalidades avançadas'));
        console.log('');
      }
    } catch (error) {
      debugLogger.error('Claude Code initialization error', error);
      this.ui.showError(`Erro ao conectar com Claude Code: ${error instanceof Error ? error.message : String(error)}`);
      console.log(chalk.dim('🔄 Continuando no modo de comandos tradicionais...'));
    }
  }

  private async mainLoop(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // Use different prompt based on Claude availability
        let input: string;
        if (this.claudeService.isReady()) {
          input = await this.ui.promptForClaudeInput();
        } else {
          input = await this.ui.promptForCommand();
        }

        if (input.trim()) {
          await this.processInput(input.trim());
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('canceled')) {
          // User pressed Ctrl+C
          console.log(chalk.gray('\n\nAté a próxima! 👋'));
          await this.cleanup();
          process.exit(0);
        } else {
          console.error(chalk.red('\n=== ERRO NO MAIN LOOP ==='));
          if (error instanceof Error) {
            console.error(chalk.red(`Mensagem: ${error.message}`));
            if (error.stack) {
              console.error(chalk.red('Stack trace:'));
              console.error(chalk.red(error.stack));
            }
          } else {
            console.error(chalk.red('Erro desconhecido:'), error);
          }
          console.error(chalk.red('========================='));
        }
      }
    }
  }

  private async processInput(input: string): Promise<void> {
    debugLogger.debug('Processing input', { input: input.substring(0, 100), isClaudeReady: this.claudeService.isReady() });

    // Verificar comandos de saída
    if (this.isExitCommand(input)) {
      console.log(chalk.gray('\n\nAté a próxima! 👋'));
      await this.gracefulExit();
      return;
    }

    // Se Claude Code está conectado, enviar tudo para ele (exceto comandos de sistema)
    if (this.claudeService.isReady()) {
      try {
        debugLogger.debug('Sending input to Claude Code');
        // Update status to show Claude is thinking
        this.ui.updateStatusBar({ mode: 'thinking', status: '🤔' });

        const response = await this.claudeService.sendMessage(input, (chunk) => {
          // Stream response chunks to UI
          this.ui.streamClaudeResponse(chunk);
        });

        // Always finish streaming (handles separators)
        this.ui.finishClaudeStreaming();

        // If response is empty, Claude might have handled a system command
        if (!response.trim()) {
          this.ui.updateStatusBar({ mode: 'ready', status: '✅' });
          return;
        }

        // Always show the response properly, regardless of streaming
        if (response) {
          // Start streaming manually if it didn't happen automatically
          this.ui.startClaudeStreaming();

          // Handle different response types
          let responseText: string;
          if (typeof response === 'string') {
            responseText = response;
          } else if (typeof response === 'object' && response !== null) {
            // Format JSON responses nicely
            responseText = JSON.stringify(response, null, 2);
          } else {
            responseText = String(response);
          }

          // Stream the formatted text character by character for better UX
          for (let i = 0; i < responseText.length; i += 50) {
            const chunk = responseText.slice(i, i + 50);
            this.ui.streamClaudeResponse(chunk);
            // Small delay for smooth streaming effect
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          this.ui.finishClaudeStreaming();
        }

        this.ui.updateStatusBar({ mode: 'ready', status: '✅' });

      } catch (error) {
        console.error(chalk.red('\n=== ERRO DO CLAUDE CODE ==='));
        if (error instanceof Error) {
          console.error(chalk.red(`Mensagem: ${error.message}`));
          if (error.stack) {
            console.error(chalk.red('Stack trace:'));
            console.error(chalk.red(error.stack));
          }
        } else {
          console.error(chalk.red('Erro desconhecido:'), error);
        }
        console.error(chalk.red('============================'));

        const errorMessage = error instanceof Error ? error.message :
                            typeof error === 'object' && error !== null ? JSON.stringify(error) :
                            String(error);
        this.ui.showError(`Erro no Claude Code: ${errorMessage}`);
        this.ui.updateStatusBar({ mode: 'error', status: '❌' });

        // Fallback para comando tradicional se Claude falhar
        console.log(chalk.dim('Tentando executar como comando tradicional...'));
        try {
          await this.commandService.executeCommand(input);
        } catch (fallbackError) {
          console.error(chalk.yellow('\n=== ERRO DO FALLBACK ==='));
          if (fallbackError instanceof Error) {
            console.error(chalk.yellow(`Mensagem: ${fallbackError.message}`));
            if (fallbackError.stack) {
              console.error(chalk.yellow('Stack trace:'));
              console.error(chalk.yellow(fallbackError.stack));
            }
          } else {
            const fallbackMessage = typeof fallbackError === 'object' && fallbackError !== null ?
                                  JSON.stringify(fallbackError) : String(fallbackError);
            console.error(chalk.yellow('Erro desconhecido:'), fallbackMessage);
          }
          console.error(chalk.yellow('========================'));

          // Se até o fallback falhar, sugerir comando correto
          this.ui.showWarning(`Comando não reconhecido. Tente ":help" para comandos de sistema ou digite uma mensagem para o Claude.`);
        }
      }
    } else {
      // Modo de comando tradicional
      await this.commandService.executeCommand(input);
    }
  }

  private async cleanup(): Promise<void> {
    await this.safeCleanup();
  }

  private async safeCleanup(): Promise<void> {
    try {
      debugLogger.debug('Starting cleanup process');

      // Stop terminal service
      if (this.terminalService) {
        try {
          this.terminalService.stop();
          debugLogger.debug('Terminal service stopped');
        } catch (error) {
          debugLogger.warn('Failed to stop terminal service', error);
        }
      }

      // Disconnect Claude Code service
      if (this.claudeService.isReady()) {
        try {
          console.log(chalk.dim('Desconectando do Claude Code...'));
          await Promise.race([
            this.claudeService.disconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          debugLogger.debug('Claude Code disconnected');
        } catch (error) {
          debugLogger.warn('Failed to disconnect Claude Code', error);
        }
      }

      // Clean up UI
      try {
        this.ui.cleanup();
        debugLogger.debug('UI cleaned up');
      } catch (error) {
        debugLogger.warn('Failed to cleanup UI', error);
      }

      debugLogger.debug('Cleanup process completed');
    } catch (error) {
      debugLogger.error('Error during cleanup', error);
      // Don't throw - we want cleanup to always complete
    }
  }

  private async gracefulExit(): Promise<void> {
    await this.safeCleanup();
    process.exit(0);
  }

  private isExitCommand(input: string): boolean {
    const cleanInput = input.toLowerCase().trim();
    const exitCommands = [
      '/exit', '/quit', '/q',
      'exit', 'quit', 'sair',
      ':exit', ':quit', ':q'
    ];
    return exitCommands.includes(cleanInput);
  }

  private setupSignalHandlers(): void {
    // Não usar raw mode pois interfere com enquirer
    // Capturar apenas os sinais principais

    // Handler para Ctrl+C
    process.on('SIGINT', async () => {
      console.log(chalk.gray('\n\nAté a próxima! 👋'));
      await this.safeCleanup();
      process.exit(0);
    });

    // Handler para SIGTERM
    process.on('SIGTERM', async () => {
      console.log(chalk.gray('\nEncerrando Pixel CLI...'));
      await this.safeCleanup();
      process.exit(0);
    });

    // Handler para erros não capturados
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('\n=== ERRO NÃO TRATADO ==='));
      console.error(chalk.red(`Mensagem: ${error.message}`));

      debugLogger.error('Uncaught exception', error);

      if (error.stack) {
        console.error(chalk.red('Stack trace:'));
        console.error(chalk.red(error.stack));
      }
      console.error(chalk.red('========================'));

      await this.safeCleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error(chalk.red('\n=== PROMISE REJEITADA ==='));

      debugLogger.error('Unhandled rejection', reason);

      if (reason instanceof Error) {
        console.error(chalk.red(`Mensagem: ${reason.message}`));
        if (reason.stack) {
          console.error(chalk.red('Stack trace:'));
          console.error(chalk.red(reason.stack));
        }
      } else {
        console.error(chalk.red('Razão:'), reason);
      }
      console.error(chalk.red('========================='));

      await this.safeCleanup();
      process.exit(1);
    });

    // Handle process warnings
    process.on('warning', (warning) => {
      debugLogger.warn('Process warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }
}

// Check for daemon mode
if (process.argv.includes('--daemon-mode')) {
  // Run in daemon mode
  console.log('Starting Pixel CLI in daemon mode...');
  const daemonService = new DaemonService();
  daemonService.startMonitoring().catch(console.error);
} else {
  // Run in normal mode
  const app = new PixelCLI();
  app.start();
}