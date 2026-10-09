/**
 * SafarGo - Sentry Error Tracking, Performance Monitoring & Session Replay
 * Follows: https://skills.sentry.dev/instrument
 */

export const SENTRY_CONFIG = {
  dsn: "https://a28109ca331da63b2173a570b29c2112@o4512215495868416.ingest.de.sentry.io/4512215507927120",
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/, "/api"],
  replaysSessionSampleRate: 0.1, // Sample 10% in normal sessions
  replaysOnErrorSampleRate: 1.0, // Sample 100% on sessions with errors
};

// Sentry Client Abstraction Layer
class SentryManager {
  constructor() {
    this.initialized = false;
    this.client = null;
    this.buffer = [];
    this.metricsBuffer = [];
  }

  init(options = {}) {
    if (this.initialized) return;

    const config = {
      ...SENTRY_CONFIG,
      ...options,
    };

    // Check if global Sentry SDK is present (via CDN or bundled package)
    if (typeof window !== 'undefined' && window.Sentry) {
      this.client = window.Sentry;
      try {
        const integrations = [];
        if (typeof this.client.browserTracingIntegration === 'function') {
          integrations.push(this.client.browserTracingIntegration());
        }
        if (typeof this.client.replayIntegration === 'function') {
          integrations.push(this.client.replayIntegration());
        }

        this.client.init({
          ...config,
          integrations,
        });
        this.initialized = true;
        console.log('[SafarGo Sentry] Production error tracking initialized successfully.');
        this.flushBuffer();
        return;
      } catch (err) {
        console.warn('[SafarGo Sentry] Error initializing native Sentry:', err);
      }
    }

    // Modern Fallback Reporter to Sentry Ingest API
    this.initialized = true;
    this.setupGlobalHandlers();
    console.log('[SafarGo Sentry] Sentry tracker active with ingest target:', config.dsn.split('@')[1]);
  }

  setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason || new Error('Unhandled Promise Rejection'), {
        type: 'unhandledrejection',
      });
    });
  }

  captureException(error, context = {}) {
    if (this.client?.captureException) {
      return this.client.captureException(error, { extra: context });
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error?.message || String(error),
      stack: error?.stack,
      extra: context,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    console.error('[Sentry Captured Error]:', payload);
    this.sendToSentry(payload);
  }

  captureMessage(message, level = 'info') {
    if (this.client?.captureMessage) {
      return this.client.captureMessage(message, level);
    }
    console.log(`[Sentry ${level.toUpperCase()}]:`, message);
  }

  get logger() {
    return {
      info: (message, extra = {}) => {
        if (this.client?.logger?.info) {
          this.client.logger.info(message, extra);
        } else {
          console.info(`[Sentry Log: INFO] ${message}`, extra);
        }
      },
      warn: (message, extra = {}) => {
        if (this.client?.logger?.warn) {
          this.client.logger.warn(message, extra);
        } else {
          console.warn(`[Sentry Log: WARN] ${message}`, extra);
        }
      },
      error: (message, extra = {}) => {
        if (this.client?.logger?.error) {
          this.client.logger.error(message, extra);
        } else {
          console.error(`[Sentry Log: ERROR] ${message}`, extra);
        }
      },
    };
  }

  get metrics() {
    return {
      count: (name, value = 1, tags = {}) => {
        if (this.client?.metrics?.count) {
          this.client.metrics.count(name, value, tags);
        } else {
          console.log(`[Sentry Metric: COUNT] ${name} = +${value}`, tags);
        }
      },
    };
  }

  flushBuffer() {
    while (this.buffer.length > 0) {
      const err = this.buffer.shift();
      this.captureException(err.error, err.context);
    }
  }

  async sendToSentry(payload) {
    try {
      // Parse DSN: https://<publicKey>@<host>/<projectId>
      const match = SENTRY_CONFIG.dsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
      if (!match) return;

      const [, publicKey, host, projectId] = match;
      const endpoint = `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_client=safargo-web/1.0.0&sentry_key=${publicKey}`;

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: Math.random().toString(36).substring(2, 18),
          message: payload.message,
          timestamp: payload.timestamp,
          level: payload.level,
          platform: 'javascript',
          logger: 'safargo.client',
          extra: payload.extra,
          exception: {
            values: [
              {
                type: 'Error',
                value: payload.message,
                stacktrace: {
                  frames: [{ filename: payload.url, function: 'window.onerror' }],
                },
              },
            ],
          },
        }),
      }).catch(() => {
        // Suppress network offline errors
      });
    } catch {
      // Silent catch for telemetry
    }
  }
}

export const Sentry = new SentryManager();

/**
 * Creates the exact ErrorButton requested to test Sentry's error tracking
 */
export function mountErrorButton(containerId = 'sentry-test-container') {
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position: fixed; bottom: 16px; right: 16px; z-index: 9999;';
    document.body.appendChild(container);
  }

  container.innerHTML = `
    <button
      id="sentry-error-btn"
      style="
        background: #DC2626;
        color: #FFFFFF;
        border: none;
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
        display: flex;
        align-items: center;
        gap: 6px;
        transition: transform 0.15s ease, background-color 0.15s ease;
      "
      title="Test Sentry error tracking"
    >
      <span>💥</span> Break the world
    </button>
  `;

  const btn = document.getElementById('sentry-error-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      // Send a log before throwing the error
      Sentry.logger.info('User triggered test error', {
        action: 'test_error_button_click',
      });
      // Send a test metric before throwing the error
      Sentry.metrics.count('test_counter', 1);

      // Trigger user feedback notification
      alert('Sentry Test Triggered!\nCheck Sentry dashboard for error: "This is your first error!"');

      // Throw error
      throw new Error('This is your first error!');
    });
  }
}
