export function errorMessage(error, fallback = "요청을 처리하지 못했습니다.") {
  if (typeof error === "string") return error;
  if (typeof error?.message !== "string") return fallback;
  const code = typeof error.code === "string" ? ` [${error.code}]` : "";
  const detail = typeof error.details === "string" && error.details ? ` ${error.details}` : "";
  const hint = typeof error.hint === "string" && error.hint ? ` ${error.hint}` : "";
  return `${error.message}${code}${detail}${hint}`;
}
