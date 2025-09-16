// src/services/daemon.service.ts
import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { debugLogger } from '../utils/debug-logger';

export class DaemonService {
  private pidFile: string;
  private logFile: string;

  constructor() {
    const homeDir = process.env.HOME || process.cwd();
    this.pidFile = join(homeDir, '.pixel-cli-daemon.pid');
    this.logFile = join(homeDir, '.pixel-cli-daemon.log');
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      throw new Error('Daemon já está rodando');
    }

    try {
      // Spawn detached process
      const scriptPath = process.argv[1]; // Path to the current script
      debugLogger.debug(`Spawning daemon: ${process.execPath} ${scriptPath} --daemon`);

      const child = spawn(process.execPath, [
        scriptPath,
        '--daemon-mode'
      ], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Save PID
      const pidData = {
        pid: child.pid,
        started: new Date().toISOString()
      };

      await Bun.write(this.pidFile, JSON.stringify(pidData, null, 2));

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Detach from parent
      child.unref();

      debugLogger.info('Daemon started', { pid: child.pid });

    } catch (error) {
      debugLogger.error('Failed to start daemon', error);
      throw new Error(`Falha ao iniciar daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning()) {
      throw new Error('Daemon não está rodando');
    }

    try {
      const pidData = await this.getPidData();
      if (!pidData) {
        throw new Error('Arquivo PID não encontrado');
      }

      // Kill process
      process.kill(pidData.pid, 'SIGTERM');

      // Wait for process to exit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clean up PID file
      try {
        await Bun.file(this.pidFile).exists() && await Bun.$`rm ${this.pidFile}`;
      } catch {
        // PID file might already be gone
      }

      debugLogger.info('Daemon stopped', { pid: pidData.pid });

    } catch (error) {
      // Clean up stale PID file
      try {
        await Bun.file(this.pidFile).exists() && await Bun.$`rm ${this.pidFile}`;
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(`Falha ao parar daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isRunning(): boolean {
    try {
      const pidData = this.getPidDataSync();
      if (!pidData) return false;

      // Test if process exists
      process.kill(pidData.pid, 0);
      return true;
    } catch (error) {
      // Process doesn't exist, clean up stale PID file
      try {
        Bun.file(this.pidFile).exists() && Bun.spawnSync(['rm', this.pidFile]);
      } catch {
        // Ignore cleanup errors
      }
      return false;
    }
  }

  getPid(): number | null {
    const pidData = this.getPidDataSync();
    return pidData ? pidData.pid : null;
  }

  getLogFile(): string {
    return this.logFile;
  }

  private async getPidData(): Promise<{ pid: number; started: string } | null> {
    try {
      const pidFile = Bun.file(this.pidFile);
      if (!(await pidFile.exists())) return null;

      const content = await pidFile.text();
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private getPidDataSync(): { pid: number; started: string } | null {
    try {
      const pidFile = Bun.file(this.pidFile);
      if (!pidFile) return null;

      // Use sync read for immediate availability check
      const result = Bun.spawnSync(['cat', this.pidFile]);
      if (result.exitCode !== 0) return null;

      const content = result.stdout.toString();
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async startMonitoring(): Promise<void> {
    // Save PID for daemon mode
    const pidData = {
      pid: process.pid,
      started: new Date().toISOString()
    };

    await Bun.write(this.pidFile, JSON.stringify(pidData, null, 2));

    // Setup logging
    const logStream = Bun.file(this.logFile).writer();

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `${timestamp} - ${args.join(' ')}\n`;
      logStream.write(message);
      originalLog(...args);
    };

    console.error = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `${timestamp} - ERROR: ${args.join(' ')}\n`;
      logStream.write(message);
      originalError(...args);
    };

    console.log('Pixel CLI daemon started');
    console.log('Monitoring Claude Code conversations...');

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully');

      try {
        await Bun.file(this.pidFile).exists() && await Bun.$`rm ${this.pidFile}`;
      } catch {
        // Ignore cleanup errors
      }

      logStream.end();
      process.exit(0);
    });

    // Keep the process running indefinitely
    setInterval(() => {
      // Monitor Claude Code activity here
      // For now, just keep alive
    }, 30000);
  }
}