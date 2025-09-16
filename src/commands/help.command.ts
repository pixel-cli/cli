// src/commands/help.command.ts
import { BaseCommand, CommandOptions } from './base.command';
import { GradientService } from '../services/gradient.service';
import chalk from 'chalk';

export class HelpCommand extends BaseCommand {
  get name(): string { return 'help'; }
  get description(): string { return 'Mostra informações de ajuda sobre comandos'; }
  get usage(): string { return 'help [comando]'; }

  async execute(args: string[], options: CommandOptions): Promise<void> {
    const commandName = args[0];

    if (commandName) {
      this.showSpecificHelp(commandName);
    } else {
      this.showGeneralHelp();
    }
  }

  private showSpecificHelp(commandName: string): void {
    const commands = this.getCommandHelp();
    const command = commands.find(cmd => cmd.name === commandName);

    if (command) {
      console.log(`
${GradientService.createLine(`📖 Ajuda para "${commandName}"`)}

${chalk.bold('Descrição:')} ${command.description}
${chalk.bold('Uso:')} ${command.usage}

${command.examples ? chalk.bold('Exemplos:') + '\n' + command.examples.map(ex => `  ${chalk.dim('$')} ${ex}`).join('\n') : ''}
      `);
    } else {
      this.ui.showError(`Comando "${commandName}" não encontrado. Use "help" para ver todos os comandos.`);
    }
  }

  private showGeneralHelp(): void {
    const border = GradientService.createBorder(70);

    console.log(`
${border.top}
${GradientService.createLine('  📚 PIXEL CLI - Comandos Disponíveis  ')}
${border.bottom}

${chalk.bold('Comandos Principais:')}

${GradientService.createLine('🔐')} ${chalk.bold('login')}      - Autentique sua conta Pixel
${GradientService.createLine('📝')} ${chalk.bold('review')}     - Analisa e revisa código
${GradientService.createLine('🛠️')} ${chalk.bold('config')}     - Gerencia configurações
${GradientService.createLine('📊')} ${chalk.bold('status')}     - Mostra status do projeto
${GradientService.createLine('🚀')} ${chalk.bold('deploy')}     - Deploy do projeto
${GradientService.createLine('📖')} ${chalk.bold('help')}       - Mostra esta ajuda
${GradientService.createLine('🚪')} ${chalk.bold('exit')}       - Sai do Pixel CLI

${chalk.dim('Para mais informações sobre um comando específico:')}
${chalk.dim('  help <comando>')}

${chalk.dim('Exemplos:')}
${chalk.dim('  review src/index.ts')}
${chalk.dim('  config set api-key <sua-chave>')}
${chalk.dim('  deploy --env production')}
    `);
  }

  private getCommandHelp() {
    return [
      {
        name: 'login',
        description: 'Autentica sua conta Pixel para usar funcionalidades premium',
        usage: 'login [--token <token>]',
        examples: ['login', 'login --token abc123']
      },
      {
        name: 'review',
        description: 'Analisa código em busca de bugs, melhorias e sugestões',
        usage: 'review <arquivo|diretório> [--format json|text]',
        examples: ['review src/index.ts', 'review . --format json']
      },
      {
        name: 'config',
        description: 'Gerencia configurações do Pixel CLI',
        usage: 'config <get|set|list> [chave] [valor]',
        examples: ['config list', 'config set api-key abc123', 'config get theme']
      },
      {
        name: 'status',
        description: 'Mostra informações sobre o projeto atual',
        usage: 'status [--detailed]',
        examples: ['status', 'status --detailed']
      },
      {
        name: 'deploy',
        description: 'Faz deploy do projeto para produção',
        usage: 'deploy [--env <environment>] [--dry-run]',
        examples: ['deploy', 'deploy --env staging', 'deploy --dry-run']
      }
    ];
  }
}