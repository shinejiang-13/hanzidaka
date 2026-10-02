/**
 * 汉字打卡 - 主应用逻辑
 * 流程: 主页(今日任务) → 学习(笔顺动画+拼音+组词) → 手写打卡 → 评分 → 记忆曲线调度
 */
(function () {
  'use strict';

  // ---------- 全局状态 ----------
  let currentGrade = Store.getCurrentGrade();
  let currentQueue = [];   // 今日待处理汉字队列
  let queueGrade = null;   // 当前队列对应的年级（用于判断是否需要重建）
  let currentIndex = 0;
  let currentHanzi = null;
  let writer = null;       // hanziwriter 实例
  let pad = null;          // 手写画板实例

  // ---------- DOM 引用 ----------
  const $ = id => document.getElementById(id);
  const views = {
    home: $('view-home'),
    learn: $('view-learn'),
    write: $('view-write'),
    stats: $('view-stats'),
    reward: $('view-reward'),
  };

  // ---------- 数据辅助 ----------
  function getByGrade(grade) {
    return HANZI_DATA.filter(h => h.grade === grade);
  }

  function getGrades() {
    const grades = [...new Set(HANZI_DATA.map(h => h.grade))];
    return grades.sort((a, b) => a - b);
  }

  // ---------- 视图切换 ----------
  function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[name].classList.add('active');
    // 切换导航高亮
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navMap = { home: 'nav-home', stats: 'nav-stats', reward: 'nav-reward' };
    if (navMap[name]) $(navMap[name]).classList.add('active');
    if (name === 'home') renderHome();
    if (name === 'stats') renderStats();
    if (name === 'reward') renderRewards();
  }

  // ---------- 主页 ----------
  function renderHome() {
    $('grade-select').value = currentGrade;
    // 仅当年级变化时重建队列，保留用户对清单的增删编辑
    if (queueGrade !== currentGrade) {
      buildTodayQueue();
      queueGrade = currentGrade;
    }

    const due = currentQueue;
    const todayCount = Store.getTodayCheckins().length;
    const streak = Store.getStreak();
    const mastered = Store.getAllDoneCount();
    const learning = Store.getLearningCount();
    const total = HANZI_DATA.length;

    $('stat-today').textContent = todayCount;
    $('stat-streak').textContent = streak;
    $('stat-due').textContent = due.length;
    $('stat-mastered').textContent = mastered;
    $('stat-progress').textContent = `${mastered}/${total}`;
    $('bar-progress').style.width = `${total ? Math.round(mastered / total * 100) : 0}%`;

    // 待学列表
    const list = $('due-list');
    list.innerHTML = '';
    if (due.length === 0) {
      list.innerHTML = '<div class="empty">清单为空，请在下方添加汉字</div>';
    } else {
      due.forEach((h, idx) => {
        const item = document.createElement('div');
        item.className = 'due-item';
        const state = Store.getState(h.char);
        const label = state ? SRS.getLevelLabel(state) : '新字';
        const tag = state && state.status === 'new' ? 'new-tag' : 'review-tag';
        item.innerHTML = `
          <button class="due-remove" data-idx="${idx}" title="移除">×</button>
          <span class="due-char">${h.char}</span>
          <span class="due-pinyin">${h.pinyin}</span>
          <span class="due-tag ${tag}">${label}</span>
        `;
        list.appendChild(item);
      });
    }

    $('btn-start').disabled = due.length === 0;
    $('btn-start').textContent = due.length === 0 ? '清单为空' : `开始学习 (${due.length})`;
  }

  /** 构建今日队列：到期复习的字 + 新字 */
  function buildTodayQueue() {
    const gradeChars = getByGrade(currentGrade);
    const states = Store.getStates();

    const due = [];
    const fresh = [];
    gradeChars.forEach(h => {
      const s = states[h.char];
      if (!s) {
        fresh.push(h);
      } else if (SRS.isDue(s)) {
        due.push(h);
      }
    });
    // 先复习到期的，再学新字（每天最多 5 个新字）
    currentQueue = due.concat(fresh.slice(0, 5));
    currentIndex = 0;
  }

  /** 从清单中移除指定索引的字 */
  function removeFromQueue(idx) {
    currentQueue.splice(idx, 1);
    renderHome();
  }

  /** 按年级汉字列表顺序，添加下一个不在清单中的字 */
  function addToQueue() {
    const gradeChars = getByGrade(currentGrade);
    const queueChars = new Set(currentQueue.map(h => h.char));
    const next = gradeChars.find(h => !queueChars.has(h.char));
    if (!next) {
      alert('当前年级汉字已全部在清单中');
      return;
    }
    currentQueue.push(next);
    renderHome();
  }

  /** 重置清单为默认（到期复习 + 新字） */
  function resetQueue() {
    buildTodayQueue();
    renderHome();
  }

  // ---------- 学习流程 ----------
  function startLearning() {
    if (currentQueue.length === 0) {
      alert('清单为空，请先添加汉字！');
      return;
    }
    currentIndex = 0;
    showCurrentHanzi();
    showView('learn');
  }

  function showCurrentHanzi() {
    if (currentIndex >= currentQueue.length) {
      // 今日队列完成
      finishToday();
      return;
    }
    currentHanzi = currentQueue[currentIndex];
    const h = currentHanzi;

    $('learn-char').textContent = h.char;
    $('learn-pinyin').textContent = h.pinyin;
    $('learn-grade').textContent = `${h.grade}年级`;
    $('learn-words').innerHTML = h.words.map(w => `<span class="word-chip">${w}</span>`).join('');

    // 笔顺名称
    $('stroke-names').innerHTML = h.strokes.map((s, i) =>
      `<span class="stroke-step"><b>${i + 1}</b>${s}</span>`
    ).join('');

    // 状态信息
    const state = Store.getState(h.char);
    if (state) {
      $('learn-level').textContent = `熟练度: ${SRS.getLevelLabel(state)} · 已复习${state.repetitions}次`;
    } else {
      $('learn-level').textContent = '新字 · 首次学习';
    }

    // 笔顺动画
    if (writer) writer = null;
    $('writer-target').innerHTML = '';
    $('writer-target').dataset.char = h.char;
    loadWriter(h.char);

    // 重置手写板 & 评分区
    if (pad) pad.clear();
    $('rating-area').classList.add('hidden');
    $('btn-finish-write').disabled = true;

    // 同步手写页提示信息
    $('write-char').textContent = h.char;
    $('write-pinyin').textContent = h.pinyin;
    // 重置提示可见性（默认隐藏）
    const hintLeft = document.querySelector('.write-hint-left');
    if (hintLeft) hintLeft.style.display = 'none';
    const toggleBtn = $('btn-toggle-hint');
    if (toggleBtn) toggleBtn.textContent = '👁️ 显示提示';

    $('progress-text').textContent = `${currentIndex + 1} / ${currentQueue.length}`;
    $('write-progress-text').textContent = `${currentIndex + 1} / ${currentQueue.length}`;
  }

  // ---------- 跳转到手写打卡页 ----------
  function goWrite() {
    showView('write');
    if (pad) pad.clear();
    $('rating-area').classList.add('hidden');
    $('btn-finish-write').disabled = true;
  }

  // ---------- 返回笔顺学习页 ----------
  function goBackToLearn() {
    showView('learn');
  }

  // ---------- 切换汉字提示显隐 ----------
  function toggleHint() {
    const hintLeft = document.querySelector('.write-hint-left');
    const btn = $('btn-toggle-hint');
    if (hintLeft.style.display === 'none') {
      hintLeft.style.display = '';
      btn.textContent = '🙈 隐藏提示';
    } else {
      hintLeft.style.display = 'none';
      btn.textContent = '👁️ 显示提示';
    }
  }

  function loadWriter(char) {
    if (typeof HanziWriter === 'undefined') {
      $('writer-target').innerHTML = '<div class="writer-fallback">' + char + '</div>';
      return;
    }
    try {
      writer = HanziWriter.create('writer-target', char, {
        width: 220,
        height: 220,
        padding: 10,
        showOutline: true,
        strokeColor: '#2c3e50',
        outlineColor: '#dfe6e9',
        radicalColor: '#e17055',
        delayBetweenStrokes: 200,
        // 加载完成后自动循环演示笔顺
        onLoadCharDataSuccess: () => {
          writer.loopCharacterAnimation();
        },
      });
    } catch (e) {
      $('writer-target').innerHTML = '<div class="writer-fallback">' + char + '</div>';
    }
  }

  function playStroke() {
    // 重播：先暂停当前循环，再单次演示一遍
    if (writer) {
      writer.cancelQuiz();
      writer.animateCharacter();
    }
  }

  function quizStroke() {
    if (!writer) return;
    writer.quiz({
      onMistake: (data) => {
        $('quiz-hint').textContent = '笔画不对，再试试～';
      },
      onCorrectStroke: () => {
        $('quiz-hint').textContent = '✓ 正确！';
      },
      onComplete: () => {
        $('quiz-hint').textContent = '🎉 全部笔画正确！';
      },
    });
  }

  function onInkChange() {
    $('btn-finish-write').disabled = !pad.hasInk();
  }

  /**
   * 笔画名称 → 期望方向（起止点向量方向）
   * 方向: E=东(横) S=南(竖) SW=西南(撇) SE=东南(捺/点) NE=东北(提)
   * 复合笔画取主笔方向
   */
  const STROKE_DIR = {
    '横': ['E'], '竖': ['S'], '撇': ['SW'], '捺': ['SE'],
    '点': ['SE', 'S'], '提': ['NE'],
    '横折': ['E'], '竖折': ['S'], '撇折': ['SW'], '横撇': ['E'],
    '横钩': ['E'], '竖钩': ['S'], '斜钩': ['SE'], '卧钩': ['SE'],
    '竖弯钩': ['S'], '横折钩': ['E'], '横撇弯钩': ['E'], '横折提': ['E'],
    '竖折折钩': ['S'], '横折折撇': ['E'], '撇点': ['SW'],
    '竖提': ['S'], '横折弯': ['E'],
  };

  /** 将向量 (dx, dy) 归类为方向 */
  function dirOf(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 8) return null; // 太短，视为点/无效
    const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180~180
    if (angle >= -22.5 && angle < 22.5) return 'E';
    if (angle >= 22.5 && angle < 67.5) return 'SE';
    if (angle >= 67.5 && angle < 112.5) return 'S';
    if (angle >= 112.5 && angle < 157.5) return 'SW';
    if (angle >= -67.5 && angle < -22.5) return 'NE';
    if (angle >= -112.5 && angle < -67.5) return 'N';
    if (angle >= -157.5 && angle < -112.5) return 'NW';
    return 'W';
  }

  /** 计算笔顺正确率 */
  function calcStrokeOrderAccuracy(userStrokes, standardStrokes) {
    if (!userStrokes || userStrokes.length === 0) return 0;
    const n = Math.min(userStrokes.length, standardStrokes.length);
    let correct = 0;
    for (let i = 0; i < n; i++) {
      const s = userStrokes[i];
      const dir = dirOf(s.end.x - s.start.x, s.end.y - s.start.y);
      const expect = STROKE_DIR[standardStrokes[i]] || null;
      // 方向匹配，或该笔太短（点）视为正确
      if (dir === null || (expect && expect.includes(dir))) correct++;
    }
    return correct / standardStrokes.length; // 以标准笔画数为分母
  }

  /** 综合笔画数与笔顺正确率自动评分 */
  function autoScore() {
    const drawn = pad.getStrokeCount();
    const expected = currentHanzi.strokes.length;
    const userStrokes = pad.getStrokes();
    const diff = Math.abs(drawn - expected);
    const orderAcc = calcStrokeOrderAccuracy(userStrokes, currentHanzi.strokes);

    // 综合得分: 笔画数占 40%，笔顺正确率占 60%
    let countScore;
    if (drawn === 0) countScore = 0;
    else if (diff === 0) countScore = 1;
    else if (diff === 1) countScore = 0.7;
    else if (diff <= 3) countScore = 0.4;
    else countScore = 0.1;

    const total = countScore * 0.4 + orderAcc * 0.6;

    let rating, label, emoji, color;
    if (drawn === 0) {
      rating = SRS.RATING.FORGOT; label = '未书写'; emoji = '😵'; color = '#ff7675';
    } else if (total >= 0.9) {
      rating = SRS.RATING.EASY; label = '笔画与笔顺都正确'; emoji = '🤩'; color = '#74b9ff';
    } else if (total >= 0.7) {
      rating = SRS.RATING.GOOD; label = '基本正确，笔顺尚可'; emoji = '😊'; color = '#55efc4';
    } else if (total >= 0.4) {
      rating = SRS.RATING.HARD; label = '笔画或笔顺出入较大'; emoji = '😣'; color = '#fdcb6e';
    } else {
      rating = SRS.RATING.FORGOT; label = '笔画与笔顺都需加强'; emoji = '😵'; color = '#ff7675';
    }

    const orderPct = Math.round(orderAcc * 100);
    const box = $('auto-score');
    box.innerHTML = `
      <div class="score-emoji" style="color:${color}">${emoji}</div>
      <div class="score-detail">
        <div class="score-strokes">你写了 <b>${drawn}</b> 笔 / 标准 <b>${expected}</b> 笔</div>
        <div class="score-strokes">笔顺正确率 <b>${orderPct}%</b></div>
        <div class="score-label" style="color:${color}">自动评为：${label}</div>
      </div>
    `;
    return { rating, score: total };
  }

  function finishWriting() {
    if (!pad.hasInk()) {
      alert('请先在田字格中书写汉字');
      return;
    }
    // 自动评分
    const { rating, score } = autoScore();
    $('rating-area').classList.remove('hidden');

    // 1.6 秒后自动提交评分并进入下一字
    setTimeout(() => {
      rate(rating, score);
    }, 1600);
  }

  function rate(rating, score) {
    const char = currentHanzi.char;
    let state = Store.getState(char);
    if (!state) state = SRS.createState(char);
    state = SRS.review(state, rating);
    Store.setState(char, state);
    Store.addCheckin(char);

    // 记录今日得分，并检查奖励
    if (typeof score === 'number') Store.addDailyScore(score);
    Reward.checkCompletionReward();
    const streak = Store.getStreak();
    Reward.checkStreakReward(streak);

    currentIndex++;
    showCurrentHanzi();
    showView('learn');
  }

  function finishToday() {
    showView('home');
    renderHome();
    setTimeout(() => {
      alert('🎉 今日学习任务全部完成！明天根据记忆曲线继续复习。');
    }, 300);
  }

  function skipCurrent() {
    currentIndex++;
    showCurrentHanzi();
    showView('learn');
  }

  // ---------- 统计页 ----------
  function renderStats() {
    const states = Store.getStates();
    const checkins = Store.getCheckins();
    const mastered = Object.values(states).filter(s => s.status === 'mastered').length;
    const learning = Object.values(states).filter(s => s.status === 'learning').length;
    const fresh = getByGrade(currentGrade).length - Object.keys(states).length;
    const total = HANZI_DATA.length;

    $('stats-mastered').textContent = mastered;
    $('stats-learning').textContent = learning;
    $('stats-fresh').textContent = Math.max(0, fresh);
    $('stats-total').textContent = total;

    // 打卡日历（最近 35 天）
    renderCalendar(checkins);

    // 各年级进度
    const gradeProgress = getGrades().map(g => {
      const chars = getByGrade(g);
      const done = chars.filter(c => states[c.char] && states[c.char].status === 'mastered').length;
      return { grade: g, done, total: chars.length };
    });
    $('grade-progress').innerHTML = gradeProgress.map(g => `
      <div class="gp-row">
        <span class="gp-grade">${g.grade}年级</span>
        <div class="gp-bar"><div style="width:${g.total ? Math.round(g.done / g.total * 100) : 0}%"></div></div>
        <span class="gp-num">${g.done}/${g.total}</span>
      </div>
    `).join('');
  }

  function renderRewards() {
    const summary = Reward.getSummary();
    const total = summary.total;

    // 称号 & 下一档次提示
    if (summary.tier) {
      $('reward-honor-name').textContent = summary.tier.name;
      $('reward-honor-name').classList.add('honored');
      $('honor-seal').textContent = summary.tier.name.charAt(0);
      $('honor-seal').classList.add('sealed');
    } else {
      $('reward-honor-name').textContent = '尚未获得称号';
      $('reward-honor-name').classList.remove('honored');
      $('honor-seal').textContent = '墨';
      $('honor-seal').classList.remove('sealed');
    }

    if (summary.nextTier) {
      $('reward-honor-next').textContent = `距「${summary.nextTier.name}」还需 ${summary.nextTier.threshold - total} 元`;
    } else {
      $('reward-honor-next').textContent = '已臻化境，字圣先生 🎉';
    }

    // 奖励金额
    $('reward-completion').textContent = summary.completionTotal;
    $('reward-streak').textContent = summary.streakTotal;
    $('reward-total-big').textContent = total;

    // 累计进度条
    const nextThreshold = summary.nextTier ? summary.nextTier.threshold : summary.tier ? summary.tier.threshold : 10;
    $('reward-next-threshold').textContent = nextThreshold;
    const prevThreshold = summary.tier ? summary.tier.threshold : 0;
    const range = nextThreshold - prevThreshold;
    const progress = range > 0 ? Math.min(100, Math.max(0, ((total - prevThreshold) / range) * 100)) : 100;
    $('honor-progress-fill').style.width = progress + '%';

    // 称号阶梯
    const tiers = Reward.getTiers();
    $('tier-ladder').innerHTML = tiers.map((t, idx) => {
      const reached = total >= t.threshold;
      const prevT = idx === 0 ? 0 : tiers[idx - 1].threshold;
      const w = t.threshold - prevT;
      // 当前所在档的进度条填充
      let fill = 0;
      if (total >= t.threshold) fill = 100;
      else if (total > prevT) fill = ((total - prevT) / w) * 100;
      return `<div class="ladder-row ${reached ? 'reached' : ''}">
        <div class="ladder-no">${idx + 1}</div>
        <div class="ladder-name">${t.name}</div>
        <div class="ladder-bar"><div class="ladder-fill" style="width:${fill}%"></div></div>
        <div class="ladder-threshold">${t.threshold}元</div>
      </div>`;
    }).join('');
  }

  function renderCalendar(checkins) {
    const cal = $('calendar');
    cal.innerHTML = '';
    const today = new Date();
    // 生成最近 35 天，从周一开始
    const cells = [];
    const days = 35;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const count = (checkins[ds] || []).length;
      let cls = 'cal-cell';
      if (count > 0) cls += count >= 5 ? ' cal-many' : ' cal-some';
      if (ds === SRS.today()) cls += ' cal-today';
      cells.push(`<div class="${cls}" title="${ds}: ${count}字">${count || ''}</div>`);
    }
    cal.innerHTML = cells.join('');
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    $('grade-select').addEventListener('change', e => {
      currentGrade = parseInt(e.target.value);
      Store.setCurrentGrade(currentGrade);
      queueGrade = null; // 年级变化，标记需要重建队列
      renderHome();
    });

    $('btn-start').addEventListener('click', startLearning);
    $('nav-home').addEventListener('click', () => showView('home'));
    $('nav-stats').addEventListener('click', () => showView('stats'));
    $('nav-reward').addEventListener('click', () => showView('reward'));

    // 清单编辑：移除单个字（事件委托）
    $('due-list').addEventListener('click', e => {
      const btn = e.target.closest('.due-remove');
      if (btn) {
        const idx = parseInt(btn.dataset.idx);
        if (!isNaN(idx)) removeFromQueue(idx);
      }
    });

    // 清单编辑：按顺序添加汉字
    $('btn-add-char').addEventListener('click', addToQueue);

    // 清单编辑：重置
    $('btn-reset-queue').addEventListener('click', resetQueue);

    $('btn-play').addEventListener('click', playStroke);
    $('btn-quiz').addEventListener('click', quizStroke);

    // 学习页 → 手写页
    $('btn-go-write').addEventListener('click', goWrite);

    // 手写页
    $('btn-write-back').addEventListener('click', goBackToLearn);
    $('btn-toggle-hint').addEventListener('click', toggleHint);
    $('btn-clear').addEventListener('click', () => pad.clear());
    $('btn-finish-write').addEventListener('click', finishWriting);
    $('btn-skip').addEventListener('click', skipCurrent);
  }

  // ---------- 初始化手写板 ----------
  function initPad() {
    const canvas = $('write-canvas');
    pad = HandwritingPad.init(canvas, {
      size: 280,
      color: '#2d3436',
      width: 7,
      onInk: onInkChange,
    });
  }

  // ---------- 启动 ----------
  function init() {
    bindEvents();
    initPad();
    initAuth();
  }

  // ---------- 登录/注册流程 ----------
  function showLoginScreen() {
    $('view-login').classList.remove('hidden');
    document.querySelector('.app').style.display = 'none';
  }

  function hideLoginScreen() {
    $('view-login').classList.add('hidden');
    document.querySelector('.app').style.display = '';
    updateUserArea();
    // 登录后重置当前年级（读取当前用户的）
    currentGrade = Store.getCurrentGrade();
    queueGrade = null;
    showView('home');
  }

  function updateUserArea() {
    const user = Auth.getCurrentUser();
    $('user-name').textContent = user || '';
  }

  function switchLoginTab(tab) {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
      $('tab-login').classList.add('active');
      $('login-form').classList.remove('hidden');
      $('register-form').classList.add('hidden');
    } else {
      $('tab-register').classList.add('active');
      $('login-form').classList.add('hidden');
      $('register-form').classList.remove('hidden');
    }
    $('login-message').textContent = '';
    $('register-message').textContent = '';
  }

  async function handleLogin(e) {
    e.preventDefault();
    const username = $('login-username').value;
    const password = $('login-password').value;
    const msg = $('login-message');
    msg.textContent = '登录中...';

    const result = await Auth.login(username, password);
    if (result.success) {
      msg.style.color = '#27ae60';
      msg.textContent = '登录成功！';
      setTimeout(hideLoginScreen, 400);
    } else {
      msg.style.color = '#c0392b';
      msg.textContent = result.message;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const username = $('register-username').value;
    const password = $('register-password').value;
    const msg = $('register-message');
    msg.textContent = '注册中...';

    const result = await Auth.register(username, password);
    if (result.success) {
      msg.style.color = '#27ae60';
      msg.textContent = '注册成功，正在进入...';
      setTimeout(hideLoginScreen, 600);
    } else {
      msg.style.color = '#c0392b';
      msg.textContent = result.message;
    }
  }

  function handleLogout() {
    if (!confirm('确定要退出登录吗？')) return;
    Auth.logout();
    // 清空表单
    $('login-username').value = '';
    $('login-password').value = '';
    $('register-username').value = '';
    $('register-password').value = '';
    $('login-message').textContent = '';
    $('register-message').textContent = '';
    switchLoginTab('login');
    showLoginScreen();
  }

  function initAuth() {
    // 绑定登录/注册表单
    $('login-form').addEventListener('submit', handleLogin);
    $('register-form').addEventListener('submit', handleRegister);
    $('btn-logout').addEventListener('click', handleLogout);
    $('tab-login').addEventListener('click', () => switchLoginTab('login'));
    $('tab-register').addEventListener('click', () => switchLoginTab('register'));

    if (Auth.isLoggedIn()) {
      hideLoginScreen();
    } else {
      showLoginScreen();
    }
  }

  // 等待 hanziwriter CDN 加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
