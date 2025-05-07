/**
 * @plust/deep-restruct
 * A deep research tool for gathering and synthesizing information
 */

// Core functionality
export { research } from './core/research';
export { executePipeline, createInitialState } from './core/pipeline';

// Research steps
export { plan } from './steps/plan';
export { searchWeb } from './steps/searchWeb';
export { extractContent } from './steps/extractContent';
export { evaluate, repeatUntil } from './steps/flowControl';
export { orchestrate } from './steps/orchestrate';
export { factCheck } from './steps/factCheck';
export { summarize } from './steps/summarize';
export { refineQuery } from './steps/refineQuery';
export { analyze } from './steps/analyze';

// Types
export type { 
  ResearchState, 
  ResearchStep, 
  PipelineConfig,
  ResearchInput
} from './types/pipeline';

export type {
  ResearchPlan,
  PlanOptions
} from './steps/plan';

export type {
  WebSearchOptions,
  SearchResult
} from './steps/searchWeb';

export type {
  ExtractContentOptions,
  ExtractedContent
} from './steps/extractContent';

export type {
  EvaluateOptions,
  RepeatUntilOptions
} from './steps/flowControl';

export type {
  OrchestrateOptions
} from './steps/orchestrate';

export type {
  FactCheckOptions,
  FactCheckResult
} from './steps/factCheck';

export type {
  SummarizeOptions
} from './steps/summarize';

export type {
  RefineQueryOptions,
  RefinedQuery
} from './steps/refineQuery';

export type {
  AnalyzeOptions,
  AnalysisResult
} from './steps/analyze';