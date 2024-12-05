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

let volvohybridTakArray = [
    "1160", "1161", "1162", "1163", "1164", "1165", "1166", "1167", "1168", "1169", 
    "1170", "1171", "1710", "1740", "1742", "1744", "1747", "1759", "1772", "1774", 
    "1829", "1861", "2126", "2140", "2181", "2188", "2189", "2194", "2198", "2199", 
    "2498", "2721", "2722", "2723", "2724", "2725", "2726", "2727", "2728", "2729", 
    "2730", "2731", "2732", "2896"
];

let a40TakArray = [
    "1012", "1013", "1014", "1018", "1020", "1021", "1023", "1024", "1029", "1030", 
    "1031", "1037", "1038", "1491", "1492", "1493", "1494", "2237", "2246", "2247", 
    "2252", "2255", "2257", "2284", "2286", "2287", "2673", "2695", "2705", "2706", 
    "2707", "3086", "3206", "3207", "3250", "3395", "3400", "3507", "3509", "3551", 
    "3579", "3582", "3583", "3584", "3201", "3391", "3392", "3540", "3541", "3544", 
    "3547", "3548", "3549", "3550", "3581"
];

let a78TakArray = [
    "3298", "3378", "3379", "3380", "3388", "3394", "3429", "3432", "3433", "3434", 
    "3435", "3436", "3437", "3531", "3532", "3539", "3571", "3572", "1047", "1107", 
    "1108", "1109", "1110", "1112", "1113", "1114", "1115", "1118", "1119", "1120", 
    "1121", "1141", "1142", "1143", "1144", "1226", "1227", "1408", "1473", "1474", 
    "1475", "1476", "1477", "1478", "1568", "2200", "2208", "2209", "2212", "2221", 
    "2224", "2228", "2234", "2290", "2291", "2292", "2293", "2294", "2307", "2311", 
    "2323", "2324", "2325", "2329", "2330", "2331", "2333", "2334", "2618", "2632", 
    "2648", "2650", "2660", "3381", "3389", "3393", "3430", "3431", "3499", "3528", 
    "3529", "3530", "3535", "3538", "3573", "3574", "3577", "3575"
];

