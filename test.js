const mysql = require("mysql")
const express = require("express")
const http = require("http")
const socketIo = require("socket.io")

// Express 애플리케이션 및 서버 설정
const app = express()
const server = http.createServer(app)
const io = socketIo(server)

// 정적 파일 제공
app.use(express.static(__dirname + "/public"))

// 정확한 정적 파일을 제공
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index_harbor.html")
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

// 미리 설정된 경로 좌표
const predefinedPaths = [
  [
    [35.989426, 129.558305],
    [35.987844, 129.556101],
    [35.986264, 129.555178],
    [35.984909, 129.557946],
    [35.987171, 129.560444],
    [35.98332, 129.566125],
    [35.978471, 129.569019],
  ],
  [
    [35.989981, 129.5564447],
    [35.989199, 129.557105],
    [35.98787, 129.555715],
    [35.985365, 129.554751],
    [35.984177, 129.555912],
    [35.986139, 129.559523],
    [35.986901, 129.562615],
    [35.978373, 129.560081],
    [35.971042, 129.566363],
  ],
  [
    [35.990517, 129.558129],
    [35.985469, 129.554454],
    [35.984271, 129.55596],
    [35.986181, 129.559418],
    [35.986573, 129.562173],
    [35.979076, 129.562231],
  ],
  [
    [35.98902, 129.555172],
    [35.984441, 129.556598],
    [35.987596, 129.561817],
    [35.981358, 129.568331],
    [35.97732, 129.568349],
    [35.974137, 129.562106],
  ],
  [
    [35.988134, 129.554185],
    [35.984586, 129.557288],
    [35.987725, 129.559977],
    [35.98295, 129.562373],
    [35.976438, 129.560245],
  ],
  [
    [35.987518, 129.553484],
    [35.985298, 129.557682],
    [35.985773, 129.559098],
    [35.987931, 129.560208],
    [35.984692, 129.564456],
    [35.977231, 129.56402],
  ],
  [
    [35.986371, 129.552942],
    [35.984093, 129.555143],
    [35.987013, 129.560845],
    [35.987364, 129.566799],
  ],
  [
    [35.984851, 129.553816],
    [35.985381, 129.558574],
    [35.988559, 129.561645],
    [35.984301, 129.568719],
  ],
  [
    [35.990242, 129.557083],
    [35.988871, 129.557718],
    [35.986371, 129.555305],
    [35.98476, 129.557866],
    [35.986555, 129.558693],
    [35.986546, 129.562407],
    [35.985346, 129.567703],
    [35.980803, 129.569541],
    [35.974975, 129.569033],
  ],
  [
    [35.988894, 129.556351],
    [35.984546, 129.557132],
    [35.986362, 129.559291],
    [35.986734, 129.562407],
    [35.981088, 129.563551],
  ],
]

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
      speed: 0.0005, // 속도 조정
      lati: predefinedPath[0][0], // 초기 위도
      longi: predefinedPath[0][1], // 초기 경도
    }
  }

  let state = vesselState[devId]
  let { currentIndex, forward } = state

  // 현재 좌표를 경로의 인덱스에 맞게 가져옴
  let [targetLati, targetLongi] = predefinedPath[currentIndex]

  // 목표 위치까지의 거리 계산
  const distance = calculateDistance(
    [state.lati, state.longi],
    [targetLati, targetLongi]
  )

  // 목표 지점까지 바로 이동
  if (distance > state.speed) {
    // 목표 위치까지의 거리가 이동 속도보다 큰 경우
    const latDiff = targetLati - state.lati
    const longDiff = targetLongi - state.longi

    // 배가 경로를 벗어나지 않도록 직선으로 업데이트
    state.lati += latDiff * (state.speed / distance)
    state.longi += longDiff * (state.speed / distance)
  } else {
    // 목표 위치에 도달했을 경우
    if (forward) {
      if (currentIndex < predefinedPath.length - 1) {
        currentIndex++ // 다음 점으로 이동
      } else {
        forward = false // 경로 끝에 도달하면 역방향으로 전환
      }
    } else {
      if (currentIndex > 0) {
        currentIndex-- // 이전 점으로 이동
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
    for (let i = 1; i <= 30; i++) {
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
