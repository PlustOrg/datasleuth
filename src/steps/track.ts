/**
 * Research track implementation for parallel research paths
 * A track represents a distinct research path that can run in parallel with others
 */
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';

/**
 * Options for creating a research track
 */
export interface TrackOptions {
  /** The name of this research track (used for identification in results) */
  name: string;
  /** Steps to execute in this track */
  steps: any[];
  /** Whether to keep the track's data isolated from other tracks */
  isolate?: boolean;
  /** Whether to include this track's results in the final results object */
  includeInResults?: boolean;
  /** Optional description of this track's purpose */
  description?: string;
  /** Optional metadata to associate with this track */
  metadata?: Record<string, any>;
}

/**
 * Schema for track result
 */
const trackResultSchema = z.object({
  name: z.string(),
  results: z.array(z.any()),
  data: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  errors: z.array(z.object({
    message: z.string(),
    step: z.string().optional(),
    code: z.string().optional()
  })).optional(),
  completed: z.boolean()
});

export type TrackResult = z.infer<typeof trackResultSchema>;

/**
 * Executes a research track with the given options
 */
async function executeTrackStep(
  state: ResearchState,
  options: TrackOptions
): Promise<ResearchState> {
  const {
    name,
    steps,
    isolate = false, 
    includeInResults = true,
    description,
    metadata = {}
  } = options;
  
  console.log(`Starting research track: ${name}`);
  
  // Create a local state for this track
  // If isolate is true, we start with a fresh data object
  // Otherwise, we use the existing state's data as a starting point
  const trackState: ResearchState = {
    ...state,
    data: isolate ? {} : { ...state.data },
    metadata: {
      ...state.metadata,
      currentTrack: name,
      // trackDescription is now supported in metadata thanks to our index signature
      trackDescription: description,
      ...metadata
    },
    results: [],
    errors: []
  };
  
  // Execute all steps in the track
  let currentState = trackState;
  
  try {
    for (const step of steps) {
      currentState = await step.execute(currentState);
    }
    
    // Create the track result
    const trackResult: TrackResult = {
      name,
      results: currentState.results,
      data: currentState.data,
      metadata: {
        ...metadata,
        description
      },
      errors: currentState.errors,
      completed: true
    };
    
    // If this track should be included in results, add it to the state results
    if (includeInResults) {
      return {
        ...state,
        data: {
          ...state.data,
          tracks: {
            ...(state.data.tracks || {}),
            [name]: trackResult
          }
        },
        results: [
          ...state.results,
          { track: trackResult }
        ]
      };
    } else {
      // Just add the track data to the state's data object
      return {
        ...state,
        data: {
          ...state.data,
          tracks: {
            ...(state.data.tracks || {}),
            [name]: trackResult
          }
        }
      };
    }
  } catch (error) {
    console.error(`Error in track ${name}:`, error);
    
    // Create an error track result
    const trackResult: TrackResult = {
      name,
      results: currentState.results,
      data: currentState.data,
      metadata: {
        ...metadata,
        description,
        error: error instanceof Error ? error.message : String(error)
      },
      errors: [
        ...currentState.errors,
        {
          message: error instanceof Error ? error.message : String(error),
          step: currentState.metadata.currentStep || 'unknown',
          code: 'TRACK_EXECUTION_ERROR'
        }
      ],
      completed: false
    };
    
    // Add the failed track to state data
    return {
      ...state,
      data: {
        ...state.data,
        tracks: {
          ...(state.data.tracks || {}),
          [name]: trackResult
        }
      },
      // If we're including in results, add the failed track result
      ...(includeInResults ? {
        results: [
          ...state.results,
          { track: trackResult }
        ]
      } : {})
    };
  }
}

/**
 * Creates a track step for the research pipeline
 * 
 * @param options Options for the research track
 * @returns A track step for the research pipeline
 */
export function track(options: TrackOptions): ReturnType<typeof createStep> {
  return createStep('Track', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeTrackStep(state, options);
    }, 
    options
  );
}