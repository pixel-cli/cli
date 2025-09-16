// src/services/gradient.service.ts
import gradient from 'gradient-string';
import figlet from 'figlet';

export class GradientService {
  // Definindo gradientes personalizados
  static readonly gradients = {
    pixel: gradient(['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b']),
    neon: gradient(['#ff0080', '#00ff80', '#0080ff', '#ff8000']),
    ocean: gradient(['#667eea', '#764ba2', '#f093fb', '#f5576c']),
    sunset: gradient(['#ff9a9e', '#fecfef', '#fecfef']),
    aurora: gradient(['#a8edea', '#fed6e3'])
  };

  static createBanner(text: string, gradientType: keyof typeof GradientService.gradients = 'pixel'): string {
    const asciiText = figlet.textSync(text, {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });

    return this.gradients[gradientType](asciiText);
  }

  static createLine(text: string, gradientType: keyof typeof GradientService.gradients = 'pixel'): string {
    return this.gradients[gradientType](text);
  }

  static createProgressBar(width: number = 40, progress: number = 0): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return this.gradients.pixel(bar);
  }

  // Função para criar bordas decorativas
  static createBorder(width: number = 60): string {
    const top = '╭' + '─'.repeat(width - 2) + '╮';
    const bottom = '╰' + '─'.repeat(width - 2) + '╯';

    return {
      top: this.gradients.pixel(top),
      bottom: this.gradients.pixel(bottom),
      side: this.gradients.pixel('│')
    };
  }
}