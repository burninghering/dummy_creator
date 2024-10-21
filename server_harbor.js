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
  res.sendFile(__dirname + "/public/index_harbor.html") // 명시적으로 public 폴더의 index.html 파일을 제공
})

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

// 미리 설정된 경로 좌표 (경로를 따라서 이동 후 역순으로 돌아오는 경로)
const predefinedPath = [
  [35.989426, 129.558305], // 경로의 첫 번째 점
  [35.987844, 129.556101], // 경로의 두 번째 점
  [35.986264, 129.555178],
  [35.984909, 129.557946],
  [35.987171, 129.560444],
  [35.98332, 129.566125],
  [35.978471, 129.569019], // 경로의 마지막 점
]

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

// 두 점 사이의 거리 계산 함수
function calculateDistance(point1, point2) {
  const latDiff = point2[0] - point1[0]
  const longDiff = point2[1] - point1[1]
  return Math.sqrt(latDiff * latDiff + longDiff * longDiff)
}

// 선박 데이터를 생성하는 함수 (경로를 따라가고, 역순으로 돌아옴)
function generateVesselDataAlongPath(devId) {
  const currentDate = new Date()
  const logDatetime = formatDateToYYYYMMDDHHMMSS(currentDate)
  const rcvDatetime = formatDateToYYYYMMDDHHMMSS(
    new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
  )

  // 선박 상태가 없으면 초기화
  if (!vesselState[devId]) {
    vesselState[devId] = {
      currentIndex: 0, // 경로의 시작점 인덱스
      forward: true, // 경로 진행 방향
      speed: 0.0005, // 속도 조정 (느리게 설정)
      lati: predefinedPath[0][0], // 초기 위도
      longi: predefinedPath[0][1], // 초기 경도
      step: 0, // 현재 진행 단계
    }
  }

  let state = vesselState[devId]
  let { currentIndex, forward, step } = state

  // 현재 경로에서의 점
  let [targetLati, targetLongi] = predefinedPath[currentIndex]

  // 목표 위치까지의 거리 계산
  const distance = Math.sqrt(
    Math.pow(targetLati - state.lati, 2) +
      Math.pow(targetLongi - state.longi, 2)
  )

  // 목표 지점까지 일정한 속도로 이동
  if (step < distance / state.speed) {
    // 지정한 속도에 따라 움직임
    state.lati += (targetLati - state.lati) / (distance / state.speed)
    state.longi += (targetLongi - state.longi) / (distance / state.speed)
    step++ // 진행 단계 증가
  } else {
    // 목표 위치에 도달했을 경우
    step = 0 // 진행 단계 초기화
    if (forward) {
      if (currentIndex < predefinedPath.length - 1) {
        currentIndex++
      } else {
        forward = false // 경로 끝에 도달하면 역방향으로 전환
      }
    } else {
      if (currentIndex > 0) {
        currentIndex--
      } else {
        forward = true // 경로 시작점에 도달하면 다시 전진
      }
    }
  }

  // 상태 업데이트
  vesselState[devId] = {
    ...state,
    currentIndex,
    forward,
    lati: state.lati,
    longi: state.longi,
  }

  // 각 sen_id에 대한 값 생성
  const sensorValues = {
    1: rcvDatetime, // rcv_datetime
    2: vesselState[devId].lati.toFixed(5), // latitude
    3: vesselState[devId].longi.toFixed(5), // longitude
    4: state.speed.toFixed(5), // speed
    5: (Math.random() * 360).toFixed(0), // course
    6: (50 + Math.floor(Math.random() * 10)).toFixed(0), // azimuth
  }

  // MySQL에 데이터 저장
  for (let senId = 1; senId <= 6; senId++) {
    const sql = `
      INSERT INTO example_vessel_log_data_scenario (log_datetime, DEV_ID, SEN_ID, sen_value, ALT_ID)
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

// 시뮬레이션 시작 함수
function startVesselSimulation() {
  setInterval(() => {
    for (let i = 1; i <= 100; i++) {
      const vesselData = generateVesselDataAlongPath(i)
      // 모든 선박 데이터를 클라이언트로 전송
      io.emit("vesselData", vesselData)
    }
  }, 1000) // 1초마다 실행
}

startVesselSimulation()

// 서버 실행
server.listen(3000, () => {
  console.log("서버가 포트 3000에서 실행 중입니다.")
})
