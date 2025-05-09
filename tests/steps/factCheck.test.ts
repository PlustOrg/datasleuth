import { factCheck } from '../../src/steps/factCheck';
import { createMockState, executeStep, mockLLM } from '../test-utils';
import { generateText } from 'ai';

jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  generateText: jest.fn().mockResolvedValue({
    text: JSON.stringify({
      factChecks: [
        {
          statement: "Test statement 1",
          isValid: true,
          confidence: 0.9,
          evidence: ["Evidence for statement 1"]
        },
        {
          statement: "Test statement 2",
          isValid: false,
          confidence: 0.8,
          evidence: ["Evidence against statement 2"]
        }
      ]
    })
  })
}));

describe('factCheck step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should check facts with default options', async () => {
    // Create a state with extracted content
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Example Page 1',
            content: 'This is some test content with statements to fact check.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = factCheck({ llm: mockLLM });
    const updatedState = await executeStep(factCheckStep, initialState);

    expect(generateText).toHaveBeenCalled();
    expect(updatedState.data.factChecks).toBeDefined();
    expect(updatedState.data.factChecks?.length).toBe(2);
    expect(updatedState.data.factualAccuracyScore).toBeDefined();
  });

  it('should respect threshold setting', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Example Page 1',
            content: 'This is some test content with statements to fact check.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const threshold = 0.85;
    const factCheckStep = factCheck({ 
      llm: mockLLM,
      threshold 
    });

    // Execute but don't need to verify threshold in the result
    // as it's captured in the execution and affects the filtering
    await executeStep(factCheckStep, initialState);

    // Verify that threshold was passed to generateText or fact check function
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        // The threshold should be in the system prompt or in a parameter
        // This will depend on implementation details
        prompt: expect.stringContaining(threshold.toString())
      })
    );
  });

  it('should include fact checks in results when includeInResults is true', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Example Page 1',
            content: 'Test content for fact checking.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = factCheck({ 
      llm: mockLLM,
      includeInResults: true 
    });

    const updatedState = await executeStep(factCheckStep, initialState);

    expect(updatedState.results.length).toBeGreaterThan(0);
    const factCheckResults = updatedState.results[updatedState.results.length - 1];
    expect(factCheckResults.factChecks).toBeDefined();
    expect(factCheckResults.factualAccuracyScore).toBeDefined();
  });

  it('should throw an error when no extracted content is available', async () => {
    // Create state with no extracted content
    const initialState = createMockState({
      data: {
        extractedContent: []
      }
    });

    const factCheckStep = factCheck({ llm: mockLLM });

    await expect(executeStep(factCheckStep, initialState))
      .rejects
      .toThrow('No content available for fact checking');
  });

  it('should handle LLM errors gracefully', async () => {
    // Override the mock to simulate an error
    (generateText as jest.Mock).mockRejectedValueOnce(new Error('LLM failure'));
    
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Example Page 1',
            content: 'Test content for fact checking.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });
    
    const factCheckStep = factCheck({ llm: mockLLM });
    
    await expect(executeStep(factCheckStep, initialState))
      .rejects
      .toThrow('LLM failure');
  });

  it('should continue when allowEmptyContent is true and no content exists', async () => {
    const initialState = createMockState({
      data: {
        extractedContent: []
      }
    });

    const factCheckStep = factCheck({ 
      llm: mockLLM,
      allowEmptyContent: true 
    });

    const updatedState = await executeStep(factCheckStep, initialState);

    // Step should complete without error and maintain the state
    expect(updatedState).toBeDefined();
    // Should not have added fact checks
    expect(updatedState.data.factChecks).toBeUndefined();
  });

  it('should extract statements correctly from content', async () => {
    // Content with clear statements
    const initialState = createMockState({
      data: {
        extractedContent: [
          {
            url: 'https://example.com/1',
            title: 'Example Page 1',
            content: 'First fact: Water boils at 100 degrees Celsius. Second fact: The Earth orbits the Sun.',
            extractionDate: new Date().toISOString()
          }
        ]
      }
    });

    const factCheckStep = factCheck({ 
      llm: mockLLM,
      maxStatements: 2 // Limit to 2 statements
    });

    await executeStep(factCheckStep, initialState);

    // Check if generateText was called with content containing both statements
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Water boils at 100 degrees Celsius')
      })
    );
  });
});