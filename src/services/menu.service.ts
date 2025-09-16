// src/services/menu.service.ts
import chalk from 'chalk';
import enquirer from 'enquirer';
import figlet from 'figlet';
import chalkAnimation from 'chalk-animation';
import gradient from 'gradient-string';

export interface MenuChoice {
  name: string;
  value: string;
  description?: string;
}

export class MenuService {
  async showInitialMenu(): Promise<'pixel-login' | 'claude-code'> {
    console.clear();

    // Banner ASCII com ANSI Shadow e rainbow gradiente
    console.log('');
    const asciiText = figlet.textSync('PIXEL CLI', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true
    });

    // Cores específicas para o gradiente
    const customGradient = gradient([
      '#FF0087', // rosa vibrante
      '#AF5FD7', // roxo claro
      '#8787FF', // azul-roxo
      '#5FAFFF', // azul claro
      '#5FD7D7'  // ciano
    ]);

    // Primeiro: Animação rainbow do ASCII por 3 segundos
    const asciiAnimation = chalkAnimation.rainbow(asciiText);

    await new Promise(resolve => {
      setTimeout(() => {
        asciiAnimation.stop();
        console.clear();
        console.log('');

        // Mostrar versão estática com gradiente customizado
        const lines = asciiText.trim().split('\n');
        const gradientLines = lines.map(line => customGradient(line));
        console.log(gradientLines.join('\n'));
        console.log('');

        resolve(void 0);
      }, 3000);
    });

    // Segundo: Animar o subtítulo
    const subtitle = '✨ Sua engenharia de software, turbinada por IA ✨';
    const subtitleAnimation = chalkAnimation.rainbow(subtitle);

    await new Promise(resolve => {
      setTimeout(() => {
        subtitleAnimation.stop();
        console.log('');
        console.log(chalk.dim('🚀 Powered by ') + chalk.yellow.bold('Bun') + chalk.dim(' • ') + chalk.blue.bold('TypeScript') + chalk.dim(' • ') + chalk.green.bold('Elysia'));
        console.log('');
        console.log(chalk.gray('━'.repeat(60)));
        console.log('');
        resolve(void 0);
      }, 2000);
    });

    const choices: MenuChoice[] = [
      {
        name: '🔐 Logar na conta Pixel',
        value: 'pixel-login',
        description: 'Acesse sua conta Pixel para funcionalidades avançadas'
      },
      {
        name: '🤖 Conectar com Claude Code',
        value: 'claude-code',
        description: 'Conecte diretamente com Claude Code (requer instalação)'
      }
    ];

    try {
      const response: { choice: string } = await enquirer.prompt({
        type: 'select',
        name: 'choice',
        message: 'Como você gostaria de usar o Pixel CLI?',
        choices: choices.map(choice => ({
          name: choice.name,
          value: choice.value,
          hint: choice.description
        })),
        result: (name: string) => {
          const selected = choices.find(c => c.name === name);
          return selected?.value || name;
        }
      });

      return response.choice as 'pixel-login' | 'claude-code';

    } catch (error) {
      // Se usuário cancelar, default para claude-code
      console.log(chalk.gray('\n\nUsando modo Claude Code...'));
      return 'claude-code';
    }
  }

  showModeSelected(mode: 'pixel-login' | 'claude-code'): void {
    console.log('');

    if (mode === 'pixel-login') {
      console.log(chalk.blue('✓ Modo selecionado: Login Pixel'));
      console.log(chalk.gray('  Iniciando processo de autenticação...'));
    } else {
      console.log(chalk.blue('✓ Modo selecionado: Claude Code'));
      console.log(chalk.gray('  Tentando conectar com Claude Code...'));
    }

    console.log('');
  }
}