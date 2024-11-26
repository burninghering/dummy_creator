const WebSocket = require("ws")
const mysql = require("mysql2")
const pointInPolygon = require("point-in-polygon")
const turf = require("@turf/turf");

// 데이터베이스 연결 풀 설정
const pool = mysql.createPool({
  host: "121.189.20.71",
  port: 3306,
  user: "root",
  password: "DH2vY8M17fQqpFdm",
  database: "netro_data_platform",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// 선박 상태를 저장하는 객체
const vesselState = {}
const dataBuffer = [] // 데이터를 수신하여 저장하는 버퍼

// GeoJSON 형식으로 다각형 정의
const userDefinedPolygon = turf.polygon([[
    [129.559683, 35.989301], // 경도, 위도 (Longitude, Latitude 순서)
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
  ]]);
  
  
// WebSocket 배열 생성
const webSockets = []
for (let devId = 1; devId <= 50; devId++) {
  const ws = new WebSocket(`ws://127.0.0.1:6002/vessel${devId}`)
  webSockets.push(ws)

  ws.on("open", () => console.log(`DEV_ID ${devId}에 대한 WebSocket 연결 완료`))
  ws.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data)
      dataBuffer.push(parsedData)

      // 버퍼 크기가 202개가 되면 병합 처리
      if (dataBuffer.length >= 50) {
        processBatch(dataBuffer.splice(0, 50)) // 202개씩 잘라내서 처리
      }
    } catch (err) {
      console.error(`DEV_ID ${devId}에서 데이터를 처리하는 중 오류 발생:`, err)
    }
  })
  ws.on("error", (err) =>
    console.error(`DEV_ID ${devId}에 대한 WebSocket 오류 발생:`, err)
  )
  ws.on("close", () =>
    console.log(`DEV_ID ${devId}에 대한 WebSocket 연결 종료`)
  )
}

async function initializeVesselState() {
    return new Promise((resolve, reject) => {
      const query = `
          SELECT 
            t1.DEV_ID, 
            t1.SEN_ID, 
            t1.sen_value
          FROM 
            example_vessel_log_data t1
          INNER JOIN (
            SELECT DEV_ID, MAX(log_datetime) AS latest_time
            FROM example_vessel_log_data_latest
            WHERE SEN_ID IN (2, 3, 4, 5, 6)
            GROUP BY DEV_ID
          ) t2
          ON t1.DEV_ID = t2.DEV_ID AND t1.log_datetime = t2.latest_time
        `;
  
      pool.query(query, (err, results) => {
        if (err) {
          console.error("초기 좌표를 가져오는 중 오류가 발생했습니다:", err);
          return reject(err);
        }
  
        results.forEach((row) => {
          const devId = row.DEV_ID;
  
          // 다각형 내부 좌표 생성
          const { lati, longi } = getRandomCoordinateWithinPolygon(userDefinedPolygon);
  
          vesselState[devId] = {
            lati,
            longi,
            speed: 2 + Math.random() * 5,
            course: Math.floor(Math.random() * 360),
            azimuth: 0,
          };
        });
  
        console.log("선박 상태 초기화가 완료되었습니다");
        resolve();
      });
    });
  }
  

// 202개의 데이터를 처리하는 함수
function processBatch(batch) {
  console.log(`50개의 데이터를 처리 중입니다:`)

  const mergedData = mergeData(batch)
  //   console.log("병합된 데이터:", mergedData)

  // 메모리 정리
  clearBatch(batch)
}

// 데이터를 병합하는 함수
function mergeData(batch) {
  return batch.reduce((acc, item) => {
    acc.push(item)
    return acc
  }, [])
}

// 처리 완료 후 메모리 정리
function clearBatch(batch) {
  batch.length = 0
  console.log("버퍼 메모리가 정리되었습니다")
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
      `DEV_ID ${devId}: New position (${state.lati.toFixed(6)}, ${state.longi.toFixed(6)}) -> Inside polygon: ${isNowInside}`
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
  
  

// 다각형 내부의 임의 좌표 생성 (GeoJSON 형식 지원)
function getRandomCoordinateWithinPolygon(polygon) {
    const coordinates = polygon.geometry.coordinates[0]; // GeoJSON 다각형의 좌표 가져오기
    const minLongi = Math.min(...coordinates.map((point) => point[0]));
    const maxLongi = Math.max(...coordinates.map((point) => point[0]));
    const minLati = Math.min(...coordinates.map((point) => point[1]));
    const maxLati = Math.max(...coordinates.map((point) => point[1]));
  
    let lati, longi;
    do {
      longi = minLongi + Math.random() * (maxLongi - minLongi);
      lati = minLati + Math.random() * (maxLati - minLati);
    } while (!turf.booleanPointInPolygon(turf.point([longi, lati]), polygon));
  
    return { lati, longi };
  }
  

// 날짜를 'YYYY-MM-DD HH:MM:SS' 형식으로 변환
function formatDateToYYYYMMDDHHMMSS(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 메인 실행 로직
(async () => {
  console.log("선박 상태를 초기화 중입니다...");
  await initializeVesselState() // 초기 상태 불러오기 

  setInterval(async () => {
    const sendPromises = []; // 병렬 처리를 위한 Promise 배열
  
    for (let devId = 1; devId <= 50; devId++) {
      const ws = webSockets[devId - 1];
  
      if (!ws) {
        console.warn(`Vessel ID ${devId}의 WebSocket이 초기화되지 않았습니다`);
        continue; // WebSocket이 없으면 스킵
      }
  
      if (ws.readyState === WebSocket.OPEN) {
        const vesselData = generateCurvedVesselData(devId, userDefinedPolygon);
  
        // 데이터 검증
        const validData = validateVesselData(vesselData);
        if (validData) {
          // WebSocket 전송 작업을 Promise로 감싸서 배열에 추가
          const sendPromise = new Promise((resolve, reject) => {
            ws.send(JSON.stringify(vesselData), (err) => {
              if (err) {
                console.error(`Vessel ID ${devId} 전송 중 오류 발생:`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
          sendPromises.push(sendPromise);
        }
      } else {
        console.warn(`Vessel ID ${devId}의 WebSocket 연결이 열려 있지 않습니다`);
      }
    }
  
    try {
      // 병렬로 모든 WebSocket 전송 작업 수행
      await Promise.all(sendPromises);
      console.log("모든 데이터를 성공적으로 전송했습니다");
    } catch (error) {
      console.error("일부 데이터 전송 실패:", error);
    }
  }, 1000);
  
})();


// 데이터 유효성 검증 함수
function validateVesselData(data) {
    const requiredFields = ["id", "log_datetime", "rcv_datetime", "lati", "longi", "speed", "course", "azimuth"]
    for (let field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        console.error(`필드 ${field}가 유효하지 않습니다:`, data)
        return false
      }
    }
    return true
  }