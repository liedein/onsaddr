// netlify/functions/usage.js
exports.handler = async function(event, context) {
  try {
    // GET 요청만 허용
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 테스트용 사용량 데이터
    const usageCount = Math.floor(Math.random() * 100); // 0~99
    return {
      statusCode: 200,
      body: JSON.stringify({ usageCount }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: "Server error" }) };
  }
};
