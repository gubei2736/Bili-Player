import React, { useRef, useEffect } from 'react'

export interface FluidBackgroundProps {
	coverUrl?: string | null
	colors?: string[] // Optional array of 4 hex/rgb colors
	className?: string
}

export const FluidBackground: React.FC<FluidBackgroundProps> = ({
	coverUrl,
	colors = ['#FF2E93', '#00AEEC', '#7B2CBF', '#FFB703'],
	className = '',
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const animationFrameRef = useRef<number | null>(null)
	const timeRef = useRef(0)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const DOWNSCALE = 0.25
		let width = (canvas.width = Math.max(320, Math.round((canvas.offsetWidth || window.innerWidth) * DOWNSCALE)))
		let height = (canvas.height = Math.max(180, Math.round((canvas.offsetHeight || window.innerHeight) * DOWNSCALE)))

		const handleResize = () => {
			if (!canvas) return
			width = canvas.width = Math.max(320, Math.round((canvas.offsetWidth || window.innerWidth) * DOWNSCALE))
			height = canvas.height = Math.max(180, Math.round((canvas.offsetHeight || window.innerHeight) * DOWNSCALE))
		}

		window.addEventListener('resize', handleResize)

		let lastRenderTime = 0
		// 4 fluid orb centers oscillating on low-frequency sine paths
		const render = (timestamp: number) => {
			if (document.hidden) {
				animationFrameRef.current = requestAnimationFrame(render)
				return
			}

			// ⚡ 性能优化：限制流体背景为 30FPS，在 180Hz/240Hz 高刷屏下压降 80% 以上 GPU 算力
			if (timestamp - lastRenderTime >= 33) {
				lastRenderTime = timestamp
				timeRef.current += 0.008
				const t = timeRef.current

				ctx.clearRect(0, 0, width, height)

				// Base dark background
				ctx.fillStyle = '#0a0a0f'
				ctx.fillRect(0, 0, width, height)

				const orbs = [
					{
						x: width * 0.3 + Math.sin(t * 0.8) * (width * 0.2),
						y: height * 0.35 + Math.cos(t * 0.7) * (height * 0.18),
						r: Math.min(width, height) * 0.45,
						color: colors[0] || '#FF2E93',
					},
					{
						x: width * 0.7 + Math.cos(t * 0.9) * (width * 0.22),
						y: height * 0.4 + Math.sin(t * 0.6) * (height * 0.2),
						r: Math.min(width, height) * 0.5,
						color: colors[1] || '#00AEEC',
					},
					{
						x: width * 0.4 + Math.sin(t * 0.5 + 2) * (width * 0.25),
						y: height * 0.7 + Math.cos(t * 0.8 + 1) * (height * 0.15),
						r: Math.min(width, height) * 0.42,
						color: colors[2] || '#7B2CBF',
					},
					{
						x: width * 0.65 + Math.cos(t * 0.7 + 3) * (width * 0.18),
						y: height * 0.65 + Math.sin(t * 0.6 + 2) * (height * 0.18),
						r: Math.min(width, height) * 0.48,
						color: colors[3] || '#FFB703',
					},
				]

				ctx.globalCompositeOperation = 'screen'

				for (const orb of orbs) {
					const grad = ctx.createRadialGradient(
						orb.x,
						orb.y,
						orb.r * 0.05,
						orb.x,
						orb.y,
						orb.r,
					)
					grad.addColorStop(0, orb.color + 'aa')
					grad.addColorStop(0.5, orb.color + '44')
					grad.addColorStop(1, orb.color + '00')

					ctx.fillStyle = grad
					ctx.beginPath()
					ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2)
					ctx.fill()
				}

				ctx.globalCompositeOperation = 'source-over'
			}

			animationFrameRef.current = requestAnimationFrame(render)
		}

		animationFrameRef.current = requestAnimationFrame(render)

		return () => {
			window.removeEventListener('resize', handleResize)
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [colors])

	return (
		<div
			className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
		>
			<canvas
				ref={canvasRef}
				className="w-full h-full block filter blur-[60px] opacity-75 scale-105 will-change-transform"
			/>
			{/* Vignette Overlay */}
			<div className="absolute inset-0 bg-radial-vignette opacity-80" />
		</div>
	)
}
