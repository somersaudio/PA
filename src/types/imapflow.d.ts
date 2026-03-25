declare module "imapflow" {
  export class ImapFlow {
    constructor(config: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
      logger: boolean | object;
    });
    connect(): Promise<void>;
    logout(): Promise<void>;
    getMailboxLock(mailbox: string): Promise<{ release: () => void }>;
    idle(): Promise<void>;
    fetch(
      range: string | { uid: number },
      query: { source?: boolean; envelope?: boolean; uid?: boolean; bodyStructure?: boolean }
    ): AsyncIterable<{
      uid: number;
      envelope: {
        from: Array<{ name: string; address: string }>;
        to: Array<{ name: string; address: string }>;
        subject: string;
        date: Date;
        messageId: string;
      };
      source: Buffer;
    }>;
    download(uid: string, part?: string, options?: { uid: boolean }): Promise<{ content: NodeJS.ReadableStream }>;
    search(query: object, options?: { uid: boolean }): Promise<number[]>;
    messageFlagsAdd(uid: number | number[], flags: string[], options?: { uid: boolean }): Promise<void>;
    on(event: string, callback: (...args: unknown[]) => void): void;
    usable: boolean;
  }
}
