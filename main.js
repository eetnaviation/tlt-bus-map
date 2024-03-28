let serverPort = 4000;
const url = "http://transport.tallinn.ee/gps.txt";

const express = require('express');
const { fstat } = require('fs');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require('axios');
const fs = require('node:fs');

let cafTramTakArray = ["502", "520", "505", "518", "513", "507"];

let requestedType = "Unfetched";
let requestedLine = "Unfetched";
let requestedLat = "Unfetched";
let requestedLong = "Unfetched";
let requestedTak = "Unfetched";
let vehicleType = "Unfetched";
let requestedLatLong = "Unfetched";

console.log("Server initalize!");

app.use(express.static('client'))

app.get('/tltmap', (req, res) => {
    console.log("Requested / (index.html). Fetching!");
    //index.html
    res.sendFile(__dirname + '/client/index.html');
});

server.listen(serverPort, () => {
    console.log("Apache server initalized...");
    console.log('Server started on port', serverPort);
    //triggerDataFetch();
});

io.on('connection', (socket) => {
    socket.on('takSearch', (tak) => {
        try {
            console.log("Input tak: " + tak);
            fetchData(tak, socket);
        } catch {

        }
    });
});

async function triggerConstantDataFetch() {
    while (true) {
        console.log("Fetching new data...");
        await fetchData();
        console.log("Data fetch completed. Wait 5 seconds before next fetch!");
    }
}

async function fetchData(takInput, socket) {
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            const lines = response.data.split('\n');
            let takFound = 0;
            lines.forEach(line => {
                if (line) {
                    const data = line.split(',');
                    if (data.length >= 9) {
                        try {
                            const transportType = parseInt(data[0]);
                            const lineNumber = parseInt(data[1]);
                            const longitude = parseInt(data[2]) / 1000000;
                            const latitude = parseInt(data[3]) / 1000000;
                            const tak = data[6];
                            
                            let transportTypeDecoded;

                            switch (transportType) {
                                case 1:
                                    transportTypeDecoded = "TROLL";
                                    break;
                                case 2:
                                    transportTypeDecoded = "BUS";
                                    break;
                                case 3:
                                    transportTypeDecoded = "TRAM";
                                    break;
                                case 7:
                                    transportTypeDecoded = "NIGHTBUS";
                                    break;
                                default:
                                    transportTypeDecoded = "Unknown";
                                    break;
                            }
                            if (tak == takInput) {
                                if (transportTypeDecoded == "TRAM") {
                                    if (cafTramTakArray.includes(tak)) {
                                        vehicleType = "CAF Urbos (Spain) (Overhead 600V, Motor 264 kW) 70km/h TOP";
                                    }
                                    else {
                                        vehicleType = "-- INFO UNAVAIL. --";
                                    }
                                }
                                else {
                                    vehicleType = "Unfetched";
                                }
                                takFound = 1;
                                requestedType = transportTypeDecoded;
                                requestedLine = lineNumber;
                                requestedLat = latitude;
                                requestedLong = longitude;
                                requestedLatLong = String(latitude) + " " + String(longitude);
                                requestedTak = tak;
                                console.log("Requested data fetched:");
                                console.log("Transport Type:", transportTypeDecoded);
                                console.log("Line Number:", lineNumber);
                                console.log("Latitude:", latitude);
                                console.log("Longitude:", longitude);
                                console.log("Merged coordinates:", requestedLatLong);
                                console.log("TAK:", tak);
                                console.log();
                                socket.emit('takResults', requestedType, requestedLine, requestedLat, requestedLong, requestedTak, requestedLatLong, vehicleType);
                            }
                            else if (tak != takInput && takFound != 1) {
                                takFound = 0;
                                let busNotFoundText = "BUS NOT FOUND!";
                                requestedType = busNotFoundText;
                                requestedLine = busNotFoundText;
                                requestedLat = busNotFoundText;
                                requestedLong = busNotFoundText;
                                requestedTak = busNotFoundText;
                            }
                        } catch (error) {
                            console.log("Invalid data format!", line);
                        }
                    }
                }
            });
        } else {
            console.log("Data fetch fail! Got status:", response.status);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}