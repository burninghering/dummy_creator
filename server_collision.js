const mysql = require("mysql")
const express = require("express")
const http = require("http")
const socketIo = require("socket.io")

// Express 애플리케이션 및 서버 설정
const app = express()
const server = http.createServer(app)
const io = socketIo(server)

// 정적 파일 제공 (특정 파일인 index.html을 public 폴더에서 제공)
app.use(express.static(__dirname + "/public"))

// 정확한 정적 파일을 제공
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index_collision.html") // 명시적으로 public 폴더의 index.html 파일을 제공
})

// MySQL 데이터베이스 연결 설정
const connection = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "1234",
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
let collisionOccurred = false // 충돌이 이미 발생했는지 여부
const safeDistance = 100 // 충돌 감지 거리 (미터)
const collisionVessel1 = 1 // 충돌할 첫 번째 선박 ID
const collisionVessel2 = 2 // 충돌할 두 번째 선박 ID

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

// Haversine 공식을 이용한 두 점 사이의 거리 계산 함수 (미터 단위)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // 지구의 반경 (미터 단위)
  const φ1 = (lat1 * Math.PI) / 180 // 위도1 라디안
  const φ2 = (lat2 * Math.PI) / 180 // 위도2 라디안
  const Δφ = ((lat2 - lat1) * Math.PI) / 180 // 위도 차이
  const Δλ = ((lon2 - lon1) * Math.PI) / 180 // 경도 차이

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const distance = R * c // 두 점 사이의 거리 (미터)
  return distance
}
// 모든 선박 간의 충돌 여부 확인
function checkAllVesselsCollision() {
  const vesselIds = Object.keys(vesselState) // 현재 시뮬레이션에 존재하는 모든 선박 ID
  for (let i = 0; i < vesselIds.length; i++) {
    for (let j = i + 1; j < vesselIds.length; j++) {
      const vesselId1 = vesselIds[i]
      const vesselId2 = vesselIds[j]

      if (checkTwoVesselsCollision(vesselId1, vesselId2)) {
        handleCollision(vesselId1, vesselId2) // 충돌 감지 시 처리
      }
    }
  }
}

// 두 배 충돌 여부 확인 (Haversine 공식을 사용)
function checkTwoVesselsCollision(vesselId1, vesselId2) {
  if (!collisionTriggered || collisionOccurred) return false

  const vessel1 = vesselState[vesselId1]
  const vessel2 = vesselState[vesselId2]

  const distance = calculateHaversineDistance(
    vessel1.lati,
    vessel1.longi,
    vessel2.lati,
    vessel2.longi
  )

  console.log(`선박 ${vesselId1}와 선박 ${vesselId2} 간 거리: ${distance} 미터`)

  return distance < safeDistance // 100미터 이하일 경우 충돌로 간주
}

// 충돌한 선박의 위치를 데이터베이스에 저장하는 함수
function saveCollisionData(vesselId) {
  setInterval(() => {
    const state = vesselState[vesselId]
    const currentDate = new Date()
    const logDatetime = formatDateToYYYYMMDDHHMMSS(currentDate)
    const rcvDatetime = formatDateToYYYYMMDDHHMMSS(
      new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
    )

    // 각 sen_id에 대한 값 생성
    const sensorValues = {
      1: rcvDatetime, // rcv_datetime
      2: state.lati.toFixed(5), // latitude
      3: state.longi.toFixed(5), // longitude
      4: state.speed.toFixed(5), // speed (0, 충돌 후 정지)
      5: (Math.random() * 360).toFixed(0), // course (임의)
      6: (50 + Math.floor(Math.random() * 10)).toFixed(0), // azimuth (임의)
    }

    // 충돌한 위치를 지속적으로 저장
    for (let senId = 1; senId <= 6; senId++) {
      const sql = `
        INSERT INTO example_vessel_log_data_collision (log_datetime, DEV_ID, SEN_ID, sen_value, ALT_ID)
        VALUES (?, ?, ?, ?, ?)
      `
      const params = [
        logDatetime, // log_datetime
        vesselId, // DEV_ID
        senId, // SEN_ID
        sensorValues[senId], // sen_value
        null, // ALT_ID (고정 값으로 설정 가능)
      ]

      connection.query(sql, params, (err, result) => {
        if (err) {
          console.error("데이터베이스에 데이터를 삽입하는 중 오류 발생:", err)
        } else {
          console.log(
            `충돌한 선박 ${vesselId}의 센서 ${senId} 데이터가 저장되었습니다.`
          )
        }
      })
    }
  }, 5000) // 5초마다 데이터를 저장
}

