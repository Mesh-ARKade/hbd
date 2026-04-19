/**
 * Custom error classes for HBD P2P operations
 */

export class P2PError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "P2PError";
  }
}

export class P2PNotOpenedError extends Error {
  constructor(message: string = "Peer not opened") {
    super(message);
    this.name = "P2PNotOpenedError";
  }
}

export class P2PNoPeersError extends Error {
  constructor(message: string = "No peers connected for replication") {
    super(message);
    this.name = "P2PNoPeersError";
  }
}

export class P2PNoStoreError extends Error {
  constructor(message: string = "No store attached for replication") {
    super(message);
    this.name = "P2PNoStoreError";
  }
}

export class P2PConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "P2PConnectionError";
  }
}