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
    [35.986278, 129.560771],
    [35.987364, 129.566799],
  ],
  [
    [35.984851, 129.553816],
    [35.985381, 129.558574],
    [35.986278, 129.560771],
    [35.986278, 129.560771][(35.984301, 129.568719)],
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

function generateVesselDataAlongPath(devId) {
  const predefinedPath = predefinedPaths[devId % predefinedPaths.length] // 각 선박에게 고정된 경로를 할당

  const currentDate = new Date()
  const logDatetime = formatDateToYYYYMMDDHHMMSS(currentDate)
  const rcvDatetime = formatDateToYYYYMMDDHHMMSS(
    new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
  )

  if (!vesselState[devId]) {
    // 선박마다 고유한 경로를 따르게 설정
    vesselState[devId] = {
      currentIndex: 0, // 경로의 시작점 인덱스
      forward: true, // 경로 진행 방향
      speed: Math.random() * (0.0002 - 0.00005) + 0.00005, // 느리게 이동하도록 속도를 더 작게 설정 (이전 값보다 10배 더 작게 설정)
      lati: predefinedPath[0][0], // 초기 위도
      longi: predefinedPath[0][1], // 초기 경도
    }
  }

  let state = vesselState[devId]
  let { currentIndex, forward } = state

  // 경로가 undefined가 아닌지 확인
  if (
    !predefinedPath ||
    currentIndex >= predefinedPath.length ||
    currentIndex < 0
  ) {
    console.error(
      `predefinedPath가 유효하지 않거나 경로의 범위를 벗어났습니다. DEV_ID: ${devId}`
    )
    return
  }

  // 현재 좌표와 목표 좌표 가져오기
  let [targetLati, targetLongi] = predefinedPath[currentIndex]

  // 목표 위치까지의 거리 계산
  const distance = calculateDistance(
    [state.lati, state.longi],
    [targetLati, targetLongi]
  )

  // 목표 지점까지 직선 이동
  if (distance > state.speed) {
    // 이동할 거리만큼 계산
    const latDiff = targetLati - state.lati
    const longDiff = targetLongi - state.longi

    // 직선 이동 계산
    state.lati += latDiff * (state.speed / distance)
    state.longi += longDiff * (state.speed / distance)
  } else {
    // 목표 위치에 도달했을 경우
    if (forward) {
      if (currentIndex < predefinedPath.length - 1) {
        currentIndex++ // 다음 지점으로 이동
      } else {
        forward = false // 경로 끝에 도달하면 역방향으로 전환
      }
    } else {
      if (currentIndex > 0) {
        currentIndex-- // 이전 지점으로 이동
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
    2: state.lati.toFixed(5), // latitude
    3: state.longi.toFixed(5), // longitude
    4: state.speed.toFixed(5), // speed
    5: (Math.random() * 360).toFixed(0), // course
    6: (50 + Math.floor(Math.random() * 10)).toFixed(0), // azimuth
  }

  // MySQL에 데이터 저장
  for (let senId = 1; senId <= 6; senId++) {
    const sql = `
      INSERT INTO example_vessel_log_data_harbor (log_datetime, DEV_ID, SEN_ID, sen_value, ALT_ID)
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

  // 선박 데이터를 반환하여 클라이언트로 전송
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

// 다각형 내부에서 랜덤으로 선박을 이동시키는 함수
function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date()
  const logDatetime = formatDateToYYYYMMDDHHMMSS(currentDate)
  const rcvDatetime = formatDateToYYYYMMDDHHMMSS(
    new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
  )

  if (!vesselState[devId]) {
    let { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
    vesselState[devId] = {
      lati: lati,
      longi: longi,
      speed: 1 + Math.random() * 3,
      course: Math.floor(Math.random() * 360),
      azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
    }
  }

  let state = vesselState[devId]

  const speedFactor = state.speed / 100000
  const curveFactor = 0.001

  let newLati =
    state.lati + speedFactor * Math.cos((state.course * Math.PI) / 180)
  let newLongi =
    state.longi +
    speedFactor * Math.sin((state.course * Math.PI) / 180) +
    curveFactor * 0.000001

  if (isPointInPolygon([newLati, newLongi], polygon)) {
    state.lati = newLati
    state.longi = newLongi
  } else {
    state.course = (state.course + Math.floor(Math.random() * 180 + 90)) % 360
  }

  state.speed = Math.max(1, Math.min(4, state.speed + (Math.random() * 2 - 1)))
  state.course = (state.course + (Math.random() * 20 - 10)) % 360

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

const userDefinedPolygon = [
  [35.989301, 129.559683], //1
  [35.990568, 129.557613], //2
  [35.990018, 129.55592], //3
  [35.989333, 129.556572], //4
  [35.98877, 129.555796], //5
  [35.989203, 129.555154], //6
  [35.987217, 129.552773], //7
  [35.985626, 129.552162], //8
  [35.983288, 129.555102], //9
  [35.984317, 129.558122],
  [35.985868, 129.559914],
  [35.986041, 129.560725],
  [35.985365, 129.561041],
  [35.983894, 129.559052],
  [35.981223, 129.557145],
  [35.979266, 129.555846],
  [35.979584, 129.55316],
  [35.975212, 129.553949],
  [35.968083, 129.556266],
  [35.965116, 129.5669],
  [35.988957, 129.572315],
  [35.988819, 129.561302],
  [35.986642, 129.558267],
  [35.985553, 129.55833],
  [35.985502, 129.55761],
  [35.987199, 129.556984],
  [35.989301, 129.559683], // 마지막 점은 다각형을 닫습니다.
]

// 시뮬레이션 시작 함수
function startVesselSimulation() {
  for (let i = 1; i <= 100; i++) {
    if (i <= 20) {
      // 20대의 배는 30초에서 4분 사이의 랜덤한 지연 시간 설정
      const delay = Math.random() * 210000 + 30000 // 30초(30,000ms)에서 4분(240,000ms)

      setTimeout(() => {
        setInterval(() => {
          const predefinedPath =
            predefinedPaths[Math.floor(Math.random() * predefinedPaths.length)]
          const vesselData = generateVesselDataAlongPath(i, predefinedPath)
          if (vesselData) {
            io.emit("vesselData", vesselData) // 경로를 따라 움직이는 배
          }
        }, 1000) // 1초마다 실행
      }, delay) // 지연 시간 적용
    } else {
      // 나머지 80대는 즉시 시작
      setInterval(() => {
        const vesselData = generateCurvedVesselData(i, userDefinedPolygon)
        io.emit("vesselData", vesselData) // 랜덤하게 이동하는 배
      }, 1000) // 1초마다 실행
    }
  }
}

startVesselSimulation()

// 서버 실행
server.listen(3000, () => {
  console.log("서버가 포트 3000에서 실행 중입니다.")
})
