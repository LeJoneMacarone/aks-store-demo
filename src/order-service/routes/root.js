'use strict'
const client = require('prom-client');

module.exports = async function (fastify, opts) {
  
  const { register } = opts; // Use the shared registry
  //  ------ Prometheus Custom Metrics  ------

  // Register Prometheus metrics

  // Create Prometheus metrics
  const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP POST requests',
    labelNames: ['method'],
  });

  const httpResponseTimeHistogram = new client.Histogram({
    name: 'http_response_time_seconds',
    help: 'Response time for HTTP POST requests in seconds',
    labelNames: ['method'],
    buckets: [0.1, 0.5, 1, 2.5, 5, 10],
  });

  register.registerMetric(httpRequestCounter);
  register.registerMetric(httpResponseTimeHistogram);

  // ------ End Prometheus Metrics Definition  ------

  // Expose the metrics endpoint
  fastify.get('/metrics', async function (request, reply) {
    reply.header('Content-Type', register.contentType);
    reply.send(await register.metrics());
  });

  fastify.post('/', async function (request, reply) {
    const msg = request.body
    console.log(`[GET] Received from HTTP: ${msg}`);
    
    // Start timer for response time metric
    const startTime = process.hrtime(); 
    // Increment request counter
    httpRequestCounter.inc({ method: 'POST' }); 
    
    fastify.sendMessage(Buffer.from(JSON.stringify(msg)))
    reply.code(201)
    
    // Record response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationInSeconds = seconds + nanoseconds / 1e9;
    httpResponseTimeHistogram.observe({ method: 'POST' }, durationInSeconds);
  })

  fastify.get('/health', async function (request, reply) {
    const appVersion = process.env.APP_VERSION || '0.1.0'
    return { status: 'ok', version: appVersion }
  })

  fastify.get('/hugs', async function (request, reply) {
    return { hugs: fastify.someSupport() }
  })
}
