// src/services/enhanced-claude-manager.ts
import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { debugLogger } from '../utils/debug-logger';
import { ClaudeOutputStreamer } from './claude-output-streamer';
import { ClaudeCommandSanitizer } from './claude-command-sanitizer';
import {
  ClaudeConfig,
  ClaudeCommand,
  ClaudeProcess,
  ClaudeOutput,
  IClaudeManager,
  ClaudeConnectionInfo
} from '../types/claude';

export class EnhancedClaudeManager implements IClaudeManager {
  private config: ClaudeConfig;
  private processes = new Map<string, ClaudeProcess>();
  private childProcesses = new Map<string, ChildProcess>();
  private outputStreamer: ClaudeOutputStreamer;
  private commandSanitizer: ClaudeCommandSanitizer;
  private isShuttingDown = false;

  constructor(config?: Partial<ClaudeConfig>) {
    this.config = {
      commandTimeout: 30000,
      maxBufferSize: 1000,
      logLevel: 'info',
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.outputStreamer = new ClaudeOutputStreamer({
      maxBufferSize: this.config.maxBufferSize,
    });

    this.commandSanitizer = ClaudeCommandSanitizer.createClaudeSanitizer();

    debugLogger.info('Enhanced Claude Manager initialized', this.config);

    // Setup cleanup on process exit
    process.on('SIGINT', () => this.handleShutdown());
    process.on('SIGTERM', () => this.handleShutdown());
  }

  async testConnection(): Promise<ClaudeConnectionInfo> {
    debugLogger.debug('Testing Claude Code connection');

    try {
      const testCommand: ClaudeCommand = {
        id: `test-${randomUUID()}`,
        command: 'claude',
        args: ['--version'],
        timeout: 5000,
      };

      const result = await this.executeCommand(testCommand);

      return {
        connected: true,
        version: result.trim(),
      };
    } catch (error) {
      debugLogger.error('Claude Code connection test failed', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async executeCommand(command: ClaudeCommand): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Claude Manager is shutting down');
    }

    // Sanitize the command
    const sanitizationResult = this.commandSanitizer.sanitizeClaudeCommand(
      command.command,
      command.args,
      command.workingDirectory
    );

    if (!sanitizationResult.isValid) {
      const errorMessage = `Command failed sanitization: ${sanitizationResult.violations.join(', ')}`;
      debugLogger.error('Command sanitization failed', {
        command: command.command,
        violations: sanitizationResult.violations,
      });
      throw new Error(errorMessage);
    }

    // Log warnings
    if (sanitizationResult.warnings.length > 0) {
      debugLogger.warn('Command sanitization warnings', {
        command: command.command,
        warnings: sanitizationResult.warnings,
      });
    }

    debugLogger.info('Executing Claude command', {
      id: command.id,
      command: command.command,
      args: command.args,
    });

    if (this.processes.has(command.id)) {
      throw new Error(`Process with ID ${command.id} already exists`);
    }

    const claudeProcess: ClaudeProcess = {
      id: command.id,
      command,
      status: 'running',
      startTime: Date.now(),
    };

    this.processes.set(command.id, claudeProcess);

    try {
      const result = await this.spawnClaudeProcess(command, claudeProcess);

      claudeProcess.status = 'completed';
      claudeProcess.endTime = Date.now();
      claudeProcess.exitCode = 0;

      debugLogger.info('Claude command completed successfully', {
        id: command.id,
        duration: claudeProcess.endTime - claudeProcess.startTime,
      });

      return result;
    } catch (error) {
      claudeProcess.status = 'failed';
      claudeProcess.endTime = Date.now();
      claudeProcess.error = error instanceof Error ? error.message : String(error);
      claudeProcess.exitCode = 1;

      debugLogger.error('Claude command execution failed', {
        id: command.id,
        error: claudeProcess.error,
      });

      throw error;
    } finally {
      this.childProcesses.delete(command.id);
    }
  }

  async executeStreamingCommand(
    command: ClaudeCommand,
    onOutput: (output: ClaudeOutput) => void
  ): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Claude Manager is shutting down');
    }

    debugLogger.info('Executing streaming Claude command', {
      id: command.id,
      command: command.command,
    });

    // Start streaming for this process
    this.outputStreamer.startStreaming(command.id);

    // Set up output handler
    this.outputStreamer.onProcessOutput(command.id, onOutput);

    try {
      const result = await this.executeCommand(command);

      // Get the full buffered output
      const fullOutput = this.outputStreamer.getFullOutput(command.id);

      return fullOutput || result;
    } finally {
      // Clean up streaming
      this.outputStreamer.offProcessOutput(command.id, onOutput);
      this.outputStreamer.stopStreaming(command.id);
    }
  }

