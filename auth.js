const USERS_KEY = "frugo_users";
const CURRENT_USER_KEY = "frugo_current_user";
const USER_DATA_PREFIX = "frugo_user_data:";
const SESSION_MARK = "frugo_session_loaded";
const PASSWORD_VERSION = 1;

const USER_DATA_KEYS = ["scanHistory", "pref_floating", "pref_motion", "fruitAiModel"]; 

const listeners = new Set();
const PAGE_TRANSITION_MS = 240;
const PAGE_TRANSITION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ROUTE_TRANSITION_KEY = "frugo_route_transition";
let isNavigating = false;
let hasLandingTransition = false;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const extractInlineHref = (element) => {
  const source = element?.getAttribute("onclick") || "";
  const match = source.match(/(?:window\.)?location\.href\s*=\s*['"]([^'"]+\.html(?:\?[^'"]*)?)['"]/);
  return match ? match[1] : "";
};

const ensureTransitionLayer = () => {
  let layer = document.querySelector(".page-transition-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "page-transition-layer";
  layer.innerHTML = `
    <div class="page-transition-sheet"></div>
    <div class="page-transition-fruits" aria-hidden="true">
      <div class="fruit-tile"><img src="apple(g).png" alt=""></div>
      <div class="fruit-tile"><img src="orange .png" alt=""></div>
      <div class="fruit-tile"><img src="banana.png" alt=""></div>
    </div>
  `;
  document.body.appendChild(layer);
  return layer;
};

const markMotionTargets = () => {
  const selectors = [
    ".masthead",
    ".summary-card",
    ".action-card",
    ".latest-card",
    ".latest-section",
    ".history-hero",
    ".toolbar",
    ".quick-card",
    ".table-container",
    ".hero-band",
    ".hero-stat",
    ".panel",
    ".strip-card",
    ".stat-card",
    ".card",
    ".empty-state"
  ];
  const seen = new Set();
  const elements = [];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      elements.push(el);
    });
  });
  elements.forEach((el, index) => {
    el.classList.add("motion-target");
    el.style.setProperty("--enter-delay", `${Math.min(index * 45, 360)}ms`);
  });
};

const prepareLandingTransition = () => {
  if (prefersReducedMotion()) return;
  if (sessionStorage.getItem(ROUTE_TRANSITION_KEY) !== "1") return;
  hasLandingTransition = true;
  document.body.classList.add("page-transitioning", "route-entering");
  ensureTransitionLayer().classList.add("is-active");
};

const playLandingTransition = () => {
  if (!hasLandingTransition || prefersReducedMotion()) return;
  markMotionTargets();
  const layer = ensureTransitionLayer();
  requestAnimationFrame(() => {
    document.body.classList.add("route-entered");
    layer.classList.add("is-leaving");
    layer.classList.remove("is-active");
  });
  window.setTimeout(() => {
    document.body.classList.remove("page-transitioning", "route-entering", "route-entered");
    layer.classList.remove("is-leaving");
    sessionStorage.removeItem(ROUTE_TRANSITION_KEY);
    hasLandingTransition = false;
  }, PAGE_TRANSITION_MS + 320);
};

export const navigateWithTransition = (target, { replace = false } = {}) => {
  if (typeof window === "undefined" || !target) return;

  if (prefersReducedMotion()) {
    if (replace) window.location.replace(target);
    else window.location.href = target;
    return;
  }

  if (isNavigating) return;
  isNavigating = true;
  sessionStorage.setItem(ROUTE_TRANSITION_KEY, "1");

  const body = document.body;
  if (!body) {
    if (replace) window.location.replace(target);
    else window.location.href = target;
    return;
  }

  const layer = ensureTransitionLayer();
  body.classList.add("page-transitioning");
  body.style.pointerEvents = "none";
  body.style.transition = `opacity ${PAGE_TRANSITION_MS}ms ${PAGE_TRANSITION_EASE}, transform ${PAGE_TRANSITION_MS}ms ${PAGE_TRANSITION_EASE}, filter ${PAGE_TRANSITION_MS}ms ${PAGE_TRANSITION_EASE}`;

  requestAnimationFrame(() => {
    layer.classList.add("is-active");
    body.style.opacity = "0";
    body.style.transform = "translateY(14px)";
    body.style.filter = "saturate(0.98)";
  });

  window.setTimeout(() => {
    if (replace) window.location.replace(target);
    else window.location.href = target;
  }, PAGE_TRANSITION_MS);
};