// 충돌 여부를 확인하는 함수 (두 선박에 대해서만 충돌 확인)
function checkCollisionBetweenTwoVessels() {
  if (!vesselState[collisionVessel1] || !vesselState[collisionVessel2]) return

  // 두 배 사이의 충돌 여부 확인
  if (checkTwoVesselsCollision(collisionVessel1, collisionVessel2)) {
    handleCollision(collisionVessel1, collisionVessel2)
  }
}

// 선박이 충돌한 후 해당 위치 근처로 다른 선박이 지나가지 않도록 하는 함수
function preventNearbyCollision(vesselId) {
  const collisionVessel = vesselState[vesselId]

  // 모든 다른 선박을 검사하여 충돌한 선박 주변의 안전 거리 내에 있는지 확인
  for (let otherVesselId in vesselState) {
    if (otherVesselId !== vesselId && !vesselState[otherVesselId].stopped) {
      const otherVessel = vesselState[otherVesselId]

      // 충돌한 선박과 다른 선박 사이의 거리 계산
      const distance = calculateHaversineDistance(
        collisionVessel.lati,
        collisionVessel.longi,
        otherVessel.lati,
        otherVessel.longi
      )

      // 안전 거리 내에 있는 경우 이동을 멈추거나 방향을 바꿈
      if (distance < safeDistance) {
        console.log(
          `선박 ${otherVesselId}가 충돌한 선박 ${vesselId} 근처에 접근했습니다. 이동을 제한합니다.`
        )

        // 선박을 이동하지 못하게 멈추거나 방향 전환
        otherVessel.speed = 0
        otherVessel.course = (otherVessel.course + 180) % 360 // 임시로 방향을 180도 반대로 변경
      }
    }
  }
}

