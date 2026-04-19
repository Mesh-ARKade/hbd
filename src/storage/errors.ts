/**
 * Custom error classes for HBD storage operations
 */

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class StorageNotOpenedError extends Error {
  constructor(message: string = "Store not opened") {
    super(message);
    this.name = "StorageNotOpenedError";
  }
}

export class StorageOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageOperationError";
  }
}