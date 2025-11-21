// Circuit Breaker - Prevent cascading failures from unreliable sources

import type { SupabaseClient } from '@supabase/supabase-js'

export type CircuitBreakerState = 'closed' | 'open' | 'half_open'

export type CircuitBreakerConfig = {
  failureThreshold: number // Number of failures before opening
  timeoutMinutes: number // How long to keep circuit open
  successThreshold: number // Successes needed to close from half-open
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  timeoutMinutes: 30,
  successThreshold: 2,
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig

  constructor(
    private supabase: SupabaseClient,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if a source is available (circuit not open)
   */
  async isAvailable(source: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('circuit_breaker_state')
      .select('state, open_until')
      .eq('source', source)
      .maybeSingle()

    if (!data) {
      return true // No circuit breaker = available
    }

    if (data.state === 'closed') {
      return true
    }

    if (data.state === 'open') {
      // Check if timeout has expired
      if (data.open_until && new Date(data.open_until) <= new Date()) {
        // Timeout expired - move to half-open
        await this.supabase
          .from('circuit_breaker_state')
          .update({ state: 'half_open', updated_at: new Date().toISOString() })
          .eq('source', source)
        return true
      }
      return false // Circuit still open
    }

    if (data.state === 'half_open') {
      return true // Allow test request
    }

    return false
  }

  /**
   * Record success for a source
   */
  async recordSuccess(source: string): Promise<void> {
    const { data } = await this.supabase.rpc('update_circuit_breaker', {
      p_source: source,
      p_success: true,
      p_failure_threshold: this.config.failureThreshold,
      p_timeout_minutes: this.config.timeoutMinutes,
    })

    console.log(`[Circuit Breaker] ${source}: SUCCESS -> ${data}`)
  }

  /**
   * Record failure for a source
   */
  async recordFailure(source: string): Promise<CircuitBreakerState> {
    const { data } = await this.supabase.rpc('update_circuit_breaker', {
      p_source: source,
      p_success: false,
      p_failure_threshold: this.config.failureThreshold,
      p_timeout_minutes: this.config.timeoutMinutes,
    })

    const newState = (data as CircuitBreakerState) || 'closed'
    console.log(`[Circuit Breaker] ${source}: FAILURE -> ${newState}`)

    return newState
  }

  /**
   * Get current state for a source
   */
  async getState(source: string): Promise<{
    state: CircuitBreakerState
    failureCount: number
    lastFailure: Date | null
    lastSuccess: Date | null
  }> {
    const { data } = await this.supabase
      .from('circuit_breaker_state')
      .select('*')
      .eq('source', source)
      .maybeSingle()

    if (!data) {
      return {
        state: 'closed',
        failureCount: 0,
        lastFailure: null,
        lastSuccess: null,
      }
    }

    return {
      state: data.state as CircuitBreakerState,
      failureCount: data.failure_count,
      lastFailure: data.last_failure_at ? new Date(data.last_failure_at) : null,
      lastSuccess: data.last_success_at ? new Date(data.last_success_at) : null,
    }
  }

  /**
   * Manually reset a circuit breaker
   */
  async reset(source: string): Promise<void> {
    await this.supabase
      .from('circuit_breaker_state')
      .update({
        state: 'closed',
        failure_count: 0,
        open_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('source', source)

    console.log(`[Circuit Breaker] ${source}: MANUALLY RESET`)
  }
}
