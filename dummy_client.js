const WebSocket = require("ws")

// WebSocket 서버에 연결
const ws = new WebSocket("ws://127.0.0.1:5000")

// 연결이 열리면 메시지를 보내는 함수
ws.on("open", () => {
  console.log("Connected to WebSocket server")

  setInterval(() => {
    const currentHour = new Date().getHours() // 현재 시간에 맞춰 데이터 생성

    // 대기 데이터 생성
    for (let devId = 1; devId <= 5; devId++) {
      const airData = generateTimeBasedDummyAirData(devId, currentHour)
      airData.type = "air" // 데이터 타입을 명확하게 설정
      ws.send(JSON.stringify(airData))
    }

    console.log(`Sent Air data: ${JSON.stringify(airData)}`) // 로그 추가

    console.log(`Sent Air data to WebSocket server for Hour ${currentHour}`)
  }, 60000) // 1분마다 데이터 전송

  //   // 대기데이터 시나리오 생성
  //   setInterval(() => {
  //     const currentHour = new Date().getHours() // 현재 시간에 맞춰 데이터 생성
  //     const currentDay = new Date().getDay() // 요일을 얻어와 시나리오 적용
  //     const event = getEventForGuryongpo() // 구룡포항에서 발생할 이벤트 결정 (예: 어선 활동, 폭풍 경보 등)

  //     // 대기 데이터 생성 및 WebSocket 서버로 전송
  //     for (let devId = 1; devId <= 5; devId++) {
  //       // 시나리오에 따라 데이터를 생성
  //       const airScenarioData = triggerScenario(
  //         devId,
  //         currentHour,
  //         currentDay,
  //         event
  //       )
  //       ws.send(JSON.stringify(airScenarioData)) // WebSocket 서버로 데이터 전송
  //     }

  //     console.log(
  //       `Sent Air data to WebSocket server for Hour ${currentHour} with event ${event}`
  //     )
  //   }, 1000) // 1초마다 데이터 전송

  //   // 구룡포항에서 발생할 이벤트를 결정하는 함수
  //   function getEventForGuryongpo() {
  //     const randomValue = Math.random()
  //     if (randomValue < 0.3) {
  //       return "fishing_boat" // 30% 확률로 어선 활동
  //     } else if (randomValue < 0.6) {
  //       return "tourism" // 30% 확률로 관광 성수기
  //     } else if (randomValue < 0.9) {
  //       return "storm" // 30% 확률로 폭풍 경보
  //     } else {
  //       return null // 이벤트 없음 (기본 상태)
  //     }
  //   }

  setInterval(() => {
    const currentHour = new Date().getHours() // 현재 시간에 맞춰 데이터 생성

    // 해양 데이터 생성
    for (let devId = 1; devId <= 2; devId++) {
      const buoyData = generateTimeBasedDummyBuoyData(devId, currentHour)
      buoyData.type = "buoy" // 데이터 타입을 명확하게 설정
      ws.send(JSON.stringify(buoyData)) // buoyData 전송
    }

    console.log(`Sent Air data to WebSocket server for Hour ${currentHour}`)
  }, 60000) // 1분마다 데이터 전송

  // 1초마다 Vessel 데이터를 생성하여 서버로 전송
  setInterval(() => {
    // 다각형 구역을 미리 정의
    const userDefinedPolygon = [
      [35.989301, 129.559683], // 첫 번째 꼭짓점
      [35.990568, 129.557613],
      [35.990018, 129.55592],
      [35.989333, 129.556572],
      [35.98877, 129.555796],
      [35.989203, 129.555154],
      [35.987217, 129.552773],
      [35.985626, 129.552162],
      [35.983288, 129.555102],
      [35.986041, 129.560725],
      [35.983321, 129.559852],
      [35.978506, 129.553306],
      [35.969736, 129.555431],
      [35.986004, 129.572315],
      [35.988819, 129.561302],
      [35.986642, 129.558267],
      [35.985553, 129.55833],
      [35.985502, 129.55761],
      [35.987199, 129.556984],
      [35.987072, 129.557047],
      [35.989301, 129.559683], // 마지막 좌표 (다각형 닫기)
    ]

    // Vessel 데이터 생성 (1 ~ 100번 devId)
    for (let devId = 1; devId <= 100; devId++) {
      // generateCurvedVesselData 함수 호출 시 다각형을 전달
      const vesselData = generateCurvedVesselData(devId, userDefinedPolygon)
      ws.send(JSON.stringify(vesselData)) // WebSocket으로 데이터 전송
    }

    // console.log('Sent Vessel data to WebSocket server');
  }, 5000) // 5초마다 데이터 전송
})

