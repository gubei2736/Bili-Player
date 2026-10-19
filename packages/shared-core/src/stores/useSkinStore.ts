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
	customBgType: 'image' | 'video' | null
	hasCustomBg: boolean
	customBgOpacity: number // 0.1 to 1.0 (default 0.5)
	customBgBlur: number // 0 to 40 px (default 0)
	customTextColor: string | null // e.g. '#FFFFFF', '#FDE047', or null for default
	uiBlur: number // 0 to 40 px (default 16) UI面板毛玻璃模糊度
	uiOpacity: number // 0.05 to 0.9 (default 0.35) UI面板遮罩暗度

	setSkin: (suit: BilibiliGarbSuitDetailResponse | null) => void
	clearSkin: () => void
	setCustomBg: (
		url: string | null,
		opacity?: number,
		blur?: number,
		bgType?: 'image' | 'video' | null,
	) => void
	clearCustomBg: () => void
	setTextColor: (color: string | null) => void
	setUiBlur: (blur: number) => void
	setUiOpacity: (opacity: number) => void
}

export const useSkinStore = create<SkinState>()(
	persist(
		(set) => ({
			activeSkinId: null,
			activeSkinSuit: null,
			themeColors: null,
			customBgUrl: null,
			customBgType: null,
			hasCustomBg: false,
			customBgOpacity: 0.5,
			customBgBlur: 0,
			customTextColor: null,
			uiBlur: 16,
			uiOpacity: 0.35,

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

			setCustomBg: (url, opacity = 0.5, blur = 0, bgType = 'image') => {
				set({
					customBgUrl: url,
					customBgType: url ? (bgType ?? 'image') : null,
					hasCustomBg: Boolean(url),
					customBgOpacity: opacity,
					customBgBlur: blur,
				})
			},

			clearCustomBg: () => {
				set({
					customBgUrl: null,
					customBgType: null,
					hasCustomBg: false,
					customBgOpacity: 0.5,
					customBgBlur: 0,
				})
			},

			setTextColor: (color) => {
				set({ customTextColor: color })
			},

			setUiBlur: (blur: number) => {
				set({ uiBlur: blur })
			},

			setUiOpacity: (opacity: number) => {
				set({ uiOpacity: opacity })
			},
		}),
		{
			name: 'bbplayer_skin_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			version: 4,
			migrate: (persistedState: any, version: number) => {
				if (version < 4 && persistedState) {
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
					if (persistedState.customBgUrl) {
						persistedState.hasCustomBg = true
						persistedState.customBgType = 'image'
					}
				}
				return persistedState as SkinState
			},
			partialize: (state) => ({
				activeSkinId: state.activeSkinId,
				activeSkinSuit: state.activeSkinSuit,
				themeColors: state.themeColors,
				hasCustomBg: state.hasCustomBg,
				customBgType: state.customBgType,
				customBgOpacity: state.customBgOpacity,
				customBgBlur: state.customBgBlur,
				customTextColor: state.customTextColor,
				uiBlur: state.uiBlur,
				uiOpacity: state.uiOpacity,
			}),
		},
	),
)
