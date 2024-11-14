// server.js
const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const {
  generateCurvedVesselData,
  userDefinedPolygon,
} = require("./vesselSimulation")

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

const vesselState = {}

wss.on("connection", (ws) => {
  console.log("Client connected")

  // 매초마다 모든 선박 데이터 전송
  setInterval(() => {
    const data = generateCurvedVesselData(1, userDefinedPolygon) // 예시로 1번 선박만 전송
    console.log("Sending vessel data:", data) // <-- 추가된 로그
    ws.send(JSON.stringify(data))
  }, 1000)

  ws.on("close", () => {
    console.log("Client disconnected")
  })
})

app.use(express.static("public"))

server.listen(3001, () => {
  console.log("Server is listening on http://localhost:3001")
})
