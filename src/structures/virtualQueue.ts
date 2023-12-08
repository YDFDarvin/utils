
  export class VirtualQueue<T> {
    private elements : any;
    private head : number;
    private tail : number;

    constructor() {
      this.elements = {};
      this.head = 0;
      this.tail = 0;
    }
    enqueue(element:T) {
      this.elements[this.tail] = element;
      this.tail++;
    }
    dequeue():T {
      const item = this.elements[this.head] as T;
      delete this.elements[this.head];
      this.head++;
      return item;
    }
    peek():T {
      return this.elements[this.head] as T;
    }
    get length():number {
      return this.tail - this.head;
    }
    get isEmpty():boolean {
      return this.length === 0;
    }
  }
  