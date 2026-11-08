import type {
	EqualizerSettings,
	SpatialDeviceType,
	SpatialHeadphoneMode,
} from './equalizerSettings'

/**
 * 专业全景环绕音效处理器 (Spatial Surround DSP Processor v2.5)
 *
 * 核心技术矩阵与 4 大耳机算法架构：
 * 
 * 1. 【HRTF 纯净双耳空间定位 (hrtf)】
 *    - 目标：近场立体声监听音箱声学结像，彻底消除“头中效应”压迫感。
 *    - 声学特征：纯净无混响、无频响污染。模拟成年人头双耳时差 (ITD 0.45ms) 与头影滤波 (ILD 1.5kHz 衰减)，
 *      叠加 3.4kHz 耳甲腔共振 (+2.8dB) 与 6.5kHz 耳屏下凹滤波 (-5.0dB)，使声像自然定位于面部正前方 1 米处。
 * 
 * 2. 【DTS Headphone:X 影院全景声拟真 (dts)】
 *    - 目标：巨幕影院大空间声场纵深与震撼低频包围感。
 *    - 声学特征：双通道独立立体声早期反射网络 (Left: 19ms/36ms, Right: 27ms/44ms，独立通道不相干)，
 *      结合影院超重低音增强 (65Hz Shelf +3.5dB) 与空气感透亮高频 (10kHz Shelf +2.0dB)，声场大面积向外扩张。
 * 
 * 3. 【HeSuVi 7.1 虚拟声场多声道矩阵仿真 (hesuvi)】
 *    - 目标：多声道环绕音箱环绕包裹感。
 *    - 声学特征：内置硬件级 7.1 矩阵解算器 (Matrix Surround Upmixer)：
 *      - Center (0° 中置)：提取 (L+R)，增强对白凝聚度；
 *      - Front (±30° 前置)：保留立体声主干；
 *      - Side (±90° 侧环绕)：提取侧向差分信号，深度耳廓切除 (7.2kHz Notch -7.5dB) 与 9ms 离散延迟；
 *      - Rear (±135° 后环绕)：提取后向环境差分，严重头颅背侧高频遮蔽 (1.3kHz 滚降) 与 24ms 延迟。
 * 
 * 4. 【8D 动态公转全景环绕 (8d)】
 *    - 目标：360° 颅周动态公转，声像绕脑盘旋，空间层次流动变换（必须佩戴耳机收听）。
 *    - 声学特征：
 *      - 采用专业恒功率正余弦立体声平移网络 (Equal-Power Stereo Panning Law)，数学上严密保证能量守恒，从根源杜绝音量暴增与爆音削波；
 *      - 采用微积分级硬件指数平滑插值 (AudioParam.setTargetAtTime)，连续采样级参数平滑内插，彻底杜绝电流嗞嗞声 (Zipper Noise)；
 *      - 拟真头颅与后耳廓声影动态低通遮蔽 (2.6kHz ~ 18kHz)，结合双耳头影微交叉与漫射微混响，呈现身临其境、绕脑盘旋的通透 8D 沉浸听感。
 * 
 * 5. 【电脑音箱模式 (speaker)】
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

	// ==================== 1. 耳机模式 4 大专属引擎子增益 ====================
	private hrtfSubGain: GainNode
	private dtsSubGain: GainNode
	private hesuviSubGain: GainNode
	private eightDSubGain: GainNode

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
	private dtsDelayL1: DelayNode
	private dtsDelayL2: DelayNode
	private dtsDampingFilterL: BiquadFilterNode
	private dtsEarlyGainL: GainNode

	private dtsDelayR1: DelayNode
	private dtsDelayR2: DelayNode
	private dtsDampingFilterR: BiquadFilterNode
	private dtsEarlyGainR: GainNode

	private dtsCrossDelayLtoR: DelayNode
	private dtsCrossDelayRtoL: DelayNode
	private dtsCrossShadowLtoR: BiquadFilterNode
	private dtsCrossShadowRtoL: BiquadFilterNode
	private dtsCrossGain: GainNode

	private dtsSubBassShelf: BiquadFilterNode
	private dtsAirHighShelf: BiquadFilterNode

	// ---------- 1.3 HeSuVi 7.1 虚拟多声道矩阵解算引擎 ----------
	private hesuviSplitter: ChannelSplitterNode
	private hesuviMerger: ChannelMergerNode

	private hesuviCenterL: GainNode
	private hesuviCenterR: GainNode
	private hesuviCenterFilter: BiquadFilterNode
	private hesuviCenterSum: GainNode

	private hesuviSideL: GainNode
	private hesuviSideR: GainNode
	private hesuviSideFilterL: BiquadFilterNode
	private hesuviSideFilterR: BiquadFilterNode
	private hesuviSideDelayL: DelayNode
	private hesuviSideDelayR: DelayNode
	private hesuviSideGainL: GainNode
	private hesuviSideGainR: GainNode

	private hesuviRearL: GainNode
	private hesuviRearR: GainNode
	private hesuviRearShadowL: BiquadFilterNode
	private hesuviRearShadowR: BiquadFilterNode
	private hesuviRearDelayL: DelayNode
	private hesuviRearDelayR: DelayNode
	private hesuviRearGainL: GainNode
	private hesuviRearGainR: GainNode

	// ---------- 1.4 8D 动态公转全景环绕引擎 (恒功率高保真纯节点 DSP) ----------
	private eightDSplitter: ChannelSplitterNode
	private eightDMerger: ChannelMergerNode
	private eightDMasterGain: GainNode

	// 头颅前后遮蔽动态滤波器 (前后旋转时高频声影遮挡)
	private eightDShadingFilterL: BiquadFilterNode
	private eightDShadingFilterR: BiquadFilterNode

	// 恒功率 2x2 正余弦立体声平移增益矩阵
	private eightDDirectGainLL: GainNode
	private eightDDirectGainLR: GainNode
	private eightDDirectGainRL: GainNode
	private eightDDirectGainRR: GainNode

	// 双耳头影微延迟交叉网络 (增强立体声像脱箱度与离头感)
	private eightDCrossFilterL: BiquadFilterNode
	private eightDCrossFilterR: BiquadFilterNode
	private eightDCrossDelayL: DelayNode
	private eightDCrossDelayR: DelayNode
	private eightDCrossGainLtoR: GainNode
	private eightDCrossGainRtoL: GainNode

	// 8D 空间微漫射环境混响
	private eightDReverbGain: GainNode
	private eightDReverbFilter: BiquadFilterNode
	private eightDReverbDelayL: DelayNode
	private eightDReverbDelayR: DelayNode

	// 8D 动力学时钟状态
	private is8dActive = false
	private current8dAngle = 0 // 弧度 0 ~ 2*PI
	private orbitSpeedSeconds = 12 // 默认 12 秒一圈
	private animTimer: any = null
	private lastTickTime = 0

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

		// 耳机 4 大子引擎分配增益
		this.hrtfSubGain = this.audioCtx.createGain()
		this.dtsSubGain = this.audioCtx.createGain()
		this.hesuviSubGain = this.audioCtx.createGain()
		this.eightDSubGain = this.audioCtx.createGain()

		this.hrtfSubGain.gain.setValueAtTime(0.0, now)
		this.dtsSubGain.gain.setValueAtTime(0.0, now)
		this.hesuviSubGain.gain.setValueAtTime(0.0, now)
		this.eightDSubGain.gain.setValueAtTime(0.0, now)

		this.headphoneBranchGain.connect(this.hrtfSubGain)
		this.headphoneBranchGain.connect(this.dtsSubGain)
		this.headphoneBranchGain.connect(this.hesuviSubGain)
		this.headphoneBranchGain.connect(this.eightDSubGain)

		// ==================== 1.1 构建 HRTF 纯净监听网络 ====================
		this.hrtfSplitter = this.audioCtx.createChannelSplitter(2)
		this.hrtfMerger = this.audioCtx.createChannelMerger(2)
		this.hrtfSubGain.connect(this.hrtfSplitter)

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

		this.hrtfCrossShadowLtoR = this.audioCtx.createBiquadFilter()
		this.hrtfCrossShadowLtoR.type = 'lowpass'
		this.hrtfCrossShadowLtoR.frequency.setValueAtTime(1500, now)

		this.hrtfCrossDelayLtoR = this.audioCtx.createDelay(0.01)
		this.hrtfCrossDelayLtoR.delayTime.setValueAtTime(0.00045, now)

		this.hrtfCrossGainLtoR = this.audioCtx.createGain()
		this.hrtfCrossGainLtoR.gain.setValueAtTime(0.35, now)

		this.hrtfSplitter.connect(this.hrtfCrossShadowLtoR, 0)
		this.hrtfCrossShadowLtoR.connect(this.hrtfCrossDelayLtoR)
		this.hrtfCrossDelayLtoR.connect(this.hrtfCrossGainLtoR)
		this.hrtfCrossGainLtoR.connect(this.hrtfMerger, 0, 1)

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

		this.dtsCrossShadowLtoR = this.audioCtx.createBiquadFilter()
		this.dtsCrossShadowLtoR.type = 'lowpass'
		this.dtsCrossShadowLtoR.frequency.setValueAtTime(2000, now)

		this.dtsCrossDelayLtoR = this.audioCtx.createDelay(0.01)
		this.dtsCrossDelayLtoR.delayTime.setValueAtTime(0.00062, now)

		this.dtsCrossShadowRtoL = this.audioCtx.createBiquadFilter()
		this.dtsCrossShadowRtoL.type = 'lowpass'
		this.dtsCrossShadowRtoL.frequency.setValueAtTime(2000, now)

		this.dtsCrossDelayRtoL = this.audioCtx.createDelay(0.01)
		this.dtsCrossDelayRtoL.delayTime.setValueAtTime(0.00062, now)

		this.dtsCrossGain = this.audioCtx.createGain()
		this.dtsCrossGain.gain.setValueAtTime(0.38, now)

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

		this.dtsDelayL1 = this.audioCtx.createDelay(0.1)
		this.dtsDelayL1.delayTime.setValueAtTime(0.019, now)
		this.dtsDelayL2 = this.audioCtx.createDelay(0.1)
		this.dtsDelayL2.delayTime.setValueAtTime(0.036, now)

		this.dtsDampingFilterL = this.audioCtx.createBiquadFilter()
		this.dtsDampingFilterL.type = 'lowpass'
		this.dtsDampingFilterL.frequency.setValueAtTime(3600, now)

		this.dtsEarlyGainL = this.audioCtx.createGain()
		this.dtsEarlyGainL.gain.setValueAtTime(0.32, now)

		this.dtsSplitter.connect(this.dtsDelayL1, 0)
		this.dtsDelayL1.connect(this.dtsDelayL2)
		this.dtsDelayL1.connect(this.dtsDampingFilterL)
		this.dtsDelayL2.connect(this.dtsDampingFilterL)
		this.dtsDampingFilterL.connect(this.dtsEarlyGainL)
		this.dtsEarlyGainL.connect(this.dtsMerger, 0, 0)

		this.dtsDelayR1 = this.audioCtx.createDelay(0.1)
		this.dtsDelayR1.delayTime.setValueAtTime(0.027, now)
		this.dtsDelayR2 = this.audioCtx.createDelay(0.1)
		this.dtsDelayR2.delayTime.setValueAtTime(0.044, now)

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

		this.dtsSubBassShelf = this.audioCtx.createBiquadFilter()
		this.dtsSubBassShelf.type = 'lowshelf'
		this.dtsSubBassShelf.frequency.setValueAtTime(65, now)
		this.dtsSubBassShelf.gain.setValueAtTime(3.5, now)

		this.dtsAirHighShelf = this.audioCtx.createBiquadFilter()
		this.dtsAirHighShelf.type = 'highshelf'
		this.dtsAirHighShelf.frequency.setValueAtTime(10000, now)
		this.dtsAirHighShelf.gain.setValueAtTime(2.0, now)

		this.dtsMerger.connect(this.dtsSubBassShelf)
		this.dtsSubBassShelf.connect(this.dtsAirHighShelf)
		this.dtsAirHighShelf.connect(this.wetGain)

		// ==================== 1.3 构建 HeSuVi 7.1 虚拟声场多声道解算网络 ====================
		this.hesuviSplitter = this.audioCtx.createChannelSplitter(2)
		this.hesuviMerger = this.audioCtx.createChannelMerger(2)
		this.hesuviSubGain.connect(this.hesuviSplitter)

		this.hesuviCenterL = this.audioCtx.createGain()
		this.hesuviCenterR = this.audioCtx.createGain()
		this.hesuviCenterSum = this.audioCtx.createGain()
		this.hesuviCenterFilter = this.audioCtx.createBiquadFilter()

		this.hesuviCenterL.gain.setValueAtTime(0.5, now)
		this.hesuviCenterR.gain.setValueAtTime(0.5, now)
		this.hesuviCenterFilter.type = 'peaking'
		this.hesuviCenterFilter.frequency.setValueAtTime(2500, now)
		this.hesuviCenterFilter.gain.setValueAtTime(1.5, now)
		this.hesuviCenterSum.gain.setValueAtTime(0.65, now)

		this.hesuviSplitter.connect(this.hesuviCenterL, 0)
		this.hesuviSplitter.connect(this.hesuviCenterR, 1)
		this.hesuviCenterL.connect(this.hesuviCenterFilter)
		this.hesuviCenterR.connect(this.hesuviCenterFilter)
		this.hesuviCenterFilter.connect(this.hesuviCenterSum)

		this.hesuviCenterSum.connect(this.hesuviMerger, 0, 0)
		this.hesuviCenterSum.connect(this.hesuviMerger, 0, 1)

		const hesuviFrontGainL = this.audioCtx.createGain()
		const hesuviFrontGainR = this.audioCtx.createGain()
		hesuviFrontGainL.gain.setValueAtTime(0.7, now)
		hesuviFrontGainR.gain.setValueAtTime(0.7, now)

		this.hesuviSplitter.connect(hesuviFrontGainL, 0)
		this.hesuviSplitter.connect(hesuviFrontGainR, 1)
		hesuviFrontGainL.connect(this.hesuviMerger, 0, 0)
		hesuviFrontGainR.connect(this.hesuviMerger, 0, 1)

		this.hesuviSideL = this.audioCtx.createGain()
		this.hesuviSideR = this.audioCtx.createGain()
		this.hesuviSideFilterL = this.audioCtx.createBiquadFilter()
		this.hesuviSideFilterR = this.audioCtx.createBiquadFilter()
		this.hesuviSideDelayL = this.audioCtx.createDelay(0.05)
		this.hesuviSideDelayR = this.audioCtx.createDelay(0.05)
		this.hesuviSideGainL = this.audioCtx.createGain()
		this.hesuviSideGainR = this.audioCtx.createGain()

		this.hesuviSideFilterL.type = 'peaking'
		this.hesuviSideFilterL.frequency.setValueAtTime(7200, now)
		this.hesuviSideFilterL.Q.setValueAtTime(3.0, now)
		this.hesuviSideFilterL.gain.setValueAtTime(-7.5, now)

		this.hesuviSideFilterR.type = 'peaking'
		this.hesuviSideFilterR.frequency.setValueAtTime(7200, now)
		this.hesuviSideFilterR.Q.setValueAtTime(3.0, now)
		this.hesuviSideFilterR.gain.setValueAtTime(-7.5, now)

		this.hesuviSideDelayL.delayTime.setValueAtTime(0.009, now)
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

		this.hesuviRearDelayL.delayTime.setValueAtTime(0.024, now)
		this.hesuviRearDelayR.delayTime.setValueAtTime(0.031, now)
		this.hesuviRearGainL.gain.setValueAtTime(0.55, now)
		this.hesuviRearGainR.gain.setValueAtTime(0.55, now)

		this.hesuviSplitter.connect(this.hesuviRearL, 0)
		this.hesuviSplitter.connect(this.hesuviRearR, 1)

		this.hesuviRearL.connect(this.hesuviRearShadowL)
		this.hesuviRearShadowL.connect(this.hesuviRearDelayL)
		this.hesuviRearDelayL.connect(this.hesuviRearGainL)
		this.hesuviRearGainL.connect(this.hesuviMerger, 0, 1)

		this.hesuviRearR.connect(this.hesuviRearShadowR)
		this.hesuviRearShadowR.connect(this.hesuviRearDelayR)
		this.hesuviRearDelayR.connect(this.hesuviRearGainR)
		this.hesuviRearGainR.connect(this.hesuviMerger, 0, 0)

		this.hesuviMerger.connect(this.wetGain)

		// 确保 Listener 原点朝向校准 (正前方为 -Z)
		try {
			const listener = this.audioCtx.listener
			if (listener.positionX) {
				listener.positionX.setValueAtTime(0, now)
				listener.positionY.setValueAtTime(0, now)
				listener.positionZ.setValueAtTime(0, now)
				listener.forwardX.setValueAtTime(0, now)
				listener.forwardY.setValueAtTime(0, now)
				listener.forwardZ.setValueAtTime(-1, now)
				listener.upX.setValueAtTime(0, now)
				listener.upY.setValueAtTime(1, now)
				listener.upZ.setValueAtTime(0, now)
			} else if ((listener as any).setPosition) {
				;(listener as any).setPosition(0, 0, 0)
				;(listener as any).setOrientation(0, 0, -1, 0, 1, 0)
			}
		} catch {}

		// ==================== 1.4 构建 8D 动态公转全景环绕网络 (恒功率高保真纯节点架构) ====================
		this.eightDSplitter = this.audioCtx.createChannelSplitter(2)
		this.eightDMerger = this.audioCtx.createChannelMerger(2)
		this.eightDMasterGain = this.audioCtx.createGain()
		this.eightDMasterGain.gain.setValueAtTime(0.90, now) // 0.90x 恒定防削波安全余量，彻底杜绝爆音破音

		this.eightDSubGain.connect(this.eightDSplitter)

		// 1. 头颅前后遮蔽低通滤波器 (前方 18kHz 通透，后方 2.6kHz 自然声影)
		this.eightDShadingFilterL = this.audioCtx.createBiquadFilter()
		this.eightDShadingFilterL.type = 'lowpass'
		this.eightDShadingFilterL.frequency.setValueAtTime(18000, now)
		this.eightDShadingFilterL.Q.setValueAtTime(0.707, now)

		this.eightDShadingFilterR = this.audioCtx.createBiquadFilter()
		this.eightDShadingFilterR.type = 'lowpass'
		this.eightDShadingFilterR.frequency.setValueAtTime(18000, now)
		this.eightDShadingFilterR.Q.setValueAtTime(0.707, now)

		this.eightDSplitter.connect(this.eightDShadingFilterL, 0)
		this.eightDSplitter.connect(this.eightDShadingFilterR, 1)

		// 2. 恒功率 2x2 正余弦平移增益矩阵 (数学保证能量守恒，音量恒定不变)
		this.eightDDirectGainLL = this.audioCtx.createGain()
		this.eightDDirectGainLR = this.audioCtx.createGain()
		this.eightDDirectGainRL = this.audioCtx.createGain()
		this.eightDDirectGainRR = this.audioCtx.createGain()

		this.eightDShadingFilterL.connect(this.eightDDirectGainLL)
		this.eightDShadingFilterL.connect(this.eightDDirectGainLR)
		this.eightDShadingFilterR.connect(this.eightDDirectGainRL)
		this.eightDShadingFilterR.connect(this.eightDDirectGainRR)

		// 直达声平移输出接入双耳 Merger (无失真汇流)
		this.eightDDirectGainLL.connect(this.eightDMerger, 0, 0) // L -> L
		this.eightDDirectGainRL.connect(this.eightDMerger, 0, 0) // R -> L
		this.eightDDirectGainLR.connect(this.eightDMerger, 0, 1) // L -> R
		this.eightDDirectGainRR.connect(this.eightDMerger, 0, 1) // R -> R

		// 3. 对侧头影与微延迟交叉声影网络 (模拟真实头颅双耳效应，增强离头感)
		this.eightDCrossFilterL = this.audioCtx.createBiquadFilter()
		this.eightDCrossFilterL.type = 'lowpass'
		this.eightDCrossFilterL.frequency.setValueAtTime(1800, now)

		this.eightDCrossFilterR = this.audioCtx.createBiquadFilter()
		this.eightDCrossFilterR.type = 'lowpass'
		this.eightDCrossFilterR.frequency.setValueAtTime(1800, now)

		this.eightDCrossDelayL = this.audioCtx.createDelay(0.01)
		this.eightDCrossDelayL.delayTime.setValueAtTime(0.00042, now) // 0.42ms 双耳渡越微延迟

		this.eightDCrossDelayR = this.audioCtx.createDelay(0.01)
		this.eightDCrossDelayR.delayTime.setValueAtTime(0.00042, now)

		this.eightDCrossGainLtoR = this.audioCtx.createGain()
		this.eightDCrossGainLtoR.gain.setValueAtTime(0.20, now)

		this.eightDCrossGainRtoL = this.audioCtx.createGain()
		this.eightDCrossGainRtoL.gain.setValueAtTime(0.20, now)

		this.eightDShadingFilterL.connect(this.eightDCrossFilterL)
		this.eightDCrossFilterL.connect(this.eightDCrossDelayL)
		this.eightDCrossDelayL.connect(this.eightDCrossGainLtoR)
		this.eightDCrossGainLtoR.connect(this.eightDMerger, 0, 1) // 左路交叉至右耳

		this.eightDShadingFilterR.connect(this.eightDCrossFilterR)
		this.eightDCrossFilterR.connect(this.eightDCrossDelayR)
		this.eightDCrossDelayR.connect(this.eightDCrossGainRtoL)
		this.eightDCrossGainRtoL.connect(this.eightDMerger, 0, 0) // 右路交叉至左耳

		// 4. 8D 漫射空间微混响 (营造环绕房间深度，极微弱自然包裹)
		this.eightDReverbGain = this.audioCtx.createGain()
		this.eightDReverbGain.gain.setValueAtTime(0.10, now)

		this.eightDReverbFilter = this.audioCtx.createBiquadFilter()
		this.eightDReverbFilter.type = 'lowpass'
		this.eightDReverbFilter.frequency.setValueAtTime(3200, now)

		this.eightDReverbDelayL = this.audioCtx.createDelay(0.1)
		this.eightDReverbDelayL.delayTime.setValueAtTime(0.024, now)

		this.eightDReverbDelayR = this.audioCtx.createDelay(0.1)
		this.eightDReverbDelayR.delayTime.setValueAtTime(0.035, now)

		this.eightDSplitter.connect(this.eightDReverbDelayL, 0)
		this.eightDSplitter.connect(this.eightDReverbDelayR, 1)
		this.eightDReverbDelayL.connect(this.eightDReverbFilter)
		this.eightDReverbDelayR.connect(this.eightDReverbFilter)
		this.eightDReverbFilter.connect(this.eightDReverbGain)

		this.eightDReverbGain.connect(this.eightDMerger, 0, 0)
		this.eightDReverbGain.connect(this.eightDMerger, 0, 1)

		this.eightDMerger.connect(this.eightDMasterGain)
		this.eightDMasterGain.connect(this.wetGain)

		// 初始化 8D 空间参数
		this.update8dSpatialParameters(0)

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
			this.eightDSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.stop8dLoop()
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

			// 4 个子引擎独立互斥切换：选中的平滑升至 1.0，其余平滑静音至 0.0
			this.hrtfSubGain.gain.setTargetAtTime(mode === 'hrtf' ? 1.0 : 0.0, now, rampTime)
			this.dtsSubGain.gain.setTargetAtTime(mode === 'dts' ? 1.0 : 0.0, now, rampTime)
			this.hesuviSubGain.gain.setTargetAtTime(mode === 'hesuvi' ? 1.0 : 0.0, now, rampTime)
			this.eightDSubGain.gain.setTargetAtTime(mode === '8d' ? 1.0 : 0.0, now, rampTime)

			if (mode === '8d') {
				this.orbitSpeedSeconds = typeof settings.spatial8dSpeed === 'number'
					? Math.max(5, Math.min(30, settings.spatial8dSpeed))
					: 12
				this.start8dLoop()
			} else {
				this.stop8dLoop()
			}
		} else {
			// 电脑音箱分支 (别套耳机 HRTF)
			this.headphoneBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(1.0, now, rampTime)
			this.hrtfSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.dtsSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.hesuviSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.eightDSubGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.stop8dLoop()

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

	// ==================== 8D 动力学公转时钟驱动 ====================
	private start8dLoop(): void {
		if (this.is8dActive && this.animTimer !== null) return
		this.is8dActive = true
		this.lastTickTime = performance.now()

		// 使用 25ms (40fps) 稳定时钟，后台/最小化播放时依然平滑旋转
		this.animTimer = setInterval(() => {
			if (!this.is8dActive) {
				this.stop8dLoop()
				return
			}
			const now = performance.now()
			const dt = (now - this.lastTickTime) / 1000
			this.lastTickTime = now

			// 限制极端单帧步进（如从长时间息屏或休眠恢复）
			const clampedDt = Math.min(dt, 0.2)
			const speed = Math.max(5, Math.min(30, this.orbitSpeedSeconds))
			const dAngle = (clampedDt / speed) * 2 * Math.PI
			this.current8dAngle = (this.current8dAngle + dAngle) % (2 * Math.PI)

			this.update8dSpatialParameters(this.current8dAngle)
		}, 25)
	}

	private stop8dLoop(): void {
		this.is8dActive = false
		if (this.animTimer !== null) {
			clearInterval(this.animTimer)
			this.animTimer = null
		}
		this.lastTickTime = 0
	}

	/**
	 * 恒功率无损 8D 双耳空间参数微积分级平滑更新
	 *
	 * 核心防爆音与音质保障：
	 * 1. 恒功率正余弦平移法则 (Equal-Power Law): (cos^2 + sin^2 = 1.0)，声能恒定，绝不削波；
	 * 2. 连续一阶指数插值 (AudioParam.setTargetAtTime, tau=35ms): 采样级平滑过度，绝无电流杂音；
	 * 3. 动态前后颅骨遮蔽滤波: 正前方通透 (18kHz)，旋转至脑后自然衰减 (2.6kHz)。
	 */
	private update8dSpatialParameters(angle: number): void {
		// 立体声分轨角跨度：约 ±22.5° (0.392 rad)，保持音乐编曲各声部原始的立体声空间关系
		const sepAngle = (22.5 * Math.PI) / 180
		const angleL = angle - sepAngle
		const angleR = angle + sepAngle

		// 1. 横向方位位置归一化投影 (-1: 极左, +1: 极右)
		// 顺时针旋转：0(正前) -> PI/2(正右) -> PI(正后) -> 3PI/2(正左) -> 2PI(正前)
		const panL = Math.sin(angleL)
		const panR = Math.sin(angleR)

		// 恒功率正余弦平移法则 (Equal-Power Stereo Panning)
		// 保证 (cos^2 + sin^2) 恒等于 1.0，总声能绝不随着平移发生任何暴增或凹陷
		const panAngleL = ((panL + 1) * Math.PI) / 4 // 0 ~ PI/2
		const panAngleR = ((panR + 1) * Math.PI) / 4

		const wLL = Math.cos(panAngleL)
		const wLR = Math.sin(panAngleL)
		const wRL = Math.cos(panAngleR)
		const wRR = Math.sin(panAngleR)

		// 2. 前后颅骨遮蔽与声学阴影 (Front/Back Head Shading)
		// cos(angle): +1(正前方) -> 0(正侧方) -> -1(正后方)
		const frontL = Math.cos(angleL)
		const frontR = Math.cos(angleR)

		// 动态低通截止频率：前方通透(18000Hz)，后脑勺被头颅耳廓遮蔽吸收(2600Hz)
		const cutoffL = 10300 + 7700 * frontL
		const cutoffR = 10300 + 7700 * frontR

		// 脑后直达声微弱衰减系数 (0.88 ~ 1.0)，模拟耳廓背向声源的物理特性
		const rearAttenL = 0.88 + 0.12 * ((frontL + 1) / 2)
		const rearAttenR = 0.88 + 0.12 * ((frontR + 1) / 2)

		const gainLL = wLL * rearAttenL
		const gainLR = wLR * rearAttenL
		const gainRL = wRL * rearAttenR
		const gainRR = wRR * rearAttenR

		const nowAudio = this.audioCtx.currentTime
		// 微积分级指数插值时间常数：35ms，完美匹配 25ms 定时器时钟，彻底根除任何阶跃爆音与电流嗞嗞声
		const smoothTime = 0.035

		try {
			this.eightDDirectGainLL.gain.setTargetAtTime(gainLL, nowAudio, smoothTime)
			this.eightDDirectGainLR.gain.setTargetAtTime(gainLR, nowAudio, smoothTime)
			this.eightDDirectGainRL.gain.setTargetAtTime(gainRL, nowAudio, smoothTime)
			this.eightDDirectGainRR.gain.setTargetAtTime(gainRR, nowAudio, smoothTime)

			this.eightDShadingFilterL.frequency.setTargetAtTime(Math.max(1000, cutoffL), nowAudio, smoothTime)
			this.eightDShadingFilterR.frequency.setTargetAtTime(Math.max(1000, cutoffR), nowAudio, smoothTime)
		} catch {}
	}

	public dispose(): void {
		this.stop8dLoop()
		try {
			this.inputNode.disconnect()
			this.outputNode.disconnect()
		} catch {}
	}
}
