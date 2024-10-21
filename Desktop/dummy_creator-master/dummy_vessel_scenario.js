const mysql = require("mysql")

// MySQL 데이터베이스 연결 설정
const connection = mysql.createConnection({
  host: "192.168.0.225",
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
})

// 데이터베이스 연결
connection.connect((err) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err)
    return
  }
  console.log("데이터베이스에 성공적으로 연결되었습니다.")
})

let vesselState = {} // 각 선박의 상태를 저장하는 객체
let collisionTriggered = false // 30초 후 충돌 발생 플래그

// 두 점(위도, 경도) 사이의 거리를 계산하는 함수
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

// 두 배 충돌 여부 확인 (30초 후에만 충돌 가능)
function checkTwoVesselsCollision(vesselId1, vesselId2, safeDistance) {
  if (!collisionTriggered) return false // 30초 후에만 충돌 발생

  const vessel1 = vesselState[vesselId1]
  const vessel2 = vesselState[vesselId2]

  const distance = calculateDistance(
    vessel1.lati,
    vessel1.longi,
    vessel2.lati,
    vessel2.longi
  )

  // 충돌 거리에 있을 경우 true 반환
  if (distance < safeDistance) {
    // 충돌이 발생하면 두 선박의 속도를 0으로 설정
    vessel1.speed = 0
    vessel2.speed = 0
    console.log(`선박 ${vesselId1}와 선박 ${vesselId2}가 충돌하여 멈췄습니다.`)
    return true
  }
  return false
}

// 다각형 내부에서 임의의 좌표를 생성하는 함수
function getRandomCoordinateWithinPolygon(polygon) {
  let minLati = Math.min(...polygon.map((point) => point[0]))
  let maxLati = Math.max(...polygon.map((point) => point[0]))
  let minLongi = Math.min(...polygon.map((point) => point[1]))
  let maxLongi = Math.max(...polygon.map((point) => point[1]))

  let lati, longi

  do {
    lati = minLati + Math.random() * (maxLati - minLati)
    longi = minLongi + Math.random() * (maxLongi - minLongi)
  } while (!isPointInPolygon([lati, longi], polygon))

  return { lati, longi }
}

// 점이 다각형 내부에 있는지 확인하는 함수
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

// 선박 데이터를 생성하는 함수 (곡선 이동)
function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date() // 현재 시간을 생성

  if (!vesselState[devId]) {
    let { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
    vesselState[devId] = {
      lati: lati,
      longi: longi,
      speed: 2 + Math.random() * 10,
      course: Math.floor(Math.random() * 360),
    }
  }

  let state = vesselState[devId]

  // 선박 속도가 0이면 더 이상 이동하지 않음 (충돌 후)
  if (state.speed === 0) {
    return {
      type: "vessel",
      id: devId,
      log_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
      rcv_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
      lati: state.lati.toFixed(3),
      longi: state.longi.toFixed(3),
      speed: state.speed.toFixed(2),
      course: state.course.toFixed(0),
      azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
    }
  }

  const speedFactor = state.speed / 1000
  const curveFactor = 10 // 곡선 이동을 위한 커브 인자
  let newLati =
    state.lati + speedFactor * Math.cos((state.course * Math.PI) / 180)
  let newLongi =
    state.longi +
    speedFactor * Math.sin((state.course * Math.PI) / 180) +
    curveFactor * 0.00001

  // 다각형 내부에서만 움직임을 허용
  if (isPointInPolygon([newLati, newLongi], polygon)) {
    state.lati = newLati
    state.longi = newLongi
  } else {
    state.course = (state.course + 180) % 360 // 경계에 부딪히면 방향 변경
  }

  state.speed = Math.max(2, Math.min(12, state.speed + (Math.random() * 2 - 1)))
  state.course = (state.course + (Math.random() * 10 - 5)) % 360

  // 요청하신 형식의 더미 데이터 생성
  return {
    type: "vessel",
    id: devId,
    log_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    rcv_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    lati: state.lati.toFixed(5),
    longi: state.longi.toFixed(5),
    speed: state.speed.toFixed(2),
    course: state.course.toFixed(0),
    azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
  }
}

// 데이터를 데이터베이스에 저장하는 함수 (각각의 센서 값에 맞게 저장)
function saveVesselDataToDB(vesselData) {
  const sensors = [
    { sen_id: 1, sen_name: "rcv_datetime", sen_value: vesselData.rcv_datetime },
    { sen_id: 2, sen_name: "lati", sen_value: vesselData.lati },
    { sen_id: 3, sen_name: "longi", sen_value: vesselData.longi },
    { sen_id: 4, sen_name: "speed", sen_value: vesselData.speed },
    { sen_id: 5, sen_name: "course", sen_value: vesselData.course },
    { sen_id: 6, sen_name: "azimuth", sen_value: vesselData.azimuth },
  ]

  sensors.forEach((sensor) => {
    const sql = `
            INSERT INTO example_vessel_log_data_scenario 
            (log_datetime, DEV_ID, SEN_ID, sen_value) 
            VALUES (?, ?, ?, ?)
        `
    const values = [
      vesselData.log_datetime, // 현재 시간이 제대로 들어가도록 설정
      vesselData.id,
      sensor.sen_id,
      sensor.sen_value, // 각 센서의 값을 올바르게 매핑
    ]

    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error("데이터 저장 오류:", err.sqlMessage)
        return
      }
      console.log(
        `선박 ${vesselData.id}의 ${sensor.sen_name} 데이터 저장 완료.`
      )
    })
  })
}

// 다각형 정의 (구룡포항 근처 좌표)
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

// 충돌 및 곡선 이동 시뮬레이션 함수
function startVesselSimulation() {
  const startTime = Date.now()
  const duration = 5 * 60 * 1000 // 5분 동안 실행 (밀리초 단위)
  const collisionVessels = [1, 2] // 충돌할 두 선박 ID

  // 30초 후에 충돌 발생을 허용
  setTimeout(() => {
    collisionTriggered = true
    console.log("30초가 지나 충돌이 가능해졌습니다.")
  }, 30000)

  const interval = setInterval(() => {
    const currentTime = Date.now()
    if (currentTime - startTime >= duration) {
      clearInterval(interval)
      console.log("5분간의 시뮬레이션이 완료되었습니다.")
      return
    }

    for (let i = 1; i <= 100; i++) {
      const vesselData = generateCurvedVesselData(i, userDefinedPolygon)

      // 두 선박만 충돌하도록 설정
      if (i === collisionVessels[0] || i === collisionVessels[1]) {
        if (
          checkTwoVesselsCollision(
            collisionVessels[0],
            collisionVessels[1],
            0.001
          )
        ) {
          console.log(
            `선박 ${collisionVessels[0]}와 선박 ${collisionVessels[1]}가 충돌했습니다!`
          )
        }
      }

      // 모든 선박의 데이터를 데이터베이스에 저장
      saveVesselDataToDB(vesselData)
    }
  }, 1000) // 1초마다 실행
}
