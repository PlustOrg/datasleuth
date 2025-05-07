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
  errors: Error[];
  metadata: {
    startTime: Date;
    endTime?: Date;
    stepHistory: StepExecutionRecord[];
    confidenceScore?: number;
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