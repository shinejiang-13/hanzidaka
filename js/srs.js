/**
 * 记忆曲线 (SRS - Spaced Repetition System)
 * 基于艾宾浩斯遗忘曲线 + SM-2 算法的动态复习调度
 *
 * 艾宾浩斯基础复习间隔: 1天 → 2天 → 4天 → 7天 → 15天 → 30天 → 60天
 * 用户根据记忆情况打分，算法动态调整下次复习间隔与难度因子。
 */
const SRS = (function () {
  // 艾宾浩斯基础间隔（天）
  const BASE_INTERVALS = [1, 2, 4, 7, 15, 30, 60];
  const MAX_LEVEL = BASE_INTERVALS.length - 1;

  // 评分对应动作
  const RATING = {
    FORGOT: 0,   // 忘记了
    HARD: 1,     // 勉强记得
    GOOD: 2,     // 记得
    EASY: 3,     // 很熟悉
  };

  /** 本地时间格式化为 YYYY-MM-DD（避免 toISOString 的 UTC 时区偏移） */
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 今天的日期字符串 YYYY-MM-DD */
  function today() {
    return formatDate(new Date());
  }

  /** 在指定日期上增加 days 天 */
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }

  /** 计算两个日期相差的天数 */
  function diffDays(a, b) {
    const d1 = new Date(a + 'T00:00:00');
    const d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  /**
   * 初始化一个汉字的学习状态
   */
  function createState(char) {
    return {
      char,
      level: 0,              // 当前熟练度等级 (0 ~ MAX_LEVEL)
      ease: 2.5,             // 难度因子 (SM-2)
      interval: 0,           // 当前间隔（天）
      lastReview: null,      // 上次复习日期
      nextReview: today(),   // 下次复习日期（新字立即可学）
      repetitions: 0,        // 总复习次数
      status: 'new',         // new | learning | mastered
    };
  }

  /**
   * 根据用户评分更新学习状态
   * @param {object} state  当前状态
   * @param {number} rating 评分 0-3 (RATING)
   * @returns {object} 更新后的状态
   */
  function review(state, rating) {
    const now = today();
    const s = { ...state };
    s.repetitions += 1;
    s.lastReview = now;

    if (rating === RATING.FORGOT) {
      // 忘记：重置到第一级
      s.level = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.interval = BASE_INTERVALS[0];
      s.status = 'learning';
    } else if (rating === RATING.HARD) {
      s.ease = Math.max(1.3, s.ease - 0.15);
      s.level = Math.min(MAX_LEVEL, s.level); // 不升级
      s.interval = Math.max(1, Math.round(BASE_INTERVALS[s.level] * 0.8));
      s.status = 'learning';
    } else if (rating === RATING.GOOD) {
      s.level = Math.min(MAX_LEVEL, s.level + 1);
      s.interval = BASE_INTERVALS[s.level];
      s.status = s.level >= MAX_LEVEL ? 'mastered' : 'learning';
    } else {
      // EASY
      s.ease = Math.min(3.0, s.ease + 0.1);
      s.level = Math.min(MAX_LEVEL, s.level + 1);
      s.interval = Math.round(BASE_INTERVALS[s.level] * 1.3);
      s.status = s.level >= MAX_LEVEL ? 'mastered' : 'learning';
    }

    s.nextReview = addDays(now, s.interval);
    return s;
  }

  /** 是否今天需要复习 */
  function isDue(state) {
    if (!state.nextReview) return true;
    return diffDays(today(), state.nextReview) >= 0;
  }

  /** 距离下次复习还有几天（负数表示已逾期） */
  function daysUntilReview(state) {
    if (!state.nextReview) return 0;
    return diffDays(today(), state.nextReview);
  }

  /** 获取熟练度描述 */
  function getLevelLabel(state) {
    const labels = ['初识', '初学', '巩固', '记忆', '熟悉', '牢记', '精通'];
    return labels[Math.min(state.level, labels.length - 1)];
  }

  return {
    BASE_INTERVALS,
    MAX_LEVEL,
    RATING,
    today,
    addDays,
    diffDays,
    createState,
    review,
    isDue,
    daysUntilReview,
    getLevelLabel,
  };
})();
