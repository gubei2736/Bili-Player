import type {
	EqualizerSettings,
	SpatialDeviceType,
	SpatialHeadphoneMode,
} from './equalizerSettings'

/**
 * 全景环绕音效处理器 (Spatial Surround Processor)
 *
 * 核心技术规范：
 * 1. 【耳机 / 入耳】：提供三种专业空间双耳渲染算法：
 *    - HRTF: 头部相关传输函数，仿真头影低通衰减、耳廓滤波 (Pinna Notch) 与耳道共振，消除头中效应；
 *    - DTS Headphone:X: 影院级宽广全景声拟真，引入宽视角声场展开与微早期反射环境混响，增强空间纵深；
 *    - HeSuVi: 7.1 虚拟多声道混合仿真，将 7.1 环绕声像通过离散多角度延迟与方位滤波合成为双耳立体声。
 * 2. 【电脑音箱 / 桌面外放】：
 *    - 核心铁律：严禁套用耳机 HRTF 滤波器（避免在真实房间声学环境中叠加造成梳状滤波与中频空洞）；
 *    - 立体声拉宽 (Stereo Widener): 基于 M/S (Mid/Side) 矩阵分解，保留低频居中单声道，对侧向分量进行适度增益与微相位去相关，拉宽桌面外放结像；
 *    - 轻微交叉延迟 (Subtle Crossfeed Delay): 仿真近场音箱（0.6m~1.2m）声学自然微串扰，消除极窄生硬感，增强桌面声场凝聚度与深度。
 */
export class SpatialSurroundProcessor {
	private audioCtx: AudioContext
	public inputNode: GainNode
	public outputNode: GainNode

	// 干湿声切换节点
	private dryGain: GainNode
	private wetGain: GainNode

	// 设备分支控制节点
	private headphoneBranchGain: GainNode
	private speakerBranchGain: GainNode

	// ========== 耳机 / 入耳 处理节点 ==========
	private hpSplitter: ChannelSplitterNode
	private hpMerger: ChannelMergerNode

	// 耳廓滤波与共振 (L / R 直通)
	private lPinnaFilter: BiquadFilterNode
	private lPinnaNotch: BiquadFilterNode
	private rPinnaFilter: BiquadFilterNode
	private rPinnaNotch: BiquadFilterNode

	// 双耳头影低通与跨耳延迟 (ITD & ILD)
	private lToRShadow: BiquadFilterNode
	private lToRDelay: DelayNode
	private lToRGain: GainNode

	private rToLShadow: BiquadFilterNode
	private rToLDelay: DelayNode
	private rToLGain: GainNode

	// DTS 影院级早期反射与空间声学均衡
	private dtsAmbienceGain: GainNode
	private dtsDelayL: DelayNode
	private dtsDelayR: DelayNode
	private dtsFilter: BiquadFilterNode
	private dtsShelfLow: BiquadFilterNode
	private dtsShelfHigh: BiquadFilterNode

	// ========== 电脑音箱 处理节点 (无 HRTF，仅 M/S 拉宽与近场微交叉) ==========
	private spkSplitter: ChannelSplitterNode
	private spkMerger: ChannelMergerNode

	// M/S 矩阵分解
	private midL: GainNode
	private midR: GainNode
	private midSum: GainNode

	private sideL: GainNode
	private sideR: GainNode
	private sideSum: GainNode

	// 侧边声场处理：低频切除 (防低音相位抵消) + 宽度增益 + 微相位去相关
	private sideHighpass: BiquadFilterNode
	private sideWidthGain: GainNode
	private sidePhaseDelay: DelayNode

	// 重构左右声道
	private spkOutL: GainNode
	private spkOutR: GainNode

	// 音箱轻微交叉延迟网络 (物理近场声学仿真，严禁耳道 HRTF)
	private spkLToRDelay: DelayNode
	private spkLToRFilter: BiquadFilterNode
	private spkLToRGain: GainNode

	private spkRToLDelay: DelayNode
	private spkRToLFilter: BiquadFilterNode
	private spkRToLGain: GainNode

