import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type {
	BilibiliGarbColor,
	BilibiliGarbSuitDetailResponse,
} from '../types/garb'
import { getDefaultStateStorage } from './storage'

export interface SkinState {
	activeSkinId: number | null
	activeSkinSuit: BilibiliGarbSuitDetailResponse | null
	themeColors: BilibiliGarbColor | null
	customBgUrl: string | null
	customBgOpacity: number // 0.1 to 1.0 (default 0.5)
	customBgBlur: number // 0 to 40 px (default 0)
	customTextColor: string | null // e.g. '#FFFFFF', '#FDE047', or null for default

	setSkin: (suit: BilibiliGarbSuitDetailResponse | null) => void
	clearSkin: () => void
	setCustomBg: (url: string | null, opacity?: number, blur?: number) => void
	clearCustomBg: () => void
	setTextColor: (color: string | null) => void
}

export const useSkinStore = create<SkinState>()(
	persist(
		(set) => ({
			activeSkinId: null,
			activeSkinSuit: null,
			themeColors: null,
			customBgUrl: null,
			customBgOpacity: 0.5,
			customBgBlur: 0,
			customTextColor: null,

			setSkin: (suit) => {
				if (!suit) {
					set({
						activeSkinId: null,
						activeSkinSuit: null,
						themeColors: null,
					})
					return
				}

				let colors: BilibiliGarbColor | null = null
				const skinItems = suit.suit_items?.skin
				if (skinItems && skinItems.length > 0) {
					const skinProps = skinItems[0]?.properties
					if (skinProps?.color) {
						colors = {
							color: skinProps.color,
							color_mode: skinProps.color_mode ?? 'light',
							color_second_page: skinProps.color_second_page ?? skinProps.color,
							tail_color: skinProps.tail_color ?? skinProps.color,
							tail_color_selected:
								skinProps.tail_color_selected ?? skinProps.color,
						}
					}
				}

				set({
					activeSkinId: suit.item_id,
					activeSkinSuit: suit,
					themeColors: colors,
				})
			},

			clearSkin: () => {
				set({
					activeSkinId: null,
					activeSkinSuit: null,
					themeColors: null,
				})
			},

			setCustomBg: (url, opacity = 0.5, blur = 0) => {
				set({
					customBgUrl: url,
					customBgOpacity: opacity,
					customBgBlur: blur,
				})
			},

			clearCustomBg: () => {
				set({
					customBgUrl: null,
					customBgOpacity: 0.5,
					customBgBlur: 0,
				})
			},

			setTextColor: (color) => {
				set({ customTextColor: color })
			},
		}),
		{
			name: 'bbplayer_skin_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			version: 3,
			migrate: (persistedState: any, version: number) => {
				if (version < 3 && persistedState) {
					if (
						persistedState.customBgOpacity === 0.35 ||
						persistedState.customBgOpacity === 1.0 ||
						persistedState.customBgOpacity === undefined
					) {
						persistedState.customBgOpacity = 0.5
					}
					if (persistedState.customBgBlur === undefined) {
						persistedState.customBgBlur = 0
					}
					if (persistedState.customTextColor === undefined) {
						persistedState.customTextColor = null
					}
				}
				return persistedState as SkinState
			},
			partialize: (state) => ({
				activeSkinId: state.activeSkinId,
				activeSkinSuit: state.activeSkinSuit,
				themeColors: state.themeColors,
				customBgUrl: state.customBgUrl,
				customBgOpacity: state.customBgOpacity,
				customBgBlur: state.customBgBlur,
				customTextColor: state.customTextColor,
			}),
		},
	),
)
