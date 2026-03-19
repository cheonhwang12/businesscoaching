const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  const allow = allowed.includes(origin) ? origin : allowed[0] || "*";
  return { ...CORS_HEADERS, "Access-Control-Allow-Origin": allow };
}

function json(data, status = 200, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request, env),
    },
  });
}

// Shared auth helper
function requireAuth(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "인증이 필요합니다", status: 401 };
  }
  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      return { error: "토큰이 만료되었습니다", status: 401 };
    }
    return null;
  } catch {
    return { error: "유효하지 않은 토큰입니다", status: 401 };
  }
}

// Shared Airtable helper
async function airtableFetch(env, tableId, options = {}) {
  const { method = "GET", body, params = "", recordId = "" } = options;
  const path = recordId ? `/${recordId}` : "";
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}${path}${params}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

// In-memory auth code store (short-lived, per-isolate)
const authCodes = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rawPath = url.pathname;
    const path = rawPath.startsWith("/api")
      ? rawPath.replace("/api", "")
      : rawPath;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    try {
      if (path === "/consult" && request.method === "POST") {
        return handleConsult(request, env, ctx);
      }
      if (path === "/admin-auth" && request.method === "POST") {
        return handleAdminAuth(request, env);
      }
      if (path === "/admin-verify" && request.method === "POST") {
        return handleAdminVerify(request, env);
      }
      if (path === "/leads" && request.method === "GET") {
        return handleGetLeads(request, env);
      }
      if (path === "/leads" && request.method === "DELETE") {
        return handleDeleteLead(request, env);
      }
      if (path === "/analytics" && request.method === "GET") {
        return handleAnalytics(request, env);
      }
      // Upload
      if (path === "/upload" && request.method === "POST") {
        return handleUpload(request, env);
      }
      // Board
      if (path === "/board" && request.method === "GET") {
        return handleGetBoard(request, env);
      }
      if (path === "/board" && request.method === "POST") {
        return handleCreateBoard(request, env);
      }
      if (path === "/board" && request.method === "PUT") {
        return handleUpdateBoard(request, env);
      }
      if (path === "/board" && request.method === "DELETE") {
        return handleDeleteBoard(request, env);
      }
      // Employees
      if (path === "/employees" && request.method === "GET") {
        return handleGetEmployees(request, env);
      }
      if (path === "/employees" && request.method === "POST") {
        return handleCreateEmployee(request, env);
      }
      if (path === "/employees" && request.method === "PUT") {
        return handleUpdateEmployee(request, env);
      }
      if (path === "/employees" && request.method === "DELETE") {
        return handleDeleteEmployee(request, env);
      }
      // Popups
      if (path === "/popups" && request.method === "GET") {
        return handleGetPopups(request, env);
      }
      if (path === "/popups" && request.method === "POST") {
        return handleCreatePopup(request, env);
      }
      if (path === "/popups" && request.method === "PUT") {
        return handleUpdatePopup(request, env);
      }
      if (path === "/popups" && request.method === "DELETE") {
        return handleDeletePopup(request, env);
      }
      if (path === "/health") {
        return json(
          { status: "ok", timestamp: new Date().toISOString() },
          200,
          request,
          env,
        );
      }
      return json({ error: "Not Found" }, 404, request, env);
    } catch (err) {
      return json({ error: err.message }, 500, request, env);
    }
  },
};

