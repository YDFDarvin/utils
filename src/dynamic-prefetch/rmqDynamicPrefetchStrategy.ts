import { CustomTransportStrategy, RmqOptions, ServerRMQ } from "@nestjs/microservices";
import { gauge } from "../../src/prom-client";
import { AmqpMessageLimiter } from "./amqpMessageLimiter";
import { AmqpMessageWrapper } from "./amqpMessageWrapper";

export class RmqDynamicPrefetchStrategy  extends ServerRMQ  implements CustomTransportStrategy {
    private _msgLimiter : AmqpMessageLimiter<AmqpMessageWrapper<[Record<string, any>, string]>>;
    private _timerHandle: NodeJS.Timer;
  
    private readonly _isDynamicPrefetchEnabled : boolean;
    //memory point in Megabytes, when we should stop handling new messages
    private readonly _memoryTresholdMB : number;
    //speed in ms to determine how fast new message will be pushed to handle
    private readonly _pushMessagesToHandleInterval : number;

    constructor(protected override readonly options: RmqOptions['options'], dynamicPrefetchOptions?: DynamicPrefetchRmqOptions) {
      super(options);  

      this._memoryTresholdMB = dynamicPrefetchOptions?.memoryTresholdMB ??
        ((process.env["RMQ_DYNAMIC_PREFETCH_MEMORY_TRESHOLD_MB"] ? +process.env["RMQ_DYNAMIC_PREFETCH_MEMORY_TRESHOLD_MB"]:null)
        || 1024*6);
      
      this._pushMessagesToHandleInterval = dynamicPrefetchOptions?.pushMessagesToHandleInterval ??
        ((process.env["RMQ_DYNAMIC_PREFETCH_PUSH_MESSAGES_TO_HANDLE_INTERVAL"] ? +process.env["RMQ_DYNAMIC_PREFETCH_PUSH_MESSAGES_TO_HANDLE_INTERVAL"]:null)
        || 100);

      this._isDynamicPrefetchEnabled = dynamicPrefetchOptions?.isEnabled ?? 
        ((typeof(process.env["RMQ_DYNAMIC_PREFETCH_ENABLED"])!=='undefined' ? (((process.env["RMQ_DYNAMIC_PREFETCH_ENABLED"]+'').toLowerCase())=='true'):null)
        || false);

      //determine ms count to check internal queue for pulling received messages
      const checkFreeMemoryEveryMs = this._pushMessagesToHandleInterval;
      this._msgLimiter = new  AmqpMessageLimiter({
          canProceedHandling : this._isMemoryLevelEnough.bind(this)
      });
      
      this._timerHandle = this._limiterQueueConsumerStart(checkFreeMemoryEveryMs);
    }
    
    private _limiterQueueConsumerStart(checkFreeMemoryEveryMs:number):NodeJS.Timer{

      return setInterval(() => {
        //try get cached messages while condition is ok
        let queuedMessage = this._msgLimiter.TryGetNewMessageToHandle();
        
        if(queuedMessage){
          let messageData = queuedMessage.getMessage();
          //throw to default flow
          super.handleMessage(messageData[0],messageData[1]);
          const queueLength = this._msgLimiter.GetCachedMessagesLength();
          gauge({name: 'rmq_prefetch_internal_queue_size', help: 'Current size of internal prefetch queue'}).set(queueLength);
          const messageLiveTimeMs = queuedMessage.getMessageLiveTimeMs();
          gauge({name: 'rmq_prefetch_internal_queue_message_live_time_ms', help: 'Live time of message in internal queue in ms'}).set(messageLiveTimeMs);
        }
      }, checkFreeMemoryEveryMs);
    }
   
    private _isMemoryLevelEnough():boolean {
      const currentMemoryInUseMB = process.memoryUsage().heapUsed/1024/1024;

      return currentMemoryInUseMB <= this._memoryTresholdMB;
    }
  
    public override listen(callback: (...optionalParams: unknown[]) => any): any{
      return super.listen(callback);
    }
    
    public override close() {
      super.close();
      this._dispose();
    }
  
    private _dispose():void {
      clearInterval(this._timerHandle);
    }

    public override async handleMessage(message: Record<string, any>, channel: any): Promise<void> {
      if(this._isDynamicPrefetchEnabled){
        const queueLength = this._msgLimiter.GetCachedMessagesLength();
        const isInternalQueueHasMessages = !!queueLength;
        gauge({name: 'rmq_prefetch_internal_queue_size', help: 'Current size of internal prefetch queue'}).set(queueLength);

        //in case we already have messages in internal queue - put to tail
        if(isInternalQueueHasMessages || !this._isMemoryLevelEnough()){
            //move to internal queue
            this._msgLimiter.AddNewMessage(new AmqpMessageWrapper([message,channel]));
            return;
        }
      }
      //default scenario
      return super.handleMessage(message,channel);
    }
}

export interface DynamicPrefetchRmqOptions {
  isEnabled?: boolean;
  memoryTresholdMB? : number;
  pushMessagesToHandleInterval? : number
}
