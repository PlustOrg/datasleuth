import { parallel, defaultMergeFunction } from '../../src/steps/parallel';
import { track } from '../../src/steps/track';
import { createMockState, executeStep } from '../test-utils';
import { ResultMerger } from '../../src/utils/merge';

describe('parallel step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute multiple tracks in parallel', async () => {
    const initialState = createMockState();

    // Create mock steps for the tracks
    const techTrackStep = {
      name: 'TechStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            techData: 'Technical information'
          }
        };
      })
    };

    const businessTrackStep = {
      name: 'BusinessStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            businessData: 'Business information'
          }
        };
      })
    };

    // Create tech track
    const techTrack = track({
      name: 'technical',
      steps: [techTrackStep]
    });

    // Create business track
    const businessTrack = track({
      name: 'business',
      steps: [businessTrackStep]
    });

    // Create parallel step with both tracks
    const parallelStep = parallel({
      tracks: [techTrack, businessTrack]
    });

    const updatedState = await executeStep(parallelStep, initialState);

    // Both tracks should have been executed
    expect(techTrackStep.execute).toHaveBeenCalled();
    expect(businessTrackStep.execute).toHaveBeenCalled();

    // The state should contain data from both tracks after merging
    expect(updatedState.data.tracks).toBeDefined();
    expect(updatedState.data.tracks?.technical).toBeDefined();
    expect(updatedState.data.tracks?.business).toBeDefined();
    
    // The merged data should be in the main data
    expect(updatedState.data.techData).toBe('Technical information');
    expect(updatedState.data.businessData).toBe('Business information');
  });

  it('should use custom merge function when provided', async () => {
    const initialState = createMockState();

    // Create tracks with conflicting data
    const track1Step = {
      name: 'Track1Step',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            sharedKey: 'value from track 1'
          }
        };
      })
    };

    const track2Step = {
      name: 'Track2Step',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            sharedKey: 'value from track 2'
          }
        };
      })
    };

    // Create custom merge function that always prefers track2
    const customMerge = ResultMerger.createMergeFunction({
      strategy: 'last'  // Last track wins
    });

    // Create parallel step with custom merge
    const parallelStep = parallel({
      tracks: [
        track({ name: 'track1', steps: [track1Step] }),
        track({ name: 'track2', steps: [track2Step] })
      ],
      mergeFunction: customMerge
    });

    const updatedState = await executeStep(parallelStep, initialState);

    // The value should be from track2 as it was executed last
    expect(updatedState.data.sharedKey).toBe('value from track 2');
  });

  it('should use weighted merge strategy when configured', async () => {
    const initialState = createMockState();

    // Create tracks with conflicting data
    const track1Step = {
      name: 'Track1Step',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            sharedKey: 'value from track 1'
          }
        };
      })
    };

    const track2Step = {
      name: 'Track2Step',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            sharedKey: 'value from track 2'
          }
        };
      })
    };

    // Create weighted merge function that gives more weight to track1
    const weightedMerge = ResultMerger.createMergeFunction({
      strategy: 'weighted',
      weights: {
        track1: 2.0,  // Higher weight
        track2: 1.0
      }
    });

    // Create parallel step with weighted merge
    const parallelStep = parallel({
      tracks: [
        track({ name: 'track1', steps: [track1Step] }),
        track({ name: 'track2', steps: [track2Step] })
      ],
      mergeFunction: weightedMerge
    });

    const updatedState = await executeStep(parallelStep, initialState);

    // The value should be from track1 as it has higher weight
    expect(updatedState.data.sharedKey).toBe('value from track 1');
  });

  it('should handle errors in individual tracks', async () => {
    const initialState = createMockState();

    // Create a step that will succeed
    const successStep = {
      name: 'SuccessStep',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          data: {
            ...state.data,
            successData: 'Success data'
          }
        };
      })
    };

    // Create a step that will fail
    const errorStep = {
      name: 'ErrorStep',
      execute: jest.fn().mockImplementation(async () => {
        throw new Error('Track error');
      })
    };

    // Create parallel step with one success and one error track
    const parallelStep = parallel({
      tracks: [
        track({ name: 'success', steps: [successStep] }),
        track({ name: 'error', steps: [errorStep], continueOnError: true }) // This track will fail but continue
      ],
      continueOnError: true // Continue even if a track fails
    });

    const updatedState = await executeStep(parallelStep, initialState);

    // Success track should have completed
    expect(updatedState.data.tracks?.success).toBeDefined();
    expect(updatedState.data.successData).toBe('Success data');
    
    // Error track should be marked as failed
    expect(updatedState.data.tracks?.error).toBeDefined();
    expect(updatedState.data.tracks?.error.completed).toBe(false);
    expect(updatedState.data.tracks?.error.errors.length).toBeGreaterThan(0);
  });

  it('should propagate errors when continueOnError is false', async () => {
    const initialState = createMockState();

    // Create a step that will succeed
    const successStep = {
      name: 'SuccessStep',
      execute: jest.fn().mockImplementation(async (state) => state)
    };

    // Create a step that will fail
    const errorStep = {
      name: 'ErrorStep',
      execute: jest.fn().mockImplementation(async () => {
        throw new Error('Critical track error');
      })
    };

    // Create parallel step that should stop on errors
    const parallelStep = parallel({
      tracks: [
        track({ name: 'success', steps: [successStep] }),
        track({ name: 'error', steps: [errorStep] })
      ],
      continueOnError: false // Stop if any track fails
    });

    await expect(executeStep(parallelStep, initialState)).rejects.toThrow('Critical track error');
  });

  it('should validate required parameters', async () => {
    const initialState = createMockState();

    // Missing required 'tracks' parameter
    const invalidParallelStep = parallel({
      // @ts-ignore - Intentionally missing tracks
      tracks: []
    });

    await expect(executeStep(invalidParallelStep, initialState)).rejects.toThrow('At least one track is required');
  });

  it('should include merged results in final state when includeInResults is true', async () => {
    const initialState = createMockState();

    // Create steps that add to results
    const track1Step = {
      name: 'Track1Step',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          results: [
            ...state.results,
            { key1: 'value1' }
          ]
        };
      })
    };

    const track2Step = {
      name: 'Track2Step',
      execute: jest.fn().mockImplementation(async (state) => {
        return {
          ...state,
          results: [
            ...state.results,
            { key2: 'value2' }
          ]
        };
      })
    };

    // Create parallel step with includeInResults true
    const parallelStep = parallel({
      tracks: [
        track({ name: 'track1', steps: [track1Step] }),
        track({ name: 'track2', steps: [track2Step] })
      ],
      includeInResults: true
    });

    const updatedState = await executeStep(parallelStep, initialState);

    // Results should include merged data from both tracks
    expect(updatedState.results.length).toBeGreaterThan(0);
    const mergedResult = updatedState.results[updatedState.results.length - 1];
    expect(mergedResult.parallel).toBeDefined();
    expect(mergedResult.parallel.tracks).toContain('track1');
    expect(mergedResult.parallel.tracks).toContain('track2');
  });
});