// POST /api/consult - 위자드폼 접수
async function handleConsult(request, env, ctx) {
  const body = await request.json();
  const {
    companyName,
    bizNumber,
    industry,
    foundedYear,
    fundAmount,
    fundType,
    ceoName,
    phone,
    email,
    availableTime,
    message,
  } = body;

  if (!companyName || !phone || !ceoName) {
    return json(
      { error: "필수 항목을 입력해주세요 (기업명, 대표자명, 연락처)" },
      400,
      request,
      env,
    );
  }

  const now = new Date().toISOString();

  // Save to Airtable
  const airtableRes = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        typecast: true,
        records: [
          {
            fields: {
              fld76EQt8pI5wZT2f: companyName,
              fldDsXzCJ3Atp7Xuh: bizNumber || "",
              fldIIQPwWwd89640a: industry || "",
              fldHvefKqkWd9wTOj: foundedYear || "",
              fldxUOfkeU8tLP9m4: fundAmount || "",
              fldtSYYIXPTlSJcDT: fundType || "",
              fldHwYTsWree2KGQe: ceoName,
              fldz2CTRYIERdRTgh: phone,
              fldi1pKqTFx1DwVQs: email || "",
              fldZYFyw2g0JBmXns: availableTime || "",
              fldKkUCKTNsUg7FCF: message || "",
              fld9EGNbrLeCpefTx: now,
            },
          },
        ],
      }),
    },
  );

  if (!airtableRes.ok) {
    const err = await airtableRes.text();
    console.error("Airtable error:", err);
    return json({ error: "접수 중 오류가 발생했습니다" }, 500, request, env);
  }

  // 즉시 응답, 알림은 백그라운드
  const emailData = {
    companyName,
    bizNumber,
    industry,
    foundedYear,
    fundAmount,
    fundType,
    ceoName,
    phone,
    email,
    availableTime,
    message,
    now,
  };
  const adminUrl = "https://admin.xn--js-j52if34d3ff1tbnyjj1r.kr/leads";
  const telegramMsg = [
    "📋 새 상담 접수",
    `기업명: ${companyName}`,
    `대표자: ${ceoName}`,
    `연락처: ${phone}`,
    `업종: ${industry || "-"}`,
    `자금규모: ${fundAmount || "-"}`,
    `자금종류: ${fundType || "-"}`,
    `접수시각: ${now}`,
    "",
    `<a href="${adminUrl}">접수관리 바로가기</a>`,
  ].join("\n");

  // 백그라운드 처리 (응답 후 실행)
  const bgTasks = Promise.all([
    sendTelegram(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_ADMIN_CHAT_ID,
      telegramMsg,
    ),
    sendEmails(env, emailData).catch((err) =>
      console.error("Email error:", err.message || err),
    ),
  ]);

  ctx.waitUntil(bgTasks);

  return json(
    { success: true, message: "상담 신청이 접수되었습니다" },
    200,
    request,
    env,
  );
}

// POST /api/admin-auth - 인증번호 요청
async function handleAdminAuth(request, env) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 5 * 60 * 1000; // 5분

  authCodes.set(code, { expires });

  // 오래된 코드 정리
  for (const [k, v] of authCodes) {
    if (v.expires < Date.now()) authCodes.delete(k);
  }

  const msg = `🔐 관리자 인증번호: ${code}\n5분 내에 입력해주세요.`;
  await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ADMIN_CHAT_ID, msg);

  return json(
    { success: true, message: "인증번호가 발송되었습니다" },
    200,
    request,
    env,
  );
}

// POST /api/admin-verify - 인증번호 검증
async function handleAdminVerify(request, env) {
  const { code } = await request.json();

  if (!code) {
    return json({ error: "인증번호를 입력해주세요" }, 400, request, env);
  }

  const entry = authCodes.get(code);
  if (!entry || entry.expires < Date.now()) {
    authCodes.delete(code);
    return json(
      { error: "유효하지 않거나 만료된 인증번호입니다" },
      401,
      request,
      env,
    );
  }

  authCodes.delete(code);

  // Simple JWT-like token (base64 encoded, not cryptographically secure - for admin dashboard only)
  const payload = {
    role: "admin",
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const token = btoa(JSON.stringify(payload));

  return json({ success: true, token }, 200, request, env);
}

// GET /api/leads - 리드 조회
async function handleGetLeads(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "인증이 필요합니다" }, 401, request, env);
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      return json({ error: "토큰이 만료되었습니다" }, 401, request, env);
    }
  } catch {
    return json({ error: "유효하지 않은 토큰입니다" }, 401, request, env);
  }

  const url = new URL(request.url);
  const pageSize = 20;
  const offset = url.searchParams.get("offset") || "";

  let airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ID}?pageSize=${pageSize}&sort[0][field]=CreatedAt&sort[0][direction]=desc`;
  if (offset) airtableUrl += `&offset=${offset}`;

  const res = await fetch(airtableUrl, {
    headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` },
  });

  if (!res.ok) {
    return json({ error: "Airtable 조회 실패" }, 500, request, env);
  }

  const data = await res.json();
  const leads = data.records.map((r) => ({ id: r.id, ...r.fields }));

  return json({ leads, offset: data.offset || null }, 200, request, env);
}

