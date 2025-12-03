import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { lat, lng } = JSON.parse(event.body || "{}");

    if (typeof lat !== "number" || typeof lng !== "number") {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid coordinates" }) };
    }

    // 여기서 실제 Kakao REST API 호출 가능
    // 예제에서는 Mock 주소 반환
    const address = `테스트 주소 (${lat.toFixed(6)}, ${lng.toFixed(6)})`;

    return {
      statusCode: 200,
      body: JSON.stringify({ address }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: "Server error" }) };
  }
};
