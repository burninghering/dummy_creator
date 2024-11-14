const pointInPolygon = require("point-in-polygon")
const vesselState = {} // 모든 선박 상태를 저장하는 객체

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
  } while (!pointInPolygon([lati, longi], polygon))

  return { lati, longi }
}

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
  const speedFactor = state.speed / 500

  // 현재 위치가 다각형 경계를 벗어나는지 확인
  if (!pointInPolygon([state.lati, state.longi], polygon)) {
    state.course = (state.course + 180) % 360
    console.log(`선박 ${devId}가 경계를 벗어났습니다: 방향을 반대로 조정`)

    // 새로운 방향으로 이동 업데이트
    state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180)
    state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180)
  } else {
    state.lati += speedFactor * Math.cos((state.course * Math.PI) / 180)
    state.longi += speedFactor * Math.sin((state.course * Math.PI) / 180)
  }

  state.speed = Math.max(1, Math.min(10, state.speed + (Math.random() * 2 - 1)))
  state.course = (state.course + (Math.random() * 20 - 10) + 360) % 360

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
// 점이 다각형 내부에 있는지 확인하는 함수 (Ray-casting 알고리즘)
function isPointInPolygon(point, polygon) {
  return pointInPolygon(point, polygon)
}
module.exports = { generateCurvedVesselData, userDefinedPolygon }
