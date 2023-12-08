import { AmqpMessageLimiter } from "../dynamic-prefetch/amqpMessageLimiter";
import { PrefetchQueueFake, QueueMessage } from "./prefetchQueueFake";


describe("RMQ dynamic prefetch",  () => {
  const prefetchCount = 10;
  let queueSimulatorFake : PrefetchQueueFake
  
  beforeAll(() => {
    queueSimulatorFake = new PrefetchQueueFake(prefetchCount);
  })

  it("fake queue works as expected",  () => {
    const queueMessageToFetch = 100;
    let receivedMessages = new Array<QueueMessage>;

    queueSimulatorFake.fill(queueMessageToFetch);

    queueSimulatorFake.subscribeToNewItems((message: QueueMessage)=>{
      receivedMessages.push(message);
    });

    queueSimulatorFake.startReceive();

    expect(receivedMessages.length).toEqual(prefetchCount);
    const messagesToAck = [receivedMessages[0],receivedMessages[1]];

    //acking two messages from received list
    messagesToAck.forEach((msg)=>queueSimulatorFake.ackMessage(msg))
    expect(receivedMessages.length).toEqual(prefetchCount + messagesToAck.length);

  })

  const totalMessageToReceiveBeforeStopCount = 5;

  it(`message limiter limit handling messages by counter strategy. count: ${totalMessageToReceiveBeforeStopCount}`,  () => {
    const queueMessageToFetch = 100;
    let receivedMessages = new Array<QueueMessage>;
    let messagesToHandle = new Array<QueueMessage>;

    queueSimulatorFake.fill(queueMessageToFetch);
    let messageHandleLimiter : AmqpMessageLimiter<QueueMessage>;
    let allowToReceiveForcely = false;

    let counterStrategy =  {
      canProceedHandling : () => messagesToHandle.length < totalMessageToReceiveBeforeStopCount || allowToReceiveForcely
    };
    
    messageHandleLimiter = new AmqpMessageLimiter<QueueMessage>(counterStrategy);

    queueSimulatorFake.subscribeToNewItems((message: QueueMessage)=>{
      receivedMessages.push(message);
      messageHandleLimiter.AddNewMessage(message);
    });

    queueSimulatorFake.startReceive();

    //try to get more, that we can process
    for(let i = 0;i<totalMessageToReceiveBeforeStopCount+10;i++){
      const msgToHandle = messageHandleLimiter.TryGetNewMessageToHandle();
      if(msgToHandle)
        messagesToHandle.push(msgToHandle);
    }
    
    expect(messagesToHandle.length).toEqual(totalMessageToReceiveBeforeStopCount);

    //acking two more to be sure, that limit is still here and ack will not take affect
    [receivedMessages[0],receivedMessages[1]].forEach((msg)=>queueSimulatorFake.ackMessage(msg))
    
    expect(messagesToHandle.length).toEqual(totalMessageToReceiveBeforeStopCount);

    //criteria is still not for getting new items to process
    let msgToHandle = messageHandleLimiter.TryGetNewMessageToHandle();
    expect(msgToHandle).toEqual(null);

    //limits off
    allowToReceiveForcely = true;
    msgToHandle = messageHandleLimiter.TryGetNewMessageToHandle();
    expect(msgToHandle).not.toEqual(null);
  })
})
