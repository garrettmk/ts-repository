
export class SubclassedError extends Error {
  constructor(message?: string) {
    super();
    this.name = this.constructor.name;
    this.message = message ? `${this.name}: ${message}` : this.name;

    // @ts-ignore
    if (typeof Error.captureStackTrace === 'function') {
      // @ts-ignore
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}


export class NotImplementedError extends SubclassedError {};
export class NotFoundError extends SubclassedError {};
export class AlreadyExistsError extends SubclassedError {};

export class ValidationError extends SubclassedError {
  public path: string[];
  public expected: string | string[];
  public recieved: any;

  constructor(message: string, path: string[], expected: string | string[], recieved: any) {
    super(message);
    this.path = path;
    this.expected = expected;
    this.recieved = recieved;
  }
};