// 서버로부터 응답 메시지를 받으면 처리
ws.on("message", (message) => {
  //   console.log("Received from server:", message)
})

// WebSocket 연결 종료 시 처리
ws.on("close", () => {
  console.log("Disconnected from WebSocket server")
})

// 오류 발생 시 처리
ws.on("error", (error) => {
  console.error("WebSocket error:", error)
})

//<----------------------------------------------------------------대기

function generateTimeBasedDummyAirData(devId, hour) {
  // 시간대별 기준값 설정
  let pm10Base =
    hour >= 6 && hour < 9
      ? 30 // 아침에는 낮은 PM10 값
      : hour >= 9 && hour < 18
      ? 60 // 낮에는 PM10 증가
      : hour >= 18 && hour < 24
      ? 40
      : 20 // 밤에는 PM10 감소

  let pm25Base =
    hour >= 6 && hour < 9
      ? 20 // 아침에 낮은 PM2.5 값
      : hour >= 9 && hour < 18
      ? 50 // 낮에는 PM2.5 증가
      : hour >= 18 && hour < 24
      ? 30
      : 15 // 밤에 PM2.5 감소

  let tempBase =
    hour >= 0 && hour < 6
      ? 18 // 새벽에는 낮은 온도
      : hour >= 6 && hour < 12
      ? 22 // 아침에 온도 상승
      : hour >= 12 && hour < 16
      ? 30 // 오후에 온도 최고
      : hour >= 16 && hour < 20
      ? 25
      : 20 // 저녁과 밤에 온도 하락

  let humiBase =
    hour >= 0 && hour < 6
      ? 75 // 새벽에는 습도 상승
      : hour >= 6 && hour < 12
      ? 60 // 아침에 습도 감소
      : hour >= 12 && hour < 18
      ? 50 // 오후에 낮은 습도
      : hour >= 18 && hour < 24
      ? 65
      : 70 // 밤에 습도 다시 상승

  let so2Base =
    hour >= 8 && hour < 18
      ? 0.03 // 주간에 SO2 증가
      : 0.01 // 야간에 SO2 감소

  let no2Base =
    hour >= 7 && hour < 19
      ? 0.03 // 차량 운행이 많은 낮에 NO2 증가
      : 0.01 // 야간에 NO2 감소

  let o3Base =
    hour >= 10 && hour < 16
      ? 0.05 // 태양광 강한 낮 시간에 O3 증가
      : hour >= 16 && hour < 20
      ? 0.03
      : 0.01 // 저녁과 밤에는 감소

  let coBase = hour >= 5 && hour < 22 ? 0.4 : 0.2 // 대부분 시간 CO 증가

  let vocsBase =
    hour >= 6 && hour < 18
      ? 0.005 // 낮 시간에 VOCs 증가
      : 0.002 // 밤에 VOCs 감소

  let h2sBase =
    hour >= 7 && hour < 20
      ? 0.01 // 주간에 H2S 증가
      : 0.005 // 야간에 감소

  let nh3Base = hour >= 6 && hour < 18 ? 8 : 5 // 낮에 NH3 증가, 밤에 감소

  let ouBase =
    hour >= 6 && hour < 18
      ? 0.005 // 낮에 악취 증가
      : 0.002 // 밤에 악취 감소

  let hchoBase =
    hour >= 10 && hour < 16
      ? 0.15 // 낮 시간에 HCHO 증가
      : 0.1 // 그 외 시간에 감소

  let winspBase =
    hour >= 6 && hour < 18
      ? 2.0 // 낮에 풍속 증가
      : 1.0 // 밤에는 풍속 감소

  let battBase = hour >= 0 && hour < 24 ? 12.0 : 12.0 // 배터리는 크게 변하지 않음

  // 데이터 생성 (기본값에 랜덤 변동 추가)
  return {
    type: "air",
    DEV_ID: devId,
    PM10: parseFloat((pm10Base + Math.random() * 10).toFixed(1)), // PM10 변동
    PM25: parseFloat((pm25Base + Math.random() * 5).toFixed(1)), // PM2.5 변동
    SO2: parseFloat((so2Base + Math.random() * 0.01).toFixed(3)), // SO2 변동
    NO2: parseFloat((no2Base + Math.random() * 0.01).toFixed(3)), // NO2 변동
    O3: parseFloat((o3Base + Math.random() * 0.01).toFixed(3)), // O3 변동
    CO: parseFloat((coBase + Math.random() * 0.1).toFixed(3)), // CO 변동
    VOCs: parseFloat((vocsBase + Math.random() * 0.001).toFixed(3)), // VOCs 변동
    H2S: parseFloat((h2sBase + Math.random() * 0.005).toFixed(3)), // H2S 변동
    NH3: parseFloat((nh3Base + Math.random() * 5).toFixed(1)), // NH3 변동
    OU: parseFloat((ouBase + Math.random() * 0.003).toFixed(3)), // OU 변동
    HCHO: parseFloat((hchoBase + Math.random() * 0.05).toFixed(3)), // HCHO 변동
    TEMP: parseFloat((tempBase + Math.random() * 5).toFixed(1)), // TEMP 변동
    HUMI: parseFloat((humiBase + Math.random() * 10).toFixed(1)), // HUMI 변동
    WINsp: parseFloat((winspBase + Math.random() * 1.0).toFixed(1)), // WINsp 변동
    WINdir: parseFloat((Math.random() * 360).toFixed(1)), // WINdir 변동 (랜덤)
    BATT: parseFloat((battBase + Math.random() * 0.5).toFixed(1)), // BATT 변동
    FIRM: "1.0.0",
    SEND: parseInt(1),
  }
}

