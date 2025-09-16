// src/services/claude-manager-factory.ts
import { debugLogger } from '../utils/debug-logger';
import { ClaudeConfig, IClaudeManager } from '../types/claude';
import { EnhancedClaudeManager } from './enhanced-claude-manager';
import { MockClaudeManager, MockConfig } from './mock-claude-manager';

export type ManagerType = 'production' | 'mock' | 'auto';

export interface FactoryConfig {
  type?: ManagerType;
  claudeConfig?: Partial<ClaudeConfig>;
  mockConfig?: MockConfig;
  forceProduction?: boolean;
}

export class ClaudeManagerFactory {
  /**
   * Create a Claude manager instance based on environment and configuration
   */
  static create(config: FactoryConfig = {}): IClaudeManager {
    const managerType = this.determineManagerType(config);

    debugLogger.info('Creating Claude manager', {
      type: managerType,
      environment: process.env.NODE_ENV,
    });

    switch (managerType) {
      case 'production':
        return new EnhancedClaudeManager(config.claudeConfig);

      case 'mock':
        return new MockClaudeManager(config.mockConfig);

      default:
        throw new Error(`Unknown Claude manager type: ${managerType}`);
    }
  }

  /**
   * Create a production Claude manager (always real implementation)
   */
  static createProduction(config?: Partial<ClaudeConfig>): EnhancedClaudeManager {
    debugLogger.info('Creating production Claude manager');
    return new EnhancedClaudeManager(config);
  }

  /**
   * Create a mock Claude manager (for testing/development)
   */
  static createMock(config?: MockConfig): MockClaudeManager {
    debugLogger.info('Creating mock Claude manager');
    return new MockClaudeManager(config);
  }

  /**
   * Create a Claude manager based on Claude Code availability
   */
  static async createAuto(config: FactoryConfig = {}): Promise<IClaudeManager> {
    // First try to detect if Claude Code is available
    const isClaudeAvailable = await this.isClaudeCodeAvailable();

    if (isClaudeAvailable && !this.isTestEnvironment()) {
      debugLogger.info('Claude Code detected, using production manager');
      return new EnhancedClaudeManager(config.claudeConfig);
    } else {
      debugLogger.info('Claude Code not available or in test environment, using mock manager');
      return new MockClaudeManager(config.mockConfig);
    }
  }

  private static determineManagerType(config: FactoryConfig): ManagerType {
    // Explicit type specified
    if (config.type && config.type !== 'auto') {
      return config.type;
    }

    // Force production regardless of environment
    if (config.forceProduction) {
      return 'production';
    }

    // Test environment - use mock
    if (this.isTestEnvironment()) {
      return 'mock';
    }

    // Development environment - check availability
    if (this.isDevelopmentEnvironment()) {
      return 'auto'; // Will be resolved by createAuto
    }

    // Default to production in other cases
    return 'production';
  }

  private static async isClaudeCodeAvailable(): Promise<boolean> {
    try {
      // Try to execute a simple Claude command to test availability
      const { spawn } = await import('node:child_process');

      return new Promise<boolean>((resolve) => {
        const process = spawn('claude', ['--version'], {
          stdio: ['ignore', 'ignore', 'ignore'],
        });

        const timeout = setTimeout(() => {
          process.kill();
          resolve(false);
        }, 5000);

        process.on('exit', (code) => {
          clearTimeout(timeout);
          resolve(code === 0);
        });

        process.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch (error) {
      debugLogger.debug('Error checking Claude Code availability', error);
      return false;
    }
  }

  private static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' ||
           process.env.JEST_WORKER_ID !== undefined ||
           process.env.VITEST !== undefined;
  }

  private static isDevelopmentEnvironment(): boolean {
    return process.env.NODE_ENV === 'development' ||
           process.env.NODE_ENV === undefined;
  }

  private static isProductionEnvironment(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}

// Convenience exports
export const createClaudeManager = ClaudeManagerFactory.create;
export const createProductionManager = ClaudeManagerFactory.createProduction;
export const createMockManager = ClaudeManagerFactory.createMock;
export const createAutoManager = ClaudeManagerFactory.createAuto;