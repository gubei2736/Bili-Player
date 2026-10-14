export function gaussian(x: number, sigma: number): number {
	return Math.exp(-(x * x) / (2 * sigma * sigma))
}

export function lcs(s1: string, s2: string): number {
	const m = s1.length
	const n = s2.length
	const dp: number[][] = Array.from({ length: m + 1 }, (): number[] =>
		new Array<number>(n + 1).fill(0),
	)

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (s1[i - 1] === s2[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
			}
		}
	}

	return dp[m][n]
}

export function lcsScore(s1: string, s2: string): number {
	if (s1.length === 0 || s2.length === 0) return 0
	const lcsLen = lcs(s1, s2)
	return lcsLen / Math.max(s1.length, s2.length)
}

export function cleanString(str: string): string {
	return str.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '')
}

export function parseDurationString(durationStr: string): number {
	const parts = durationStr.split(':').map(Number)
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2]
	} else if (parts.length === 2) {
		return parts[0] * 60 + parts[1]
	}
	return 0
}
