import { ICoachAiProvider } from './types.js';
import { MockCoachAiProvider } from './mockCoach.provider.js';
import { GeminiCoachAiProvider } from './geminiCoach.provider.js';

let activeCoachProvider: ICoachAiProvider | null = null;

export function getCoachAiProvider(): ICoachAiProvider {
  if (activeCoachProvider) {
    return activeCoachProvider;
  }

  const requestedProvider = (process.env.COACH_AI_PROVIDER || '').toLowerCase();

  if (requestedProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    activeCoachProvider = new GeminiCoachAiProvider();
    return activeCoachProvider;
  }

  // Default to MockCoachAiProvider for local development, CI, and deterministic testing
  activeCoachProvider = new MockCoachAiProvider();
  return activeCoachProvider;
}

export function setCoachAiProvider(provider: ICoachAiProvider | null): void {
  activeCoachProvider = provider;
}
