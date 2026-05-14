#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';

const program = new Command();

program
  .name('kanban')
  .description('CLI for kanban-code project management')
  .version('0.1.0');

program
  .command('init')
  .description('Inicializar un nuevo proyecto Kanban en el directorio actual')
  .action(async () => {
    try {
      await runInit();
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\nError: ${error.message}`);
      } else {
        console.error('\nOcurrió un error inesperado.');
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
