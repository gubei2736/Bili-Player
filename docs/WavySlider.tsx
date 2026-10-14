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
	cursorImage,
	primaryColor = '#00AEEC',
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const dragValueRef = useRef<number>(value)

	const phaseRef = useRef(0)
	const amplitudeRef = useRef(0)
	const targetAmplitude = isPlaying ? 3.5 : 0
	const animationFrameId = useRef<number | null>(null)

	const formatTime = (secs: number) => {
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

		// Smooth amplitude damping towards targetAmplitude
		amplitudeRef.current += (targetAmplitude - amplitudeRef.current) * 0.1
		if (isPlaying) {
			phaseRef.current += 0.08
		}

		const midY = height / 2
		const effectiveValue = isDragging ? dragValueRef.current : value
		const progressX = effectiveValue * width

		// 1. Draw Played Sine Wave (left of cursor)
		ctx.beginPath()
		ctx.lineWidth = 3 * dpr
		ctx.lineCap = 'round'
		ctx.strokeStyle = primaryColor

		const omega = 0.04 / dpr
		for (let x = 0; x <= progressX; x += 2) {
			const y =
				midY + amplitudeRef.current * dpr * Math.sin(omega * x + phaseRef.current)
			if (x === 0) {
				ctx.moveTo(x, y)
			} else {
				ctx.lineTo(x, y)
			}
		}
		ctx.stroke()

		// 2. Draw Unplayed Line (right of cursor)
		ctx.beginPath()
		ctx.lineWidth = 2 * dpr
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
		ctx.moveTo(progressX, midY)
		ctx.lineTo(width, midY)
		ctx.stroke()

		// 3. Draw Cursor handle
		const cursorY =
			midY +
			amplitudeRef.current * dpr * Math.sin(omega * progressX + phaseRef.current)

		ctx.beginPath()
		ctx.arc(progressX, cursorY, 6 * dpr, 0, Math.PI * 2)
		ctx.fillStyle = '#FFFFFF'
		ctx.shadowColor = primaryColor
		ctx.shadowBlur = 8 * dpr
		ctx.fill()
		ctx.shadowBlur = 0

		animationFrameId.current = requestAnimationFrame(render)
	}, [value, isPlaying, isDragging, targetAmplitude, primaryColor])

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

	const calculateValueFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

	return (
		<div className="w-full flex items-center gap-3 select-none">
			<span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
				{formatTime(value * duration)}
			</span>
			<div className="relative flex-1 h-6 flex items-center cursor-pointer group">
				<canvas
					ref={canvasRef}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={() => setHoverValue(null)}
					className="w-full h-full block"
				/>
			</div>
			<span className="text-[11px] font-mono text-muted-foreground w-10 text-left">
				{formatTime(duration)}
			</span>
		</div>
	)
}
