/**
 * Parallel execution of multiple research tracks
 * Enables concurrent research paths for more efficient deep research
 */
import { createStep } from '../utils/steps';
import { ResearchState, ResearchStep } from '../types/pipeline';
import { TrackResult } from './track';

/**
 * Options for parallel execution
 */
export interface ParallelOptions {
  /** An array of steps to execute in parallel */
  tracks: ResearchStep[];
  /** Whether to continue execution if one track fails */
  continueOnError?: boolean;
  /** Maximum time in ms to wait for all tracks to complete */
  timeout?: number;
  /** Function to merge results from all tracks */
  mergeFunction?: (tracks: Record<string, TrackResult>, state: ResearchState) => any;
  /** Whether to include the merged result in the results array */
  includeInResults?: boolean;
}

/**
 * Executes multiple tracks in parallel
 */
async function executeParallelStep(
  state: ResearchState,
  options: ParallelOptions
): Promise<ResearchState> {
  const {
    tracks,
    continueOnError = true,
    timeout = 300000, // 5 minutes default timeout
    mergeFunction,
    includeInResults = true
  } = options;
  
  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('Parallel execution requires at least one track');
  }
  
  console.log(`Starting parallel execution of ${tracks.length} tracks`);
  
  // Create a timeout promise
  const timeoutPromise = new Promise<ResearchState>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Parallel execution timed out after ${timeout}ms`));
    }, timeout);
  });
  
  // Execute all tracks in parallel
  const trackPromises = tracks.map(async (track) => {
    try {
      return await track.execute(state);
    } catch (error) {
      if (continueOnError) {
        console.error(`Error in parallel track:`, error);
        return {
          ...state,
          errors: [
            ...state.errors,
            {
              message: error instanceof Error ? error.message : String(error),
              step: track.name || 'unknown',
              code: 'PARALLEL_EXECUTION_ERROR'
            }
          ]
        };
      } else {
        throw error;
      }
    }
  });
  
  try {
    // Wait for all tracks to complete or timeout
    const trackStates = await Promise.race([
      Promise.all(trackPromises),
      timeoutPromise
    ]);
    
    // Collect all track results and merge them
    const trackResults: Record<string, TrackResult> = {};
    let mergedData = { ...state.data };
    let allResults = [...state.results];
    let allErrors = [...state.errors];
    
    // Extract track results from each state
    trackStates.forEach((trackState) => {
      // Merge errors
      allErrors = [...allErrors, ...trackState.errors];
      
      // Collect track results
      if (trackState.data.tracks) {
        Object.entries(trackState.data.tracks).forEach(([trackName, trackResult]) => {
          trackResults[trackName] = trackResult as TrackResult;
        });
      }
      
      // Merge results
      allResults = [...allResults, ...trackState.results];
      
      // Merge data (except tracks, which we handle separately)
      const { tracks: _tracks, ...otherData } = trackState.data;
      mergedData = {
        ...mergedData,
        ...otherData
      };
    });
    
    // Store the collected track results
    mergedData.tracks = trackResults;
    
    // Apply custom merge function if provided
    let mergedResult;
    if (mergeFunction) {
      try {
        mergedResult = await mergeFunction(trackResults, state);
        console.log('Applied custom merge function to parallel results');
        
        if (includeInResults && mergedResult) {
          allResults.push({
            parallelMerged: mergedResult
          });
        }
      } catch (error) {
        console.error('Error in parallel merge function:', error);
        allErrors.push({
          message: error instanceof Error ? error.message : String(error),
          step: 'ParallelMerge',
          code: 'PARALLEL_MERGE_ERROR'
        });
      }
    }
    
    return {
      ...state,
      data: {
        ...mergedData,
        parallelMerged: mergedResult
      },
      results: allResults,
      errors: allErrors,
      metadata: {
        ...state.metadata,
        parallelTracks: Object.keys(trackResults).length,
        parallelCompletedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(`Error in parallel execution:`, error);
    
    return {
      ...state,
      errors: [
        ...state.errors,
        {
          message: error instanceof Error ? error.message : String(error),
          step: 'Parallel',
          code: 'PARALLEL_EXECUTION_ERROR'
        }
      ],
      metadata: {
        ...state.metadata,
        parallelError: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Creates a parallel execution step
 * 
 * @param options Options for parallel execution
 * @returns A research step that executes tracks in parallel
 */
export function parallel(options: ParallelOptions): ReturnType<typeof createStep> {
  return createStep('Parallel', executeParallelStep, options);
}

/**
 * Default merge function that combines results from all tracks
 * 
 * @param tracks The track results to merge
 * @returns A merged result object
 */
export function defaultMergeFunction(
  tracks: Record<string, TrackResult>
): Record<string, any> {
  const merged: Record<string, any> = {
    byTrack: {}
  };
  
  // Organize results by track
  Object.entries(tracks).forEach(([trackName, trackResult]) => {
    if (trackResult.completed) {
      merged.byTrack[trackName] = {
        results: trackResult.results,
        completed: true
      };
    } else {
      merged.byTrack[trackName] = {
        errors: trackResult.errors,
        completed: false
      };
    }
  });
  
  return merged;
}