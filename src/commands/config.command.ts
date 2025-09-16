// src/commands/config.command.ts
import { BaseCommand, CommandOptions } from './base.command';
import { ConfigService } from '../services/config.service';
import { GradientService } from '../services/gradient.service';
import enquirer from 'enquirer';
import chalk from 'chalk';

export class ConfigCommand extends BaseCommand {
  private configService: ConfigService;

  constructor() {
    super();
    this.configService = ConfigService.getInstance();
  }

  get name(): string { return 'config'; }
  get description(): string { return 'Gerencia configurações do Pixel CLI'; }
  get usage(): string { return 'config <get|set|list|reset|export|import> [chave] [valor]'; }

  async execute(args: string[], options: CommandOptions): Promise<void> {
    const action = args[0];

    if (!action) {
      this.showHelp();
      return;
    }

    switch (action.toLowerCase()) {
      case 'list':
        this.listConfigs();
        break;
      case 'get':
        await this.getConfig(args[1]);
        break;
      case 'set':
        await this.setConfig(args[1], args.slice(2).join(' '));
        break;
      case 'reset':
        await this.resetConfig(args[1]);
        break;
      case 'export':
        this.exportConfig();
        break;
      case 'import':
        await this.importConfig();
        break;
      case 'edit':
        await this.interactiveEdit();
        break;
      default:
        this.ui.showError(`Ação "${action}" não reconhecida.`);
        this.showHelp();
    }
  }

  private listConfigs(): void {
    const config = this.configService.getAll();
    const border = GradientService.createBorder(70);

    console.log(`
${border.top}
${GradientService.createLine('  ⚙️ Configurações do Pixel CLI  ')}
${border.bottom}

${chalk.bold('📊 Configurações Atuais:')}

${chalk.cyan('theme')}          ${config.theme}
${chalk.cyan('language')}       ${config.language}
${chalk.cyan('serverPort')}     ${config.serverPort}
${chalk.cyan('autoStart')}      ${config.autoStart}
${chalk.cyan('notifications')}  ${config.notifications}
${chalk.cyan('historyLimit')}   ${config.historyLimit}

${chalk.bold('🎨 Interface:')}

${chalk.cyan('showStatusBar')}      ${config.ui.showStatusBar}
${chalk.cyan('animationsEnabled')}  ${config.ui.animationsEnabled}
${chalk.cyan('gradientType')}       ${config.ui.gradientType}

${config.apiKey ? chalk.bold('🔐 API:') : ''}
${config.apiKey ? `${chalk.cyan('apiKey')}         ${'*'.repeat(20)}` : ''}

${config.user ? chalk.bold('👤 Usuário:') : ''}
${config.user ? `${chalk.cyan('name')}            ${config.user.name}` : ''}
${config.user ? `${chalk.cyan('email')}           ${config.user.email}` : ''}

${chalk.dim('Arquivo de configuração: ' + this.configService.getConfigPath())}
    `);
  }

