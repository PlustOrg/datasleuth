/**
 * Types for pipeline execution and research steps
 */

import { z } from 'zod';

/**
 * Represents the state of the research pipeline
 */
export interface ResearchState {
  query: string;
  outputSchema: z.ZodType<any>;
  data: Record<string, any>;
  results: any[];
  errors: (Error | ResearchError)[];
  metadata: {
    startTime: Date;
    endTime?: Date;
    stepHistory: StepExecutionRecord[];
    confidenceScore?: number;
    /** Warnings accumulated during research */
    warnings?: string[];
    /** Indicates if classification has been performed */
    hasClassification?: boolean;
    /** Tracks information about parallel research execution */
    parallelTracks?: Record<string, any>;
    /** Records errors in parallel execution */
    parallelError?: Error;
    /** Information about the current research track */
    currentTrack?: string;
    /** Information about the current step being executed */
    currentStep?: string;
    /** Track description */
    trackDescription?: string;
    /** Entity counts from classification */
    entityCount?: number;
    /** Cluster counts from classification */
    clusterCount?: number;
    /** Relationship counts from classification */
    relationshipCount?: number;
    /** Allow additional metadata properties */
    [key: string]: any;
  };
}

/**
 * Records the execution of a step in the pipeline
 */
export interface StepExecutionRecord {
  stepName: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Represents a pipeline step
 */
export interface ResearchStep {
  name: string;
  execute: (state: ResearchState) => Promise<ResearchState>;
  rollback?: (state: ResearchState) => Promise<ResearchState>;
  options?: Record<string, any>;
}

/**
 * Configuration for the research pipeline
 */
export interface PipelineConfig {
  steps: ResearchStep[];
  errorHandling?: 'stop' | 'continue' | 'rollback';
  maxRetries?: number;
  timeout?: number;
}

/**
 * Input for the research function
 */
export interface ResearchInput {
  query: string;
  outputSchema: z.ZodType<any>;
  steps?: ResearchStep[];
  config?: Partial<PipelineConfig>;
}

/**
 * Extended error interface with step information
 */
export interface ResearchError extends Error {
  step?: string;
  code?: string;
}