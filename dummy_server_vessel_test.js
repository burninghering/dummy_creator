const WebSocket = require("ws");
const mysql = require("mysql2");
require("dotenv").config();
const turf = require("@turf/turf");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === "true",
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10),
});

// 다각형 생성 함수
function createPolygon(coordinates) {
  if (!Array.isArray(coordinates)) {
    throw new Error("Polygon coordinates must be an array.");
  }

  coordinates.forEach((coord, index) => {
    if (!Array.isArray(coord) || coord.length !== 2 || typeof coord[0] !== "number" || typeof coord[1] !== "number") {
      console.error(`Invalid coordinate at index ${index}:`, coord);
      throw new Error("Each coordinate must be an array of two numbers.");
    }
  });

  return turf.polygon([coordinates]);
}

const userDefinedPolygon = createPolygon([
  [129.559683, 35.989301], // 경도, 위도 순서로 변경
  [129.557613, 35.990568],
  [129.55592, 35.990018],
  [129.556572, 35.989333],
  [129.555796, 35.98877],
  [129.555154, 35.989203],
  [129.552773, 35.987217],
  [129.552162, 35.985626],
  [129.555102, 35.983288],
  [129.560725, 35.986041],
  [129.559852, 35.983321],
  [129.553306, 35.978506],
  [129.555431, 35.969736],
  [129.581481, 35.965728],
  [129.588861, 35.986439],
  [129.561302, 35.988819],
  [129.558267, 35.986642],
  [129.55833, 35.985553],
  [129.55761, 35.985502],
  [129.556984, 35.987199],
  [129.557047, 35.987072],
  [129.559683, 35.989301] // 다각형 닫기
]);


// 선박 상태 객체
const vesselState = {};

// 다각형 내부 여부 확인 함수
function isPointInsidePolygon(lati, longi, polygon) {
  if (typeof lati !== "number" || typeof longi !== "number" || isNaN(lati) || isNaN(longi)) {
    console.error(`Invalid coordinates: lati=${lati}, longi=${longi}`);
    return false;
  }

  const point = turf.point([longi, lati]);
  const result = turf.booleanPointInPolygon(point, polygon);
  console.log(`Point Check: lati=${lati}, longi=${longi} -> Inside: ${result}`);
  return result;
}

function ensureVesselSeparation(devId) {
  const MIN_DISTANCE = 0.005; // 최소 거리 (단위: 위도/경도 차이)

  const currentVessel = vesselState[devId];
  if (!currentVessel) return;

  for (const [otherDevId, otherVessel] of Object.entries(vesselState)) {
    if (parseInt(otherDevId, 10) === devId) continue;

    const distance = calculateDistance(
      currentVessel.lati,
      currentVessel.longi,
      otherVessel.lati,
      otherVessel.longi
    );

    // 거리 조정 로직: 너무 가까우면 반대 방향으로 이동
    if (distance < MIN_DISTANCE) {
      console.log(`DEV_ID ${devId}와 DEV_ID ${otherDevId} 간의 거리가 너무 가까움. 거리 조정 중...`);
      const angle = Math.atan2(currentVessel.lati - otherVessel.lati, currentVessel.longi - otherVessel.longi);
      const adjustFactor = MIN_DISTANCE - distance;
      currentVessel.lati += adjustFactor * Math.sin(angle);
      currentVessel.longi += adjustFactor * Math.cos(angle);
    }
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // 위도/경도 차이로 거리 계산 (간단한 평면 거리)
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
}

function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date();

  // 배 상태 초기화
  if (!vesselState[devId]) {
    const { lati, longi } = getRandomCoordinateWithinPolygon(polygon);
    vesselState[devId] = {
      lati,
      longi,
      speed: 2 + Math.random() * 5,
      course: Math.floor(Math.random() * 360),
    };
  }

  let state = vesselState[devId];
  const speedFactor = state.speed / 2500;

  const point = turf.point([state.longi, state.lati]); // 현재 위치
  const isInside = turf.booleanPointInPolygon(point, polygon); // 현재 다각형 내부 여부 확인

  // 위치 업데이트 전 로그 출력
  console.log(
    `DEV_ID ${devId}: Previous position (${state.lati.toFixed(6)}, ${state.longi.toFixed(6)}) -> Inside polygon: ${isInside}`
  );

  // 다각형 밖으로 나갔을 경우 좌표를 다시 설정
  if (!isInside) {
    const { lati, longi } = getRandomCoordinateWithinPolygon(polygon);
    state.lati = lati;
    state.longi = longi;
    state.course = Math.floor(Math.random() * 360);
  }

  // 이동 후 위치 업데이트
  state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180);
  state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180);

  // 선박 간 최소 간격 유지
  ensureVesselSeparation(devId);

  const newPoint = turf.point([state.longi, state.lati]); // 업데이트된 위치
  const isNowInside = turf.booleanPointInPolygon(newPoint, polygon); // 업데이트된 위치 다각형 내부 여부 확인

  // 위치 업데이트 후 로그 출력
  console.log(
    `DEV_ID ${devId}: New position (${state.lati.toString()}, ${state.longi.toString()}) -> Inside polygon: ${isNowInside}`
  );

  // 속도 및 방향 조정
  state.speed = Math.max(1, Math.min(10, state.speed + (Math.random() * 2 - 1)));
  state.course = (state.course + (Math.random() * 20 - 10) + 360) % 360;

  return {
    type: "vessel",
    id: devId,
    log_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    rcv_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    lati: state.lati.toString(),
    longi: state.longi.toString(),
    speed: state.speed.toFixed(2),
    course: state.course.toFixed(0),
    azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
  };
}


