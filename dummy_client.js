const WebSocket = require("ws")
const mysql = require("mysql2")
// WebSocket 서버에 연결
const ws = new WebSocket("ws://127.0.0.1:5000")
const pointInPolygon = require("point-in-polygon")

// 데이터베이스 연결 풀 설정
const pool = mysql.createPool({
  host: "14.63.176.165",
  port: 7306,
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

const vesselState = {} // 각 선박의 상태 저장 객체

async function initializeVesselState() {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT DEV_ID, SEN_ID, sen_value FROM example_vessel_log_data_latest WHERE SEN_ID IN (2, 3, 4, 5, 6)`,
      (err, results) => {
        if (err) {
          console.error("초기 좌표를 가져오는 중 오류 발생:", err)
          return reject(err)
        }

        results.forEach((row) => {
          const devId = row.DEV_ID
          const senId = row.SEN_ID
          const value = parseFloat(row.sen_value)

          if (!vesselState[devId]) {
            vesselState[devId] = {
              lati: 0,
              longi: 0,
              speed: 0,
              course: 0,
              azimuth: 0,
            }
          }

          // `sen_id`에 따라 위도, 경도, 속도, 방향 또는 방위각을 설정
          switch (senId) {
            case 2:
              vesselState[devId].lati = value
              break
            case 3:
              vesselState[devId].longi = value
              break
            case 4:
              vesselState[devId].speed = value
              break
            case 5:
              vesselState[devId].course = value
              break
            case 6:
              vesselState[devId].azimuth = value
              break
          }
        })

        console.log("선박 상태 초기화 완료")
        resolve() // 초기화 완료 시 resolve 호출
      }
    )
  })
}

// 연결이 열리면 메시지를 보내는 함수
ws.on("open", async () => {
  console.log("Connected to WebSocket server")

  // 초기 위치 설정 완료 후 데이터 전송 주기 시작
  await initializeVesselState()

  setInterval(() => {
    const currentHour = new Date().getHours()

    for (let devId = 1; devId <= 15; devId++) {
      let airData
      if (devId === 1 || devId === 2) {
        airData = generateSmoothCyclicAirData(devId) // dev_id 1, 2는 새로운 함수 사용
      } else {
        airData = generateTimeBasedDummyAirData(devId, currentHour) // 기존 함수 사용
      }
      airData.type = "air"
      ws.send(JSON.stringify(airData))
      // console.log(
      //   // `Sent Air data for DEV_ID ${devId}: ${JSON.stringify(airData)}`
      // )
    }
  }, 5000) // 5초마다 데이터 전송

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
    for (let devId = 1; devId <= 5; devId++) {
      // 예시: userDefinedPolygon이 정의되어 있다고 가정
      const buoyData = generateTimeBasedDummyBuoyData(
        devId,
        currentHour,
        userDefinedPolygon
      )

      buoyData.type = "buoy" // 데이터 타입을 명확하게 설정
      ws.send(JSON.stringify(buoyData)) // buoyData 전송
      // console.log(`Sent buoy data for DEV_ID ${devId}:`, buoyData) // 로그로 데이터 전송 확인
    }

    console.log(`Sent buoy data to WebSocket server for Hour ${currentHour}`)
  }, 5000) // 5초마다 데이터 전송

  // 모든 devId에 대해 매 1초마다 Vessel 데이터를 생성하여 서버로 전송
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

    // 1번부터 100번까지 모든 devId의 데이터를 업데이트하고 전송
    for (let devId = 1; devId <= 100; devId++) {
      // vesselState에 devId가 없으면 초기화
      if (!vesselState[devId]) {
        const { lati, longi } =
          getRandomCoordinateWithinPolygon(userDefinedPolygon)
        vesselState[devId] = {
          lati,
          longi,
          speed: 2 + Math.random() * 10, // 초기 속도 설정

          course: Math.floor(Math.random() * 360), // 초기 방향 설정
        }
      }

      // 위치 업데이트 및 데이터 생성
      const vesselData = generateCurvedVesselData(devId, userDefinedPolygon)
      ws.send(JSON.stringify(vesselData)) // WebSocket으로 데이터 전송
      console.log(`Sent Vessel data for DEV_ID ${devId}:`, vesselData) // 로그로 데이터 전송 확인
    }
  }, 1000) // 1초마다 데이터 전송
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

// function generateTimeBasedDummyAirData(devId, hour) {
//   // 시간대별 기준값 설정
//   let pm10Base =
//     hour >= 6 && hour < 9
//       ? 30 // 아침에는 낮은 PM10 값
//       : hour >= 9 && hour < 18
//       ? 60 // 낮에는 PM10 증가
//       : hour >= 18 && hour < 24
//       ? 40
//       : 20 // 밤에는 PM10 감소

//   let pm25Base =
//     hour >= 6 && hour < 9
//       ? 20 // 아침에 낮은 PM2.5 값
//       : hour >= 9 && hour < 18
//       ? 50 // 낮에는 PM2.5 증가
//       : hour >= 18 && hour < 24
//       ? 30
//       : 15 // 밤에 PM2.5 감소

//   let tempBase =
//     hour >= 0 && hour < 6
//       ? 18 // 새벽에는 낮은 온도
//       : hour >= 6 && hour < 12
//       ? 22 // 아침에 온도 상승
//       : hour >= 12 && hour < 16
//       ? 30 // 오후에 온도 최고
//       : hour >= 16 && hour < 20
//       ? 25
//       : 20 // 저녁과 밤에 온도 하락

//   let humiBase =
//     hour >= 0 && hour < 6
//       ? 75 // 새벽에는 습도 상승
//       : hour >= 6 && hour < 12
//       ? 60 // 아침에 습도 감소
//       : hour >= 12 && hour < 18
//       ? 50 // 오후에 낮은 습도
//       : hour >= 18 && hour < 24
//       ? 65
//       : 70 // 밤에 습도 다시 상승

//   let so2Base =
//     hour >= 8 && hour < 18
//       ? 0.03 // 주간에 SO2 증가
//       : 0.01 // 야간에 SO2 감소

//   let no2Base =
//     hour >= 7 && hour < 19
//       ? 0.03 // 차량 운행이 많은 낮에 NO2 증가
//       : 0.01 // 야간에 NO2 감소

//   let o3Base =
//     hour >= 10 && hour < 16
//       ? 0.05 // 태양광 강한 낮 시간에 O3 증가
//       : hour >= 16 && hour < 20
//       ? 0.03
//       : 0.01 // 저녁과 밤에는 감소

//   let coBase = hour >= 5 && hour < 22 ? 0.4 : 0.2 // 대부분 시간 CO 증가

//   let vocBase =
//     hour >= 6 && hour < 18
//       ? 0.005 // 낮 시간에 VOC 증가
//       : 0.002 // 밤에 VOC 감소

//   let h2sBase =
//     hour >= 7 && hour < 20
//       ? 0.01 // 주간에 H2S 증가
//       : 0.005 // 야간에 감소

//   let nh3Base = hour >= 6 && hour < 18 ? 8 : 5 // 낮에 NH3 증가, 밤에 감소

//   let ouBase =
//     hour >= 6 && hour < 18
//       ? 0.005 // 낮에 악취 증가
//       : 0.002 // 밤에 악취 감소

//   let hchoBase =
//     hour >= 10 && hour < 16
//       ? 0.15 // 낮 시간에 HCHO 증가
//       : 0.1 // 그 외 시간에 감소

//   let winspBase =
//     hour >= 6 && hour < 18
//       ? 2.0 // 낮에 풍속 증가
//       : 1.0 // 밤에는 풍속 감소

//   let battBase = hour >= 0 && hour < 24 ? 12.0 : 12.0 // 배터리는 크게 변하지 않음

// 각 센서의 초기 상태를 저장할 객체 (0부터 4까지 타겟을 순환)
const sensorStates = {
  1: {
    PM10: { value: 0, targetLevel: 1 },
    PM25: { value: 0, targetLevel: 1 },
    SO2: { value: 0, targetLevel: 1 },
    NO2: { value: 0, targetLevel: 1 },
    O3: { value: 0, targetLevel: 1 },
    CO: { value: 0, targetLevel: 1 },
    VOC: { value: 0, targetLevel: 1 },
    H2S: { value: 0, targetLevel: 1 },
    NH3: { value: 0, targetLevel: 1 },
    OU: { value: 0, targetLevel: 1 },
    HCHO: { value: 0, targetLevel: 1 },
    TEMP: { value: 0, targetLevel: 1 },
    HUMI: { value: 0, targetLevel: 1 },
    WINsp: { value: 0, targetLevel: 1 },
    WINdir: { value: 0, targetLevel: 1 },
    BATT: { value: 0, targetLevel: 1 },
    FIRM: { value: 1, targetLevel: 1 },
    SEND: { value: 1, targetLevel: 1 },
  },
  2: {
    PM10: { value: 0, targetLevel: 1 },
    PM25: { value: 0, targetLevel: 1 },
    SO2: { value: 0, targetLevel: 1 },
    NO2: { value: 0, targetLevel: 1 },
    O3: { value: 0, targetLevel: 1 },
    CO: { value: 0, targetLevel: 1 },
    VOC: { value: 0, targetLevel: 1 },
    H2S: { value: 0, targetLevel: 1 },
    NH3: { value: 0, targetLevel: 1 },
    OU: { value: 0, targetLevel: 1 },
    HCHO: { value: 0, targetLevel: 1 },
    TEMP: { value: 0, targetLevel: 1 },
    HUMI: { value: 0, targetLevel: 1 },
    WINsp: { value: 0, targetLevel: 1 },
    WINdir: { value: 0, targetLevel: 1 },
    BATT: { value: 0, targetLevel: 1 },
    FIRM: { value: 1, targetLevel: 1 },
    SEND: { value: 1, targetLevel: 1 },
  },
}

// 각 레벨에 해당하는 값의 범위
const lvValues = {
  PM10: [0, 30, 80, 160],
  PM25: [0, 15, 35, 85],
  SO2: [0, 0.02, 0.05, 0.16],
  NO2: [0, 0.03, 0.06, 0.21],
  O3: [0, 0.03, 0.09, 0.16],
  CO: [0, 2, 9, 16],
  VOC: [0, 0.2, 0.5, 1.1],
  H2S: [0, 0.005, 0.03, 0.11],
  NH3: [0, 0.05, 0.1, 0.6],
  OU: [0, 3, 8, 16],
  HCHO: [0, 0.03, 0.08, 0.11],
  TEMP: [0, 10, 25, 35],
  HUMI: [30, 50, 70, 90],
  WINsp: [0, 1, 2, 3],
  WINdir: [0, 90, 180, 270],
  BATT: [10, 11, 12, 13],
  FIRM: [1, 1, 1, 1],
  SEND: [1, 1, 1, 1],
}

// 천천히 센서 값을 목표 레벨까지 증가 또는 감소시키는 함수
function graduallyAdjustSensorValue(sensorState, targetValue) {
  const { value } = sensorState
  const step = Math.random() * 10 // 한 번에 증가/감소할 범위
  if (value < targetValue) {
    sensorState.value = Math.min(value + step, targetValue)
  } else if (value > targetValue) {
    sensorState.value = Math.max(value - step, targetValue)
  }
}

// 센서 데이터를 생성하여 순환을 구현하는 함수
function generateSmoothCyclicAirData(devId) {
  const data = { DEV_ID: devId, type: "air" }

  for (const [sensor, levels] of Object.entries(lvValues)) {
    const sensorState = sensorStates[devId]?.[sensor]

    if (!sensorState) {
      console.warn(`Warning: Missing state for ${sensor} on DEV_ID ${devId}`)
      continue
    }

    const targetValue = levels[sensorState.targetLevel - 1] ?? 0
    graduallyAdjustSensorValue(sensorState, targetValue)
    data[sensor] = parseFloat(sensorState.value.toFixed(3)) || 0

    // 목표 레벨에 도달했는지 확인 후 다음 목표 레벨 설정
    if (sensorState.value === targetValue) {
      if (sensorState.targetLevel < 4 && sensorState.targetLevel >= 1) {
        sensorState.targetLevel += 1
      } else if (sensorState.targetLevel === 4) {
        sensorState.targetLevel = 3
      } else if (sensorState.targetLevel > 1) {
        sensorState.targetLevel -= 1
      } else {
        sensorState.targetLevel = 2
      }
    }
  }

  // console.log(`Generated data for DEV_ID ${devId}:`, data)
  return data
}

function generateTimeBasedDummyAirData(devId, hour) {
  // 시간대별 기준값 설정
  let pm10Base = 160

  let pm25Base =
    hour >= 6 && hour < 9
      ? 20 // 아침에 낮은 PM2.5 값
      : hour >= 9 && hour < 18
      ? 30 // 낮에는 PM2.5 증가
      : hour >= 18 && hour < 24
      ? 25
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

  let vocBase =
    hour >= 6 && hour < 18
      ? 0.04 // 낮 시간에 VOC 증가
      : 0.02 // 밤에 VOC 감소

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
    VOC: parseFloat((vocBase + Math.random() * 0.001).toFixed(3)), // VOC 변동
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

function generateTimeBasedDummyBuoyData(devId, hour, polygon) {
  // 시간대별 기준값 설정
  let tempBase =
    hour >= 0 && hour < 6
      ? 20
      : hour >= 6 && hour < 12
      ? 23
      : hour >= 12 && hour < 16
      ? 28
      : hour >= 16 && hour < 20
      ? 25
      : 22

  let doBase =
    hour >= 0 && hour < 6
      ? 6.0
      : hour >= 6 && hour < 12
      ? 5.5
      : hour >= 12 && hour < 18
      ? 4.5
      : 5.0
  let ecBase =
    hour >= 0 && hour < 6
      ? 32000
      : hour >= 6 && hour < 12
      ? 30000
      : hour >= 12 && hour < 18
      ? 29000
      : 31000
  let salinityBase =
    hour >= 0 && hour < 6
      ? 30.0
      : hour >= 6 && hour < 12
      ? 28.0
      : hour >= 12 && hour < 18
      ? 26.0
      : 29.0
  let tdsBase =
    hour >= 0 && hour < 6
      ? 30000
      : hour >= 6 && hour < 12
      ? 28000
      : hour >= 12 && hour < 18
      ? 27000
      : 29000
  let phBase =
    hour >= 0 && hour < 6
      ? 7.5
      : hour >= 6 && hour < 12
      ? 7.0
      : hour >= 12 && hour < 18
      ? 6.8
      : 7.2
  let orpBase =
    hour >= 0 && hour < 6
      ? 300
      : hour >= 6 && hour < 12
      ? 270
      : hour >= 12 && hour < 18
      ? 250
      : 280
  let batteryBase = hour >= 0 && hour < 24 ? 70.0 : 70.0

  // 다각형 내부의 임의 좌표를 얻음
  const { lati, longi } = getRandomCoordinateWithinPolygon(polygon)

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
      Flow_Velocity: (Math.random() * 3).toFixed(2), // 유속 데이터 예시 (0~3 범위)
      Water_Depth: (Math.random() * 100).toFixed(1), // 수심 데이터 예시 (0~100m 범위)
      GPS_longitude: parseFloat(longi.toFixed(7)), // GPS 경도
      GPS_latitude: parseFloat(lati.toFixed(7)), // GPS 위도
    },
  }
}

//<----------------------------------------------------------------선박

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
  return pointInPolygon(point, polygon)
}
// 다각형 내부에서 임의의 좌표를 생성하는 함수
function getRandomCoordinateWithinPolygon(polygon = []) {
  if (!polygon.length) {
    throw new Error("Polygon is not defined or empty")
  }

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

// 선박 데이터를 생성하는 함수 (경계를 벗어나기 전에 방향 조정)
// function generateCurvedVesselData(devId, polygon) {
//   const currentDate = new Date() // 현재 시간을 생성

//   // 초기 상태 설정
//   if (!vesselState[devId]) {
//     const { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
//     vesselState[devId] = {
//       lati,
//       longi,
//       speed: 2 + Math.random() * 5, // 초기 속도 설정 (속도 범위 조정)
//       course: Math.floor(Math.random() * 360), // 초기 방향 설정
//     }
//   }

//   let state = vesselState[devId]

//   // 이동 거리 및 곡선 이동 조정
//   const speedFactor = state.speed / 1000 // 이동 거리 조정 (값을 더 크게 설정)

//   // 새로운 좌표 계산 (미리 예측)
//   let predictedLati =
//     state.lati + speedFactor * Math.cos((state.course * Math.PI) / 180)
//   let predictedLongi =
//     state.longi + speedFactor * Math.sin((state.course * Math.PI) / 180)

//   // 현재 위치를 확인하고 방향을 조정하는 코드
//   if (!isPointInPolygon([state.lati, state.longi], polygon)) {
//     console.log(
//       `배 ${devId}가 경계를 벗어났습니다: 현재 위치 (${state.lati}, ${state.longi})`
//     )
//     state.course = (state.course + 180) % 360 // 방향을 반대로 변경
//     console.log(`배 ${devId}의 방향을 180도로 변경했습니다.`)
//   }

//   // 새로운 좌표 계산 (방향 조정 후)
//   let newLati =
//     state.lati + speedFactor * Math.cos((state.course * Math.PI) / 180)
//   let newLongi =
//     state.longi + speedFactor * Math.sin((state.course * Math.PI) / 180)

//   // 새로운 위치를 `vesselState`에 반영
//   state.lati = newLati
//   state.longi = newLongi

//   // 속도 및 방향의 범위를 조정하여 부드러운 이동 유지
//   state.speed = Math.max(1, Math.min(10, state.speed + (Math.random() * 2 - 1))) // 속도 범위 확대
//   state.course = (state.course + (Math.random() * 20 - 10) + 360) % 360 // 방향 변화 폭 증가, 항상 양수 유지

//   // rcv_datetime을 1~3초 이전으로 랜덤하게 설정
//   const randomSeconds = Math.floor(Math.random() * 3) + 1
//   const log_datetime = formatDateToYYYYMMDDHHMMSS(currentDate)
//   const rcv_datetime = formatDateToYYYYMMDDHHMMSS(
//     new Date(currentDate.getTime() - randomSeconds * 1000)
//   )

//   // 요청된 형식의 더미 데이터 생성
//   const vesselData = {
//     type: "vessel",
//     id: devId,
//     log_datetime: log_datetime,
//     rcv_datetime: rcv_datetime,
//     lati: state.lati.toFixed(7),
//     longi: state.longi.toFixed(7),
//     speed: parseFloat(state.speed.toFixed(2)),
//     course: parseFloat(state.course.toFixed(0)),
//     azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
//   }

//   return vesselData
// }

// 선박 데이터를 생성하는 함수 (경계를 벗어나기 전에 방향 조정)
function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date()

  // 초기 상태 설정
  if (!vesselState[devId]) {
    const { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
    vesselState[devId] = {
      lati,
      longi,
      speed: 2 + Math.random() * 5, // 초기 속도 설정
      course: Math.floor(Math.random() * 360), // 초기 방향 설정
    }
  }

  let state = vesselState[devId]

  // 이동 거리 조정
  const speedFactor = state.speed / 2500

  // 현재 위치가 다각형 경계를 벗어나는지 확인
  if (!pointInPolygon([state.lati, state.longi], polygon)) {
    // 경계를 벗어나면 방향을 반대로 조정
    state.course = (state.course + 180) % 360
    console.log(`선박 ${devId}가 경계를 벗어났습니다: 방향을 반대로 조정`)

    // 새로운 방향으로 이동 업데이트
    state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180)
    state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180)
  } else {
    // 다각형 내부에 있을 때만 위치 업데이트
    state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180)
    state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180)
  }

  // 속도 및 방향 조정
  state.speed = Math.max(1, Math.min(10, state.speed + (Math.random() * 2 - 1)))
  state.course = (state.course + (Math.random() * 20 - 10) + 360) % 360

  // 더미 데이터 생성
  const vesselData = {
    type: "vessel",
    id: devId,
    log_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    rcv_datetime: formatDateToYYYYMMDDHHMMSS(
      new Date(currentDate.getTime() - Math.floor(Math.random() * 3 + 1) * 1000)
    ),
    lati: state.lati.toFixed(7),
    longi: state.longi.toFixed(7),
    speed: parseFloat(state.speed.toFixed(2)),
    course: parseFloat(state.course.toFixed(0)),
    azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
  }

  return vesselData
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
  [35.965728, 129.581481],
  [35.986439, 129.588861],

  [35.988819, 129.561302],
  [35.986642, 129.558267],
  [35.985553, 129.55833],
  [35.985502, 129.55761],
  [35.987199, 129.556984],
  [35.987072, 129.557047],
  [35.989301, 129.559683], // 다각형 닫기
]

//<--시나리오-->
// function triggerScenario(devId, hour, dayOfWeek, event = null) {
//   // 구룡포항에서 일어날 수 있는 시나리오 설정
//   const isFishingBoatActive = event === "fishing_boat" // 어선이 활동 중일 때
//   const isTouristPeakSeason = event === "tourism" // 관광 성수기
//   const isStormWarning = event === "storm" // 폭풍 경보 발생

//   // 시간대별 조건
//   const isMorning = hour >= 6 && hour < 9 // 오전 어선 출항 시간
//   const isAfternoon = hour >= 12 && hour < 15 // 오후 관광객 방문 시간
//   const isEvening = hour >= 18 && hour < 21 // 저녁 어선 귀항 시간

//   // 구룡포항에서 발생할 수 있는 시나리오
//   if (isFishingBoatActive && (isMorning || isEvening)) {
//     console.log(
//       "어선 활동: 어선의 출항 또는 귀항으로 인해 공기 오염 수치가 상승합니다."
//     )
//     return generateFishingBoatScenario(devId, hour) // 어선 활동 중 더미 데이터 생성
//   } else if (isTouristPeakSeason && isAfternoon) {
//     console.log(
//       "관광 성수기: 많은 관광객이 방문하여 공기 오염 수치가 소폭 증가합니다."
//     )
//     return generateTourismScenario(devId, hour) // 관광 성수기 더미 데이터 생성
//   } else if (isStormWarning) {
//     console.log(
//       "폭풍 경보: 바람과 악천후로 인해 공기질이 일시적으로 악화됩니다."
//     )
//     return generateStormScenario(devId, hour) // 폭풍 경보 더미 데이터 생성
//   } else {
//     // 기본적인 공기질 데이터 생성
//     console.log("일반적인 구룡포항 환경: 기본 공기질 데이터를 생성합니다.")
//     return generateTimeBasedDummyAirData(devId, hour) // 기본 공기질 데이터 생성
//   }
// }

// // 어선 활동 시나리오
// function generateFishingBoatScenario(devId, hour) {
//   const data = {
//     DEV_ID: devId,
//     PM10: (50 + Math.random() * 20).toFixed(1), // 어선의 출항 또는 귀항 시 PM10 상승
//     NO2: (0.05 + Math.random() * 0.02).toFixed(3), // NO2 수치 상승
//     SO2: (0.03 + Math.random() * 0.01).toFixed(3), // SO2 수치 상승
//     TEMP: (20 + Math.random() * 5).toFixed(1), // 기본 온도 값
//     HUMI: (60 + Math.random() * 10).toFixed(1), // 기본 습도 값
//     WINDsp: (1.5 + Math.random() * 1).toFixed(1), // 기본 풍속
//     CO: (0.4 + Math.random() * 0.1).toFixed(3),
//     FIRM: "1.0.0",
//     SEND: 1,
//   }
//   console.log("Fishing Boat Scenario Data:", data)
//   return data
// }

// // 관광 성수기 시나리오
// function generateTourismScenario(devId, hour) {
//   const data = {
//     DEV_ID: devId,
//     PM10: (40 + Math.random() * 10).toFixed(1), // 관광 성수기에 관광객 활동으로 PM10 소폭 증가
//     NO2: (0.04 + Math.random() * 0.01).toFixed(3), // NO2 소폭 증가
//     SO2: (0.02 + Math.random() * 0.01).toFixed(3), // SO2 증가
//     TEMP: (22 + Math.random() * 5).toFixed(1), // 기본 온도 값
//     HUMI: (55 + Math.random() * 10).toFixed(1), // 기본 습도 값
//     WINDsp: (2.0 + Math.random() * 1).toFixed(1), // 기본 풍속
//     FIRM: "1.0.0",
//     SEND: 1,
//   }
//   console.log("Tourism Scenario Data:", data)
//   return data
// }

// // 폭풍 경보 시나리오
// function generateStormScenario(devId, hour) {
//   const data = {
//     DEV_ID: devId,
//     PM10: (30 + Math.random() * 15).toFixed(1), // 폭풍으로 인해 미세먼지 증가
//     NO2: (0.03 + Math.random() * 0.01).toFixed(3), // NO2 소폭 증가
//     SO2: (0.01 + Math.random() * 0.01).toFixed(3), // SO2 소폭 증가
//     CO: (0.5 + Math.random() * 0.2).toFixed(3), // CO 수치 폭풍 시 상승
//     TEMP: (18 + Math.random() * 5).toFixed(1), // 기본 온도 값
//     HUMI: (70 + Math.random() * 10).toFixed(1), // 습도 증가
//     WINDsp: (3.0 + Math.random() * 2).toFixed(1), // 폭풍으로 인한 풍속 증가
//     FIRM: "1.0.0",
//     SEND: 1,
//   }
//   console.log("Storm Scenario Data:", data)
//   return data
// }

// // 기본적인 시간대별 더미 데이터 생성 함수
// function generateTimeBasedDummyAirData(devId, hour) {
//   const data = {
//     DEV_ID: devId,
//     PM10: (60 + Math.random() * 10).toFixed(1),
//     PM25: (50 + Math.random() * 5).toFixed(1),
//     SO2: (0.03 + Math.random() * 0.01).toFixed(3),
//     NO2: (0.03 + Math.random() * 0.01).toFixed(3),
//     O3: (0.05 + Math.random() * 0.01).toFixed(3),
//     CO: (0.4 + Math.random() * 0.1).toFixed(3),
//     VOC: (0.005 + Math.random() * 0.001).toFixed(3),
//     H2S: (0.01 + Math.random() * 0.005).toFixed(3),
//     NH3: (8 + Math.random() * 5).toFixed(1),
//     OU: (0.005 + Math.random() * 0.003).toFixed(3),
//     HCHO: (0.15 + Math.random() * 0.05).toFixed(3),
//     TEMP: (25 + Math.random() * 5).toFixed(1),
//     HUMI: (55 + Math.random() * 10).toFixed(1),
//     WINsp: (2.0 + Math.random() * 1).toFixed(1),
//     WINdir: (Math.random() * 360).toFixed(1),
//     BATT: (12.0 + Math.random() * 0.5).toFixed(1),
//     FIRM: "1.0.0",
//     SEND: 1,
//   }
//   console.log("Time-based Dummy Air Data:", data)
//   return data
// }

// // 트리거 시나리오 실행 예시
// const devId = 1
// const hour = 9 // 오전 9시
// const dayOfWeek = 3 // 수요일
// const event = "fishing_boat" // 어선 활동

// // 트리거 함수를 호출하여 데이터를 생성
// const airData = triggerScenario(devId, hour, dayOfWeek, event)
// // console.log('Generated Air Data:', airData);
