import { z } from 'zod';
import type { ResearchState, ResearchStep } from '../src/types/pipeline';
import type { LanguageModel } from 'ai';
import { generateText } from 'ai';

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
      currentStep: '',
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
 * Mock LLM for testing that doesn't use actual Ollama
 */
export const mockLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => ({
    text: 'Mock LLM response',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    rawCall: { rawPrompt: null, rawSettings: {} }
  }),
  
  doStream: async () => ({
    stream: new ReadableStream(),
    rawCall: { rawPrompt: null, rawSettings: {} }
  })
};

/**
 * Mock LLM for fact check tests
 */
export const mockFactCheckLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-factcheck-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => ({
    text: JSON.stringify({
      statement: "Test statement 1",
      isValid: true,
      confidence: 0.9,
      evidence: ["Evidence for statement 1"]
    }),
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    rawCall: { rawPrompt: null, rawSettings: {} }
  }),
  
  doStream: async () => ({
    stream: new ReadableStream(),
    rawCall: { rawPrompt: null, rawSettings: {} }
  })
};

/**
 * Mock LLM for analysis tests
 */
export const mockAnalyzeLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-analyze-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => ({
    text: JSON.stringify({
      summary: "This is a test analysis summary",
      keyInsights: ["Key insight 1", "Key insight 2"],
      topics: ["Topic 1", "Topic 2"],
      recommendations: ["Recommendation 1", "Recommendation 2"]
    }),
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    rawCall: { rawPrompt: null, rawSettings: {} }
  }),
  
  doStream: async () => ({
    stream: new ReadableStream(),
    rawCall: { rawPrompt: null, rawSettings: {} }
  })
};

/**
 * Mock LLM for summarize tests
 */
export const mockSummarizeLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-summarize-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => ({
    text: 'This is a test summary.',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    rawCall: { rawPrompt: null, rawSettings: {} }
  }),
  
  doStream: async () => ({
    stream: new ReadableStream(),
    rawCall: { rawPrompt: null, rawSettings: {} }
  })
};

/**
 * Mock LLM for structured summarize tests
 */
export const mockStructuredSummarizeLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-structured-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => ({
    text: JSON.stringify({
      summary: "This is a structured summary for testing",
      keyPoints: ["Key point 1", "Key point 2"],
      sources: ["https://example.com/1", "https://example.com/2"]
    }),
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    rawCall: { rawPrompt: null, rawSettings: {} }
  }),
  
  doStream: async () => ({
    stream: new ReadableStream(),
    rawCall: { rawPrompt: null, rawSettings: {} }
  })
};

/**
 * Mock LLM that throws errors for error handling tests
 */
export const mockErrorLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-error-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => {
    throw new Error('LLM failure');
  },
  
  doStream: async () => {
    throw new Error('LLM failure');
  }
};

// Mock the generateText function from the ai package
jest.mock('ai', () => {
  const originalModule = jest.requireActual('ai');
  
  return {
    ...originalModule,
    generateText: jest.fn().mockImplementation(async (options: any) => {
      // Check which mock LLM model is being used
      if (options.model === mockFactCheckLLM) {
        return {
          text: JSON.stringify({
            statement: "Test statement 1",
            isValid: true,
            confidence: 0.9,
            evidence: ["Evidence for statement 1"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.model === mockErrorLLM) {
        throw new Error('LLM failure');
      }
      
      if (options.model === mockAnalyzeLLM) {
        return {
          text: JSON.stringify({
            summary: "This is a test analysis summary",
            keyInsights: ["Key insight 1", "Key insight 2"],
            topics: ["Topic 1", "Topic 2"],
            recommendations: ["Recommendation 1", "Recommendation 2"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.model === mockSummarizeLLM) {
        return {
          text: 'This is a test summary.',
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.model === mockStructuredSummarizeLLM) {
        return {
          text: JSON.stringify({
            summary: "This is a structured summary for testing",
            keyPoints: ["Key point 1", "Key point 2"],
            sources: ["https://example.com/1", "https://example.com/2"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      // For error simulation
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          options.prompt.includes('LLM failure')) {
        throw new Error('LLM failure');
      }
      
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          options.prompt.includes('Summarization failed')) {
        throw new Error('Summarization failed');
      }
      
      // For content-based response selection when specific models aren't used
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          (options.prompt.includes('fact check') || options.prompt.includes('verify'))) {
        return {
          text: JSON.stringify({
            statement: "Test statement 1",
            isValid: true,
            confidence: 0.9,
            evidence: ["Evidence for statement 1"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          (options.prompt.includes('analysis') || options.prompt.includes('analyze'))) {
        return {
          text: JSON.stringify({
            summary: "This is a test analysis summary",
            keyInsights: ["Key insight 1", "Key insight 2"],
            topics: ["Topic 1", "Topic 2"],
            recommendations: ["Recommendation 1", "Recommendation 2"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          (options.prompt.includes('research plan') || options.prompt.includes('plan research'))) {
        return {
          text: JSON.stringify({
            objectives: ["Research objective 1", "Research objective 2"],
            searchQueries: ["query 1", "query 2"],
            relevantFactors: ["factor 1", "factor 2"],
            dataGatheringStrategy: "Test data gathering strategy",
            focusAreas: ["area 1", "area 2"],
            expectedOutcomes: ["outcome 1", "outcome 2"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          options.prompt.includes('structured') && 
          (options.prompt.includes('summarize') || options.prompt.includes('summary'))) {
        return {
          text: JSON.stringify({
            summary: "This is a structured summary for testing",
            keyPoints: ["Key point 1", "Key point 2"],
            sources: ["https://example.com/1", "https://example.com/2"]
          }),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      if (options.prompt && 
          typeof options.prompt === 'string' && 
          (options.prompt.includes('summarize') || options.prompt.includes('summary'))) {
        return {
          text: 'This is a generated summary of the research content.',
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      // Default response for other tests
      return {
        text: 'Mock LLM response',
        usage: { promptTokens: 10, completionTokens: 20 },
        finishReason: 'stop'
      };
    })
  };
});

/**
 * Mock search provider for testing 
 */
export const mockSearchProvider = {
  name: 'mock-search',
  apiKey: 'mock-api-key',
  search: jest.fn().mockImplementation(async (options: any) => {
    // If the search provider is expected to fail in tests
    if (options && options.query && options.query.includes('Search API failure')) {
      throw new Error('Search API failure');
    }
    
    // For search query specific tests
    if (options && options.query) {
      if (options.query === 'query from plan 1') {
        return [
          { title: 'Result 1', url: 'https://example.com/1', snippet: 'This is result 1' }
        ];
      }
      if (options.query === 'query from plan 2') {
        return [
          { title: 'Result 2', url: 'https://example.com/2', snippet: 'This is result 2' }
        ];
      }
    }
    
    // Default results for most tests
    return [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'This is result 1' },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'This is result 2' },
    ];
  }),
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