const mysql = require("mysql")

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  connectionLimit: 10, // 동시에 열 수 있는 연결 수를 제한
  host: "192.168.0.225",
  user: "root",
  password: "netro9888!",
  database: "netro_data_platform",
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
        nextArrivalTime: null,
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
      // 데이터베이스에 값이 있으면 해당 값으로 초기화
      ships = results.map((row) => ({
        ship_ID: row.ship_ID,
        CO2: row.CO2,
        cnt: row.cnt,
        total: row.total,
        Arrival_Time: row.Arrival_Time
          ? new Date(
              row.Arrival_Time.toLocaleString("en-US", {
                timeZone: "Asia/Seoul",
              })
            )
          : null,
        Departure_Time: row.Departure_Time
          ? new Date(
              row.Departure_Time.toLocaleString("en-US", {
                timeZone: "Asia/Seoul",
              })
            )
          : null,
        Stay_Time: row.stay_time,
        Tonage: row.Tonage,
        status: row.status,
        nextArrivalTime: row.nextArrivalTime
          ? new Date(
              row.nextArrivalTime.toLocaleString("en-US", {
                timeZone: "Asia/Seoul",
              })
            )
          : null,
      }))
    }

    callback(ships)
  })
}
// E_total 계산 함수
function calculateEmissions(T, t) {
  // 각 오염물질의 농도 (배열로 설정)
  const concentrations = [0.05, 0.1, 0.02] // 예시 농도 배열 (C_i)

  // 고정된 변수들
  const V = Math.random() * (10 - 1) + 1 // 풍속 (1~10 m/s 랜덤 값)

  const additionalDockingTime = 1800 // 추가 정박 시간 (초, 예시 값)

  // 오염물질 개수
  const n = concentrations.length

  // E_total 계산
  let E_total = 0
  for (let i = 0; i < n; i++) {
    E_total += concentrations[i] * V * (t + additionalDockingTime) * T
  }
  return E_total
}

// 날짜를 KST로 변환하는 함수
function toKST(date) {
  const offset = 9 * 60 * 60 * 1000 // 9시간을 밀리초로 변환
  return new Date(date.getTime() + offset)
}

// HH:MM:SS 형식의 시간을 초 단위로 변환하는 함수
function timeStringToSeconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

// 초 단위를 HH:MM:SS 형식의 문자열로 변환하는 함수
function secondsToTimeString(seconds) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")
  const secs = String(seconds % 60).padStart(2, "0")
  return `${hours}:${minutes}:${secs}`
}
// E_total 계산 함수
function calculateEmissions(T, t) {
  // 각 오염물질의 농도 (배열로 설정)
  const concentrations = [0.05, 0.1, 0.02] // 예시 농도 배열 (C_i)

  // 고정된 변수들
  const V = 3 // 풍속 (m/s, 예시 값)
  const additionalDockingTime = 1800 // 추가 정박 시간 (초, 예시 값)

  // 오염물질 개수
  const n = concentrations.length

  // E_total 계산
  let E_total = 0
  for (let i = 0; i < n; i++) {
    E_total += concentrations[i] * V * (t + additionalDockingTime) * T
  }
  return E_total
}

