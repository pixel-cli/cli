// src/commands/server.command.ts
import { BaseCommand, CommandOptions } from './base.command';
import { APIServer } from '../server/api.server';
import { GradientService } from '../services/gradient.service';
import chalk from 'chalk';

export class ServerCommand extends BaseCommand {
  private static serverInstance: APIServer | null = null;

  get name(): string { return 'server'; }
  get description(): string { return 'Gerencia o servidor API local'; }
  get usage(): string { return 'server <start|stop|status|restart> [--port <number>]'; }

  async execute(args: string[], options: CommandOptions): Promise<void> {
    const action = args[0];

    if (!action) {
      this.showHelp();
      return;
    }

    switch (action.toLowerCase()) {
      case 'start':
        await this.startServer(options);
        break;
      case 'stop':
        await this.stopServer();
        break;
      case 'status':
        this.showServerStatus();
        break;
      case 'restart':
        await this.restartServer(options);
        break;
      default:
        this.ui.showError(`Ação "${action}" não reconhecida.`);
        this.showHelp();
    }
  }

  private async startServer(options: CommandOptions): Promise<void> {
    if (ServerCommand.serverInstance?.isServerRunning()) {
      this.ui.showWarning('Servidor já está rodando!');
      return;
    }

    const port = options.port ? parseInt(options.port) : 3000;

    console.log(`
${GradientService.createLine('🚀 Iniciando Servidor API')}
    `);

    try {
      const loading = this.ui.showLoading('Iniciando servidor...');

      ServerCommand.serverInstance = new APIServer({ port, cors: true });
      await ServerCommand.serverInstance.start();

      this.ui.clearLoading();
      this.ui.showSuccess(`Servidor iniciado na porta ${port}`);

      console.log(`
${chalk.bold('🌐 Endpoints disponíveis:')}

${GradientService.createLine('•')} Dashboard: ${chalk.cyan(`http://localhost:${port}`)}
${GradientService.createLine('•')} API Status: ${chalk.cyan(`http://localhost:${port}/api/status`)}
${GradientService.createLine('•')} WebSocket: ${chalk.cyan(`ws://localhost:${port}/ws`)}
${GradientService.createLine('•')} Health: ${chalk.cyan(`http://localhost:${port}/health`)}

${chalk.dim('Use "server stop" para parar o servidor')}
      `);

      this.ui.updateStatusBar({ status: '🌐' });

    } catch (error) {
      this.ui.clearLoading();
      this.ui.showError(`Falha ao iniciar servidor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async stopServer(): Promise<void> {
    if (!ServerCommand.serverInstance?.isServerRunning()) {
      this.ui.showWarning('Nenhum servidor rodando.');
      return;
    }

    try {
      const loading = this.ui.showLoading('Parando servidor...');

      await ServerCommand.serverInstance.stop();

      this.ui.clearLoading();
      this.ui.showSuccess('Servidor parado com sucesso');
      this.ui.updateStatusBar({ status: '✅' });

    } catch (error) {
      this.ui.clearLoading();
      this.ui.showError(`Erro ao parar servidor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private showServerStatus(): void {
    const isRunning = ServerCommand.serverInstance?.isServerRunning() ?? false;
    const port = ServerCommand.serverInstance?.getPort() ?? 'N/A';

    console.log(`
${GradientService.createLine('📊 Status do Servidor')}

${chalk.bold('Estado:')} ${isRunning ? chalk.green('🟢 Rodando') : chalk.red('🔴 Parado')}
${chalk.bold('Porta:')} ${port}
${chalk.bold('URL:')} ${isRunning ? chalk.cyan(`http://localhost:${port}`) : chalk.dim('Indisponível')}

${isRunning ? chalk.dim('Use "server stop" para parar') : chalk.dim('Use "server start" para iniciar')}
    `);
  }

  private async restartServer(options: CommandOptions): Promise<void> {
    this.ui.showInfo('Reiniciando servidor...');

    if (ServerCommand.serverInstance?.isServerRunning()) {
      await this.stopServer();
      // Pequena pausa para garantir que o servidor parou
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.startServer(options);
  }

  protected showHelp(): void {
    console.log(`
${GradientService.createLine('📖 Ajuda - Comando Server')}

${chalk.bold('Uso:')} server <ação> [opções]

${chalk.bold('Ações:')}
  ${chalk.cyan('start')}      - Inicia o servidor API
  ${chalk.cyan('stop')}       - Para o servidor API
  ${chalk.cyan('status')}     - Mostra status do servidor
  ${chalk.cyan('restart')}    - Reinicia o servidor

${chalk.bold('Opções:')}
  ${chalk.cyan('--port')} <número>  - Define a porta (padrão: 3000)

${chalk.bold('Exemplos:')}
  ${chalk.dim('server start')}
  ${chalk.dim('server start --port 8080')}
  ${chalk.dim('server status')}
  ${chalk.dim('server stop')}
    `);
  }
}