const attachPageTransitions = () => {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest("a[href]");
    if (anchor) {
      const href = anchor.getAttribute("href") || "";
      const target = anchor.getAttribute("target");
      if (href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:") && target !== "_blank") {
        event.preventDefault();
        event.stopPropagation();
        navigateWithTransition(anchor.href);
        return;
      }
    }

    const dataLink = event.target.closest("[data-link]");
    if (dataLink?.dataset.link) {
      event.preventDefault();
      event.stopPropagation();
      navigateWithTransition(dataLink.dataset.link);
      return;
    }

    const inlineNav = event.target.closest("[onclick*='location.href']");
    const inlineHref = extractInlineHref(inlineNav);
    if (inlineHref) {
      event.preventDefault();
      event.stopPropagation();
      navigateWithTransition(inlineHref);
    }
  }, true);
};

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const makeSalt = () => {
  if (!globalThis.crypto?.getRandomValues) {
    const err = new Error("Crypto API is not available");
    err.code = "auth/crypto-not-supported";
    throw err;
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
};

const hashPassword = async (password, salt) => {
  if (!globalThis.crypto?.subtle) {
    const err = new Error("Crypto API is not available");
    err.code = "auth/crypto-not-supported";
    throw err;
  }
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const normalize = (value) => (value || "").trim();

const findUserIndex = (username) => {
  const key = normalize(username).toLowerCase();
  return getUsers().findIndex((u) => u.username.toLowerCase() === key);
};

const getCurrentUsername = () => localStorage.getItem(CURRENT_USER_KEY);

const getCurrentUser = () => {
  const username = getCurrentUsername();
  if (!username) return null;
  const idx = findUserIndex(username);
  if (idx === -1) return null;
  const user = getUsers()[idx];
  return {
    username: user.username,
    displayName: user.displayName || user.username
  };
};

const setCurrentUsername = (username) => {
  if (username) {
    localStorage.setItem(CURRENT_USER_KEY, username);
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

const getUserDataKey = (username) => `${USER_DATA_PREFIX}${username}`;

const collectUserData = () => {
  const data = {};
  USER_DATA_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value != null) data[key] = value;
  });
  return data;
};

const applyUserData = (data) => {
  USER_DATA_KEYS.forEach((key) => {
    if (data && Object.prototype.hasOwnProperty.call(data, key)) {
      localStorage.setItem(key, data[key]);
    } else {
      localStorage.removeItem(key);
    }
  });
};

const saveUserData = (username) => {
  if (!username) return;
  const payload = {
    data: collectUserData(),
    updatedAt: Date.now()
  };
  localStorage.setItem(getUserDataKey(username), JSON.stringify(payload));
};

const loadUserData = (username) => {
  if (!username) return;
  const raw = localStorage.getItem(getUserDataKey(username));
  if (!raw) {
    applyUserData(null);
    return;
  }
  try {
    const payload = JSON.parse(raw);
    applyUserData(payload?.data || null);
  } catch {
    applyUserData(null);
  }
};

const notifyAuth = () => {
  const user = getCurrentUser();
  listeners.forEach((cb) => cb(user));
};

export const mapAuthError = (err) => {
  const code = err?.code || "";
  if (code.includes("user-not-found")) return "No account found with that username.";
  if (code.includes("wrong-password")) return "Incorrect password.";
  if (code.includes("username-already-in-use")) return "This username is already taken.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-username")) return "Please enter a username.";
  if (code.includes("reset-not-supported")) return "Offline mode does not support password reset. Please sign in and change it in Settings.";
  if (code.includes("crypto-not-supported")) return "This browser cannot securely process passwords. Please update your browser.";
  return err?.message || "Something went wrong. Please try again.";
};

export const onAuthReady = (cb) => {
  listeners.add(cb);
  cb(getCurrentUser());
  return () => listeners.delete(cb);
};

export const signIn = async (username, password) => {
  const users = getUsers();
  const key = normalize(username).toLowerCase();
  const idx = users.findIndex((u) => u.username.toLowerCase() === key);
  const user = idx === -1 ? null : users[idx];
  if (!user) {
    const err = new Error("User not found");
    err.code = "auth/user-not-found";
    throw err;
  }

  if (user.passwordHash && user.passwordSalt) {
    const inputHash = await hashPassword(password, user.passwordSalt);
    if (inputHash !== user.passwordHash) {
      const err = new Error("Wrong password");
      err.code = "auth/wrong-password";
      throw err;
    }
  } else {
    if (user.password !== password) {
      const err = new Error("Wrong password");
      err.code = "auth/wrong-password";
      throw err;
    }

    // Migrate legacy plaintext password to salted hash.
    const passwordSalt = makeSalt();
    const passwordHash = await hashPassword(password, passwordSalt);
    users[idx] = {
      ...user,
      passwordHash,
      passwordSalt,
      passwordVersion: PASSWORD_VERSION
    };
    delete users[idx].password;
    saveUsers(users);
  }

  const prevUser = getCurrentUsername();
  if (prevUser && prevUser !== user.username) {
    saveUserData(prevUser);
  }

  setCurrentUsername(user.username);
  loadUserData(user.username);
  sessionStorage.setItem(SESSION_MARK, user.username);
  notifyAuth();
};

