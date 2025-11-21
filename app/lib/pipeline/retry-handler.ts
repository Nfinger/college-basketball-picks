// Retry Handler - Intelligent retry logic with exponential backoff

export type RetryableError = 'network' | 'rate_limit' | 'auth' | 'validation' | 'timeout'

export type RetryConfig = {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export type RetryStrategy = {
  errorType: RetryableError
  config: RetryConfig
}

const DEFAULT_STRATEGIES: Record<RetryableError, RetryConfig> = {
  network: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  },
  rate_limit: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 3,
  },
  auth: {
    maxRetries: 2,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  validation: {
    maxRetries: 0, // Don't retry validation errors
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
  },
  timeout: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
}

export class RetryHandler {
  /**
   * Execute function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      errorType?: RetryableError
      config?: Partial<RetryConfig>
      onRetry?: (attempt: number, error: Error) => void
    } = {}
  ): Promise<T> {
    const errorType = options.errorType || 'network'
    const config = { ...DEFAULT_STRATEGIES[errorType], ...options.config }

    let lastError: Error | null = null
    let attempt = 0

    while (attempt <= config.maxRetries) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        attempt++

        // Don't retry if we've exhausted attempts
        if (attempt > config.maxRetries) {
          break
        }

        // Calculate delay with exponential backoff + jitter
        const baseDelay = Math.min(
          config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        )
        const jitter = Math.random() * baseDelay * 0.1 // 10% jitter
        const delay = baseDelay + jitter

        console.log(
          `[Retry] Attempt ${attempt}/${config.maxRetries} failed. Retrying in ${Math.round(delay)}ms...`
        )

        if (options.onRetry) {
          options.onRetry(attempt, lastError)
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Classify error type for retry strategy
   */
  static classifyError(error: Error): RetryableError {
    const message = error.message.toLowerCase()

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return 'network'
    }

    // Rate limiting
    if (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('too many requests')
    ) {
      return 'rate_limit'
    }

    // Authentication
    if (
      message.includes('auth') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthorized')
    ) {
      return 'auth'
    }

    // Timeout
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout'
    }

    // Validation errors shouldn't be retried
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation'
    }

    // Default to network error
    return 'network'
  }

  /**
   * Execute with automatic error classification and retry
   */
  static async withAutoRetry<T>(
    fn: () => Promise<T>,
    options: {
      onRetry?: (attempt: number, error: Error, errorType: RetryableError) => void
    } = {}
  ): Promise<T> {
    return this.withRetry(fn, {
      errorType: 'network', // Will be reclassified on error
      onRetry: (attempt, error) => {
        const errorType = this.classifyError(error)
        if (options.onRetry) {
          options.onRetry(attempt, error, errorType)
        }
      },
    })
  }
}