// 다각형 중심 방향 계산
function calculateDirectionToPolygonCenter(lati, longi, polygon) {
  const coordinates = polygon.geometry.coordinates[0];
  const center = coordinates.reduce(
    (acc, [lng, lat]) => {
      acc[0] += lng;
      acc[1] += lat;
      return acc;
    },
    [0, 0]
  ).map(coord => coord / coordinates.length);

  const angle = Math.atan2(center[1] - lati, center[0] - longi) * (180 / Math.PI);
  return (angle + 360) % 360; // 0~360 범위로 변환
}

// 가장 가까운 경계 점 계산
function findNearestBoundaryPoint(currentLat, currentLon, boundaryPoints) {
  let nearestPoint = null;
  let minDistance = Infinity;

  for (const point of boundaryPoints) {
    const distance = calculateDistance(currentLat, currentLon, point.lat, point.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }
  return nearestPoint;
}

// 거리 계산 함수
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 거리 (km)
}

// 목표 지점을 향한 코스 조정
function adjustCourseToTarget(currentLat, currentLon, targetLat, targetLon) {
  const deltaLat = targetLat - currentLat;
  const deltaLon = targetLon - currentLon;
  const angle = Math.atan2(deltaLon, deltaLat) * (180 / Math.PI); // 방향 각도 계산
  return (angle + 360) % 360; // 0~360도로 정규화
}

// 속도 조절
function adjustSpeed(currentSpeed, maxSpeed) {
  return Math.max(currentSpeed - (maxSpeed * 0.1), 0); // 10% 감소
}

// 다각형 내부 임의 좌표 생성 함수
function getRandomCoordinateWithinPolygon(polygon) {
  let point;
  do {
    const minLati = Math.min(...polygon.geometry.coordinates[0].map((c) => c[1]));
    const maxLati = Math.max(...polygon.geometry.coordinates[0].map((c) => c[1]));
    const minLongi = Math.min(...polygon.geometry.coordinates[0].map((c) => c[0]));
    const maxLongi = Math.max(...polygon.geometry.coordinates[0].map((c) => c[0]));

    const lati = minLati + Math.random() * (maxLati - minLati);
    const longi = minLongi + Math.random() * (maxLongi - minLongi);
    point = turf.point([longi, lati]);
  } while (!turf.booleanPointInPolygon(point, polygon));

  return { lati: point.geometry.coordinates[1], longi: point.geometry.coordinates[0] };
}

// 경계 충족 여부 실시간 확인 함수
function checkBoundaryStatus(currentLat, currentLon, boundaryPolygon) {
  const inside = isPointInsidePolygon(currentLat, currentLon, boundaryPolygon);
  if (inside) {
    console.log(`현재 위치 (lati=${currentLat}, longi=${currentLon}) -> 경계 내부`);
  } else {
    console.log(`현재 위치 (lati=${currentLat}, longi=${currentLon}) -> 경계 외부`);
  }
  return inside;
}

// 날짜 포맷 변환 함수
function formatDateToYYYYMMDDHHMMSS(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// WebSocket 설정 및 데이터 전송
(async () => {
  console.log("선박 상태를 초기화 중입니다...");
  await initializeVesselState();

  const webSockets = Array.from({ length: 50 }, (_, i) => new WebSocket(`ws://127.0.0.1:6005/vessel${i + 1}`));

  webSockets.forEach((ws, devId) => {
    ws.on("open", () => {
      console.log(`DEV_ID ${devId + 1} WebSocket 연결 완료`);

      // 데이터 전송 주기 설정
      setInterval(() => {
        const vesselData = generateCurvedVesselData(devId + 1, userDefinedPolygon);
        
        // lati, longi를 문자열로 변환
        const dataToSend = {
          ...vesselData,
          lati: vesselData.lati.toString(),
          longi: vesselData.longi.toString(),
        };

        console.log(
          `DEV_ID ${devId + 1} -> lati=${dataToSend.lati}, longi=${dataToSend.longi}, inside: ${isPointInsidePolygon(
            vesselData.lati,
            vesselData.longi,
            userDefinedPolygon
          )}`
        );
        ws.send(JSON.stringify(dataToSend), (err) => {
          if (err) {
            console.error(`DEV_ID ${devId + 1} 데이터 전송 오류:`, err);
          }
        });
      }, 1000);
    });

    ws.on("error", (err) => console.error(`DEV_ID ${devId + 1} WebSocket 오류:`, err));
    ws.on("close", () => console.log(`DEV_ID ${devId + 1} WebSocket 연결 종료`));
  });
})();


// 선박 초기 상태 가져오기
async function initializeVesselState() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT DEV_ID, SEN_ID, sen_value
      FROM example_vessel_log_data
      WHERE SEN_ID IN (2, 3, 4, 5, 6)
    `;

    pool.query(query, (err, results) => {
      if (err) {
        console.error("초기 좌표 가져오기 오류:", err);
        reject(err);
      }

      results.forEach((row) => {
        const devId = row.DEV_ID;
        if (!vesselState[devId]) {
          vesselState[devId] = { lati: 0, longi: 0, speed: 0, course: 0, azimuth: 0 };
        }

        switch (row.SEN_ID) {
          case 2:
            vesselState[devId].lati = parseFloat(row.sen_value);
            break;
          case 3:
            vesselState[devId].longi = parseFloat(row.sen_value);
            break;
          case 4:
            vesselState[devId].speed = parseFloat(row.sen_value);
            break;
          case 5:
            vesselState[devId].course = parseFloat(row.sen_value);
            break;
          case 6:
            vesselState[devId].azimuth = parseFloat(row.sen_value);
            break;
        }
      });

      console.log("선박 상태 초기화 완료");
      resolve();
    });
  });
}