// 날짜를 KST로 변환하고 MySQL이 요구하는 형식으로 문자열 반환하는 함수
function formatToMySQLDate(date) {
  const offset = 9 * 60 * 60 * 1000 // 9시간을 밀리초로 변환
  const kstDate = new Date(date.getTime() + offset)

  const year = kstDate.getFullYear()
  const month = String(kstDate.getMonth() + 1).padStart(2, "0")
  const day = String(kstDate.getDate()).padStart(2, "0")
  const hours = String(kstDate.getHours()).padStart(2, "0")
  const minutes = String(kstDate.getMinutes()).padStart(2, "0")
  const seconds = String(kstDate.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// simulatePortActivities 함수에서 배의 항구 활동 중 E_total 계산 및 total 업데이트
// 배의 항구 활동 시뮬레이션 함수 수정
function simulatePortActivities(ships) {
  setInterval(() => {
    ships.forEach((ship) => {
      const now = new Date()

      // 배가 바다에 있고, nextArrivalTime이 설정된 경우 해당 시간에 도달하면 입항
      if (
        ship.status === "sea" &&
        ship.nextArrivalTime &&
        now >= ship.nextArrivalTime
      ) {
        ship.status = "port"
        ship.Arrival_Time = new Date()
        ship.Departure_Time = null
        console.log(`Ship ${ship.ship_ID} has arrived at the port again.`)
        ship.nextArrivalTime = null
      }

      // 배가 한번도 항구에 도착한 적이 없는 경우
      if (
        ship.status === "sea" &&
        !ship.Arrival_Time &&
        !ship.nextArrivalTime
      ) {
        ship.status = "port"
        ship.Arrival_Time = new Date()
        console.log(
          `Ship ${ship.ship_ID} has arrived at the port for the first time.`
        )
      }

      // 배가 항구에 있을 때 CO2 배출량 업데이트 및 출항 조건 확인
      if (ship.status === "port") {
        // CO2 배출량 계산 및 업데이트
        const co2Change = parseFloat((Math.random() * 10 - 5).toFixed(2))
        ship.CO2 = Math.max(0, ship.CO2 + co2Change) // CO2 값 갱신

        // 정박 시간 계산
        const currentStayTime = Math.floor((now - ship.Arrival_Time) / 1000)

        // E_total 계산 및 total 업데이트
        const emissions = calculateEmissions(ship.Tonage, currentStayTime)
        ship.total += emissions

        // 최소 1분 동안은 항구에 머무름
        const minStayTime = Math.floor(Math.random() * (600 - 60) + 60) // 1분~10분 랜덤

        if (currentStayTime >= minStayTime) {
          ship.status = "sea"
          ship.Departure_Time = new Date()
          ship.Stay_Time = secondsToTimeString(currentStayTime)

          // 다음 입항 시간을 10분에서 30분 사이의 랜덤 값으로 설정
          const minWaitTime = 10 * 60 * 1000 // 10분 (밀리초)
          const maxWaitTime = 30 * 60 * 1000 // 30분 (밀리초)
          ship.nextArrivalTime = new Date(
            now.getTime() +
              Math.floor(
                Math.random() * (maxWaitTime - minWaitTime) + minWaitTime
              )
          )

          console.log(
            `Ship ${
              ship.ship_ID
            } will attempt to arrive again at ${ship.nextArrivalTime.toLocaleString(
              "ko-KR",
              { timeZone: "Asia/Seoul" }
            )}`
          )
        }
      }

      // MySQL에 데이터 업데이트 시 KST로 변환하여 저장
      pool.query(
        `UPDATE air_pollution SET CO2 = ?, cnt = ?, total = ?, Arrival_Time = ?, Departure_Time = ?, stay_time = ?, Tonage = ?, status = ?, nextArrivalTime = ? WHERE ship_ID = ?`,
        [
          ship.CO2, // CO2 값을 업데이트에 포함
          ship.cnt,
          ship.total,
          ship.Arrival_Time
            ? toKST(ship.Arrival_Time)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : null,
          ship.Departure_Time
            ? toKST(ship.Departure_Time)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : null,
          ship.Stay_Time,
          ship.Tonage,
          ship.status,
          ship.nextArrivalTime
            ? toKST(ship.nextArrivalTime)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : null,
          ship.ship_ID,
        ],
        (error) => {
          if (error) {
            console.error(
              `ship_ID ${ship.ship_ID} 데이터 업데이트 오류:`,
              error
            )
          } else {
            console.log(
              `ship_ID ${ship.ship_ID} 데이터가 성공적으로 업데이트되었습니다.`
            )
          }
        }
      )
    })
  }, 5000) // 5초 간격으로 반복 실행
}

// 초기화 후 시뮬레이션 실행
initializeShips((ships) => {
  simulatePortActivities(ships)
})

console.log(
  "Real-time simulation started. Ship data will be continuously saved to the database."
)
