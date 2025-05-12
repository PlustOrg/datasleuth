/**
 * Types for pipeline execution and research steps
 */

import { z } from 'zod';
import { LanguageModel } from 'ai';
import { LogLevel } from '../utils/logging.js';
import { BaseResearchError } from './errors.js';

/**
 * Base interface for research data objects
 */
export interface ResearchData {
  researchPlan?: Record<string, string | string[]>;
  searchResults?: SearchResult[];
  extractedContent?: ExtractedContent[];
  factChecks?: FactCheckResult[];
  analysis?: Record<string, AnalysisResult>;
  refinedQueries?: RefinedQuery[];
  summary?: string;
  classification?: ClassificationData;
  tracks?: Record<string, TrackResult>;
  evaluations?: Record<string, EvaluationResult>;
  [key: string]: any; // Allow additional data properties
}

/**
 * Represents a search result from web search
 */
export interface SearchResult {
  url: string;
  title: string;
  snippet?: string;
  domain?: string;
  publishedDate?: string;
  provider?: string;
  raw?: Record<string, any>;
}

/**
 * Represents extracted content from a URL
 */
export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  extractionDate: string;
  /** Additional metadata about the extraction */
  metadata?: Record<string, any>;
}

/**
 * Represents a fact check result
 */
export interface FactCheckResult {
  statement: string;
  isValid: boolean;
  confidence: number;
  evidence?: string[];
  sources?: string[];
  corrections?: string;
}

/**
 * Represents an analysis result
 */
export interface AnalysisResult {
  focus: string;
  insights: string[];
  confidence: number;
  supportingEvidence?: string[];
  limitations?: string[];
  recommendations?: string[];
}

/**
 * Represents a refined query
 */
export interface RefinedQuery {
  originalQuery: string;
  refinedQuery: string;
  refinementStrategy: string;
  targetedAspects?: string[];
  reasonForRefinement?: string;
}

/**
 * Represents a classification entity
 */
export interface Entity {
  name: string;
  type: string;
  description: string;
  confidence: number;
  mentions?: number;
}

/**
 * Represents a relationship between entities
 */
export interface EntityRelationship {
  source: string;
  target: string;
  relationship: string;
  confidence: number;
}

/**
 * Represents a cluster of related entities
 */
export interface EntityCluster {
  name: string;
  description: string;
  entities: string[];
  confidence: number;
}

/**
 * Represents classification data
 */
export interface ClassificationData {
  entities: Record<string, Entity>;
  relationships: EntityRelationship[];
  clusters: Record<string, EntityCluster>;
}

/**
 * Represents a track result
 */
export interface TrackResult {
  name: string;
  results: ResearchResult[];
  data: ResearchData;
  metadata?: Record<string, any>;
  errors: ResearchErrorData[];
  completed: boolean;
}

/**
 * Represents an evaluation result
 */
export interface EvaluationResult {
  passed: boolean;
  confidenceScore: number;
  timestamp: string;
}

/**
 * Represents research results that can be validated against schemas
 */
export type ResearchResult = Record<string, any>;

/**
 * Error data for research errors
 */
export interface ResearchErrorData {
  message: string;
  step?: string;
  code?: string;
}

/**
 * Represents the state of the research pipeline
 */
export interface ResearchState {
  query: string;
  outputSchema: z.ZodType<ResearchResult>;
  data: ResearchData;
  results: ResearchResult[];
  errors: (Error | BaseResearchError)[];
  /** Default language model to use if not specified in a step */
  defaultLLM?: LanguageModel;
  /** Default search provider to use if not specified in a step */
  defaultSearchProvider?: any;
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
    parallelTracks?: Record<string, ResearchState>;
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
    /** Pipeline configuration used */
    pipelineConfig?: PipelineConfig;
    /** Additional metadata properties */
    [key: string]: any;
  };
}

/**
 * Records the execution of a step in the pipeline
 */
export interface StepExecutionRecord {
  stepName: string;
  startTime: Date;
  endTime: Date;
  success: boolean;
  error?: Error | BaseResearchError;
  metadata?: {
    /** Duration of step execution in milliseconds */
    duration?: number;
    /** Number of retry attempts made */
    retryAttempts?: number;
    /** Whether the step was skipped */
    skipped?: boolean;
    /** Additional metadata */
    [key: string]: any;
  };
}

/**
 * Options for step execution
 */
export interface StepOptions {
  [key: string]: any;
}

/**
 * Represents a pipeline step
 */
export interface ResearchStep {
  name: string;
  execute: (state: ResearchState) => Promise<ResearchState>;
  rollback?: (state: ResearchState) => Promise<ResearchState>;
  options?: StepOptions;
  /** Whether this step can be retried on failure */
  retryable?: boolean;
  /** Whether this step can be skipped without breaking the pipeline */
  optional?: boolean;
}

/**
 * Configuration for the research pipeline
 */
export interface PipelineConfig {
  steps: ResearchStep[];
  /** How to handle errors in the pipeline */
  errorHandling?: 'stop' | 'continue' | 'rollback';
  /** Maximum number of retry attempts for retryable steps */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds */
  retryDelay?: number;
  /** Factor by which to increase the delay on each subsequent retry */
  backoffFactor?: number;
  /** Whether to continue with the next step even if the current step fails */
  continueOnError?: boolean;
  /** Maximum execution time in milliseconds before timeout */
  timeout?: number;
  /** Minimum log level to display */
  logLevel?: LogLevel;
}

/**
 * Input for the research function
 */
export interface ResearchInput {
  /** The research query */
  query: string;
  /** Schema defining the output structure */
  outputSchema: z.ZodType<ResearchResult>;
  /** Optional custom pipeline steps */
  steps?: ResearchStep[];
  /** Optional configuration for the pipeline */
  config?: Partial<PipelineConfig>;
  /** Default language model to use for LLM-dependent steps */
  defaultLLM?: LanguageModel;
  /** Default search provider to use for search-dependent steps */
  defaultSearchProvider?: any;
}

/**
 * Extended error interface with step information
 */
export interface ResearchError extends Error {
  step?: string;
  code?: string;
}

/**
 * Type guard to check if an object is a ResearchError
 */
export function isResearchError(error: Error): error is ResearchError {
  return 'step' in error || 'code' in error;
}
