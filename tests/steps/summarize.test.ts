import { createMockState, executeStep } from '../test-utils';
import { mockSummarize } from '../mocks/summarize-mock';
import { LLMError, ValidationError } from '../../src/types/errors';

describe('summarize step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate a summary with default options', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for summary',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const summarizeStep = mockSummarize();

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.summary).toBeDefined();
    expect(typeof updatedState.data.summary).toBe('string');
  });

  it('should generate structured summary when format is structured', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for structured summary',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const summarizeStep = mockSummarize({
      format: 'structured'
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.summary).toBeDefined();
    // For structured summaries, we store as JSON string in summary field
    const structuredSummary = JSON.parse(updatedState.data.summary as string);
    expect(structuredSummary.keyPoints).toBeDefined();
    expect(Array.isArray(structuredSummary.keyPoints)).toBe(true);
  });

  it('should respect maxLength parameter', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for summary with length limit',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const maxLength = 20;
    const summarizeStep = mockSummarize({
      maxLength,
      // Provide a longer mock summary to test truncation
      mockSummary: 'This is a very long summary that should be truncated because it exceeds the maximum length'
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.summary).toBeDefined();
    expect(typeof updatedState.data.summary).toBe('string');
    expect((updatedState.data.summary as string).length).toBeLessThanOrEqual(maxLength + 3); // +3 for the "..." ellipsis
  });

  it('should include summary in results when includeInResults is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for results inclusion',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const summarizeStep = mockSummarize({
      includeInResults: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].summary).toBeDefined();
  });

  it('should not include summary in results when includeInResults is false', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString()
          }
        ]
      },
      results: [] // Explicitly empty results
    });

    const summarizeStep = mockSummarize({
      includeInResults: false
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.results.length).toBe(0);
  });

  it('should use fact checks when factsOnly is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString()
          }
        ],
        factChecks: [
          {
            statement: 'Verified fact 1',
            isValid: true,
            confidence: 0.9
          },
          {
            statement: 'Disputed claim',
            isValid: false,
            confidence: 0.8
          }
        ]
      }
    });

    const summarizeStep = mockSummarize({
      factsOnly: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.summary).toBeDefined();
    expect(typeof updatedState.data.summary).toBe('string');
    expect((updatedState.data.summary as string).includes('verified facts')).toBe(true);
    expect((updatedState.data.summary as string).includes('Verified fact 1')).toBe(true);
    expect((updatedState.data.summary as string).includes('Disputed claim')).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const summarizeStep = mockSummarize({
      shouldError: true,
      errorMessage: 'Summarization failed'
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow('Summarization failed');
  });

  it('should handle empty content gracefully when allowEmptyContent is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [] // No content to summarize
      }
    });

    const summarizeStep = mockSummarize({
      allowEmptyContent: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should continue without errors and not add summary
    expect(updatedState.data.summary).toBeUndefined();
  });

  it('should throw error for empty content when allowEmptyContent is false', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [] // No content to summarize
      }
    });

    const summarizeStep = mockSummarize({
      allowEmptyContent: false
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow('No content available for summarization');
  });

  it('should use custom summary when provided', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const customSummary = 'This is a custom summary provided for testing';

    const summarizeStep = mockSummarize({
      mockSummary: customSummary
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.summary).toBe(customSummary);
  });
});