// src/commands/daemon.command.ts
import { BaseCommand, CommandOptions } from './base.command';
import { DaemonService } from '../services/daemon.service';
import chalk from 'chalk';

export class DaemonCommand extends BaseCommand {
  private daemonService: DaemonService;

  constructor() {
    super();
    this.daemonService = new DaemonService();
  }

  get name(): string {
    return 'daemon';
  }

  get description(): string {
    return 'Gerencia o daemon do Pixel CLI em background';
  }

  get usage(): string {
    return 'daemon <start|stop|status|restart>';
  }

  async execute(args: string[], options: CommandOptions): Promise<void> {
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const command = args[0].toLowerCase();

    switch (command) {
      case 'start':
        await this.startDaemon();
        break;
      case 'stop':
        await this.stopDaemon();
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'restart':
        await this.restartDaemon();
        break;
      default:
        this.ui.showError(`Comando desconhecido: ${command}`);
        this.showHelp();
    }
  }

  private async startDaemon(): Promise<void> {
    try {
      if (this.daemonService.isRunning()) {
        this.ui.showWarning('✅ Daemon já está rodando');
        return;
      }

      this.ui.showInfo('🤖 Iniciando Pixel CLI daemon...');

      await this.daemonService.start();
      this.ui.showSuccess('✅ Daemon iniciado em background');

      console.log(chalk.dim('📁 Monitorando conversas do Claude Code'));
      console.log(chalk.dim('🛑 Para parar: pixel daemon stop'));

    } catch (error) {
      this.ui.showError(`Erro ao iniciar daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async stopDaemon(): Promise<void> {
    try {
      if (!this.daemonService.isRunning()) {
        this.ui.showWarning('❌ Daemon não está rodando');
        return;
      }

      this.ui.showInfo('🛑 Parando daemon...');

      await this.daemonService.stop();
      this.ui.showSuccess('✅ Daemon parado');

    } catch (error) {
      this.ui.showError(`Erro ao parar daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async restartDaemon(): Promise<void> {
    try {
      this.ui.showInfo('🔄 Reiniciando daemon...');

      if (this.daemonService.isRunning()) {
        await this.daemonService.stop();
        this.ui.showInfo('🛑 Daemon parado');
      }

      // Aguardar um momento antes de reiniciar
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.daemonService.start();
      this.ui.showSuccess('✅ Daemon reiniciado');

    } catch (error) {
      this.ui.showError(`Erro ao reiniciar daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async showStatus(): Promise<void> {
    const isRunning = this.daemonService.isRunning();

    console.log('\n📊 Status do Pixel CLI Daemon');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (isRunning) {
      this.ui.showSuccess('✅ Daemon está rodando');
      const pid = this.daemonService.getPid();
      if (pid) {
        console.log(chalk.dim(`📊 PID: ${pid}`));
      }

      const logFile = this.daemonService.getLogFile();
      if (logFile) {
        console.log(chalk.dim(`📝 Logs: ${logFile}`));
      }
    } else {
      this.ui.showWarning('❌ Daemon não está rodando');
      console.log(chalk.dim('🚀 Para iniciar: pixel daemon start'));
    }

    // Show detection info
    console.log('\n📊 Claude Code Detection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await this.showClaudeCodeStatus();
  }

  private async showClaudeCodeStatus(): Promise<void> {
    try {
      const homeDir = process.env.HOME;
      if (!homeDir) {
        this.ui.showWarning('❌ Diretório home não encontrado');
        return;
      }

      const claudeDir = Bun.file(`${homeDir}/.claude/projects`);

      if (await claudeDir.exists()) {
        this.ui.showSuccess('✅ Claude Code detectado');

        // Count conversations
        const projectsPath = `${homeDir}/.claude/projects`;
        const entries = await Bun.file(projectsPath).exists() ? await Bun.$`ls ${projectsPath}`.text() : '';
        const projectDirs = entries.trim().split('\n').filter(d => d.trim());

        let totalConversations = 0;
        for (const dir of projectDirs) {
          if (!dir.trim()) continue;
          try {
            const dirPath = `${projectsPath}/${dir}`;
            const files = await Bun.$`ls ${dirPath} 2>/dev/null || echo ""`.text();
            const jsonlFiles = files.split('\n').filter(f => f.endsWith('.jsonl'));
            totalConversations += jsonlFiles.length;
          } catch {
            // Skip directories we can't access
          }
        }

        console.log(chalk.dim(`📁 Encontrados ${totalConversations} arquivos de conversa`));
      } else {
        this.ui.showWarning('❌ Claude Code não encontrado');
        console.log(chalk.dim('💡 Instale com: npm install -g @anthropic-ai/claude-code'));
      }
    } catch (error) {
      this.ui.showError(`Erro ao verificar Claude Code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  protected showHelp(): void {
    console.log(`
${chalk.bold('Comando:')} ${this.name}
${chalk.bold('Descrição:')} ${this.description}
${chalk.bold('Uso:')} ${this.usage}

${chalk.bold('Subcomandos:')}
  ${chalk.cyan('start')}     - Inicia o daemon em background
  ${chalk.cyan('stop')}      - Para o daemon
  ${chalk.cyan('status')}    - Mostra o status do daemon
  ${chalk.cyan('restart')}   - Reinicia o daemon

${chalk.bold('Exemplos:')}
  pixel daemon start          # Inicia daemon
  pixel daemon status         # Verifica status
  pixel daemon stop           # Para daemon
    `);
  }
}