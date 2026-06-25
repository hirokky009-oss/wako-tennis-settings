// Vercel Serverless Function: /api/config
//
// GET  /api/config  → GitHub 上の config.json を読んで返す
// POST /api/config  → 受け取った設定を GitHub の config.json に書き戻す（コミット）
//
// どちらもパスワード（ヘッダ x-settings-password）で保護する。
//
// 必要な環境変数（Vercel のプロジェクト設定で登録）:
//   GITHUB_TOKEN      ... fine-grained PAT（対象リポジトリの Contents: Read/Write）
//   GITHUB_REPO       ... "owner/repo"  例: hirokky009-oss/wako-tennis-check
//   GITHUB_BRANCH     ... 省略時 "main"
//   CONFIG_PATH       ... 省略時 "config.json"
//   SETTINGS_PASSWORD ... 設定画面を開くためのパスワード（自分で決める）

const GH_API = "https://api.github.com";

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function checkPassword(req) {
  const expected = env("SETTINGS_PASSWORD", "");
  if (!expected) return { ok: false, status: 500, error: "SETTINGS_PASSWORD が未設定です" };
  const given = req.headers["x-settings-password"] || "";
  if (given !== expected) return { ok: false, status: 401, error: "パスワードが違います" };
  return { ok: true };
}

async function ghContents(method, body) {
  const repo = env("GITHUB_REPO", "");
  const path = env("CONFIG_PATH", "config.json");
  const branch = env("GITHUB_BRANCH", "main");
  const token = env("GITHUB_TOKEN", "");
  if (!repo || !token) {
    throw new Error("GITHUB_REPO / GITHUB_TOKEN が未設定です");
  }
  let url = `${GH_API}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  if (method === "GET") url += `?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "wako-tennis-settings",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const auth = checkPassword(req);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  try {
    if (req.method === "GET") {
      const r = await ghContents("GET");
      if (r.status === 404) {
        // config.json がまだ無い場合は空オブジェクトを返す
        res.status(200).json({});
        return;
      }
      if (!r.ok) {
        const t = await r.text();
        res.status(502).json({ ok: false, error: `GitHub読み込み失敗 (${r.status}): ${t}` });
        return;
      }
      const data = await r.json();
      const content = Buffer.from(data.content || "", "base64").toString("utf-8");
      let parsed = {};
      try { parsed = JSON.parse(content); } catch { parsed = {}; }
      res.status(200).json(parsed);
      return;
    }

    if (req.method === "POST") {
      // body は Vercel が JSON を自動パースする（Content-Type: application/json の場合）
      const cfg = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!cfg || typeof cfg !== "object") {
        res.status(400).json({ ok: false, error: "設定の形式が不正です" });
        return;
      }

      // 既存ファイルの sha を取得（更新には必須。無ければ新規作成）
      let sha = undefined;
      const cur = await ghContents("GET");
      if (cur.ok) {
        const curData = await cur.json();
        sha = curData.sha;
      }

      const pretty = JSON.stringify(cfg, null, 2) + "\n";
      const put = await ghContents("PUT", {
        message: "Update config.json via settings web UI",
        content: Buffer.from(pretty, "utf-8").toString("base64"),
        branch: env("GITHUB_BRANCH", "main"),
        ...(sha ? { sha } : {}),
      });

      if (!put.ok) {
        const t = await put.text();
        res.status(502).json({ ok: false, error: `GitHub保存失敗 (${put.status}): ${t}` });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
