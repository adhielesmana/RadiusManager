import { Telnet } from 'telnet-client';

interface CommandTask {
  command: string;
  timeoutMs: number;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

export class TelnetSession {
  private connection: Telnet | null = null;
  private commandQueue: CommandTask[] = [];
  private processing = false;
  private connected = false;

  async connect(params: any): Promise<void> {
    this.connection = new Telnet();
    await this.connection.connect(params);
    this.connected = true;
  }

  async execute(command: string, timeoutMs: number = 6000): Promise<string> {
    if (!this.connected || !this.connection) {
      throw new Error('Telnet session not connected');
    }

    return new Promise<string>((resolve, reject) => {
      this.commandQueue.push({ command, timeoutMs, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.commandQueue.length > 0) {
      const task = this.commandQueue.shift()!;
      
      try {
        const result = await this.execCommand(task.command, task.timeoutMs);
        task.resolve(result);
      } catch (error: any) {
        task.reject(error);
      }
    }

    this.processing = false;
  }

  private async execCommand(command: string, timeoutMs: number): Promise<string> {
    if (!this.connection) {
      throw new Error('Connection not available');
    }

    return new Promise((resolve, reject) => {
      let buffer = '';
      let promptCount = 0;
      const promptPattern = /[A-Z0-9\-_]+[#>]\s*$/m;
      
      const socket = this.connection!.getSocket();
      if (!socket) {
        return reject(new Error('Socket not available'));
      }

      const dataHandler = (data: Buffer) => {
        const chunk = data.toString();
        buffer += chunk;
        
        // Check if we hit a prompt
        if (promptPattern.test(buffer)) {
          promptCount++;
          
          // First prompt is the leftover from previous command, skip it
          // Second prompt means command finished
          if (promptCount >= 2) {
            socket.removeListener('data', dataHandler);
            clearTimeout(timeout);
            
            // Extract output between prompts
            const lines = buffer.split('\n');
            const output = lines.slice(1, -1).join('\n').trim();
            resolve(output);
          }
        }
      };

      const timeout = setTimeout(() => {
        socket.removeListener('data', dataHandler);
        // Even if timeout, return what we got
        const lines = buffer.split('\n');
        const output = lines.slice(1, -1).join('\n').trim();
        resolve(output || buffer);
      }, timeoutMs);

      socket.on('data', dataHandler);
      
      // Send the command
      this.connection!.send(command + '\n').catch(reject);
    });
  }

  async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
      } catch (error) {
        // Ignore close errors
      }
      this.connection = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
