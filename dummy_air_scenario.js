const mysql = require("mysql2/promise")

// MySQL 데이터베이스 연결 설정
const pool = mysql.createPool({
  host: "192.168.0.225",
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
})

// 시나리오별 정수형 값을 정의
const scenarioMap = {
  fishing_boat: 1,
  tourism: 2,
  storm: 3,
  default: 0,
}

// 데이터 저장 함수
async function SaveScenarioAirData(devId, senId, sensorValue, scenario) {
  const connection = await pool.getConnection()
  try {
    const currentDateTime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ")

    // 시나리오를 정수로 변환
    const scenarioValue = scenarioMap[scenario] || scenarioMap["default"]

    const sqlInsert = `
            INSERT INTO example_air_log_data_scenario (DEV_ID, SEN_ID, SEN_VALUE, log_datetime, ALT_ID)
            VALUES (?, ?, ?, ?, ?)
        `
    await connection.execute(sqlInsert, [
      devId,
      senId,
      sensorValue,
      currentDateTime,
      scenarioValue,
    ])

    console.log(
      `Scenario air data saved for DEV_ID: ${devId}, SEN_ID: ${senId}`
    )
  } catch (error) {
    console.error("Error saving scenario air data:", error.message)
  } finally {
    connection.release()
  }
}

// 시나리오 데이터를 생성하고 저장하는 함수
async function saveAirDataForAllDevices(hour, dayOfWeek, event) {
  const deviceCount = 5 // 5개의 디바이스
  for (let devId = 1; devId <= deviceCount; devId++) {
    await saveAirDataToDatabase(devId, hour, dayOfWeek, event)
  }
}

// 각 디바이스별로 데이터를 저장하는 함수
async function saveAirDataToDatabase(devId, hour, dayOfWeek, event) {
  const airData = triggerScenario(devId, hour, dayOfWeek, event)

  const sensorNames = [
    "PM10",
    "PM25",
    "SO2",
    "NO2",
    "O3",
    "CO",
    "VOCs",
    "H2S",
    "NH3",
    "OU",
    "HCHO",
    "TEMP",
    "HUMI",
    "WINsp",
    "WINdir",
    "BATT",
    "FIRM",
    "SEND",
  ]

  const scenario = event || "default" // 시나리오 이름 설정

  for (let i = 0; i < sensorNames.length; i++) {
    const senName = sensorNames[i]
    const sensorValue = airData[senName]

    // `SEN_ID`는 1부터 18까지 설정
    await SaveScenarioAirData(devId, i + 1, sensorValue, scenario)
  }
}

// 트리거 시나리오를 실행하는 함수
function triggerScenario(devId, hour, dayOfWeek, event = null) {
  const isFishingBoatActive = event === "fishing_boat"
  const isTouristPeakSeason = event === "tourism"
  const isStormWarning = event === "storm"
  const isMorning = hour >= 6 && hour < 9
  const isAfternoon = hour >= 12 && hour < 15
  const isEvening = hour >= 18 && hour < 21

  if (isFishingBoatActive && (isMorning || isEvening)) {
    return generateFishingBoatScenario(devId, hour)
  } else if (isTouristPeakSeason && isAfternoon) {
    return generateTourismScenario(devId, hour)
  } else if (isStormWarning) {
    return generateStormScenario(devId, hour)
  } else {
    return generateTimeBasedDummyAirData(devId, hour)
  }
}

// 기본적인 공기질 데이터 생성 함수
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

// 10초마다 데이터를 생성하는 함수
function startDataGeneration(hour, dayOfWeek, event) {
  const startTime = Date.now()
  const duration = 10 * 60 * 1000 // 10분 동안 실행 (밀리초 단위)

  const interval = setInterval(async () => {
    const currentTime = Date.now()
    if (currentTime - startTime >= duration) {
      clearInterval(interval)
      console.log("10분간의 데이터 생성이 완료되었습니다.")
      return
    }

    const currentHour = new Date().getHours() // 현재 시간에 따라 데이터를 생성
    await saveAirDataForAllDevices(currentHour, dayOfWeek, event) // 5개의 디바이스에 대해 10초마다 데이터 생성
  }, 10000) // 10초마다 실행
}

startDataGeneration(8, 3, "fishing_boat") //시간, 요일, 시나리오
