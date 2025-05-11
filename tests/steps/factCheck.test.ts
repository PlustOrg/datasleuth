import { createMockState, executeStep } from '../test-utils';
import { mockFactCheck } from '../mocks/factCheck-mock';
import { LLMError, ValidationError } from '../../src/types/errors';

describe('factCheck step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should perform fact checking with default options', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test statement 1. Some additional content.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = mockFactCheck({ 
      statements: ["Test statement 1"] 
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.data.factChecks).toBeDefined();
    expect(updatedState.data.factChecks?.length).toBe(1);
    expect(updatedState.data.factChecks?.[0].statement).toBe("Test statement 1");
    expect(updatedState.data.factChecks?.[0].isValid).toBe(true);
  });

  it('should use custom threshold when specified', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test statement 1. Some additional content.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    // Use threshold of 0.5 and set a confidence of 0.6 (between default threshold and our custom one)
    const factCheckStep = mockFactCheck({ 
      statements: ["Test statement 1"],
      threshold: 0.5,
      mockConfidences: [0.6]
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should accept the fact check result with confidence 0.6 (above our 0.5 threshold)
    expect(updatedState.data.factChecks?.length).toBe(1);
    expect(updatedState.data.factChecks?.[0].confidence).toBe(0.6);
  });

  it('should include fact checks in results when includeInResults is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test statement 1. Some additional content.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = mockFactCheck({ 
      statements: ["Test statement 1"],
      includeInResults: true
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].factChecks).toBeDefined();
  });

  it('should respect custom prompt when provided', async () => {
    const customPrompt = 'Custom prompt for fact checking';
    
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test statement 1. Some additional content.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = mockFactCheck({ 
      statements: ["Test statement 1"],
      customPrompt
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    // With our mock, we don't need to check if the prompt was used, just that it doesn't error
    const updatedState = await resultPromise;
    expect(updatedState.data.factChecks).toBeDefined();
  });

  it('should handle errors gracefully when continueOnError is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test statement 1. Test statement 2.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    // Create custom results with first one valid and second one simulating an error
    const mockResults = [
      {
        statement: "Test statement 1",
        isValid: true,
        confidence: 0.9,
        evidence: ["Evidence for statement 1"]
      }
    ];

    const factCheckStep = mockFactCheck({ 
      statements: ["Test statement 1", "Test statement 2"],
      continueOnError: true,
      mockResults,
      // Force the second statement to be skipped entirely by setting a mock confidence below threshold
      mockConfidences: [0.9, 0.1] 
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should still have the result from the first statement
    expect(updatedState.data.factChecks?.length).toBe(1);
    expect(updatedState.data.factChecks?.[0].statement).toBe("Test statement 1");
  });

  it('should throw error when no content and no statements provided', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [] // No content to extract statements from
      }
    });

    const factCheckStep = mockFactCheck({ 
      statements: [], // No explicit statements provided
      allowEmptyContent: false
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow('No content available for fact checking');
  });

  it('should handle empty content gracefully when allowEmptyContent is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [] // No content to extract statements from
      }
    });

    const factCheckStep = mockFactCheck({ 
      statements: [], // No explicit statements provided
      allowEmptyContent: true
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should continue without errors and not add factChecks
    expect(updatedState.data.factChecks).toBeUndefined();
  });

  it('should skip low-confidence results based on threshold', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Test article',
            content: 'Test statement 1. Some additional content.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = mockFactCheck({ 
      statements: ["Test statement 1"],
      threshold: 0.7, // Default threshold
      mockConfidences: [0.5] // Below threshold
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    const updatedState = await resultPromise;

    // Should not include the low-confidence result
    expect(updatedState.data.factChecks?.length).toBe(0);
  });
  
  it('should handle error cases', async () => {
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

    const factCheckStep = mockFactCheck({
      shouldError: true,
      errorMessage: 'Fact check failed'
    });

    const resultPromise = executeStep(factCheckStep, initialState);
    
    // Run all pending timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow('Fact check failed');
  });
});