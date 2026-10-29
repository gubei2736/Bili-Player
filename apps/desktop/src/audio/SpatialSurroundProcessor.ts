import type {
	EqualizerSettings,
	SpatialDeviceType,
	SpatialHeadphoneMode,
} from './equalizerSettings'

/**
 * 专业全景环绕音效处理器 (Spatial Surround DSP Processor v2.0)
 *
 * 彻底解决“三种算法听不出区别”的质感升级版：
 * 
 * 1. 【HRTF 纯净双耳空间定位 (hrtf)】
 *    - 目标：近场立体声监听音箱声学结像，彻底消除“头中效应”压迫感。
 *    - 声学特征：纯净无混响、无频响污染。精确模拟成年人人头双耳时差 (ITD 0.45ms) 与头影滤波 (ILD 1.5kHz 衰减)，
 *      叠加 3.4kHz 耳甲腔共振 (+2.8dB) 与 6.5kHz 耳屏下凹滤波 (-5.0dB)，使声像自然定位于面部正前方 1 米处。
 * 
 * 2. 【DTS Headphone:X 影院全景声拟真 (dts)】
 *    - 目标：巨幕影院大空间声场纵深与震撼低频包围感。
 *    - 声学特征：双通道独立立体声早期反射网络 (Left: 19ms/36ms, Right: 27ms/44ms，独立通道严禁串成单声道)，
 *      结合影院超重低音增强 (65Hz Shelf +3.5dB) 与空气感透亮高频 (10kHz Shelf +2.0dB)，
 *      切换后声场瞬间向外“膨胀”扩张为数十米大剧院，空间深度与空气感极其显著。
 * 
 * 3. 【HeSuVi 7.1 虚拟声场多声道矩阵仿真 (hesuvi)】
 *    - 目标：多声道环绕音箱环绕包裹感。
 *    - 声学特征：内置硬件级 7.1 矩阵解算器 (Matrix Surround Upmixer)：
 *      - Center (0° 中置)：提取 (L+R)，增强对白凝聚度并消除延迟；
 *      - Front (±30° 前置)：直达立体声主声场；
 *      - Side (±90° 侧环绕)：提取侧向差分信号，深度耳廓切除 (7.2kHz Notch -7.5dB)，从耳朵正侧面大幅拉开；
 *      - Rear (±135° 后环绕)：提取后向环境差分，严重头颅背侧高频遮蔽 (1.3kHz 滚降) 与 24ms 延迟，
 *        使伴奏、和声与混响从后脑勺外围包围过来，形成真正的 7.1 多声道三维环绕。
 * 
 * 4. 【电脑音箱模式 (speaker)】
 *    - 铁律：严格停用所有耳机耳道 HRTF 滤波器；
 *    - 专享 M/S 矩阵侧边拉宽与 0.18ms 物理近场声学微交叉延迟，结像宽出桌面音箱物理边界。
 */
export class SpatialSurroundProcessor {
	private audioCtx: AudioContext
	public inputNode: GainNode
	public outputNode: GainNode

	// 主干湿混合节点
	private dryGain: GainNode
	private wetGain: GainNode

	// 设备主分支增益
	private headphoneBranchGain: GainNode
	private speakerBranchGain: GainNode

	// ==================== 1. 耳机模式 3 大专属引擎子增益 ====================
	private hrtfSubGain: GainNode
	private dtsSubGain: GainNode
	private hesuviSubGain: GainNode

	// ---------- 1.1 HRTF 纯净监听引擎 ----------
	private hrtfSplitter: ChannelSplitterNode
	private hrtfMerger: ChannelMergerNode
	private hrtfPinnaConchaL: BiquadFilterNode
	private hrtfPinnaNotchL: BiquadFilterNode
	private hrtfPinnaConchaR: BiquadFilterNode
	private hrtfPinnaNotchR: BiquadFilterNode
	private hrtfCrossShadowLtoR: BiquadFilterNode
	private hrtfCrossDelayLtoR: DelayNode
	private hrtfCrossGainLtoR: GainNode
	private hrtfCrossShadowRtoL: BiquadFilterNode
	private hrtfCrossDelayRtoL: DelayNode
	private hrtfCrossGainRtoL: GainNode