// DELETE /api/leads - 리드 삭제
async function handleDeleteLead(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  const ids = Array.isArray(body.id) ? body.id : [body.id];
  // Airtable은 한번에 최대 10개 삭제
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const params = batch.map((id) => `records[]=${id}`).join("&");
    const res = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ID}?${params}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` },
      },
    );
    if (!res.ok)
      return json({ success: false, error: "삭제 실패" }, 500, request, env);
  }
  return json({ success: true }, 200, request, env);
}

// Gmail OAuth2 helper
async function getGmailAccessToken(env) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Gmail token refresh failed");
  return data.access_token;
}

function utf8ToBase64(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64url(str) {
  return utf8ToBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendGmail(accessToken, from, to, subject, htmlBody) {
  const boundary = "boundary_" + Date.now();
  const fromEncoded = `=?UTF-8?B?${utf8ToBase64("JS기업지원센터")}?= <jusunge2603@gmail.com>`;
  const rawEmail = [
    `From: ${fromEncoded}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${utf8ToBase64(subject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    utf8ToBase64(htmlBody),
    `--${boundary}--`,
  ].join("\r\n");

  const encodedMessage = base64url(rawEmail);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }
}

// Email templates & sender
async function sendEmails(env, data) {
  const {
    companyName,
    bizNumber,
    industry,
    foundedYear,
    fundAmount,
    fundType,
    ceoName,
    phone,
    email,
    availableTime,
    message,
    now,
  } = data;
  const accessToken = await getGmailAccessToken(env);
  const brandName = "JS기업지원센터";
  const from = `${brandName} <jusunge2603@gmail.com>`;

  const kstTime = new Date(now).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  const kstDate = new Date(now).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const kstTimeOnly = new Date(now).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. Customer confirmation email
  if (email) {
    const customerHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;background:#ffffff;">
  <div style="background:#0F4C81;padding:24px 36px;"><table style="width:100%;"><tr><td><p style="margin:0;color:#fff;font-size:13px;font-weight:300;letter-spacing:5px;text-transform:uppercase;">JS BUSINESS CENTER</p></td><td style="text-align:right;"><p style="margin:0;color:#8ab4d7;font-size:10px;letter-spacing:1px;">1688-8401</p></td></tr></table></div>
  <div style="padding:28px 36px 24px;">
    <p style="margin:0 0 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#777;">CONFIRMATION</p>
    <p style="margin:0 0 12px;font-size:18px;font-weight:400;color:#1a1a1a;line-height:1.4;">${ceoName} 님, 자금 심사 신청이 접수되었습니다.</p>
    <p style="margin:0 0 20px;font-size:12px;color:#888;border-left:3px solid #0F4C81;padding-left:12px;">24시간 이내 담당 전문가가 연락드리겠습니다.</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;font-size:11px;color:#999;width:30%;">기업명</td><td style="padding:9px 0;font-size:13px;color:#1a1a1a;font-weight:500;">${companyName}</td></tr>
      <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;font-size:11px;color:#999;">연락처</td><td style="padding:9px 0;font-size:13px;color:#1a1a1a;font-weight:500;">${phone}</td></tr>
      <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;font-size:11px;color:#999;">희망자금</td><td style="padding:9px 0;font-size:13px;color:#1a1a1a;">${fundAmount || "-"}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#999;">자금종류</td><td style="padding:9px 0;font-size:13px;color:#1a1a1a;">${fundType || "-"}</td></tr>
    </table>
  </div>
  <div style="padding:14px 36px;background:#fafafa;border-top:1px solid #f0f0f0;"><p style="margin:0;font-size:10px;color:#aaa;letter-spacing:0.3px;">JS BUSINESS CENTER &middot; 1688-8401 &middot; 평일 09:00-18:00</p></div>
</div></body></html>`;

    await sendGmail(
      accessToken,
      from,
      email,
      `[${brandName}] 자금 심사 신청이 접수되었습니다`,
      customerHtml,
    );
  }

  // 2. Staff notification email
  const staffHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;background:#ffffff;">
  <div style="background:#0F4C81;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;">
    <p style="margin:0;font-size:13px;font-weight:300;letter-spacing:5px;color:#ffffff;text-transform:uppercase;">JS BUSINESS CENTER</p>
    <p style="margin:0;font-size:11px;color:#8ab4d7;">New Lead Alert</p>
  </div>
  <div style="padding:0 40px;">
    <div style="padding:16px;border-left:3px solid #0F4C81;margin:24px 0;background:#e8f0f8;">
      <p style="margin:0;font-size:12px;color:#0F4C81;">새로운 자금심사 신청이 접수되었습니다 &mdash; ${kstDate} ${kstTimeOnly}</p>
    </div>
    <p style="font-size:10px;letter-spacing:3px;color:#0F4C81;text-transform:uppercase;margin:28px 0 8px;">CLIENT</p>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
      <p style="margin:0;font-size:20px;color:#1a1a1a;font-weight:600;">${companyName}</p>
      <p style="margin:0;font-size:14px;color:#0F4C81;font-weight:500;">${phone}</p>
    </div>
    <p style="font-size:13px;color:#666;margin:4px 0 0;">${ceoName} | ${email || "-"} | 통화희망: ${availableTime || "-"}</p>
    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;width:33%;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">사업자번호</p><p style="margin:4px 0 0;font-size:13px;color:#1a1a1a;">${bizNumber || "-"}</p></td>
        <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;width:33%;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">업종</p><p style="margin:4px 0 0;font-size:13px;color:#1a1a1a;">${industry || "-"}</p></td>
        <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;width:33%;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">설립연도</p><p style="margin:4px 0 0;font-size:13px;color:#1a1a1a;">${foundedYear || "-"}</p></td>
      </tr>
      <tr>
        <td style="padding:12px 8px;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">희망자금</p><p style="margin:4px 0 0;font-size:13px;color:#1a1a1a;">${fundAmount || "-"}</p></td>
        <td style="padding:12px 8px;" colspan="2"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">자금종류</p><p style="margin:4px 0 0;font-size:13px;color:#1a1a1a;">${fundType || "-"}</p></td>
      </tr>
    </table>${
      message
        ? `
    <div style="padding:16px;background:#f8f8f8;border-left:3px solid #0F4C81;margin:0 0 24px;">
      <p style="margin:0;font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">MESSAGE</p>
      <p style="margin:8px 0 0;font-size:13px;color:#1a1a1a;white-space:pre-wrap;">${message}</p>
    </div>`
        : ""
    }
    <div style="background:#fafafa;padding:16px;margin:0 0 24px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:#666;">${fundType || "-"}</span>
      <a href="https://admin.xn--js-j52if34d3ff1tbnyjj1r.kr/leads" style="display:inline-block;background:#0F4C81;color:#fff;padding:8px 20px;font-size:12px;text-decoration:none;letter-spacing:1px;">접수 확인</a>
    </div>
  </div>
  <div style="padding:16px 40px;border-top:1px solid #eee;">
    <p style="margin:0;font-size:10px;color:#bbb;">JS BUSINESS CENTER 자동 알림 . jusunge2603@gmail.com</p>
  </div>
</div></body></html>`;

  const staffRecipients = ["jusunge2603@gmail.com", "mkt@polarad.co.kr"];
  for (const staffTo of staffRecipients) {
    await sendGmail(
      accessToken,
      from,
      staffTo,
      `[${brandName}] 새로운 심사 신청 - ${companyName} (${ceoName})`,
      staffHtml,
    );
  }
}

// GET /api/analytics - GA4 데이터 조회
async function handleAnalytics(request, env) {
  // Auth check
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "인증이 필요합니다" }, 401, request, env);
  }
  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now())
      return json({ error: "토큰이 만료되었습니다" }, 401, request, env);
  } catch {
    return json({ error: "유효하지 않은 토큰입니다" }, 401, request, env);
  }

  const url = new URL(request.url);
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");
  const days = parseInt(url.searchParams.get("days") || "30");

  // Support both startDate/endDate and days parameter
  const dateRange =
    startDateParam && endDateParam
      ? { startDate: startDateParam, endDate: endDateParam }
      : { startDate: `${days}daysAgo`, endDate: "today" };

  try {
    const gaToken = await getGAAccessToken(env);
    const propertyId = env.GA_PROPERTY_ID;

    // 1. Main metrics + trend
    const mainReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    });

    const row = mainReport.rows?.[0]?.metricValues || [];
    const visitors = parseInt(row[0]?.value || "0");
    const pageviews = parseInt(row[1]?.value || "0");
    const avgDuration = parseFloat(row[2]?.value || "0");
    const bounceRate = parseFloat(row[3]?.value || "0");
    const mins = Math.floor(avgDuration / 60);
    const secs = Math.round(avgDuration % 60);

    // 2. Traffic sources
    const trafficReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    });

    const traffic = (trafficReport.rows || []).map((r) => ({
      source: r.dimensionValues[0].value,
      visitors: parseInt(r.metricValues[0].value),
    }));

    // 3. Devices
    const deviceReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    });

    const devices = (deviceReport.rows || []).map((r) => ({
      device: r.dimensionValues[0].value,
      visitors: parseInt(r.metricValues[0].value),
    }));

    // 4. Popular pages
    const pageReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    const pages = (pageReport.rows || []).map((r) => ({
      page: r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value),
    }));

    // 5. Geography
    const geoReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "region" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    });

    const geography = (geoReport.rows || []).map((r) => ({
      region: r.dimensionValues[0].value,
      visitors: parseInt(r.metricValues[0].value),
    }));

    // 6. Referrer sources
    const referrerReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    });

    const referrers = (referrerReport.rows || []).map((r) => ({
      url: r.dimensionValues[0].value,
      visitors: parseInt(r.metricValues[0].value),
    }));

    // 7. Daily trend
    const trendReport = await gaRunReport(gaToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });

    const trend = {
      labels: (trendReport.rows || []).map((r) => {
        const d = r.dimensionValues[0].value;
        return `${d.slice(4, 6)}/${d.slice(6, 8)}`;
      }),
      visitors: (trendReport.rows || []).map((r) =>
        parseInt(r.metricValues[0].value),
      ),
      pageviews: (trendReport.rows || []).map((r) =>
        parseInt(r.metricValues[1].value),
      ),
    };

    return json(
      {
        visitors,
        pageviews,
        avg_duration: `${mins}분 ${secs}초`,
        bounce_rate: `${bounceRate.toFixed(1)}%`,
        traffic,
        devices,
        pages,
        geography,
        referrers,
        trend,
        updated: new Date().toISOString(),
      },
      200,
      request,
      env,
    );
  } catch (err) {
    console.error("Analytics error:", err.message || err);
    return json(
      { error: "Analytics 데이터 조회 실패", detail: err.message },
      500,
      request,
      env,
    );
  }
}

