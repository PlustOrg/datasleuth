import { createMockState, executeStep } from '../test-utils';
import { mockPlan } from '../mocks/plan-mock';
import { LLMError, ConfigurationError } from '../../src/types/errors';

describe('plan step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create a research plan with default options', async () => {
    const initialState = createMockState();
    const planStep = mockPlan();

    const updatedState = await executeStep(planStep, initialState);

    expect(updatedState.data.researchPlan).toBeDefined();
    expect(updatedState.data.researchPlan?.objectives).toEqual(["Objective 1", "Objective 2"]);
    expect(updatedState.data.researchPlan?.searchQueries).toEqual(["Query 1", "Query 2"]);
  });

  it('should include plan in results when includeInResults is true', async () => {
    const initialState = createMockState();
    const planStep = mockPlan({ 
      includeInResults: true
    });

    const updatedState = await executeStep(planStep, initialState);

    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].researchPlan).toBeDefined();
  });

  it('should not include plan in results when includeInResults is false', async () => {
    const initialState = createMockState();
    const planStep = mockPlan({ 
      includeInResults: false 
    });
    
    const updatedState = await executeStep(planStep, initialState);
    
    expect(updatedState.results.length).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const initialState = createMockState();
    const planStep = mockPlan({ 
      shouldError: true,
      errorMessage: 'LLM failure'
    });
    
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
    const initialState = createMockState();
    const customPlan = {
      objectives: ['Objective 1', 'Objective 2'],
      searchQueries: ['Query 1', 'Query 2'],
      expectedFindings: ['Expected finding 1'],
      relevantFactors: ['Factor 1', 'Factor 2'],
      dataGatheringStrategy: 'Test gathering strategy',
      expectedOutcomes: ['Expected outcome 1']
    };
    
    const planStep = mockPlan({ 
      mockPlan: customPlan 
    });
    
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
    const planStep = mockPlan();
    
    const updatedState = await executeStep(planStep, initialState);
    
    expect(updatedState.metadata.planningTimeMs).toBeDefined();
    expect(typeof updatedState.metadata.planningTimeMs).toBe('number');
  });
});