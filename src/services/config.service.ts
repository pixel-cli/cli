// src/services/config.service.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface PixelConfig {
  theme: 'dark' | 'light' | 'auto';
  language: 'pt-BR' | 'en-US' | 'es-ES';
  apiKey?: string;
  serverPort: number;
  autoStart: boolean;
  notifications: boolean;
  historyLimit: number;
  debug: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    showStackTrace: boolean;
  };
  user?: {
    name: string;
    email: string;
    lastLogin?: string;
  };
  ui: {
    showStatusBar: boolean;
    animationsEnabled: boolean;
    gradientType: 'pixel' | 'neon' | 'ocean' | 'sunset' | 'aurora';
  };
  claude: {
    apiKey?: string;
    model: 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';
    maxTokens: number;
    temperature: number;
    systemPrompt?: string;
    autoContext: boolean;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private configPath: string;
  private config: PixelConfig;

  private constructor() {
    this.configPath = join(homedir(), '.pixel-cli', 'config.json');
    this.config = this.loadDefaultConfig();
    this.loadConfig();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadDefaultConfig(): PixelConfig {
    return {
      theme: 'dark',
      language: 'pt-BR',
      serverPort: 3000,
      autoStart: false,
      notifications: true,
      historyLimit: 50,
      debug: {
        enabled: false,
        logLevel: 'error',
        showStackTrace: false
      },
      ui: {
        showStatusBar: true,
        animationsEnabled: true,
        gradientType: 'pixel'
      },
      claude: {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4096,
        temperature: 0.7,
        autoContext: true
      }
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      if (existsSync(this.configPath)) {
        const file = Bun.file(this.configPath);
        const savedConfig = await file.json();

        // Merge com configuração padrão para garantir que todas as chaves existam
        this.config = { ...this.config, ...savedConfig };
      } else {
        // Primeiro uso - criar diretório e arquivo de configuração
        await this.ensureConfigDirectory();
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      // Usar configuração padrão em caso de erro
    }
  }

  private async ensureConfigDirectory(): Promise<void> {
    const configDir = join(homedir(), '.pixel-cli');

    try {
      await Bun.$`mkdir -p ${configDir}`;
    } catch (error) {
      console.error('Erro ao criar diretório de configuração:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      await Bun.write(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      throw new Error('Não foi possível salvar a configuração');
    }
  }

  // Getters
  get<K extends keyof PixelConfig>(key: K): PixelConfig[K] {
    return this.config[key];
  }

  getAll(): PixelConfig {
    return { ...this.config };
  }

  getTheme(): PixelConfig['theme'] {
    return this.config.theme;
  }

  getLanguage(): PixelConfig['language'] {
    return this.config.language;
  }

  getServerPort(): number {
    return this.config.serverPort;
  }

  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  getUser(): PixelConfig['user'] {
    return this.config.user;
  }

  // Setters
  async set<K extends keyof PixelConfig>(key: K, value: PixelConfig[K]): Promise<void> {
    this.config[key] = value;
    await this.saveConfig();
  }

  async setTheme(theme: PixelConfig['theme']): Promise<void> {
    await this.set('theme', theme);
  }

  async setLanguage(language: PixelConfig['language']): Promise<void> {
    await this.set('language', language);
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.set('apiKey', apiKey);
  }

  async setUser(user: PixelConfig['user']): Promise<void> {
    await this.set('user', user);
  }

  async setServerPort(port: number): Promise<void> {
    if (port < 1 || port > 65535) {
      throw new Error('Porta deve estar entre 1 e 65535');
    }
    await this.set('serverPort', port);
  }

  // Operações de UI
  async updateUIConfig(uiConfig: Partial<PixelConfig['ui']>): Promise<void> {
    this.config.ui = { ...this.config.ui, ...uiConfig };
    await this.saveConfig();
  }

  // Operações do Claude
  async updateClaudeConfig(claudeConfig: Partial<PixelConfig['claude']>): Promise<void> {
    this.config.claude = { ...this.config.claude, ...claudeConfig };
    await this.saveConfig();
  }

  getClaudeConfig(): PixelConfig['claude'] {
    return this.config.claude;
  }

  async setClaudeApiKey(apiKey: string): Promise<void> {
    await this.updateClaudeConfig({ apiKey });
  }

  getClaudeApiKey(): string | undefined {
    return this.config.claude?.apiKey;
  }

  // Debug methods
  isDebugEnabled(): boolean {
    return this.config.debug?.enabled || false;
  }

  getDebugLevel(): 'error' | 'warn' | 'info' | 'debug' {
    return this.config.debug?.logLevel || 'error';
  }

  shouldShowStackTrace(): boolean {
    return this.config.debug?.showStackTrace !== false;
  }

  async enableDebug(): Promise<void> {
    await this.updateDebugConfig({ enabled: true });
  }

  async disableDebug(): Promise<void> {
    await this.updateDebugConfig({ enabled: false });
  }

  async setDebugLevel(level: 'error' | 'warn' | 'info' | 'debug'): Promise<void> {
    await this.updateDebugConfig({ logLevel: level });
  }

  async updateDebugConfig(debugConfig: Partial<PixelConfig['debug']>): Promise<void> {
    this.config.debug = { ...this.config.debug, ...debugConfig };
    await this.saveConfig();
  }

  // Operações especiais
  async reset(): Promise<void> {
    this.config = this.loadDefaultConfig();
    await this.saveConfig();
  }

  async resetKey<K extends keyof PixelConfig>(key: K): Promise<void> {
    const defaultConfig = this.loadDefaultConfig();
    this.config[key] = defaultConfig[key];
    await this.saveConfig();
  }

  // Validações
  isValidTheme(theme: string): theme is PixelConfig['theme'] {
    return ['dark', 'light', 'auto'].includes(theme);
  }

  isValidLanguage(language: string): language is PixelConfig['language'] {
    return ['pt-BR', 'en-US', 'es-ES'].includes(language);
  }

  isValidGradientType(type: string): type is PixelConfig['ui']['gradientType'] {
    return ['pixel', 'neon', 'ocean', 'sunset', 'aurora'].includes(type);
  }

  // Utilitários
  getConfigPath(): string {
    return this.configPath;
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  async importConfig(configJson: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configJson);

      // Validar estrutura básica
      if (typeof importedConfig !== 'object') {
        throw new Error('Configuração deve ser um objeto JSON válido');
      }

      // Merge com configuração atual, preservando estrutura
      this.config = { ...this.config, ...importedConfig };
      await this.saveConfig();

    } catch (error) {
      throw new Error('Erro ao importar configuração: ' + (error as Error).message);
    }
  }
}