// Google Service Account JWT → Access Token
async function getGAAccessToken(env) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);

  // Create JWT header and claim
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const claimB64 = btoa(JSON.stringify(claim))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signingInput = `${headerB64}.${claimB64}`;

  // Import RSA private key and sign
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signingInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token)
    throw new Error("GA token failed: " + JSON.stringify(tokenData));
  return tokenData.access_token;
}

// GA Data API v1beta helper
async function gaRunReport(accessToken, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA API error: ${err}`);
  }
  return res.json();
}

// R2 이미지 삭제 헬퍼 (URL에서 key 추출 후 삭제)
async function deleteR2Image(env, imageUrl) {
  if (!imageUrl || !env.R2_PUBLIC_URL) return;
  const prefix = env.R2_PUBLIC_URL + "/";
  if (!imageUrl.startsWith(prefix)) return;
  const key = imageUrl.slice(prefix.length);
  if (key) {
    try {
      await env.R2_BUCKET.delete(key);
    } catch (e) {
      console.error("R2 delete error:", e);
    }
  }
}

// ===== Upload Handler =====
async function handleUpload(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = formData.get("folder") || "misc";

  if (!file || !file.name) {
    return json({ error: "파일이 없습니다" }, 400, request, env);
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${folder}/${timestamp}-${safeName}`;

  await env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "image/webp" },
  });

  const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;
  return json({ success: true, url: publicUrl }, 200, request, env);
}

