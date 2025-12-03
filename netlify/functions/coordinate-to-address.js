// netlify/functions/coordinate-to-address.js
exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { lat, lng } = JSON.parse(event.body || "{}");

    if (typeof lat !== "number" || typeof lng !== "number") {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid coordinates" }) };
    }

    // 테스트용 주소 반환 (실제 서비스 시 카카오 API 호출 가능)
    const address = `테스트 주소 (${lat.toFixed(6)}, ${lng.toFixed(6)})`;

    return {
      statusCode: 200,
      body: JSON.stringify({ address }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: "Server error" }) };
  }
};
