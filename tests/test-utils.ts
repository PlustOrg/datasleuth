import { z } from 'zod';
import type { ResearchState, ResearchStep } from '../src/types/pipeline';
import type { LanguageModel } from 'ai';
import { generateText, generateObject } from 'ai';

// No longer using ollama directly to avoid external dependencies
// import { ollama } from 'ollama-ai-provider';
// export const ollamaLLM = ollama("phi4-mini");

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

// Default research plan object for consistent testing
const DEFAULT_RESEARCH_PLAN = {
  objectives: ["Objective 1", "Objective 2"],
  searchQueries: ["Query 1", "Query 2"],
  expectedFindings: ["Expected finding 1", "Expected finding 2"],
  relevantFactors: ["Factor 1", "Factor 2"],
  dataGatheringStrategy: "Test gathering strategy",
  focusAreas: ["Area 1", "Area 2"],
  expectedOutcomes: ["Expected outcome 1", "Expected outcome 2"]
};

// Default fact check object for consistent testing
const DEFAULT_FACT_CHECK = {
  statement: "Test statement 1",
  isValid: true,
  confidence: 0.9,
  evidence: ["Evidence for statement 1"]
};

// Default analysis object for consistent testing
const DEFAULT_ANALYSIS = {
  focus: "general",
  insights: ["Key insight 1", "Key insight 2"],
  confidence: 0.9,
  supportingEvidence: ["Evidence 1", "Evidence 2"],
  recommendations: ["Recommendation 1", "Recommendation 2"]
};

// Default structured summary for consistent testing
const DEFAULT_STRUCTURED_SUMMARY = {
  summary: "This is a structured summary for testing",
  keyPoints: ["Key point 1", "Key point 2"],
  sources: ["https://example.com/1", "https://example.com/2"]
};

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
 * Mock LLM for plan generation tests
 */
export const mockPlanLLM: LanguageModel = {
  specificationVersion: 'v1',
  provider: 'test-provider',
  modelId: 'test-plan-model',
  defaultObjectGenerationMode: 'json',
  supportsStructuredOutputs: true,
  
  doGenerate: async () => ({
    text: JSON.stringify(DEFAULT_RESEARCH_PLAN),
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
    text: JSON.stringify(DEFAULT_FACT_CHECK),
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
    text: JSON.stringify(DEFAULT_ANALYSIS),
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
    text: JSON.stringify(DEFAULT_STRUCTURED_SUMMARY),
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

// Mock the generateText and generateObject functions from the ai package
jest.mock('ai', () => {
  const originalModule = jest.requireActual('ai');
  
  // Define standard mock responses for consistent testing
  const DEFAULT_RESEARCH_PLAN = {
    objectives: ["Objective 1", "Objective 2"],
    searchQueries: ["Query 1", "Query 2"],
    relevantFactors: ["Factor 1", "Factor 2"],
    dataGatheringStrategy: "Test gathering strategy",
    expectedOutcomes: ["Expected outcome 1", "Expected outcome 2"]
  };
  
  const DEFAULT_FACT_CHECK = {
    statement: "Test statement 1",
    isValid: true,
    confidence: 0.9,
    evidence: ["Evidence for statement 1"]
  };
  
  const DEFAULT_ANALYSIS = {
    focus: "general",
    insights: ["Key insight 1", "Key insight 2"],
    confidence: 0.9,
    supportingEvidence: ["Evidence 1", "Evidence 2"],
    recommendations: ["Recommendation 1", "Recommendation 2"]
  };
  
  const DEFAULT_STRUCTURED_SUMMARY = {
    summary: "This is a structured summary for testing",
    keyPoints: ["Key point 1", "Key point 2"],
    sources: ["https://example.com/1", "https://example.com/2"]
  };
  
  return {
    ...originalModule,
    generateText: jest.fn().mockImplementation(async ({ model, prompt, system }) => {
      // Handle the error case first
      if (model === mockErrorLLM) {
        throw new Error('LLM failure');
      }
      
      // For plan testing
      if (model === mockPlanLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('research plan'))) {
        return {
          text: JSON.stringify(DEFAULT_RESEARCH_PLAN),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      // For fact check testing
      if (model === mockFactCheckLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('fact check'))) {
        return {
          text: JSON.stringify(DEFAULT_FACT_CHECK),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      // For analysis testing
      if (model === mockAnalyzeLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('analyze'))) {
        return {
          text: JSON.stringify(DEFAULT_ANALYSIS),
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      // For summarize testing
      if (model === mockSummarizeLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('summarize'))) {
        if (prompt && typeof prompt === 'string' && prompt.includes('structured')) {
          return {
            text: JSON.stringify(DEFAULT_STRUCTURED_SUMMARY),
            usage: { promptTokens: 10, completionTokens: 20 },
            finishReason: 'stop'
          };
        }
        
        return {
          text: 'This is a test summary.',
          usage: { promptTokens: 10, completionTokens: 20 },
          finishReason: 'stop'
        };
      }
      
      // Default response
      return {
        text: 'Mock LLM response',
        usage: { promptTokens: 10, completionTokens: 20 },
        finishReason: 'stop'
      };
    }),
    
    generateObject: jest.fn().mockImplementation(async ({ model, schema, prompt, system }) => {
      // Explicit error case
      if (model === mockErrorLLM) {
        throw new Error('LLM failure');
      }
      
      // Research plan case - used by our plan.ts file
      if (model === mockPlanLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('research plan')) ||
          (schema && schema.shape && 'objectives' in schema.shape)) {
        
        return {
          object: {
            objectives: ["Objective 1", "Objective 2"],
            searchQueries: ["Query 1", "Query 2"],
            relevantFactors: ["Factor 1", "Factor 2"],
            dataGatheringStrategy: "Test gathering strategy",
            expectedOutcomes: ["Expected outcome 1", "Expected outcome 2"]
          }
        };
      }
      
      // Fact check case
      if (model === mockFactCheckLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('fact check')) ||
          (schema && schema.shape && 'isValid' in schema.shape)) {
        
        return {
          object: DEFAULT_FACT_CHECK
        };
      }
      
      // Analysis case
      if (model === mockAnalyzeLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('analyze')) ||
          (schema && schema.shape && 'insights' in schema.shape)) {
        
        return {
          object: DEFAULT_ANALYSIS 
        };
      }
      
      // Summarize case
      if (model === mockSummarizeLLM || 
          model === mockStructuredSummarizeLLM || 
          (prompt && typeof prompt === 'string' && prompt.includes('summarize'))) {
        
        if (model === mockStructuredSummarizeLLM || 
            (prompt && typeof prompt === 'string' && prompt.includes('structured'))) {
          return {
            object: DEFAULT_STRUCTURED_SUMMARY
          };
        }
        
        return {
          object: 'This is a test summary.'
        };
      }
      
      // Default fallback
      return {
        object: {
          key: "value",
          nested: { property: "test" },
          array: [1, 2, 3]
        }
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