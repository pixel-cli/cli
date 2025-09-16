// src/services/ui.service.ts
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import gradient from 'gradient-string';
import enquirer from 'enquirer';
import { GradientService } from './gradient.service';
import { StatusBarService } from './statusbar.service';

const { AutoComplete } = enquirer;

export class UIService {
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private statusBar: StatusBarService;
  private availableCommands: string[] = [];
  private streamingBuffer: string = '';
  private isStreamingActive: boolean = false;

  constructor() {
    this.statusBar = StatusBarService.getInstance();
  }

  setAvailableCommands(commands: string[]): void {
    this.availableCommands = commands;
  }

  async showBanner(): Promise<void> {
    console.clear();
    console.log('');

    // ASCII Art usando figlet com fonte bem legível
    const logoText = figlet.textSync('PIXEL CLI', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true
    });

    // Aplicar gradiente rainbow linha por linha
    const lines = logoText.trim().split('\n');
    const rainbowGradient = gradient([
      '#FF0080', // magenta
      '#FF0040', // rosa
      '#FF4000', // laranja-vermelho
      '#FF8000', // laranja
      '#FFFF00', // amarelo
      '#80FF00', // lima
      '#00FF00', // verde
      '#00FF80', // verde-azul
      '#00FFFF', // ciano
      '#0080FF', // azul claro
      '#0040FF', // azul
      '#8000FF', // violeta
    ]);

    lines.forEach(line => {
      console.log(rainbowGradient(line));
    });

    console.log('');

    // Subtítulo com animação rainbow
    const subtitle = '⚡ Sua engenharia de software, turbinada por IA ⚡';
    const rainbowAnimation = chalkAnimation.rainbow(subtitle);

    // Parar animação após 2 segundos e mostrar versão estática
    setTimeout(() => {
      rainbowAnimation.stop();
      console.log('');

      // Informações do sistema
      console.log(
        chalk.dim('🚀 Powered by ') +
        chalk.hex('#FBF719').bold('Bun') +
        chalk.dim(' • ') +
        chalk.hex('#3178C6').bold('TypeScript') +
        chalk.dim(' • ') +
        chalk.hex('#6366F1').bold('Elysia')
      );
      console.log('');

      // Linha decorativa elegante
      const decorLine = '━'.repeat(60);
      console.log(chalk.hex('#6366F1')(decorLine));
      console.log('');

      // Comandos principais com ícones
      console.log(chalk.hex('#10B981')('📝 Commands:'));
      console.log(chalk.dim('  • ') + chalk.cyan.bold('help') + chalk.dim(' - Ver todos os comandos'));
      console.log(chalk.dim('  • ') + chalk.magenta.bold(':help') + chalk.dim(' - Comandos do sistema'));
      console.log(chalk.dim('  • ') + chalk.yellow.bold('daemon') + chalk.dim(' - Modo de monitoramento'));
      console.log('');

    }, 2000);

