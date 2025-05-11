import { createInitialState, executePipeline } from '../../src/core/pipeline';
import { createMockState } from '../test-utils';
import { z } from 'zod';
import type { ResearchState, ResearchStep } from '../../src/types/pipeline';

describe('Pipeline Execution', () => {
  // Increase timeout for all tests to 30 seconds
  jest.setTimeout(30000);

  // Mock steps for testing
  const successStep: ResearchStep = {
    name: 'SuccessStep',
    execute: jest.fn().mockImplementation(async (state: ResearchState) => {
      return {
        ...state,
        data: {
          ...state.data,
          successStepRan: true
        }
      };
    })
  };

  const errorStep: ResearchStep = {
    name: 'ErrorStep',
    execute: jest.fn().mockImplementation(async () => {
      throw new Error('Test error in step');
    })
  };

  const metadataStep: ResearchStep = {
    name: 'MetadataStep',
    execute: jest.fn().mockImplementation(async (state: ResearchState) => {
      return {
        ...state,
        metadata: {
          ...state.metadata,
          metadataStepRan: true
        }
      };
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a pipeline with a single step successfully', async () => {
    const initialState = createMockState();
    const steps = [successStep];

    const result = await executePipeline(initialState, steps);

    expect(successStep.execute).toHaveBeenCalledTimes(1);
    expect(result.data.successStepRan).toBe(true);
  });

  it('should execute multiple steps in sequence', async () => {
    const initialState = createMockState();
    const secondStep: ResearchStep = {
      name: 'SecondStep',
      execute: jest.fn().mockImplementation(async (state: ResearchState) => {
        expect(state.data.successStepRan).toBe(true);
        return {
          ...state,
          data: {
            ...state.data,
            secondStepRan: true
          }
        };
      })
    };

    const steps = [successStep, secondStep];
    const result = await executePipeline(initialState, steps);

    expect(successStep.execute).toHaveBeenCalledTimes(1);
    expect(secondStep.execute).toHaveBeenCalledTimes(1);
    expect(result.data.successStepRan).toBe(true);
    expect(result.data.secondStepRan).toBe(true);
  });

  it('should handle errors in steps when errorHandling is set to "continue"', async () => {
    const initialState = createMockState();
    const steps = [successStep, errorStep, metadataStep];
    
    const result = await executePipeline(initialState, steps, { errorHandling: 'continue' });
    
    expect(successStep.execute).toHaveBeenCalledTimes(1);
    expect(errorStep.execute).toHaveBeenCalledTimes(1);
    expect(metadataStep.execute).toHaveBeenCalledTimes(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('Test error in step');
  });

  it('should stop execution when a step fails and errorHandling is set to "stop"', async () => {
    const initialState = createMockState();
    const steps = [successStep, errorStep, metadataStep];
    
    const result = await executePipeline(initialState, steps, { errorHandling: 'stop' });
    
    expect(successStep.execute).toHaveBeenCalledTimes(1);
    expect(errorStep.execute).toHaveBeenCalledTimes(1);
    expect(metadataStep.execute).not.toHaveBeenCalled();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('Test error in step');
  });

  it('should pass the correct state between steps', async () => {
    const initialState = createMockState();
    const dataCollectingStep: ResearchStep = {
      name: 'DataCollectingStep',
      execute: jest.fn().mockImplementation(async (state: ResearchState) => {
        return {
          ...state,
          data: {
            ...state.data,
            collectedData: ['item1', 'item2']
          }
        };
      })
    };

    const dataProcessingStep: ResearchStep = {
      name: 'DataProcessingStep',
      execute: jest.fn().mockImplementation(async (state: ResearchState) => {
        const { collectedData } = state.data;
        return {
          ...state,
          data: {
            ...state.data,
            processedData: collectedData.map((item: string) => `processed_${item}`)
          }
        };
      })
    };

    const steps = [dataCollectingStep, dataProcessingStep];
    const result = await executePipeline(initialState, steps);

    expect(dataCollectingStep.execute).toHaveBeenCalledTimes(1);
    expect(dataProcessingStep.execute).toHaveBeenCalledTimes(1);
    expect(result.data.collectedData).toEqual(['item1', 'item2']);
    expect(result.data.processedData).toEqual(['processed_item1', 'processed_item2']);
  });

  it('should track execution time and step metadata', async () => {
    const initialState = createMockState();
    const steps = [metadataStep];
    
    const result = await executePipeline(initialState, steps);
    
    expect(metadataStep.execute).toHaveBeenCalledTimes(1);
    expect(result.metadata.stepHistory.length).toBe(1);
    expect(result.metadata.stepHistory[0].stepName).toBe('MetadataStep');
    expect(result.metadata.stepHistory[0].success).toBe(true);
    expect(result.metadata.stepHistory[0].startTime).toBeDefined();
    expect(result.metadata.stepHistory[0].endTime).toBeDefined();
  });
});