// src/utils/debug-logger.ts
import chalk from 'chalk';
import { ConfigService } from '../services/config.service';

export class DebugLogger {
  private static instance: DebugLogger;
  private configService: ConfigService;

  private constructor() {
    this.configService = ConfigService.getInstance();
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private shouldLog(level: 'error' | 'warn' | 'info' | 'debug'): boolean {
    if (!this.configService.isDebugEnabled()) {
      return level === 'error'; // Always show errors even when debug is off
    }

    const configLevel = this.configService.getDebugLevel();
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };

    return levels[level] <= levels[configLevel];
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  error(message: string, error?: Error | unknown): void {
    if (!this.shouldLog('error')) return;

    console.error(chalk.red('=== ERROR ==='));
    console.error(chalk.red(this.formatMessage('error', message)));

    if (error instanceof Error) {
      console.error(chalk.red(`Message: ${error.message}`));
      if (this.configService.shouldShowStackTrace() && error.stack) {
        console.error(chalk.red(`Stack: ${error.stack}`));
      }
    } else if (error !== undefined) {
      console.error(chalk.red(`Details: ${this.serializeValue(error)}`));
    }

    console.error(chalk.red('============='));
  }

  warn(message: string, details?: unknown): void {
    if (!this.shouldLog('warn')) return;

    console.warn(chalk.yellow('=== WARNING ==='));
    console.warn(chalk.yellow(this.formatMessage('warn', message)));

    if (details !== undefined) {
      console.warn(chalk.yellow(`Details: ${this.serializeValue(details)}`));
    }

    console.warn(chalk.yellow('==============='));
  }

  info(message: string, details?: unknown): void {
    if (!this.shouldLog('info')) return;

    console.log(chalk.blue('=== INFO ==='));
    console.log(chalk.blue(this.formatMessage('info', message)));

    if (details !== undefined) {
      console.log(chalk.blue(`Details: ${this.serializeValue(details)}`));
    }

    console.log(chalk.blue('============'));
  }

  debug(message: string, data?: unknown): void {
    if (!this.shouldLog('debug')) return;

    console.log(chalk.dim('=== DEBUG ==='));
    console.log(chalk.dim(this.formatMessage('debug', message)));

    if (data !== undefined) {
      console.log(chalk.dim(this.serializeValue(data)));
    }

    console.log(chalk.dim('============='));
  }

  // Compatibility methods for existing code
  claudeInfo(message: string): void {
    this.info(`Claude Code: ${message}`);
  }

  claudeError(message: string, error?: Error | unknown): void {
    this.error(`Claude Code: ${message}`, error);
  }

  claudeDebug(message: string, data?: unknown): void {
    this.debug(`Claude Code: ${message}`, data);
  }

  // Stream logging with dynamic content length info
  streamData(content: string, type: 'json' | 'text' = 'text'): void {
    if (!this.shouldLog('debug')) return;

    this.debug(`Stream ${type} data (${content.length} chars)`, content);
  }

  // JSON response logging
  jsonResponse(response: object, type?: string): void {
    if (!this.shouldLog('debug')) return;

    const prefix = type ? `JSON ${type} response` : 'JSON response';
    this.debug(prefix, response);
  }

  // Process logging
  processInfo(message: string, code?: number): void {
    const fullMessage = code !== undefined ? `${message} (code: ${code})` : message;
    this.info(`Process: ${fullMessage}`);
  }

  // Toggle debug mode programmatically
  async enableDebug(): Promise<void> {
    await this.configService.enableDebug();
    this.info('Debug mode enabled');
  }

  async disableDebug(): Promise<void> {
    await this.configService.disableDebug();
    console.log(chalk.blue('Debug mode disabled'));
  }

  async setLogLevel(level: 'error' | 'warn' | 'info' | 'debug'): Promise<void> {
    await this.configService.setDebugLevel(level);
    this.info(`Debug level set to: ${level}`);
  }

  isEnabled(): boolean {
    return this.configService.isDebugEnabled();
  }

  getLevel(): string {
    return this.configService.getDebugLevel();
  }

  // Helper method to properly serialize values
  private serializeValue(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return 'undefined';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value instanceof Error) {
      return `Error: ${value.message}${value.stack ? '\n' + value.stack : ''}`;
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        // Handle circular references or non-serializable objects
        try {
          return JSON.stringify(value, this.getCircularReplacer(), 2);
        } catch {
          return `[Object: ${Object.prototype.toString.call(value)}]`;
        }
      }
    }

    // Ensure we never return [object Object]
    const result = String(value);
    return result === '[object Object]' ? JSON.stringify(value || {}) : result;
  }

  // Helper to handle circular references in JSON.stringify
  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}

// Export singleton instance for easy use
export const debugLogger = DebugLogger.getInstance();