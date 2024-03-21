import { Signal, SignalParams, SignalResult } from './base.js';
import { RobotModule } from "../utils/robot-module";

export class RandomSignal extends Signal<{}> {
  constructor(protected strategy: RobotModule) {
    super(strategy, {});
  }

  get minCandlesCount() {
    return 1; // We only need the latest candle to make a random decision
  }

  calc(_: SignalParams): SignalResult {
    const decision = Math.floor(Math.random() * 3); // Random number between 0 and 2
    if (decision === 0) {
      return 'buy';
    } else if (decision === 1) {
      return 'sell';
    }
    // If decision is 2, we do nothing
  }
}
