# tlt-bus-map
This is a web map made in nodejs that can display and filter different TLT vehicles from theyr gps.txt.
It is publicly available at https://velend.eu/tltmap

## Features
- Filter by TAK
- Filter by LINE
- Bulk search filtering for PESA Twist trams
- Bulk search filtering for CAF Urbos trams
- Bulk search filtering for Tatra trams
- Bulk search filtering for MAN a21, a40, a78 buses
- Bulk search filtering for Urbino electric buses
- Bulk search filtering for all trams
- Bulk search filtering for all buses
- Bulk search filtering for all trolleybuses (Not available atm as trolleybuses are not driving in Tallinn currently)
- Show all TLT vehicles

## How to use
### Clone repo
`git clone https://github.com/eetnaviation/tlt-bus-map`
### Install dependencies
`npm i`
### Create folders for logs and gps data
`mkdir gps`
`mkdir logs`
### Run it!
`node main.js`
It runs on port 8081 by default.