// 선박 데이터를 생성하는 함수 (곡선 이동 및 DB 저장)
function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date() // 현재 시간을 생성
  const logDatetime = formatDateToYYYYMMDDHHMMSS(currentDate)

  // rcv_datetime은 log_datetime보다 1~3초 앞선 값으로 설정
  const rcvDatetime = formatDateToYYYYMMDDHHMMSS(
    new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
  )

  // 선박 상태가 없으면 초기화
  if (!vesselState[devId]) {
    let { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
    vesselState[devId] = {
      lati: lati,
      longi: longi,
      speed: 1 + Math.random() * 3, // 더 느린 속도 설정 (1 ~ 4 km/h)
      course: Math.floor(Math.random() * 360), // 초기 방향 설정 (0~360도)
      azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0), // 방위각
      stopped: false, // 충돌 후 정지 상태를 추적하는 플래그 추가
    }
  }

  let state = vesselState[devId]

  // 충돌로 인해 정지 상태이면 더 이상 이동하지 않음
  if (state.stopped) {
    preventNearbyCollision(devId) // 다른 선박이 충돌한 선박 근처에 접근하지 못하게 제어
    console.log(`선박 ${devId}은 충돌로 인해 멈춤.`)
    return {
      log_datetime: logDatetime,
      rcv_datetime: rcvDatetime,
      id: devId,
      lati: state.lati.toFixed(5),
      longi: state.longi.toFixed(5),
      speed: state.speed.toFixed(2),
      course: state.course.toFixed(0),
      azimuth: state.azimuth,
    }
  }

  // 이동 거리 및 곡선 이동을 조정하여 속도를 낮추기
  const speedFactor = state.speed / 100000 // 이동 거리를 축소하여 더 작은 범위에서 움직이도록 설정
  const curveFactor = 0.001 // 곡선 이동을 위한 커브 인자 축소

  // 새로운 좌표 계산
  let newLati =
    state.lati + speedFactor * Math.cos((state.course * Math.PI) / 180)
  let newLongi =
    state.longi +
    speedFactor * Math.sin((state.course * Math.PI) / 180) +
    curveFactor * 0.000001

  // 다각형 내부에서만 움직임을 허용
  if (isPointInPolygon([newLati, newLongi], polygon)) {
    state.lati = newLati
    state.longi = newLongi
  } else {
    // 경계에 부딪혔을 때 방향을 임의의 각도로 변경
    state.course = (state.course + Math.floor(Math.random() * 180 + 90)) % 360
  }

  // 속도와 방향의 변화를 더욱 무작위화하여 이동 패턴을 다양화
  state.speed = Math.max(1, Math.min(4, state.speed + (Math.random() * 2 - 1))) // 속도 변화 (1 ~ 4 km/h)
  state.course = (state.course + (Math.random() * 20 - 10)) % 360 // 방향을 더 작게 변화시킴

  // 각 sen_id에 대한 값 생성
  const sensorValues = {
    1: rcvDatetime, // rcv_datetime
    2: state.lati.toFixed(5), // latitude
    3: state.longi.toFixed(5), // longitude
    4: state.speed.toFixed(2), // speed
    5: state.course.toFixed(0), // course
    6: state.azimuth, // azimuth
  }

  // MySQL에 데이터 저장
  for (let senId = 1; senId <= 6; senId++) {
    const sql = `
      INSERT INTO example_vessel_log_data_collision (log_datetime, DEV_ID, SEN_ID, sen_value, ALT_ID)
      VALUES (?, ?, ?, ?, ?)
    `
    const params = [
      logDatetime, // log_datetime
      devId, // DEV_ID
      senId, // SEN_ID
      sensorValues[senId], // sen_value
      null, // ALT_ID (고정 값으로 설정 가능)
    ]

    connection.query(sql, params, (err, result) => {
      if (err) {
        console.error("데이터베이스에 데이터를 삽입하는 중 오류 발생:", err)
      } else {
        console.log(
          `DEV_ID ${devId}의 센서 ${senId} 데이터가 성공적으로 저장되었습니다.`
        )
      }
    })
  }

  return {
    log_datetime: logDatetime,
    rcv_datetime: rcvDatetime,
    id: devId,
    lati: sensorValues[2],
    longi: sensorValues[3],
    speed: sensorValues[4],
    course: sensorValues[5],
    azimuth: sensorValues[6],
  }
}

// 선박 충돌 처리
function handleCollision(vesselId1, vesselId2) {
  if (collisionOccurred) return // 이미 충돌이 발생했으면 처리하지 않음

  // 충돌한 두 선박의 속도를 0으로 설정하여 멈추도록 함
  vesselState[vesselId1].speed = 0
  vesselState[vesselId2].speed = 0

  // 충돌한 선박들의 이동을 영구적으로 멈추기 위해 stopped 플래그 설정
  vesselState[vesselId1].stopped = true
  vesselState[vesselId2].stopped = true

  // 충돌한 선박의 마커 색상을 빨간색으로 변경
  io.emit("collisionDetected", { vessel1: vesselId1, vessel2: vesselId2 })

  console.log(`충돌 발생: 선박 ${vesselId1}와 선박 ${vesselId2}`)
  collisionOccurred = true // 충돌 발생 플래그 설정
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

// 시뮬레이션 시작 함수
function startVesselSimulation() {
  // 30초 후에 충돌 감지를 활성화
  setTimeout(() => {
    collisionTriggered = true
    console.log("30초 후 충돌 감지 활성화됨.")
  }, 30000)

  setInterval(() => {
    for (let i = 1; i <= 100; i++) {
      const vesselData = generateCurvedVesselData(i, userDefinedPolygon)
      io.emit("vesselData", vesselData) // 모든 선박 데이터를 클라이언트로 전송
    }

    // 모든 선박 간의 충돌 감지
    checkAllVesselsCollision()
  }, 1000) // 1초마다 실행
}

startVesselSimulation()

// 서버 실행
server.listen(3000, () => {
  console.log("서버가 포트 3000에서 실행 중입니다.")
})
