// src/services/authentication.service.ts
import chalk from 'chalk';

export interface AuthSession {
  code: string;
  url: string;
  expiresAt: Date;
  verified: boolean;
  userId?: string;
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private activeSessions: Map<string, AuthSession> = new Map();
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutos

  private constructor() {
    // Limpar sessões expiradas a cada minuto
    setInterval(() => {
      this.cleanExpiredSessions();
    }, 60 * 1000);
  }

  static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  generateAuthSession(port: number = 3000): AuthSession {
    const code = this.generateAuthCode();
    const url = `http://localhost:${port}/auth/${code}`;
    const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT);

    const session: AuthSession = {
      code,
      url,
      expiresAt,
      verified: false
    };

    this.activeSessions.set(code, session);
    return session;
  }

  verifyCode(code: string, userId?: string): boolean {
    const session = this.activeSessions.get(code);

    if (!session) {
      return false;
    }

    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(code);
      return false;
    }

    session.verified = true;
    if (userId) {
      session.userId = userId;
    }

    return true;
  }

  isCodeVerified(code: string): boolean {
    const session = this.activeSessions.get(code);
    return session?.verified || false;
  }

  getSession(code: string): AuthSession | null {
    const session = this.activeSessions.get(code);

    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(code);
      return null;
    }

    return session;
  }

  removeSession(code: string): void {
    this.activeSessions.delete(code);
  }

  private generateAuthCode(): string {
    // Gerar código de 8 caracteres (letras maiúsculas e números)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Garantir que o código é único
    if (this.activeSessions.has(code)) {
      return this.generateAuthCode();
    }

    return code;
  }

  private cleanExpiredSessions(): void {
    const now = new Date();
    const expiredCodes: string[] = [];

    for (const [code, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        expiredCodes.push(code);
      }
    }

    expiredCodes.forEach(code => {
      this.activeSessions.delete(code);
    });

    if (expiredCodes.length > 0) {
      console.log(chalk.dim(`Limpas ${expiredCodes.length} sessões expiradas`));
    }
  }

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  // Método para polling - verifica se código foi verificado
  async waitForVerification(code: string, timeoutMs: number = 300000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 1000; // Verificar a cada segundo

    return new Promise((resolve) => {
      const poll = () => {
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }

        if (this.isCodeVerified(code)) {
          resolve(true);
          return;
        }

        setTimeout(poll, pollInterval);
      };

      poll();
    });
  }
}