import { IFoodVisionProvider } from './types.js';
import { MockFoodVisionProvider } from './providers/mockVision.provider.js';
import { GeminiVisionProvider } from './providers/geminiVision.provider.js';

let activeProvider: IFoodVisionProvider | null = null;

export function getVisionProvider(): IFoodVisionProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const requestedProvider = (process.env.VISION_AI_PROVIDER || '').toLowerCase();

  if (requestedProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    activeProvider = new GeminiVisionProvider();
    return activeProvider;
  }

  // Default to MockFoodVisionProvider for deterministic testing and local development
  activeProvider = new MockFoodVisionProvider();
  return activeProvider;
}

export function setVisionProvider(provider: IFoodVisionProvider | null): void {
  activeProvider = provider;
}
