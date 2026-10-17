import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
	getDefaultCookieProvider,
	parseCookieToObject,
} from '../api/cookie'
import { bilibiliApi } from '../api/bilibili/api'
import type { BilibiliUserInfo } from '../types/bilibili'
import { getDefaultStateStorage } from './storage'

export interface AuthState {
	isLoggedIn: boolean
	userInfo: BilibiliUserInfo | null
	bilibiliCookie: Record<string, string> | null
	isLoading: boolean
	error: string | null

	setCookie: (cookie: Record<string, string> | string) => void
	setUserInfo: (user: BilibiliUserInfo | null) => void
	fetchUserInfo: () => Promise<void>
	logout: () => void
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			isLoggedIn: false,
			userInfo: null,
			bilibiliCookie: null,
			isLoading: false,
			error: null,

			setCookie: (cookieInput) => {
				let cookieMap: Record<string, string>
				if (typeof cookieInput === 'string') {
					const parsed = parseCookieToObject(cookieInput)
					cookieMap = parsed.isOk() ? parsed.value : {}
				} else {
					cookieMap = cookieInput
				}

				set({
					bilibiliCookie: cookieMap,
					isLoggedIn:
						Object.keys(cookieMap).length > 0 &&
						!!(cookieMap.bili_jct || cookieMap.SESSDATA),
				})

				const provider = getDefaultCookieProvider()
				if (provider.setCookie) {
					provider.setCookie(cookieMap)
				}
			},

			setUserInfo: (userInfo) => {
				set({ userInfo, isLoggedIn: !!userInfo })
			},

			fetchUserInfo: async () => {
				set({ isLoading: true, error: null })
				const res = await bilibiliApi.getUserInfo()
				if (res.isOk()) {
					set({
						userInfo: res.value,
						isLoggedIn: true,
						isLoading: false,
					})
					return
				}

				// Fallback to /x/web-interface/nav if myinfo failed
				try {
					const navRes = await bilibiliApi.getUserNavInfo()
					if (navRes.isOk() && navRes.value.isLogin) {
						set({
							userInfo: {
								mid: navRes.value.mid,
								name: navRes.value.uname,
								face: navRes.value.face,
								sign: '',
							},
							isLoggedIn: true,
							isLoading: false,
						})
						return
					}
				} catch {}

				set({
					isLoading: false,
					error: res.error.message,
				})
			},

			logout: () => {
				set({
					isLoggedIn: false,
					userInfo: null,
					bilibiliCookie: null,
					error: null,
				})
				const provider = getDefaultCookieProvider()
				if (provider.setCookie) {
					provider.setCookie({})
				}
			},
		}),
		{
			name: 'bbplayer_auth_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				isLoggedIn: state.isLoggedIn,
				userInfo: state.userInfo,
				bilibiliCookie: state.bilibiliCookie,
			}),
			onRehydrateStorage: () => (state) => {
				if (state?.bilibiliCookie) {
					const provider = getDefaultCookieProvider()
					if (provider.setCookie) {
						provider.setCookie(state.bilibiliCookie)
					}
				}
			},
		},
	),
)
