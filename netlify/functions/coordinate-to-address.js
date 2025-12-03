// netlify/functions/coordinate-to-address.js
const fetch = require("node-fetch");

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { lat, lng } = JSON.parse(event.body || "{}");
    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid coordinates" }),
      };
    }

    const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
    if (!KAKAO_REST_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Missing Kakao API key" }),
      };
    }

    // Kakao Local API: 좌표→주소
    const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2address.json");
    // Kakao는 x=경도(lng), y=위도(lat)
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      timeout: 10000,
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ message: "Kakao API error" }),
      };
    }

    const data = await resp.json();

    // Kakao 응답에서 지번주소 우선 추출
    // documents[0].address.address_name = 지번주소
    // documents[0].road_address.address_name = 도로명주소
    let jibun = null;
    let road = null;

    if (Array.isArray(data.documents) && data.documents.length > 0) {
      const doc = data.documents[0];
      if (doc.address && doc.address.address_name) {
        jibun = doc.address.address_name;
      }
      if (doc.road_address && doc.road_address.address_name) {
        road = doc.road_address.address_name;
      }
    }

    if (!jibun && !road) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Address not found" }),
      };
    }

    // 지번 주소 우선 반환, 지번이 없으면 도로명 fallback
    const address = jibun || road;

    return {
      statusCode: 200,
      body: JSON.stringify({ address, type: jibun ? "jibun" : "road" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error" }),
    };
  }
};
