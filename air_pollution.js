const mysql = require("mysql")

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  connectionLimit: 10, // 동시에 열 수 있는 연결 수를 제한
  host: "192.168.0.225",
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
  timezone: "local", // 로컬 시간대로 설정
})

// 미리 계산된 100대의 배 톤수 값 (204대 선박의 총 톤수 비율 기반)
const tonageValues = [
  10.9, 2.88, 10.61, 6.07, 15.44, 12.19, 142.49, 20.93, 7.84, 6.57, 11.9, 25.78,
  6.62, 16.89, 13.11, 5.17, 20.93, 20.93, 76.52, 76.52, 7.73, 5.07, 84.44,
  25.78, 12.51, 6.31, 76.52, 20.93, 25.78, 20.93, 4.33, 11.61, 13.17, 7.92,
  76.52, 3.75, 15.17, 15.17, 11.9, 12.98, 9.26, 7.63, 25.78, 10.55, 92.36, 5.07,
  6.07, 4.27, 25.78, 9.21, 25.78, 5.09, 9.16, 11.45, 110.83, 13.11, 84.44,
  13.17, 10.55, 10.92, 7.73, 20.93, 102.91, 7.92, 25.78, 13.11, 13.01, 20.93,
  25.78, 4.67, 13.11, 25.78, 5.07, 6.07, 7.73, 60.69, 10.55, 6.41, 11.56, 10.55,
  76.52, 2.22, 5.2, 25.78, 25.78, 10.92, 15.44, 105.55, 84.44, 105.55, 76.52,
  12.77, 6.7, 10.74, 25.78, 124.02, 14.25, 6.02, 11.9, 25.78,
]

