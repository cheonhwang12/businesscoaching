// BIZCOACH 관리자 인증 모듈 (텔레그램 OTP)
const AUTH_KEY = "bizcoach_admin_auth";
const WORKER_URL = "https://business-coaching.1bestww.workers.dev";

// 페이지 콘텐츠 즉시 숨김 (렌더링 전 실행)
document.documentElement.style.visibility = "hidden";

// 인증 상태 확인
function checkAuth() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (!auth) return false;

  try {
    const { token, expiresAt } = JSON.parse(auth);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(AUTH_KEY);
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return false;
  }
}

// OTP 요청
async function requestOTP() {
  const response = await fetch(`${WORKER_URL}/auth/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return await response.json();
}

// OTP 검증 → 로그인
async function verifyOTP(code) {
  const response = await fetch(`${WORKER_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const result = await response.json();

  if (result.success) {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        token: result.token,
        expiresAt: Date.now() + result.expiresIn,
      }),
    );
  }
  return result;
}

// 로그아웃
function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = "/";
}

// 로그인 모달 표시
function showLoginModal() {
  const existing = document.getElementById("login-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "login-modal";
  modal.innerHTML = `
    <style>
      #login-modal {
        position: fixed;
        inset: 0;
        background: #0a1628;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .login-box {
        background: linear-gradient(145deg, #0f2847, #1a365d);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 16px;
        padding: 40px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      .login-box h2 {
        color: #fff;
        font-size: 24px;
        margin: 0 0 8px 0;
        text-align: center;
      }
      .login-box .login-desc {
        color: rgba(255,255,255,0.6);
        font-size: 14px;
        margin: 0 0 24px 0;
        text-align: center;
      }
      .login-input {
        width: 100%;
        padding: 14px 16px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        color: #fff;
        font-size: 24px;
        letter-spacing: 8px;
        text-align: center;
        outline: none;
        box-sizing: border-box;
      }
      .login-input:focus {
        border-color: #3B82F6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      }
      .login-btn {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #3B82F6, #2563EB);
        border: none;
        border-radius: 10px;
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 16px;
        transition: all 0.3s;
      }
      .login-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
      }
      .login-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      .login-error {
        color: #EF4444;
        font-size: 13px;
        margin-top: 12px;
        text-align: center;
        display: none;
      }
      .login-timer {
        color: rgba(255,255,255,0.5);
        font-size: 13px;
        margin-top: 12px;
        text-align: center;
        display: none;
      }
      .login-resend {
        color: #60A5FA;
        font-size: 13px;
        margin-top: 8px;
        text-align: center;
        display: none;
        cursor: pointer;
        background: none;
        border: none;
        text-decoration: underline;
      }
      .login-resend:hover { color: #93C5FD; }
      #step-otp-input { display: none; }
    </style>
    <div class="login-box">
      <h2>BIZCOACH</h2>
      <p class="login-desc" id="login-desc">텔레그램으로 인증번호를 받으세요</p>

      <!-- Step 1: 인증번호 요청 -->
      <div id="step-otp-request">
        <button class="login-btn" id="btn-request-otp">인증번호 요청</button>
      </div>

      <!-- Step 2: 인증번호 입력 -->
      <div id="step-otp-input">
        <input type="text" class="login-input" id="otp-code" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code">
        <button class="login-btn" id="btn-verify-otp">로그인</button>
        <p class="login-timer" id="login-timer"></p>
        <button class="login-resend" id="btn-resend">인증번호 재발송</button>
      </div>

      <p class="login-error" id="login-error"></p>
    </div>
  `;

  document.body.appendChild(modal);

  const descEl = document.getElementById("login-desc");
  const step1 = document.getElementById("step-otp-request");
  const step2 = document.getElementById("step-otp-input");
  const btnRequest = document.getElementById("btn-request-otp");
  const btnVerify = document.getElementById("btn-verify-otp");
  const btnResend = document.getElementById("btn-resend");
  const codeInput = document.getElementById("otp-code");
  const errorEl = document.getElementById("login-error");
  const timerEl = document.getElementById("login-timer");

  let timerId = null;

  function startTimer() {
    let remaining = 300;
    timerEl.style.display = "block";
    btnResend.style.display = "none";

    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, "0");
      timerEl.textContent = `남은 시간: ${m}:${s}`;

      if (remaining <= 0) {
        clearInterval(timerId);
        timerEl.textContent = "인증번호가 만료되었습니다";
        btnResend.style.display = "block";
      }
    }, 1000);
  }

  async function doRequestOTP(btn) {
    btn.disabled = true;
    btn.textContent = "발송 중...";
    errorEl.style.display = "none";

    try {
      const result = await requestOTP();
      if (result.success) {
        step1.style.display = "none";
        step2.style.display = "block";
        descEl.textContent = "텔레그램으로 전송된 인증번호를 입력하세요";
        codeInput.focus();
        startTimer();
      } else {
        errorEl.textContent = result.error || "발송 실패. 다시 시도해주세요.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "인증번호 요청";
      }
    } catch (e) {
      errorEl.textContent = "서버 연결 실패: " + e.message;
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "인증번호 요청";
    }
  }

  // Step 1: 인증번호 요청
  btnRequest.addEventListener("click", () => doRequestOTP(btnRequest));

  // Step 2: 인증번호 검증
  btnVerify.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      errorEl.textContent = "6자리 인증번호를 입력하세요";
      errorEl.style.display = "block";
      return;
    }

    btnVerify.disabled = true;
    btnVerify.textContent = "확인 중...";
    errorEl.style.display = "none";

    const result = await verifyOTP(code);

    if (result.success) {
      if (timerId) clearInterval(timerId);
      modal.remove();
      window.location.reload();
    } else {
      errorEl.textContent = result.error || "인증 실패";
      errorEl.style.display = "block";
      btnVerify.disabled = false;
      btnVerify.textContent = "로그인";
      codeInput.value = "";
      codeInput.focus();
    }
  });

  // 엔터키
  codeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") btnVerify.click();
  });

  // 숫자만 입력
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "");
  });

  // 재발송
  btnResend.addEventListener("click", async () => {
    btnResend.style.display = "none";
    errorEl.style.display = "none";
    const result = await requestOTP();
    if (result.success) {
      startTimer();
      codeInput.value = "";
      codeInput.focus();
    } else {
      errorEl.textContent = "재발송 실패. 다시 시도해주세요.";
      errorEl.style.display = "block";
      btnResend.style.display = "block";
    }
  });
}

// 페이지 로드 시 인증 체크
document.addEventListener("DOMContentLoaded", function () {
  if (checkAuth()) {
    // 인증 통과: 페이지 표시
    document.documentElement.style.visibility = "visible";
  } else {
    // 미인증: 모달만 표시 (페이지 콘텐츠는 숨긴 채로)
    document.documentElement.style.visibility = "visible";
    showLoginModal();
  }
});

// 전역 함수 등록
window.adminAuth = { checkAuth, logout, showLoginModal };
