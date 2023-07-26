/**
 * Загрузка конфигурации по условию
 */
import { RobotConfig } from "./robot";

export async function config(argsConfigName: string = undefined): Promise<RobotConfig> {
  if (argsConfigName === undefined) {
    const module = await import('../src/configs/main-config.js');
    return module.config;
  }

  const module = await import(`../src/configs/${argsConfigName}.js`);
  return module.config;
}

