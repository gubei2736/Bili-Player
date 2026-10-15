import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, RefreshCw, CheckCircle2 } from 'lucide-react'
import QRCode from 'qrcode'
import {
	bilibiliApi,
	useAuthStore,
	BilibiliQrCodeLoginStatus,
} from '@bbplayer/shared-core'

import { loginQrService } from '../../services/loginQrService'

export interface LoginModalProps {
	isOpen: boolean
	onClose: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
	const { setCookie, fetchUserInfo } = useAuthStore()

	const [qrDataUrl, setQrDataUrl] = useState('')
	const [qrcodeKey, setQrcodeKey] = useState('')
	const [statusText, setStatusText] = useState('请使用哔哩哔哩客户端扫码登录')
	const [isSuccess, setIsSuccess] = useState(false)
	const [isLoading, setIsLoading] = useState(false)

	const onCloseRef = useRef(onClose)
	onCloseRef.current = onClose
	const isPollingRef = useRef(false)

	const loadQrCode = useCallback(async (forceRefresh = false) => {
		if (!forceRefresh) {
			const cached = loginQrService.getValidCached()
			if (cached) {
				setQrcodeKey(cached.qrcodeKey)
				setQrDataUrl(cached.dataUrl)
				setStatusText('请使用哔哩哔哩移动端扫码登录')
				setIsLoading(false)
				return
			}
		}

		setIsLoading(true)
		setIsSuccess(false)
		setQrcodeKey('')
		setStatusText('正在生成二维码...')

		if (forceRefresh) {
			loginQrService.clearCache()
		}

		const res = await loginQrService.fetchNewQrCode()
		setIsLoading(false)

		if (res && res.qrcodeKey && res.dataUrl) {
			setQrcodeKey(res.qrcodeKey)
			setQrDataUrl(res.dataUrl)
			setStatusText('请使用哔哩哔哩移动端扫码登录')
		} else {
			setStatusText('获取二维码失败，请点击刷新重试')
		}
	}, [])

	useEffect(() => {
		if (isOpen) {
			loadQrCode(false)
		} else {
			setQrcodeKey('')
			setIsSuccess(false)
		}
	}, [isOpen, loadQrCode])

	useEffect(() => {
		if (!qrcodeKey || !isOpen || isSuccess) return

		let cancelled = false
		const timer = setInterval(async () => {
			if (isPollingRef.current || cancelled) return
			isPollingRef.current = true

			try {
				const res = await bilibiliApi.pollQrCodeLoginStatus({ qrcodeKey })
				if (cancelled) return

				if (res.isOk()) {
					const { status, cookies } = res.value
					if (status === BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_WAIT) {
						setStatusText('等待扫码...')
					} else if (
						status ===
						BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_SCANNED_BUT_NOT_CONFIRMED
					) {
						setStatusText('已扫码，请在手机上点击确认')
					} else if (
						status === BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_SUCCESS
					) {
						cancelled = true
						clearInterval(timer)
						setIsSuccess(true)
						setStatusText('登录成功，正在同步账号数据...')
						setCookie(cookies)

						try {
							await fetchUserInfo()
						} catch (e) {
							console.warn('fetchUserInfo note:', e)
						}
						setTimeout(() => {
							onCloseRef.current()
						}, 800)
					} else if (
						status === BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_QRCODE_EXPIRED
					) {
						cancelled = true
						clearInterval(timer)
						setStatusText('二维码已过期，请点击刷新')
					}
				}
			} finally {
				isPollingRef.current = false
			}
		}, 1500)

		return () => {
			cancelled = true
			clearInterval(timer)
		}
	}, [qrcodeKey, isOpen, isSuccess, setCookie, fetchUserInfo])

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
			<div className="relative w-80 p-6 rounded-2xl bg-card/95 border border-white/10 shadow-2xl flex flex-col items-center">
				<button
					onClick={onClose}
					className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground"
				>
					<X className="w-4 h-4" />
				</button>

				<h3 className="text-sm font-bold text-foreground mb-4">
					扫码登录哔哩哔哩
				</h3>

				<div className="w-48 h-48 rounded-xl bg-white p-2 flex items-center justify-center shadow-inner relative overflow-hidden">
					{isSuccess ? (
						<div className="flex flex-col items-center gap-2 text-emerald-500">
							<CheckCircle2 className="w-12 h-12" />
							<span className="text-xs font-semibold">登录成功</span>
						</div>
					) : qrDataUrl ? (
						<img
							src={qrDataUrl}
							alt="Bilibili Login QR"
							className="w-full h-full object-contain"
						/>
					) : (
						<span className="text-xs text-muted-foreground">加载中...</span>
					)}
				</div>

				<p className="mt-4 text-xs text-muted-foreground text-center">
					{statusText}
				</p>

				{!isSuccess && (
					<button
						onClick={() => loadQrCode(true)}
						disabled={isLoading}
						className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
					>
						<RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
						<span>刷新二维码</span>
					</button>
				)}
			</div>
		</div>
	)
}
