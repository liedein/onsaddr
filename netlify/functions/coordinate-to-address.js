// netlify/functions/coordinate-to-address.js
exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { lat, lng } = JSON.parse(event.body || "{}");
    if (typeof lat !== "number" || typeof lng !== "number") {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid coordinates" }) };
    }

    const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
    if (!KAKAO_REST_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ message: "Missing Kakao API key" }) };
    }

    const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2address.json");
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ message: "Kakao API error" }) };
    }

    const data = await resp.json();

    let jibun = null;
    let road = null;
    if (Array.isArray(data.documents) && data.documents.length > 0) {
      const doc = data.documents[0];
      if (doc.address && doc.address.address_name) jibun = doc.address.address_name;
      if (doc.road_address && doc.road_address.address_name) road = doc.road_address.address_name;
    }

    if (!jibun && !road) {
      return { statusCode: 404, body: JSON.stringify({ message: "Address not found" }) };
    }

    const address = jibun || road;
    return { statusCode: 200, body: JSON.stringify({ address, type: jibun ? "jibun" : "road" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: "Server error" }) };
  }
};