// ===== Board Handlers =====
function mapBoardRecord(r) {
  return {
    id: r.id,
    제목: r.fields["제목"] || "",
    요약: r.fields["요약"] || "",
    내용: r.fields["내용"] || "",
    카테고리: r.fields["카테고리"] || "",
    태그: r.fields["태그"] || "",
    작성일: r.fields["작성일"] || "",
    게시여부: r.fields["게시여부"] || false,
    썸네일: r.fields["썸네일URL"] || "",
    썸네일URL: r.fields["썸네일URL"] || "",
    조회수: r.fields["조회수"] || 0,
    슬러그: r.fields["슬러그"] || "",
  };
}

async function handleGetBoard(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  const admin = url.searchParams.get("admin") === "true";

  if (admin) {
    const authErr = requireAuth(request);
    if (authErr)
      return json({ error: authErr.error }, authErr.status, request, env);
  }

  const tableId = env.AIRTABLE_BOARD_TABLE_ID;

  // Single post by ID
  if (id) {
    const res = await airtableFetch(env, tableId, { recordId: id });
    if (!res.ok)
      return json(
        { success: false, error: "게시글을 찾을 수 없습니다" },
        404,
        request,
        env,
      );
    const record = await res.json();
    // Increment view count
    await airtableFetch(env, tableId, {
      method: "PATCH",
      recordId: id,
      body: {
        fields: { 조회수: (record.fields["조회수"] || 0) + 1 },
        typecast: true,
      },
    });
    return json(
      { success: true, post: mapBoardRecord(record) },
      200,
      request,
      env,
    );
  }

  // Single post by slug
  if (slug) {
    const filter = encodeURIComponent(`{슬러그}="${slug}"`);
    const res = await airtableFetch(env, tableId, {
      params: `?filterByFormula=${filter}&maxRecords=1`,
    });
    if (!res.ok)
      return json({ success: false, error: "조회 실패" }, 500, request, env);
    const data = await res.json();
    if (!data.records || data.records.length === 0) {
      return json(
        { success: false, error: "게시글을 찾을 수 없습니다" },
        404,
        request,
        env,
      );
    }
    const record = data.records[0];
    await airtableFetch(env, tableId, {
      method: "PATCH",
      recordId: record.id,
      body: {
        fields: { 조회수: (record.fields["조회수"] || 0) + 1 },
        typecast: true,
      },
    });
    return json(
      { success: true, post: mapBoardRecord(record) },
      200,
      request,
      env,
    );
  }

  // List
  let params = `?sort[0][field]=${encodeURIComponent("작성일")}&sort[0][direction]=desc&pageSize=100`;
  if (!admin) {
    params += `&filterByFormula=${encodeURIComponent("{게시여부}=TRUE()")}`;
  }
  const res = await airtableFetch(env, tableId, { params });
  if (!res.ok)
    return json({ success: false, error: "목록 조회 실패" }, 500, request, env);
  const data = await res.json();
  const posts = (data.records || []).map(mapBoardRecord);
  return json({ success: true, posts }, 200, request, env);
}

