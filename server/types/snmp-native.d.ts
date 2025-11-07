declare module 'snmp-native' {
  export class Session {
    constructor(options?: { timeout?: number; retries?: number });
    
    get(options: {
      host: string;
      port?: number;
      community?: string;
      oid: string;
    }, callback: (error: any, varbinds: any[]) => void): void;
    
    getSubtree(options: {
      host: string;
      port?: number;
      community?: string;
      oid: string;
    }, callback: (error: any, varbinds: any[]) => void): void;
    
    close(): void;
  }
  
  export function createReceiver(): any;
}
