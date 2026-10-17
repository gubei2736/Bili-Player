import { invoke } from '@tauri-apps/api/core'

/**
 * Open external URL in system default web browser
 */
export async function openExternalUrl(url: string): Promise<void> {
	if (!url) return
	try {
		await invoke('open_external_url', { url })
	} catch (e) {
		console.warn('Failed to invoke open_external_url, falling back to window.open:', e)
		window.open(url, '_blank')
	}
}
