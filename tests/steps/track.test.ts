import { track } from '../../src/steps/track';
import { createMockState, executeStep } from '../test-utils';

describe('track step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a research track with specified steps', async () => {
    const initialState = createMockState();

    // Create mock steps for the track
    const mockStep1 = {
      name: 'MockStep1',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            mockStep1Executed: true
          }
        };
      })
    };

    const mockStep2 = {
      name: 'MockStep2',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            mockStep2Executed: true
          }
        };
      })
    };

    // Create a track step with our mock steps
    const trackStep = track({
      name: 'TestTrack',
      description: 'Test track description',
      steps: [mockStep1, mockStep2]
    });

    const updatedState = await executeStep(trackStep, initialState);

    // Both steps should have been executed
    expect(mockStep1.execute).toHaveBeenCalled();
    expect(mockStep2.execute).toHaveBeenCalled();
    
    // Track data should be stored in the state
    expect(updatedState.data.tracks).toBeDefined();
    expect(updatedState.data.tracks?.TestTrack).toBeDefined();
    expect(updatedState.data.tracks?.TestTrack.name).toBe('TestTrack');
    expect(updatedState.data.tracks?.TestTrack.metadata?.description).toBe('Test track description');
    expect(updatedState.data.tracks?.TestTrack.completed).toBe(true);
  });

  it('should include the track in results when includeInResults is true', async () => {
    const initialState = createMockState();

    const mockStep = {
      name: 'MockStep',
      execute: jest.fn().mockImplementation(async (state) => state)
    };

    const trackStep = track({
      name: 'TestTrack',
      steps: [mockStep],
      includeInResults: true
    });

    const updatedState = await executeStep(trackStep, initialState);

    // Results should include the track
    expect(updatedState.results.length).toBeGreaterThan(0);
    expect(updatedState.results[0].track).toBeDefined();
    expect(updatedState.results[0].track.name).toBe('TestTrack');
  });

  it('should not include the track in results when includeInResults is false', async () => {
    const initialState = createMockState();

    const mockStep = {
      name: 'MockStep',
      execute: jest.fn().mockImplementation(async (state) => state)
    };

    const trackStep = track({
      name: 'TestTrack',
      steps: [mockStep],
      includeInResults: false
    });

    const updatedState = await executeStep(trackStep, initialState);

    // Results should not include the track
    expect(updatedState.results.length).toBe(0);
    // But track data should still be stored
    expect(updatedState.data.tracks?.TestTrack).toBeDefined();
  });

  it('should isolate track data when isolate is true', async () => {
    const initialState = createMockState({
      data: {
        existingData: 'initialValue'
      }
    });

    const mockStep = {
      name: 'MockStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            newData: 'trackValue'
          }
        };
      })
    };

    const trackStep = track({
      name: 'IsolatedTrack',
      steps: [mockStep],
      isolate: true
    });

    const updatedState = await executeStep(trackStep, initialState);

    // Track should have its own isolated data
    expect(updatedState.data.tracks?.IsolatedTrack.data.newData).toBe('trackValue');
    // But this data should not be mixed with the main data
    expect(updatedState.data.newData).toBeUndefined();
    // And the original data should still be preserved
    expect(updatedState.data.existingData).toBe('initialValue');
  });

  it('should share data when isolate is false', async () => {
    const initialState = createMockState({
      data: {
        existingData: 'initialValue'
      }
    });

    const mockStep = {
      name: 'MockStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            newData: 'trackValue'
          }
        };
      })
    };

    const trackStep = track({
      name: 'SharedTrack',
      steps: [mockStep],
      isolate: false // this is the default
    });

    const updatedState = await executeStep(trackStep, initialState);

    // Track data should be available in both the track and main state
    expect(updatedState.data.tracks?.SharedTrack.data.newData).toBe('trackValue');
    expect(updatedState.data.newData).toBe('trackValue');
  });

  it('should handle errors in track steps', async () => {
    const initialState = createMockState();

    const errorStep = {
      name: 'ErrorStep',
      execute: jest.fn().mockImplementation(async () => {
        throw new Error('Track step error');
      })
    };

    const trackStep = track({
      name: 'ErrorTrack',
      steps: [errorStep]
    });

    await expect(executeStep(trackStep, initialState)).rejects.toThrow('Track step error');
  });

  it('should continue despite errors when continueOnError is true', async () => {
    const initialState = createMockState();

    const errorStep = {
      name: 'ErrorStep',
      execute: jest.fn().mockImplementation(async () => {
        throw new Error('Non-critical error');
      })
    };

    const successStep = {
      name: 'SuccessStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            successStepRan: true
          }
        };
      })
    };

    const trackStep = track({
      name: 'ResilientTrack',
      steps: [errorStep, successStep],
      continueOnError: true
    });

    const updatedState = await executeStep(trackStep, initialState);

    // Both steps should have been attempted
    expect(errorStep.execute).toHaveBeenCalled();
    expect(successStep.execute).toHaveBeenCalled();
    
    // Track should be marked as completed with errors
    expect(updatedState.data.tracks?.ResilientTrack.completed).toBe(false);
    expect(updatedState.data.tracks?.ResilientTrack.errors.length).toBeGreaterThan(0);
    
    // Success step should still have run
    expect(updatedState.data.successStepRan).toBe(true);
  });

  it('should validate required parameters', async () => {
    const initialState = createMockState();

    // Missing required 'name' parameter
    const invalidTrackStep = track({
      name: '' as any, // Empty string will be caught at runtime
      steps: []
    });

    await expect(executeStep(invalidTrackStep, initialState)).rejects.toThrow('Track name is required');

    // Missing required 'steps' parameter
    const emptyStepsTrack = track({
      name: 'EmptyTrack',
      steps: []
    });

    await expect(executeStep(emptyStepsTrack, initialState)).rejects.toThrow('Track requires at least one step');
  });
});