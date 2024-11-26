const WebSocket = require("ws");
const mysql = require("mysql2");
const pointInPolygon = require("point-in-polygon");
require('dotenv').config();

const wss = new WebSocket.Server({ port: 6002 }); // WebSocket 서버 생성

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10),
});

const vesselState = {};
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
  [35.989301, 129.559683],
];

// WebSocket 클라이언트로 데이터 전송
wss.broadcast = function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

// 임의 좌표 생성 및 송신
setInterval(() => {
  const vessels = [];
  for (let devId = 1; devId <= 50; devId++) {
    if (!vesselState[devId]) {
      const { lati, longi } = getRandomCoordinateWithinPolygon(userDefinedPolygon);
      vesselState[devId] = {
        lati,
        longi,
        speed: Math.random() * 10,
        course: Math.random() * 360,
        azimuth: Math.random() * 360,
      };
    }

    const state = vesselState[devId];
    vessels.push({
      id: devId,
      lati: state.lati.toFixed(7),
      longi: state.longi.toFixed(7),
      speed: state.speed.toFixed(2),
      course: state.course.toFixed(0),
      azimuth: state.azimuth.toFixed(0),
    });
  }

  wss.broadcast(JSON.stringify(vessels));
}, 1000);

// 다각형 내부 좌표 생성
function getRandomCoordinateWithinPolygon(polygon) {
  let minLati = Math.min(...polygon.map((point) => point[0]));
  let maxLati = Math.max(...polygon.map((point) => point[0]));
  let minLongi = Math.min(...polygon.map((point) => point[1]));
  let maxLongi = Math.max(...polygon.map((point) => point[1]));

  let lati, longi;
  do {
    lati = minLati + Math.random() * (maxLati - minLati);
    longi = minLongi + Math.random() * (maxLongi - minLongi);
  } while (!pointInPolygon([lati, longi], polygon));

  return { lati, longi };
}

console.log("WebSocket 서버가 6003 포트에서 실행 중입니다.");
