const mysql = require("mysql2")
const turf = require("@turf/turf")
require("dotenv").config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

let shipGtValues = {} // 각 id에 해당하는 gt 값을 저장


connection.connect((err) => {
  if (err) throw err
  console.log("MySQL 연결 성공")

  // tb_sys_ship_device 테이블에서 id와 gt 가져오기
  const fetchGtQuery = `SELECT id, gt FROM tb_sys_ship_device LIMIT 202`
  
  connection.query(fetchGtQuery, (err, results) => {
    if (err) throw err

    // id를 키로, gt를 값으로 저장
    results.forEach((row) => {
      shipGtValues[row.id] = row.gt || 1 // gt 값이 없으면 기본값 1 사용
    })
    console.log("gt 값 로드 완료:", shipGtValues)

    // tb_sys_ship_device 테이블에서 id 가져오기
    const fetchIdsQuery = `SELECT id FROM tb_sys_ship_device LIMIT 202`
    connection.query(fetchIdsQuery, (err, results) => {
      if (err) throw err

      const shipIds = results.map((row) => row.id)

      // 202대 데이터를 위한 추가 id 생성 (부족할 경우)
      while (shipIds.length < 202) {
        shipIds.push(shipIds.length + 1) // 임의로 1부터 순차적으로 추가
      }

      // tb_log_oldship 테이블 초기화
      shipIds.forEach((id) => {
        const query = `
          INSERT INTO tb_log_oldship (id, lati, longi, cnt, stay_time, emi_per_sec, CO2)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE id = id
        `
        const values = [id, 0, 0, 0, "00:00:00", 0, 0]

        connection.query(query, values, (err, result) => {
          if (err) throw err
          console.log(`초기화 완료: id ${id}`)
        })
      })
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
const ships = Array.from({ length: 202 }, (_, i) => ({
  id: i + 1,
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
  return C * V * t * T; // t는 1초 단위로 고정
}

// 1초마다 실행하는 함수
const intervalId = setInterval(() => {
  ships.forEach((ship) => {
    const currentTime = new Date();

    // 쿨다운 중인 경우 재진입을 막음
    if (ship.cooldownEndTime && currentTime < ship.cooldownEndTime) {
      console.log(`쿨다운 중 - id: ${ship.id}`);
      return;
    }

    if (ship.wasInside && ship.insideStartTime) {
      const elapsedTime = (currentTime - ship.insideStartTime) / 1000;

      if (elapsedTime < ship.exitAfter) {
        // 다각형 내에 있을 때 매초 stay_time, CO2 업데이트
        const stayTime = 1;

        const V = Math.random() * 2 + 2;
        const C = Math.random() * 0.05 + 0.01;
        const T = shipGtValues[ship.id] || 1; // gt 값 가져오기
        const emissions = calculateEmissions(T, stayTime, V, C); // 1초 배출량 계산

        const updateQuery = `
          UPDATE tb_log_oldship
          SET stay_time = ADDTIME(stay_time, '00:00:01'), 
              emi_per_sec = ?, 
              CO2 = ?
          WHERE id = ?
        `;
        const values = [emissions, emissions, ship.id];

        connection.query(updateQuery, values, (err, result) => {
          if (err) throw err;
          console.log(
            `업데이트 완료: id ${ship.id}, emi_per_sec: ${emissions.toFixed(
              2
            )}, CO2: ${emissions.toFixed(2)}`
          );
        });
        return;
      } else {
        // 배가 다각형을 떠나고 쿨다운 시작
        ship.wasInside = false;
        ship.insideStartTime = null;
        ship.exitAfter = null;
        ship.cntUpdated = false;
        ship.cooldownEndTime = new Date(
          currentTime.getTime() + cooldownDuration * 1000
        );
        console.log(`선박이 다각형을 떠남 - id: ${ship.id}`);
      }
    }

    // 선박 이동 (다각형 밖으로 이동)
    ship.lati += (Math.random() - 0.5) * 0.001;
    ship.longi += (Math.random() - 0.5) * 0.001;

    const point = turf.point([ship.longi, ship.lati]);
    const isInside = turf.booleanPointInPolygon(point, userDefinedPolygon);

    if (isInside && !ship.wasInside) {
      // 쿨다운 시간 종료 후만 재진입 허용
      if (!ship.cooldownEndTime || currentTime >= ship.cooldownEndTime) {
        ship.insideStartTime = new Date();
        ship.exitAfter =
          Math.floor(Math.random() * (10 * 60 - 1 * 60 + 1)) + 1 * 60;
        ship.cntUpdated = true;
        ship.wasInside = true;

        const selectQuery = `SELECT cnt FROM tb_log_oldship WHERE id = ?`;
        connection.query(selectQuery, [ship.id], (err, results) => {
          if (err) throw err;

          if (results.length > 0) {
            const currentCnt = results[0].cnt || 0;
            const updatedCnt = currentCnt + 1;

            const updateQuery = `UPDATE tb_log_oldship SET cnt = ? WHERE id = ?`;
            const values = [updatedCnt, ship.id];

            connection.query(updateQuery, values, (err, result) => {
              if (err) throw err;
              console.log(`cnt 증가 완료: id ${ship.id}, cnt: ${updatedCnt}`);
            });
          }
        });
      }
    }
  });
}, 1000);
