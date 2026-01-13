/**
 * LpcHost - Local Procedure Call Host for Markwhen Timeline communication
 *
 * This class manages bidirectional postMessage communication between
 * the Obsidian plugin (host) and the Markwhen Timeline Vue app (iframe).
 */

import {
  AppState,
  MarkwhenState,
  LpcMessage,
  EditEventDateRangeMessage,
  NewEventMessage,
  EventPath,
  DateRangeIso,
} from '../types/markwhen';

/**
 * Callback types for handling messages from the Timeline
 */
export interface LpcCallbacks {
  onEditEventDateRange?: (params: EditEventDateRangeMessage) => void;
  onNewEvent?: (params: NewEventMessage) => void;
  onSetHoveringPath?: (path: EventPath) => void;
  onSetDetailPath?: (path: EventPath) => void;
  onShowInEditor?: (path: EventPath) => void;
  // State providers - called when Timeline requests current state
  getMarkwhenState?: () => MarkwhenState | null;
  getAppState?: () => AppState | null;
}

/**
 * Generate a unique nonce for message IDs
 */
function getNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * LPC Host class for managing iframe communication
 */
export class LpcHost {
  private iframe: HTMLIFrameElement | null = null;
  private callbacks: LpcCallbacks;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private pendingRequests: Map<string, (response: unknown) => void> = new Map();

  constructor(callbacks: LpcCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to an iframe and start listening for messages
   */
  connect(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;

    // Set up message listener
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe = null;
    this.pendingRequests.clear();
  }

  /**
   * Handle incoming messages from the iframe
   */
  private handleMessage(event: MessageEvent): void {
    // Verify the message is from our iframe
    if (!this.iframe || event.source !== this.iframe.contentWindow) {
      return;
    }

    const message = event.data as LpcMessage;
    if (!message || !message.type) {
      return;
    }

    // Handle response to our request
    if (message.response && message.id) {
      const resolver = this.pendingRequests.get(message.id);
      if (resolver) {
        resolver(message.params);
        this.pendingRequests.delete(message.id);
      }
      return;
    }

    // Handle request from Timeline
    if (message.request) {
      this.handleRequest(message);
    }
  }

  /**
   * Handle a request message from the Timeline
   */
  private handleRequest(message: LpcMessage): void {
    switch (message.type) {
      case 'editEventDateRange':
        if (this.callbacks.onEditEventDateRange && message.params) {
          this.callbacks.onEditEventDateRange(message.params as EditEventDateRangeMessage);
        }
        break;

      case 'newEvent':
        if (this.callbacks.onNewEvent && message.params) {
          this.callbacks.onNewEvent(message.params as NewEventMessage);
        }
        break;

      case 'setHoveringPath':
        if (this.callbacks.onSetHoveringPath && message.params) {
          this.callbacks.onSetHoveringPath(message.params as EventPath);
        }
        break;

      case 'setDetailPath':
        if (this.callbacks.onSetDetailPath && message.params) {
          this.callbacks.onSetDetailPath(message.params as EventPath);
        }
        break;

      case 'showInEditor':
        if (this.callbacks.onShowInEditor && message.params) {
          this.callbacks.onShowInEditor(message.params as EventPath);
        }
        break;

      case 'markwhenState':
        // Timeline is requesting current state
        if (this.callbacks.getMarkwhenState) {
          const state = this.callbacks.getMarkwhenState();
          this.sendResponse(message.id, message.type, state ? this.serialize(state) : null);
        } else {
          this.sendResponse(message.id, message.type, null);
        }
        break;

      case 'appState':
        // Timeline is requesting app state
        if (this.callbacks.getAppState) {
          const state = this.callbacks.getAppState();
          this.sendResponse(message.id, message.type, state ? this.serialize(state) : null);
        } else {
          this.sendResponse(message.id, message.type, null);
        }
        break;

      default:
        // Unknown message types are silently ignored
        break;
    }
  }

  /**
   * Send a response to a request
   */
  private sendResponse(id: string, type: string, params: unknown): void {
    if (!this.iframe?.contentWindow) return;

    const message: LpcMessage = {
      type,
      response: true,
      id,
      params: params,
    };

    this.iframe.contentWindow.postMessage(message, '*');
  }

  /**
   * Post a request to the Timeline and wait for response
   */
  postRequest<T>(type: string, params?: unknown): Promise<T> {
    return new Promise((resolve) => {
      if (!this.iframe?.contentWindow) {
        resolve(undefined as T);
        return;
      }

      const id = `markwhen_${getNonce()}`;

      // Store resolver for when we get the response
      this.pendingRequests.set(id, resolve as (response: unknown) => void);

      const message: LpcMessage = {
        type,
        request: true,
        id,
        params: params,
      };

      this.iframe.contentWindow.postMessage(message, '*');

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve(undefined as T);
        }
      }, 5000);
    });
  }

  /**
   * Serialize data for postMessage (strips functions and non-serializable data)
   */
  private serialize<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * Send Markwhen state to the Timeline
   * State updates are sent as requests so the Timeline's listener is called
   */
  sendMarkwhenState(state: MarkwhenState): void {
    if (!this.iframe?.contentWindow) return;

    // Serialize to strip any functions or non-serializable data
    const serializedState = this.serialize(state);

    // Send as a request - the Timeline's useLpc listeners are called on requests
    const message: LpcMessage<MarkwhenState> = {
      type: 'markwhenState',
      request: true,
      id: `markwhen_${getNonce()}`,
      params: serializedState,
    };

    this.iframe.contentWindow.postMessage(message, '*');
  }

  /**
   * Send app state to the Timeline
   * State updates are sent as requests so the Timeline's listener is called
   */
  sendAppState(state: AppState): void {
    if (!this.iframe?.contentWindow) return;

    // Serialize to strip any functions or non-serializable data
    const serializedState = this.serialize(state);

    // Send as a request - the Timeline's useLpc listeners are called on requests
    const message: LpcMessage<AppState> = {
      type: 'appState',
      request: true,
      id: `markwhen_${getNonce()}`,
      params: serializedState,
    };

    this.iframe.contentWindow.postMessage(message, '*');
  }

  /**
   * Send both markwhenState and appState
   */
  sendState(markwhenState: MarkwhenState, appState: AppState): void {
    this.sendMarkwhenState(markwhenState);
    this.sendAppState(appState);
  }

  /**
   * Request the Timeline to jump to a specific path
   */
  jumpToPath(path: EventPath): void {
    void this.postRequest('jumpToPath', { path });
  }

  /**
   * Request the Timeline to jump to a date range
   */
  jumpToRange(dateRangeIso: DateRangeIso): void {
    void this.postRequest('jumpToRange', { dateRangeIso });
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: LpcCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}
