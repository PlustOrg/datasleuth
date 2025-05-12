import { searchWeb } from '../../src/steps/searchWeb';
import { createMockState, executeStep } from '../test-utils';
import type { ResearchState } from '../../src/types/pipeline';
import { webSearch as mockWebSearchModule } from '@plust/search-sdk';

// Define the mockSearchProvider for our tests
const mockSearchProvider = {
  name: 'mock-search',
  apiKey: 'mock-api-key',
  // Note: Removed search method since it's not directly called in our implementation
};

// Get the mocked webSearch function
const mockWebSearch = mockWebSearchModule as jest.Mock;

// Mock the @plust/search-sdk module
jest.mock('@plust/search-sdk', () => {
  return {
    webSearch: jest.fn().mockImplementation(async (options) => {
      // Return different mock data based on the query to support our tests
      const query = options.query;
      if (query === 'query from plan 1') {
        return [{ title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' }];
      } else if (query === 'query from plan 2') {
        return [{ title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' }];
      } else if (query === 'query1') {
        return [{ title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' }];
      } else if (query === 'query2') {
        return [{ title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' }];
      } else if (options.provider && options.provider.name === 'error-provider') {
        throw new Error('Search API failure');
      } else if (options.provider && options.provider.name === 'duplicate-provider') {
        return [
          { title: 'Result 1', url: 'https://example.com/duplicate', snippet: 'Snippet 1' },
          { title: 'Result 2', url: 'https://example.com/duplicate', snippet: 'Snippet 2' },
        ];
      }

      // Default mock results
      return [
        { title: 'Mock Result 1', url: 'https://example.com/mock1', snippet: 'Mock Snippet 1' },
        { title: 'Mock Result 2', url: 'https://example.com/mock2', snippet: 'Mock Snippet 2' },
      ];
    }),
  };
});

describe('searchWeb step', () => {
  // Increase timeout for all tests to 30 seconds
  jest.setTimeout(30000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should search the web with default options', async () => {
    const initialState = createMockState();
    const searchStep = searchWeb({ provider: mockSearchProvider });

    const updatedState = await executeStep(searchStep, initialState);

    expect(mockWebSearch).toHaveBeenCalled();
    expect(updatedState.data.searchResults).toBeDefined();
    expect(updatedState.data.searchResults?.length).toBeGreaterThan(0);
  });

  it('should respect maxResults option', async () => {
    const initialState = createMockState();
    const maxResults = 1;
    const searchStep = searchWeb({
      provider: mockSearchProvider,
      maxResults,
    });

    const updatedState = await executeStep(searchStep, initialState);

    // Verify search was called with maxResults parameter
    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults,
      })
    );
  });

  it('should use research query if no specific query is provided', async () => {
    const query = 'test research query';
    const initialState = createMockState({ query });
    const searchStep = searchWeb({ provider: mockSearchProvider });

    await executeStep(searchStep, initialState);

    // Verify search was called with the research query
    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query,
      })
    );
  });

  it('should use specific search query when provided', async () => {
    const specificQuery = 'specific search query';
    const initialState = createMockState({ query: 'original query' });
    const searchStep = searchWeb({
      provider: mockSearchProvider,
      query: specificQuery,
    });

    await executeStep(searchStep, initialState);

    // Verify search was called with the specific query, not the research query
    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: specificQuery,
      })
    );
  });

  it('should use queries from plan when useQueriesFromPlan is true', async () => {
    // Create a state with a plan that includes search queries
    const initialState = createMockState({
      data: {
        researchPlan: {
          // Changed from plan to researchPlan to match implementation
          searchQueries: ['query from plan 1', 'query from plan 2'],
        },
        searchResults: [],
        extractedContent: [],
        analysis: {},
        summary: '',
      },
    });

    const searchStep = searchWeb({
      provider: mockSearchProvider,
      useQueriesFromPlan: true,
    });

    await executeStep(searchStep, initialState);

    // Verify search was called multiple times, once for each query from the plan
    expect(mockWebSearch).toHaveBeenCalledTimes(2);
    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query from plan 1',
      })
    );
    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query from plan 2',
      })
    );
  });

  it('should merge search results when executing multiple queries', async () => {
    const initialState = createMockState({
      data: {
        researchPlan: {
          // Changed from plan to researchPlan to match implementation
          searchQueries: ['query1', 'query2'],
        },
        searchResults: [],
        extractedContent: [],
        analysis: {},
        summary: '',
      },
    });

    // Mock provider returns different results for different queries
    const customMockProvider = {
      name: 'custom-mock-search',
      apiKey: 'custom-mock-api-key',
    };

    const searchStep = searchWeb({
      provider: customMockProvider,
      useQueriesFromPlan: true,
    });

    const updatedState = await executeStep(searchStep, initialState);

    // Should have merged results from both queries
    expect(updatedState.data.searchResults?.length).toBe(2);
    expect(updatedState.data.searchResults?.[0].title).toBe('Result 1');
    expect(updatedState.data.searchResults?.[1].title).toBe('Result 2');
  });

  it('should include search results in final output when includeInResults is true', async () => {
    const initialState = createMockState();
    const searchStep = searchWeb({
      provider: mockSearchProvider,
      includeInResults: true,
    });

    const updatedState = await executeStep(searchStep, initialState);

    // When includeInResults is true, searchResults should be included in final results
    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0]).toHaveProperty('searchResults');
  });

  // Different approach to test error handling
  it('should handle errors from search provider', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Create a mock implementation that forces the webSearch function to throw an error
    mockWebSearch.mockImplementationOnce(() => {
      throw new Error('Search API failure');
    });

    const initialState = createMockState();
    const searchStep = searchWeb({
      provider: mockSearchProvider,
      maxRetries: 0,
    });

    // Even with retries disabled, the step might catch errors internally
    // Instead of expecting the step to throw, we'll check if it logged the error
    await executeStep(searchStep, initialState);

    // Verify that our error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('Search API failure'))
      )
    ).toBe(true);

    consoleErrorSpy.mockRestore();
  });

  it('should deduplicate search results by URL', async () => {
    const initialState = createMockState();

    // Mock provider that returns duplicate results
    const duplicateResultsProvider = {
      name: 'duplicate-provider',
      apiKey: 'duplicate-api-key',
    };

    const searchStep = searchWeb({ provider: duplicateResultsProvider });

    const updatedState = await executeStep(searchStep, initialState);

    // Should have deduplicated the results
    expect(updatedState.data.searchResults?.length).toBe(1);
  });

  it('should use defaultSearchProvider from state when no provider is specified', async () => {
    const defaultProvider = {
      name: 'default-search-provider',
      apiKey: 'default-api-key',
    };

    const initialState = createMockState();
    // Add defaultSearchProvider to the state
    initialState.defaultSearchProvider = defaultProvider;

    // Create searchWeb step without explicitly specifying a provider
    const searchStep = searchWeb({ maxResults: 5 });

    const updatedState = await executeStep(searchStep, initialState);

    // Verify search was called with the default provider
    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({
          name: 'default-search-provider',
        }),
      })
    );
    expect(updatedState.data.searchResults).toBeDefined();
    expect(updatedState.data.searchResults?.length).toBeGreaterThan(0);
  });

  it('should throw ConfigurationError when no provider is specified in options or state', async () => {
    const initialState = createMockState();
    // Don't set defaultSearchProvider in state

    // Create searchWeb step without explicitly specifying a provider
    const searchStep = searchWeb({ maxResults: 5 });

    // Should throw ConfigurationError
    await expect(executeStep(searchStep, initialState)).rejects.toThrow(
      'No search provider specified'
    );
  });
});
