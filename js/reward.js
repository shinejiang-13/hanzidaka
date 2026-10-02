/**
 * 奖励模块
 * 三部分奖励：
 *   1. 完成度奖励：当日书写平均得分 ≥ 0.9，奖励 1 元
 *   2. 连续打卡奖励：每连续打卡 10 天，奖励 5 元 + (连续天数/10 取整) 元
 *   3. 荣誉奖励：累计奖励达到 10/20/40/80/160/320/640/1280 元，授予对应称号
 */
const Reward = (function () {
  // 荣誉称号档次（阈值, 称号）
  const TIERS = [
    { threshold: 10,   name: '识墨学徒' },
    { threshold: 20,   name: '辨字书生' },
    { threshold: 40,   name: '拾字童生' },
    { threshold: 80,   name: '阅字秀才' },
    { threshold: 160,  name: '品字举人' },
    { threshold: 320,  name: '观字进士' },
    { threshold: 640,  name: '通字翰林' },
    { threshold: 1280, name: '字圣先生' },
  ];

  const COMPLETION_THRESHOLD = 0.9;  // 完成度奖励得分阈值
  const COMPLETION_AMOUNT = 1;       // 完成度奖励金额（元）
  const STREAK_BASE = 5;             // 连续打卡基础奖励（元）
  const STREAK_STEP = 10;            // 连续打卡奖励间隔（天）

  /**
   * 检查并发放当日完成度奖励
   * 当当日所有书写得分的平均值 ≥ 0.9 时，奖励 1 元（每日仅一次）
   * @returns {number} 本次发放的金额（0 或 1）
   */
  function checkCompletionReward() {
    const scores = Store.getTodayScores();
    if (scores.length === 0) return 0;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < COMPLETION_THRESHOLD) return 0;

    const rewards = Store.getRewards();
    const today = SRS.today();
    if (rewards.awardedDays.includes(today)) return 0;

    rewards.completionTotal += COMPLETION_AMOUNT;
    rewards.awardedDays.push(today);
    Store.saveRewards(rewards);
    return COMPLETION_AMOUNT;
  }

  /**
   * 检查并发放连续打卡奖励
   * 每连续打卡 10 天，奖励 5 + (连续天数/10) 元
   * @param {number} streak 当前连续打卡天数
   * @returns {number} 本次发放的金额
   */
  function checkStreakReward(streak) {
    if (streak < STREAK_STEP) return 0;

    const rewards = Store.getRewards();
    let total = 0;
    // 检查所有已达到但未发放的里程碑
    for (let milestone = STREAK_STEP; milestone <= streak; milestone += STREAK_STEP) {
      if (rewards.streakMilestones.includes(milestone)) continue;
      const amount = STREAK_BASE + Math.floor(milestone / STREAK_STEP);
      rewards.streakTotal += amount;
      rewards.streakMilestones.push(milestone);
      total += amount;
    }
    if (total > 0) Store.saveRewards(rewards);
    return total;
  }

  /**
   * 根据累计奖励金额获取当前荣誉称号
   * @returns {{threshold:number, name:string}|null}
   */
  function getHonorTier() {
    const rewards = Store.getRewards();
    const total = rewards.completionTotal + rewards.streakTotal;
    let tier = null;
    for (const t of TIERS) {
      if (total >= t.threshold) tier = t;
    }
    return tier;
  }

  /** 获取奖励汇总信息 */
  function getSummary() {
    const rewards = Store.getRewards();
    const total = rewards.completionTotal + rewards.streakTotal;
    const tier = getHonorTier();
    // 下一档次
    let nextTier = null;
    for (const t of TIERS) {
      if (t.threshold > total) { nextTier = t; break; }
    }
    return {
      completionTotal: rewards.completionTotal,
      streakTotal: rewards.streakTotal,
      total,
      tier,
      nextTier,
    };
  }

  /** 获取所有档次（用于展示进度） */
  function getTiers() {
    return TIERS;
  }

  return {
    TIERS,
    checkCompletionReward,
    checkStreakReward,
    getHonorTier,
    getSummary,
    getTiers,
  };
})();