export const register = async (username, password) => {
  const cleanName = normalize(username);
  if (!cleanName) {
    const err = new Error("Missing username");
    err.code = "auth/invalid-username";
    throw err;
  }
  if (!password || password.length < 6) {
    const err = new Error("Weak password");
    err.code = "auth/weak-password";
    throw err;
  }

  const users = getUsers();
  if (users.some((u) => u.username.toLowerCase() === cleanName.toLowerCase())) {
    const err = new Error("Username already used");
    err.code = "auth/username-already-in-use";
    throw err;
  }

  const prevUser = getCurrentUsername();
  if (prevUser) saveUserData(prevUser);
  const guestData = prevUser ? null : collectUserData();

  const passwordSalt = makeSalt();
  const passwordHash = await hashPassword(password, passwordSalt);
  users.push({
    username: cleanName,
    passwordHash,
    passwordSalt,
    passwordVersion: PASSWORD_VERSION,
    displayName: cleanName
  });
  saveUsers(users);

  setCurrentUsername(cleanName);
  if (guestData) {
    applyUserData(guestData);
    saveUserData(cleanName);
  } else {
    applyUserData(null);
  }
  sessionStorage.setItem(SESSION_MARK, cleanName);
  notifyAuth();
};

export const signOutUser = async () => {
  const current = getCurrentUsername();
  if (current) saveUserData(current);
  setCurrentUsername(null);
  applyUserData(null);
  sessionStorage.removeItem(SESSION_MARK);
  notifyAuth();
};

export const updateDisplayName = async (displayName) => {
  const current = getCurrentUsername();
  if (!current) throw new Error("Not signed in");
  const users = getUsers();
  const idx = findUserIndex(current);
  if (idx === -1) throw new Error("Account not found");
  users[idx].displayName = normalize(displayName) || users[idx].username;
  saveUsers(users);
  notifyAuth();
};

export const changePassword = async (newPassword) => {
  const current = getCurrentUsername();
  if (!current) throw new Error("Not signed in");
  if (!newPassword || newPassword.length < 6) {
    const err = new Error("Weak password");
    err.code = "auth/weak-password";
    throw err;
  }
  const users = getUsers();
  const idx = findUserIndex(current);
  if (idx === -1) throw new Error("Account not found");
  const passwordSalt = makeSalt();
  const passwordHash = await hashPassword(newPassword, passwordSalt);
  users[idx].passwordHash = passwordHash;
  users[idx].passwordSalt = passwordSalt;
  users[idx].passwordVersion = PASSWORD_VERSION;
  delete users[idx].password;
  saveUsers(users);
};

export const resetPassword = async () => {
  const err = new Error("Reset not supported");
  err.code = "auth/reset-not-supported";
  throw err;
};

export const requireAuth = (redirectTo = "login.html") => {
  const user = getCurrentUser();
  if (!user) {
    const path = location.pathname.split("/").pop() || "welcome.html";
    const next = encodeURIComponent(path);
    navigateWithTransition(`${redirectTo}?next=${next}`);
  }
};

export const initAccountLink = ({
  buttonId = "accountBtn",
  labelId = "accountLabel",
  detailId = "accountDetail"
} = {}) => {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const label = document.getElementById(labelId);
  const detail = document.getElementById(detailId);

  onAuthReady((user) => {
    if (user) {
      if (label) label.textContent = user.displayName || user.username;
      if (detail) detail.textContent = "Signed in (offline)";
      btn.textContent = "Profile";
      btn.onclick = () => navigateWithTransition("profile.html");
    } else {
      if (label) label.textContent = "Account";
      if (detail) detail.textContent = "Not signed in";
      btn.textContent = "Sign in";
      btn.onclick = () => navigateWithTransition("login.html");
    }
  });
};

export const bootstrapSession = () => {
  const current = getCurrentUsername();
  if (!current) return;
  if (sessionStorage.getItem(SESSION_MARK) === current) return;
  loadUserData(current);
  sessionStorage.setItem(SESSION_MARK, current);
};

export const attachAutoSave = () => {
  window.addEventListener("beforeunload", () => {
    const current = getCurrentUsername();
    if (current) saveUserData(current);
  });
};

if (typeof window !== "undefined") {
  window.navigateWithTransition = navigateWithTransition;
  if (document.body) prepareLandingTransition();
  document.addEventListener("DOMContentLoaded", () => {
    attachPageTransitions();
    playLandingTransition();
    bootstrapSession();
    initAccountLink();
    attachAutoSave();
  });
}
