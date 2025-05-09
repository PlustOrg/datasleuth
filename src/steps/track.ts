/**
 * Research track implementation for parallel research paths
 * A track represents a distinct research path that can run in parallel with others
 */
import { createStep } from '../utils/steps';
import { ResearchState, ResearchStep } from '../types/pipeline';
import { z } from 'zod';
import { 
  ValidationError, 
  ConfigurationError,  
  ProcessingError 
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';

/**
 * Options for creating a research track
 */
export interface TrackOptions {
  /** The name of this research track (used for identification in results) */
  name: string;
  /** Steps to execute in this track */
  steps: ResearchStep[];
  /** Whether to keep the track's data isolated from other tracks */
  isolate?: boolean;
  /** Whether to include this track's results in the final results object */
  includeInResults?: boolean;
  /** Optional description of this track's purpose */
  description?: string;
  /** Optional metadata to associate with this track */
  metadata?: Record<string, any>;
  /** Whether to continue execution if a step fails */
  continueOnError?: boolean;
  /** Retry configuration for the entire track */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Schema for track result
 */
const trackResultSchema = z.object({
  name: z.string(),
  results: z.array(z.any()),
  data: z.record(z.any()),  // Changed from optional to required
  metadata: z.record(z.any()).optional(),
  errors: z.array(z.object({
    message: z.string(),
    step: z.string().optional(),
    code: z.string().optional()
  })),  // Removed optional here
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
  const stepLogger = createStepLogger('Track');
  
  const {
    name,
    steps,
    isolate = false, 
    includeInResults = true,
    description,
    metadata = {},
    continueOnError = false,
    retry = { maxRetries: 0, baseDelay: 1000 }
  } = options;
  
  // Validate required parameters
  if (!name) {
    throw new ValidationError({
      message: "Track name is required",
      step: 'Track',
      details: { options },
      suggestions: [
        "Provide a unique name for each track",
        "The name is used to identify the track in results and logs"
      ]
    });
  }
  
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    throw new ValidationError({
      message: "Track requires at least one step",
      step: 'Track',
      details: { options },
      suggestions: [
        "Provide at least one step in the steps array",
        "Steps should be created using factory functions like searchWeb(), analyze(), etc."
      ]
    });
  }
  
  stepLogger.info(`Starting research track: ${name}${description ? ` (${description})` : ''}`);
  stepLogger.debug(`Track configuration: isolate=${isolate}, continueOnError=${continueOnError}, steps=${steps.length}`);
  
  // Create a local state for this track
  // If isolate is true, we start with a fresh data object
  // Otherwise, we use the existing state's data as a starting point
  const trackState: ResearchState = {
    ...state,
    data: isolate ? {} : { ...state.data },
    metadata: {
      ...state.metadata,
      currentTrack: name,
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
      try {
        // Check if step is properly structured
        if (!step || typeof step.execute !== 'function') {
          throw new ConfigurationError({
            message: `Invalid step in track "${name}"`,
            step: 'Track',
            details: { invalidStep: step },
            suggestions: [
              "Ensure all steps are created using factory functions like searchWeb(), analyze(), etc.",
              "Check for undefined or null values in the steps array"
            ]
          });
        }
        
        stepLogger.debug(`Executing step "${step.name}" in track "${name}"`);
        
        // Update current step in metadata
        currentState = {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            currentStep: step.name
          }
        };
        
        // Execute the step
        currentState = await step.execute(currentState);
        
        stepLogger.debug(`Step "${step.name}" completed successfully in track "${name}"`);
      } catch (stepError: unknown) {
        stepLogger.error(`Error in step "${step.name}" of track "${name}": ${stepError instanceof Error ? stepError.message : String(stepError)}`);
        
        // Add error to current state
        const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
        const errorStep = currentState.metadata.currentStep || step.name || 'unknown';
        
        currentState = {
          ...currentState,
          errors: [
            ...currentState.errors,
            stepError instanceof Error ? stepError : new Error(errorMessage)
          ]
        };
        
        // If continueOnError is false, throw to exit the track
        if (!continueOnError) {
          throw new ProcessingError({
            message: `Track "${name}" failed at step "${errorStep}": ${errorMessage}`,
            step: 'Track',
            details: { 
              trackName: name, 
              failedStep: errorStep, 
              originalError: stepError 
            },
            retry: false,
            suggestions: [
              "Set continueOnError to true if you want the track to continue despite failures",
              "Check the specific step configuration for issues",
              "Examine the original error for more details on the failure"
            ]
          });
        }
        
        // Otherwise log and continue
        stepLogger.warn(`Continuing track "${name}" after error in step "${errorStep}" due to continueOnError=true`);
      }
    }
    
    // Create the track result
    const trackResult: TrackResult = {
      name,
      results: currentState.results,
      data: currentState.data || {}, // Initialize with empty object if undefined
      metadata: {
        ...metadata,
        description,
        completedAt: new Date().toISOString(),
        hasErrors: currentState.errors.length > 0,
        errorCount: currentState.errors.length
      },
      errors: currentState.errors.map(err => ({
        message: err instanceof Error ? err.message : String(err),
        step: err instanceof Error && 'step' in err ? (err as any).step : currentState.metadata.currentStep || 'unknown',
        code: err instanceof Error && 'code' in err ? (err as any).code : 'TRACK_STEP_ERROR'
      })),
      completed: true
    };
    
    stepLogger.info(`Track "${name}" completed${trackResult.errors.length > 0 ? ` with ${trackResult.errors.length} errors` : ' successfully'}`);
    
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Track "${name}" failed: ${errorMessage}`);
    
    // Create an error track result
    const trackResult: TrackResult = {
      name,
      results: currentState.results,
      data: currentState.data,
      metadata: {
        ...metadata,
        description,
        error: errorMessage,
        failedAt: new Date().toISOString(),
        failedStep: currentState.metadata.currentStep || 'unknown'
      },
      errors: [
        ...currentState.errors,
        {
          message: errorMessage,
          step: currentState.metadata.currentStep || 'unknown',
          code: error instanceof Error && 'code' in error ? (error as any).code : 'TRACK_EXECUTION_ERROR'
        }
      ],
      completed: false
    };
    
    // If error is already a properly formatted error, just rethrow after adding track to state
    // Otherwise wrap in ProcessingError
    const errorToThrow = error instanceof ValidationError || 
                         error instanceof ConfigurationError || 
                         error instanceof ProcessingError
      ? error
      : new ProcessingError({
          message: `Track "${name}" execution failed: ${errorMessage}`,
          step: 'Track',
          details: { 
            trackName: name, 
            failedStep: currentState.metadata.currentStep || 'unknown',
            originalError: error
          },
          retry: false,
          suggestions: [
            "Check the configuration of the steps in the track",
            "Look at the specific error in the track result for more details",
            "Consider setting continueOnError=true to complete partial results"
          ]
        });
    
    // Add the failed track to state data before throwing
    const updatedState = {
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
    
    // If retry is enabled at the track level, we'll log but return the state
    // This allows the parent (usually parallel step) to handle retry
    if (retry.maxRetries && retry.maxRetries > 0) {
      stepLogger.info(`Track "${name}" is configured for retry (maxRetries=${retry.maxRetries})`);
      updatedState.metadata = {
        ...updatedState.metadata,
        retryTrack: name,
        retryError: errorMessage
      };
      return updatedState;
    }
    
    // Otherwise throw to allow higher-level retry mechanisms to handle it
    throw errorToThrow;
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
    options,
    {
      // Mark as retryable if retry options are provided
      retryable: !!options.retry?.maxRetries,
      maxRetries: options.retry?.maxRetries || 0,
      retryDelay: options.retry?.baseDelay || 1000,
      backoffFactor: 2,
      // Track is a super-step that's always required
      optional: false
    }
  );
}