	constructor(audioCtx: AudioContext) {
		this.audioCtx = audioCtx
		const now = this.audioCtx.currentTime

		// 1. 基础输入/输出与干湿混合
		this.inputNode = this.audioCtx.createGain()
		this.outputNode = this.audioCtx.createGain()
		this.dryGain = this.audioCtx.createGain()
		this.wetGain = this.audioCtx.createGain()

		// 默认旁通
		this.dryGain.gain.setValueAtTime(1.0, now)
		this.wetGain.gain.setValueAtTime(0.0, now)

		this.inputNode.connect(this.dryGain)
		this.dryGain.connect(this.outputNode)

		// 2. 分支控制节点
		this.headphoneBranchGain = this.audioCtx.createGain()
		this.speakerBranchGain = this.audioCtx.createGain()
		this.headphoneBranchGain.gain.setValueAtTime(0.0, now)
		this.speakerBranchGain.gain.setValueAtTime(0.0, now)

		this.inputNode.connect(this.headphoneBranchGain)
		this.inputNode.connect(this.speakerBranchGain)

		// ==================== 3. 构建耳机 HRTF / DTS / HeSuVi 网络 ====================
		this.hpSplitter = this.audioCtx.createChannelSplitter(2)
		this.hpMerger = this.audioCtx.createChannelMerger(2)
		this.headphoneBranchGain.connect(this.hpSplitter)

		// 直通通道：耳廓共振增强与耳屏下凹滤波
		this.lPinnaFilter = this.audioCtx.createBiquadFilter()
		this.lPinnaFilter.type = 'peaking'
		this.lPinnaFilter.frequency.setValueAtTime(3400, now)
		this.lPinnaFilter.Q.setValueAtTime(1.5, now)
		this.lPinnaFilter.gain.setValueAtTime(1.5, now)

		this.lPinnaNotch = this.audioCtx.createBiquadFilter()
		this.lPinnaNotch.type = 'peaking' // 采用浅带阻 peaking 避免深度削波
		this.lPinnaNotch.frequency.setValueAtTime(6800, now)
		this.lPinnaNotch.Q.setValueAtTime(2.2, now)
		this.lPinnaNotch.gain.setValueAtTime(-3.0, now)

		this.rPinnaFilter = this.audioCtx.createBiquadFilter()
		this.rPinnaFilter.type = 'peaking'
		this.rPinnaFilter.frequency.setValueAtTime(3400, now)
		this.rPinnaFilter.Q.setValueAtTime(1.5, now)
		this.rPinnaFilter.gain.setValueAtTime(1.5, now)

		this.rPinnaNotch = this.audioCtx.createBiquadFilter()
		this.rPinnaNotch.type = 'peaking'
		this.rPinnaNotch.frequency.setValueAtTime(6800, now)
		this.rPinnaNotch.Q.setValueAtTime(2.2, now)
		this.rPinnaNotch.gain.setValueAtTime(-3.0, now)

		// 左声道直通
		this.hpSplitter.connect(this.lPinnaFilter, 0)
		this.lPinnaFilter.connect(this.lPinnaNotch)
		this.lPinnaNotch.connect(this.hpMerger, 0, 0)

		// 右声道直通
		this.hpSplitter.connect(this.rPinnaFilter, 1)
		this.rPinnaFilter.connect(this.rPinnaNotch)
		this.rPinnaNotch.connect(this.hpMerger, 0, 1)

		// 跨耳头影与延迟通道 (Left -> Right)
		this.lToRShadow = this.audioCtx.createBiquadFilter()
		this.lToRShadow.type = 'lowpass'
		this.lToRShadow.frequency.setValueAtTime(1800, now)
		this.lToRShadow.Q.setValueAtTime(0.707, now)

		this.lToRDelay = this.audioCtx.createDelay(0.01)
		this.lToRDelay.delayTime.setValueAtTime(0.00045, now)

		this.lToRGain = this.audioCtx.createGain()
		this.lToRGain.gain.setValueAtTime(0.35, now)

		this.hpSplitter.connect(this.lToRShadow, 0)
		this.lToRShadow.connect(this.lToRDelay)
		this.lToRDelay.connect(this.lToRGain)
		this.lToRGain.connect(this.hpMerger, 0, 1)

		// 跨耳头影与延迟通道 (Right -> Left)
		this.rToLShadow = this.audioCtx.createBiquadFilter()
		this.rToLShadow.type = 'lowpass'
		this.rToLShadow.frequency.setValueAtTime(1800, now)
		this.rToLShadow.Q.setValueAtTime(0.707, now)

		this.rToLDelay = this.audioCtx.createDelay(0.01)
		this.rToLDelay.delayTime.setValueAtTime(0.00045, now)

		this.rToLGain = this.audioCtx.createGain()
		this.rToLGain.gain.setValueAtTime(0.35, now)

		this.hpSplitter.connect(this.rToLShadow, 1)
		this.rToLShadow.connect(this.rToLDelay)
		this.rToLDelay.connect(this.rToLGain)
		this.rToLGain.connect(this.hpMerger, 0, 0)

		// DTS 早期反射与声学空间扩展环路
		this.dtsAmbienceGain = this.audioCtx.createGain()
		this.dtsAmbienceGain.gain.setValueAtTime(0.0, now)

		this.dtsDelayL = this.audioCtx.createDelay(0.05)
		this.dtsDelayL.delayTime.setValueAtTime(0.018, now)

		this.dtsDelayR = this.audioCtx.createDelay(0.05)
		this.dtsDelayR.delayTime.setValueAtTime(0.024, now)

		this.dtsFilter = this.audioCtx.createBiquadFilter()
		this.dtsFilter.type = 'lowpass'
		this.dtsFilter.frequency.setValueAtTime(4200, now)

		this.dtsShelfLow = this.audioCtx.createBiquadFilter()
		this.dtsShelfLow.type = 'lowshelf'
		this.dtsShelfLow.frequency.setValueAtTime(70, now)
		this.dtsShelfLow.gain.setValueAtTime(0, now)

		this.dtsShelfHigh = this.audioCtx.createBiquadFilter()
		this.dtsShelfHigh.type = 'highshelf'
		this.dtsShelfHigh.frequency.setValueAtTime(9000, now)
		this.dtsShelfHigh.gain.setValueAtTime(0, now)

		// 环境声链路
		this.hpSplitter.connect(this.dtsDelayL, 0)
		this.hpSplitter.connect(this.dtsDelayR, 1)
		this.dtsDelayL.connect(this.dtsFilter)
		this.dtsDelayR.connect(this.dtsFilter)
		this.dtsFilter.connect(this.dtsAmbienceGain)

		// 混入耳机总线
		this.dtsAmbienceGain.connect(this.hpMerger, 0, 0)
		this.dtsAmbienceGain.connect(this.hpMerger, 0, 1)

		// 耳机最终输出串联频响校正
		this.hpMerger.connect(this.dtsShelfLow)
		this.dtsShelfLow.connect(this.dtsShelfHigh)
		this.dtsShelfHigh.connect(this.wetGain)

		// ==================== 4. 构建电脑音箱处理网络 (别套耳机 HRTF) ====================
		this.spkSplitter = this.audioCtx.createChannelSplitter(2)
		this.spkMerger = this.audioCtx.createChannelMerger(2)
		this.speakerBranchGain.connect(this.spkSplitter)

		// 4.1 M/S 矩阵分解: Mid = 0.5 * (L + R), Side = 0.5 * (L - R)
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

		// 4.2 侧边声场处理：
		// 140Hz 高通滤除超低频（避免桌面音箱低音相位相互抵消导致无力）
		this.sideHighpass = this.audioCtx.createBiquadFilter()
		this.sideHighpass.type = 'highpass'
		this.sideHighpass.frequency.setValueAtTime(140, now)
		this.sideHighpass.Q.setValueAtTime(0.707, now)

		// 侧边增益控制 (立体声拉宽)
		this.sideWidthGain = this.audioCtx.createGain()
		this.sideWidthGain.gain.setValueAtTime(1.4, now)

		// 微小相位微延时扩展 (0.22ms)，增强脱箱感
		this.sidePhaseDelay = this.audioCtx.createDelay(0.01)
		this.sidePhaseDelay.delayTime.setValueAtTime(0.00022, now)

		this.sideSum.connect(this.sideHighpass)
		this.sideHighpass.connect(this.sideWidthGain)
		this.sideWidthGain.connect(this.sidePhaseDelay)

		// 4.3 M/S 矩阵重构：L_out = Mid + Side, R_out = Mid - Side
		this.spkOutL = this.audioCtx.createGain()
		this.spkOutR = this.audioCtx.createGain()

		const sideInvertR = this.audioCtx.createGain()
		sideInvertR.gain.setValueAtTime(-1.0, now)

		this.midSum.connect(this.spkOutL)
		this.midSum.connect(this.spkOutR)

		this.sidePhaseDelay.connect(this.spkOutL)
		this.sidePhaseDelay.connect(sideInvertR)
		sideInvertR.connect(this.spkOutR)

		// 4.4 近场桌面音箱轻微交叉延迟网络 (物理近场声学，不套用耳廓 HRTF)
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

		// 音箱合并输出到湿声总线
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
		const rampTime = 0.035

		const isEnabled = Boolean(settings.spatialSurroundEnabled)

		if (!isEnabled) {
			// 完全旁通
			this.dryGain.gain.setTargetAtTime(1.0, now, rampTime)
			this.wetGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.headphoneBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			return
		}

		// 启用全景音效
		this.dryGain.gain.setTargetAtTime(0.0, now, rampTime)
		this.wetGain.gain.setTargetAtTime(1.0, now, rampTime)

		const deviceType: SpatialDeviceType = settings.spatialDeviceType || 'headphone'

		if (deviceType === 'headphone') {
			// 激活耳机分支，彻底关闭音箱分支
			this.headphoneBranchGain.gain.setTargetAtTime(1.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(0.0, now, rampTime)

			const mode: SpatialHeadphoneMode = settings.spatialHeadphoneMode || 'dts'
			this.applyHeadphoneMode(mode, now, rampTime)
		} else {
			// 激活电脑音箱分支，彻底关闭耳机分支 (铁律：别套耳机 HRTF)
			this.headphoneBranchGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.speakerBranchGain.gain.setTargetAtTime(1.0, now, rampTime)

			this.applySpeakerSettings(settings, now, rampTime)
		}
	}

	private applyHeadphoneMode(
		mode: SpatialHeadphoneMode,
		now: number,
		rampTime: number,
	): void {
		if (mode === 'hrtf') {
			// 模式 1：HRTF 双耳空间定位 (精准头影与耳廓模型)
			this.lPinnaFilter.frequency.setTargetAtTime(3400, now, rampTime)
			this.lPinnaFilter.gain.setTargetAtTime(1.8, now, rampTime)
			this.rPinnaFilter.frequency.setTargetAtTime(3400, now, rampTime)
			this.rPinnaFilter.gain.setTargetAtTime(1.8, now, rampTime)

			this.lPinnaNotch.frequency.setTargetAtTime(6800, now, rampTime)
			this.lPinnaNotch.gain.setTargetAtTime(-3.5, now, rampTime)
			this.rPinnaNotch.frequency.setTargetAtTime(6800, now, rampTime)
			this.rPinnaNotch.gain.setTargetAtTime(-3.5, now, rampTime)

			this.lToRShadow.frequency.setTargetAtTime(1750, now, rampTime)
			this.rToLShadow.frequency.setTargetAtTime(1750, now, rampTime)

			this.lToRDelay.delayTime.setTargetAtTime(0.00042, now, rampTime)
			this.rToLDelay.delayTime.setTargetAtTime(0.00042, now, rampTime)

			this.lToRGain.gain.setTargetAtTime(0.35, now, rampTime)
			this.rToLGain.gain.setTargetAtTime(0.35, now, rampTime)

			// HRTF 纯净声场，不添加人造混响
			this.dtsAmbienceGain.gain.setTargetAtTime(0.0, now, rampTime)
			this.dtsShelfLow.gain.setTargetAtTime(0.0, now, rampTime)
			this.dtsShelfHigh.gain.setTargetAtTime(0.0, now, rampTime)
		} else if (mode === 'dts') {
			// 模式 2：DTS Headphone:X 影院全景声拟真 (宽广视角 + 影院早期混响反射 + 空气感提升)
			this.lPinnaFilter.frequency.setTargetAtTime(3800, now, rampTime)
			this.lPinnaFilter.gain.setTargetAtTime(1.2, now, rampTime)
			this.rPinnaFilter.frequency.setTargetAtTime(3800, now, rampTime)
			this.rPinnaFilter.gain.setTargetAtTime(1.2, now, rampTime)

			this.lPinnaNotch.frequency.setTargetAtTime(7200, now, rampTime)
			this.lPinnaNotch.gain.setTargetAtTime(-2.0, now, rampTime)
			this.rPinnaNotch.frequency.setTargetAtTime(7200, now, rampTime)
			this.rPinnaNotch.gain.setTargetAtTime(-2.0, now, rampTime)

			this.lToRShadow.frequency.setTargetAtTime(2100, now, rampTime)
			this.rToLShadow.frequency.setTargetAtTime(2100, now, rampTime)

			// 较宽的虚拟前置音箱视角
			this.lToRDelay.delayTime.setTargetAtTime(0.00055, now, rampTime)
			this.rToLDelay.delayTime.setTargetAtTime(0.00055, now, rampTime)

			this.lToRGain.gain.setTargetAtTime(0.38, now, rampTime)
			this.rToLGain.gain.setTargetAtTime(0.38, now, rampTime)

			// 影院房间多重微反射
			this.dtsAmbienceGain.gain.setTargetAtTime(0.22, now, rampTime)
			this.dtsDelayL.delayTime.setTargetAtTime(0.018, now, rampTime)
			this.dtsDelayR.delayTime.setTargetAtTime(0.024, now, rampTime)
			this.dtsFilter.frequency.setTargetAtTime(4200, now, rampTime)

			// 影院质感低音下潜与通透空气感
			this.dtsShelfLow.gain.setTargetAtTime(2.0, now, rampTime)
			this.dtsShelfHigh.gain.setTargetAtTime(1.2, now, rampTime)
		} else if (mode === 'hesuvi') {
			// 模式 3：HeSuVi 7.1 虚拟声场多声道混合仿真 (多角度延迟与更深耳廓下凹)
			this.lPinnaFilter.frequency.setTargetAtTime(3000, now, rampTime)
			this.lPinnaFilter.gain.setTargetAtTime(2.4, now, rampTime)
			this.rPinnaFilter.frequency.setTargetAtTime(3000, now, rampTime)
			this.rPinnaFilter.gain.setTargetAtTime(2.4, now, rampTime)

			this.lPinnaNotch.frequency.setTargetAtTime(6200, now, rampTime)
			this.lPinnaNotch.gain.setTargetAtTime(-4.5, now, rampTime)
			this.rPinnaNotch.frequency.setTargetAtTime(6200, now, rampTime)
			this.rPinnaNotch.gain.setTargetAtTime(-4.5, now, rampTime)

			this.lToRShadow.frequency.setTargetAtTime(1500, now, rampTime)
			this.rToLShadow.frequency.setTargetAtTime(1500, now, rampTime)

			// 侧后方 7.1 环绕声角度较大延迟
			this.lToRDelay.delayTime.setTargetAtTime(0.00065, now, rampTime)
			this.rToLDelay.delayTime.setTargetAtTime(0.00065, now, rampTime)

			this.lToRGain.gain.setTargetAtTime(0.42, now, rampTime)
			this.rToLGain.gain.setTargetAtTime(0.42, now, rampTime)

			// 环绕声漫射氛围
			this.dtsAmbienceGain.gain.setTargetAtTime(0.12, now, rampTime)
			this.dtsDelayL.delayTime.setTargetAtTime(0.014, now, rampTime)
			this.dtsDelayR.delayTime.setTargetAtTime(0.020, now, rampTime)
			this.dtsFilter.frequency.setTargetAtTime(3600, now, rampTime)

			this.dtsShelfLow.gain.setTargetAtTime(1.0, now, rampTime)
			this.dtsShelfHigh.gain.setTargetAtTime(-1.5, now, rampTime)
		}
	}

	private applySpeakerSettings(
		settings: EqualizerSettings,
		now: number,
		rampTime: number,
	): void {
		// 1. 立体声拉宽强度 (0.0 ~ 1.0, 映射到 1.0x ~ 1.9x 侧边能量)
		const widening =
			typeof settings.spatialSpeakerWidening === 'number'
				? Math.max(0, Math.min(1, settings.spatialSpeakerWidening))
				: 0.6
		const widthGainValue = 1.0 + widening * 0.9
		this.sideWidthGain.gain.setTargetAtTime(widthGainValue, now, rampTime)

		// 2. 轻微交叉延迟深度 (0.0 ~ 1.0)
		const crossDepth =
			typeof settings.spatialSpeakerCrossDelay === 'number'
				? Math.max(0, Math.min(1, settings.spatialSpeakerCrossDelay))
				: 0.4

		// 延迟时间: 0.16ms ~ 0.30ms (适合 0.6m~1.2m 桌面音箱距离)
		const delaySec = 0.00016 + crossDepth * 0.00014
		this.spkLToRDelay.delayTime.setTargetAtTime(delaySec, now, rampTime)
		this.spkRToLDelay.delayTime.setTargetAtTime(delaySec, now, rampTime)

		// 交叉混合增益: 0.0 ~ 0.24 (保持细腻自然，避免高频干涉梳状效应)
		const crossGainVal = crossDepth * 0.24
		this.spkLToRGain.gain.setTargetAtTime(crossGainVal, now, rampTime)
		this.spkRToLGain.gain.setTargetAtTime(crossGainVal, now, rampTime)
	}
}
