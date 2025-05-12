import { createMockState, executeStep } from '../test-utils.js';
import { mockAnalyze } from '../mocks/analyze-mock.js';
import { LLMError, ValidationError } from '../../src/types/errors.js';

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
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for analysis',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    const updatedState = await resultPromise;

    expect(updatedState.data.analysis).toBeDefined();
    expect(updatedState.data.analysis?.general).toBeDefined();
    expect(updatedState.data.analysis?.general.insights.length).toBe(2);
  });

  it('should respect focus parameter', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Market Research',
            content: 'Content about market trends',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'market-trends',
      mockAnalysis: {
        focus: 'market-trends',
        insights: ['Market trend 1', 'Market trend 2'],
        confidence: 0.9,
        supportingEvidence: ['Market evidence 1'],
        recommendations: ['Market recommendation 1'],
      },
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
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
      includeRecommendations: true,
      mockAnalysis: {
        focus: 'general',
        insights: ['Insight 1'],
        confidence: 0.85,
        recommendations: ['Recommendation 1', 'Recommendation 2'],
      },
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    const updatedState = await resultPromise;

    expect(updatedState.data.analysis?.general.recommendations).toBeDefined();
    expect(updatedState.data.analysis?.general.recommendations?.length).toBe(2);
  });

  it('should respect depth parameter', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content for detailed analysis',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
      depth: 'detailed',
      mockAnalysis: {
        focus: 'general',
        insights: ['Detailed insight 1', 'Detailed insight 2'],
        confidence: 0.9,
        supportingEvidence: ['Detailed evidence 1', 'Detailed evidence 2'],
      },
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    const updatedState = await resultPromise;

    // The mock implementation adds an extra insight for detailed analysis
    expect(updatedState.data.analysis?.general.insights.length).toBe(3);
    expect(updatedState.data.analysis?.general.insights).toContain('Additional detailed insight');
  });

  it('should include analysis in results when includeInResults is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
      includeInResults: true,
      mockAnalysis: {
        focus: 'general',
        insights: ['Insight 1'],
        confidence: 0.85,
      },
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    const updatedState = await resultPromise;

    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].analysis).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
      shouldError: true,
      errorMessage: 'Analysis failed',
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    await expect(resultPromise).rejects.toThrow('Analysis failed');
  });

  it('should handle empty content gracefully when allowEmptyContent is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [], // No content to analyze
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
      allowEmptyContent: true,
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
        extractedContent: [], // No content to analyze
      },
    });

    const analyzeStep = mockAnalyze({
      focus: 'general',
      allowEmptyContent: false,
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    await expect(resultPromise).rejects.toThrow('No content available for analysis');
  });

  it('should use custom analysis when provided', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test content',
            extractionDate: new Date().toISOString(),
          },
        ],
      },
    });

    const customAnalysis = {
      focus: 'custom',
      insights: ['Custom insight 1', 'Custom insight 2'],
      confidence: 0.95,
      supportingEvidence: ['Custom evidence'],
      recommendations: ['Custom recommendation'],
    };

    const analyzeStep = mockAnalyze({
      focus: 'custom',
      mockAnalysis: customAnalysis,
    });

    const resultPromise = executeStep(analyzeStep, initialState);

    // Run all pending timers
    jest.runAllTimers();

    const updatedState = await resultPromise;

    expect(updatedState.data.analysis?.custom).toBeDefined();
    expect(updatedState.data.analysis?.custom.insights).toContain('Custom insight 1');
    expect(updatedState.data.analysis?.custom.confidence).toBe(0.95);
  });
});
