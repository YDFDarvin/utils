import { VirtualQueue } from '../structures/virtualQueue';

export class AmqpMessageLimiter<T>{
  private _messageBufferQueue : VirtualQueue<T>;
  private _handleStrategy : HandleStrategy;

  constructor(handleStrategy: HandleStrategy){
    this._messageBufferQueue = new VirtualQueue<T>();
    this._handleStrategy = handleStrategy;
  }

  AddNewMessage(message : T){
    this._messageBufferQueue.enqueue(message);
  }

  TryGetNewMessageToHandle() : T | null
  {
    if(this._messageBufferQueue.length && this._handleStrategy.canProceedHandling()){
      return this._messageBufferQueue.dequeue();
    }
    return null;
  }

  GetCachedMessagesLength() : number{
    return this._messageBufferQueue.length;
  }
}

export interface HandleStrategy {
  canProceedHandling : () => boolean;
}