async function handleCreateBoard(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  const fields = {
    제목: body.제목 || body.title || "",
    요약: body.요약 || body.summary || "",
    내용: body.내용 || body.content || "",
    카테고리: body.카테고리 || body.category || "",
    태그: body.태그 || body.tags || "",
    작성일: body.작성일 || body.date || new Date().toISOString().split("T")[0],
    게시여부:
      body.게시여부 !== undefined
        ? body.게시여부
        : body.isPublic !== undefined
          ? body.isPublic
          : true,
    썸네일URL: body.썸네일URL || body.thumbnailUrl || "",
    조회수: 0,
    슬러그: body.슬러그 || body.slug || "",
  };

  const res = await airtableFetch(env, env.AIRTABLE_BOARD_TABLE_ID, {
    method: "POST",
    body: { records: [{ fields }], typecast: true },
  });

  if (!res.ok) {
    const err = await res.text();
    return json(
      { success: false, error: "생성 실패", detail: err },
      500,
      request,
      env,
    );
  }
  const data = await res.json();
  return json(
    { success: true, post: mapBoardRecord(data.records[0]) },
    201,
    request,
    env,
  );
}

async function handleUpdateBoard(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  const fields = {};
  if (body.제목 !== undefined || body.title !== undefined)
    fields["제목"] = body.제목 || body.title;
  if (body.요약 !== undefined || body.summary !== undefined)
    fields["요약"] = body.요약 || body.summary;
  if (body.내용 !== undefined || body.content !== undefined)
    fields["내용"] = body.내용 || body.content;
  if (body.카테고리 !== undefined || body.category !== undefined)
    fields["카테고리"] = body.카테고리 || body.category;
  if (body.태그 !== undefined || body.tags !== undefined)
    fields["태그"] = body.태그 || body.tags;
  if (body.작성일 !== undefined || body.date !== undefined)
    fields["작성일"] = body.작성일 || body.date;
  if (body.게시여부 !== undefined) fields["게시여부"] = body.게시여부;
  if (body.isPublic !== undefined) fields["게시여부"] = body.isPublic;
  if (body.썸네일URL !== undefined || body.thumbnailUrl !== undefined)
    fields["썸네일URL"] = body.썸네일URL || body.thumbnailUrl;
  if (body.슬러그 !== undefined || body.slug !== undefined)
    fields["슬러그"] = body.슬러그 || body.slug;

  const res = await airtableFetch(env, env.AIRTABLE_BOARD_TABLE_ID, {
    method: "PATCH",
    recordId: body.id,
    body: { fields, typecast: true },
  });

  if (!res.ok) {
    const err = await res.text();
    return json(
      { success: false, error: "수정 실패", detail: err },
      500,
      request,
      env,
    );
  }
  const data = await res.json();
  return json({ success: true, post: mapBoardRecord(data) }, 200, request, env);
}

async function handleDeleteBoard(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  // R2 이미지 삭제를 위해 먼저 레코드 조회
  const getRes = await airtableFetch(env, env.AIRTABLE_BOARD_TABLE_ID, {
    recordId: body.id,
  });
  if (getRes.ok) {
    const record = await getRes.json();
    await deleteR2Image(env, record.fields?.["썸네일URL"]);
  }

  const res = await airtableFetch(env, env.AIRTABLE_BOARD_TABLE_ID, {
    method: "DELETE",
    recordId: body.id,
  });

  if (!res.ok)
    return json({ success: false, error: "삭제 실패" }, 500, request, env);
  return json({ success: true }, 200, request, env);
}

