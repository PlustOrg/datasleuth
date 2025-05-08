/**
 * Parallel execution of multiple research tracks
 * Enables concurrent research paths for more efficient deep research
 */
import { createStep } from '../utils/steps';
import { ResearchState, ResearchStep } from '../types/pipeline';
import { TrackResult } from './track';
import { 
  ValidationError, 
  ConfigurationError,  
  ProcessingError,
  TimeoutError
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';

/**
 * Custom error for parallel execution issues
 */
export class ParallelError extends ProcessingError {
  constructor(options: {
    message: string;
    step: string;
    details?: Record<string, any>;
    retry?: boolean;
    suggestions?: string[];
  }) {
    super(options);
    this.name = 'ParallelError';
  }
}

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
  /** Retry configuration for the parallel step */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Executes multiple tracks in parallel
 */
async function executeParallelStep(
  state: ResearchState,
  options: ParallelOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Parallel');
  
  const {
    tracks,
    continueOnError = true,
    timeout = 300000, // 5 minutes default timeout
    mergeFunction = defaultMergeFunction,
    includeInResults = true,
    retry = { maxRetries: 0, baseDelay: 1000 }
  } = options;
  
  try {
    // Validate inputs
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      throw new ValidationError({
        message: "Parallel execution requires at least one track",
        step: 'Parallel',
        details: { options },
        suggestions: [
          "Provide at least one track in the tracks array",
          "Tracks should be created using the track() function"
        ]
      });
    }
    
    // Check for invalid tracks
    const invalidTracks = tracks.filter(track => !track || typeof track.execute !== 'function');
    if (invalidTracks.length > 0) {
      throw new ValidationError({
        message: `Found ${invalidTracks.length} invalid tracks in parallel step`,
        step: 'Parallel',
        details: { invalidTracks },
        suggestions: [
          "Ensure all tracks are created using the track() function",
          "Check for undefined or null values in the tracks array"
        ]
      });
    }
    
    // Check timeout value
    if (timeout <= 0) {
      throw new ValidationError({
        message: `Invalid timeout value: ${timeout}. Must be greater than 0.`,
        step: 'Parallel',
        details: { timeout },
        suggestions: [
          "Provide a positive timeout value in milliseconds",
          "Default timeout is 300000ms (5 minutes)"
        ]
      });
    }
    
    stepLogger.info(`Starting parallel execution of ${tracks.length} tracks with timeout ${timeout}ms`);
    stepLogger.debug(`Parallel configuration: continueOnError=${continueOnError}, includeInResults=${includeInResults}`);
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError({
          message: `Parallel execution timed out after ${timeout}ms`,
          step: 'Parallel',
          details: { 
            timeout,
            trackCount: tracks.length,
            trackNames: tracks.map(t => t.name)
          },
          retry: true,
          suggestions: [
            "Increase the timeout value",
            "Reduce the complexity of tracks",
            "Split the work into smaller chunks"
          ]
        }));
      }, timeout);
    });
    
    // Execute all tracks in parallel
    const trackPromises = tracks.map(async (track, index) => {
      try {
        stepLogger.debug(`Starting track ${track.name || `#${index+1}`}`);
        return await track.execute(state);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stepLogger.error(`Error in track ${track.name || `#${index+1}`}: ${errorMessage}`);
        
        if (continueOnError) {
          // If we should continue despite errors, return a state with the error
          return {
            ...state,
            errors: [
              ...state.errors,
              error instanceof Error ? error : new ParallelError({
                message: `Track ${track.name || `#${index+1}`} failed: ${errorMessage}`,
                step: 'Parallel',
                details: { 
                  trackName: track.name,
                  trackIndex: index,
                  error
                },
                retry: false
              })
            ],
            metadata: {
              ...state.metadata,
              parallelTrackErrors: [
                ...(state.metadata.parallelTrackErrors || []),
                {
                  trackName: track.name || `unnamed-${index}`,
                  error: errorMessage
                }
              ]
            }
          };
        } else {
          // If we shouldn't continue on errors, rethrow
          throw error;
        }
      }
    });
    
    try {
      // Wait for all tracks to complete or timeout
      const trackStates = await Promise.race([
        Promise.all(trackPromises),
        timeoutPromise.then(() => { throw new Error('Timeout'); }) // This never resolves, only rejects
      ]) as ResearchState[];
      
      stepLogger.info(`All ${tracks.length} tracks completed execution`);
      
      // Collect all track results and merge them
      const trackResults: Record<string, TrackResult> = {};
      let mergedData = { ...state.data };
      let allResults = [...state.results];
      let allErrors = [...state.errors];
      
      // Extract track results from each state
      trackStates.forEach((trackState: ResearchState, index) => {
        // Merge errors
        if (trackState.errors && trackState.errors.length > 0) {
          allErrors = [...allErrors, ...trackState.errors];
          stepLogger.debug(`Track ${tracks[index].name || `#${index+1}`} had ${trackState.errors.length} errors`);
        }
        
        // Collect track results
        if (trackState.data.tracks) {
          Object.entries(trackState.data.tracks).forEach(([trackName, trackResult]) => {
            trackResults[trackName] = trackResult as TrackResult;
            stepLogger.debug(`Collected results from track "${trackName}"`);
          });
        }
        
        // Merge results
        if (trackState.results && trackState.results.length > 0) {
          allResults = [...allResults, ...trackState.results];
        }
        
        // Merge data (except tracks, which we handle separately)
        const { tracks: _tracks, ...otherData } = trackState.data;
        mergedData = {
          ...mergedData,
          ...otherData
        };
      });
      
      // Store the collected track results
      mergedData.tracks = trackResults;
      
      // Apply merge function (default or custom)
      let mergedResult;
      try {
        stepLogger.debug(`Applying merge function to ${Object.keys(trackResults).length} track results`);
        mergedResult = await mergeFunction(trackResults, state);
        stepLogger.info('Successfully merged parallel track results');
        
        if (includeInResults && mergedResult) {
          allResults.push({
            parallelMerged: mergedResult
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stepLogger.error(`Error in parallel merge function: ${errorMessage}`);
        
        allErrors.push(
          new ParallelError({
            message: `Failed to merge parallel results: ${errorMessage}`,
            step: 'ParallelMerge',
            details: { 
              error,
              trackCount: Object.keys(trackResults).length 
            },
            retry: false,
            suggestions: [
              "Check your merge function implementation",
              "Ensure track results have a consistent structure",
              "Add error handling in your custom merge function"
            ]
          })
        );
      }
      
      // Calculate success metrics
      const completedTracks = Object.values(trackResults).filter(t => t.completed).length;
      const failedTracks = Object.values(trackResults).filter(t => !t.completed).length;
      const successRate = completedTracks / Object.keys(trackResults).length;
      
      stepLogger.info(`Parallel execution complete: ${completedTracks}/${Object.keys(trackResults).length} tracks successful (${(successRate * 100).toFixed(1)}%)`);
      
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
          parallelTracks: { 
            count: Object.keys(trackResults).length,
            completed: completedTracks,
            failed: failedTracks,
            successRate
          },
          parallelCompletedAt: new Date().toISOString()
        }
      };
    } catch (error: unknown) {
      // This catches both timeout errors and any errors from tracks that aren't handled by continueOnError
      const errorMessage = error instanceof Error ? error.message : String(error);
      stepLogger.error(`Error in parallel execution: ${errorMessage}`);
      
      // If it's already one of our error types, just add it to the errors
      const parallelError = error instanceof Error ? error : new ParallelError({
        message: `Parallel execution failed: ${errorMessage}`,
        step: 'Parallel',
        details: { error },
        retry: true,
        suggestions: [
          "Check the configuration of individual tracks",
          "Consider increasing the timeout value",
          "Set continueOnError=true to get partial results even if some tracks fail"
        ]
      });
      
      return {
        ...state,
        errors: [
          ...state.errors,
          parallelError
        ],
        metadata: {
          ...state.metadata,
          parallelError: parallelError,
          parallelFailedAt: new Date().toISOString()
        }
      };
    }
  } catch (error: unknown) {
    // This catches validation and configuration errors that occur before we start running tracks
    if (error instanceof ValidationError || 
        error instanceof ConfigurationError || 
        error instanceof TimeoutError ||
        error instanceof ParallelError) {
      // If it's already a properly typed error, just rethrow it
      throw error;
    }
    
    // Otherwise, wrap in a ParallelError
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Failed to initialize parallel execution: ${errorMessage}`);
    
    throw new ParallelError({
      message: `Parallel execution failed to initialize: ${errorMessage}`,
      step: 'Parallel',
      details: { error, options },
      retry: false,
      suggestions: [
        "Check the configuration of the parallel step",
        "Verify that all tracks are properly configured",
        "Ensure merge function is properly implemented"
      ]
    });
  }
}

/**
 * Creates a parallel execution step
 * 
 * @param options Options for parallel execution
 * @returns A research step that executes tracks in parallel
 */
export function parallel(options: ParallelOptions): ReturnType<typeof createStep> {
  return createStep('Parallel', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeParallelStep(state, options);
    }, 
    options,
    {
      // Add retry configuration to the step metadata
      retryable: true,
      maxRetries: options.retry?.maxRetries || 1,
      retryDelay: options.retry?.baseDelay || 2000,
      backoffFactor: 2,
      // Parallel steps are typically required
      optional: false
    }
  );
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