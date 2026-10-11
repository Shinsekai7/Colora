export type Listener<T> = (payload: T) => void;

export interface Emitter<Events> {
    /** Adds a listener, returns a function to remove it again. */
    on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void;
    off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void;
    emit<K extends keyof Events>(type: K, payload: Events[K]): void;
    clear(): void;
}

/**
 * Like DOM events, an exception in one listener doesn't prevent the others
 * from running, nor does it break the action that caused it. It's reported instead.
 */
export function callSafely<T>(listener: Listener<T>, payload: T): void {
    try {
        listener(payload);
    } catch (error) {
        if (typeof globalThis.reportError === 'function') {
            globalThis.reportError(error);
        } else {
            queueMicrotask(() => {
                throw error;
            });
        }
    }
}

export function createEmitter<Events>(): Emitter<Events> {
    const listeners = new Map<keyof Events, Set<Listener<never>>>();

    const off: Emitter<Events>['off'] = (type, listener) => {
        listeners.get(type)?.delete(listener);
    };

    return {
        off,

        on(type, listener) {
            let set = listeners.get(type);

            if (!set) {
                listeners.set(type, (set = new Set()));
            }

            set.add(listener);
            return () => off(type, listener);
        },

        emit(type, payload) {
            // Copy so listeners can add or remove listeners while being called
            for (const listener of [...(listeners.get(type) ?? [])] as Listener<typeof payload>[]) {
                callSafely(listener, payload);
            }
        },

        clear() {
            listeners.clear();
        }
    };
}
