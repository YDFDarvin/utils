// @ts-ignore-start
const opentelemetry = require("@opentelemetry/sdk-node");
const { AmqplibInstrumentation } = require('@opentelemetry/instrumentation-amqplib');
const { SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { ExpressInstrumentation } = require("opentelemetry-instrumentation-express");
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
const { NestInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core');

const exporter = new OTLPTraceExporter({
    url: 'https://otelcol.aspecto.io/v1/traces',
    headers: {
        // Aspecto API-Key is required
        Authorization: process.env.OPENTELEMETRY_KEY
    }
})

const sensativeDb = 'glUsers';

const sdk = new opentelemetry.NodeSDK({
    spanProcessor: new SimpleSpanProcessor(exporter),
    instrumentations: [
      new MongoDBInstrumentation({
        enhancedDatabaseReporting: true,
        // @ts-ignore
        responseHook: function(span, mongo){
          if(mongo && 
            mongo.hasOwnProperty('data') && 
            mongo.data.hasOwnProperty('result') && 
            mongo.data.result.hasOwnProperty('cursor') && 
            mongo.data.result.cursor.hasOwnProperty('firstBatch') 
            ){
            //Todo: glUsers need to const upper
           if( mongo.data.result.cursor.hasOwnProperty('ns') &&  mongo.data.result.cursor.ns.indexOf(sensativeDb) !== -1){
              //clear statment log with sensative data
              span.setAttribute('db.statement',['security']);
              return;
           }
            for (let index = 0; index < mongo.data.result.cursor.firstBatch.length; index++) {
              span.addEvent('row_' + index, mongo.data.result.cursor.firstBatch[index]);
              //max 10 rows show result from DB
              if(index >= 10){
                break;
              } 
            }
          }
        }
      }),
        new AmqplibInstrumentation( {
             // @ts-ignore
          publishHook: (span, publishInfo) => { 
            span.addEvent('PUBLISH_HOOK', {content: Buffer.from(publishInfo?.content, 'base64').toString()})
          },
             // @ts-ignore
          publishConfirmHook: (span, publishConfirmedInto) => {
            span.addEvent('PUBLISH_CONFIRM_HOOK',{content: Buffer.from(publishConfirmedInto?.content, 'base64').toString()})
           },
              // @ts-ignore
          consumeHook: (span, consumeInfo) => { 
            span.addEvent('CONSUME_HOOK', {fields: consumeInfo?.msg?.fields, msg: Buffer.from(consumeInfo?.msg?.content, 'base64').toString()});
          },
             // @ts-ignore
          consumeEndHook: (span, consumeEndInfo) => {
            span.addEvent('CONSUME_END_HOOK', {fields: consumeEndInfo?.msg?.fields, msg: Buffer.from(consumeEndInfo?.msg?.content, 'base64').toString()});
  
          },
        }),
        new HttpInstrumentation({
          /**
           *  input/output ignoore endpoint
           */
          ignoreIncomingPaths: ['/favicon.ico','/metrics'],
          ignoreOutgoingUrls:['/favicon.ico','/metrics']
        }),
        new NestInstrumentation(),
        new ExpressInstrumentation()
    ],
    serviceName: process.env.SERVICE_NAME
});

sdk.start()
// @ts-ignore-end
