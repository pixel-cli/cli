// src/commands/login.command.ts
import { BaseCommand, CommandOptions } from './base.command';
import enquirer from 'enquirer';
import { AuthenticationService } from '../services/authentication.service';
import { APIServer } from '../server/api.server';
import chalk from 'chalk';

export class LoginCommand extends BaseCommand {
  get name(): string { return 'login'; }
  get description(): string { return 'Autentica sua conta Pixel'; }
  get usage(): string { return 'login [--token <token>] [--code <code>]'; }

  async execute(args: string[], options: CommandOptions): Promise<void> {
    this.ui.updateStatusBar({ status: '🔐' });

    console.log('');
    console.log(chalk.bold.white('🔐 Autenticação Pixel CLI'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log('');

    if (options.token) {
      await this.loginWithToken(options.token);
    } else if (options.code) {
      await this.loginWithCode(options.code);
    } else {
      await this.authenticationFlow();
    }
  }

  private async authenticationFlow(): Promise<void> {
    try {
      // Iniciar servidor local se não estiver rodando
      const server = new APIServer({ port: 3000 });

      console.log(chalk.blue('ℹ️  Iniciando servidor local para autenticação...'));
      await server.start();

      // Gerar sessão de autenticação
      const authService = AuthenticationService.getInstance();
      const session = authService.generateAuthSession(3000);

      // Mostrar informações da autenticação
      console.log('');
      console.log(chalk.green('🌐 Acesse a URL abaixo no seu navegador:'));
      console.log(chalk.cyan.underline(session.url));
      console.log('');
      console.log(chalk.yellow('📋 Ou use este código:'));
      console.log(chalk.bold.white(session.code));
      console.log('');
      console.log(chalk.gray('⏰ Este código expira em 5 minutos'));
      console.log(chalk.gray('⌨️  Pressione Ctrl+C para cancelar'));
      console.log('');

      // Aguardar verificação
      console.log(chalk.blue('⏳ Aguardando autenticação...'));

      const verified = await authService.waitForVerification(session.code, 300000);

      if (verified) {
        const sessionData = authService.getSession(session.code);
        this.ui.showSuccess('✅ Autenticação realizada com sucesso!');
        this.ui.updateStatusBar({
          user: sessionData?.userId || 'usuario@pixel.com',
          status: '✅'
        });

        // Limpar sessão
        authService.removeSession(session.code);
      } else {
        this.ui.showError('❌ Tempo limite excedido ou autenticação cancelada.');
      }

      // Parar servidor
      console.log(chalk.dim('Parando servidor local...'));
      await server.stop();

    } catch (error) {
      console.error(chalk.red('Erro durante autenticação:'), error);
      this.ui.showError('Erro ao iniciar processo de autenticação.');
    }
  }

  private async loginWithToken(token: string): Promise<void> {
    console.log(chalk.blue('⏳ Validando token...'));

    // Simular validação do token
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (this.isValidToken(token)) {
      this.ui.showSuccess('✅ Token válido! Login realizado com sucesso.');
      this.ui.updateStatusBar({ user: 'usuario@pixel.com', status: '✅' });
    } else {
      this.ui.showError('❌ Token inválido. Tente novamente.');
    }
  }

  private async loginWithCode(code: string): Promise<void> {
    console.log(chalk.blue('⏳ Verificando código...'));

    const authService = AuthenticationService.getInstance();
    const isValid = authService.verifyCode(code, 'usuario@pixel.com');

    if (isValid) {
      this.ui.showSuccess('✅ Código válido! Login realizado com sucesso.');
      this.ui.updateStatusBar({ user: 'usuario@pixel.com', status: '✅' });
      authService.removeSession(code);
    } else {
      this.ui.showError('❌ Código inválido ou expirado.');
    }
  }

  private isValidToken(token: string): boolean {
    // Simular validação de token
    return token.length >= 10;
  }
}