export interface StateStorage {
	getItem: (name: string) => string | null | Promise<string | null>
	setItem: (name: string, value: string) => void | Promise<void>
	removeItem: (name: string) => void | Promise<void>
}

export class MemoryStateStorage implements StateStorage {
	private readonly store = new Map<string, string>()

	getItem(name: string): string | null {
		return this.store.get(name) ?? null
	}

	setItem(name: string, value: string): void {
		this.store.set(name, value)
	}

	removeItem(name: string): void {
		this.store.delete(name)
	}
}

let defaultStateStorage: StateStorage = new MemoryStateStorage()

export function setDefaultStateStorage(storage: StateStorage): void {
	defaultStateStorage = storage
}

export function getDefaultStateStorage(): StateStorage {
	return defaultStateStorage
}
