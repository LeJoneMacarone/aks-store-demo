'use strict';

const path = require('path');
const AutoLoad = require('@fastify/autoload');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const client = require('prom-client');

module.exports = async function (fastify, opts) {
  
  //  ------ Prometheus Custom Metrics  ------

  // Register Prometheus metrics
  const register = new client.Registry();

  // Create Prometheus metrics
  const requestCounter = new client.Counter({
    name: 'grpc_requests_total',
    help: 'Total number of gRPC requests',
    labelNames: ['method'],
  });

  const responseTimeHistogram = new client.Histogram({
    name: 'grpc_response_time_seconds',
    help: 'Response time for gRPC requests in seconds',
    labelNames: ['method'],
    buckets: [0.1, 0.5, 1, 2.5, 5, 10],
  });

  const activeRequestsGauge = new client.Gauge({
    name: 'grpc_active_requests',
    help: 'Number of active gRPC requests being handled',
  });

  register.registerMetric(requestCounter);
  register.registerMetric(responseTimeHistogram);
  register.registerMetric(activeRequestsGauge);

  // Expose the metrics endpoint
  fastify.get('/metrics', async (req, reply) => {
    reply.header('Content-Type', register.contentType);
    reply.send(await register.metrics());
  });

  // ------ End Prometheus Metrics Definition  ------

  fastify.register(require('@fastify/cors'), { origin: '*' });

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts),
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts),
  });

  // Load gRPC proto file for MensagemService
  const PROTO_PATH = path.join(__dirname, 'mensagem.proto');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  // Load the MensagemService definition from the proto file
  const mensagemProto = grpc.loadPackageDefinition(packageDefinition).MensagemService;

  // Implement the EnviarMensagem method
  function enviarMensagem(call, callback) {
    
    // Start timer for response time metric
    const startTime = process.hrtime(); 
    // Increment active requests gauge
    activeRequestsGauge.inc();

    const mensagem = call.request;
    console.log('[GET] Received from gRPC:\n', mensagem);

    // Increment request counter
    requestCounter.inc({ method: 'EnviarMensagem' }); 
  
    let parsedConteudo;
    try {
      // Replace single quotes with double quotes
      const validJson = mensagem.conteudo.replace(/'/g, '"');
      
      // Parse the corrected JSON string
      parsedConteudo = JSON.parse(validJson);
    } catch (error) {
      console.error('Failed to parse conteudo:', error);
      callback(null,{
        resposta: 'Invalid JSON format in conteudo',
      });
      return;
    }
  
    // Pass the parsed content to sendMessage
    fastify.sendMessage(Buffer.from(JSON.stringify(parsedConteudo)));
  
    // Respond to the gRPC client
    callback(null, {
      resposta: `[GET] Message received with sucess: ${mensagem.conteudo}`,
    });

    // Record response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationInSeconds = seconds + nanoseconds / 1e9;
    responseTimeHistogram.observe({ method: 'EnviarMensagem' }, durationInSeconds);

    // Decrement active requests gauge
    activeRequestsGauge.dec(); 
  }
  
  // Create gRPC server
  const grpcServer = new grpc.Server();
  grpcServer.addService(mensagemProto.service, { EnviarMensagem: enviarMensagem });

  // Start gRPC server
  grpcServer.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('Failed to start gRPC server:', err);
        process.exit(1);
      }
      console.log(`gRPC server running on port ${port}`);
    }
  );
};
