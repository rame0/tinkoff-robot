/**
 * Загрузка конфигурации по условию
 */
import { RobotConfig } from "./robot";

export async function config(argsConfigName: string = undefined, isStreaming: boolean): Promise<RobotConfig> {
  if (argsConfigName === undefined) {
    let streamingPrefix = '';
    if (isStreaming) streamingPrefix = 'streaming-';
    const module = await import((`../src/configs/${streamingPrefix}main-config.js`));
    return module.config;
  }

  const module = await import(`../src/configs/${argsConfigName}.js`);
  return module.config;
}

