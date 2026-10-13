# 원의 현 탐구 — 가설에서 증명까지

중학교 3학년 `Ⅳ-2.(1) 원과 현` 공개수업용 웹앱입니다.

## 수업 흐름

1. **조작·관찰**
   - 현을 원 안에서 직접 드래그합니다.
   - 중심에서 현까지의 거리와 현의 길이를 관찰합니다.
   - 현의 방향까지 자유롭게 바꿀 수 있습니다.

2. **가설 모으기**
   - 학생이 자신의 가설을 자연어로 제출합니다.
   - 교사는 다른 플랫폼에서 수집한 가설을 여러 줄로 붙여넣을 수도 있습니다.
   - AI는 가설의 옳고 그름을 판단하지 않고 의미가 비슷한 가설만 분류합니다.

3. **가설 검증**
   - 두 현을 각각 드래그합니다.
   - 중심에서의 거리와 방향을 독립적으로 바꿉니다.
   - `같은 거리 ↔ 같은 길이` 관계를 여러 사례에서 검토합니다.

4. **수학적 정당화**
   - 실험과 증명의 차이를 확인합니다.
   - 전시 학습과 직각삼각형의 합동을 이용해 증명 흐름을 완성합니다.
   - TOK 질문을 통해 '관찰'과 '증명'이 제공하는 지식의 차이를 생각합니다.

## 바로 GitHub Pages에 올리기

저장소 루트에 아래 파일을 올립니다.

- `index.html`
- `style.css`
- `config.js`
- `app.js`

GitHub 저장소에서:

`Settings → Pages → Deploy from a branch → main / root`

를 선택하면 됩니다.

`config.js`의 `AI_ENDPOINT`가 빈 문자열이면 **AI 없이도 모든 수학 탐구 기능이 작동**하며,
가설 분류 버튼은 로컬 데모 분류를 사용합니다.

## 실제 AI 분류 연결

GitHub Pages는 정적 호스팅이므로 **API 키를 프런트엔드에 넣으면 안 됩니다.**

이 프로젝트에는 `cloudflare-worker/` 폴더에 간단한 서버리스 프록시 예시가 들어 있습니다.

### Cloudflare Worker 배포 개요

1. Worker 프로젝트를 생성합니다.
2. `cloudflare-worker/worker.js`와 `wrangler.toml`을 사용합니다.
3. 비밀키를 등록합니다.

```bash
npx wrangler secret put OPENAI_API_KEY
```

4. 배포합니다.

```bash
npx wrangler deploy
```

5. 발급된 Worker 주소가 예를 들어

```text
https://circle-hypothesis-ai.example.workers.dev
```

라면 `config.js`를 다음과 같이 수정합니다.

```js
window.APP_CONFIG = {
  AI_ENDPOINT: "https://circle-hypothesis-ai.example.workers.dev/cluster"
};
```

## 개인정보 주의

AI 분류에는 학생 이름, 학번, 개인 신상정보를 보내지 말고 **가설 문장만** 전송하도록 운영하는 것을 권장합니다.

## 수업 안정성

공개수업에서는 AI 네트워크 연결이 실패할 수 있습니다.
이 앱은 AI 연결 실패 시 자동으로 로컬 분류 모드로 전환하도록 설계되어 있습니다.
