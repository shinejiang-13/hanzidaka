/**
 * 账号管理模块
 * 本地存储账号（用户名 + SHA-256 密码哈希）
 * 每个用户的学习数据通过用户名命名空间隔离
 */
const Auth = (function () {
  const KEY_ACCOUNTS = 'hanzi_accounts';   // { username: { passwordHash, createdAt } }
  const KEY_CURRENT_USER = 'hanzi_current_user';

  // 简单的 SHA-256 哈希（Web Crypto API）
  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function loadAccounts() {
    try {
      const raw = localStorage.getItem(KEY_ACCOUNTS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveAccounts(accounts) {
    localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
  }

  /** 注册新账号，返回 { success, message } */
  async function register(username, password) {
    username = username.trim();
    if (!username) return { success: false, message: '请输入用户名' };
    if (username.length < 2) return { success: false, message: '用户名至少 2 个字符' };
    if (!password) return { success: false, message: '请输入密码' };
    if (password.length < 4) return { success: false, message: '密码至少 4 个字符' };

    const accounts = loadAccounts();
    if (accounts[username]) {
      return { success: false, message: '用户名已存在' };
    }

    const passwordHash = await sha256(password);
    accounts[username] = {
      passwordHash,
      createdAt: Date.now(),
    };
    saveAccounts(accounts);

    // 自动登录
    localStorage.setItem(KEY_CURRENT_USER, username);
    return { success: true, message: '注册成功', username };
  }

  /** 登录，返回 { success, message } */
  async function login(username, password) {
    username = username.trim();
    if (!username || !password) {
      return { success: false, message: '请输入用户名和密码' };
    }

    const accounts = loadAccounts();
    const account = accounts[username];
    if (!account) {
      return { success: false, message: '用户名不存在' };
    }

    const passwordHash = await sha256(password);
    if (account.passwordHash !== passwordHash) {
      return { success: false, message: '密码错误' };
    }

    localStorage.setItem(KEY_CURRENT_USER, username);
    return { success: true, username };
  }

  /** 登出 */
  function logout() {
    localStorage.removeItem(KEY_CURRENT_USER);
  }

  /** 获取当前登录用户 */
  function getCurrentUser() {
    return localStorage.getItem(KEY_CURRENT_USER);
  }

  /** 判断是否已登录 */
  function isLoggedIn() {
    return !!getCurrentUser();
  }

  /** 获取所有用户名 */
  function getAllUsers() {
    return Object.keys(loadAccounts());
  }

  return {
    register,
    login,
    logout,
    getCurrentUser,
    isLoggedIn,
    getAllUsers,
  };
})();
