/**
 * Logging utility for the @plust/datasleuth package
 */

/**
 * Available log levels in order of increasing severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Configuration options for the logger
 */
export interface LoggerOptions {
  /** Minimum level to log (defaults to 'info') */
  level?: LogLevel;
  /** Include timestamp in log messages */
  includeTimestamp?: boolean;
  /** Include current step name in log messages */
  includeStepName?: boolean;
  /** Whether to log to the console */
  logToConsole?: boolean;
  /** Additional custom loggers to send log messages to */
  customLoggers?: Array<(level: LogLevel, message: string, ...args: unknown[]) => void>;
}

/**
 * Logger class that handles log message formatting and output
 */
export class Logger {
  private level: LogLevel;
  private options: {
    includeTimestamp: boolean;
    includeStepName: boolean;
    logToConsole: boolean;
    customLoggers?: Array<(level: LogLevel, message: string, ...args: unknown[]) => void>;
  };
  private currentStep?: string;
  
  /**
   * Creates a new logger instance
   */
  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.options = {
      includeTimestamp: options.includeTimestamp ?? true,
      includeStepName: options.includeStepName ?? true,
      logToConsole: options.logToConsole ?? true,
      customLoggers: options.customLoggers
    };
  }
  
  /**
   * Set the current step name for step-specific logging
   */
  setCurrentStep(stepName?: string): void {
    this.currentStep = stepName;
  }
  
  /**
   * Get the current step name
   */
  getCurrentStep(): string | undefined {
    return this.currentStep;
  }
  
  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.level = level;
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }
  
  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }
  
  /**
   * Log an error message
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }
  
  /**
   * Log a message with the specified level
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message);
    
    if (this.options.logToConsole) {
      const consoleMethod = this.getConsoleMethod(level);
      consoleMethod(formattedMessage, ...args);
    }
    
    if (this.options.customLoggers) {
      for (const logger of this.options.customLoggers) {
        logger(level, formattedMessage, ...args);
      }
    }
  }
  
  /**
   * Check if the given log level should be logged based on the current minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.level];
  }
  
  /**
   * Format the log message with optional timestamp and step name
   */
  private formatMessage(level: LogLevel, message: string): string {
    let formattedMessage = message;
    
    if (this.options.includeTimestamp) {
      formattedMessage = `[${new Date().toISOString()}] ${formattedMessage}`;
    }
    
    if (this.options.includeStepName && this.currentStep) {
      formattedMessage = `[${this.currentStep}] ${formattedMessage}`;
    }
    
    return `[${level.toUpperCase()}] ${formattedMessage}`;
  }
  
  /**
   * Get the appropriate console method for the log level
   */
  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case 'debug': return console.debug;
      case 'info': return console.info;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Creates a step-specific logger that automatically includes the step name
 */
export function createStepLogger(stepName: string): Pick<Logger, 'debug' | 'info' | 'warn' | 'error'> {
  return {
    debug: (message: string, ...args: unknown[]) => {
      const prevStep = logger.getCurrentStep();
      logger.setCurrentStep(stepName);
      logger.debug(message, ...args);
      logger.setCurrentStep(prevStep);
    },
    info: (message: string, ...args: unknown[]) => {
      const prevStep = logger.getCurrentStep();
      logger.setCurrentStep(stepName);
      logger.info(message, ...args);
      logger.setCurrentStep(prevStep);
    },
    warn: (message: string, ...args: unknown[]) => {
      const prevStep = logger.getCurrentStep();
      logger.setCurrentStep(stepName);
      logger.warn(message, ...args);
      logger.setCurrentStep(prevStep);
    },
    error: (message: string, ...args: unknown[]) => {
      const prevStep = logger.getCurrentStep();
      logger.setCurrentStep(stepName);
      logger.error(message, ...args);
      logger.setCurrentStep(prevStep);
    }
  };
}