//<----------------------------------------------------------------해양

function generateTimeBasedDummyBuoyData(devId, hour) {
  // 시간대별 기준값 설정
  let tempBase =
    hour >= 0 && hour < 6
      ? 20 // 새벽에는 낮은 온도
      : hour >= 6 && hour < 12
      ? 23 // 아침에는 온도 상승
      : hour >= 12 && hour < 16
      ? 28 // 오후에 최고 온도
      : hour >= 16 && hour < 20
      ? 25
      : 22 // 저녁과 밤에는 온도 하락

  let doBase =
    hour >= 0 && hour < 6
      ? 6.0 // 새벽에는 높은 DO
      : hour >= 6 && hour < 12
      ? 5.5 // 아침에 DO 감소
      : hour >= 12 && hour < 18
      ? 4.5
      : 5.0 // 낮에는 DO 더 감소, 저녁에 증가

  let ecBase =
    hour >= 0 && hour < 6
      ? 32000 // 새벽에는 높은 EC
      : hour >= 6 && hour < 12
      ? 30000 // 아침에 EC 감소
      : hour >= 12 && hour < 18
      ? 29000
      : 31000 // 낮에 EC 더 감소, 저녁에 상승

  let salinityBase =
    hour >= 0 && hour < 6
      ? 30.0 // 새벽에는 높은 염분
      : hour >= 6 && hour < 12
      ? 28.0 // 아침에 염분 감소
      : hour >= 12 && hour < 18
      ? 26.0
      : 29.0 // 낮에 염분 더 감소, 저녁에 상승

  let tdsBase =
    hour >= 0 && hour < 6
      ? 30000 // 새벽에는 높은 TDS
      : hour >= 6 && hour < 12
      ? 28000 // 아침에 TDS 감소
      : hour >= 12 && hour < 18
      ? 27000
      : 29000 // 낮에 TDS 더 감소, 저녁에 상승

  let phBase =
    hour >= 0 && hour < 6
      ? 7.5 // 새벽에는 중성 pH
      : hour >= 6 && hour < 12
      ? 7.0 // 아침에 pH 감소
      : hour >= 12 && hour < 18
      ? 6.8
      : 7.2 // 낮에 pH 더 감소, 저녁에 상승

  let orpBase =
    hour >= 0 && hour < 6
      ? 300 // 새벽에는 높은 ORP
      : hour >= 6 && hour < 12
      ? 270 // 아침에 ORP 감소
      : hour >= 12 && hour < 18
      ? 250
      : 280 // 낮에 ORP 더 감소, 저녁에 상승

  let batteryBase = hour >= 0 && hour < 24 ? 70.0 : 70.0

  // 데이터 생성 (기본값에 랜덤 변동 추가)
  return {
    type: "buoy",
    bouy_info_bouy_code: devId.toString(),
    bouy_state: {
      battery: (batteryBase + Math.random() * 20).toFixed(3),
    },
    bouy_sensor_value: {
      temp: (tempBase + Math.random() * 2).toFixed(3),
      DO: (doBase + Math.random() * 0.5).toFixed(3),
      EC: (ecBase + Math.random() * 1000).toFixed(),
      salinity: (salinityBase + Math.random() * 2).toFixed(2),
      TDS: (tdsBase + Math.random() * 1000).toFixed(),
      pH: (phBase + Math.random() * 0.2).toFixed(2),
      ORP: (orpBase + Math.random() * 50).toFixed(),
    },
  }
}

