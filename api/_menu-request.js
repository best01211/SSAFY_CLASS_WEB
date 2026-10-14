// 응답 본문까지 제한 시간 안에 받아야 다른 층의 메뉴 저장을 막지 않습니다.
export async function requestMenuJson(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`메뉴 원본 요청 시간 초과 (${timeoutMs / 1000}초)`));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
          throw new Error(`메뉴 원본 요청 실패: HTTP ${response.status}`);
        }
        return await response.json();
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
