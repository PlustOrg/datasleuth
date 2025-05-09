import { evaluate, repeatUntil } from '../../src/steps/flowControl';
import { createMockState, executeStep } from '../test-utils';

describe('flowControl steps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluate step', () => {
    it('should evaluate a condition based on state data', async () => {
      const initialState = createMockState({
        data: {
          searchResults: [
            { title: 'Result 1', url: 'https://example.com/1' },
            { title: 'Result 2', url: 'https://example.com/2' }
          ]
        }
      });

      // Create an evaluate step that checks if we have at least 2 search results
      const evaluateStep = evaluate({
        criteriaFn: (state) => (state.data.searchResults?.length || 0) >= 2,
        criteriaName: 'EnoughSearchResults'
      });

      const updatedState = await executeStep(evaluateStep, initialState);

      // The evaluation should be true and stored in the state
      expect(updatedState.data.evaluations).toBeDefined();
      expect(updatedState.data.evaluations?.EnoughSearchResults).toBe(true);
    });

    it('should evaluate to false when criteria are not met', async () => {
      const initialState = createMockState({
        data: {
          searchResults: [
            { title: 'Result 1', url: 'https://example.com/1' }
          ]
        }
      });

      // Create an evaluate step that checks if we have at least 3 search results
      const evaluateStep = evaluate({
        criteriaFn: (state) => (state.data.searchResults?.length || 0) >= 3,
        criteriaName: 'EnoughSearchResults'
      });

      const updatedState = await executeStep(evaluateStep, initialState);

      // The evaluation should be false
      expect(updatedState.data.evaluations?.EnoughSearchResults).toBe(false);
    });

    it('should include confidence score when provided', async () => {
      const initialState = createMockState();

      const evaluateStep = evaluate({
        criteriaFn: () => true,
        criteriaName: 'TestCriteria',
        confidenceThreshold: 0.85
      });

      const updatedState = await executeStep(evaluateStep, initialState);

      // Check that confidence was recorded
      expect(updatedState.data.evaluations?.TestCriteria.passed).toBe(true);
      expect(updatedState.data.evaluations?.TestCriteria.confidenceScore).toBeGreaterThan(0.8);
    });

    it('should handle errors in the criteria function', async () => {
      const initialState = createMockState();

      // Create an evaluate step with a function that throws an error
      const evaluateStep = evaluate({
        criteriaFn: () => {
          throw new Error('Criteria function error');
        },
        criteriaName: 'ErrorCriteria'
      });

      await expect(executeStep(evaluateStep, initialState)).rejects.toThrow('Criteria function error');
    });
  });

  describe('repeatUntil step', () => {
    it('should repeat steps until criteria are met', async () => {
      const initialState = createMockState({
        data: {
          counter: 0
        }
      });

      // Mock steps to increment a counter
      const incrementStep = {
        name: 'IncrementStep',
        execute: jest.fn().mockImplementation(async (state) => {
          return {
            ...state,
            data: {
              ...state.data,
              counter: (state.data.counter || 0) + 1
            }
          };
        })
      };

      // Create an evaluation step that checks if the counter is at least 3
      const evaluationStep = evaluate({
        criteriaFn: (state) => (state.data.counter || 0) >= 3,
        criteriaName: 'CounterReachedThree'
      });

      // Create a repeatUntil step that repeats until the counter is at least 3
      const repeatStep = repeatUntil(
        evaluationStep,
        [incrementStep]
      );

      const updatedState = await executeStep(repeatStep, initialState);

      // The steps should have been executed until the counter reached 3
      expect(incrementStep.execute).toHaveBeenCalledTimes(3);
      expect(updatedState.data.counter).toBe(3);
      expect(updatedState.data.evaluations?.CounterReachedThree).toBe(true);
    });

    it('should respect maxIterations parameter', async () => {
      const initialState = createMockState({
        data: {
          counter: 0
        }
      });

      // Mock step that increments a counter
      const incrementStep = {
        name: 'IncrementStep',
        execute: jest.fn().mockImplementation(async (state) => {
          return {
            ...state,
            data: {
              ...state.data,
              counter: (state.data.counter || 0) + 1
            }
          };
        })
      };

      // Evaluation that always returns false, so it would repeat forever
      const evaluationStep = evaluate({
        criteriaFn: () => false,
        criteriaName: 'AlwaysFalse'
      });

      // Create a repeatUntil step with maxIterations set to 2
      const repeatStep = repeatUntil(
        evaluationStep,
        [incrementStep],
        { maxIterations: 2 }
      );

      const updatedState = await executeStep(repeatStep, initialState);

      // The steps should have been executed exactly 2 times (maxIterations)
      expect(incrementStep.execute).toHaveBeenCalledTimes(2);
      expect(updatedState.data.counter).toBe(2);
      // Evaluation should still be false
      expect(updatedState.data.evaluations?.AlwaysFalse).toBe(false);
    });

    it('should throw an error when maxIterations is reached if configured', async () => {
      const initialState = createMockState();

      // Mock step that does nothing
      const noopStep = {
        name: 'NoopStep',
        execute: jest.fn().mockImplementation(async (state) => state)
      };

      // Evaluation that always returns false
      const evaluationStep = evaluate({
        criteriaFn: () => false,
        criteriaName: 'AlwaysFalse'
      });

      // Create a repeatUntil step with throwOnMaxIterations set to true
      const repeatStep = repeatUntil(
        evaluationStep,
        [noopStep],
        { 
          maxIterations: 2,
          throwOnMaxIterations: true
        }
      );

      await expect(executeStep(repeatStep, initialState)).rejects.toThrow('Maximum iterations');
    });

    it('should handle errors in repeated steps', async () => {
      const initialState = createMockState();

      // Mock step that throws an error
      const errorStep = {
        name: 'ErrorStep',
        execute: jest.fn().mockImplementation(async () => {
          throw new Error('Step execution error');
        })
      };

      // Evaluation that would never be true (but we'll hit the error first)
      const evaluationStep = evaluate({
        criteriaFn: () => false,
        criteriaName: 'NeverTrue'
      });

      const repeatStep = repeatUntil(
        evaluationStep,
        [errorStep]
      );

      await expect(executeStep(repeatStep, initialState)).rejects.toThrow('Step execution error');
    });
  });
});