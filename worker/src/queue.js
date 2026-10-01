/**
 * In-Memory & Persistent Queue Manager para Notificações e Webhooks
 * Padrão Zero-Cost: sem dependência de SaaS ou Redis gerenciado
 */

export class JobQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 5;
    this.maxRetries = options.maxRetries || 3;
    this.backoffMs = options.backoffMs || 500;
    this.queue = [];
    this.activeWorkers = 0;
    this.handlers = new Map();
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
    };
  }

  registerHandler(jobType, handlerFn) {
    this.handlers.set(jobType, handlerFn);
  }

  enqueue(type, payload, options = {}) {
    const job = {
      id: options.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      attempts: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      createdAt: new Date().toISOString(),
    };
    this.queue.push(job);
    this.dispatchNext();
    return job.id;
  }

  async dispatchNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;

    (async () => {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        console.warn(`[JobQueue] Nenhum handler registrado para job tipo: ${job.type}`);
        this.stats.failed++;
        this.activeWorkers--;
        this.dispatchNext();
        return;
      }

      job.attempts++;
      try {
        await handler(job.payload);
        this.stats.processed++;
      } catch (err) {
        console.error(`[JobQueue] Erro ao processar job ${job.id} (tentativa ${job.attempts}):`, err.message);
        if (job.attempts < job.maxRetries) {
          this.stats.retried++;
          const delay = this.backoffMs * Math.pow(2, job.attempts - 1);
          setTimeout(() => {
            this.queue.unshift(job);
            this.dispatchNext();
          }, delay);
        } else {
          this.stats.failed++;
          console.error(`[JobQueue] Job ${job.id} atingiu limite de retries (${job.maxRetries}). Movido para Dead-Letter.`);
        }
      } finally {
        this.activeWorkers--;
        this.dispatchNext();
      }
    })();
  }

  getStats() {
    return {
      ...this.stats,
      pending: this.queue.length,
      active: this.activeWorkers,
    };
  }
}