//<----------------------------------------------------------------선박
let vesselState = {} // 각 선박의 상태를 저장하는 객체

// 두 점(위도, 경도) 사이의 거리를 계산하는 함수 (간단한 유클리드 거리)
function calculateDistance(lat1, lon1, lat2, lon2) {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2))
}

// 날짜를 'YYYY-MM-DD HH:MM:SS' 형식으로 변환하는 함수
function formatDateToYYYYMMDDHHMMSS(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 점이 다각형 내부에 있는지 확인하는 함수 (Ray-casting 알고리즘)
function isPointInPolygon(point, polygon) {
  let x = point[0],
    y = point[1]
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][0],
      yi = polygon[i][1]
    let xj = polygon[j][0],
      yj = polygon[j][1]

    let intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

// 다각형 내부에서 임의의 좌표를 생성하는 함수
function getRandomCoordinateWithinPolygon(polygon) {
  let minLati = Math.min(...polygon.map((point) => point[0]))
  let maxLati = Math.max(...polygon.map((point) => point[0]))
  let minLongi = Math.min(...polygon.map((point) => point[1]))
  let maxLongi = Math.max(...polygon.map((point) => point[1]))

  let lati, longi

  // 다각형 내부에 있는 좌표가 나올 때까지 반복
  do {
    lati = minLati + Math.random() * (maxLati - minLati)
    longi = minLongi + Math.random() * (maxLongi - minLongi)
  } while (!isPointInPolygon([lati, longi], polygon))

  return { lati, longi }
}

// 선박 충돌을 방지하는 함수
function avoidCollision(devId, newLati, newLongi, safeDistance) {
  for (let otherDevId in vesselState) {
    if (otherDevId != devId) {
      const otherVessel = vesselState[otherDevId]
      const distance = calculateDistance(
        newLati,
        newLongi,
        otherVessel.lati,
        otherVessel.longi
      )
      if (distance < safeDistance) {
        return false // 충돌 가능성이 있으면 false 반환
      }
    }
  }
  return true // 충돌 가능성이 없으면 true 반환
}

// 선박 데이터를 생성하는 함수 (곡선 이동)
function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date() // 현재 시간을 생성

  if (!vesselState[devId]) {
    let { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
    vesselState[devId] = {
      lati: lati,
      longi: longi,
      speed: 2 + Math.random() * 10, // 초기 속도 설정
      course: Math.floor(Math.random() * 360), // 초기 방향 설정
    }
  }

  let state = vesselState[devId]

  // 이동 거리 및 곡선 이동을 조정하여 속도를 낮추기 (5배 느리게 설정)
  const speedFactor = state.speed / 50000 // 이동 거리 축소
  const curveFactor = 0.4 // 곡선 이동을 위한 커브 인자 축소

  // 새로운 좌표 계산
  let newLati =
    state.lati + speedFactor * Math.cos((state.course * Math.PI) / 180)
  let newLongi =
    state.longi +
    speedFactor * Math.sin((state.course * Math.PI) / 180) +
    curveFactor * 0.000001

  // 다각형 경계 내에서만 움직이도록 제한
  if (isPointInPolygon([newLati, newLongi], polygon)) {
    // 너무 멀리 이동하지 않도록 제한 (1초당 최대 이동 거리 제한)
    if (calculateDistance(state.lati, state.longi, newLati, newLongi) < 0.001) {
      state.lati = newLati
      state.longi = newLongi
    } else {
      console.log(
        `선박 ${devId}가 너무 멀리 이동하려고 합니다. 이동이 제한되었습니다.`
      )
    }
  } else {
    // 경계를 벗어났을 경우, 이동 방향을 반대로 변경하여 되돌아가도록 설정
    state.course = (state.course + 180) % 360
  }

  // 속도와 방향의 범위를 제한하여 부드러운 움직임을 유지
  state.speed = Math.max(1, Math.min(5, state.speed + (Math.random() * 2 - 1))) // 속도 범위를 줄임
  state.course = (state.course + (Math.random() * 5 - 2.5)) % 360 // 방향 변화 범위를 축소

  // 요청하신 형식의 더미 데이터 생성
  return {
    type: "vessel",
    id: devId,
    log_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    rcv_datetime: formatDateToYYYYMMDDHHMMSS(
      new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
    ),
    lati: state.lati.toFixed(7),
    longi: state.longi.toFixed(7),
    speed: state.speed.toFixed(2),
    course: state.course.toFixed(0),
    azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
  }
}

// 다각형 정의 (예: 구룡포항 근처 좌표)
const userDefinedPolygon = [
  [35.989301, 129.559683],
  [35.990568, 129.557613],
  [35.990018, 129.55592],
  [35.989333, 129.556572],
  [35.98877, 129.555796],
  [35.989203, 129.555154],
  [35.987217, 129.552773],
  [35.985626, 129.552162],
  [35.983288, 129.555102],
  [35.986041, 129.560725],
  [35.983321, 129.559852],
  [35.978506, 129.553306],
  [35.969736, 129.555431],
  [35.986004, 129.572315],
  [35.988819, 129.561302],
  [35.986642, 129.558267],
  [35.985553, 129.55833],
  [35.985502, 129.55761],
  [35.987199, 129.556984],
  [35.987072, 129.557047],
  [35.989301, 129.559683],
]

// 1초마다 더미 데이터를 계속해서 생성
setInterval(() => {
  for (let i = 1; i <= 100; i++) {
    const vesselData = generateCurvedVesselData(
      `vessel_${i}`,
      userDefinedPolygon
    )
    // 콘솔 출력 (필요시 DB 저장 또는 클라이언트로 전송 가능)
    // console.log(vesselData)
  }
}, 1000) // 1초마다 실행

//<--시나리오-->
function triggerScenario(devId, hour, dayOfWeek, event = null) {
  // 구룡포항에서 일어날 수 있는 시나리오 설정
  const isFishingBoatActive = event === "fishing_boat" // 어선이 활동 중일 때
  const isTouristPeakSeason = event === "tourism" // 관광 성수기
  const isStormWarning = event === "storm" // 폭풍 경보 발생

  // 시간대별 조건
  const isMorning = hour >= 6 && hour < 9 // 오전 어선 출항 시간
  const isAfternoon = hour >= 12 && hour < 15 // 오후 관광객 방문 시간
  const isEvening = hour >= 18 && hour < 21 // 저녁 어선 귀항 시간

  // 구룡포항에서 발생할 수 있는 시나리오
  if (isFishingBoatActive && (isMorning || isEvening)) {
    console.log(
      "어선 활동: 어선의 출항 또는 귀항으로 인해 공기 오염 수치가 상승합니다."
    )
    return generateFishingBoatScenario(devId, hour) // 어선 활동 중 더미 데이터 생성
  } else if (isTouristPeakSeason && isAfternoon) {
    console.log(
      "관광 성수기: 많은 관광객이 방문하여 공기 오염 수치가 소폭 증가합니다."
    )
    return generateTourismScenario(devId, hour) // 관광 성수기 더미 데이터 생성
  } else if (isStormWarning) {
    console.log(
      "폭풍 경보: 바람과 악천후로 인해 공기질이 일시적으로 악화됩니다."
    )
    return generateStormScenario(devId, hour) // 폭풍 경보 더미 데이터 생성
  } else {
    // 기본적인 공기질 데이터 생성
    console.log("일반적인 구룡포항 환경: 기본 공기질 데이터를 생성합니다.")
    return generateTimeBasedDummyAirData(devId, hour) // 기본 공기질 데이터 생성
  }
}

// 어선 활동 시나리오
function generateFishingBoatScenario(devId, hour) {
  const data = {
    DEV_ID: devId,
    PM10: (50 + Math.random() * 20).toFixed(1), // 어선의 출항 또는 귀항 시 PM10 상승
    NO2: (0.05 + Math.random() * 0.02).toFixed(3), // NO2 수치 상승
    SO2: (0.03 + Math.random() * 0.01).toFixed(3), // SO2 수치 상승
    TEMP: (20 + Math.random() * 5).toFixed(1), // 기본 온도 값
    HUMI: (60 + Math.random() * 10).toFixed(1), // 기본 습도 값
    WINDsp: (1.5 + Math.random() * 1).toFixed(1), // 기본 풍속
    CO: (0.4 + Math.random() * 0.1).toFixed(3),
    FIRM: "1.0.0",
    SEND: 1,
  }
  console.log("Fishing Boat Scenario Data:", data)
  return data
}

// 관광 성수기 시나리오
function generateTourismScenario(devId, hour) {
  const data = {
    DEV_ID: devId,
    PM10: (40 + Math.random() * 10).toFixed(1), // 관광 성수기에 관광객 활동으로 PM10 소폭 증가
    NO2: (0.04 + Math.random() * 0.01).toFixed(3), // NO2 소폭 증가
    SO2: (0.02 + Math.random() * 0.01).toFixed(3), // SO2 증가
    TEMP: (22 + Math.random() * 5).toFixed(1), // 기본 온도 값
    HUMI: (55 + Math.random() * 10).toFixed(1), // 기본 습도 값
    WINDsp: (2.0 + Math.random() * 1).toFixed(1), // 기본 풍속
    FIRM: "1.0.0",
    SEND: 1,
  }
  console.log("Tourism Scenario Data:", data)
  return data
}

// 폭풍 경보 시나리오
function generateStormScenario(devId, hour) {
  const data = {
    DEV_ID: devId,
    PM10: (30 + Math.random() * 15).toFixed(1), // 폭풍으로 인해 미세먼지 증가
    NO2: (0.03 + Math.random() * 0.01).toFixed(3), // NO2 소폭 증가
    SO2: (0.01 + Math.random() * 0.01).toFixed(3), // SO2 소폭 증가
    CO: (0.5 + Math.random() * 0.2).toFixed(3), // CO 수치 폭풍 시 상승
    TEMP: (18 + Math.random() * 5).toFixed(1), // 기본 온도 값
    HUMI: (70 + Math.random() * 10).toFixed(1), // 습도 증가
    WINDsp: (3.0 + Math.random() * 2).toFixed(1), // 폭풍으로 인한 풍속 증가
    FIRM: "1.0.0",
    SEND: 1,
  }
  console.log("Storm Scenario Data:", data)
  return data
}

// 기본적인 시간대별 더미 데이터 생성 함수
function generateTimeBasedDummyAirData(devId, hour) {
  const data = {
    DEV_ID: devId,
    PM10: (60 + Math.random() * 10).toFixed(1),
    PM25: (50 + Math.random() * 5).toFixed(1),
    SO2: (0.03 + Math.random() * 0.01).toFixed(3),
    NO2: (0.03 + Math.random() * 0.01).toFixed(3),
    O3: (0.05 + Math.random() * 0.01).toFixed(3),
    CO: (0.4 + Math.random() * 0.1).toFixed(3),
    VOCs: (0.005 + Math.random() * 0.001).toFixed(3),
    H2S: (0.01 + Math.random() * 0.005).toFixed(3),
    NH3: (8 + Math.random() * 5).toFixed(1),
    OU: (0.005 + Math.random() * 0.003).toFixed(3),
    HCHO: (0.15 + Math.random() * 0.05).toFixed(3),
    TEMP: (25 + Math.random() * 5).toFixed(1),
    HUMI: (55 + Math.random() * 10).toFixed(1),
    WINsp: (2.0 + Math.random() * 1).toFixed(1),
    WINdir: (Math.random() * 360).toFixed(1),
    BATT: (12.0 + Math.random() * 0.5).toFixed(1),
    FIRM: "1.0.0",
    SEND: 1,
  }
  console.log("Time-based Dummy Air Data:", data)
  return data
}

// 트리거 시나리오 실행 예시
const devId = 1
const hour = 9 // 오전 9시
const dayOfWeek = 3 // 수요일
const event = "fishing_boat" // 어선 활동

// 트리거 함수를 호출하여 데이터를 생성
const airData = triggerScenario(devId, hour, dayOfWeek, event)
// console.log('Generated Air Data:', airData);
