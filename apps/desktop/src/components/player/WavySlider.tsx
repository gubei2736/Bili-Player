import React, { useRef, useEffect, useState, useCallback } from 'react'

export interface WavySliderProps {
	value: number // 0 to 1
	duration: number // seconds
	isPlaying: boolean
	onChange?: (value: number) => void
	cursorImage?: string | null
	primaryColor?: string
}

export const WavySlider: React.FC<WavySliderProps> = ({
	value,
	duration,
	isPlaying,
	onChange,
	primaryColor = '#00AEEC',
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const dragValueRef = useRef<number>(value)

	const phaseRef = useRef(0)
	const amplitudeRef = useRef(0)
	// Android 13 Squiggle 标准：6.5px 真实振幅，波峰波谷错落起伏
	const targetAmplitude = isPlaying ? 6.5 : 0
	const animationFrameId = useRef<number | null>(null)

	const formatTime = (secs: number) => {
		if (!isFinite(secs) || secs < 0) return '0:00'
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	const render = useCallback(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const width = canvas.width
		const height = canvas.height
		const dpr = window.devicePixelRatio || 1

		ctx.clearRect(0, 0, width, height)

		// 振幅平滑插值过渡（播放与暂停时在直线与波浪之间柔和形变）
		amplitudeRef.current += (targetAmplitude - amplitudeRef.current) * 0.12
		if (isPlaying) {
			// 波形向右平滑流动
			phaseRef.current += 0.08
		}

		const midY = height / 2
		const effectiveValue = isDragging ? dragValueRef.current : value
		const progressX = Math.max(0, Math.min(width, effectiveValue * width))

		// 1. 未播放背景轨道（游标右侧）
		ctx.beginPath()
		ctx.lineWidth = 3.5 * dpr
		ctx.lineCap = 'round'
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
		ctx.moveTo(progressX, midY)
		ctx.lineTo(width, midY)
		ctx.stroke()

		// 悬停预览高亮轨道
		if (hoverValue !== null) {
			const hoverX = Math.max(0, Math.min(width, hoverValue * width))
			if (hoverX > progressX) {
				ctx.beginPath()
				ctx.lineWidth = 3.5 * dpr
				ctx.lineCap = 'round'
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)'
				ctx.moveTo(progressX, midY)
				ctx.lineTo(hoverX, midY)
				ctx.stroke()
			}
		}

		// 2. 已播放流光波浪（游标左侧）
		if (progressX > 0) {
			ctx.save()
			ctx.beginPath()
			ctx.lineWidth = 3.6 * dpr
			ctx.lineCap = 'round'
			ctx.lineJoin = 'round'

			// 水平流光多色高光渐变
			const gradient = ctx.createLinearGradient(0, 0, Math.max(1, progressX), 0)
			gradient.addColorStop(0, primaryColor)
			gradient.addColorStop(0.65, '#38bdf8') // 湖水青蓝高光
			gradient.addColorStop(1, '#f472b6')   // 渐变粉紫波梢

			ctx.strokeStyle = gradient
			ctx.shadowColor = primaryColor
			ctx.shadowBlur = 8 * dpr

			// Android 13 灵动波长：约 26px 一个完整波峰，保证密集生动的涟漪视觉
			const waveLength = 26 * dpr
			const omega = (Math.PI * 2) / waveLength

			// 两端包络阻尼：起点与游标处平滑归零至 midY，消除生硬折角断层
			const headDampDist = 18 * dpr
			const tailDampDist = 22 * dpr

			for (let x = 0; x <= progressX; x += 1.5 * dpr) {
				let envelope = 1.0
				if (x < headDampDist) {
					envelope = Math.sin((x / headDampDist) * (Math.PI / 2))
				}
				const distToEnd = progressX - x
				if (distToEnd < tailDampDist) {
					envelope *= Math.sin((distToEnd / tailDampDist) * (Math.PI / 2))
				}

				const y =
					midY +
					amplitudeRef.current * dpr * envelope * Math.sin(omega * x - phaseRef.current)

				if (x === 0) {
					ctx.moveTo(x, y)
				} else {
					ctx.lineTo(x, y)
				}
			}
			ctx.lineTo(progressX, midY)
			ctx.stroke()
			ctx.restore()
		}

		// 3. 游标控制手柄（缩小并仅在悬停或拖拽时显现）
		if (isDragging || hoverValue !== null) {
			const thumbRadius = 4.5 * dpr
			ctx.save()
			ctx.beginPath()
			ctx.arc(progressX, midY, thumbRadius, 0, Math.PI * 2)
			ctx.fillStyle = '#FFFFFF'
			ctx.shadowColor = primaryColor
			ctx.shadowBlur = 8 * dpr
			ctx.fill()

			ctx.beginPath()
			ctx.arc(progressX, midY, 1.8 * dpr, 0, Math.PI * 2)
			ctx.fillStyle = primaryColor
			ctx.fill()
			ctx.restore()
		}

		animationFrameId.current = requestAnimationFrame(render)
	}, [value, isPlaying, isDragging, hoverValue, targetAmplitude, primaryColor])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const updateCanvasSize = () => {
			const rect = canvas.getBoundingClientRect()
			const dpr = window.devicePixelRatio || 1
			canvas.width = rect.width * dpr
			canvas.height = rect.height * dpr
		}

		updateCanvasSize()
		window.addEventListener('resize', updateCanvasSize)
		animationFrameId.current = requestAnimationFrame(render)

		return () => {
			window.removeEventListener('resize', updateCanvasSize)
			if (animationFrameId.current) {
				cancelAnimationFrame(animationFrameId.current)
			}
		}
	}, [render])

	const calculateValueFromPointer = (
		e: React.PointerEvent<HTMLCanvasElement>,
	) => {
		const canvas = canvasRef.current
		if (!canvas) return 0
		const rect = canvas.getBoundingClientRect()
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
		return x / rect.width
	}

	const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId)
		setIsDragging(true)
		const val = calculateValueFromPointer(e)
		dragValueRef.current = val
	}

	const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const val = calculateValueFromPointer(e)
		setHoverValue(val)
		if (isDragging) {
			dragValueRef.current = val
		}
	}

	const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (isDragging) {
			const val = calculateValueFromPointer(e)
			setIsDragging(false)
			if (onChange) {
				onChange(val)
			}
		}
		e.currentTarget.releasePointerCapture(e.pointerId)
	}

	const displayValue = isDragging ? dragValueRef.current : value

	return (
		<div className="w-full flex items-center gap-3 select-none">
			<span className="text-[10px] font-mono text-muted-foreground/80 w-9 text-right font-medium">
				{formatTime(displayValue * duration)}
			</span>
			<div className="relative flex-1 h-7 flex items-center cursor-pointer group">
				{/* 悬停时间气泡胶囊 */}
				{hoverValue !== null && duration > 0 && (
					<div
						className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#0d1322]/95 border border-white/20 text-[10px] font-mono font-semibold text-white shadow-xl pointer-events-none z-30 flex items-center gap-1 backdrop-blur-md transition-opacity"
						style={{ left: `${Math.max(2, Math.min(98, hoverValue * 100))}%` }}
					>
						<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
						{formatTime(hoverValue * duration)}
					</div>
				)}
				<canvas
					ref={canvasRef}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={() => setHoverValue(null)}
					className="w-full h-full block"
				/>
			</div>
			<span className="text-[10px] font-mono text-muted-foreground/80 w-9 text-left font-medium">
				{formatTime(duration)}
			</span>
		</div>
	)
}