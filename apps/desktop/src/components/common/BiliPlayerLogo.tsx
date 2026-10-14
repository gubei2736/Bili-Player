import React from 'react'

export interface BiliPlayerLogoProps {
	className?: string
	size?: number
	animated?: boolean
}

export const BiliPlayerLogo: React.FC<BiliPlayerLogoProps> = ({
	className = '',
	size = 28,
	animated = false,
}) => {
	return (
		<div
			className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
			style={{ width: size, height: size }}
		>
			<svg
				viewBox="0 0 100 100"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="w-full h-full drop-shadow-[0_2px_8px_rgba(0,174,236,0.35)]"
			>
				<defs>
					{/* Gradient: Bili Blue to Bili Pink */}
					<linearGradient id="biliGrad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#00AEEC" />
						<stop offset="50%" stopColor="#23ADE5" />
						<stop offset="100%" stopColor="#FB7299" />
					</linearGradient>
					{/* Glow accent */}
					<linearGradient id="neonPink" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#FF6699" />
						<stop offset="100%" stopColor="#FB7299" />
					</linearGradient>
					<linearGradient id="headphoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stopColor="#38BDF8" />
						<stop offset="100%" stopColor="#0284C7" />
					</linearGradient>
				</defs>

				{/* Headphone Arch Band */}
				<path
					d="M18 48 C 18 20, 82 20, 82 48"
					stroke="url(#headphoneGrad)"
					strokeWidth="6"
					strokeLinecap="round"
					fill="none"
					className="opacity-90"
				/>

				{/* Left TV Antenna */}
				<line
					x1="36"
					y1="34"
					x2="27"
					y2="20"
					stroke="#00AEEC"
					strokeWidth="4"
					strokeLinecap="round"
				/>
				<circle cx="26" cy="19" r="2.5" fill="#00AEEC" />

				{/* Right TV Antenna */}
				<line
					x1="64"
					y1="34"
					x2="73"
					y2="20"
					stroke="#FB7299"
					strokeWidth="4"
					strokeLinecap="round"
				/>
				<circle cx="74" cy="19" r="2.5" fill="#FB7299" />

				{/* TV Main Body (Squircle) */}
				<rect
					x="22"
					y="32"
					width="56"
					height="46"
					rx="14"
					fill="url(#biliGrad)"
					className="shadow-sm"
				/>

				{/* TV Screen Display (Dark glassy inner) */}
				<rect
					x="27"
					y="37"
					width="46"
					height="36"
					rx="10"
					fill="#0B0F19"
					stroke="rgba(255,255,255,0.15)"
					strokeWidth="1.5"
				/>

				{/* TV Screen Inner Glow / Vinyl Groove Effect */}
				<circle
					cx="50"
					cy="55"
					r="13"
					stroke="rgba(0,174,236,0.2)"
					strokeWidth="1"
					fill="none"
					strokeDasharray="2 2"
					className={animated ? 'animate-[spin_8s_linear_infinite] origin-center' : ''}
				/>

				{/* Mascot Face: Left Eye */}
				<ellipse cx="41" cy="52" rx="2.5" ry="3.5" fill="#23ADE5" />
				{/* Mascot Face: Right Eye */}
				<ellipse cx="59" cy="52" rx="2.5" ry="3.5" fill="#FB7299" />

				{/* Mascot Face: Cute Smiling Mouth & Musical Sound Wave */}
				<path
					d="M45 59 Q 50 64 55 59"
					stroke="#FFFFFF"
					strokeWidth="2"
					strokeLinecap="round"
					fill="none"
				/>

				{/* Left Earphone Cushion */}
				<rect
					x="12"
					y="44"
					width="9"
					height="22"
					rx="4.5"
					fill="url(#headphoneGrad)"
					stroke="#0B0F19"
					strokeWidth="1.5"
				/>

				{/* Right Earphone Cushion */}
				<rect
					x="79"
					y="44"
					width="9"
					height="22"
					rx="4.5"
					fill="url(#neonPink)"
					stroke="#0B0F19"
					strokeWidth="1.5"
				/>

				{/* Small Music Note floating on top right */}
				<path
					d="M80 18 L88 15 L88 23 M80 26 C80 28 77 29 75 28 C73 27 73 25 75 24 C77 23 80 24 80 26 L80 18 M88 23 C88 25 85 26 83 25 C81 24 81 22 83 21 C85 20 88 21 88 23"
					fill="#FB7299"
					className={animated ? 'animate-bounce origin-bottom' : ''}
				/>
			</svg>
		</div>
	)
}
