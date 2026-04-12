import { getStore } from "@netlify/blobs";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const store = getStore({ name: "owjc-cms", consistency: "strong" });

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function readContent() {
  const raw = await store.get("content");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveContent(data) {
  await store.setJSON("content", data ?? {});
}

async function getYoutubeTitle(url) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(endpoint, {
    headers: { "User-Agent": "OWJC-CMS/1.0" },
  });
  if (!res.ok) {
    throw new Error("유튜브 제목을 가져오지 못했습니다");
  }
  const data = await res.json();
  return {
    title: data.title || "이번주 말씀",
    author_name: data.author_name || "",
    thumbnail_url: data.thumbnail_url || "",
  };
}

function isAuthorized(body) {
  const required = process.env.CMS_ADMIN_PASSWORD || "1234";
  return body?.token === required || body?.password === required;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers });

  if (req.method === "GET") {
    const data = await readContent();
    return json({ ok: true, data });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "허용되지 않은 메서드입니다" }, 405);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "JSON 본문이 필요합니다" }, 400);
  }

  const action = body.action || "saveAll";

  if (action === "login") {
    if (!isAuthorized(body)) {
      return json({ ok: false, error: "비밀번호가 올바르지 않습니다" }, 401);
    }
    return json({ ok: true });
  }

  if (!isAuthorized(body)) {
    return json({ ok: false, error: "관리자 인증이 필요합니다" }, 401);
  }

  if (action === "saveAll") {
    await saveContent(body.data || {});
    return json({ ok: true });
  }

  if (action === "sync-sermon") {
    const url = String(body.url || "").trim();
    if (!url) {
      return json({ ok: false, error: "유튜브 링크가 비어 있습니다" }, 400);
    }
    const meta = await getYoutubeTitle(url);
    return json({ ok: true, ...meta });
  }

  return json({ ok: false, error: "알 수 없는 작업입니다" }, 400);
};
