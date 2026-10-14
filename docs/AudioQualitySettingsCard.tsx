import React, { useState } from 'react'
import { Disc3, Check, Sparkles } from 'lucide-react'
import {
	getAudioQualityPreference,
	setAudioQualityPreference,
	type AudioQualityPreference,
} from '../../audio/audioSettings'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'

export const AudioQualitySettingsCard: React.FC = () => {
	const [preference, setPreference] = useState<AudioQualityPreference>(
		getAudioQualityPreference(),
	)
	const [volumeBalance, setVolumeBalance] = useState<boolean>(() =>
		desktopAudioEngine.isLoudnessNormalizationEnabled(),
	)

	const handleChange = (pref: AudioQualityPreference) => {
		setPreference(pref)
		setAudioQualityPreference(pref)
	}

	const options: {
		id: AudioQualityPreference
		title: string
		badge?: string
		desc: string
	}[] = [
		{
			id: 'auto_hires',
			title: '优先 Hi-Res 无损 / 杜比全景声',
			badge: '推荐',
			desc: '自动获取最高音质 FLAC 无损或杜比全景声（需大会员且原视频支持），无损流不可用时平滑降级 192K',
		},
		{
			id: 'high_192k',
			title: '192K 高保真音质',
			desc: '高码率 AAC 编码（极佳兼容性，普通用户可畅听的最高档位）',
		},
		{
			id: 'standard_132k',
			title: '132K 标准音质',
			desc: '标准码率 AAC 编码，有效减少流量消耗与网络缓冲时间',
		},
	]

	return (
		<div className="rounded-xl bg-white/5 p-4 border border-white/5 space-y-3 text-xs">
			<div className="flex items-center gap-2">
				<Disc3 className="w-4 h-4 text-sky-400" />
				<h3 className="font-semibold text-foreground text-xs">
					播放音频质量偏好
				</h3>
			</div>
			<p className="text-[11px] text-muted-foreground leading-relaxed">
				选择从 B 站请求音频流时的目标码率清晰度，播放下一首歌曲时立即生效。
			</p>

			<div className="space-y-2 pt-1">
				{options.map((opt) => {
					const isSelected = preference === opt.id
					return (
						<button
							key={opt.id}
							onClick={() => handleChange(opt.id)}
							className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3 ${
								isSelected
									? 'bg-primary/10 border-primary/40 shadow-sm'
									: 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
							}`}
						>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<span
										className={`font-semibold ${
											isSelected ? 'text-primary' : 'text-foreground'
										}`}
									>
										{opt.title}
									</span>
									{opt.badge && (
										<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
											{opt.badge}
										</span>
									)}
								</div>
								<p className="text-[11px] text-muted-foreground leading-normal">
									{opt.desc}
								</p>
							</div>

							<div
								className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
									isSelected
										? 'border-primary bg-primary text-white'
										: 'border-white/20'
								}`}
							>
								{isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
							</div>
						</button>
					)
				})}
			</div>

			{/* Audio Volume Balance Normalization Switch */}
			<div className="pt-2 border-t border-white/5">
				<div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
					<div className="space-y-0.5 mr-3">
						<p className="font-semibold text-foreground text-xs flex items-center gap-1.5">
							<span>智能音频音量平衡</span>
							<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
								推荐开启
							</span>
						</p>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							基于 EBU R128 标准与 Web Audio 动态增益，自动均衡不同歌曲的响度差异，保持曲目间音量统一、防止忽大忽小与突发爆音。
						</p>
					</div>

					<button
						onClick={() => {
							const next = !volumeBalance
							setVolumeBalance(next)
							desktopAudioEngine.setLoudnessNormalization(next)
						}}
						className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
							volumeBalance ? 'bg-primary' : 'bg-white/20'
						}`}
					>
						<span
							className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
								volumeBalance ? 'translate-x-4' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>
			</div>
		</div>
	)
}
