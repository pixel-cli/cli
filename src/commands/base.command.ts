// src/commands/base.command.ts
import { UIService } from '../services/ui.service';

export interface CommandOptions {
  [key: string]: any;
}

export abstract class BaseCommand {
  protected ui: UIService;

  constructor() {
    this.ui = new UIService();
  }

  abstract get name(): string;
  abstract get description(): string;
  abstract get usage(): string;

  abstract execute(args: string[], options: CommandOptions): Promise<void>;

  protected showHelp(): void {
    console.log(`
Comando: ${this.name}
Descrição: ${this.description}
Uso: ${this.usage}
    `);
  }
}