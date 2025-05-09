import { z } from 'zod';
import type { ResearchState, ResearchStep } from '../src/types/pipeline';
import type { LanguageModel } from 'ai';

/**
 * Creates a mock research state for testing
 */
export function createMockState(overrides?: Partial<ResearchState>): ResearchState {
  return {
    query: 'test query',
    outputSchema: z.object({}),
    data: {
      plan: [],
      searchResults: [],
      extractedContent: [],
      analysis: {},
      summary: '',  // Changed from null to empty string
    },
    results: [],
    errors: [],
    metadata: {
      startTime: new Date(),
      stepHistory: [], // Changed from steps to stepHistory
      errors: [],
    },
    ...overrides,
  };
}

/**
 * Creates a basic output schema for testing
 */
export function createBasicSchema() {
  return z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    sources: z.array(z.string().url()),
  });
}

/**
 * Mock LLM provider for testing
 * 
 * Note: In the actual codebase, methods aren't called directly on LanguageModel objects.
 * Instead, the generateText function imported from 'ai' is used with the model as a parameter.
 * 
 * We're mocking Jest here to intercept those calls in our tests.
 */
// Create a minimal mock that satisfies the type system
export const mockLLM = {
  id: 'mock-model'
} as unknown as LanguageModel;

// Mock the generateText function from the ai package
jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  generateText: jest.fn().mockResolvedValue({ text: 'Mock LLM response' })
}));

/**
 * Mock search provider for testing 
 */
export const mockSearchProvider = {
  name: 'mock-search',
  apiKey: 'mock-api-key',
  search: jest.fn().mockResolvedValue([
    { title: 'Result 1', url: 'https://example.com/1', snippet: 'This is result 1' },
    { title: 'Result 2', url: 'https://example.com/2', snippet: 'This is result 2' },
  ]),
};

/**
 * Utility to execute a pipeline step and return the updated state
 */
export async function executeStep(
  step: ResearchStep, 
  initialState: ResearchState = createMockState()
): Promise<ResearchState> {
  return await step.execute(initialState);
}

/**
 * Captures console logs for testing purposes
 */
export function captureConsoleOutput() {
  const logs: string[] = [];
  const originalConsoleLog = console.log;
  
  beforeEach(() => {
    console.log = jest.fn((...args) => {
      logs.push(args.map(arg => String(arg)).join(' '));
    });
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    logs.length = 0;
  });
  
  return () => [...logs];
}