  private async getConfig(key: string): Promise<void> {
    if (!key) {
      this.ui.showError('Especifique uma chave para consultar');
      return;
    }

    try {
      const value = this.configService.get(key as any);

      if (value !== undefined) {
        console.log(`
${GradientService.createLine(`📋 ${key}`)}

${chalk.bold('Valor:')} ${typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
        `);
      } else {
        this.ui.showError(`Chave "${key}" não encontrada`);
      }
    } catch (error) {
      this.ui.showError(`Erro ao obter configuração: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async setConfig(key: string, value: string): Promise<void> {
    if (!key || value === undefined) {
      this.ui.showError('Especifique chave e valor');
      this.ui.showInfo('Uso: config set <chave> <valor>');
      return;
    }

    try {
      // Converter valor baseado na chave
      let parsedValue: any = value;

      if (['autoStart', 'notifications', 'showStatusBar', 'animationsEnabled'].includes(key)) {
        parsedValue = ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      } else if (['serverPort', 'historyLimit'].includes(key)) {
        parsedValue = parseInt(value);
        if (isNaN(parsedValue)) {
          throw new Error('Valor deve ser um número');
        }
      }

      // Validações específicas
      if (key === 'theme' && !this.configService.isValidTheme(value)) {
        throw new Error('Tema deve ser: dark, light ou auto');
      }

      if (key === 'language' && !this.configService.isValidLanguage(value)) {
        throw new Error('Idioma deve ser: pt-BR, en-US ou es-ES');
      }

      if (key === 'gradientType' && !this.configService.isValidGradientType(value)) {
        throw new Error('Tipo de gradiente deve ser: pixel, neon, ocean, sunset ou aurora');
      }

      await this.configService.set(key as any, parsedValue);
      this.ui.showSuccess(`Configuração "${key}" atualizada para: ${parsedValue}`);

    } catch (error) {
      this.ui.showError(`Erro ao definir configuração: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async resetConfig(key?: string): Promise<void> {
    if (key) {
      try {
        await this.configService.resetKey(key as any);
        this.ui.showSuccess(`Configuração "${key}" restaurada ao padrão`);
      } catch (error) {
        this.ui.showError(`Erro ao resetar configuração: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      try {
        const { confirm }: { confirm: boolean } = await enquirer.prompt({
          type: 'confirm',
          name: 'confirm',
          message: 'Deseja resetar TODAS as configurações? Esta ação não pode ser desfeita.',
          initial: false
        });

        if (confirm) {
          await this.configService.reset();
          this.ui.showSuccess('Todas as configurações foram resetadas');
        } else {
          this.ui.showInfo('Reset cancelado');
        }
      } catch (error) {
        this.ui.showWarning('Reset cancelado');
      }
    }
  }

  private exportConfig(): void {
    const configJson = this.configService.exportConfig();

    console.log(`
${GradientService.createLine('📤 Exportar Configuração')}

${chalk.dim('Copie o JSON abaixo:')}

${chalk.gray('```json')}
${configJson}
${chalk.gray('```')}
    `);

    this.ui.showSuccess('Configuração exportada! Salve o JSON em um local seguro.');
  }

  private async importConfig(): Promise<void> {
    try {
      const { configJson }: { configJson: string } = await enquirer.prompt({
        type: 'input',
        name: 'configJson',
        message: 'Cole o JSON da configuração:',
        multiline: true,
        validate: (input: string) => {
          try {
            JSON.parse(input);
            return true;
          } catch {
            return 'JSON inválido';
          }
        }
      });

      await this.configService.importConfig(configJson);
      this.ui.showSuccess('Configuração importada com sucesso!');

    } catch (error) {
      if (error instanceof Error && !error.message.includes('canceled')) {
        this.ui.showError(`Erro ao importar: ${error.message}`);
      } else {
        this.ui.showInfo('Importação cancelada');
      }
    }
  }

  private async interactiveEdit(): Promise<void> {
    try {
      const config = this.configService.getAll();

      const responses = await enquirer.prompt([
        {
          type: 'select',
          name: 'theme',
          message: 'Tema:',
          choices: ['dark', 'light', 'auto'],
          initial: config.theme
        },
        {
          type: 'select',
          name: 'language',
          message: 'Idioma:',
          choices: ['pt-BR', 'en-US', 'es-ES'],
          initial: config.language
        },
        {
          type: 'numeral',
          name: 'serverPort',
          message: 'Porta do servidor:',
          initial: config.serverPort
        },
        {
          type: 'confirm',
          name: 'autoStart',
          message: 'Iniciar servidor automaticamente?',
          initial: config.autoStart
        },
        {
          type: 'confirm',
          name: 'notifications',
          message: 'Habilitar notificações?',
          initial: config.notifications
        },
        {
          type: 'select',
          name: 'gradientType',
          message: 'Tipo de gradiente:',
          choices: ['pixel', 'neon', 'ocean', 'sunset', 'aurora'],
          initial: config.ui.gradientType
        }
      ]);

      // Aplicar mudanças
      for (const [key, value] of Object.entries(responses)) {
        if (key === 'gradientType') {
          await this.configService.updateUIConfig({ gradientType: value as any });
        } else {
          await this.configService.set(key as any, value);
        }
      }

      this.ui.showSuccess('Configurações atualizadas com sucesso!');

    } catch (error) {
      this.ui.showInfo('Edição cancelada');
    }
  }

  protected showHelp(): void {
    console.log(`
${GradientService.createLine('📖 Ajuda - Comando Config')}

${chalk.bold('Uso:')} config <ação> [argumentos]

${chalk.bold('Ações:')}
  ${chalk.cyan('list')}            - Lista todas as configurações
  ${chalk.cyan('get')} <chave>     - Obtém valor de uma configuração
  ${chalk.cyan('set')} <chave> <valor> - Define uma configuração
  ${chalk.cyan('reset')} [chave]   - Reseta configuração(ões) ao padrão
  ${chalk.cyan('export')}          - Exporta configurações como JSON
  ${chalk.cyan('import')}          - Importa configurações de JSON
  ${chalk.cyan('edit')}            - Editor interativo de configurações

${chalk.bold('Exemplos:')}
  ${chalk.dim('config list')}
  ${chalk.dim('config get theme')}
  ${chalk.dim('config set theme dark')}
  ${chalk.dim('config set serverPort 8080')}
  ${chalk.dim('config reset theme')}
  ${chalk.dim('config edit')}
    `);
  }
}