// ===== Employees Handlers =====
function mapEmployeeRecord(r) {
  return {
    id: r.id,
    이름: r.fields["이름"] || "",
    직책: r.fields["직책"] || "",
    소개: r.fields["소개"] || "",
    순서: r.fields["순서"] || 0,
    공개여부: r.fields["공개여부"] || false,
    프로필이미지URL: r.fields["프로필이미지URL"] || "",
    이미지위치: r.fields["이미지위치"] || "center 20%",
    자금유형: r.fields["자금유형"] || "",
    업무영역: r.fields["업무영역"] || "",
    산업분야: r.fields["산업분야"] || "",
  };
}

async function handleGetEmployees(request, env) {
  const url = new URL(request.url);
  const admin = url.searchParams.get("admin") === "true";

  if (admin) {
    const authErr = requireAuth(request);
    if (authErr)
      return json({ error: authErr.error }, authErr.status, request, env);
  }

  let params = `?sort[0][field]=${encodeURIComponent("순서")}&sort[0][direction]=asc&pageSize=100`;
  if (!admin) {
    params += `&filterByFormula=${encodeURIComponent("{공개여부}=TRUE()")}`;
  }

  const res = await airtableFetch(env, env.AIRTABLE_EMPLOYEES_TABLE_ID, {
    params,
  });
  if (!res.ok)
    return json({ success: false, error: "조회 실패" }, 500, request, env);
  const data = await res.json();
  const employees = (data.records || []).map(mapEmployeeRecord);
  return json({ success: true, employees }, 200, request, env);
}

async function handleCreateEmployee(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  const fields = {
    이름: body.이름 || "",
    직책: body.직책 || "",
    소개: body.소개 || "",
    순서: body.순서 || 0,
    공개여부: body.공개여부 !== undefined ? body.공개여부 : true,
    프로필이미지URL: body.프로필이미지URL || "",
    이미지위치: body.이미지위치 || "center 20%",
    자금유형: body.자금유형 || "",
    업무영역: body.업무영역 || "",
    산업분야: body.산업분야 || "",
  };

  const res = await airtableFetch(env, env.AIRTABLE_EMPLOYEES_TABLE_ID, {
    method: "POST",
    body: { records: [{ fields }], typecast: true },
  });

  if (!res.ok) {
    const err = await res.text();
    return json(
      { success: false, error: "생성 실패", detail: err },
      500,
      request,
      env,
    );
  }
  const data = await res.json();
  return json(
    { success: true, employee: mapEmployeeRecord(data.records[0]) },
    201,
    request,
    env,
  );
}

async function handleUpdateEmployee(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  const fields = {};
  if (body.이름 !== undefined) fields["이름"] = body.이름;
  if (body.직책 !== undefined) fields["직책"] = body.직책;
  if (body.소개 !== undefined) fields["소개"] = body.소개;
  if (body.순서 !== undefined) fields["순서"] = body.순서;
  if (body.공개여부 !== undefined) fields["공개여부"] = body.공개여부;
  if (body.프로필이미지URL !== undefined)
    fields["프로필이미지URL"] = body.프로필이미지URL;
  if (body.이미지위치 !== undefined) fields["이미지위치"] = body.이미지위치;
  if (body.자금유형 !== undefined) fields["자금유형"] = body.자금유형;
  if (body.업무영역 !== undefined) fields["업무영역"] = body.업무영역;
  if (body.산업분야 !== undefined) fields["산업분야"] = body.산업분야;

  const res = await airtableFetch(env, env.AIRTABLE_EMPLOYEES_TABLE_ID, {
    method: "PATCH",
    recordId: body.id,
    body: { fields, typecast: true },
  });

  if (!res.ok) {
    const err = await res.text();
    return json(
      { success: false, error: "수정 실패", detail: err },
      500,
      request,
      env,
    );
  }
  const data = await res.json();
  return json(
    { success: true, employee: mapEmployeeRecord(data) },
    200,
    request,
    env,
  );
}

async function handleDeleteEmployee(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  const getRes = await airtableFetch(env, env.AIRTABLE_EMPLOYEES_TABLE_ID, {
    recordId: body.id,
  });
  if (getRes.ok) {
    const record = await getRes.json();
    await deleteR2Image(env, record.fields?.["프로필이미지URL"]);
  }

  const res = await airtableFetch(env, env.AIRTABLE_EMPLOYEES_TABLE_ID, {
    method: "DELETE",
    recordId: body.id,
  });

  if (!res.ok)
    return json({ success: false, error: "삭제 실패" }, 500, request, env);
  return json({ success: true }, 200, request, env);
}