  private async spawnClaudeProcess(command: ClaudeCommand, claudeProcess: ClaudeProcess): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = command.timeout || this.config.commandTimeout;
      let output = '';
      let errorOutput = '';

      debugLogger.debug('Spawning Claude process', {
        command: command.command,
        args: command.args,
        cwd: command.workingDirectory || process.cwd(),
      });

      const childProcess = spawn(command.command, command.args, {
        cwd: command.workingDirectory || process.cwd(),
        env: {
          ...process.env,
          ANTHROPIC_LOG_LEVEL: this.config.logLevel,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      claudeProcess.pid = childProcess.pid;
      this.childProcesses.set(command.id, childProcess);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        debugLogger.warn('Claude command timed out', {
          id: command.id,
          timeout,
        });
        childProcess.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      // Handle stdout
      childProcess.stdout?.setEncoding('utf8');
      childProcess.stdout?.on('data', (data: string) => {
        output += data;

        // Stream the output if streaming is active
        if (this.outputStreamer.isStreaming(command.id)) {
          const outputEvent: ClaudeOutput = {
            processId: command.id,
            type: 'stdout',
            data,
            timestamp: Date.now(),
          };
          this.outputStreamer.streamOutput(outputEvent);
        }

        debugLogger.debug('Claude stdout', {
          processId: command.id,
          dataLength: data.length,
        });
      });

      // Handle stderr
      childProcess.stderr?.setEncoding('utf8');
      childProcess.stderr?.on('data', (data: string) => {
        errorOutput += data;

        // Stream the error output
        if (this.outputStreamer.isStreaming(command.id)) {
          const outputEvent: ClaudeOutput = {
            processId: command.id,
            type: 'stderr',
            data,
            timestamp: Date.now(),
          };
          this.outputStreamer.streamOutput(outputEvent);
        }

        debugLogger.debug('Claude stderr', {
          processId: command.id,
          dataLength: data.length,
        });
      });

      // Handle process exit
      childProcess.on('exit', (code, signal) => {
        clearTimeout(timeoutId);

        debugLogger.debug('Claude process exited', {
          processId: command.id,
          exitCode: code,
          signal,
        });

        // Stream the exit event
        if (this.outputStreamer.isStreaming(command.id)) {
          this.outputStreamer.streamProcessExit(command.id, code || 0);
        }

        if (code === 0) {
          resolve(output);
        } else {
          const error = new Error(
            `Claude process exited with code ${code}${signal ? ` (${signal})` : ''}: ${errorOutput}`
          );
          reject(error);
        }
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);

        debugLogger.error('Claude process error', {
          processId: command.id,
          error: error.message,
        });

        // Stream the error
        if (this.outputStreamer.isStreaming(command.id)) {
          this.outputStreamer.streamError(command.id, error.message);
        }

        reject(error);
      });

      // Send input if provided
      if (command.input) {
        childProcess.stdin?.write(command.input);
        childProcess.stdin?.end();
      }
    });
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
    debugLogger.info('Killing Claude process', { processId });

    const process = this.processes.get(processId);
    if (!process) {
      debugLogger.warn('Process not found for kill request', { processId });
      return false;
    }

    if (process.status !== 'running') {
      debugLogger.warn('Process not running, cannot kill', { processId, status: process.status });
      return false;
    }

    const childProcess = this.childProcesses.get(processId);
    if (childProcess) {
      // Try graceful termination first
      childProcess.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      }, 5000);

      this.childProcesses.delete(processId);
    }

    process.status = 'killed';
    process.endTime = Date.now();
    process.exitCode = -1;
    process.error = 'Process killed by user';

    // Stop streaming
    this.outputStreamer.stopStreaming(processId);

    debugLogger.info('Claude process killed', { processId });
    return true;
  }

  isReady(): boolean {
    return !this.isShuttingDown;
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    debugLogger.info('Shutting down Enhanced Claude Manager', {
      activeProcesses: this.getActiveProcesses().length,
    });

    // Kill all active processes
    const activeProcesses = this.getActiveProcesses();
    await Promise.all(
      activeProcesses.map(process => this.killProcess(process.id))
    );

    // Shutdown output streamer
    this.outputStreamer.shutdown();

    // Clear all data structures
    this.processes.clear();
    this.childProcesses.clear();

    debugLogger.info('Enhanced Claude Manager shutdown complete');
  }

  private async handleShutdown(): Promise<void> {
    debugLogger.info('Received shutdown signal');
    await this.shutdown();
  }
}