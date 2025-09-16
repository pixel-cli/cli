// src/services/mock-claude-manager.ts
import { randomUUID } from 'node:crypto';
import { debugLogger } from '../utils/debug-logger';
import {
  ClaudeCommand,
  ClaudeProcess,
  ClaudeOutput,
  IClaudeManager,
  ClaudeConnectionInfo
} from '../types/claude';

export interface MockConfig {
  simulateDelay?: boolean;
  defaultDelay?: number;
  failureRate?: number;
  responseTemplate?: string;
}

export class MockClaudeManager implements IClaudeManager {
  private processes = new Map<string, ClaudeProcess>();
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = {
      simulateDelay: true,
      defaultDelay: 1000,
      failureRate: 0.1, // 10% failure rate
      responseTemplate: 'Mock response for: {input}',
      ...config,
    };

    debugLogger.info('Mock Claude Manager initialized', this.config);
  }

  async testConnection(): Promise<ClaudeConnectionInfo> {
    debugLogger.debug('Mock Claude connection test');

    if (Math.random() < (this.config.failureRate || 0)) {
      return {
        connected: false,
        error: 'Mock connection failure',
      };
    }

    return {
      connected: true,
      version: 'Mock Claude CLI v1.0.0',
    };
  }

  async executeCommand(command: ClaudeCommand): Promise<string> {
    debugLogger.info('Mock executing Claude command', {
      id: command.id,
      command: command.command,
      args: command.args,
    });

    const claudeProcess: ClaudeProcess = {
      id: command.id,
      command,
      status: 'running',
      startTime: Date.now(),
      pid: Math.floor(Math.random() * 10000),
    };

    this.processes.set(command.id, claudeProcess);

    // Simulate processing delay
    if (this.config.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.defaultDelay));
    }

    // Simulate random failures
    if (Math.random() < (this.config.failureRate || 0)) {
      claudeProcess.status = 'failed';
      claudeProcess.endTime = Date.now();
      claudeProcess.error = 'Mock command failure';
      claudeProcess.exitCode = 1;

      throw new Error('Mock command execution failed');
    }

    // Generate mock response
    const input = command.args.join(' ');
    const response = this.config.responseTemplate?.replace('{input}', input) ||
                    `Mock Claude response for: ${input}`;

    claudeProcess.status = 'completed';
    claudeProcess.endTime = Date.now();
    claudeProcess.exitCode = 0;

    debugLogger.info('Mock Claude command completed', {
      id: command.id,
      duration: claudeProcess.endTime - claudeProcess.startTime,
    });

    return response;
  }

  async executeStreamingCommand(
    command: ClaudeCommand,
    onOutput: (output: ClaudeOutput) => void
  ): Promise<string> {
    debugLogger.info('Mock executing streaming Claude command', {
      id: command.id,
    });

    const response = await this.executeCommand(command);

    // Simulate streaming by breaking response into chunks
    const chunks = this.breakIntoChunks(response, 20);

    for (const chunk of chunks) {
      const output: ClaudeOutput = {
        processId: command.id,
        type: 'stdout',
        data: chunk,
        timestamp: Date.now(),
      };

      onOutput(output);

      // Small delay between chunks
      if (this.config.simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return response;
  }

  getProcess(processId: string): ClaudeProcess | undefined {
    return this.processes.get(processId);
  }

  getActiveProcesses(): ClaudeProcess[] {
    return Array.from(this.processes.values()).filter(
      process => process.status === 'running'
    );
  }

  async killProcess(processId: string): Promise<boolean> {
    debugLogger.info('Mock killing Claude process', { processId });

    const process = this.processes.get(processId);
    if (!process) {
      return false;
    }

    if (process.status !== 'running') {
      return false;
    }

    process.status = 'killed';
    process.endTime = Date.now();
    process.exitCode = -1;
    process.error = 'Process killed by user';

    return true;
  }

  isReady(): boolean {
    return true;
  }

  async shutdown(): Promise<void> {
    debugLogger.info('Mock shutting down Claude Manager');

    // Kill all active processes
    const activeProcesses = this.getActiveProcesses();
    await Promise.all(
      activeProcesses.map(process => this.killProcess(process.id))
    );

    this.processes.clear();
  }

  // Mock-specific methods for testing
  setFailureRate(rate: number): void {
    this.config.failureRate = rate;
  }

  setDefaultDelay(delay: number): void {
    this.config.defaultDelay = delay;
  }

  setResponseTemplate(template: string): void {
    this.config.responseTemplate = template;
  }

  simulateFailure(processId: string, error: string): void {
    const process = this.processes.get(processId);
    if (process) {
      process.status = 'failed';
      process.endTime = Date.now();
      process.error = error;
      process.exitCode = 1;
    }
  }

  private breakIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
}