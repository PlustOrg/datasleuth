import { searchWeb } from '../../src/steps/searchWeb';
import { createMockState, executeStep, mockSearchProvider } from '../test-utils';
import type { ResearchState } from '../../src/types/pipeline';

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
    
    expect(mockSearchProvider.search).toHaveBeenCalled();
    expect(updatedState.data.searchResults).toBeDefined();
    expect(updatedState.data.searchResults?.length).toBeGreaterThan(0);
  });

  it('should respect maxResults option', async () => {
    const initialState = createMockState();
    const maxResults = 1;
    const searchStep = searchWeb({ 
      provider: mockSearchProvider,
      maxResults
    });
    
    const updatedState = await executeStep(searchStep, initialState);
    
    // Verify search was called with maxResults parameter
    expect(mockSearchProvider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults
      })
    );
  });

  it('should use research query if no specific query is provided', async () => {
    const query = 'test research query';
    const initialState = createMockState({ query });
    const searchStep = searchWeb({ provider: mockSearchProvider });
    
    await executeStep(searchStep, initialState);
    
    // Verify search was called with the research query
    expect(mockSearchProvider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query
      })
    );
  });

  it('should use specific search query when provided', async () => {
    const specificQuery = 'specific search query';
    const initialState = createMockState({ query: 'original query' });
    const searchStep = searchWeb({ 
      provider: mockSearchProvider,
      query: specificQuery
    });
    
    await executeStep(searchStep, initialState);
    
    // Verify search was called with the specific query, not the research query
    expect(mockSearchProvider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: specificQuery
      })
    );
  });

  it('should use queries from plan when useQueriesFromPlan is true', async () => {
    // Create a state with a plan that includes search queries
    const initialState = createMockState({
      data: {
        plan: {
          searchQueries: ['query from plan 1', 'query from plan 2']
        },
        searchResults: [],
        extractedContent: [],
        analysis: {},
        summary: ''
      }
    });
    
    const searchStep = searchWeb({ 
      provider: mockSearchProvider,
      useQueriesFromPlan: true
    });
    
    await executeStep(searchStep, initialState);
    
    // Verify search was called multiple times, once for each query from the plan
    expect(mockSearchProvider.search).toHaveBeenCalledTimes(2);
    expect(mockSearchProvider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query from plan 1'
      })
    );
    expect(mockSearchProvider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query from plan 2'
      })
    );
  });

  it('should merge search results when executing multiple queries', async () => {
    const initialState = createMockState({
      data: {
        plan: {
          searchQueries: ['query1', 'query2']
        },
        searchResults: [],
        extractedContent: [],
        analysis: {},
        summary: ''
      }
    });
    
    // Mock provider returns different results for different queries
    const customMockProvider = {
      name: 'custom-mock-search',
      apiKey: 'custom-mock-api-key',
      search: jest.fn()
        .mockImplementationOnce(() => [{ title: 'Result 1', url: 'https://example.com/1' }])
        .mockImplementationOnce(() => [{ title: 'Result 2', url: 'https://example.com/2' }])
    };
    
    const searchStep = searchWeb({ 
      provider: customMockProvider,
      useQueriesFromPlan: true
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
      includeInResults: true
    });
    
    const updatedState = await executeStep(searchStep, initialState);
    
    // When includeInResults is true, searchResults should be included in final results
    expect(updatedState.metadata.includeInResults).toContain('searchResults');
  });

  it('should handle errors from search provider', async () => {
    const initialState = createMockState();
    const errorProvider = {
      name: 'error-provider',
      apiKey: 'error-api-key',
      search: jest.fn().mockRejectedValue(new Error('Search API failure'))
    };
    
    const searchStep = searchWeb({ provider: errorProvider });
    
    try {
      await executeStep(searchStep, initialState);
      fail('Should have thrown an error');
    } catch (error: unknown) {
      // Properly type the error as unknown and check if it's an Error object
      if (error instanceof Error) {
        expect(error.message).toContain('Search API failure');
      } else {
        fail('Error should be an instance of Error');
      }
    }
  });

  it('should deduplicate search results by URL', async () => {
    const initialState = createMockState();
    
    // Mock provider that returns duplicate results
    const duplicateResultsProvider = {
      name: 'duplicate-provider',
      apiKey: 'duplicate-api-key',
      search: jest.fn().mockResolvedValue([
        { title: 'Result 1', url: 'https://example.com/duplicate' },
        { title: 'Result 2', url: 'https://example.com/duplicate' } // Same URL
      ])
    };
    
    const searchStep = searchWeb({ provider: duplicateResultsProvider });
    
    const updatedState = await executeStep(searchStep, initialState);
    
    // Should have deduplicated the results
    expect(updatedState.data.searchResults?.length).toBe(1);
  });
});