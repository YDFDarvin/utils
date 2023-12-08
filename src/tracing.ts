import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

//it's custom type. Becous i can't add to utils project typeorm for add CurosrResult type frome this library. We need update mongodb package in all repos.
declare type CursorResult = any | void | boolean;

function otel(config: { apiKey: string; serviceName: string; sensativeDb?: string }): NodeSDK {
  const sensativeDb = config.sensativeDb ? config.sensativeDb : '';
  const otelSDK = new NodeSDK({
    spanProcessor: new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: 'https://otelcol.aspecto.io/v1/traces',
        headers: {
          // Aspecto API-Key is required
          Authorization: config.apiKey,
        },
      }),
    ),

    instrumentations: [
      getNodeAutoInstrumentations(),
      new MongoDBInstrumentation({
        enhancedDatabaseReporting: true,
        responseHook: function (span, mongo) {
          const result: CursorResult = mongo.data.result;
          if (sensativeDb !== '' && result?.cursor?.ns.indexOf(sensativeDb) !== -1) {
            //clear statment log with sensative data
            span.setAttribute('db.statement', ['security']);
            return;
          }
          for (let index = 0; index < result?.cursor?.firstBatch?.length; index++) {
            span.addEvent('row_' + index, result?.cursor?.firstBatch[index]);
            //max 10 rows show result from DB
            if (index >= 10) {
              break;
            }
          }
        },
      }),
    ],

    serviceName: config.serviceName ? config.serviceName : 'unset-name-serive',
  });

  return otelSDK;
}

export default otel;
