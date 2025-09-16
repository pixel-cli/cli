// src/services/claude-command-sanitizer.ts
import { debugLogger } from '../utils/debug-logger';

export interface SanitizationOptions {
  allowFileSystemAccess?: boolean;
  allowNetworkAccess?: boolean;
  allowEnvironmentVariables?: boolean;
  allowShellMetacharacters?: boolean;
  maxCommandLength?: number;
  maxArgumentLength?: number;
  maxArgumentCount?: number;
  customAllowedPatterns?: RegExp[];
  customBlockedPatterns?: RegExp[];
}

export interface SanitizationResult {
  isValid: boolean;
  sanitizedCommand?: string;
  sanitizedArgs?: string[];
  sanitizedWorkingDirectory?: string;
  violations: string[];
  warnings: string[];
}

export class ClaudeCommandSanitizer {
  private defaultOptions: Required<SanitizationOptions>;

  constructor(options: SanitizationOptions = {}) {
    this.defaultOptions = {
      allowFileSystemAccess: true,
      allowNetworkAccess: true, // Claude needs network access
      allowEnvironmentVariables: true, // Claude uses API keys from env
      allowShellMetacharacters: false,
      maxCommandLength: 100,
      maxArgumentLength: 2000, // Claude can have long prompts
      maxArgumentCount: 50,
      customAllowedPatterns: [],
      customBlockedPatterns: [],
      ...options,
    };

    debugLogger.debug('Claude Command Sanitizer initialized', this.defaultOptions);
  }

  static createClaudeSanitizer(): ClaudeCommandSanitizer {
    return new ClaudeCommandSanitizer({
      allowFileSystemAccess: true,
      allowNetworkAccess: true,
      allowEnvironmentVariables: true,
      allowShellMetacharacters: false,
      maxCommandLength: 100,
      maxArgumentLength: 2000,
      maxArgumentCount: 50,
    });
  }

  static createStrictSanitizer(): ClaudeCommandSanitizer {
    return new ClaudeCommandSanitizer({
      allowFileSystemAccess: false,
      allowNetworkAccess: false,
      allowEnvironmentVariables: false,
      allowShellMetacharacters: false,
      maxCommandLength: 50,
      maxArgumentLength: 100,
      maxArgumentCount: 5,
    });
  }

  sanitizeCommand(
    command: string,
    args: string[] = [],
    workingDirectory?: string,
    options?: Partial<SanitizationOptions>
  ): SanitizationResult {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const result: SanitizationResult = {
      isValid: true,
      sanitizedCommand: command,
      sanitizedArgs: [...args],
      sanitizedWorkingDirectory: workingDirectory,
      violations: [],
      warnings: [],
    };

    debugLogger.debug('Sanitizing Claude command', {
      command,
      argsCount: args.length,
      workingDirectory,
    });

    // Core validations
    this.validateCommandLength(command, result, mergedOptions);
    this.validateCommandName(command, result, mergedOptions);
    this.validateArgumentCount(args, result, mergedOptions);
    this.validateArguments(args, result, mergedOptions);
    this.validateWorkingDirectory(workingDirectory, result, mergedOptions);

    // Claude-specific validations
    this.performClaudeSpecificValidations(command, args, workingDirectory, result);

    debugLogger.debug('Claude command sanitization complete', {
      command,
      isValid: result.isValid,
      violationCount: result.violations.length,
      warningCount: result.warnings.length,
    });

    return result;
  }

  sanitizeClaudeCommand(
    command: string,
    args: string[],
    workingDirectory?: string
  ): SanitizationResult {
    // Use Claude-specific defaults
    return this.sanitizeCommand(command, args, workingDirectory, {
      allowFileSystemAccess: true,
      allowNetworkAccess: true,
      allowEnvironmentVariables: true,
      allowShellMetacharacters: false,
      maxCommandLength: 100,
      maxArgumentLength: 2000,
      maxArgumentCount: 50,
    });
  }

