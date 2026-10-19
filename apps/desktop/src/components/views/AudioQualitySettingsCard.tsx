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
		badgeColor?: string
		desc: string
	}[] = [
		{
			id: 'auto_highest',
			title: '优先账号最高档清晰度',
			badge: '智能最高档 · 推荐',
			badgeColor: 'bg-[#00AEEC]/20 text-[#00AEEC] border-[#00AEEC]/30',
			desc: '优先选择账号权限下视频的最高挡位清晰度（Hi-Res 无损 > 杜比全景声 > 常规 AAC），若原视频或设备不支持则自动无缝降级。',
		},
		{
			id: 'hires_lossless',
			title: 'Hi-Res 无损音质',
			badge: '大会员 · FLAC',
			badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
			desc: 'FLAC 48kHz/24bit 或 96kHz/24bit 母带级音轨（需大会员，稿件含合规无损音轨且 UP 主勾选 Hi-Res 选项）。不可用时降级常规最高档。',
		},
		{
			id: 'dolby_atmos',
			title: '杜比全景声 (Dolby Atmos)',
			badge: '大会员 · 空间声',
			badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
			desc: 'EC-3 / E-AC-3 JOC 沉浸环绕编码，最高 768kbps（需大会员，稿件标注杜比标识 + 设备支持解码）。不可用时降级常规最高档。',
		},
		{
			id: 'standard_aac',
			title: '常规 AAC 音质',
			badge: '免费 · 全稿件',
			badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
			desc: 'AAC-LC 编码，约 64–320kbps（免费，所有稿件随清晰度档位分发，极佳兼容性，节省带宽与缓冲时间）。',
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
				选择从 B 站请求音频流时的目标码率清晰度，优先匹配当前账号最高权限规格，播放下一首歌曲时立即生效。
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
										<span
											className={`text-[10px] px-1.5 py-0.2 rounded-full border font-medium ${
												opt.badgeColor ||
												'bg-amber-500/20 text-amber-300 border-amber-500/30'
											}`}
										>
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

			{/* Specifications Quick Reference Card */}
			<div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1.5">
				<p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
					官方音频清晰度规格参考
				</p>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px]">
					<div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 space-y-0.5">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-amber-300">Hi-Res 无损</span>
							<span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">大会员</span>
						</div>
						<p className="text-muted-foreground/90 text-[10px]">FLAC 48kHz/24bit 或 96kHz/24bit</p>
						<p className="text-muted-foreground/60 text-[9px]">稿件含合规无损音轨且 UP 主勾选</p>
					</div>
					<div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 space-y-0.5">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-purple-300">杜比全景声</span>
							<span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300">大会员</span>
						</div>
						<p className="text-muted-foreground/90 text-[10px]">EC-3 / E-AC-3 JOC，最高 768kbps</p>
						<p className="text-muted-foreground/60 text-[9px]">稿件标注杜比标识 + 设备支持解码</p>
					</div>
					<div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 space-y-0.5">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-sky-300">常规 AAC</span>
							<span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300">免费</span>
						</div>
						<p className="text-muted-foreground/90 text-[10px]">AAC-LC，约 64–320kbps</p>
						<p className="text-muted-foreground/60 text-[9px]">所有稿件，随清晰度档位分发</p>
					</div>
				</div>
			</div>

			{/* Audio Volume Balance Normalization Switch */}
			<div className="pt-2 border-t border-white/5">
				<div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
					<div className="space-y-0.5 mr-3">
						<p className="font-semibold text-foreground text-xs flex items-center gap-1.5">
							<span>智能音频音量平衡</span>
							<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-medium">
								会影响听感，自行选择
							</span>
						</p>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							自动均衡不同歌曲的响度差异，保持曲目间音量统一、防止忽大忽小与突发爆音。
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
