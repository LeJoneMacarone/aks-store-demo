'use strict'
const client = require('prom-client');

module.exports = async function (fastify, opts) {
  
  //  ------ Prometheus Custom Metrics  ------

  // Register Prometheus metrics
  const register = new client.Registry();

  // Create Prometheus metrics
  const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP POST requests',
    labelNames: ['method'],
  });

  const httpActiveRequestsGauge = new client.Gauge({
    name: 'http_active_requests',
    help: 'Number of active HTTP POST requests being handled',
  });

  const httpResponseTimeHistogram = new client.Histogram({
    name: 'http_response_time_seconds',
    help: 'Response time for HTTP POST requests in seconds',
    labelNames: ['method'],
    buckets: [0.1, 0.5, 1, 2.5, 5, 10],
  });

  register.registerMetric(httpRequestCounter);
  register.registerMetric(httpActiveRequestsGauge);
  register.registerMetric(httpResponseTimeHistogram);

  // ------ End Prometheus Metrics Definition  ------

  fastify.post('/', async function (request, reply) {
    const msg = request.body
    console.log(`[GET] Received from HTTP: ${msg}`);
    
    // Start timer for response time metric
    const startTime = process.hrtime(); 
    // Increment active requests gauge
    httpActiveRequestsGauge.inc(); 
    // Increment request counter
    httpRequestCounter.inc({ method: 'POST' }); 
    
    fastify.sendMessage(Buffer.from(JSON.stringify(msg)))
    reply.code(201)

    // Record response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationInSeconds = seconds + nanoseconds / 1e9;
    httpResponseTimeHistogram.observe({ method: 'POST' }, durationInSeconds);

    // Decrement active requests gauge
    httpActiveRequestsGauge.dec(); 
  })

  fastify.get('/health', async function (request, reply) {
    const appVersion = process.env.APP_VERSION || '0.1.0'
    return { status: 'ok', version: appVersion }
  })

  fastify.get('/hugs', async function (request, reply) {
    return { hugs: fastify.someSupport() }
  })
}
