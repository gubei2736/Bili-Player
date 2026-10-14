export interface IKeyValueStorage {
	getString(key: string): string | null
	set(key: string, value: string): void
	delete(key: string): void
}

export class MemoryKeyValueStorage implements IKeyValueStorage {
	private readonly store = new Map<string, string>()

	getString(key: string): string | null {
		return this.store.get(key) ?? null
	}

	set(key: string, value: string): void {
		this.store.set(key, value)
	}

	delete(key: string): void {
		this.store.delete(key)
	}
}

let defaultStorage: IKeyValueStorage = new MemoryKeyValueStorage()

export function setDefaultStorage(storage: IKeyValueStorage): void {
	defaultStorage = storage
}

export function getDefaultStorage(): IKeyValueStorage {
	return defaultStorage
}
