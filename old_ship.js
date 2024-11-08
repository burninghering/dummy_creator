const mysql = require("mysql")
const turf = require("@turf/turf")

// MySQL 데이터베이스 연결 설정
const connection = mysql.createConnection({
  host: "192.168.0.225",
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
})

connection.connect((err) => {
  if (err) throw err
  console.log("MySQL 연결 성공")

  // 초기화 코드: ship_id 1부터 100까지 row 초기화
  const tonageValues = [
    10.9, 2.88, 10.61, 6.07, 15.44, 12.19, 142.49, 20.93, 7.84, 6.57, 11.9,
    25.78, 6.62, 16.89, 13.11, 5.17, 20.93, 20.93, 76.52, 76.52, 7.73, 5.07,
    84.44, 25.78, 12.51, 6.31, 76.52, 20.93, 25.78, 20.93, 4.33, 11.61, 13.17,
    7.92, 76.52, 3.75, 15.17, 15.17, 11.9, 12.98, 9.26, 7.63, 25.78, 10.55,
    92.36, 5.07, 6.07, 4.27, 25.78, 9.21, 25.78, 5.09, 9.16, 11.45, 110.83,
    13.11, 84.44, 13.17, 10.55, 10.92, 7.73, 20.93, 102.91, 7.92, 25.78, 13.11,
    13.01, 20.93, 25.78, 4.67, 13.11, 25.78, 5.07, 6.07, 7.73, 60.69, 10.55,
    6.41, 11.56, 10.55, 76.52, 2.22, 5.2, 25.78, 25.78, 10.92, 15.44, 105.55,
    84.44, 105.55, 76.52, 12.77, 6.7, 10.74, 25.78, 124.02, 14.25, 6.02, 11.9,
    25.78,
  ]

  tonageValues.forEach((tonage, index) => {
    const ship_id = index + 1
    const query = `
      INSERT INTO old_ship (ship_id, lati, longi, cnt, stay_time, tonage, total, CO2)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE ship_id = ship_id
    `
    const values = [ship_id, 0, 0, 0, "00:00:00", tonage, 0, 0]

    connection.query(query, values, (err, result) => {
      if (err) throw err
      console.log(`초기화 완료: ship_id ${ship_id}`)
    })
  })
})

// 다각형 정의 (Polygon)
const userDefinedPolygon = turf.polygon([
  [
    [129.559683, 35.989301],
    [129.557613, 35.990568],
    [129.55592, 35.990018],
    [129.556572, 35.989333],
    [129.555796, 35.98877],
    [129.555154, 35.989203],
    [129.552773, 35.987217],
    [129.552162, 35.985626],
    [129.555102, 35.983288],
    [129.560725, 35.986041],
    [129.559852, 35.983321],
    [129.553306, 35.978506],
    [129.555431, 35.969736],
    [129.572315, 35.986004],
    [129.561302, 35.988819],
    [129.558267, 35.986642],
    [129.55833, 35.985553],
    [129.55761, 35.985502],
    [129.556984, 35.987199],
    [129.557047, 35.987072],
    [129.559683, 35.989301],
  ],
])

// 100대의 선박 초기화
const cooldownDuration = 60 // 쿨다운 시간 (초)
const ships = Array.from({ length: 100 }, (_, i) => ({
  ship_id: i + 1,
  lati: 35.989128 + Math.random() * 0.01,
  longi: 129.555139 + Math.random() * 0.01,
  wasInside: false,
  insideStartTime: null,
  exitAfter: null,
  cntUpdated: false,
  cooldownEndTime: null, // 재진입을 제한하기 위한 쿨다운 시간
}))

// E_total 계산 함수
function calculateEmissions(T, t, V, C) {
  return C * V * t * T // t는 실제 정박 시간(초 단위)
}