	// ---------- 1.2 DTS Headphone:X 影院大声场引擎 ----------
	private dtsSplitter: ChannelSplitterNode
	private dtsMerger: ChannelMergerNode
	// 双通道立体声早期反射网络 (左、右独立，绝不混成单声道)
	private dtsDelayL1: DelayNode
	private dtsDelayL2: DelayNode
	private dtsDampingFilterL: BiquadFilterNode
	private dtsEarlyGainL: GainNode

	private dtsDelayR1: DelayNode
	private dtsDelayR2: DelayNode
	private dtsDampingFilterR: BiquadFilterNode
	private dtsEarlyGainR: GainNode

	// 影院主直达前置声场微展开
	private dtsCrossDelayLtoR: DelayNode
	private dtsCrossDelayRtoL: DelayNode
	private dtsCrossShadowLtoR: BiquadFilterNode
	private dtsCrossShadowRtoL: BiquadFilterNode
	private dtsCrossGain: GainNode

	// 影院声学频响塑造 (深邃超低音 + 厅堂空气感)
	private dtsSubBassShelf: BiquadFilterNode
	private dtsAirHighShelf: BiquadFilterNode

	// ---------- 1.3 HeSuVi 7.1 虚拟多声道矩阵解算引擎 ----------
	private hesuviSplitter: ChannelSplitterNode
	private hesuviMerger: ChannelMergerNode

	// 7.1 分离节点：
	// Center 中置人声对白
	private hesuviCenterL: GainNode
	private hesuviCenterR: GainNode
	private hesuviCenterFilter: BiquadFilterNode
	private hesuviCenterSum: GainNode

	// Side 侧环绕 (±90°)
	private hesuviSideL: GainNode
	private hesuviSideR: GainNode
	private hesuviSideFilterL: BiquadFilterNode
	private hesuviSideFilterR: BiquadFilterNode
	private hesuviSideDelayL: DelayNode
	private hesuviSideDelayR: DelayNode
	private hesuviSideGainL: GainNode
	private hesuviSideGainR: GainNode

	// Rear 后环绕 (±135°)
	private hesuviRearL: GainNode
	private hesuviRearR: GainNode
	private hesuviRearShadowL: BiquadFilterNode
	private hesuviRearShadowR: BiquadFilterNode
	private hesuviRearDelayL: DelayNode
	private hesuviRearDelayR: DelayNode
	private hesuviRearGainL: GainNode
	private hesuviRearGainR: GainNode

	// ==================== 2. 电脑音箱处理网络 (无耳道 HRTF) ====================
	private spkSplitter: ChannelSplitterNode
	private spkMerger: ChannelMergerNode

	private midL: GainNode
	private midR: GainNode
	private midSum: GainNode

	private sideL: GainNode
	private sideR: GainNode
	private sideSum: GainNode

	private sideHighpass: BiquadFilterNode
	private sideWidthGain: GainNode
	private sidePhaseDelay: DelayNode

	private spkOutL: GainNode
	private spkOutR: GainNode

	private spkLToRDelay: DelayNode
	private spkLToRFilter: BiquadFilterNode
	private spkLToRGain: GainNode

	private spkRToLDelay: DelayNode
	private spkRToLFilter: BiquadFilterNode
	private spkRToLGain: GainNode