let a21TakArray = [
    "1145", "2700", "2701", "3585", "3586"
];

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
            var caughtError = "Error processing takSearch:", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('electricBusBulkSearch', async () => {
        console.log("Running bulk electric bus search!");
        saveRequestLogs(socket, "ElectricBusBulkSearch");
        try {
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
            electricBusTakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing electricBusBulkSearch:", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('a40BulkSearch', async () => {
        console.log("Running bulk a40 bus search!");
        saveRequestLogs(socket, "A40BulkSearch");
        try {
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
            a40TakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing a40BulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('a21BulkSearch', async () => {
        console.log("Running bulk a21 bus search!");
        saveRequestLogs(socket, "A21BulkSearch");
        try {
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
            a21TakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing a21BulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('a78BulkSearch', async () => {
        console.log("Running bulk a78 bus search!");
        saveRequestLogs(socket, "A78BulkSearch");
        try {
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
            a78TakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing a78BulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('volvo7900BulkSearch', async () => {
        console.log("Running bulk volvo 7900 bus search!");
        saveRequestLogs(socket, "7900BulkSearch");
        try {
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
            volvohybridTakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing volvo7900BulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('pesaTramBulkSearch', async () => {
        console.log("Running bulk pesa tram search!");
        saveRequestLogs(socket, "PesaTramBulkSearch");
        try {
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
            pesaTramTakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing pesaTramBulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('tramBulkSearch', async () => {
        console.log("Running bulk tram search!");
        saveRequestLogs(socket, "TramBulkSearch");
        try {
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
            fetchDataFromLocalFileByTransportType("TRAM", socket);
        } catch (error) {
            var caughtError = "Error processing TramBulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('cafBulkSearch', async () => {
        console.log("Running bulk CAF tram search!");
        saveRequestLogs(socket, "CafBulkSearch");
        try {
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
            cafTramTakArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing cafBulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('tatraBulkSearch', async () => {
        console.log("Running bulk tatra tram search!");
        saveRequestLogs(socket, "TatraBulkSearch");
        try {
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
            kt6tmTramArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
            kt4suTramArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
            kt4tmrTramArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
            kt4dTramArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
            kt4tmTramArray.forEach((takToSearch) => {
                fetchDataFromLocalFile(takToSearch, socket);
            });
        } catch (error) {
            var caughtError = "Error processing tatraBulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
        }
    });
    socket.on('busBulkSearch', async () => {
        console.log("Running bulk bus search!");
        saveRequestLogs(socket, "BusBulkSearch");
        try {
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
            fetchDataFromLocalFileByTransportType("BUS", socket);
        } catch (error) {
            var caughtError = "Error processing busBulkSearch: ", error;
            console.error(caughtError);
            writeToLog('errors_log.txt', caughtError);
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
                                    vehicleType = "CAF Urbos AXL";
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
								} else if (volvohybridTakArray.includes(tak)) {
                                    vehicleType = "Volvo 7900 Hybrid";
                                } else if (a40TakArray.includes(tak)) {
                                    vehicleType = "MAN a40";
                                } else if (a78TakArray.includes(tak)) {
                                    vehicleType = "MAN a78";
                                } else if (a21TakArray.includes(tak)) {
                                    vehicleType = "MAN a21";
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
                            console.log("[Data fetch complete!] Type:", transportTypeDecoded, "Line number:", lineNumber, "Lat:", latitude, "Long:", longitude, "Coords merge:", requestedLatLong, "TAK:", tak);
                            socket.emit('takResults', requestedType, requestedLine, requestedLat, requestedLong, requestedTak, requestedLatLong, vehicleType);
                        } else if (tak !== takInput && takFound !== 1) {
                            takFound = 0;
                            const vehicleNotFoundText = "VEHICLE NOT FOUND!";
                            requestedType = vehicleNotFoundText;
                            requestedLine = vehicleNotFoundText;
                            requestedLat = vehicleNotFoundText;
                            requestedLong = vehicleNotFoundText;
                            requestedTak = vehicleNotFoundText;
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

async function fetchDataFromLocalFileByTransportType(transportTypeInput, socket) {
    try {
        const data = fs.readFileSync(localFilePath, 'utf8');
        const lines = data.split('\n');
        let transportTypeFound = 0;
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
                        if (transportTypeDecoded === transportTypeInput) {
                            if (transportTypeDecoded === "TRAM") {
                                if (cafTramTakArray.includes(tak)) {
                                    vehicleType = "CAF Urbos AXL";
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
                                } else if (volvohybridTakArray.includes(tak)) {
                                    vehicleType = "Volvo 7900 Hybrid";
                                } else if (a40TakArray.includes(tak)) {
                                    vehicleType = "MAN a40";
                                } else if (a78TakArray.includes(tak)) {
                                    vehicleType = "MAN a78";
                                } else if (a21TakArray.includes(tak)) {
                                    vehicleType = "MAN a21";
                                }
                            } else {
                                vehicleType = "-- Info unavailable --";
                            }
                            transportTypeFound = 1;
                            requestedType = transportTypeDecoded;
                            requestedLine = lineNumber;
                            requestedLat = latitude;
                            requestedLong = longitude;
                            requestedLatLong = `${latitude} ${longitude}`;
                            requestedTak = tak;
                            console.log("[Data fetch complete!] Type:", transportTypeDecoded, "Line number:", lineNumber, "Lat:", latitude, "Long:", longitude, "Coords merge:", requestedLatLong, "TAK:", tak);
                            socket.emit('takResults', requestedType, requestedLine, requestedLat, requestedLong, requestedTak, requestedLatLong, vehicleType);
                        } else if (transportTypeDecoded !== transportTypeInput && transportTypeFound !== 1) {
                            transportTypeFound = 0;
                            const vehicleNotFoundText = "VEHICLE NOT FOUND!";
                            requestedType = vehicleNotFoundText;
                            requestedLine = vehicleNotFoundText;
                            requestedLat = vehicleNotFoundText;
                            requestedLong = vehicleNotFoundText;
                            requestedTak = vehicleNotFoundText;
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