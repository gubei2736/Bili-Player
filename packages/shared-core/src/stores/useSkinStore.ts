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

	setSkin: (suit: BilibiliGarbSuitDetailResponse | null) => void
	clearSkin: () => void
}

export const useSkinStore = create<SkinState>()(
	persist(
		(set) => ({
			activeSkinId: null,
			activeSkinSuit: null,
			themeColors: null,

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
		}),
		{
			name: 'bbplayer_skin_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				activeSkinId: state.activeSkinId,
				activeSkinSuit: state.activeSkinSuit,
				themeColors: state.themeColors,
			}),
		},
	),
)
