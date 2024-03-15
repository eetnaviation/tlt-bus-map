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
var sleep = require('sleep');

console.log("Server initalize!");

app.get('/', (req, res) => {
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
    console.log("Got connection from user! Waiting for taksearch...")
    socket.on('takSearch', (tak) => {
        console.log(triggerDataFetch(tak));
    });
    
});

async function triggerDataFetch(tak) {
    console.log("Fetching new data...");
    const data = await fetchData();
    const filteredData = data.filter(item => item.tak === tak);
    io.emit('takSearch', filteredData);
    console.log("Data fetch completed.");
    // this part is only for when it is continuous
    //console.log("Data fetch completed. Wait 5 seconds before next fetch!");
    //await sleep.usleep(5000000);
    // also add while true cycle
}

async function fetchData() {
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            const lines = response.data.split('\n');
            const result = [];
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

                            result.push({
                                transportType: transportTypeDecoded,
                                lineNumber,
                                longitude,
                                latitude,
                                tak
                            });
                        } catch (error) {
                            console.log("Invalid data format!", line);
                        }
                    }
                }
            });
            return result;
        } else {
            console.log("Data fetch fail! Got status:", response.status);
            return [];
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}