/**
 * Cloudflare Worker example for AI hypothesis clustering.
 *
 * Required secret:
 *   OPENAI_API_KEY
 *
 * Optional variable:
 *   OPENAI_MODEL  (default: gpt-6-luna)
 *
 * Never put the API key in the GitHub Pages frontend.
 */

const ALLOWED_ORIGIN = "*"; // 공개수업 전에는 실제 GitHub Pages origin으로 제한 권장.

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(ALLOWED_ORIGIN)
  });
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function normalizeGroups(parsed, originalHypotheses) {
  const seen = new Set(originalHypotheses);

  const groups = Array.isArray(parsed?.groups)
    ? parsed.groups
        .map((group) => ({
          label: String(group?.label || "가설 묶음").slice(0, 80),
          hypotheses: Array.isArray(group?.hypotheses)
            ? group.hypotheses
                .map((h) => String(h))
                .filter((h) => seen.has(h))
            : []
        }))
        .filter((group) => group.hypotheses.length > 0)
    : [];

  return {
    groups,
    note:
      "표현의 의미가 비슷한 가설을 묶었습니다. 가설의 옳고 그름은 판정하지 않았습니다."
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(ALLOWED_ORIGIN)
      });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/cluster") {
      return json({ error: "Not found" }, 404);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const hypotheses = Array.isArray(body?.hypotheses)
      ? body.hypotheses
          .map((x) => String(x).replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 60)
      : [];

    if (hypotheses.length === 0) {
      return json({ error: "No hypotheses supplied." }, 400);
    }

    // No student names or personal data should be sent.
    const prompt = `
당신은 중학교 수학 수업에서 학생들의 가설을 정리하는 보조 도구이다.

목표:
- 아래 가설들을 '의미가 비슷한 것끼리' 분류한다.
- 수학적으로 옳고 그름을 절대 판정하지 않는다.
- 학생 표현을 고치거나 완성된 정답으로 바꾸지 않는다.
- 서로 다른 관점은 억지로 하나로 합치지 않는다.
- 각 가설 문장은 입력된 원문 그대로 반환한다.
- 그룹 이름은 20자 안팎의 중립적인 표현으로 만든다.

반드시 JSON만 반환한다. 마크다운은 사용하지 않는다.

형식:
{
  "groups": [
    {
      "label": "그룹 이름",
      "hypotheses": ["입력된 가설 원문", "..."]
    }
  ]
}

학생 가설:
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}
    `.trim();

    const model = env.OPENAI_MODEL || "gpt-6-luna";

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: prompt
      })
    });

    if (!apiResponse.ok) {
      const detail = await apiResponse.text();
      return json(
        {
          error: "OpenAI API request failed.",
          detail: detail.slice(0, 500)
        },
        502
      );
    }

    const data = await apiResponse.json();
    const outputText = extractOutputText(data);

    let parsed;
    try {
      const cleaned = outputText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      return json(
        {
          error: "The model did not return parseable JSON.",
          raw: outputText.slice(0, 1000)
        },
        502
      );
    }

    return json(normalizeGroups(parsed, hypotheses));
  }
};