// 1초마다 실행하는 함수
const intervalId = setInterval(() => {
  ships.forEach((ship) => {
    const currentTime = new Date()

    // 쿨다운 중인 경우 재진입을 막음
    if (ship.cooldownEndTime && currentTime < ship.cooldownEndTime) {
      console.log(`쿨다운 중 - ship_id: ${ship.ship_id}`)
      return
    }

    if (ship.wasInside && ship.insideStartTime) {
      const elapsedTime = (currentTime - ship.insideStartTime) / 1000

      if (elapsedTime < ship.exitAfter) {
        // 다각형 내에 있을 때 매초 stay_time, total, CO2 업데이트
        const stayTime = 1

        // MySQL에서 기존 stay_time, total, CO2 가져와서 업데이트
        const selectQuery = `SELECT stay_time, total, CO2 FROM old_ship WHERE ship_id = ?`
        connection.query(selectQuery, [ship.ship_id], (err, results) => {
          if (err) throw err

          if (results.length > 0) {
            let currentStayTime = results[0].stay_time || "00:00:00"
            let currentTotal = results[0].total || 0
            let currentCO2 = results[0].CO2 || 0

            const [hours, minutes, seconds] = currentStayTime
              .split(":")
              .map(Number)
            const totalSeconds =
              hours * 3600 + minutes * 60 + seconds + stayTime
            const newHours = Math.floor(totalSeconds / 3600)
            const newMinutes = Math.floor((totalSeconds % 3600) / 60)
            const newSeconds = totalSeconds % 60
            const updatedStayTime = `${String(newHours).padStart(
              2,
              "0"
            )}:${String(newMinutes).padStart(2, "0")}:${String(
              newSeconds
            ).padStart(2, "0")}`

            const V = Math.random() * 2 + 2
            const C = Math.random() * 0.05 + 0.01
            const emissions = calculateEmissions(1, stayTime, V, C)
            const updatedTotal = currentTotal + emissions
            const updatedCO2 = Math.max(
              0,
              currentCO2 + parseFloat((Math.random() * 10 - 5).toFixed(2))
            )

            const updateQuery = `
              UPDATE old_ship
              SET stay_time = ?, total = ?, CO2 = ?
              WHERE ship_id = ?
            `
            const values = [
              updatedStayTime,
              updatedTotal,
              updatedCO2,
              ship.ship_id,
            ]

            connection.query(updateQuery, values, (err, result) => {
              if (err) throw err
              console.log(
                `업데이트 완료: ship_id ${
                  ship.ship_id
                }, stay_time: ${updatedStayTime}, total: ${updatedTotal.toFixed(
                  2
                )}, CO2: ${updatedCO2}`
              )
            })
          }
        })
        return
      } else {
        // 배가 다각형을 떠나고 쿨다운 시작
        ship.wasInside = false
        ship.insideStartTime = null
        ship.exitAfter = null
        ship.cntUpdated = false
        ship.cooldownEndTime = new Date(
          currentTime.getTime() + cooldownDuration * 1000
        )
        console.log(`선박이 다각형을 떠남 - ship_id: ${ship.ship_id}`)
      }
    }

    // 선박 이동 (다각형 밖으로 이동)
    ship.lati += (Math.random() - 0.5) * 0.001
    ship.longi += (Math.random() - 0.5) * 0.001

    const point = turf.point([ship.longi, ship.lati])
    const isInside = turf.booleanPointInPolygon(point, userDefinedPolygon)

    if (isInside && !ship.wasInside) {
      // 쿨다운 시간 종료 후만 재진입 허용
      if (!ship.cooldownEndTime || currentTime >= ship.cooldownEndTime) {
        ship.insideStartTime = new Date()
        ship.exitAfter =
          Math.floor(Math.random() * (10 * 60 - 1 * 60 + 1)) + 1 * 60
        ship.cntUpdated = true
        ship.wasInside = true

        const selectQuery = `SELECT cnt FROM old_ship WHERE ship_id = ?`
        connection.query(selectQuery, [ship.ship_id], (err, results) => {
          if (err) throw err

          if (results.length > 0) {
            const currentCnt = results[0].cnt || 0
            const updatedCnt = currentCnt + 1

            const updateQuery = `UPDATE old_ship SET cnt = ? WHERE ship_id = ?`
            const values = [updatedCnt, ship.ship_id]

            connection.query(updateQuery, values, (err, result) => {
              if (err) throw err
              console.log(
                `cnt 증가 완료: ship_id ${ship.ship_id}, cnt: ${updatedCnt}`
              )
            })
          }
        })
      }
    }
  })
}, 1000)
