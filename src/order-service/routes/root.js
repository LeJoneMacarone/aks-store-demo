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

  const activeHttpRequestsStarted = new client.Counter({
    name: 'http_active_requests_started_total',
    help: 'Total number of gRPC requests started',
  });
  
  const activeHttpRequestsEnded = new client.Counter({
    name: 'http_active_requests_ended_total',
    help: 'Total number of gRPC requests ended',
  });

  register.registerMetric(httpRequestCounter);
  register.registerMetric(httpResponseTimeHistogram);
  register.registerMetric(activeHttpRequestsStarted);
  register.registerMetric(activeHttpRequestsEnded);

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
    // Increment the started requests counter
    activeHttpRequestsStarted.inc();
    // Increment request counter
    httpRequestCounter.inc({ method: 'POST' }); 
    
    fastify.sendMessage(Buffer.from(JSON.stringify(msg)))
    reply.code(201)
    
    // Increment the ended requests counter
    activeHttpRequestsEnded.inc();
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