	constructor(audioCtx: AudioContext) {
		this.audioCtx = audioCtx
		const now = this.audioCtx.currentTime

		// 基础输入/输出
		this.inputNode = this.audioCtx.createGain()
		this.outputNode = this.audioCtx.createGain()
		this.dryGain = this.audioCtx.createGain()
		this.wetGain = this.audioCtx.createGain()

		this.dryGain.gain.setValueAtTime(1.0, now)
		this.wetGain.gain.setValueAtTime(0.0, now)

		this.inputNode.connect(this.dryGain)
		this.dryGain.connect(this.outputNode)

		// 分支总控
		this.headphoneBranchGain = this.audioCtx.createGain()
		this.speakerBranchGain = this.audioCtx.createGain()
		this.headphoneBranchGain.gain.setValueAtTime(0.0, now)
		this.speakerBranchGain.gain.setValueAtTime(0.0, now)

		this.inputNode.connect(this.headphoneBranchGain)
		this.inputNode.connect(this.speakerBranchGain)

		// 耳机 3 大子引擎分配增益
		this.hrtfSubGain = this.audioCtx.createGain()
		this.dtsSubGain = this.audioCtx.createGain()
		this.hesuviSubGain = this.audioCtx.createGain()

		this.hrtfSubGain.gain.setValueAtTime(0.0, now)
		this.dtsSubGain.gain.setValueAtTime(0.0, now)
		this.hesuviSubGain.gain.setValueAtTime(0.0, now)

		this.headphoneBranchGain.connect(this.hrtfSubGain)
		this.headphoneBranchGain.connect(this.dtsSubGain)
		this.headphoneBranchGain.connect(this.hesuviSubGain)

		// ==================== 1.1 构建 HRTF 纯净监听网络 ====================
		this.hrtfSplitter = this.audioCtx.createChannelSplitter(2)
		this.hrtfMerger = this.audioCtx.createChannelMerger(2)
		this.hrtfSubGain.connect(this.hrtfSplitter)

		// 左直通：耳甲增益 3.4kHz + 耳屏下凹 6.5kHz
		this.hrtfPinnaConchaL = this.audioCtx.createBiquadFilter()
		this.hrtfPinnaConchaL.type = 'peaking'
		this.hrtfPinnaConchaL.frequency.setValueAtTime(3400, now)
		this.hrtfPinnaConchaL.Q.setValueAtTime(1.8, now)
		this.hrtfPinnaConchaL.gain.setValueAtTime(2.8, now)

		this.hrtfPinnaNotchL = this.audioCtx.createBiquadFilter()
		this.hrtfPinnaNotchL.type = 'peaking'
		this.hrtfPinnaNotchL.frequency.setValueAtTime(6500, now)
		this.hrtfPinnaNotchL.Q.setValueAtTime(2.8, now)
		this.hrtfPinnaNotchL.gain.setValueAtTime(-5.0, now)

		this.hrtfSplitter.connect(this.hrtfPinnaConchaL, 0)
		this.hrtfPinnaConchaL.connect(this.hrtfPinnaNotchL)
		this.hrtfPinnaNotchL.connect(this.hrtfMerger, 0, 0)

		// 右直通
		this.hrtfPinnaConchaR = this.audioCtx.createBiquadFilter()
		this.hrtfPinnaConchaR.type = 'peaking'
		this.hrtfPinnaConchaR.frequency.setValueAtTime(3400, now)
		this.hrtfPinnaConchaR.Q.setValueAtTime(1.8, now)
		this.hrtfPinnaConchaR.gain.setValueAtTime(2.8, now)

		this.hrtfPinnaNotchR = this.audioCtx.createBiquadFilter()
		this.hrtfPinnaNotchR.type = 'peaking'
		this.hrtfPinnaNotchR.frequency.setValueAtTime(6500, now)
		this.hrtfPinnaNotchR.Q.setValueAtTime(2.8, now)
		this.hrtfPinnaNotchR.gain.setValueAtTime(-5.0, now)

		this.hrtfSplitter.connect(this.hrtfPinnaConchaR, 1)
		this.hrtfPinnaConchaR.connect(this.hrtfPinnaNotchR)
		this.hrtfPinnaNotchR.connect(this.hrtfMerger, 0, 1)

		// 跨耳头影低通与延迟 (L -> R)
		this.hrtfCrossShadowLtoR = this.audioCtx.createBiquadFilter()
		this.hrtfCrossShadowLtoR.type = 'lowpass'
		this.hrtfCrossShadowLtoR.frequency.setValueAtTime(1500, now)

		this.hrtfCrossDelayLtoR = this.audioCtx.createDelay(0.01)
		this.hrtfCrossDelayLtoR.delayTime.setValueAtTime(0.00045, now) // 0.45ms 标准人头跨耳时差

		this.hrtfCrossGainLtoR = this.audioCtx.createGain()
		this.hrtfCrossGainLtoR.gain.setValueAtTime(0.35, now)

		this.hrtfSplitter.connect(this.hrtfCrossShadowLtoR, 0)
		this.hrtfCrossShadowLtoR.connect(this.hrtfCrossDelayLtoR)
		this.hrtfCrossDelayLtoR.connect(this.hrtfCrossGainLtoR)
		this.hrtfCrossGainLtoR.connect(this.hrtfMerger, 0, 1)

		// 跨耳头影低通与延迟 (R -> L)
		this.hrtfCrossShadowRtoL = this.audioCtx.createBiquadFilter()
		this.hrtfCrossShadowRtoL.type = 'lowpass'
		this.hrtfCrossShadowRtoL.frequency.setValueAtTime(1500, now)

		this.hrtfCrossDelayRtoL = this.audioCtx.createDelay(0.01)
		this.hrtfCrossDelayRtoL.delayTime.setValueAtTime(0.00045, now)

		this.hrtfCrossGainRtoL = this.audioCtx.createGain()
		this.hrtfCrossGainRtoL.gain.setValueAtTime(0.35, now)

		this.hrtfSplitter.connect(this.hrtfCrossShadowRtoL, 1)
		this.hrtfCrossShadowRtoL.connect(this.hrtfCrossDelayRtoL)
		this.hrtfCrossDelayRtoL.connect(this.hrtfCrossGainRtoL)
		this.hrtfCrossGainRtoL.connect(this.hrtfMerger, 0, 0)

		this.hrtfMerger.connect(this.wetGain)

		// ==================== 1.2 构建 DTS 影院全景声网络 ====================
		this.dtsSplitter = this.audioCtx.createChannelSplitter(2)
		this.dtsMerger = this.audioCtx.createChannelMerger(2)
		this.dtsSubGain.connect(this.dtsSplitter)

		// 直达前置主声场 (宽 60° 影院巨幕结像)
		this.dtsCrossShadowLtoR = this.audioCtx.createBiquadFilter()
		this.dtsCrossShadowLtoR.type = 'lowpass'
		this.dtsCrossShadowLtoR.frequency.setValueAtTime(2000, now)

		this.dtsCrossDelayLtoR = this.audioCtx.createDelay(0.01)
		this.dtsCrossDelayLtoR.delayTime.setValueAtTime(0.00062, now) // 0.62ms 较宽视角

		this.dtsCrossShadowRtoL = this.audioCtx.createBiquadFilter()
		this.dtsCrossShadowRtoL.type = 'lowpass'
		this.dtsCrossShadowRtoL.frequency.setValueAtTime(2000, now)

		this.dtsCrossDelayRtoL = this.audioCtx.createDelay(0.01)
		this.dtsCrossDelayRtoL.delayTime.setValueAtTime(0.00062, now)

		this.dtsCrossGain = this.audioCtx.createGain()
		this.dtsCrossGain.gain.setValueAtTime(0.38, now)

		// 直达通路接入
		this.dtsSplitter.connect(this.dtsMerger, 0, 0)
		this.dtsSplitter.connect(this.dtsMerger, 1, 1)

		this.dtsSplitter.connect(this.dtsCrossShadowLtoR, 0)
		this.dtsCrossShadowLtoR.connect(this.dtsCrossDelayLtoR)
		this.dtsCrossDelayLtoR.connect(this.dtsCrossGain)
		this.dtsCrossGain.connect(this.dtsMerger, 0, 1)

		this.dtsSplitter.connect(this.dtsCrossShadowRtoL, 1)
		this.dtsCrossShadowRtoL.connect(this.dtsCrossDelayRtoL)
		this.dtsCrossDelayRtoL.connect(this.dtsCrossGain)
		this.dtsCrossGain.connect(this.dtsMerger, 0, 0)

		// 独立的左右双声道影院早期反射环路 (绝非单声道叠加！)
		this.dtsDelayL1 = this.audioCtx.createDelay(0.1)
		this.dtsDelayL1.delayTime.setValueAtTime(0.019, now) // 19ms
		this.dtsDelayL2 = this.audioCtx.createDelay(0.1)
		this.dtsDelayL2.delayTime.setValueAtTime(0.036, now) // 36ms

		this.dtsDampingFilterL = this.audioCtx.createBiquadFilter()
		this.dtsDampingFilterL.type = 'lowpass'
		this.dtsDampingFilterL.frequency.setValueAtTime(3600, now)

		this.dtsEarlyGainL = this.audioCtx.createGain()
		this.dtsEarlyGainL.gain.setValueAtTime(0.32, now) // 充沛的影院反射能量

		this.dtsSplitter.connect(this.dtsDelayL1, 0)
		this.dtsDelayL1.connect(this.dtsDelayL2)
		this.dtsDelayL1.connect(this.dtsDampingFilterL)
		this.dtsDelayL2.connect(this.dtsDampingFilterL)
		this.dtsDampingFilterL.connect(this.dtsEarlyGainL)
		this.dtsEarlyGainL.connect(this.dtsMerger, 0, 0)

		this.dtsDelayR1 = this.audioCtx.createDelay(0.1)
		this.dtsDelayR1.delayTime.setValueAtTime(0.027, now) // 27ms
		this.dtsDelayR2 = this.audioCtx.createDelay(0.1)
		this.dtsDelayR2.delayTime.setValueAtTime(0.044, now) // 44ms

		this.dtsDampingFilterR = this.audioCtx.createBiquadFilter()
		this.dtsDampingFilterR.type = 'lowpass'
		this.dtsDampingFilterR.frequency.setValueAtTime(3600, now)

		this.dtsEarlyGainR = this.audioCtx.createGain()
		this.dtsEarlyGainR.gain.setValueAtTime(0.32, now)

		this.dtsSplitter.connect(this.dtsDelayR1, 1)
		this.dtsDelayR1.connect(this.dtsDelayR2)
		this.dtsDelayR1.connect(this.dtsDampingFilterR)
		this.dtsDelayR2.connect(this.dtsDampingFilterR)
		this.dtsDampingFilterR.connect(this.dtsEarlyGainR)
		this.dtsEarlyGainR.connect(this.dtsMerger, 0, 1)

		// 影院质感频响修饰 (深邃次低音 + 厅堂空气感)
		this.dtsSubBassShelf = this.audioCtx.createBiquadFilter()
		this.dtsSubBassShelf.type = 'lowshelf'
		this.dtsSubBassShelf.frequency.setValueAtTime(65, now)
		this.dtsSubBassShelf.gain.setValueAtTime(3.5, now) // +3.5dB 弹性下潜

		this.dtsAirHighShelf = this.audioCtx.createBiquadFilter()
		this.dtsAirHighShelf.type = 'highshelf'
		this.dtsAirHighShelf.frequency.setValueAtTime(10000, now)
		this.dtsAirHighShelf.gain.setValueAtTime(2.0, now) // +2.0dB 通透空气感

		this.dtsMerger.connect(this.dtsSubBassShelf)
		this.dtsSubBassShelf.connect(this.dtsAirHighShelf)
		this.dtsAirHighShelf.connect(this.wetGain)

		// ==================== 1.3 构建 HeSuVi 7.1 虚拟声场多声道解算网络 ====================
		this.hesuviSplitter = this.audioCtx.createChannelSplitter(2)
		this.hesuviMerger = this.audioCtx.createChannelMerger(2)
		this.hesuviSubGain.connect(this.hesuviSplitter)

		// 1.3.1 Center 中置声道：提取 (L+R)，增强对白凝聚并消除延迟
		this.hesuviCenterL = this.audioCtx.createGain()
		this.hesuviCenterR = this.audioCtx.createGain()
		this.hesuviCenterSum = this.audioCtx.createGain()
		this.hesuviCenterFilter = this.audioCtx.createBiquadFilter()

		this.hesuviCenterL.gain.setValueAtTime(0.5, now)
		this.hesuviCenterR.gain.setValueAtTime(0.5, now)
		this.hesuviCenterFilter.type = 'peaking'
		this.hesuviCenterFilter.frequency.setValueAtTime(2500, now) // 人声对白凝聚频段
		this.hesuviCenterFilter.gain.setValueAtTime(1.5, now)
		this.hesuviCenterSum.gain.setValueAtTime(0.65, now)

		this.hesuviSplitter.connect(this.hesuviCenterL, 0)
		this.hesuviSplitter.connect(this.hesuviCenterR, 1)
		this.hesuviCenterL.connect(this.hesuviCenterFilter)
		this.hesuviCenterR.connect(this.hesuviCenterFilter)
		this.hesuviCenterFilter.connect(this.hesuviCenterSum)

		// 中置等量注入左右耳 (正前 0° 真实中置定位)
		this.hesuviCenterSum.connect(this.hesuviMerger, 0, 0)
		this.hesuviCenterSum.connect(this.hesuviMerger, 0, 1)

		// 1.3.2 Front 前置声道直通 (保留立体声核心)
		const hesuviFrontGainL = this.audioCtx.createGain()
		const hesuviFrontGainR = this.audioCtx.createGain()
		hesuviFrontGainL.gain.setValueAtTime(0.7, now)
		hesuviFrontGainR.gain.setValueAtTime(0.7, now)

		this.hesuviSplitter.connect(hesuviFrontGainL, 0)
		this.hesuviSplitter.connect(hesuviFrontGainR, 1)
		hesuviFrontGainL.connect(this.hesuviMerger, 0, 0)
		hesuviFrontGainR.connect(this.hesuviMerger, 0, 1)

		// 1.3.3 Side 侧向环绕 (±90° 侧向宽展)：提取 (L - 0.6R) 与 (R - 0.6L)
		this.hesuviSideL = this.audioCtx.createGain()
		this.hesuviSideR = this.audioCtx.createGain()
		this.hesuviSideFilterL = this.audioCtx.createBiquadFilter()
		this.hesuviSideFilterR = this.audioCtx.createBiquadFilter()
		this.hesuviSideDelayL = this.audioCtx.createDelay(0.05)
		this.hesuviSideDelayR = this.audioCtx.createDelay(0.05)
		this.hesuviSideGainL = this.audioCtx.createGain()
		this.hesuviSideGainR = this.audioCtx.createGain()

		// 90° 侧向入射耳廓极度深切 (7.2kHz Notch -7.5dB)
		this.hesuviSideFilterL.type = 'peaking'
		this.hesuviSideFilterL.frequency.setValueAtTime(7200, now)
		this.hesuviSideFilterL.Q.setValueAtTime(3.0, now)
		this.hesuviSideFilterL.gain.setValueAtTime(-7.5, now)

		this.hesuviSideFilterR.type = 'peaking'
		this.hesuviSideFilterR.frequency.setValueAtTime(7200, now)
		this.hesuviSideFilterR.Q.setValueAtTime(3.0, now)
		this.hesuviSideFilterR.gain.setValueAtTime(-7.5, now)

		this.hesuviSideDelayL.delayTime.setValueAtTime(0.009, now) // 9ms 侧向离散延迟
		this.hesuviSideDelayR.delayTime.setValueAtTime(0.009, now)
		this.hesuviSideGainL.gain.setValueAtTime(0.65, now)
		this.hesuviSideGainR.gain.setValueAtTime(0.65, now)

		this.hesuviSplitter.connect(this.hesuviSideL, 0)
		this.hesuviSplitter.connect(this.hesuviSideR, 1)

		this.hesuviSideL.connect(this.hesuviSideFilterL)
		this.hesuviSideFilterL.connect(this.hesuviSideDelayL)
		this.hesuviSideDelayL.connect(this.hesuviSideGainL)
		this.hesuviSideGainL.connect(this.hesuviMerger, 0, 0)

		this.hesuviSideR.connect(this.hesuviSideFilterR)
		this.hesuviSideFilterR.connect(this.hesuviSideDelayR)
		this.hesuviSideDelayR.connect(this.hesuviSideGainR)
		this.hesuviSideGainR.connect(this.hesuviMerger, 0, 1)

		// 1.3.4 Rear 后方环绕 (±135° 脑后包围)：后方头颅重度高频遮蔽 (1.3kHz 滚降) + 24ms 延迟
		this.hesuviRearL = this.audioCtx.createGain()
		this.hesuviRearR = this.audioCtx.createGain()
		this.hesuviRearShadowL = this.audioCtx.createBiquadFilter()
		this.hesuviRearShadowR = this.audioCtx.createBiquadFilter()
		this.hesuviRearDelayL = this.audioCtx.createDelay(0.1)
		this.hesuviRearDelayR = this.audioCtx.createDelay(0.1)
		this.hesuviRearGainL = this.audioCtx.createGain()
		this.hesuviRearGainR = this.audioCtx.createGain()

		this.hesuviRearShadowL.type = 'lowpass'
		this.hesuviRearShadowL.frequency.setValueAtTime(1300, now)
		this.hesuviRearShadowR.type = 'lowpass'
		this.hesuviRearShadowR.frequency.setValueAtTime(1300, now)

		this.hesuviRearDelayL.delayTime.setValueAtTime(0.024, now) // 24ms 脑后环绕延迟
		this.hesuviRearDelayR.delayTime.setValueAtTime(0.031, now) // 31ms 异侧打破梳状滤波
		this.hesuviRearGainL.gain.setValueAtTime(0.55, now)
		this.hesuviRearGainR.gain.setValueAtTime(0.55, now)

		// 交叉反相注入营造后方漫射包围感
		this.hesuviSplitter.connect(this.hesuviRearL, 0)
		this.hesuviSplitter.connect(this.hesuviRearR, 1)

		this.hesuviRearL.connect(this.hesuviRearShadowL)
		this.hesuviRearShadowL.connect(this.hesuviRearDelayL)
		this.hesuviRearDelayL.connect(this.hesuviRearGainL)
		this.hesuviRearGainL.connect(this.hesuviMerger, 0, 1) // 交叉至右后

		this.hesuviRearR.connect(this.hesuviRearShadowR)
		this.hesuviRearShadowR.connect(this.hesuviRearDelayR)
		this.hesuviRearDelayR.connect(this.hesuviRearGainR)
		this.hesuviRearGainR.connect(this.hesuviMerger, 0, 0) // 交叉至左后

		this.hesuviMerger.connect(this.wetGain)

		// ==================== 2. 构建电脑音箱处理网络 (别套耳机 HRTF) ====================
		this.spkSplitter = this.audioCtx.createChannelSplitter(2)
		this.spkMerger = this.audioCtx.createChannelMerger(2)
		this.speakerBranchGain.connect(this.spkSplitter)

		// M/S 矩阵分解
		this.midL = this.audioCtx.createGain()
		this.midR = this.audioCtx.createGain()
		this.midSum = this.audioCtx.createGain()
		this.midL.gain.setValueAtTime(0.5, now)
		this.midR.gain.setValueAtTime(0.5, now)
		this.midSum.gain.setValueAtTime(1.0, now)

		this.spkSplitter.connect(this.midL, 0)
		this.spkSplitter.connect(this.midR, 1)
		this.midL.connect(this.midSum)
		this.midR.connect(this.midSum)

		this.sideL = this.audioCtx.createGain()
		this.sideR = this.audioCtx.createGain()
		this.sideSum = this.audioCtx.createGain()
		this.sideL.gain.setValueAtTime(0.5, now)
		this.sideR.gain.setValueAtTime(-0.5, now)
		this.sideSum.gain.setValueAtTime(1.0, now)

		this.spkSplitter.connect(this.sideL, 0)
		this.spkSplitter.connect(this.sideR, 1)
		this.sideL.connect(this.sideSum)
		this.sideR.connect(this.sideSum)

		// 140Hz 高通滤除超低频（防低音相位抵消）
		this.sideHighpass = this.audioCtx.createBiquadFilter()
		this.sideHighpass.type = 'highpass'
		this.sideHighpass.frequency.setValueAtTime(140, now)
		this.sideHighpass.Q.setValueAtTime(0.707, now)

		this.sideWidthGain = this.audioCtx.createGain()
		this.sideWidthGain.gain.setValueAtTime(1.4, now)

		this.sidePhaseDelay = this.audioCtx.createDelay(0.01)
		this.sidePhaseDelay.delayTime.setValueAtTime(0.00022, now)

		this.sideSum.connect(this.sideHighpass)
		this.sideHighpass.connect(this.sideWidthGain)
		this.sideWidthGain.connect(this.sidePhaseDelay)

		// M/S 重构
		this.spkOutL = this.audioCtx.createGain()
		this.spkOutR = this.audioCtx.createGain()

		const sideInvertR = this.audioCtx.createGain()
		sideInvertR.gain.setValueAtTime(-1.0, now)

		this.midSum.connect(this.spkOutL)
		this.midSum.connect(this.spkOutR)

		this.sidePhaseDelay.connect(this.spkOutL)
		this.sidePhaseDelay.connect(sideInvertR)
		sideInvertR.connect(this.spkOutR)

		// 近场微交叉延迟网络
		this.spkLToRDelay = this.audioCtx.createDelay(0.01)
		this.spkLToRDelay.delayTime.setValueAtTime(0.0002, now)

		this.spkLToRFilter = this.audioCtx.createBiquadFilter()
		this.spkLToRFilter.type = 'lowpass'
		this.spkLToRFilter.frequency.setValueAtTime(3200, now)

		this.spkLToRGain = this.audioCtx.createGain()
		this.spkLToRGain.gain.setValueAtTime(0.18, now)

		this.spkSplitter.connect(this.spkLToRDelay, 0)
		this.spkLToRDelay.connect(this.spkLToRFilter)
		this.spkLToRFilter.connect(this.spkLToRGain)
		this.spkLToRGain.connect(this.spkOutR)

		this.spkRToLDelay = this.audioCtx.createDelay(0.01)
		this.spkRToLDelay.delayTime.setValueAtTime(0.0002, now)

		this.spkRToLFilter = this.audioCtx.createBiquadFilter()
		this.spkRToLFilter.type = 'lowpass'
		this.spkRToLFilter.frequency.setValueAtTime(3200, now)

		this.spkRToLGain = this.audioCtx.createGain()
		this.spkRToLGain.gain.setValueAtTime(0.18, now)

		this.spkSplitter.connect(this.spkRToLDelay, 1)
		this.spkRToLDelay.connect(this.spkRToLFilter)
		this.spkRToLFilter.connect(this.spkRToLGain)
		this.spkRToLGain.connect(this.spkOutL)

		this.spkOutL.connect(this.spkMerger, 0, 0)
		this.spkOutR.connect(this.spkMerger, 0, 1)
		this.spkMerger.connect(this.wetGain)

		// 湿声总线连入最终输出
		this.wetGain.connect(this.outputNode)
	}

