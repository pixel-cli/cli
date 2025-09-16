// src/services/claude-output-streamer.ts
import { EventEmitter } from 'node:events';
import { debugLogger } from '../utils/debug-logger';
import { ClaudeOutput, ClaudeStreamEvent } from '../types/claude';

export interface OutputStreamerConfig {
  maxBufferSize?: number;
  eventNamingPattern?: 'colon' | 'dash';
}

export class ClaudeOutputStreamer extends EventEmitter {
  private activeStreams = new Map<string, boolean>();
  private buffers = new Map<string, string[]>();
  private maxBufferSize: number;
  private eventNamingPattern: 'colon' | 'dash';

  constructor(config: OutputStreamerConfig = {}) {
    super();
    this.maxBufferSize = config.maxBufferSize || 1000;
    this.eventNamingPattern = config.eventNamingPattern || 'colon';

    debugLogger.debug('Claude Output Streamer initialized', {
      maxBufferSize: this.maxBufferSize,
      eventNamingPattern: this.eventNamingPattern
    });
  }

  startStreaming(processId: string): void {
    if (this.activeStreams.has(processId)) {
      debugLogger.warn('Stream already active for Claude process', { processId });
      return;
    }

    this.activeStreams.set(processId, true);
    this.buffers.set(processId, []);

    debugLogger.debug('Started Claude output streaming', { processId });

    this.emit('stream-started', { processId, timestamp: Date.now() });
  }

  streamOutput(output: ClaudeOutput): void {
    if (!this.activeStreams.get(output.processId)) {
      debugLogger.warn('Received output for inactive Claude stream', {
        processId: output.processId
      });
      return;
    }

    this.addToBuffer(output.processId, output.data);

    const streamEvent: ClaudeStreamEvent = {
      processId: output.processId,
      type: output.type,
      data: output.data,
      timestamp: output.timestamp,
      exitCode: output.exitCode,
    };

    // Emit general event
    this.emit('output', streamEvent);

    // Emit process-specific event
    this.emit(this.formatProcessEvent('output', output.processId), streamEvent);

    // Emit type-specific events
    this.emit(output.type, streamEvent);
    this.emit(this.formatProcessEvent(output.type, output.processId), streamEvent);

    debugLogger.debug('Streamed Claude output', {
      processId: output.processId,
      type: output.type,
      dataLength: output.data.length
    });
  }

  streamError(processId: string, error: string): void {
    if (!this.activeStreams.get(processId)) {
      debugLogger.warn('Received error for inactive Claude stream', { processId });
      return;
    }

    this.addToBuffer(processId, error);

    const streamEvent: ClaudeStreamEvent = {
      processId,
      type: 'error',
      data: error,
      timestamp: Date.now(),
    };

    this.emit('error', streamEvent);
    this.emit(this.formatProcessEvent('error', processId), streamEvent);

    debugLogger.error('Streamed Claude error', { processId, error });
  }

  streamProcessExit(processId: string, exitCode: number): void {
    if (!this.activeStreams.get(processId)) {
      debugLogger.warn('Received exit for inactive Claude stream', { processId });
      return;
    }

    const exitMessage = `Claude process exited with code ${exitCode}`;
    const streamEvent: ClaudeStreamEvent = {
      processId,
      type: 'exit',
      data: exitMessage,
      timestamp: Date.now(),
      exitCode,
    };

    this.emit('exit', streamEvent);
    this.emit(this.formatProcessEvent('exit', processId), streamEvent);

    debugLogger.info('Claude process exit streamed', { processId, exitCode });

    // Stop streaming for this process
    this.stopStreaming(processId);
  }

  stopStreaming(processId: string): void {
    if (!this.activeStreams.has(processId)) {
      debugLogger.warn('Attempted to stop inactive Claude stream', { processId });
      return;
    }

    this.activeStreams.delete(processId);

    debugLogger.debug('Stopped Claude output streaming', { processId });

    this.emit('stream-stopped', { processId, timestamp: Date.now() });
  }

  isStreaming(processId: string): boolean {
    return this.activeStreams.get(processId) || false;
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  getFullOutput(processId: string): string {
    const buffer = this.buffers.get(processId);
    return buffer ? buffer.join('') : '';
  }

  getBuffer(processId: string): string[] {
    return this.buffers.get(processId) || [];
  }

  clearBuffer(processId: string): void {
    this.buffers.set(processId, []);
    debugLogger.debug('Cleared buffer for Claude process', { processId });
  }

  // Convenience event listener methods
  onOutput(handler: (event: ClaudeStreamEvent) => void): void {
    this.on('output', handler);
  }

  offOutput(handler: (event: ClaudeStreamEvent) => void): void {
    this.off('output', handler);
  }

  onProcessOutput(processId: string, handler: (event: ClaudeStreamEvent) => void): void {
    this.on(this.formatProcessEvent('output', processId), handler);
  }

  offProcessOutput(processId: string, handler: (event: ClaudeStreamEvent) => void): void {
    this.off(this.formatProcessEvent('output', processId), handler);
  }

  onProcessError(processId: string, handler: (event: ClaudeStreamEvent) => void): void {
    this.on(this.formatProcessEvent('error', processId), handler);
  }

  offProcessError(processId: string, handler: (event: ClaudeStreamEvent) => void): void {
    this.off(this.formatProcessEvent('error', processId), handler);
  }

  onProcessExit(processId: string, handler: (event: ClaudeStreamEvent) => void): void {
    this.on(this.formatProcessEvent('exit', processId), handler);
  }

  offProcessExit(processId: string, handler: (event: ClaudeStreamEvent) => void): void {
    this.off(this.formatProcessEvent('exit', processId), handler);
  }

  shutdown(): void {
    debugLogger.info('Shutting down Claude output streamer', {
      activeStreams: this.activeStreams.size
    });

    // Stop all active streams
    for (const processId of this.activeStreams.keys()) {
      this.stopStreaming(processId);
    }

    // Clear all buffers
    this.buffers.clear();

    // Remove all event listeners
    this.removeAllListeners();

    debugLogger.info('Claude output streamer shutdown complete');
  }

  private addToBuffer(processId: string, data: string): void {
    const buffer = this.buffers.get(processId);
    if (!buffer) {
      debugLogger.warn('No buffer found for Claude process', { processId });
      return;
    }

    buffer.push(data);

    // Trim buffer if it exceeds max size
    if (buffer.length > this.maxBufferSize) {
      const removed = buffer.splice(0, buffer.length - this.maxBufferSize);
      debugLogger.debug('Trimmed buffer for Claude process', {
        processId,
        removedItems: removed.length
      });
    }
  }

  private formatProcessEvent(eventType: string, processId: string): string {
    return this.eventNamingPattern === 'colon'
      ? `${eventType}:${processId}`
      : `${eventType}-${processId}`;
  }
}