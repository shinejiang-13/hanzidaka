/**
 * 本地存储模块
 * 使用 localStorage 持久化：
 *   - 每个汉字的学习状态
 *   - 每日打卡记录（学了哪些字、哪天学的）
 */
const Store = (function () {
  const KEY_STATE = 'hanzi_srs_states';     // { char: state }
  const KEY_CHECKIN = 'hanzi_checkins';     // { 'YYYY-MM-DD': [char, ...] }
  const KEY_CURRENT_GRADE = 'hanzi_current_grade';
  const KEY_DAILY_SCORES = 'hanzi_daily_scores'; // { 'YYYY-MM-DD': [score, ...] }
  const KEY_REWARDS = 'hanzi_rewards';       // { completionTotal, streakTotal, awardedDays, streakMilestones }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getStates() {
    return load(KEY_STATE, {});
  }

  function setState(char, state) {
    const all = getStates();
    all[char] = state;
    save(KEY_STATE, all);
  }

  function getState(char) {
    return getStates()[char] || null;
  }

  function getCheckins() {
    return load(KEY_CHECKIN, {});
  }

  function addCheckin(char) {
    const all = getCheckins();
    const today = SRS.today();
    if (!all[today]) all[today] = [];
    if (!all[today].includes(char)) all[today].push(char);
    save(KEY_CHECKIN, all);
  }

  function getTodayCheckins() {
    return getCheckins()[SRS.today()] || [];
  }

  function getCurrentGrade() {
    return load(KEY_CURRENT_GRADE, 1);
  }

  function setCurrentGrade(grade) {
    save(KEY_CURRENT_GRADE, grade);
  }

  // ---------- 每日得分 ----------
  function getDailyScores() {
    return load(KEY_DAILY_SCORES, {});
  }

  function addDailyScore(score) {
    const all = getDailyScores();
    const today = SRS.today();
    if (!all[today]) all[today] = [];
    all[today].push(score);
    save(KEY_DAILY_SCORES, all);
  }

  function getTodayScores() {
    return getDailyScores()[SRS.today()] || [];
  }

  // ---------- 奖励 ----------
  function getRewards() {
    return load(KEY_REWARDS, {
      completionTotal: 0,
      streakTotal: 0,
      awardedDays: [],
      streakMilestones: [],
    });
  }

  function saveRewards(r) {
    save(KEY_REWARDS, r);
  }

  function getAllDoneCount() {
    const states = getStates();
    return Object.values(states).filter(s => s.status === 'mastered').length;
  }

  function getLearningCount() {
    const states = getStates();
    return Object.values(states).filter(s => s.status === 'learning').length;
  }

  /** 获取连续打卡天数 */
  function getStreak() {
    const checkins = getCheckins();
    const dates = Object.keys(checkins).filter(d => checkins[d].length > 0).sort();
    if (dates.length === 0) return 0;
    let streak = 0;
    let cursor = new Date();
    // 如果今天没打卡，从昨天开始算
    const today = SRS.today();
    if (!checkins[today]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (true) {
      const ds = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
      if (checkins[ds] && checkins[ds].length > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function reset() {
    localStorage.removeItem(KEY_STATE);
    localStorage.removeItem(KEY_CHECKIN);
    localStorage.removeItem(KEY_DAILY_SCORES);
    localStorage.removeItem(KEY_REWARDS);
  }

  return {
    getStates, setState, getState,
    getCheckins, addCheckin, getTodayCheckins,
    getCurrentGrade, setCurrentGrade,
    getDailyScores, addDailyScore, getTodayScores,
    getRewards, saveRewards,
    getAllDoneCount, getLearningCount, getStreak,
    reset,
  };
})();
