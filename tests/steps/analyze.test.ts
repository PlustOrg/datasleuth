import { analyze } from '../../src/steps/analyze';
import { createMockState, executeStep, mockLLM } from '../test-utils';
import { generateText } from 'ai';

jest.mock('ai');

describe('analyze step', () => {
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

  it('should perform analysis with default options', async () => {
    // Mock the LLM response with analysis results
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        focus: 'general',
        insights: ['Insight 1', 'Insight 2'],
        confidence: 0.85,
        supportingEvidence: ['Evidence 1', 'Evidence 2']
      })
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for analysis',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general'
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(generateText).toHaveBeenCalled();
    expect(updatedState.data.analysis).toBeDefined();
    expect(updatedState.data.analysis?.general).toBeDefined();
    expect(updatedState.data.analysis?.general.insights.length).toBe(2);
  });

  it('should respect focus parameter', async () => {
    // Mock the LLM response with analysis results
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        focus: 'market-trends',
        insights: ['Market trend 1', 'Market trend 2'],
        confidence: 0.9,
        supportingEvidence: ['Market evidence 1'],
        recommendations: ['Market recommendation 1']
      })
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Market Research',
            content: 'Content about market trends',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'market-trends'
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // The analysis should be stored under the specified focus key
    expect(updatedState.data.analysis?.['market-trends']).toBeDefined();
    expect(updatedState.data.analysis?.['market-trends'].focus).toBe('market-trends');
    expect(updatedState.data.analysis?.['market-trends'].insights).toContain('Market trend 1');
  });

  it('should include recommendations when includeRecommendations is true', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        focus: 'general',
        insights: ['Insight 1'],
        confidence: 0.85,
        recommendations: ['Recommendation 1', 'Recommendation 2']
      })
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

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general', // Add required focus property
      includeRecommendations: true
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.analysis?.general.recommendations).toBeDefined();
    expect(updatedState.data.analysis?.general.recommendations?.length).toBe(2);
  });

  it('should respect depth parameter', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        focus: 'general',
        insights: ['Detailed insight 1', 'Detailed insight 2', 'Detailed insight 3'],
        confidence: 0.9,
        supportingEvidence: ['Detailed evidence 1', 'Detailed evidence 2']
      })
    });

    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for detailed analysis',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general', // Add required focus property
      depth: 'detailed'
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Check that the LLM was called with instructions matching the depth
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('detailed')
      })
    );

    expect(updatedState.data.analysis?.general.insights.length).toBe(3);
  });

  it('should include analysis in results when includeInResults is true', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        focus: 'general',
        insights: ['Insight 1'],
        confidence: 0.85
      })
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

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general', // Add required focus property
      includeInResults: true
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].analysis).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    // Simulate an error in the LLM
    (generateText as jest.Mock).mockRejectedValueOnce(new Error('Analysis failed'));

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

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general' // Add required focus property
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow('Analysis failed');
  });

  it('should handle empty content gracefully when allowEmptyContent is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [] // No content to analyze
      }
    });

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general', // Add required focus property
      allowEmptyContent: true
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should continue without errors and not add analysis
    expect(updatedState.data.analysis).toBeUndefined();
  });

  it('should throw error for empty content when allowEmptyContent is false', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [] // No content to analyze
      }
    });

    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general', // Add required focus property
      allowEmptyContent: false
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow();
  });

  it('should use customPrompt when provided', async () => {
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        focus: 'general',
        insights: ['Custom insight'],
        confidence: 0.9
      })
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

    const customPrompt = 'This is a custom analysis prompt';
    const analyzeStep = analyze({
      llm: mockLLM,
      focus: 'general', // Add required focus property
      customPrompt
    });

    const resultPromise = executeStep(analyzeStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    await resultPromise;

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(customPrompt)
      })
    );
  });
});