// src/services/command.service.ts
import { BaseCommand } from '../commands/base.command';
import { HelpCommand } from '../commands/help.command';
import { LoginCommand } from '../commands/login.command';
import { ReviewCommand } from '../commands/review.command';
import { ServerCommand } from '../commands/server.command';
import { ConfigCommand } from '../commands/config.command';
import { DebugCommand } from '../commands/debug.command';
import { DaemonCommand } from '../commands/daemon.command';
import { UIService } from './ui.service';
import chalk from 'chalk';

export class CommandService {
  private commands: Map<string, BaseCommand> = new Map();
  private ui: UIService;

  constructor() {
    this.ui = new UIService();
    this.registerCommands();
    // Provide available commands to UI for autocomplete
    this.ui.setAvailableCommands(this.getAvailableCommands());
  }

  private registerCommands(): void {
    const commands = [
      new HelpCommand(),
      new LoginCommand(),
      new ReviewCommand(),
      new ServerCommand(),
      new ConfigCommand(),
      new DebugCommand(),
      new DaemonCommand(),
    ];

    commands.forEach(command => {
      this.commands.set(command.name, command);
    });
  }

  async executeCommand(input: string): Promise<void> {
    const [commandName, ...rawArgs] = input.trim().split(' ');

    if (!commandName) return;

    // Comandos especiais
    if (commandName === 'exit' || commandName === 'quit') {
      this.ui.showInfo('Até a próxima! 👋');
      this.ui.cleanup();
      process.exit(0);
    }

    if (commandName === 'clear' || commandName === 'cls') {
      console.clear();
      return;
    }

    // Handle '?' as quick help
    if (commandName === '?') {
      this.showQuickHelp();
      return;
    }

    const command = this.commands.get(commandName);

    if (!command) {
      this.ui.showError(`Comando "${commandName}" não reconhecido.`);
      this.ui.showInfo('Digite "help" para ver os comandos disponíveis.');
      return;
    }

    try {
      // Parse simples de argumentos e opções
      const { args, options } = this.parseArgs(rawArgs);

      // Atualizar status bar
      this.ui.updateStatusBar({ mode: commandName });

      // Executar comando
      await command.execute(args, options);

      // Resetar status
      this.ui.updateStatusBar({ mode: 'ready' });

    } catch (error) {
      this.ui.showError(`Erro ao executar comando: ${error instanceof Error ? error.message : String(error)}`);
      this.ui.updateStatusBar({ mode: 'error', status: '❌' });
    }
  }

  private parseArgs(rawArgs: string[]): { args: string[], options: { [key: string]: any } } {
    const args: string[] = [];
    const options: { [key: string]: any } = {};

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];

      if (arg.startsWith('--')) {
        // Opção longa (--option value)
        const optionName = arg.slice(2);
        const nextArg = rawArgs[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          options[optionName] = nextArg;
          i++; // Pular o próximo argumento pois já foi processado
        } else {
          options[optionName] = true;
        }
      } else if (arg.startsWith('-')) {
        // Opção curta (-o value)
        const optionName = arg.slice(1);
        const nextArg = rawArgs[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          options[optionName] = nextArg;
          i++;
        } else {
          options[optionName] = true;
        }
      } else {
        // Argumento regular
        args.push(arg);
      }
    }

    return { args, options };
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  private showQuickHelp(): void {
    console.log('\n' + chalk.bold.cyan('🚀 Comandos Disponíveis:'));
    console.log(chalk.gray('─'.repeat(50)));

    // Get all commands and their descriptions
    const commandList = Array.from(this.commands.entries());

    commandList.forEach(([name, command]) => {
      const description = command.description || 'Sem descrição disponível';
      console.log(`  ${chalk.green(name.padEnd(12))} ${chalk.gray(description)}`);
    });

    // Add special commands
    console.log('\n' + chalk.bold.yellow('⚡ Comandos Especiais:'));
    console.log(`  ${chalk.green('?'.padEnd(12))} ${chalk.gray('Mostra esta ajuda rápida')}`);
    console.log(`  ${chalk.green('clear'.padEnd(12))} ${chalk.gray('Limpa a tela')}`);
    console.log(`  ${chalk.green('exit'.padEnd(12))} ${chalk.gray('Sai do Pixel CLI')}`);

    console.log('\n' + chalk.dim('💡 Dica: Use TAB para autocompletar comandos!'));
    console.log(chalk.dim('📚 Digite "help" para mais informações detalhadas.\n'));
  }
}