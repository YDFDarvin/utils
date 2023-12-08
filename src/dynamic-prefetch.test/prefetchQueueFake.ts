
export class PrefetchQueueFake{
  private _prefetchCount : number;

  private queueMessages : Array<QueueMessage>
  private newItemArriveListener : ReceiveQueueMessageCallback

  private _sentMessages : Array<QueueMessage>;
  private _ackedMessages : Array<QueueMessage>;

  constructor(prefetchCount : number){
    this._prefetchCount = prefetchCount;
    this.queueMessages = new Array();
    this.newItemArriveListener = ()=>{};
    
    this._sentMessages = new Array();
    this._ackedMessages = new Array();
  }

  fill(msgCount : number){
    this.queueMessages = Array.from({ length: msgCount }, (_el,i) => ({ id:i } as QueueMessage))
  }

  subscribeToNewItems(cb:ReceiveQueueMessageCallback){
    this.newItemArriveListener = cb;
  }

  ackMessage(msg : QueueMessage){
    this._ackedMessages.push(msg);
    this._sendNextMessageToClient();
  }

  startReceive(){
    for(var i = 0; i < this._prefetchCount; i++){
      this._sendNextMessageToClient();
    }
  }

  private _sendNextMessageToClient(){
    const sendMessageIds = this._sentMessages.map(x=>x.id);
    const ackedMessageIds = this._sentMessages.map(x=>x.id);

    //send not acked and not sent message
    const msgToSend = this.queueMessages.find((msg)=>
        !sendMessageIds.includes(msg.id) && 
        !ackedMessageIds.includes(msg.id)
      );

    if(msgToSend){
      this._sendMessageToClient(msgToSend);
    }
  }

  private _sendMessageToClient(msg : QueueMessage){
    this._sentMessages.push(msg);

    //pushing message to consumer by calling callback set previously
    this.newItemArriveListener.call(this,msg);
  }
}

export interface ReceiveQueueMessageCallback {
  (message: QueueMessage): void;
}

export type QueueMessage = {
  id : number
}

