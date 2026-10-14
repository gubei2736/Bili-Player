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
	const targetAmplitude = isPlaying ? 3.2 : 0
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

		amplitudeRef.current += (targetAmplitude - amplitudeRef.current) * 0.1
		if (isPlaying) {
			phaseRef.current += 0.075
		}

		const midY = height / 2
		const effectiveValue = isDragging ? dragValueRef.current : value
		const progressX = Math.max(0, Math.min(width, effectiveValue * width))

		// 1. Unplayed Track (right of cursor)
		ctx.beginPath()
		ctx.lineWidth = 2 * dpr
		ctx.lineCap = 'round'
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
		ctx.moveTo(progressX, midY)
		ctx.lineTo(width, midY)
		ctx.stroke()

		// Hover preview highlight on unplayed track
		if (hoverValue !== null) {
			const hoverX = hoverValue * width
			if (hoverX > progressX) {
				ctx.beginPath()
				ctx.lineWidth = 2 * dpr
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
				ctx.moveTo(progressX, midY)
				ctx.lineTo(hoverX, midY)
				ctx.stroke()
			}
		}

		// 2. Played Sine Wave (left of cursor) with glow
		ctx.save()
		ctx.beginPath()
		ctx.lineWidth = 2.8 * dpr
		ctx.lineCap = 'round'
		ctx.strokeStyle = primaryColor
		ctx.shadowColor = primaryColor
		ctx.shadowBlur = 6 * dpr

		const omega = 0.04 / dpr
		for (let x = 0; x <= progressX; x += 2) {
			const y =
				midY +
				amplitudeRef.current * dpr * Math.sin(omega * x + phaseRef.current)
			if (x === 0) {
				ctx.moveTo(x, y)
			} else {
				ctx.lineTo(x, y)
			}
		}
		ctx.stroke()
		ctx.restore()

		// 3. Cursor Handle
		const cursorY =
			midY +
			amplitudeRef.current *
				dpr *
				Math.sin(omega * progressX + phaseRef.current)

		const radius = (isDragging || hoverValue !== null ? 6.5 : 5) * dpr
		ctx.save()
		ctx.beginPath()
		ctx.arc(progressX, cursorY, radius, 0, Math.PI * 2)
		ctx.fillStyle = '#FFFFFF'
		ctx.shadowColor = primaryColor
		ctx.shadowBlur = 10 * dpr
		ctx.fill()
		ctx.restore()

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
			<span className="text-[10px] font-mono text-muted-foreground/80 w-9 text-right">
				{formatTime(displayValue * duration)}
			</span>
			<div className="relative flex-1 h-5 flex items-center cursor-pointer group">
				{/* Hover Time Tooltip */}
				{hoverValue !== null && duration > 0 && (
					<div
						className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#111827]/95 border border-white/15 text-[10px] font-mono text-white shadow-lg pointer-events-none z-20"
						style={{ left: `${hoverValue * 100}%` }}
					>
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
			<span className="text-[10px] font-mono text-muted-foreground/80 w-9 text-left">
				{formatTime(duration)}
			</span>
		</div>
	)
}