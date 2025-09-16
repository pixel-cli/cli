// src/services/terminal.service.ts
import blessed from 'blessed';
import chalk from 'chalk';

export interface TerminalConfig {
  onInput: (input: string) => Promise<void>;
  onExit: () => void;
}

export class TerminalService {
  private screen: blessed.Widgets.Screen;
  private messagesBox: blessed.Widgets.Log;
  private inputBox: blessed.Widgets.Textbox;
  private statusBox: blessed.Widgets.Box;
  private config: TerminalConfig;
  private currentStatus: string = '';

  constructor(config: TerminalConfig) {
    this.config = config;
    this.screen = blessed.screen({
      smartCSR: true,
      dockBorders: false,
      title: 'Pixel CLI'
    });

    this.setupLayout();
    this.setupEventHandlers();
  }

  private setupLayout(): void {
    // Messages area (scrollable)
    this.messagesBox = blessed.log({
      parent: this.screen,
      label: ' Conversa ',
      tags: true,
      border: {
        type: 'line',
        fg: 'gray'
      },
      style: {
        border: {
          fg: 'gray'
        }
      },
      top: 0,
      left: 0,
      right: 0,
      bottom: 2,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: false
    });

    // Status bar
    this.statusBox = blessed.box({
      parent: this.screen,
      height: 1,
      bottom: 1,
      left: 0,
      right: 0,
      style: {
        bg: 'black',
        fg: 'gray'
      },
      content: ''
    });

    // Input box (fixed at bottom) - configuração corrigida
    this.inputBox = blessed.textbox({
      parent: this.screen,
      height: 1,
      bottom: 0,
      left: 0,
      right: 0,
      style: {
        bg: 'gray',
        fg: 'black'
      },
      inputOnFocus: true,
      mouse: true,
      keys: true
    });
  }

  private setupEventHandlers(): void {
    // Exit handlers
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.config.onExit();
    });

    // Input submission
    this.inputBox.key('enter', async () => {
      const input = this.inputBox.getValue().trim();
      if (input) {
        this.inputBox.clearValue();
        await this.handleInput(input);
      }
    });

    // Focus management
    this.inputBox.focus();
  }

  private async handleInput(input: string): Promise<void> {
    // Show user message
    this.addUserMessage(input);

    // Update status
    this.updateStatus('Claude está digitando...');

    try {
      await this.config.onInput(input);
    } catch (error) {
      this.addSystemMessage(`Erro: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.updateStatus('Pronto');
    }
  }

  start(): void {
    this.screen.render();
    this.inputBox.focus();
    this.updateStatus('Pronto');

    // Welcome message
    this.addSystemMessage('Bem-vindo ao Pixel CLI! Digite sua mensagem abaixo.');
  }

  stop(): void {
    this.screen.destroy();
  }

  addUserMessage(message: string): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    this.messagesBox.log(`{cyan-fg}{bold}Você{/} {gray-fg}• ${timestamp}{/}`);
    this.messagesBox.log(`${message}`);
    this.messagesBox.log(''); // Empty line
    this.screen.render();
  }

  addClaudeMessage(message: string): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    this.messagesBox.log(`{blue-fg}{bold}Claude{/} {gray-fg}• ${timestamp}{/}`);
    this.messagesBox.log(`${message}`);
    this.messagesBox.log(''); // Empty line
    this.screen.render();
  }

  addSystemMessage(message: string): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    this.messagesBox.log(`{yellow-fg}{bold}Sistema{/} {gray-fg}• ${timestamp}{/}`);
    this.messagesBox.log(`{gray-fg}${message}{/}`);
    this.messagesBox.log(''); // Empty line
    this.screen.render();
  }

  streamClaudeChunk(chunk: string): void {
    // For streaming, we'll update the last Claude message
    // This is a simplified implementation
    this.messagesBox.add(chunk);
    this.screen.render();
  }

  updateStatus(status: string): void {
    this.currentStatus = status;
    this.statusBox.setContent(` ${status} | ESC ou Ctrl+C para sair | Digite sua mensagem:`);
    this.screen.render();
  }

  render(): void {
    this.screen.render();
  }

  focus(): void {
    this.inputBox.focus();
  }
}