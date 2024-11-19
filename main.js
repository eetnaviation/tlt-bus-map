const serverPort = 8081;
const url = "http://transport.tallinn.ee/gps.txt";

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const localFilePath = 'gps/gps.txt'

let cafTramTakArray = ["501", "502", "503", "504", "505", "506", "507", "508", "509", "510", "511", "512", "513", "514", "515", "516", "517", "518", "519", "520"];
let pesaTramTakArray = ["521", "522", "523", "524", "525", "526", "527", "528", "529", "530", "531", "532"];
let electricBusTakArray = ["1350", "1351", "1353", "1356", "1357", "2411", "2413", "2414", "2416"];
let kt6tmTramArray = ["96", "97", "98", "99", "102", "103", "109", "110", "114", "123", "131", "148"];
let kt4suTramArray = ["104"];
let kt4tmrTramArray = ["136", "138", "140", "141", "142", "168"];
let kt4dTramArray = ["157", "161", "170", "172", "173", "176", "177", "178", "179", "180"];
let kt4tmTramArray = ["181", "182"];

let requestedType = "Unfetched";
let requestedLine = "Unfetched";
let requestedLat = "Unfetched";
let requestedLong = "Unfetched";
let requestedTak = "Unfetched";
let vehicleType = "Unfetched";
let requestedLatLong = "Unfetched";

let isRequestMode = false;
let requestModeIntervalId = null;
let lastFetchTime = 0;
const defaultFetchInterval = 120000;
const requestModeInterval = 30000;
const requestModeDuration = 120000;

console.log("Server initialized!");

app.use(express.static('client'));

app.get('/tltmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/index.html'));
});

app.get('/img/marker.png', (req, res) => {
    const img = fs.readFileSync('./client/marker.png');
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(img, 'binary');
});

server.listen(serverPort, () => {
    console.log("Apache server initialized...");
    console.log('Server started on port', serverPort);
});

io.on('connection', (socket) => {
    socket.on('takSearch', async (tak) => {
       try {
            console.log("Input tak: " + tak);
            saveRequestLogs(socket, tak);
            if (isRequestMode) {
                const currentTime = Date.now();
                if (currentTime - lastFetchTime >= requestModeInterval) {
                    await fetchAndSaveData("Request Mode");
                }
            } else {
                await fetchAndSaveData("Request Mode");
            }
            if (isRequestMode) {
                clearInterval(requestModeIntervalId);
            }
            startRequestModeFetch();
            fetchDataFromLocalFile(tak, socket);
        } catch (error) {
            console.error("Error processing takSearch:", error);
        }
    });
});

function saveRequestLogs(socket, takInput) {
    const xForwardedFor = socket.request.headers['x-forwarded-for'];
    let clientIp;
    if (xForwardedFor) {
        clientIp = xForwardedFor.split(',')[0].trim();
    } else {
        clientIp = socket.request.connection.remoteAddress;
    }
    const date = new Date();
    const logData = `${clientIp} - [${date}] - [SEARCH ${takInput}] - ${socket.handshake.headers['user-agent']}\n`;
    writeToLog('search_log.txt', logData);
}

function writeToLog(logfile, logdata) {
    var realLogFile = path.join('logs/', logfile);
    fs.appendFile(realLogFile, logdata, 'utf8', (err) => {
        if (err) {
            console.error('Error writing to file:', err);
        }
    });
}

async function fetchAndSaveData(fetchMode) {
    try {
        console.log(`Fetch started (${fetchMode})`);
        const date = new Date();
        const timestamp = date.toISOString().replace(/:/g, '_').replace('T', '-').split('.')[0];
        const logData = `${date} - Fetching new data (${fetchMode})...\n`;
        writeToLog('fetch_log.txt', logData);

        if (fs.existsSync(localFilePath)) {
            const oldFilePath = `gps/gps-${timestamp}.txt`
            fs.renameSync(localFilePath, oldFilePath);
        }

        const response = await axios.get(url);
        if (response.status === 200) {
            fs.writeFileSync(localFilePath, response.data, 'utf8');
            console.log("Fetch completed.");
            const logData = `${date} - Fetching completed (${fetchMode})!\n`;
            writeToLog('fetch_log.txt', logData);
        } else {
            const logData = `${date} - Fetching failed (${fetchMode}). Got: ${response.status}\n`;
            writeToLog('errors_log.txt', logData);
        }
        lastFetchTime = Date.now();
    } catch (error) {
        const date = new Date();
        const logData = `${date} - Error fetching data (${fetchMode}): ${error.message}\n`;
        writeToLog('errors_log.txt', logData);
    }
}

function startPeriodicDataFetch() {
    fetchAndSaveData("Normal Mode");
    setInterval(() => {
        if (!isRequestMode) {
            fetchAndSaveData("Normal Mode");
        }
    }, defaultFetchInterval);
}

function startRequestModeFetch() {
    isRequestMode = true;
    requestModeIntervalId = setInterval(async () => {
        const currentTime = Date.now();
        if (currentTime - lastFetchTime >= requestModeInterval) {
            await fetchAndSaveData("Request Mode");
        }
    }, requestModeInterval);
    setTimeout(() => {
        clearInterval(requestModeIntervalId);
        isRequestMode = false;
    }, requestModeDuration);
}

async function fetchDataFromLocalFile(takInput, socket) {
    try {
        const data = fs.readFileSync(localFilePath, 'utf8');
        const lines = data.split('\n');
        let takFound = 0;
        lines.forEach(line => {
            if (line) {
                const data = line.split(',');
                if (data.length >= 9) {
                    try {
                        const transportType = parseInt(data[0]);
                        const lineNumber = parseInt(data[1]);
                        const longitude = parseFloat(data[2]) / 1000000;
                        const latitude = parseFloat(data[3]) / 1000000;
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
                        if (tak === takInput) {
                            if (transportTypeDecoded === "TRAM") {
                                if (cafTramTakArray.includes(tak)) {
                                    vehicleType = "CAF Urbos AXL (Spain) (Overhead 600V, Motor 264 kW) 70km/h TOP";
                                } else if (pesaTramTakArray.includes(tak)) {
                                    vehicleType = "PESA Twist 147N";
                                } else if (kt6tmTramArray.includes(tak)) {
									vehicleType = "Tatra KT6 TM";
								} else if (kt4suTramArray.includes(tak)) {
									vehicleType = "Tatra KT4 SU";
								} else if (kt4tmrTramArray.includes(tak)) {
									vehicleType = "Tatra KT4 TMR";
								} else if (kt4dTramArray.includes(tak)) {
									vehicleType = "Tatra KT4 D";
								} else if (kt4tmTramArray.includes(tak)) {
									vehicleType = "Tatra KT4 TM";
								} else {
                                    vehicleType = "-- Info unavailable --";
                                }
                            } else if (transportTypeDecoded === "BUS") {
								if (electricBusTakArray.includes(tak)) {
									vehicleType = "Solaris Urbino IV 12 Electric";
								}
							} else {
                                vehicleType = "-- Info unavailable --";
                            }
                            takFound = 1;
                            requestedType = transportTypeDecoded;
                            requestedLine = lineNumber;
                            requestedLat = latitude;
                            requestedLong = longitude;
                            requestedLatLong = `${latitude} ${longitude}`;
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
                        } else if (tak !== takInput && takFound !== 1) {
                            takFound = 0;
                            const busNotFoundText = "VEHICLE NOT FOUND!";
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
    } catch (error) {
        console.error("Error reading local file:", error);
    }
}

startPeriodicDataFetch();