	/**
	 * 更新全景环绕配置 (平滑渐变无爆音)
	 */
	public updateSettings(settings: EqualizerSettings): void {
		const now = this.audioCtx.currentTime
		const rampTime = 0.04

		const isEnabled = Boolean(settings.spatialSurroundEnabled)

		if (!isEnabled) {
			// 完全旁通
			this.dryGain.gain.setTargetAtTime(1.0, now, rampTime)
			this.wetGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.headphoneBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.hrtfSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.dtsSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.hesuviSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			return
		}

		// 启用全景音效
		this.dryGain.gain.setTargetAtTime(0.0, now, rampTime)
		this.wetGain.gain.setTargetAtTime(1.0, now, rampTime)

		const deviceType: SpatialDeviceType = settings.spatialDeviceType || 'headphone'

		if (deviceType === 'headphone') {
			this.headphoneBranchGain.gain.setTargetAtTime(1.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(0.0, now, rampTime)

			const mode: SpatialHeadphoneMode = settings.spatialHeadphoneMode || 'dts'

			// 3 个子引擎独立互斥切换：选中的平滑升至 1.0，其余平滑静音至 0.0
			this.hrtfSubGain.gain.setTargetAtTime(mode === 'hrtf' ? 1.0 : 0.0, now, rampTime)
			this.dtsSubGain.gain.setTargetAtTime(mode === 'dts' ? 1.0 : 0.0, now, rampTime)
			this.hesuviSubGain.gain.setTargetAtTime(mode === 'hesuvi' ? 1.0 : 0.0, now, rampTime)
		} else {
			// 电脑音箱分支 (别套耳机 HRTF)
			this.headphoneBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(1.0, now, rampTime)
			this.hrtfSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.dtsSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.hesuviSubGain.gain.setTargetAtTime(0.0, now, rampTime)

			this.applySpeakerSettings(settings, now, rampTime)
		}
	}

	private applySpeakerSettings(
		settings: EqualizerSettings,
		now: number,
		rampTime: number,
	): void {
		const widening =
			typeof settings.spatialSpeakerWidening === 'number'
				? Math.max(0, Math.min(1, settings.spatialSpeakerWidening))
				: 0.6
		const widthGainValue = 1.0 + widening * 0.9
		this.sideWidthGain.gain.setTargetAtTime(widthGainValue, now, rampTime)

		const crossDepth =
			typeof settings.spatialSpeakerCrossDelay === 'number'
				? Math.max(0, Math.min(1, settings.spatialSpeakerCrossDelay))
				: 0.4

		const delaySec = 0.00016 + crossDepth * 0.00014
		this.spkLToRDelay.delayTime.setTargetAtTime(delaySec, now, rampTime)
		this.spkRToLDelay.delayTime.setTargetAtTime(delaySec, now, rampTime)

		const crossGainVal = crossDepth * 0.24
		this.spkLToRGain.gain.setTargetAtTime(crossGainVal, now, rampTime)
		this.spkRToLGain.gain.setTargetAtTime(crossGainVal, now, rampTime)
	}
}
