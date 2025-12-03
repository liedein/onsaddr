import type { Handler } from "@netlify/functions";

let usageCount = 0; // 서버리스 함수라면 매번 초기화됨. 실제 DB 필요

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ usageCount }),
  };
};
