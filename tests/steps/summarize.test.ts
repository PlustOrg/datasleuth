import { summarize } from '../../src/steps/summarize';
import { createMockState, executeStep, mockLLM } from '../test-utils';
import { generateText } from 'ai';

jest.mock('ai');

describe('summarize step', () => {
  // Increase timeout for all tests to 30 seconds
  jest.setTimeout(30000);
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers for all tests
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate a summary with default options', async () => {
    // Mock LLM response for summary generation
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'This is a generated summary of the research content.'
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for summarization',
            extractionDate: new Date().toISOString()
          }
        ],
        analysis: {
          general: {
            focus: 'general',
            insights: ['Insight 1', 'Insight 2'],
            confidence: 0.9
          }
        }
      }
    });

    const summarizeStep = summarize({
      llm: mockLLM
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(generateText).toHaveBeenCalled();
    expect(updatedState.data.summary).toBeDefined();
    expect(typeof updatedState.data.summary).toBe('string');
    expect(updatedState.data.summary).toBe('This is a generated summary of the research content.');
  });

  it('should respect maxLength parameter', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'This is a concise summary.'
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for summarization',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const maxLength = 200;
    const summarizeStep = summarize({
      llm: mockLLM,
      maxLength
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await resultPromise;

    // Verify the maxLength was passed to the LLM
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(maxLength.toString())
      })
    );
  });

  it('should support structured format for summaries', async () => {
    // Mock a structured JSON response from the LLM
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        summary: 'Main summary text',
        keyPoints: [
          'Key point 1',
          'Key point 2'
        ],
        sources: [
          'https://example.com/1'
        ]
      })
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for summarization',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const summarizeStep = summarize({
      llm: mockLLM,
      format: 'structured'
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // For structured summaries, we should get both the raw summary and structured data
    expect(updatedState.data.summary).toBeDefined();
    expect(updatedState.data.structuredSummary).toBeDefined();
    expect(updatedState.data.structuredSummary.keyPoints).toBeInstanceOf(Array);
    expect(updatedState.data.structuredSummary.keyPoints.length).toBe(2);
  });

  it('should include focus areas when specified', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'Summary focusing on technology and ethics.'
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content about technology and ethics',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const focus = ['technology', 'ethics'];
    const summarizeStep = summarize({
      llm: mockLLM,
      focus
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await resultPromise;

    // Check that focus areas were passed to the LLM
    for (const focusArea of focus) {
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining(focusArea)
        })
      );
    }
  });

  it('should include citations when includeCitations is true', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'Summary with citations [1], [2].'
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article 1',
            content: 'Test content 1',
            extractionDate: new Date().toISOString()
          },
          {
            url: 'https://example.com/2',
            title: 'Test article 2',
            content: 'Test content 2',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const summarizeStep = summarize({
      llm: mockLLM,
      includeCitations: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await resultPromise;

    // Verify citations instructions were included in the prompt
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('citation')
      })
    );
  });

  it('should include summary in results when includeInResults is true', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'This is a test summary.'
    });

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

    const summarizeStep = summarize({
      llm: mockLLM,
      includeInResults: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].summary).toBe('This is a test summary.');
  });

  it('should use fact checks when factsOnly is true', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'Summary based only on verified facts.'
    });

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

    const summarizeStep = summarize({
      llm: mockLLM,
      factsOnly: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await resultPromise;

    // Verify fact-checking instructions were included
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('verified fact')
      })
    );
  });

  it('should handle errors gracefully', async () => {
    // Simulate an error in the LLM
    (generateText as jest.Mock).mockRejectedValueOnce(new Error('Summarization failed'));

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

    const summarizeStep = summarize({
      llm: mockLLM
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

    const summarizeStep = summarize({
      llm: mockLLM,
      allowEmptyContent: true
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should continue without errors with a placeholder summary
    expect(updatedState.data.summary).toBe('No content available for summarization.');
  });

  it('should use customPrompt when provided', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: 'Summary generated with custom prompt.'
    });

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

    const customPrompt = 'This is a custom summarization prompt';
    const summarizeStep = summarize({
      llm: mockLLM,
      customPrompt
    });

    const resultPromise = executeStep(summarizeStep, initialState);
    
    // Run all timers
    jest.runAllTimers();
    
    await resultPromise;

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(customPrompt)
      })
    );
  });
});