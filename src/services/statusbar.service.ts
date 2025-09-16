// src/services/statusbar.service.ts
import chalk from 'chalk';
import { GradientService } from './gradient.service';

export interface StatusInfo {
  user?: string;
  project?: string;
  mode?: string;
  time?: string;
  status?: string;
}

export class StatusBarService {
  private static instance: StatusBarService;
  private statusInfo: StatusInfo = {};
  private isVisible: boolean = true;
  private autoUpdateInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): StatusBarService {
    if (!StatusBarService.instance) {
      StatusBarService.instance = new StatusBarService();
    }
    return StatusBarService.instance;
  }

  updateStatus(info: Partial<StatusInfo>): void {
    this.statusInfo = { ...this.statusInfo, ...info };
    if (this.isVisible) {
      this.render();
    }
  }

  show(): void {
    this.isVisible = true;
    this.render();
  }

  hide(): void {
    this.isVisible = false;
    // Limpar a linha da barra de status
    process.stdout.write('\x1b[2K\x1b[1A\x1b[2K');
  }

  private render(): void {
    if (!this.isVisible) return;

    const terminalWidth = process.stdout.columns || 80;
    const time = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Informações da esquerda
    const leftInfo = [
      this.statusInfo.user ? `👤 ${this.statusInfo.user}` : '',
      this.statusInfo.project ? `📁 ${this.statusInfo.project}` : '',
      this.statusInfo.mode ? `⚡ ${this.statusInfo.mode}` : ''
    ].filter(Boolean).join(' ');

    // Informações da direita
    const rightInfo = [
      this.statusInfo.status ? `${this.statusInfo.status}` : '',
      `🕐 ${time}`
    ].filter(Boolean).join(' ');

    // Calcular espaçamento
    const spacing = Math.max(0, terminalWidth - leftInfo.length - rightInfo.length - 4);
    const spaces = ' '.repeat(spacing);

    // Criar a barra de status
    const statusBar = `${GradientService.createLine('▎')} ${leftInfo}${spaces}${rightInfo} ${GradientService.createLine('▎')}`;

    // Use a more reliable method to position at bottom
    process.stdout.write('\x1b[s'); // Save cursor position

    // Force move to bottom line and stay there
    process.stdout.write('\x1b[1000;1H'); // Move way down (terminal will cap at actual bottom)
    process.stdout.write('\x1b[2K'); // Clear entire line
    process.stdout.write(statusBar);

    // Instead of restoring, just ensure the cursor goes to a safe position
    // Don't restore position as it may interfere with enquirer prompts
    process.stdout.write('\x1b[u'); // Restore position
  }

  startAutoUpdate(): void {
    // Clear any existing interval
    if (this.autoUpdateInterval) {
      clearInterval(this.autoUpdateInterval);
    }

    // Atualizar o tempo a cada minuto
    this.autoUpdateInterval = setInterval(() => {
      if (this.isVisible) {
        this.render();
      }
    }, 60000);

    // Atualizar quando o terminal for redimensionado
    process.stdout.on('resize', () => {
      if (this.isVisible) {
        setTimeout(() => this.render(), 100);
      }
    });
  }

  stopAutoUpdate(): void {
    if (this.autoUpdateInterval) {
      clearInterval(this.autoUpdateInterval);
      this.autoUpdateInterval = null;
    }
  }
}