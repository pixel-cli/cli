// src/types/claude.ts

export interface ClaudeConfig {
  commandTimeout: number;
  maxBufferSize: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxRetries: number;
  retryDelay: number;
}

export interface ClaudeCommand {
  id: string;
  command: string;
  args: string[];
  workingDirectory?: string;
  timeout?: number;
  input?: string;
}

export interface ClaudeProcess {
  id: string;
  command: ClaudeCommand;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startTime: number;
  endTime?: number;
  pid?: number;
  exitCode?: number;
  error?: string;
}

export interface ClaudeOutput {
  processId: string;
  type: 'stdout' | 'stderr' | 'exit' | 'error';
  data: string;
  timestamp: number;
  exitCode?: number;
}

export interface ClaudeStreamEvent {
  processId: string;
  type: 'stdout' | 'stderr' | 'exit' | 'error';
  data: string;
  timestamp: number;
  exitCode?: number;
}

export interface IClaudeManager {
  executeCommand(command: ClaudeCommand): Promise<string>;
  executeStreamingCommand(command: ClaudeCommand, onOutput: (output: ClaudeOutput) => void): Promise<string>;
  getProcess(processId: string): ClaudeProcess | undefined;
  getActiveProcesses(): ClaudeProcess[];
  killProcess(processId: string): Promise<boolean>;
  isReady(): boolean;
  shutdown(): Promise<void>;
}

export interface ClaudeConnectionInfo {
  connected: boolean;
  version?: string;
  apiKey?: string;
  error?: string;
}