// ===== Popups Handlers =====
function mapPopupRecord(r) {
  return {
    id: r.id,
    title: r.fields["title"] || "",
    altText: r.fields["altText"] || "",
    imageUrl: r.fields["imageUrl"] || "",
    linkUrl: r.fields["linkUrl"] || "",
    linkTarget: r.fields["linkTarget"] || "_self",
    order: r.fields["order"] || 0,
    isActive: r.fields["isActive"] || false,
    startDate: r.fields["startDate"] || null,
    endDate: r.fields["endDate"] || null,
  };
}

async function handleGetPopups(request, env) {
  const url = new URL(request.url);
  const admin = url.searchParams.get("admin") === "true";

  if (admin) {
    const authErr = requireAuth(request);
    if (authErr)
      return json({ error: authErr.error }, authErr.status, request, env);
  }

  let params = `?sort[0][field]=order&sort[0][direction]=asc&pageSize=100`;
  if (!admin) {
    params += `&filterByFormula={isActive}=TRUE()`;
  }

  const res = await airtableFetch(env, env.AIRTABLE_POPUPS_TABLE_ID, {
    params,
  });
  if (!res.ok)
    return json({ success: false, error: "조회 실패" }, 500, request, env);
  const data = await res.json();
  const popups = (data.records || []).map(mapPopupRecord);
  return json({ success: true, popups }, 200, request, env);
}

async function handleCreatePopup(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  const fields = {
    title: body.title || "",
    altText: body.altText || "",
    imageUrl: body.imageUrl || "",
    linkUrl: body.linkUrl || "",
    linkTarget: body.linkTarget || "_self",
    order: body.order || 1,
    isActive: body.isActive !== undefined ? body.isActive : true,
    startDate: body.startDate || "",
    endDate: body.endDate || "",
  };

  const res = await airtableFetch(env, env.AIRTABLE_POPUPS_TABLE_ID, {
    method: "POST",
    body: { records: [{ fields }], typecast: true },
  });

  if (!res.ok) {
    const err = await res.text();
    return json(
      { success: false, error: "생성 실패", detail: err },
      500,
      request,
      env,
    );
  }
  const data = await res.json();
  return json(
    { success: true, popup: mapPopupRecord(data.records[0]) },
    201,
    request,
    env,
  );
}

async function handleUpdatePopup(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  const fields = {};
  if (body.title !== undefined) fields.title = body.title;
  if (body.altText !== undefined) fields.altText = body.altText;
  if (body.imageUrl !== undefined) fields.imageUrl = body.imageUrl;
  if (body.linkUrl !== undefined) fields.linkUrl = body.linkUrl;
  if (body.linkTarget !== undefined) fields.linkTarget = body.linkTarget;
  if (body.order !== undefined) fields.order = body.order;
  if (body.isActive !== undefined) fields.isActive = body.isActive;
  if (body.startDate !== undefined) fields.startDate = body.startDate;
  if (body.endDate !== undefined) fields.endDate = body.endDate;

  const res = await airtableFetch(env, env.AIRTABLE_POPUPS_TABLE_ID, {
    method: "PATCH",
    recordId: body.id,
    body: { fields, typecast: true },
  });

  if (!res.ok) {
    const err = await res.text();
    return json(
      { success: false, error: "수정 실패", detail: err },
      500,
      request,
      env,
    );
  }
  const data = await res.json();
  return json(
    { success: true, popup: mapPopupRecord(data) },
    200,
    request,
    env,
  );
}

async function handleDeletePopup(request, env) {
  const authErr = requireAuth(request);
  if (authErr)
    return json({ error: authErr.error }, authErr.status, request, env);

  const body = await request.json();
  if (!body.id) return json({ error: "id가 필요합니다" }, 400, request, env);

  const getRes = await airtableFetch(env, env.AIRTABLE_POPUPS_TABLE_ID, {
    recordId: body.id,
  });
  if (getRes.ok) {
    const record = await getRes.json();
    await deleteR2Image(env, record.fields?.["imageUrl"]);
  }

  const res = await airtableFetch(env, env.AIRTABLE_POPUPS_TABLE_ID, {
    method: "DELETE",
    recordId: body.id,
  });

  if (!res.ok)
    return json({ success: false, error: "삭제 실패" }, 500, request, env);
  return json({ success: true }, 200, request, env);
}

// Telegram helper
async function sendTelegram(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}
