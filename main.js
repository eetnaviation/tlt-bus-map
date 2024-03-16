let serverPort = 3000;
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


let requestedType = "Unfetched";
let requestedLine = "Unfetched";
let requestedLat = "Unfetched";
let requestedLong = "Unfetched";
let requestedTak = "Unfetched";

console.log("Server initalize!");

app.get('/tltmap', (req, res) => {
    console.log("Init root /");
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
            fetchData(tak);
            socket.emit('takResults', requestedType, requestedLine, requestedLat, requestedLong, requestedTak);
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

async function fetchData(takInput) {
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            const lines = response.data.split('\n');
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
                                default:
                                    transportTypeDecoded = "Unknown";
                                    break;
                            }
                            if (tak == takInput) {
                                requestedType = transportTypeDecoded;
                                requestedLine = lineNumber;
                                requestedLat = latitude;
                                requestedLong = longitude;
                                requestedTak = tak;
                                console.log("Requested data fetched:");
                                console.log("Transport Type:", transportTypeDecoded);
                                console.log("Line Number:", lineNumber);
                                console.log("Latitude:", latitude);
                                console.log("Longitude:", longitude);
                                console.log("Decoded address:");
                                console.log("TAK:", tak);
                                console.log();
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