import { plan } from '../../src/steps/plan';
import { createMockState, executeStep, mockLLM } from '../test-utils';
import { generateText } from 'ai';

jest.mock('ai');

describe('plan step', () => {
  // Increase timeout for all tests to 30 seconds
  jest.setTimeout(30000);
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a research plan with default options', async () => {
    const initialState = createMockState();
    const planStep = plan();
    
    const updatedState = await executeStep(planStep, initialState);
    
    expect(updatedState.data.plan).toBeDefined();
    expect(updatedState).not.toBe(initialState); // Should return a new state object
  });

  it('should use provided LLM when specified', async () => {
    const initialState = createMockState();
    const planStep = plan({ llm: mockLLM });
    
    // Execute the step
    await executeStep(planStep, initialState);
    
    // Check that the generateText function was called with our mock LLM
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockLLM
      })
    );
  });

  it('should respect temperature setting', async () => {
    const initialState = createMockState();
    const temperature = 0.2;
    const planStep = plan({ 
      llm: mockLLM,
      temperature 
    });
    
    await executeStep(planStep, initialState);
    
    // Verify that the temperature was passed to generateText
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature
      })
    );
  });

  it('should include plan in results when includeInResults is true', async () => {
    const initialState = createMockState();
    const planStep = plan({ 
      llm: mockLLM,
      includeInResults: true 
    });
    
    const updatedState = await executeStep(planStep, initialState);
    
    // When includeInResults is true, the plan should be included in the final results
    expect(updatedState.metadata.includeInResults).toContain('plan');
  });

  it('should not include plan in results when includeInResults is false', async () => {
    const initialState = createMockState();
    const planStep = plan({ 
      llm: mockLLM,
      includeInResults: false 
    });
    
    const updatedState = await executeStep(planStep, initialState);
    
    // When includeInResults is false, the plan should not be included in final results
    expect(updatedState.metadata.includeInResults || []).not.toContain('plan');
  });

  it('should handle errors gracefully', async () => {
    // Override the mock to simulate an error
    (generateText as jest.Mock).mockRejectedValueOnce(new Error('LLM failure'));
    
    const initialState = createMockState();
    const planStep = plan({ llm: mockLLM });
    
    try {
      await executeStep(planStep, initialState);
      fail('Should have thrown an error');
    } catch (error: unknown) {
      // Type guard to ensure error is an Error instance
      if (error instanceof Error) {
        expect(error.message).toContain('LLM failure');
      } else {
        fail('Expected error to be an instance of Error');
      }
    }
  });

  it('should add structured plan data to state', async () => {
    // Override the mock for this specific test to return structured data
    (generateText as jest.Mock).mockResolvedValueOnce({
      text: JSON.stringify({
        objectives: ['Objective 1', 'Objective 2'],
        searchQueries: ['Query 1', 'Query 2'],
        expectedFindings: ['Expected finding 1']
      })
    });
    
    const initialState = createMockState();
    const planStep = plan({ llm: mockLLM });
    
    const updatedState = await executeStep(planStep, initialState);
    
    // Check if the plan data was properly structured
    expect(updatedState.data.plan).toEqual(
      expect.objectContaining({
        objectives: expect.arrayContaining(['Objective 1', 'Objective 2']),
        searchQueries: expect.arrayContaining(['Query 1', 'Query 2']),
        expectedFindings: expect.arrayContaining(['Expected finding 1'])
      })
    );
  });

  it('should update metadata with step execution details', async () => {
    const initialState = createMockState();
    const planStep = plan({ llm: mockLLM });
    
    const updatedState = await executeStep(planStep, initialState);
    
    expect(updatedState.metadata.stepHistory.length).toBeGreaterThan(0);
    const lastStep = updatedState.metadata.stepHistory[updatedState.metadata.stepHistory.length - 1];
    expect(lastStep.stepName).toBe('Plan');
    expect(lastStep.startTime).toBeDefined();
    expect(lastStep.endTime).toBeDefined();
    expect(lastStep.success).toBe(true);
  });
});