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
	customBgOpacity: number // 0.1 to 1.0 (default 0.35)
	customBgBlur: number // 0 to 40 px (default 0)

	setSkin: (suit: BilibiliGarbSuitDetailResponse | null) => void
	clearSkin: () => void
	setCustomBg: (url: string | null, opacity?: number, blur?: number) => void
	clearCustomBg: () => void
}

export const useSkinStore = create<SkinState>()(
	persist(
		(set) => ({
			activeSkinId: null,
			activeSkinSuit: null,
			themeColors: null,
			customBgUrl: null,
			customBgOpacity: 0.35,
			customBgBlur: 0,

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

			setCustomBg: (url, opacity = 0.35, blur = 0) => {
				set({
					customBgUrl: url,
					customBgOpacity: opacity,
					customBgBlur: blur,
				})
			},

			clearCustomBg: () => {
				set({
					customBgUrl: null,
					customBgOpacity: 0.35,
					customBgBlur: 0,
				})
			},
		}),
		{
			name: 'bbplayer_skin_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				activeSkinId: state.activeSkinId,
				activeSkinSuit: state.activeSkinSuit,
				themeColors: state.themeColors,
				customBgUrl: state.customBgUrl,
				customBgOpacity: state.customBgOpacity,
				customBgBlur: state.customBgBlur,
			}),
		},
	),
)
