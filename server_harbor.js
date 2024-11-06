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

const pool = mysql.createPool({
  connectionLimit: 10, // 동시에 열 수 있는 연결 수를 제한
  host: "192.168.0.225",
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
})

// 커넥션 풀을 사용하는 부분
pool.getConnection((err, connection) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err)
    return
  }
  console.log("데이터베이스에 성공적으로 연결되었습니다.")
  connection.release() // 연결 해제 (풀에서 사용 후 반환)
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
  const predefinedPath = predefinedPaths[devId % predefinedPaths.length]
  const currentDate = new Date()
  const logDatetime = formatDateToYYYYMMDDHHMMSS(currentDate)
  const rcvDatetime = formatDateToYYYYMMDDHHMMSS(
    new Date(currentDate.getTime() - (Math.random() * 2000 + 1000))
  )

  if (!vesselState[devId]) {
    vesselState[devId] = {
      currentIndex: 0,
      forward: true,
      speed: Math.random() * (0.0002 - 0.00005) + 0.00005,
      lati: predefinedPath[0][0],
      longi: predefinedPath[0][1],
    }
  }

  let state = vesselState[devId]
  let { currentIndex, forward } = state
  let [targetLati, targetLongi] = predefinedPath[currentIndex]
  const distance = calculateDistance(
    [state.lati, state.longi],
    [targetLati, targetLongi]
  )

  if (distance > state.speed) {
    const latDiff = targetLati - state.lati
    const longDiff = targetLongi - state.longi
    state.lati += latDiff * (state.speed / distance)
    state.longi += longDiff * (state.speed / distance)
  } else {
    if (forward) {
      currentIndex < predefinedPath.length - 1
        ? currentIndex++
        : (forward = false)
    } else {
      currentIndex > 0 ? currentIndex-- : (forward = true)
    }
  }

  vesselState[devId] = { ...state, currentIndex, forward }

  const sensorValues = {
    1: rcvDatetime,
    2: state.lati.toFixed(5),
    3: state.longi.toFixed(5),
    4: state.speed.toFixed(5),
    5: (Math.random() * 360).toFixed(0),
    6: (50 + Math.floor(Math.random() * 10)).toFixed(0),
  }

  // MySQL 쿼리 병렬 처리
  const promises = []
  for (let senId = 1; senId <= 6; senId++) {
    const sql = `INSERT INTO example_vessel_log_data_harbor (log_datetime, DEV_ID, SEN_ID, sen_value, ALT_ID) VALUES (?, ?, ?, ?, ?)`
    const params = [logDatetime, devId, senId, sensorValues[senId], null]

    promises.push(
      new Promise((resolve, reject) => {
        pool.query(sql, params, (err, result) => {
          if (err) return reject(err)
          resolve(result)
        })
      })
    )
  }

  // 모든 쿼리 완료 대기
  return Promise.all(promises).then(() => ({
    log_datetime: logDatetime,
    rcv_datetime: rcvDatetime,
    id: devId,
    lati: sensorValues[2],
    longi: sensorValues[3],
    speed: sensorValues[4],
    course: sensorValues[5],
    azimuth: sensorValues[6],
  }))
}

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

  const sensorValues = {
    1: rcvDatetime,
    2: state.lati.toFixed(5),
    3: state.longi.toFixed(5),
    4: state.speed.toFixed(2),
    5: state.course.toFixed(0),
    6: state.azimuth,
  }

  // MySQL 쿼리 병렬 처리
  const promises = []
  for (let senId = 1; senId <= 6; senId++) {
    const sql = `INSERT INTO example_vessel_log_data_harbor (log_datetime, DEV_ID, SEN_ID, sen_value, ALT_ID) VALUES (?, ?, ?, ?, ?)`
    const params = [logDatetime, devId, senId, sensorValues[senId], null]

    promises.push(
      new Promise((resolve, reject) => {
        pool.query(sql, params, (err, result) => {
          if (err) return reject(err)
          resolve(result)
        })
      })
    )
  }

  // 모든 쿼리 완료 대기
  return Promise.all(promises).then(() => ({
    log_datetime: logDatetime,
    rcv_datetime: rcvDatetime,
    id: devId,
    lati: sensorValues[2],
    longi: sensorValues[3],
    speed: sensorValues[4],
    course: sensorValues[5],
    azimuth: sensorValues[6],
  }))
}

// 다각형 정의 (사용자 정의 다각형)
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
  // 20대 선박은 랜덤한 1초에서 4분 지연 후 출발
  for (let i = 1; i <= 20; i++) {
    const delay = Math.random() * 240000 + 1000 // 1초에서 4분 지연

    setTimeout(() => {
      const intervalId = setInterval(() => {
        const predefinedPath =
          predefinedPaths[Math.floor(Math.random() * predefinedPaths.length)]
        const vesselData = generateVesselDataAlongPath(i, predefinedPath)
        if (vesselData) {
          io.emit("vesselData", vesselData) // 선박 데이터 전송
        }
      }, 1000) // 1초마다 실행
    }, delay) // 지연 적용
  }

  // 나머지 80대는 즉시 출발하여 랜덤하게 이동
  for (let i = 21; i <= 100; i++) {
    setInterval(() => {
      const vesselData = generateCurvedVesselData(i, userDefinedPolygon)
      if (vesselData) {
        io.emit("vesselData", vesselData) // 선박 데이터 전송
      }
    }, 1000) // 1초마다 실행
  }
}

// 시뮬레이션 시작
startVesselSimulation()

// 서버 실행
server.listen(3001, () => {
  console.log("서버가 포트 3001에서 실행 중입니다.")
})
