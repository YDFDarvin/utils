
export class AmqpMessageWrapper<T>{
  private _messageData : T;
  private _createTimeStamp : number;
  constructor(messageData:T){
    this._messageData = messageData;
    this._createTimeStamp = +new Date();
  }

  getMessageLiveTimeMs(){
    return +new Date() - this._createTimeStamp;
  }

  getMessage():T{
    return this._messageData;
  }
}
