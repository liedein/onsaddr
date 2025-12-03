import type { Handler } from "@netlify/functions";

let usageCount = 0; // 서버리스 함수는 매 요청마다 초기화, 실제 DB 필요시 변경

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ usageCount }),
  };
};