// 배의 정보 초기화 함수
function initializeShips(callback) {
  pool.query("SELECT * FROM air_pollution", (error, results) => {
    if (error) {
      console.error("Error fetching initial ship data:", error)
      return
    }

    let ships
    if (results.length === 0) {
      // 데이터베이스에 데이터가 없으면 모든 값을 0으로 초기화하고 데이터베이스에 삽입
      ships = Array.from({ length: 100 }, (_, i) => ({
        ship_ID: i + 1,
        CO2: 0,
        cnt: 0,
        total: 0,
        Arrival_Time: null,
        Departure_Time: null,
        Stay_Time: "00:00:00",
        Tonage: parseFloat(tonageValues[i].toFixed(2)), // 미리 계산된 톤수 값 사용
        status: "sea", // 초기 상태는 모두 바다에 떠 있는 상태로 설정
        nextArrivalTime: null, // 입항 대기 시간 초기화
      }))

      ships.forEach((ship) => {
        pool.query(
          `INSERT INTO air_pollution (ship_ID, CO2, cnt, total, Arrival_Time, Departure_Time, stay_time, Tonage, status, nextArrivalTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ship.ship_ID,
            ship.CO2,
            ship.cnt,
            ship.total,
            ship.Arrival_Time,
            ship.Departure_Time,
            ship.Stay_Time,
            ship.Tonage,
            ship.status,
            ship.nextArrivalTime,
          ],
          (error) => {
            if (error) {
              console.error(
                `Error inserting initial data for ship_ID ${ship.ship_ID}:`,
                error
              )
            } else {
              console.log(
                `Initial data for ship_ID ${ship.ship_ID} inserted successfully.`
              )
            }
          }
        )
      })
    } else {
      // 데이터베이스에 값이 있으면 해당 값으로 ships 배열을 초기화
      ships = results.map((row) => ({
        ship_ID: row.ship_ID,
        CO2: row.CO2,
        cnt: row.cnt,
        total: row.total,
        Arrival_Time: row.Arrival_Time ? new Date(row.Arrival_Time) : null,
        Departure_Time: row.Departure_Time
          ? new Date(row.Departure_Time)
          : null,
        Stay_Time: row.stay_time || "00:00:00",
        Tonage: row.Tonage,
        status: row.status,
        nextArrivalTime: row.nextArrivalTime
          ? new Date(row.nextArrivalTime)
          : null, // DB에서 nextArrivalTime 복원
        minStayTime: null, // 항구에 도착 후 새로 설정될 체류 시간
      }))

      console.log("Previous ship data loaded from database.")
    }

    callback(ships)
  })
}

// E_total 계산 함수
function calculateEmissions(T, t) {
  const concentrations = [0.05, 0.1, 0.02] // 예시 농도 배열
  const V = Math.random() * (10 - 1) + 1 // 풍속
  const additionalDockingTime = 1800 // 추가 정박 시간
  let E_total = 0
  for (let i = 0; i < concentrations.length; i++) {
    E_total += concentrations[i] * V * (t + additionalDockingTime) * T
  }
  return E_total
}

// 시간을 HH:MM:SS 형식으로 변환하는 함수
function secondsToTimeString(seconds) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")
  const secs = String(seconds % 60).padStart(2, "0")
  return `${hours}:${minutes}:${secs}`
}

function simulatePortActivities(ships) {
  setInterval(() => {
    ships.forEach((ship) => {
      if (ship.status === "sea" && !ship.nextArrivalTime) {
        ship.status = "port"
        ship.Arrival_Time = new Date()
        ship.minStayTime = Math.floor(Math.random() * (600 - 60) + 60)
        console.log(
          `Ship ${ship.ship_ID} has arrived at the port for the first time.`
        )
      }

      if (
        ship.status === "sea" &&
        ship.nextArrivalTime &&
        Date.now() >= ship.nextArrivalTime.getTime()
      ) {
        ship.status = "port"
        ship.Arrival_Time = new Date()
        ship.nextArrivalTime = null
        ship.minStayTime = Math.floor(Math.random() * (600 - 60) + 60)
        console.log(`Ship ${ship.ship_ID} has arrived at the port again.`)
      }

      if (ship.status === "port") {
        const co2Change = parseFloat((Math.random() * 10 - 5).toFixed(2))

        // 현재 정박 시간 계산 (초 단위)
        const currentStayTime = Math.floor(
          (new Date() - ship.Arrival_Time) / 1000
        )

        // 정박 시간이 3시간(10800초) 이상일 경우 CO2를 0으로 설정
        if (currentStayTime >= 10800) {
          ship.CO2 = 0
        } else {
          ship.CO2 = Math.max(0, ship.CO2 + co2Change)
        }

        // 정박 시간이 최소 체류 시간을 초과하면 출항 처리
        if (currentStayTime >= ship.minStayTime) {
          ship.status = "sea"
          ship.Departure_Time = new Date()
          const stayTimeSeconds = Math.floor(
            (ship.Departure_Time - ship.Arrival_Time) / 1000
          )
          ship.Stay_Time = secondsToTimeString(stayTimeSeconds)

          // 수정된 CO2 값을 기반으로 total 계산
          ship.total = calculateEmissions(ship.Tonage, stayTimeSeconds)

          const minWaitTime = 10 * 60 * 1000 // 최소 10분 대기 시간
          const maxWaitTime = 30 * 60 * 1000 // 최대 30분 대기 시간
          const randomWaitTime = Math.floor(
            Math.random() * (maxWaitTime - minWaitTime) + minWaitTime
          )
          ship.nextArrivalTime = new Date(Date.now() + randomWaitTime)

          console.log(
            `Ship ${
              ship.ship_ID
            } will attempt to arrive again at ${ship.nextArrivalTime.toLocaleString()}`
          )
        }

        // MySQL에 데이터 업데이트
        pool.query(
          `UPDATE air_pollution SET CO2 = ?, cnt = ?, total = ?, Arrival_Time = ?, Departure_Time = ?, stay_time = ?, Tonage = ?, status = ?, nextArrivalTime = ? WHERE ship_ID = ?`,
          [
            ship.CO2,
            ship.cnt,
            ship.total,
            ship.Arrival_Time,
            ship.Departure_Time,
            ship.Stay_Time,
            ship.Tonage,
            ship.status,
            ship.nextArrivalTime
              ? ship.nextArrivalTime
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ")
              : null,
            ship.ship_ID,
          ],
          (error) => {
            if (error) {
              console.error(
                `Error updating data for ship_ID ${ship.ship_ID}:`,
                error
              )
            } else {
              console.log(
                `Data for ship_ID ${ship.ship_ID} updated successfully.`
              )
            }
          }
        )
      }
    })
  }, 5000)
}

// 초기화 후 시뮬레이션 실행
initializeShips((ships) => {
  simulatePortActivities(ships)
})

console.log(
  "Real-time simulation started. Ship data will be continuously saved to the database."
)