  private performClaudeSpecificValidations(
    command: string,
    args: string[],
    workingDirectory: string | undefined,
    result: SanitizationResult
  ): void {
    // Validate Claude CLI commands
    if (command === 'claude') {
      this.validateClaudeArguments(args, result);
    }

    // Check for dangerous file operations
    this.validateDangerousOperations(command, args, workingDirectory, result);

    // Check for API key exposure
    this.validateApiKeySafety(args, result);

    // Check for prompt injection attempts
    this.validatePromptSafety(args, result);
  }

  private validateClaudeArguments(args: string[], result: SanitizationResult): void {
    // Check for potentially dangerous Claude CLI arguments
    const dangerousArgs = ['--eval', '--execute', '--shell', '--run'];
    for (const arg of args) {
      if (dangerousArgs.some(dangerous => arg.includes(dangerous))) {
        result.warnings.push(`Potentially dangerous Claude CLI argument: ${arg}`);
      }
    }

    // Check for file operations that might be risky
    const fileOperationFlags = ['--file', '-f', '--output', '-o'];
    for (const arg of args) {
      if (fileOperationFlags.some(flag => arg.startsWith(flag))) {
        result.warnings.push(`File operation detected in Claude argument: ${arg}`);
      }
    }
  }

  private validateDangerousOperations(
    command: string,
    args: string[],
    workingDirectory: string | undefined,
    result: SanitizationResult
  ): void {
    const dangerousCommands = ['rm', 'del', 'delete', 'format', 'mkfs', 'dd'];
    if (dangerousCommands.includes(command.toLowerCase())) {
      // Check if targeting sensitive directories
      const sensitiveArgs = args.some(arg =>
        arg.includes('/etc/') ||
        arg.includes('/root/') ||
        arg.includes('/sys/') ||
        arg.includes('/boot/') ||
        arg.includes('/dev/')
      );

      if (sensitiveArgs || (workingDirectory && this.isSensitiveDirectory(workingDirectory))) {
        result.violations.push('Attempted dangerous file operation on sensitive system directory');
        result.isValid = false;
      }
    }
  }

  private validateApiKeySafety(args: string[], result: SanitizationResult): void {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Check for Anthropic API keys
      if (arg.includes('sk-ant-') || /sk-ant-[a-zA-Z0-9_-]{95,}/.test(arg)) {
        result.violations.push(`Argument ${i} contains an exposed API key`);
        result.isValid = false;
      }

      // Check for environment variable references that might expose keys
      if (arg.includes('ANTHROPIC_API_KEY') && !arg.startsWith('$')) {
        result.violations.push(`Argument ${i} may contain exposed API key`);
        result.isValid = false;
      }

      // Check for other common API key patterns
      if (/['\"]?[A-Za-z0-9_-]{32,}['\"]?/.test(arg) && arg.toLowerCase().includes('key')) {
        result.warnings.push(`Argument ${i} may contain sensitive key material`);
      }
    }
  }

  private validatePromptSafety(args: string[], result: SanitizationResult): void {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Check for potential prompt injection patterns
      const injectionPatterns = [
        /ignore\s+previous\s+instructions/i,
        /forget\s+everything/i,
        /you\s+are\s+now/i,
        /system:\s*override/i,
        /\\n\\n#\s*new\s+role/i,
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(arg)) {
          result.warnings.push(`Potential prompt injection detected in argument ${i}`);
        }
      }

