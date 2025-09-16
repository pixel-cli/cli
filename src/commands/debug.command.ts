// src/commands/debug.command.ts
import { BaseCommand } from './base.command';
import { debugLogger } from '../utils/debug-logger';
import { ConfigService } from '../services/config.service';
import chalk from 'chalk';

export class DebugCommand extends BaseCommand {
  name = 'debug';
  description = 'Gerenciar modo debug e visualizar logs detalhados';
  usage = `
${chalk.cyan('debug')}                    - Mostrar status atual do debug
${chalk.cyan('debug on')}                 - Ativar modo debug
${chalk.cyan('debug off')}                - Desativar modo debug
${chalk.cyan('debug level <level>')}      - Definir nível de debug (error|warn|info|debug)
${chalk.cyan('debug status')}             - Mostrar configuração atual
${chalk.cyan('debug test')}               - Testar todos os níveis de logging
  `;

  private configService: ConfigService;

  constructor() {
    super();
    this.configService = ConfigService.getInstance();
  }

  async execute(args: string[]): Promise<void> {
    const subcommand = args[0]?.toLowerCase();

    try {
      switch (subcommand) {
        case undefined:
        case 'status':
          await this.showStatus();
          break;

        case 'on':
        case 'enable':
          await this.enableDebug();
          break;

        case 'off':
        case 'disable':
          await this.disableDebug();
          break;

        case 'level':
          await this.setLevel(args[1]);
          break;

        case 'test':
          await this.testLogging();
          break;

        default:
          this.showUsage();
          break;
      }
    } catch (error) {
      console.error(chalk.red('Erro no comando debug:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async showStatus(): Promise<void> {
    const isEnabled = this.configService.isDebugEnabled();
    const level = this.configService.getDebugLevel();
    const showStack = this.configService.shouldShowStackTrace();

    console.log(chalk.cyan('=== STATUS DO DEBUG ==='));
    console.log(`Estado: ${isEnabled ? chalk.green('ATIVADO') : chalk.red('DESATIVADO')}`);
    console.log(`Nível: ${chalk.yellow(level.toUpperCase())}`);
    console.log(`Stack Trace: ${showStack ? chalk.green('SIM') : chalk.red('NÃO')}`);
    console.log(chalk.cyan('======================='));

    if (isEnabled) {
      console.log(chalk.dim('\\n💡 Dica: Use "debug off" para desativar ou "debug level <level>" para alterar o nível'));
    } else {
      console.log(chalk.dim('\\n💡 Dica: Use "debug on" para ativar o modo debug'));
    }
  }

  private async enableDebug(): Promise<void> {
    try {
      await debugLogger.enableDebug();
      console.log(chalk.green('✅ Debug mode ativado!'));
      console.log(chalk.dim('Agora você verá logs detalhados das operações.'));
    } catch (error) {
      console.error(chalk.red('❌ Erro ao ativar debug mode:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async disableDebug(): Promise<void> {
    await debugLogger.disableDebug();
    console.log(chalk.blue('ℹ️  Debug mode desativado.'));
    console.log(chalk.dim('Apenas erros críticos serão exibidos.'));
  }

  private async setLevel(level?: string): Promise<void> {
    if (!level) {
      console.error(chalk.red('❌ Nível não especificado.'));
      console.log(chalk.dim('Níveis disponíveis: error, warn, info, debug'));
      return;
    }

    const validLevels = ['error', 'warn', 'info', 'debug'] as const;
    const normalizedLevel = level.toLowerCase();

    if (!validLevels.includes(normalizedLevel as any)) {
      console.error(chalk.red(`❌ Nível inválido: "${level}"`));
      console.log(chalk.dim(`Níveis válidos: ${validLevels.join(', ')}`));
      return;
    }

    await debugLogger.setLogLevel(normalizedLevel as any);
    console.log(chalk.green(`✅ Nível de debug definido para: ${chalk.yellow(normalizedLevel.toUpperCase())}`));
  }

  private async testLogging(): Promise<void> {
    console.log(chalk.cyan('=== TESTE DE LOGGING ==='));
    console.log(chalk.dim('Testando todos os níveis de log...\\n'));

    debugLogger.error('Teste de erro', new Error('Este é um erro de teste'));

    await new Promise(resolve => setTimeout(resolve, 100));
    debugLogger.warn('Teste de warning', 'Este é um warning de teste');

    await new Promise(resolve => setTimeout(resolve, 100));
    debugLogger.info('Teste de informação', { testData: 'informação de teste', timestamp: new Date() });

    await new Promise(resolve => setTimeout(resolve, 100));
    debugLogger.debug('Teste de debug', {
      message: 'Este é um debug de teste',
      data: { nested: { value: 42 } },
      array: [1, 2, 3, 'test']
    });

    console.log(chalk.cyan('\\n=== TESTE COMPLETO ==='));
    console.log(chalk.dim('Se você não viu alguns logs, verifique se o nível de debug está apropriado.'));
  }

  showUsage(): void {
    console.log(this.usage);
  }
}