    // Aguardar a animação
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Inicializar barra de status
    this.statusBar.updateStatus({
      project: 'pixel-cli',
      mode: 'ready',
      status: '✅'
    });
    this.statusBar.show();
    this.statusBar.startAutoUpdate();
  }

  async promptForCommand(): Promise<string> {
    try {
      // Temporarily hide status bar during input
      this.statusBar.hide();

      const response: { command: string } = await enquirer.prompt({
        type: 'input',
        name: 'command',
        message: chalk.bold('pixel') + ' ' + chalk.gray('❯')
      });

      // Show status bar again
      this.statusBar.show();

      // Add to history
      if (response.command.trim() && response.command !== this.commandHistory[this.commandHistory.length - 1]) {
        this.commandHistory.push(response.command.trim());
        if (this.commandHistory.length > 50) {
          this.commandHistory.shift();
        }
      }

      return response.command.trim();

    } catch (error) {
      throw error;
    }
  }

  showSuccess(message: string): void {
    console.log(`${chalk.green('✅')} ${message}`);
    this.statusBar.updateStatus({ status: '✅' });
  }

  showError(message: string): void {
    console.log(`${chalk.red('❌')} ${message}`);
    this.statusBar.updateStatus({ status: '❌' });
  }

  showWarning(message: string): void {
    console.log(`${chalk.yellow('⚠️')} ${message}`);
    this.statusBar.updateStatus({ status: '⚠️' });
  }

  showInfo(message: string): void {
    console.log(`${chalk.blue('ℹ️')} ${message}`);
  }

  showLoading(message: string): void {
    this.statusBar.updateStatus({ status: '⏳' });
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    return setInterval(() => {
      process.stdout.write(`\r${GradientService.createLine(spinner[i])} ${message}`);
      i = (i + 1) % spinner.length;
    }, 100);
  }

  clearLoading(): void {
    process.stdout.write('\r\x1b[2K');
  }

  updateStatusBar(info: any): void {
    this.statusBar.updateStatus(info);
  }

  // Claude streaming methods
  startClaudeStreaming(): void {
    this.isStreamingActive = true;
    this.streamingBuffer = '';
    this.showClaudeSeparator('start');
  }

  streamClaudeResponse(chunk: string): void {
    if (!this.isStreamingActive) {
      this.startClaudeStreaming();
    }

    this.streamingBuffer += chunk;
    process.stdout.write(this.formatClaudeChunk(chunk));
  }

  private showClaudeSeparator(type: 'start' | 'end'): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (type === 'start') {
      console.log('');
      console.log(chalk.blue('Claude') + chalk.gray(` • ${timestamp}`));
      console.log(chalk.gray('─'.repeat(40)));
    } else {
      console.log('');
      console.log(chalk.gray('─'.repeat(40)));
    }
  }

  private formatClaudeChunk(chunk: string): string {
    // Basic markdown formatting for streaming
    // This is a simple implementation - you might want to use marked-terminal later
    let formatted = chunk;

    // Code blocks
    if (chunk.includes('```')) {
      formatted = formatted.replace(/```(\w+)?\n/g, (match, lang) => {
        return chalk.gray('```') + (lang ? chalk.blue(lang) : '') + '\n';
      });
      formatted = formatted.replace(/```\n/g, chalk.gray('```\n'));
    }

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, chalk.cyan('`$1`'));

    // Bold text
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1'));

    // Headers
    formatted = formatted.replace(/^### (.+)$/gm, chalk.yellow.bold('### $1'));
    formatted = formatted.replace(/^## (.+)$/gm, chalk.green.bold('## $1'));
    formatted = formatted.replace(/^# (.+)$/gm, chalk.magenta.bold('# $1'));

    return formatted;
  }

  finishClaudeStreaming(): void {
    if (this.isStreamingActive) {
      this.showClaudeSeparator('end');
      this.isStreamingActive = false;
    } else {
      // Even if streaming wasn't active, show end separator for consistency
      this.showClaudeSeparator('end');
    }
  }

  isStreaming(): boolean {
    return this.isStreamingActive;
  }

  getStreamedContent(): string {
    return this.streamingBuffer;
  }

  // Enhanced prompt for Claude mode
  async promptForClaudeInput(): Promise<string> {
    try {
      // Temporarily hide status bar during input to avoid conflicts
      this.statusBar.hide();

      // Simple input prompt - no forced autocomplete
      const response: { input: string } = await enquirer.prompt({
        type: 'input',
        name: 'input',
        message: chalk.bold.cyan('claude') + ' ' + chalk.gray('❯'),
        initial: ''
      });

      // Show status bar again
      this.statusBar.show();

      const userInput = response.input.trim();

      // Add to history
      if (userInput && userInput !== this.commandHistory[this.commandHistory.length - 1]) {
        this.commandHistory.push(userInput);
        if (this.commandHistory.length > 50) {
          this.commandHistory.shift();
        }
      }

      // Show user message separator AFTER getting input
      this.showUserMessageSeparator(userInput);

      return userInput;

    } catch (error) {
      throw error;
    }
  }

  private showUserMessageSeparator(message: string): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    console.log('');
    console.log(chalk.yellow('Você') + chalk.gray(` • ${timestamp}`));
    console.log(message);
    console.log('');
  }

  cleanup(): void {
    this.finishClaudeStreaming();
    this.statusBar.stopAutoUpdate();
  }
}

// Manter compatibilidade com código existente
export async function showBanner(): Promise<void> {
  const ui = new UIService();
  return ui.showBanner();
}

export async function promptForCommand(): Promise<string> {
  const ui = new UIService();
  return ui.promptForCommand();
}