      // Check for excessive repetition (potential DoS)
      if (this.hasExcessiveRepetition(arg)) {
        result.warnings.push(`Excessive character repetition in argument ${i} (potential DoS)`);
      }
    }
  }

  private validateCommandLength(
    command: string,
    result: SanitizationResult,
    options: Required<SanitizationOptions>
  ): void {
    const trimmedCommand = command.trim();
    if (trimmedCommand.length === 0) {
      result.violations.push('Empty command not allowed');
      result.isValid = false;
      return;
    }

    if (trimmedCommand.length > options.maxCommandLength) {
      result.violations.push(`Command too long: exceeds maximum length of ${options.maxCommandLength} characters`);
      result.isValid = false;
    }

    result.sanitizedCommand = trimmedCommand;
  }

  private validateCommandName(
    command: string,
    result: SanitizationResult,
    options: Required<SanitizationOptions>
  ): void {
    const trimmedCommand = command.trim();

    // Check for shell metacharacters in command name
    if (!options.allowShellMetacharacters) {
      const shellMetaChars = /[;&|`$(){}[\]<>*~\\]/;
      if (shellMetaChars.test(trimmedCommand)) {
        result.violations.push('Shell metacharacters detected in command');
        result.isValid = false;
      }
    }

    // Check for path traversal
    if (trimmedCommand.includes('..')) {
      result.violations.push('Path traversal not allowed in command name');
      result.isValid = false;
    }

    // Check custom blocked patterns
    for (const pattern of options.customBlockedPatterns) {
      if (pattern.test(trimmedCommand)) {
        result.violations.push(`Command matches blocked pattern: ${pattern.source}`);
        result.isValid = false;
      }
    }
  }

  private validateArgumentCount(
    args: string[],
    result: SanitizationResult,
    options: Required<SanitizationOptions>
  ): void {
    if (args.length > options.maxArgumentCount) {
      result.violations.push(`Too many arguments: ${args.length} exceeds limit of ${options.maxArgumentCount}`);
      result.isValid = false;
    }
  }

  private validateArguments(
    args: string[],
    result: SanitizationResult,
    options: Required<SanitizationOptions>
  ): void {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Check argument length
      if (arg.length > options.maxArgumentLength) {
        result.violations.push(`Argument ${i} too long: ${arg.length} exceeds maximum of ${options.maxArgumentLength} characters`);
        result.isValid = false;
      }

      // Check for shell metacharacters
      if (!options.allowShellMetacharacters) {
        const dangerousShellMetaChars = /[;&|`$(){}[\]<>*~]/;
        if (dangerousShellMetaChars.test(arg)) {
          result.violations.push(`Shell metacharacters detected in argument ${i}: ${arg}`);
          result.isValid = false;
        }
      }

      // Check for network URLs
      if (!options.allowNetworkAccess) {
        const urlPattern = /https?:\/\//i;
        if (urlPattern.test(arg)) {
          result.violations.push(`Network access disabled: argument ${i} contains URLs`);
          result.isValid = false;
        }
      }

      // Check for path traversal
      if (arg.includes('..')) {
        result.violations.push(`Path traversal detected in argument ${i}: ${arg}`);
        result.isValid = false;
      }

      // Check for environment variable access
      if (!options.allowEnvironmentVariables) {
        const envVarPattern = /\$\{?[A-Z_][A-Z0-9_]*\}?/;
        if (envVarPattern.test(arg)) {
          result.violations.push(`Environment variable reference in argument ${i}: ${arg}`);
          result.isValid = false;
        }
      }

      // Check for binary or control characters
      // eslint-disable-next-line no-control-regex
      const binaryPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
      if (binaryPattern.test(arg)) {
        result.violations.push(`Binary or control characters in argument ${i}`);
        result.isValid = false;
      }
    }
  }

  private validateWorkingDirectory(
    workingDirectory: string | undefined,
    result: SanitizationResult,
    options: Required<SanitizationOptions>
  ): void {
    if (!workingDirectory) return;

    if (!options.allowFileSystemAccess) {
      result.violations.push('File system access disabled but working directory specified');
      result.isValid = false;
      return;
    }

    // Check for path traversal
    if (workingDirectory.includes('..')) {
      result.violations.push('Path traversal not allowed in working directory');
      result.isValid = false;
    }

    // Check for sensitive directories
    if (this.isSensitiveDirectory(workingDirectory)) {
      result.warnings.push('Working directory points to sensitive system location');
    }
  }

  private isSensitiveDirectory(path: string): boolean {
    const sensitivePaths = ['/etc', '/proc', '/sys', '/root', '/boot', '/dev', '/var/log'];
    return sensitivePaths.some(sensitivePath => path.startsWith(sensitivePath));
  }

  private hasExcessiveRepetition(text: string): boolean {
    // Check for repeated characters (more than 50 of the same character in a row)
    const repeatedCharPattern = /(.)\1{49,}/;
    if (repeatedCharPattern.test(text)) {
      return true;
    }

    // Check for repeated patterns (same 3+ character sequence repeated 10+ times)
    const repeatedPatternRegex = /(.{3,})\1{9,}/;
    if (repeatedPatternRegex.test(text)) {
      return true;
    }

    return false;
  }
}