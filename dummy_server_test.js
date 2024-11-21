const WebSocket = require("ws")
const mysql = require("mysql2")
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

// 선박 상태를 저장하는 객체
const vesselState = {}
const dataBuffer = [] // 데이터를 수신하여 저장하는 버퍼

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

// WebSocket 배열 생성
const webSockets = []
for (let devId = 1; devId <= 202; devId++) {
  const ws = new WebSocket(`ws://127.0.0.1:6002/vessel${devId}`)
  webSockets.push(ws)

  ws.on("open", () => console.log(`DEV_ID ${devId}에 대한 WebSocket 연결 완료`))
  ws.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data)
      dataBuffer.push(parsedData)

      // 버퍼 크기가 202개가 되면 병합 처리
      if (dataBuffer.length >= 202) {
        processBatch(dataBuffer.splice(0, 202)) // 202개씩 잘라내서 처리
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

// // 데이터베이스에서 초기 상태 가져오기
// async function initializeVesselState() {
//   return new Promise((resolve, reject) => {
//     const query = `
//         SELECT 
//           t1.DEV_ID, 
//           t1.SEN_ID, 
//           t1.sen_value
//         FROM 
//           example_vessel_log_data t1
//         INNER JOIN (
//           SELECT DEV_ID, MAX(log_datetime) AS latest_time
//           FROM example_vessel_log_data
//           WHERE SEN_ID IN (2, 3, 4, 5, 6)
//           GROUP BY DEV_ID
//         ) t2
//         ON t1.DEV_ID = t2.DEV_ID AND t1.log_datetime = t2.latest_time
//       `

//     pool.query(query, (err, results) => {
//       if (err) {
//         console.error("초기 좌표를 가져오는 중 오류가 발생했습니다:", err)
//         return reject(err)
//       }

//       results.forEach((row) => {
//         const devId = row.DEV_ID
//         const senId = row.SEN_ID
//         const value = parseFloat(row.sen_value)

//         if (!vesselState[devId]) {
//           vesselState[devId] = {
//             lati: 0,
//             longi: 0,
//             speed: 0,
//             course: 0,
//             azimuth: 0,
//           }
//         }

//         switch (senId) {
//           case 2:
//             vesselState[devId].lati = value
//             break
//           case 3:
//             vesselState[devId].longi = value
//             break
//           case 4:
//             vesselState[devId].speed = value
//             break
//           case 5:
//             vesselState[devId].course = value
//             break
//           case 6:
//             vesselState[devId].azimuth = value
//             break
//         }
//       })

//       console.log("선박 상태 초기화가 완료되었습니다")
//       resolve()
//     })
//   })
// }

// 202개의 데이터를 처리하는 함수
function processBatch(batch) {
  console.log(`202개의 데이터를 처리 중입니다:`)

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

// 선박 데이터를 생성하는 함수
function generateCurvedVesselData(devId, polygon) {
  const currentDate = new Date()

  if (!vesselState[devId]) {
    const { lati, longi } = getRandomCoordinateWithinPolygon(polygon)
    vesselState[devId] = {
      lati,
      longi,
      speed: 2 + Math.random() * 5,
      course: Math.floor(Math.random() * 360),
    }
  }

  let state = vesselState[devId]

  const speedFactor = state.speed / 2500

  if (!pointInPolygon([state.lati, state.longi], polygon)) {
    state.course = (state.course + 180) % 360
    // console.log(`선박 ${devId}가 경계를 벗어나 방향이 조정되었습니다`)

    state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180)
    state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180)
  } else {
    state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180)
    state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180)
  }

  state.speed = Math.max(1, Math.min(10, state.speed + (Math.random() * 2 - 1)))
  state.course = (state.course + (Math.random() * 20 - 10) + 360) % 360

  return {
    type: "vessel",
    id: devId,
    log_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    rcv_datetime: formatDateToYYYYMMDDHHMMSS(currentDate),
    lati: state.lati.toFixed(7),
    longi: state.longi.toFixed(7),
    speed: parseFloat(state.speed.toFixed(2)),
    course: parseFloat(state.course.toFixed(0)),
    azimuth: (50 + Math.floor(Math.random() * 10)).toFixed(0),
  }
}

// 다각형 내부의 임의 좌표 생성
function getRandomCoordinateWithinPolygon(polygon = []) {
  let minLati = Math.min(...polygon.map((point) => point[0]))
  let maxLati = Math.max(...polygon.map((point) => point[0]))
  let minLongi = Math.min(...polygon.map((point) => point[1]))
  let maxLongi = Math.max(...polygon.map((point) => point[1]))

  let lati, longi
  do {
    lati = minLati + Math.random() * (maxLati - minLati)
    longi = minLongi + Math.random() * (maxLongi - minLongi)
  } while (!pointInPolygon([lati, longi], polygon))

  return { lati, longi }
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
;(async () => {
  console.log("선박 상태를 초기화 중입니다...")
 // await initializeVesselState() // 초기 상태 불러오기

  setInterval(() => {
    for (let devId = 1; devId <= 202; devId++) {
      const ws = webSockets[devId - 1]
      if (ws.readyState === WebSocket.OPEN) {
        const vesselData = generateCurvedVesselData(devId, userDefinedPolygon)
  
        // 데이터 검증
        const validData = validateVesselData(vesselData)
        if (validData) {
          ws.send(JSON.stringify(vesselData), (err) => {
            if (err) {
              console.error(`Vessel ID ${devId} 전송 중 오류 발생:`, err)
            }
          })
        }
      } else {
        console.warn(`Vessel ID ${devId}의 WebSocket 연결이 열려 있지 않습니다`)
      }
    }
  }, 1000)
})()

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