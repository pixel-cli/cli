// src/services/claude-code.service.ts
import { spawn, ChildProcess } from 'node:child_process';
import { ConfigService } from './config.service';
import { CommandService } from './command.service';
import { debugLogger } from '../utils/debug-logger';
import chalk from 'chalk';
import { join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ProjectContext {
  workingDirectory: string;
  files: string[];
  packageJson?: any;
  gitInfo?: {
    branch: string;
    lastCommit?: string;
  };
}

export class ClaudeCodeService {
  private claudeProcess: ChildProcess | null = null;
  private configService: ConfigService;
  private commandService: CommandService;
  private conversationHistory: ClaudeMessage[] = [];
  private projectContext: ProjectContext | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.configService = ConfigService.getInstance();
    this.commandService = new CommandService();
  }

  async connect(): Promise<boolean> {
    try {
      // Verifica se Claude Code está instalado
      const checkInstallation = await this.checkClaudeCodeInstallation();
      if (!checkInstallation) {
        throw new Error('Claude Code não está instalado. Execute: npm install -g @anthropic-ai/claude-code');
      }

      // Teste simples e rápido
      await this.testClaudeCode();

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Erro ao conectar com Claude Code:', error);
      this.isConnected = false;
      return false;
    }
  }

  private async testClaudeCode(): Promise<void> {
    try {
      // Teste mínimo - apenas verificar se comando responde
      const result = await Bun.$`claude --help`.text();
      if (!result.includes('Usage: claude')) {
        throw new Error('Claude Code não está respondendo corretamente');
      }
    } catch (error) {
      throw new Error(`Claude Code não está funcionando: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async checkClaudeCodeInstallation(): Promise<boolean> {
    try {
      const result = await Bun.$`which claude`.text();
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Como não temos processo persistente, apenas marcar como desconectado
    this.isConnected = false;
    this.claudeProcess = null;
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async buildProjectContext(): Promise<ProjectContext> {
    const cwd = process.cwd();
    const context: ProjectContext = {
      workingDirectory: cwd,
      files: []
    };

    try {
      // Get file list (limited to avoid overwhelming)
      context.files = await this.getProjectFiles(cwd);

      // Try to read package.json if exists
      try {
        const packageFile = Bun.file(join(cwd, 'package.json'));
        if (await packageFile.exists()) {
          context.packageJson = await packageFile.json();
        }
      } catch {
        // package.json doesn't exist or is invalid
      }

      // Get git info if available
      try {
        const gitBranch = await Bun.$`git branch --show-current`.text();
        const lastCommit = await Bun.$`git log -1 --oneline`.text();

        context.gitInfo = {
          branch: gitBranch.trim(),
          lastCommit: lastCommit.trim()
        };
      } catch {
        // Not a git repository or git not available
      }

    } catch (error) {
      console.error('Error building project context:', error);
    }

    this.projectContext = context;
    return context;
  }

  private async getProjectFiles(dir: string, depth: number = 0): Promise<string[]> {
    if (depth > 1) return []; // Reduced depth to avoid too many files

    const files: string[] = [];
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.vscode'];

    try {
      const entries = await readdir(dir);

      // Prioritize important files
      const prioritizedEntries = entries.sort((a, b) => {
        const aPriority = this.getFilePriority(a);
        const bPriority = this.getFilePriority(b);
        return bPriority - aPriority;
      });

      for (const entry of prioritizedEntries.slice(0, 15)) { // Reduced to 15 entries max
        if (ignoreDirs.includes(entry)) continue;

        const fullPath = join(dir, entry);
        const relativePath = fullPath.replace(process.cwd() + '/', '');

        try {
          const stats = await stat(fullPath);

          if (stats.isFile()) {
            if (this.isRelevantFile(entry)) {
              files.push(relativePath);
            }
          } else if (stats.isDirectory() && depth === 0) {
            // Only go one level deep and only for src-like directories
            if (['src', 'lib', 'app', 'pages', 'components'].includes(entry)) {
              const subFiles = await this.getProjectFiles(fullPath, depth + 1);
              files.push(...subFiles.slice(0, 10)); // Limit subfiles
            }
          }
        } catch {
          // Skip files/dirs we can't access
        }
      }
    } catch {
      // Can't read directory
    }

    return files.slice(0, 20); // Total limit of 20 files
  }

  private getFilePriority(filename: string): number {
    if (filename === 'package.json') return 100;
    if (filename === 'README.md') return 90;
    if (filename.startsWith('index.')) return 80;
    if (filename.startsWith('main.')) return 70;
    if (filename.includes('.config.')) return 60;
    if (filename.endsWith('.ts') || filename.endsWith('.js')) return 50;
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return 45;
    return 10;
  }

  private isRelevantFile(filename: string): boolean {
    const relevantExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.vue', '.svelte',
      '.py', '.rb', '.php', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.sass', '.less',
      '.html', '.htm', '.md', '.mdx',
      '.json', '.yaml', '.yml', '.toml',
      '.sql', '.graphql', '.gql',
      '.sh', '.bash', '.zsh'
    ];

    return relevantExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  async sendMessage(
    message: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Claude Code não está conectado. Execute a conexão primeiro.');
    }

    // Check if this is a system command
    if (message.startsWith(':')) {
      return await this.handleSystemCommand(message.slice(1));
    }

    try {
      // Build lightweight context only when needed
      let contextualMessage = message;
      try {
        if (!this.projectContext) {
          await this.buildProjectContext();
        }

        if (this.projectContext) {
          const contextInfo = this.buildLightweightContext();
          if (contextInfo && contextInfo.length < 500) { // Avoid too large context
            contextualMessage = `${contextInfo}\n\n${message}`;
          }
        }
      } catch (contextError) {
        // If context fails, just use the message without context
        debugLogger.warn('Context build failed', contextError);
      }

      debugLogger.debug('Sending message to Claude', {
        messageLength: contextualMessage.length,
        fullMessage: contextualMessage
      });

      // Add to conversation history
      this.conversationHistory.push({ role: 'user', content: message, timestamp: new Date() });

      if (onStream) {
        // Use streaming mode
        const streamResult = await this.sendStreamingMessage(contextualMessage, onStream);
        debugLogger.debug('Streaming result', { type: typeof streamResult, length: streamResult?.length });
        return streamResult;
      } else {
        // Use simple print mode with stdin
        const simpleResult = await this.sendSimpleMessage(contextualMessage);
        debugLogger.debug('Simple result', { type: typeof simpleResult, length: simpleResult?.length });
        return simpleResult;
      }
    } catch (error) {
      debugLogger.error('Error in sendMessage', error);
      throw new Error(`Erro ao enviar mensagem para Claude Code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sendSimpleMessage(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', ['--print'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let fullResponse = '';
      let errorOutput = '';

      claudeProcess.stdout.setEncoding('utf8');
      claudeProcess.stderr.setEncoding('utf8');

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        fullResponse += chunk;
        debugLogger.streamData(chunk, 'text');
      });

      claudeProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errorOutput += error;
        debugLogger.error('Claude stderr output', error);
      });

      claudeProcess.on('close', (code) => {
        debugLogger.processInfo('Claude process closed', code);

        if (code === 0) {
          this.conversationHistory.push({ role: 'assistant', content: fullResponse, timestamp: new Date() });
          resolve(fullResponse);
        } else {
          reject(new Error(`Claude Code exited with code ${code}. Error: ${errorOutput}`));
        }
      });

      claudeProcess.on('error', (error) => {
        debugLogger.error('Claude process error', error);
        reject(new Error(`Erro no processo Claude Code: ${error.message}`));
      });

      // Send message via stdin
      claudeProcess.stdin.write(message);
      claudeProcess.stdin.end();

      // Timeout
      setTimeout(() => {
        claudeProcess.kill();
        reject(new Error('Timeout na resposta do Claude Code (10s)'));
      }, 10000); // Reduced to 10 seconds
    });
  }

  private async sendStreamingMessage(message: string, onStream: (chunk: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use stream-json output format for real-time streaming with verbose flag
      const claudeProcess = spawn('claude', [
        '--print',
        '--output-format', 'stream-json',
        '--verbose'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let fullResponse = '';
      let errorOutput = '';

      claudeProcess.stdout.setEncoding('utf8');
      claudeProcess.stderr.setEncoding('utf8');

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        debugLogger.streamData(chunk, 'json');

        const lines = data.toString().split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response = JSON.parse(line);

            debugLogger.debug(`Parsed JSON response type: ${response.type}`);

            if (response.type === 'content' && response.content) {
              const chunk = response.content;
              fullResponse += chunk;
              onStream(chunk);
            } else if (response.type === 'error') {
              debugLogger.error('Claude stream error', response);
            } else if (response.type === 'result') {
              debugLogger.jsonResponse(response, 'result');
            } else if (response.type === 'assistant') {
              debugLogger.jsonResponse(response, 'assistant');
              if (response.message) {
                const chunk = response.message + '\n';
                fullResponse += chunk;
                onStream(chunk);
              }
            } else {
              debugLogger.debug(`Unknown JSON response type '${response.type}'`, response);
            }
          } catch (parseError) {
            debugLogger.debug('JSON parse error', {
              error: parseError instanceof Error ? parseError.message : String(parseError),
              rawLine: line
            });

            // Se não for JSON válido, trata como texto simples
            if (line.trim() && !line.startsWith('{')) {
              const chunk = line + '\n';
              fullResponse += chunk;
              onStream(chunk);
              debugLogger.debug(`Treating as plain text chunk (${chunk.length} chars)`);
            }
          }
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errorOutput += error;
        debugLogger.error('Claude stream stderr', error);
      });

      claudeProcess.on('close', (code) => {
        debugLogger.processInfo('Claude stream process closed', code);

        if (code === 0) {
          this.conversationHistory.push({ role: 'assistant', content: fullResponse, timestamp: new Date() });
          resolve(fullResponse);
        } else {
          reject(new Error(`Claude Code exited with code ${code}. Error: ${errorOutput}`));
        }
      });

      claudeProcess.on('error', (error) => {
        debugLogger.error('Claude stream process error', error);
        reject(new Error(`Erro no processo Claude Code: ${error.message}`));
      });

      // Send message via stdin
      claudeProcess.stdin.write(message);
      claudeProcess.stdin.end();

      // Reduced timeout
      setTimeout(() => {
        claudeProcess.kill();
        reject(new Error('Timeout na resposta do Claude Code streaming (10s)'));
      }, 10000);
    });
  }

  private buildLightweightContext(): string {
    const context = this.projectContext;
    if (!context) return '';

    // Use proper working directory from context
    const workDir = context.workingDirectory || process.cwd();
    const projectName = workDir.split('/').pop() || 'unknown';

    let prompt = `Working directory: ${workDir} (${projectName})`;

    // Only add essential info
    if (context.packageJson?.name) {
      prompt += `\nProject: ${context.packageJson.name}`;
    }

    if (context.gitInfo?.branch && context.gitInfo.branch !== 'main' && context.gitInfo.branch !== 'master') {
      prompt += `\nBranch: ${context.gitInfo.branch}`;
    }

    // Only show first 5 most important files
    if (context.files.length > 0) {
      const importantFiles = context.files
        .filter(f => f.includes('package.json') || f.includes('README') || f.includes('index.') || f.includes('main.'))
        .slice(0, 5);

      if (importantFiles.length > 0) {
        prompt += `\nMain files: ${importantFiles.join(', ')}`;
      }
    }

    return prompt;
  }

  private buildContextPrompt(): string {
    const context = this.projectContext;
    if (!context) return '';

    let prompt = `Project Context:
Working Directory: ${context.workingDirectory}`;

    if (context.packageJson) {
      prompt += `\nProject: ${context.packageJson.name || 'Unknown'}`;
      if (context.packageJson.description) {
        prompt += `\nDescription: ${context.packageJson.description}`;
      }
    }

    if (context.gitInfo) {
      prompt += `\nGit Branch: ${context.gitInfo.branch}`;
      if (context.gitInfo.lastCommit) {
        prompt += `\nLast Commit: ${context.gitInfo.lastCommit}`;
      }
    }

    if (context.files.length > 0) {
      prompt += `\nProject Files (${context.files.length} total):`;
      prompt += `\n${context.files.slice(0, 15).map(f => `- ${f}`).join('\n')}`;
      if (context.files.length > 15) {
        prompt += `\n... and ${context.files.length - 15} more files`;
      }
    }

    return prompt;
  }

  private async handleSystemCommand(command: string): Promise<string> {
    const [commandName, ...args] = command.split(' ');

    try {
      // Execute system command through existing command service
      await this.commandService.executeCommand(command);
      return `System command "${commandName}" executed successfully.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message :
                          typeof error === 'object' && error !== null ? JSON.stringify(error) :
                          String(error);
      return `Error executing system command: ${errorMessage}`;
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): ClaudeMessage[] {
    return [...this.conversationHistory];
  }

  async refreshProjectContext(): Promise<void> {
    await this.buildProjectContext();
  }

  getProjectContext(): ProjectContext | null {
    return this.projectContext;
  }

  // Método para verificar se Claude Code está funcionando
  async healthCheck(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      // Envia uma mensagem simples de teste
      await this.sendMessage('Hello, are you working?');
      return true;
    } catch {
      return false;
    }
  }
}