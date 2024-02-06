import {App} from "./App";

// const socket = Net.createConnection("/var/run/docker.sock");
//
// socket.on("connect", () => {
//     console.log("Connected to the socket");
//     socket.write("GET /containers/json HTTP/1.0\r\n\r\n");
// });
//
// socket.on("data", (data) => {
//     console.log("Received data:", data.toString());
// });
//
// socket.on("end", () => {
//     console.log("Disconnected from the socket");
// });


export const app = new App();
