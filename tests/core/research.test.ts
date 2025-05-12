import { research } from '../../src/core/research';
import { z } from 'zod';
import { createBasicSchema, mockLLM, mockSearchProvider } from '../test-utils';

describe('research() - Main API', () => {
  // Mock the default steps to avoid actual API calls
  jest.mock('../../src/core/research', () => {
    const originalModule = jest.requireActual('../../src/core/research');
    return {
      ...originalModule,
      getDefaultSteps: jest.fn().mockReturnValue([
        {
          name: 'MockStep',
          execute: jest.fn().mockImplementation(async (state) => {
            return {
              ...state,
              data: {
                ...state.data,
                summary: 'This is a mock summary',
                keyFindings: ['Finding 1', 'Finding 2'],
                sources: ['https://example.com/1', 'https://example.com/2'],
              },
              results: [
                {
                  summary: 'This is a mock summary',
                  keyFindings: ['Finding 1', 'Finding 2'],
                  sources: ['https://example.com/1', 'https://example.com/2'],
                },
              ],
            };
          }),
        },
      ]),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate input schema correctly', async () => {
    const inputSchema = z.object({
      query: z.string(),
      outputSchema: z.any(),
    });

    const input = {
      query: 'Test query',
      outputSchema: createBasicSchema(),
    };

    // This should not throw an error
    await expect(research(input)).resolves.not.toThrow();
  });

  it('should throw an error for invalid input', async () => {
    const invalidInput = {
      // Missing required 'query' field
      outputSchema: createBasicSchema(),
    };

    // @ts-ignore - Intentionally testing with invalid input
    await expect(research(invalidInput)).rejects.toThrow();
  });

  it('should validate output against the provided schema', async () => {
    const outputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      sources: z.array(z.string().url()),
    });

    const result = await research({
      query: 'Test query',
      outputSchema,
    });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.keyFindings)).toBe(true);
    expect(Array.isArray(result.sources)).toBe(true);
  });

  it('should reject output that does not match the schema', async () => {
    // Create a schema with requirements that won't be met by our mock
    const strictOutputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      sources: z.array(z.string().url()),
      requiredField: z.string(), // This field is required but not provided by our mock
    });

    await expect(
      research({
        query: 'Test query',
        outputSchema: strictOutputSchema,
      })
    ).rejects.toThrow();
  });

  it('should use custom steps when provided', async () => {
    const customStep = {
      name: 'CustomStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            customValue: 'custom step executed',
            summary: 'Custom summary',
            keyFindings: ['Custom finding'],
            sources: ['https://example.com/custom'],
          },
          results: [
            {
              summary: 'Custom summary',
              keyFindings: ['Custom finding'],
              sources: ['https://example.com/custom'],
            },
          ],
        };
      }),
    };

    const result = await research({
      query: 'Test query with custom step',
      outputSchema: createBasicSchema(),
      steps: [customStep],
    });

    expect(customStep.execute).toHaveBeenCalled();
    expect(result.summary).toBe('Custom summary');
  });

  it('should handle defaultLLM configuration', async () => {
    const result = await research({
      query: 'Test query with default LLM',
      outputSchema: createBasicSchema(),
      defaultLLM: mockLLM,
    });

    // The test passes if there's no error with the defaultLLM
    expect(result).toBeDefined();
  });

  it('should handle defaultSearchProvider configuration', async () => {
    const result = await research({
      query: 'Test query with default search provider',
      outputSchema: createBasicSchema(),
      defaultSearchProvider: mockSearchProvider,
    });

    // The test passes if there's no error with the defaultSearchProvider
    expect(result).toBeDefined();
  });

  it('should handle both defaultLLM and defaultSearchProvider configuration', async () => {
    const result = await research({
      query: 'Test query with both default providers',
      outputSchema: createBasicSchema(),
      defaultLLM: mockLLM,
      defaultSearchProvider: mockSearchProvider,
    });

    // The test passes if there's no error with both providers configured
    expect(result).toBeDefined();
  });

  it('should respect configuration options', async () => {
    const configuredResearch = await research({
      query: 'Test query with config',
      outputSchema: createBasicSchema(),
      config: {
        errorHandling: 'continue',
        timeout: 30000,
        maxRetries: 2,
      },
    });

    // This test is mainly to verify that configuration options don't cause errors
    expect(configuredResearch).toBeDefined();
  });

  it('should throw ConfigurationError when default steps are used without defaultSearchProvider', async () => {
    // We need to restore the original implementation for this test
    jest.unmock('../../src/core/research');

    // Mock NODE_ENV to ensure we're not in a test environment where the check is skipped
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      // Should throw because we're using default steps without defaultSearchProvider
      await expect(
        research({
          query: 'Test query without search provider',
          outputSchema: createBasicSchema(),
          defaultLLM: mockLLM, // Provide LLM but not search provider
          steps: [], // Empty array to trigger default steps
        })
      ).rejects.toThrow('No search provider provided for research');
    } finally {
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;

      // Re-apply the mock for other tests
      jest.mock('../../src/core/research', () => {
        const originalModule = jest.requireActual('../../src/core/research');
        return {
          ...originalModule,
          getDefaultSteps: jest.fn().mockReturnValue([
            {
              name: 'MockStep',
              execute: jest.fn().mockImplementation(async (state) => {
                return {
                  ...state,
                  data: {
                    ...state.data,
                    summary: 'This is a mock summary',
                    keyFindings: ['Finding 1', 'Finding 2'],
                    sources: ['https://example.com/1', 'https://example.com/2'],
                  },
                  results: [
                    {
                      summary: 'This is a mock summary',
                      keyFindings: ['Finding 1', 'Finding 2'],
                      sources: ['https://example.com/1', 'https://example.com/2'],
                    },
                  ],
                };
              }),
            },
          ]),
        };
      });
    }
  });
});
